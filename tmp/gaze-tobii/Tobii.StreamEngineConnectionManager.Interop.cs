/*
COPYRIGHT 2024 - PROPERTY OF TOBII AB
-------------------------------------
2024 TOBII AB - KARLSROVAGEN 2D, DANDERYD 182 53, SWEDEN - All Rights Reserved.

NOTICE:  All information contained herein is, and remains, the property of Tobii AB and its suppliers, if any.
The intellectual and technical concepts contained herein are proprietary to Tobii AB and its suppliers and may be
covered by U.S.and Foreign Patents, patent applications, and are protected by trade secret or copyright law.
Dissemination of this information or reproduction of this material is strictly forbidden unless prior written
permission is obtained from Tobii AB.
*/

using System;
using System.Runtime.InteropServices;

namespace Tobii.StreamEngine
{
    public static class ConnectionManagerInterop
    {
        public const string stream_engine_dll = "tobii_stream_engine";

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_find_all_eyetrackers")]
        private static extern tobii_error_t tobii_find_all_eyetrackers_internal(ref tobii_eyetracker_list_t eyetrackers);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_free_eyetrackers")]
        private static extern tobii_error_t tobii_free_eyetrackers_internal(ref tobii_eyetracker_list_t eyetrackers);

        public static tobii_error_t tobii_find_all_eyetrackers(out tobii_eyetracker_t[] eyetrackers)
        {
            var eyetrackersNative = new tobii_eyetracker_list_t();
            tobii_error_t error = tobii_find_all_eyetrackers_internal(ref eyetrackersNative);

            if(error != tobii_error_t.TOBII_ERROR_NO_ERROR)
            {
                eyetrackers = Array.Empty<tobii_eyetracker_t>();
                return error;
            }

            eyetrackers = new tobii_eyetracker_t[eyetrackersNative.count];
            for(int i = 0; i < (int)eyetrackersNative.count; i++)
            {
                IntPtr trackerPointer = Marshal.ReadIntPtr(eyetrackersNative.eyetrackers, i * IntPtr.Size);
                eyetrackers[i] = Marshal.PtrToStructure<tobii_eyetracker_t>(trackerPointer);
            }

            // Release the native structure, we have the managed array instead
            return tobii_free_eyetrackers_internal(ref eyetrackersNative);
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_connect_processor")]
        private static extern tobii_error_t tobii_connect_processor_internal(IntPtr processor,
            tobii_license_key_t licenseKey, out IntPtr device);

        public static tobii_error_t tobii_connect_processor(IntPtr processor, string licenseKey, out IntPtr device)
        {
            // Convert string to tobii_license_key_t and pass that into the external function
            var key = new tobii_license_key_t
            {
                license_key = licenseKey,
                size_in_bytes = new IntPtr(licenseKey.Length * 2)
            };

            return tobii_connect_processor_internal(processor, key, out device);
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_connect_eyetracker")]
        private static extern tobii_error_t tobii_connect_eyetracker_internal(ref tobii_eyetracker_t eyetracker,
            tobii_license_key_t licenseKey, out IntPtr device);

        public static tobii_error_t tobii_connect_eyetracker(tobii_eyetracker_t eyetracker, string licenseKey, out IntPtr device)
        {
            // Convert string to tobii_license_key_t and pass that into the external function
            var key = new tobii_license_key_t
            {
                license_key = licenseKey,
                size_in_bytes = new IntPtr(licenseKey.Length * 2)
            };

            return tobii_connect_eyetracker_internal(ref eyetracker, key, out device);
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl)]
        public static extern tobii_error_t tobii_disconnect(IntPtr device);
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct tobii_eyetracker_t
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string url;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    internal struct tobii_eyetracker_list_t
    {
        public nint eyetrackers;
        public nuint count;
    }
}
