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
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace TobiiProcessor
{
    public static class Interop
    {
        public const string tobii_processor_dll = "tobii_processor_nexus";

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        public delegate void tobii_processor_log_func_t(IntPtr log_context, tobii_processor_log_level_t level,
            string text);

        [DllImport(tobii_processor_dll, CharSet = CharSet.Ansi, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_processor_create")]
        private static extern IntPtr tobii_processor_create_internal(tobii_processor_log_t? custom_log,
            string? storage_path, tobii_processor_config_t? json_config, tobii_camera_parameters_t? camera_parameters);

        public static IntPtr tobii_processor_create(tobii_processor_log_t? custom_log,
            tobii_camera_parameters_t? camera_parameters)
        {
            return tobii_processor_create_internal(custom_log, null, null, camera_parameters);
        }

        [DllImport(tobii_processor_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_processor_destroy")]
        public static extern void tobii_processor_destroy(IntPtr tobii_processor);

        [StructLayout(LayoutKind.Sequential)]
        public class tobii_processor_log_t
        {
            public IntPtr log_context;
            public Interop.tobii_processor_log_func_t? log_func;
        }

        public enum tobii_processor_log_level_t
        {
            TOBII_PROCESSOR_LOG_LEVEL_ERROR,
            TOBII_PROCESSOR_LOG_LEVEL_WARN,
            TOBII_PROCESSOR_LOG_LEVEL_INFO,
            TOBII_PROCESSOR_LOG_LEVEL_DEBUG,
            TOBII_PROCESSOR_LOG_LEVEL_TRACE,
        }

        [StructLayout(LayoutKind.Sequential)]
        private class tobii_processor_config_t
        {
            public IntPtr data;
            public IntPtr size_in_bytes;
        }

        [StructLayout(LayoutKind.Sequential)]
        public class tobii_camera_parameters_t
        {
            public float fov;
            public float w_aspect_ratio;
            public float h_aspect_ratio;
        }
    }
}
