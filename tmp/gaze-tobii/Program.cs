using SampleCSharp;
using System.Text;
using System.Text.Json;
using Tobii.StreamEngine;
using TobiiProcessor;

// ─── Configuration ──────────────────────────────────────────────
const string SELicensePath = "data/se_license_key";
const int ImageWidth_px = 1920;
const int ImageHeight_px = 1080;
const int FrameRate_Hz = 30;
const float DiagonalFieldOfView_deg = 78.0f;

// HP ZBook Firefly 14" display area (approximate, mm from webcam)
// Webcam is at top center of screen
var ScreenTopLeft_mm = new TobiiVector3 { x = -155.0f, y = -5.0f, z = 0.0f };
var ScreenTopRight_mm = new TobiiVector3 { x = 155.0f, y = -5.0f, z = 0.0f };
var ScreenBottomLeft_mm = new TobiiVector3 { x = -155.0f, y = -200.0f, z = 0.0f };

// ─── Linger detection ───────────────────────────────────────────
const int LINGER_WINDOW_MS = 1000;    // 1 second of stable gaze = linger
const float LINGER_TOLERANCE = 0.05f; // normalized coord tolerance (5% of screen)
const int LINGER_COOLDOWN_MS = 2000;  // don't re-emit same linger for 2s

var gazeHistory = new List<(float x, float y, long timestampMs)>();
long lastLingerEmitMs = 0;
float lastLingerX = -1, lastLingerY = -1;

// ─── Store delegates to prevent GC ─────────────────────────────
// Native code holds a pointer to these; if GC collects them, the app crashes.
tobii_gaze_callback_t? gazeCallbackDelegate = null;
TobiiProcessor.Interop.tobii_processor_log_func_t? processorLogDelegate = null;

// ─── Gaze callback ─────────────────────────────────────────────
static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

void OnGazePointCallback(ref tobii_gaze_point_t gazePoint, nint userData)
{
    long nowMs = NowMs();

    if (gazePoint.validity == tobii_validity_t.TOBII_VALIDITY_VALID)
    {
        float x = gazePoint.position.x;
        float y = gazePoint.position.y;

        // Output raw gaze for debugging
        Console.WriteLine($"GAZE:{{\"x\":{x:F4},\"y\":{y:F4},\"valid\":true,\"ts\":{nowMs}}}");

        // Linger detection
        gazeHistory.Add((x, y, nowMs));

        // Remove old entries
        gazeHistory.RemoveAll(g => nowMs - g.timestampMs > LINGER_WINDOW_MS);

        // Check if all points in window are within tolerance
        if (gazeHistory.Count >= 10) // at least 10 samples (~333ms at 30fps)
        {
            float avgX = gazeHistory.Average(g => g.x);
            float avgY = gazeHistory.Average(g => g.y);
            bool allClose = gazeHistory.All(g =>
                MathF.Abs(g.x - avgX) < LINGER_TOLERANCE &&
                MathF.Abs(g.y - avgY) < LINGER_TOLERANCE);

            long windowSpan = gazeHistory[^1].timestampMs - gazeHistory[0].timestampMs;

            if (allClose && windowSpan >= LINGER_WINDOW_MS * 0.8)
            {
                // Check cooldown and position change
                bool cooledDown = nowMs - lastLingerEmitMs > LINGER_COOLDOWN_MS;
                bool posChanged = MathF.Abs(avgX - lastLingerX) > LINGER_TOLERANCE ||
                                  MathF.Abs(avgY - lastLingerY) > LINGER_TOLERANCE;

                if (cooledDown || posChanged)
                {
                    Console.WriteLine($"GAZE_LINGER:{{\"x\":{avgX:F4},\"y\":{avgY:F4}}}");
                    lastLingerEmitMs = nowMs;
                    lastLingerX = avgX;
                    lastLingerY = avgY;
                    gazeHistory.Clear();
                }
            }
        }
    }
    else
    {
        Console.WriteLine($"GAZE:{{\"x\":0,\"y\":0,\"valid\":false,\"ts\":{nowMs}}}");
        gazeHistory.Clear(); // Invalid gaze breaks linger
    }
}

// ─── Main ───────────────────────────────────────────────────────
Console.Error.WriteLine("[GazeTobii] Starting...");
Console.Error.WriteLine($"[GazeTobii] HP ZBook Firefly 14 G10 | HP 5MP Camera");
Console.Error.WriteLine($"[GazeTobii] Resolution: {ImageWidth_px}x{ImageHeight_px} @ {FrameRate_Hz}fps");
Console.Error.WriteLine($"[GazeTobii] FOV: {DiagonalFieldOfView_deg}°");
Console.Error.WriteLine($"[GazeTobii] Linger: {LINGER_WINDOW_MS}ms, tolerance: {LINGER_TOLERANCE}");

var processorContext = IntPtr.Zero;
var deviceContext = IntPtr.Zero;
NexusImageInjectionFromCamera? media = null;
var cts = new CancellationTokenSource();

// Handle Ctrl+C
Console.CancelKeyPress += (s, e) =>
{
    e.Cancel = true;
    cts.Cancel();
    Console.Error.WriteLine("[GazeTobii] Ctrl+C received, shutting down...");
};

try
{
    await MainAsync();
}
catch (Exception ex)
{
    Console.Error.WriteLine($"[GazeTobii] Fatal error: {ex.Message}");
    Console.Error.WriteLine(ex.StackTrace);
}
finally
{
    Console.Error.WriteLine("[GazeTobii] Cleaning up...");
    if (media != null) await media.StopAndCleanupCameraAsync();
    if (deviceContext != IntPtr.Zero)
        ConnectionManagerInterop.tobii_disconnect(deviceContext);
    if (processorContext != IntPtr.Zero)
        TobiiProcessor.Interop.tobii_processor_destroy(processorContext);
    Console.Error.WriteLine("[GazeTobii] Shutdown complete.");
}

async Task MainAsync()
{
    // Check for HW eye trackers first
    tobii_eyetracker_t[] eyetrackers;
    var findErr = ConnectionManagerInterop.tobii_find_all_eyetrackers(out eyetrackers);
    if (findErr != tobii_error_t.TOBII_ERROR_NO_ERROR)
    {
        Console.Error.WriteLine($"[GazeTobii] tobii_find_all_eyetrackers failed: {findErr}");
    }

    if (eyetrackers == null || eyetrackers.Length == 0)
    {
        Console.Error.WriteLine("[GazeTobii] No HW eye trackers. Using Tobii Nexus (webcam)...");

        // Create processor (store delegate to prevent GC)
        processorLogDelegate = (ctx, level, text) =>
            Console.Error.WriteLine($"[Processor:{level}] {text}");
        var log = new TobiiProcessor.Interop.tobii_processor_log_t { log_func = processorLogDelegate };
        var camParams = new TobiiProcessor.Interop.tobii_camera_parameters_t
        {
            w_aspect_ratio = ImageWidth_px,
            h_aspect_ratio = ImageHeight_px,
            fov = DiagonalFieldOfView_deg,
        };
        processorContext = TobiiProcessor.Interop.tobii_processor_create(log, camParams);
        if (processorContext == IntPtr.Zero)
        {
            Console.Error.WriteLine("[GazeTobii] Failed to create processor!");
            return;
        }
        Console.Error.WriteLine("[GazeTobii] Processor created.");

        // Connect with license
        string license = File.ReadAllText(SELicensePath, Encoding.Unicode);
        var connErr = ConnectionManagerInterop.tobii_connect_processor(
            processorContext, license, out deviceContext);
        if (connErr != tobii_error_t.TOBII_ERROR_NO_ERROR)
        {
            Console.Error.WriteLine($"[GazeTobii] tobii_connect_processor failed: {connErr}");
            return;
        }
        Console.Error.WriteLine("[GazeTobii] Device connected.");

        // Set display area
        var displayArea = new tobii_display_area_t
        {
            top_left_mm_xyz = ScreenTopLeft_mm,
            top_right_mm_xyz = ScreenTopRight_mm,
            bottom_left_mm_xyz = ScreenBottomLeft_mm,
        };
        ConfigInterop.tobii_set_display_area(deviceContext, ref displayArea);
        Console.Error.WriteLine("[GazeTobii] Display area set.");

        // Load calibration if available
        string calibPath = "data/calib_default.blob";
        if (File.Exists(calibPath))
        {
            byte[] calibData = File.ReadAllBytes(calibPath);
            ConfigInterop.tobii_calibration_apply(deviceContext, calibData);
            Console.Error.WriteLine("[GazeTobii] Calibration applied.");
        }
        else
        {
            Console.Error.WriteLine("[GazeTobii] No calibration blob found, using defaults.");
        }

        // Start camera
        media = await NexusImageInjectionFromCamera.InitializeAndStartCameraAsync(
            deviceContext, ImageWidth_px, ImageHeight_px, FrameRate_Hz);
        if (media == null)
        {
            Console.Error.WriteLine("[GazeTobii] Camera init failed!");
            return;
        }
        Console.Error.WriteLine("[GazeTobii] Camera streaming started.");
    }
    else
    {
        // HW eye tracker
        Console.Error.WriteLine($"[GazeTobii] Found HW tracker: {eyetrackers[0].url}");
        string license = File.ReadAllText(SELicensePath, Encoding.Unicode);
        var connErr = ConnectionManagerInterop.tobii_connect_eyetracker(
            eyetrackers[0], license, out deviceContext);
        if (connErr != tobii_error_t.TOBII_ERROR_NO_ERROR)
        {
            Console.Error.WriteLine($"[GazeTobii] Connect failed: {connErr}");
            return;
        }
    }

    // Subscribe to gaze (store delegate to prevent GC)
    gazeCallbackDelegate = new tobii_gaze_callback_t(OnGazePointCallback);
    var gazeErr = ScreenbasedInterop.tobii_gaze_subscribe(deviceContext, gazeCallbackDelegate);
    if (gazeErr != tobii_error_t.TOBII_ERROR_NO_ERROR)
    {
        Console.Error.WriteLine($"[GazeTobii] Gaze subscribe failed: {gazeErr}");
        return;
    }
    Console.Error.WriteLine("[GazeTobii] READY — Gaze tracking active.");
    Console.Error.WriteLine("[GazeTobii] Streaming gaze data to stdout...");

    // Wait until cancelled
    try
    {
        await Task.Delay(Timeout.Infinite, cts.Token);
    }
    catch (OperationCanceledException) { }

    // Unsubscribe
    ScreenbasedInterop.tobii_gaze_unsubscribe(deviceContext);
    Console.Error.WriteLine("[GazeTobii] Gaze unsubscribed.");
}
