using System.Runtime.InteropServices;
using Tobii.StreamEngine;
using Windows.Media.Capture.Frames;
using Windows.Media.Capture;
using Windows.Media.MediaProperties;
using Windows.Foundation;
using Windows.Graphics.Imaging;
using Windows.Storage.Streams;
using WinRT;

namespace SampleCSharp
{
    /// <summary>
    /// Handler for camera access and streaming. Does the work needed to convert RGB images to grayscale, then calling
    /// tobii_process_frame towards a given tobii_device_t context.
    /// </summary>
    internal class NexusImageInjectionFromCamera
    {
        // Objects necessary for camera access
        MediaCapture? _capture;
        MediaFrameReader? _reader;

        // Image format info (obtained from factory)
        int _imageWidth;
        int _imageHeight;
        int _frameRate;

        // Device context to which to send the processed images (obtained from factory)
        nint _deviceContext;

        // Private constructor, so that the class can only be created through the factory method
        private NexusImageInjectionFromCamera()
        {
        }

        /// <summary>
        /// Factory method to setup this.
        /// </summary>
        /// <param name="deviceContext">tobii_device_t to call tobii_process_frame to</param>
        /// <param name="imageWidth">Image width.</param>
        /// <param name="imageHeight">Image height. Aspect ratio must match the one set for the Tobii Processor.</param>
        /// <param name="frameRate">Frame rate for the camera capture</param>
        /// <returns>If successful, returns an ImageInjectionFromCamera object, otherwise null.</returns>
        public static async Task<NexusImageInjectionFromCamera?> InitializeAndStartCameraAsync(nint deviceContext,
            int imageWidth, int imageHeight, int frameRate)
        {
            // Find a suitable camera
            IReadOnlyList<MediaFrameSourceGroup> frameSourceGroups = await MediaFrameSourceGroup.FindAllAsync();

            MediaFrameSourceGroup? selectedGroup = null;
            MediaFrameSourceInfo? colorSourceInfo = null;

            FindMediaFrameSource(frameSourceGroups, out selectedGroup, out colorSourceInfo);

            if (selectedGroup == null || colorSourceInfo == null)
            {
                Console.WriteLine("No suitable camera found!");
                return null;
            }

            Console.WriteLine($"Using media frame source {selectedGroup.DisplayName}");

            // Create and setup the object now
            var media = new NexusImageInjectionFromCamera();
            media._capture = new MediaCapture();
            media._deviceContext = deviceContext;
            media._imageWidth = imageWidth;
            media._imageHeight = imageHeight;
            media._frameRate = frameRate;
            var settings = new MediaCaptureInitializationSettings()
            {
                SourceGroup = selectedGroup,
                SharingMode = MediaCaptureSharingMode.ExclusiveControl,
                MemoryPreference = MediaCaptureMemoryPreference.Cpu,
                StreamingCaptureMode = StreamingCaptureMode.Video
            };
            try
            {
                await media._capture.InitializeAsync(settings);
            }
            catch (Exception ex)
            {
                Console.WriteLine("MediaCapture initialization failed: " + ex.Message);
                Console.WriteLine(ex.StackTrace);
                return null;
            }

            // Determine the best media type, create a frame reader and start it
            MediaFrameSource colorFrameSource = media._capture.FrameSources[colorSourceInfo.Id];

            if(!await media.SetBestMediaType(colorFrameSource))
            {
                Console.WriteLine($"Could not find a media format on the camera compatible with requested resolution {imageWidth} x {imageHeight}");
                return null;
            }

            // Setup the frame callback and start the camera now
            media._reader = await media._capture.CreateFrameReaderAsync(colorFrameSource, MediaEncodingSubtypes.Argb32);
            media._reader.FrameArrived += media.ColorFrameReader_FrameArrived;

            await media._reader.StartAsync();

            return media;
        }

        /// <summary>
        /// Cleans up the resources. Needed to be called at the end, possibly in a "finally" block.
        /// </summary>
        /// <returns>Void async task.</returns>
        public async Task StopAndCleanupCameraAsync()
        {
            if (_reader != null)
            {
                await _reader.StopAsync();
                _reader.FrameArrived -= ColorFrameReader_FrameArrived;
            }
            _capture?.Dispose();
            _capture = null;
        }

        // Finds the first camera that can provide color frames
        static void FindMediaFrameSource(IReadOnlyList<MediaFrameSourceGroup> frameSourceGroups,
            out MediaFrameSourceGroup? group, out MediaFrameSourceInfo? info)
        {
            group = null;
            info = null;
            foreach (MediaFrameSourceGroup sourceGroup in frameSourceGroups)
            {
                foreach (MediaFrameSourceInfo sourceInfo in sourceGroup.SourceInfos)
                {
                    if ((sourceInfo.MediaStreamType == MediaStreamType.VideoRecord ||
                        sourceInfo.MediaStreamType == MediaStreamType.VideoPreview) &&
                        sourceInfo.SourceKind == MediaFrameSourceKind.Color)
                    {
                        info = sourceInfo;
                        group = sourceGroup;
                        break;
                    }
                }
                if (info != null)
                {
                    break;
                }
            }
        }

        // Finds a media type best matching the requested image size and frame rate
        async Task<bool> SetBestMediaType(MediaFrameSource source)
        {
            IReadOnlyList<MediaFrameFormat> formats = source.SupportedFormats;
            uint actualWidth = 0;
            uint actualHeight = 0;
            float maxFps = 0;
            MediaFrameFormat? bestFormat = null;

            float requiredAspectRatio = (float)_imageWidth / _imageHeight;

            foreach (MediaFrameFormat format in formats)
            {
                if (format.Subtype != "NV12" && format.Subtype != "YUY2")
                {
                    continue;
                }
                uint currentWidth = format.VideoFormat.Width;
                uint currentHeight = format.VideoFormat.Height;

                if (currentHeight == 0 || format.FrameRate.Denominator == 0)
                {
                    continue;   // avoid division by 0
                }

                float currentFps = (float)(format.FrameRate.Numerator / format.FrameRate.Denominator);
                float currentAspectRatio = (float)currentWidth / currentHeight;

                // Aspect ratio must match
                if (MathF.Abs(currentAspectRatio - requiredAspectRatio) < 0.01 &&
                    currentWidth >= actualWidth && currentWidth <= _imageWidth &&
                    currentHeight >= actualHeight && currentHeight <= _imageHeight &&
                    currentFps >= maxFps && currentFps <= _frameRate)
                {
                    actualWidth = currentWidth;
                    actualHeight = currentHeight;
                    maxFps = currentFps;
                    bestFormat = format;
                }
            }
            if (bestFormat != null)
            {
                // Update the fields now
                _imageWidth = (int)actualWidth;
                _imageHeight = (int)actualHeight;
                _frameRate = (int)maxFps;
                await source.SetFormatAsync(bestFormat);
            }
            return bestFormat != null;  // Fail if we couldn't find a compatible media type
        }

        // Callback when frame arrives from the camera
        void ColorFrameReader_FrameArrived(MediaFrameReader sender, MediaFrameArrivedEventArgs args)
        {
            MediaFrameReference mediaFrameReference = sender.TryAcquireLatestFrame();
            if (mediaFrameReference == null)
            {
                return;
            }

            using (mediaFrameReference)
            {
                VideoMediaFrame? videoMediaFrame = mediaFrameReference.VideoMediaFrame;
                SoftwareBitmap? softwareBitmap = videoMediaFrame?.SoftwareBitmap;
                MediaFrameReference? frameReference = videoMediaFrame?.FrameReference;
                TimeSpan? systemTime = frameReference?.SystemRelativeTime;
                long? timestamp_ticks = systemTime?.Ticks;

                if (softwareBitmap == null || timestamp_ticks == null)
                {
                    return;
                }

                // 1 tick = 0.1 us
                long timestamp_us = timestamp_ticks.Value / 10;

                var frame = new tobii_image_frame_t
                {
                    // Fill in the image frame struct...
                    timestamp_us = timestamp_us,
                    format = tobii_frame_format_t.TOBII_FRAME_FORMAT_GRAY8,
                    width = _imageWidth,
                    height = _imageHeight,
                    stride = _imageWidth,
                    data_size = new IntPtr(_imageWidth * _imageHeight)
                };

                // Input image needs to be 8bit grayscale
                if (softwareBitmap.BitmapPixelFormat != BitmapPixelFormat.Gray8)
                {
                    softwareBitmap = SoftwareBitmap.Convert(softwareBitmap, BitmapPixelFormat.Gray8);
                }

                // Process the frame
                using BitmapBuffer buffer = softwareBitmap.LockBuffer(BitmapBufferAccessMode.Read);
                using IMemoryBufferReference reference = buffer.CreateReference();

                // Here is where we'll call tobii_process_frame
                unsafe
                {
                    // Get input and output byte access buffers.
                    var byteAccess = reference.As<IMemoryBufferByteAccess>();
                    byteAccess.GetBuffer(out byte* bytes, out uint capacity);

                    frame.data = (IntPtr)bytes;
                    tobii_error_t error = Interop.tobii_process_frame(_deviceContext, frame);
                    if (error != tobii_error_t.TOBII_ERROR_NO_ERROR)
                    {
                        Console.WriteLine("Failed processing frame: " + Interop.tobii_error_message(error));
                    }
                }
            }
        }
    }

    /// <summary>
    /// COM import needed to access the byte buffer of a SoftwareBitmap.
    /// </summary>
    [ComImport]
    [Guid("5B0D3235-4DBA-4D44-865E-8F1D0E4FD04D")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    unsafe interface IMemoryBufferByteAccess
    {
        void GetBuffer(out byte* buffer, out uint capacity);
    }
}
