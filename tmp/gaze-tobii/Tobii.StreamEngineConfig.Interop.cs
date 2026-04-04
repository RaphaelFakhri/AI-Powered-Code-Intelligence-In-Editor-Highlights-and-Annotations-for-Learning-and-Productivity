/*
COPYRIGHT 2025 - PROPERTY OF TOBII AB
-------------------------------------
2025 TOBII AB - KARLSROVAGEN 2D, DANDERYD 182 53, SWEDEN - All Rights Reserved.

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

namespace Tobii.StreamEngine
{
    public static class ConfigInterop
    {
        public const string stream_engine_dll = "tobii_stream_engine";

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_get_enabled_eye")]
        public static extern tobii_error_t tobii_get_enabled_eye(IntPtr device, out tobii_enabled_eye_t enabled_eye);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_set_enabled_eye")]
        public static extern tobii_error_t tobii_set_enabled_eye(IntPtr device, tobii_enabled_eye_t enabled_eye);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_start")]
        public static extern tobii_error_t tobii_calibration_start(IntPtr device, tobii_enabled_eye_t enabled_eye);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_stop")]
        public static extern tobii_error_t tobii_calibration_stop(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_clear")]
        public static extern tobii_error_t tobii_calibration_clear(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_collect_data_2d")]
        public static extern tobii_error_t tobii_calibration_collect_data_2d(IntPtr device, float x, float y);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_collect_data_3d")]
        public static extern tobii_error_t tobii_calibration_collect_data_3d(IntPtr device, float x, float y, float z);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_collect_data_per_eye_2d")]
        public static extern tobii_error_t tobii_calibration_collect_data_per_eye_2d(IntPtr device, float x, float y, tobii_enabled_eye_t requested_eyes, out tobii_enabled_eye_t collected_eyes);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_discard_data_2d")]
        public static extern tobii_error_t tobii_calibration_discard_data_2d(IntPtr device, float x, float y);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_discard_data_3d")]
        public static extern tobii_error_t tobii_calibration_discard_data_3d(IntPtr device, float x, float y, float z);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_discard_data_per_eye_2d")]
        public static extern tobii_error_t tobii_calibration_discard_data_per_eye_2d(IntPtr device, float x, float y, tobii_enabled_eye_t calibrated_eyes);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_compute_and_apply")]
        public static extern tobii_error_t tobii_calibration_compute_and_apply(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_compute_and_apply_per_eye")]
        public static extern tobii_error_t tobii_calibration_compute_and_apply_per_eye(IntPtr device, out tobii_enabled_eye_t collected_eyes);

        public static tobii_error_t tobii_calibration_retrieve(IntPtr device, out byte[]? calibration)
        {
            byte[]? buffer = null;

            var result = tobii_calibration_retrieve_internal(device, (data, size, userData) =>
            {
                buffer = new byte[size.ToInt32()];
                if (size.ToInt32() > 0)
                {
                    Marshal.Copy(data, buffer, 0, size.ToInt32());
                }
            });

            calibration = buffer;

            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_retrieve")]
        private static extern tobii_error_t tobii_calibration_retrieve_internal(IntPtr device, tobii_data_receiver_t callback, IntPtr user_data = default(IntPtr));

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        public delegate void tobii_calibration_point_data_receiver_t(ref tobii_calibration_point_data_t point_data, IntPtr user_data);

        public static tobii_error_t tobii_calibration_parse(IntPtr api, byte[] calibration, out List<tobii_calibration_point_data_t> point_data_items)
        {
            var points = new List<tobii_calibration_point_data_t>();
            var p = Marshal.AllocHGlobal(calibration.Length);
            Marshal.Copy(calibration, 0, p, calibration.Length);
            var result = tobii_calibration_parse_internal(api, p, new IntPtr(calibration.Length), (ref tobii_calibration_point_data_t point_data, IntPtr user_data) =>
            {
                tobii_calibration_point_data_t point;
                point.point_xy = point_data.point_xy;
                point.left_status = point_data.left_status;
                point.left_mapping_xy = point_data.left_mapping_xy;
                point.right_status = point_data.right_status;
                point.right_mapping_xy = point_data.right_mapping_xy;

                points.Add(point);
            }, IntPtr.Zero);

            Marshal.FreeHGlobal(p);
            point_data_items = points;

            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_parse")]
        private static extern tobii_error_t tobii_calibration_parse_internal(IntPtr api, IntPtr calibration, IntPtr calibration_size, tobii_calibration_point_data_receiver_t callback, IntPtr user_data);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_apply")]
        private static extern tobii_error_t tobii_calibration_apply_internal(IntPtr device, IntPtr data, IntPtr size);

        public static tobii_error_t tobii_calibration_apply(IntPtr device, byte[] calibration)
        {
            var ptr = Marshal.AllocHGlobal(calibration.Length);
            tobii_error_t result;

            try
            {
                Marshal.Copy(calibration, 0, ptr, calibration.Length);
                result = tobii_calibration_apply_internal(device, ptr, new IntPtr(calibration.Length));
            }
            finally
            {
                Marshal.FreeHGlobal(ptr);
            }

            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calculate_display_area_basic")]
        public static extern tobii_error_t tobii_calculate_display_area_basic(IntPtr api, float width_mm, float height_mm, float offset_x_mm, ref tobii_geometry_mounting_t geometry_mounting, out tobii_display_area_t display_area);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_get_display_area")]
        public static extern tobii_error_t tobii_get_display_area(IntPtr device, out tobii_display_area_t display_area);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_set_display_area")]
        public static extern tobii_error_t tobii_set_display_area(IntPtr device, ref tobii_display_area_t display_area);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_get_geometry_mounting")]
        public static extern tobii_error_t tobii_get_geometry_mounting(IntPtr device, out tobii_geometry_mounting_t geometry);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Ansi, EntryPoint = "tobii_get_device_name")]
        private static extern tobii_error_t tobii_get_device_name_internal(IntPtr device, StringBuilder device_name);

        public static tobii_error_t tobii_get_device_name(IntPtr device, out string device_name)
        {
            var dn = new StringBuilder(64);
            var result = tobii_get_device_name_internal(device, dn);
            device_name = dn.ToString();
            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Ansi, EntryPoint = "tobii_set_device_name")]
        public static extern tobii_error_t tobii_set_device_name(IntPtr device, string device_name);


        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_enumerate_output_frequencies")]
        public static extern tobii_error_t tobii_enumerate_output_frequencies(IntPtr device, tobii_output_frequency_receiver_t receiver);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_set_output_frequency")]
        public static extern tobii_error_t tobii_set_output_frequency(IntPtr device, float output_frequency);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_get_output_frequency")]
        public static extern tobii_error_t tobii_get_output_frequency(IntPtr device, out float output_frequency);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_output_frequency_subscribe")]
        public static extern tobii_error_t tobii_output_frequency_subscribe(IntPtr device, tobii_output_frequency_receiver_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_output_frequency_unsubscribe")]
        public static extern tobii_error_t tobii_output_frequency_unsubscribe(IntPtr device);


        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Ansi, EntryPoint = "tobii_get_display_id")]
        private static extern tobii_error_t tobii_get_display_id_internal(IntPtr device, StringBuilder display_id);

        public static tobii_error_t tobii_get_display_id(IntPtr device, out string display_id)
        {
            var di = new StringBuilder(256);
            var result = tobii_get_display_id_internal(device, di);
            display_id = di.ToString();
            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Ansi, EntryPoint = "tobii_set_display_id")]
        public static extern tobii_error_t tobii_set_display_id(IntPtr device, string display_id);

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        public delegate void tobii_display_id_callback_t(string display_id, IntPtr user_data);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_display_id_subscribe")]
        public static extern tobii_error_t tobii_display_id_subscribe(IntPtr device, tobii_display_id_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_display_id_unsubscribe")]
        public static extern tobii_error_t tobii_display_id_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_calibration_stimulus_points_get")]
        public static extern tobii_error_t tobii_calibration_stimulus_points_get(IntPtr device, out tobii_calibration_stimulus_points_t stimulus_points);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_device_calibration_start")]
        public static extern tobii_error_t tobii_device_calibration_start(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_device_calibration_stop")]
        public static extern tobii_error_t tobii_device_calibration_stop(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_device_calibration_reset")]
        public static extern tobii_error_t tobii_device_calibration_reset(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_device_calibration_collect_data")]
        public static extern tobii_error_t tobii_device_calibration_collect_data(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_device_calibration_compute_and_apply")]
        public static extern tobii_error_t tobii_device_calibration_compute_and_apply(IntPtr device);

        public static tobii_error_t tobii_device_calibration_retrieve(IntPtr device, out byte[]? calibration)
        {
            byte[]? buffer = null;

            var result = tobii_device_calibration_retrieve_internal(device, (data, size, userData) =>
            {
                buffer = new byte[size.ToInt32()];
                if (size.ToInt32() > 0)
                {
                    Marshal.Copy(data, buffer, 0, size.ToInt32());
                }
            });

            calibration = buffer;

            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_device_calibration_retrieve")]
        private static extern tobii_error_t tobii_device_calibration_retrieve_internal(IntPtr device, tobii_data_receiver_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_device_calibration_apply")]
        private static extern tobii_error_t tobii_device_calibration_apply_internal(IntPtr device, IntPtr data, IntPtr size);

        public static tobii_error_t tobii_device_calibration_apply(IntPtr device, byte[] calibration)
        {
            var ptr = Marshal.AllocHGlobal(calibration.Length);
            tobii_error_t result;

            try
            {
                Marshal.Copy(calibration, 0, ptr, calibration.Length);
                result = tobii_device_calibration_apply_internal(device, ptr, new IntPtr(calibration.Length));
            }
            finally
            {
                Marshal.FreeHGlobal(ptr);
            }

            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_get_calibration_id")]
        public static extern tobii_error_t tobii_get_calibration_id(IntPtr device, out uint value);
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_output_frequency_receiver_t(float output_frequency, IntPtr user_data);

    public enum tobii_calibration_point_status_t
    {
        TOBII_CALIBRATION_POINT_STATUS_FAILED_OR_INVALID,
        TOBII_CALIBRATION_POINT_STATUS_VALID_BUT_NOT_USED_IN_CALIBRATION,
        TOBII_CALIBRATION_POINT_STATUS_VALID_AND_USED_IN_CALIBRATION,
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_calibration_point_data_t
    {
        public TobiiVector2 point_xy;

        public tobii_calibration_point_status_t left_status;
        public TobiiVector2 left_mapping_xy;

        public tobii_calibration_point_status_t right_status;
        public TobiiVector2 right_mapping_xy;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_geometry_mounting_t
    {
        public int guides;
        public float width_mm;
        public float angle_deg;

        public TobiiVector3 external_offset_mm_xyz;
        public TobiiVector3 internal_offset_mm_xyz;
    }

    public enum tobii_calibration_stimulus_point_status_t
    {
        TOBII_CALIBRATION_STIMULUS_POINT_STATUS_FAILED_OR_INVALID,
        TOBII_CALIBRATION_STIMULUS_POINT_STATUS_VALID_NOT_USED,
        TOBII_CALIBRATION_STIMULUS_POINT_STATUS_VALID_USED,
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_calibration_stimulus_point_data_t
    {
        public TobiiVector3  point_xyz;
        public tobii_calibration_stimulus_point_status_t left_status;
        public float left_bias;
        public float left_precision;
        public tobii_calibration_stimulus_point_status_t right_status;
        public float right_bias;
        public float right_precision;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_calibration_stimulus_points_t
    {
        public int stimulus_point_count;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)] public tobii_calibration_stimulus_point_data_t[] stimulus_points;
    }
}
