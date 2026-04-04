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
    public static class ScreenbasedInterop
    {
        public const string stream_engine_dll = "tobii_stream_engine";

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode, EntryPoint = "tobii_presence_subscribe")]
        public static extern tobii_error_t tobii_presence_subscribe(IntPtr device, tobii_presence_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode, EntryPoint = "tobii_presence_unsubscribe")]
        public static extern tobii_error_t tobii_presence_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_user_position_guide_subscribe")]
        public static extern tobii_error_t tobii_user_position_guide_subscribe(IntPtr device, tobii_user_position_guide_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_user_position_guide_unsubscribe")]
        public static extern tobii_error_t tobii_user_position_guide_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_gaze_subscribe")]
        public static extern tobii_error_t tobii_gaze_subscribe(IntPtr device, tobii_gaze_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_gaze_unsubscribe")]
        public static extern tobii_error_t tobii_gaze_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_gaze_data_subscribe")]
        public static extern tobii_error_t tobii_gaze_data_subscribe(IntPtr device, tobii_gaze_data_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_gaze_data_unsubscribe")]
        public static extern tobii_error_t tobii_gaze_data_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode, EntryPoint = "tobii_absolute_eye_openness_subscribe")]
        public static extern tobii_error_t tobii_absolute_eye_openness_subscribe(IntPtr device, tobii_absolut_eye_openness_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode, EntryPoint = "tobii_absolute_eye_openness_unsubscribe")]
        public static extern tobii_error_t tobii_absolute_eye_openness_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_head_pose_subscribe")]
        public static extern tobii_error_t tobii_head_pose_subscribe(IntPtr device, tobii_head_pose_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_head_pose_unsubscribe")]
        public static extern tobii_error_t tobii_head_pose_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_gaze_origin_subscribe")]
        public static extern tobii_error_t tobii_gaze_origin_subscribe(IntPtr device, tobii_gaze_origin_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_gaze_origin_unsubscribe")]
        public static extern tobii_error_t tobii_gaze_origin_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode, EntryPoint = "tobii_primary_camera_image_subscribe")]
        public static extern tobii_error_t tobii_primary_camera_image_subscribe(IntPtr device, tobii_primary_camera_image_callback_t callback, IntPtr user_data);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode, EntryPoint = "tobii_primary_camera_image_unsubscribe")]
        public static extern tobii_error_t tobii_primary_camera_image_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_power_save_activate")]
        public static extern tobii_error_t tobii_power_save_activate(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_power_save_deactivate")]
        public static extern tobii_error_t tobii_power_save_deactivate(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_remote_wake_activate")]
        public static extern tobii_error_t tobii_remote_wake_activate(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_remote_wake_deactivate")]
        public static extern tobii_error_t tobii_remote_wake_deactivate(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_user_presence_subscribe")]
        public static extern tobii_error_t tobii_user_presence_subscribe(IntPtr device, tobii_user_presence_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_user_presence_unsubscribe")]
        public static extern tobii_error_t tobii_user_presence_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_get_track_box")]
        public static extern tobii_error_t tobii_get_track_box(IntPtr device, out tobii_track_box_t track_box);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_eye_position_normalized_subscribe")]
        public static extern tobii_error_t tobii_eye_position_normalized_subscribe(IntPtr device, tobii_eye_position_normalized_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_eye_position_normalized_unsubscribe")]
        public static extern tobii_error_t tobii_eye_position_normalized_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_gaze_point_subscribe")]
        public static extern tobii_error_t tobii_gaze_point_subscribe(IntPtr device, tobii_gaze_point_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_gaze_point_unsubscribe")]
        public static extern tobii_error_t tobii_gaze_point_unsubscribe(IntPtr device);  

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_digital_syncport_subscribe")]
        public static extern tobii_error_t tobii_digital_syncport_subscribe(IntPtr device, tobii_digital_syncport_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_digital_syncport_unsubscribe")]
        public static extern tobii_error_t tobii_digital_syncport_unsubscribe(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_enumerate_illumination_modes")]
        public static extern tobii_error_t tobii_enumerate_illumination_modes(IntPtr device, tobii_illumination_mode_receiver_t receiver);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_get_illumination_mode")]
        private static extern tobii_error_t tobii_get_illumination_mode_internal(IntPtr device, StringBuilder illumination_mode);

        public static tobii_error_t tobii_get_illumination_mode(IntPtr device, out string illumination_mode)
        {
            var im = new StringBuilder(64);
            var result = tobii_get_illumination_mode_internal(device, im);
            illumination_mode = im.ToString();
            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_set_illumination_mode")]
        public static extern tobii_error_t tobii_set_illumination_mode(IntPtr device, string illumination_mode);




        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_enumerate_face_types")]
        private static extern tobii_error_t tobii_enumerate_face_types_internal(IntPtr device, tobii_face_type_receiver_t receiver, IntPtr user_data);

        public static tobii_error_t tobii_enumerate_face_types(IntPtr device, out List<string> face_types)
        {
            var types = new List<string>();
            tobii_face_type_receiver_t handler = (face_type, data) => { types.Add(face_type); };
            var result = tobii_enumerate_face_types_internal(device, handler, IntPtr.Zero);

            face_types = types;

            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_set_face_type")]
        public static extern tobii_error_t tobii_set_face_type(IntPtr device, string face_type);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_get_face_type")]
        private static extern tobii_error_t tobii_get_face_type_internal(IntPtr device, StringBuilder face_type);

        public static tobii_error_t tobii_get_face_type(IntPtr device, out string face_type)
        {
            var val = new StringBuilder(64);
            var result = tobii_get_face_type_internal(device, val);
            face_type = val.ToString();
            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_diagnostics_image_subscribe")]
        public static extern tobii_error_t tobii_diagnostics_image_subscribe(IntPtr device, tobii_diagnostics_image_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_diagnostics_image_unsubscribe")]
        public static extern tobii_error_t tobii_diagnostics_image_unsubscribe(IntPtr device);
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_face_type_receiver_t(string face_type, IntPtr user_data);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_gaze_point_callback_t(ref tobii_gaze_point_t gaze_point, IntPtr user_data);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_gaze_origin_callback_t(ref tobii_gaze_origin_t gaze_origin, IntPtr user_data);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_user_presence_callback_t(tobii_user_presence_status_t status, long timestamp_us, IntPtr user_data);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_eye_position_normalized_callback_t(ref tobii_eye_position_normalized_t eye_position, IntPtr user_data);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_gaze_callback_t(ref tobii_gaze_point_t gaze_point, IntPtr user_data);

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_gaze_point_t
    {
        public long timestamp_us;
        public tobii_validity_t validity;
        public TobiiVector2 position;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_track_box_t
    {
        public TobiiVector3 front_upper_right_xyz;
        public TobiiVector3 front_upper_left_xyz;
        public TobiiVector3 front_lower_left_xyz;
        public TobiiVector3 front_lower_right_xyz;
        public TobiiVector3 back_upper_right_xyz;
        public TobiiVector3 back_upper_left_xyz;
        public TobiiVector3 back_lower_left_xyz;
        public TobiiVector3 back_lower_right_xyz;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_gaze_origin_t
    {
        public long timestamp_us;
        public tobii_validity_t left_validity;
        public TobiiVector3 left;
        public tobii_validity_t right_validity;
        public TobiiVector3 right;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_eye_position_normalized_t
    {
        public long timestamp_us;
        public tobii_validity_t left_validity;
        public TobiiVector3 left;
        public tobii_validity_t right_validity;
        public TobiiVector3 right;
    }

    public enum tobii_user_presence_status_t
    {
        TOBII_USER_PRESENCE_STATUS_UNKNOWN,
        TOBII_USER_PRESENCE_STATUS_AWAY,
        TOBII_USER_PRESENCE_STATUS_PRESENT,
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_gaze_data_eye_t
    {
        public tobii_validity_t gaze_origin_validity;
        public TobiiVector3 gaze_origin_from_eye_tracker_mm_xyz;

        public tobii_validity_t eye_position_validity;
        public TobiiVector3 eye_position_in_track_box_normalized_xyz;

        public tobii_validity_t gaze_point_validity;
        public TobiiVector3 gaze_point_from_eye_tracker_mm_xyz;
        public TobiiVector2 gaze_point_on_display_normalized_xy;

        public tobii_validity_t eyeball_center_validity;
        public TobiiVector3 eyeball_center_from_eye_tracker_mm_xyz;

        public tobii_validity_t pupil_validity;
        public float pupil_diameter_mm;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_gaze_data_t
    {
        public long timestamp_tracker_us;
        public long timestamp_system_us;
        public tobii_gaze_data_eye_t left;
        public tobii_gaze_data_eye_t right;
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_gaze_data_callback_t(ref tobii_gaze_data_t gaze_data, IntPtr user_data);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_illumination_mode_receiver_t(string illumination_mode);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_digital_syncport_callback_t(uint signal, long timestamp_tracker_us, long timestamp_system_us, IntPtr user_data);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_head_pose_callback_t(ref tobii_head_pose_t head_pose, IntPtr user_data);

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_head_pose_t
    {
        public long timestamp_us;
        public tobii_validity_t position_validity;
        public TobiiVector3 position_xyz;

        public tobii_validity_t rotation_x_validity;
        public tobii_validity_t rotation_y_validity;
        public tobii_validity_t rotation_z_validity;
        public TobiiVector3 rotation_xyz;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_user_position_guide_t
    {
        public long timestamp_us;
        public tobii_validity_t left_position_validity;
        public TobiiVector3 left_position_normalized_xyz;
        public tobii_validity_t right_position_validity;
        public TobiiVector3 right_position_normalized_xyz;
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_user_position_guide_callback_t(ref tobii_user_position_guide_t data, IntPtr user_data);

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_image_region_t
    {
        public uint camera;
        public int left;
        public int top;
        public int width;
        public int height;
        public int stride;
        public int offset;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_diagnostics_image_t
    {
        public long timestamp_tracker_us;
        public long timestamp_system_us;
        public int bits_per_pixel;
        public int padding_per_pixel;
        public int image_regions_count;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)] public tobii_image_region_t[] image_regions;
        public int type;
        public IntPtr data_size;
        public IntPtr data;
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_diagnostics_image_callback_t(ref tobii_diagnostics_image_t data, IntPtr user_data);

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_primary_camera_image_t
    {
        public long timestamp_us;
        public int bits_per_pixel;
        public int width;
        public int height;
        public int stride;
        public IntPtr data_size;
        public IntPtr data;
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_primary_camera_image_callback_t(ref tobii_primary_camera_image_t frame, IntPtr user_data);

    public enum tobii_presence_status_t
    {
        TOBII_PRESENCE_STATUS_UNKNOWN,
        TOBII_PRESENCE_STATUS_AWAY,
        TOBII_PRESENCE_STATUS_PRESENT,
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_presence_t
    {
        public long timestamp_us;
        public tobii_presence_status_t status;
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_presence_callback_t(ref tobii_presence_t presence, IntPtr user_data);

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_absolute_eye_openness_t
    {
        public long timestamp_tracker_us;
        public long timestamp_system_us;
        public tobii_validity_t left_validity;
        public float left_eye_openness;
        public tobii_validity_t right_validity;
        public float right_eye_openness;
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_absolut_eye_openness_callback_t(ref tobii_absolute_eye_openness_t data, IntPtr user_data);

    public struct tobii_remote_camera_t
    {
        public long timestamp;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string friendly_name;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string device_path;
        public tobii_state_bool_t is_selected;
    }
}
