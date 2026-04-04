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
    public static class Interop
    {
        public const string stream_engine_dll = "tobii_stream_engine";

        public static string? tobii_error_message(tobii_error_t result_code)
        {
            var pStr = tobii_error_message_internal(result_code);
            return Marshal.PtrToStringAnsi(pStr);
        }

        [DllImport(stream_engine_dll, CharSet = CharSet.Ansi, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_error_message")]
        private static extern IntPtr tobii_error_message_internal(tobii_error_t result_code);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_get_api_version")]
        public static extern tobii_error_t tobii_get_api_version(out tobii_version_t version);

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        public delegate void tobii_log_func_t(IntPtr log_context, tobii_log_level_t level, string text);

        public static tobii_error_t tobii_api_create(out IntPtr api, tobii_custom_log_t? custom_log)
        {
            return tobii_api_create_internal(out api, IntPtr.Zero, custom_log);
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_api_create")]
        private static extern tobii_error_t tobii_api_create_internal(out IntPtr api, IntPtr customAlloc, tobii_custom_log_t? custom_log); // Custom alloc doesn't make sense in .NET

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_api_destroy")]
        public static extern tobii_error_t tobii_api_destroy(IntPtr api);

        public static tobii_error_t tobii_enumerate_local_device_urls(IntPtr api, out List<string> device_urls)
        {
            var urls = new List<string>();
            tobii_device_url_receiver_t handler = (url, data) => { urls.Add(url); };
            var result = tobii_enumerate_local_device_urls_internal(api, handler, IntPtr.Zero);

            device_urls = urls;

            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_enumerate_local_device_urls")]
        private static extern tobii_error_t tobii_enumerate_local_device_urls_internal(IntPtr api, tobii_device_url_receiver_t receiverFunction, IntPtr userData);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_device_create_ex")]
        private static extern tobii_error_t tobii_device_create_ex_internal(IntPtr api, string url, tobii_field_of_use_t field_of_use, tobii_license_key_t[] license_keys, int license_count, [MarshalAs(UnmanagedType.LPArray)] tobii_license_validation_result_t[] licenseResults, out IntPtr device);

        public static tobii_error_t tobii_device_create_ex(IntPtr api, string url, tobii_field_of_use_t field_of_use, string[] license_keys, List<tobii_license_validation_result_t> license_results, out IntPtr device)
        {
            var keys = new List<tobii_license_key_t>();

            foreach (var key in license_keys)
            {
                keys.Add(new tobii_license_key_t { license_key = key, size_in_bytes = new IntPtr(key.Length * 2) });
            }

            var license_results_array = new tobii_license_validation_result_t[license_keys.Length];
            var tobii_error = tobii_device_create_ex_internal(api, url, field_of_use, keys.ToArray(), keys.Count, license_results_array, out device);

            if (license_results != null)
            {
                license_results.InsertRange(0, license_results_array);
            }

            return tobii_error;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_get_feature_group")]
        public static extern tobii_error_t tobii_get_feature_group(IntPtr device, out tobii_feature_group_t feature_group);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_device_destroy")]
        public static extern tobii_error_t tobii_device_destroy(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_wait_for_callbacks")]
        private static extern tobii_error_t tobii_wait_for_callbacks_internal(int device_count, IntPtr[]? devices);

        public static tobii_error_t tobii_wait_for_callbacks(IntPtr[]? devices)
        {
            var length = (devices != null) ? devices.Length : 0;
            var tobii_error = tobii_wait_for_callbacks_internal(length, devices);
            return tobii_error;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_device_process_callbacks")]
        public static extern tobii_error_t tobii_device_process_callbacks(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_device_clear_callback_buffers")]
        public static extern tobii_error_t tobii_device_clear_callback_buffers(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_device_reconnect")]
        public static extern tobii_error_t tobii_device_reconnect(IntPtr device);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_system_clock")]
        public static extern tobii_error_t tobii_system_clock(IntPtr api, out long timestamp_us);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_get_device_info")]
        public static extern tobii_error_t tobii_get_device_info(IntPtr device, out tobii_device_info_t device_info);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_get_state_bool")]
        public static extern tobii_error_t tobii_get_state_bool(IntPtr device, tobii_state_t state, out tobii_state_bool_t value);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_get_state_uint32")]
        public static extern tobii_error_t tobii_get_state_uint32(IntPtr device, tobii_state_t state, out uint value);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_get_state_string")]
        private static extern tobii_error_t tobii_get_state_string_internal(IntPtr device, tobii_state_t state, StringBuilder value);

        public static tobii_error_t tobii_get_state_string(IntPtr device, tobii_state_t state, out string value)
        {
            var val = new StringBuilder(512);
            var result = tobii_get_state_string_internal(device, state, val);
            value = val.ToString();
            return result;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_notifications_subscribe")]
        public static extern tobii_error_t tobii_notifications_subscribe(IntPtr device, tobii_notifications_callback_t callback, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_notifications_unsubscribe")]
        public static extern tobii_error_t tobii_notifications_unsubscribe(IntPtr device);


        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_capability_supported")]
        public static extern tobii_error_t tobii_capability_supported(IntPtr device, tobii_capability_t capability, out bool supported);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_stream_supported")]
        public static extern tobii_error_t tobii_stream_supported(IntPtr device, tobii_stream_t stream, out bool supported);


        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_update_timesync")]
        public static extern tobii_error_t tobii_update_timesync(IntPtr device);


        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode, EntryPoint = "tobii_logs_retrieve")]
        private static extern tobii_error_t tobii_logs_retrieve_internal(IntPtr device, tobii_log_receiver_t callback, IntPtr user_data);

        public static tobii_error_t tobii_logs_retrieve(IntPtr device, out List<tobii_log_t> logs)
        {
            List<tobii_log_t> out_logs = new List<tobii_log_t>();

            var error = tobii_logs_retrieve_internal(device, (ref tobii_log_internal_t log_ptr, IntPtr user_data) =>
            {
                tobii_log_t log = new tobii_log_t
                {
                    name = Marshal.PtrToStringAnsi(log_ptr.name),
                    data = Marshal.PtrToStringAnsi(log_ptr.data)
                };
                out_logs.Add(log);
            }, IntPtr.Zero);

            logs = out_logs;

            return error;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_device_create_with_processor_ex")]
        private static extern tobii_error_t tobii_device_create_with_processor_ex_internal(IntPtr api, IntPtr context, tobii_field_of_use_t field_of_use, tobii_license_key_t[] license_keys, int license_count, [MarshalAs(UnmanagedType.LPArray)] tobii_license_validation_result_t[] licenseResults, out IntPtr device);

        public static tobii_error_t tobii_device_create_with_processor_ex(IntPtr api, IntPtr context, tobii_field_of_use_t field_of_use, string[] license_keys, List<tobii_license_validation_result_t> license_results, out IntPtr device)
        {
            var keys = new List<tobii_license_key_t>();

            foreach (var key in license_keys)
            {
                keys.Add(new tobii_license_key_t { license_key = key, size_in_bytes = new IntPtr(key.Length * 2) });
            }

            var license_results_array = new tobii_license_validation_result_t[license_keys.Length];
            var tobii_error = tobii_device_create_with_processor_ex_internal(api, context, field_of_use, keys.ToArray(), keys.Count, license_results_array, out device);

            if (license_results != null)
            {
                license_results.InsertRange(0, license_results_array);
            }

            return tobii_error;
        }

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode, EntryPoint = "tobii_process_frame")]
        public static extern tobii_error_t tobii_process_frame(IntPtr device, tobii_image_frame_t frame);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_send_custom_command")]
        private static extern tobii_error_t tobii_send_custom_command_internal(IntPtr device, UInt32 command_id, IntPtr data, IntPtr size,
            tobii_data_receiver_t receiver);

        public static tobii_error_t tobii_send_custom_command(IntPtr device, UInt32 command_id, byte[] in_data, out byte[] out_data)
        {
            var ptr = Marshal.AllocHGlobal(in_data.Length);
            tobii_error_t result;
            var response = new byte[0];

            try
            {
                Marshal.Copy(in_data, 0, ptr, in_data.Length);
                result = tobii_send_custom_command_internal(device, command_id, ptr, new IntPtr(in_data.Length), (data, size, userData) =>
                {
                    var response_length = size.ToInt32();
                    if (response_length == 0) return;

                    response = new byte[response_length];
                    Marshal.Copy(data, response, 0, response_length);
                });
            }
            finally
            {
                Marshal.FreeHGlobal(ptr);
            }

            out_data = response;
            return result;
        }
        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
             EntryPoint = "tobii_custom_stream_subscribe")]
        public static extern tobii_error_t tobii_custom_stream_subscribe(IntPtr device, tobii_custom_binary_callback_t callback, UInt32 stream_id, IntPtr user_data = default(IntPtr));

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl,
            EntryPoint = "tobii_custom_stream_unsubscribe")]
        public static extern tobii_error_t tobii_custom_stream_unsubscribe(IntPtr device, UInt32 stream_id);

        [DllImport(stream_engine_dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "tobii_timesync")]
        public static extern tobii_error_t tobii_timesync(IntPtr device, out tobii_timesync_data_t timesync);

    }

    public enum tobii_field_of_use_t
    {
        TOBII_FIELD_OF_USE_STORE_OR_TRANSFER_FALSE = 1,
        TOBII_FIELD_OF_USE_STORE_OR_TRANSFER_TRUE = 2,
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_version_t
    {
        public int major;
        public int minor;
        public int revision;
        public int build;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct tobii_device_info_t
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string serial_number;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string model;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string generation;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string firmware_version;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string integration_id;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string hw_calibration_version;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string hw_calibration_date;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string lot_id;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string integration_type;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string runtime_build_version;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string platform_type;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string subplatform_type;

    }

    [StructLayout(LayoutKind.Sequential)]
    public class tobii_custom_log_t
    {
        public IntPtr log_context;
        public Interop.tobii_log_func_t? log_func;
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_data_receiver_t(IntPtr data, IntPtr size, IntPtr user_data);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_device_url_receiver_t(string url, IntPtr user_data);

    public enum tobii_feature_group_t
    {
        TOBII_FEATURE_GROUP_BLOCKED,
        TOBII_FEATURE_GROUP_CONSUMER,
        TOBII_FEATURE_GROUP_CONFIG,
        TOBII_FEATURE_GROUP_PROFESSIONAL,
        TOBII_FEATURE_GROUP_INTERNAL,
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_license_key_t
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string license_key;

        public IntPtr size_in_bytes;
    }

    public enum tobii_license_validation_result_t
    {
        TOBII_LICENSE_VALIDATION_RESULT_OK,
        TOBII_LICENSE_VALIDATION_RESULT_TAMPERED,
        TOBII_LICENSE_VALIDATION_RESULT_INVALID_APPLICATION_SIGNATURE,
        TOBII_LICENSE_VALIDATION_RESULT_NONSIGNED_APPLICATION,
        TOBII_LICENSE_VALIDATION_RESULT_EXPIRED,
        TOBII_LICENSE_VALIDATION_RESULT_PREMATURE,
        TOBII_LICENSE_VALIDATION_RESULT_INVALID_PROCESS_NAME,
        TOBII_LICENSE_VALIDATION_RESULT_INVALID_SERIAL_NUMBER,
        TOBII_LICENSE_VALIDATION_RESULT_INVALID_MODEL,
        TOBII_LICENSE_VALIDATION_RESULT_INVALID_PLATFORM_TYPE,
        TOBII_LICENSE_VALIDATION_RESULT_REVOKED,
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct TobiiVector2
    {
        public float x;
        public float y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct TobiiVector3
    {
        public float x;
        public float y;
        public float z;
    }

    public enum tobii_validity_t
    {
        TOBII_VALIDITY_INVALID = 0,
        TOBII_VALIDITY_VALID = 1
    }

    public enum tobii_error_t
    {
        TOBII_ERROR_NO_ERROR,
        TOBII_ERROR_INTERNAL,
        TOBII_ERROR_INSUFFICIENT_LICENSE,
        TOBII_ERROR_NOT_SUPPORTED,
        TOBII_ERROR_NOT_AVAILABLE,
        TOBII_ERROR_CONNECTION_FAILED,
        TOBII_ERROR_TIMED_OUT,
        TOBII_ERROR_ALLOCATION_FAILED,
        TOBII_ERROR_INVALID_PARAMETER,
        TOBII_ERROR_CALIBRATION_ALREADY_STARTED,
        TOBII_ERROR_CALIBRATION_NOT_STARTED,
        TOBII_ERROR_ALREADY_SUBSCRIBED,
        TOBII_ERROR_NOT_SUBSCRIBED,
        TOBII_ERROR_OPERATION_FAILED,
        TOBII_ERROR_CONFLICTING_API_INSTANCES,
        TOBII_ERROR_CALIBRATION_BUSY,
        TOBII_ERROR_CALLBACK_IN_PROGRESS,
        TOBII_ERROR_TOO_MANY_SUBSCRIBERS,
        TOBII_ERROR_CONNECTION_FAILED_DRIVER,
        TOBII_ERROR_UNAUTHORIZED,
        TOBII_ERROR_FIRMWARE_UPGRADE_IN_PROGRESS,
        TOBII_ERROR_INCOMPATIBLE_API_VERSION,
    }

    public enum tobii_log_level_t
    {
        TOBII_LOG_LEVEL_ERROR,
        TOBII_LOG_LEVEL_WARN,
        TOBII_LOG_LEVEL_INFO,
        TOBII_LOG_LEVEL_DEBUG,
        TOBII_LOG_LEVEL_TRACE,
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_notifications_callback_t(ref tobii_notification_t notification, IntPtr user_data);

    public enum tobii_notification_type_t
    {
        TOBII_NOTIFICATION_TYPE_CALIBRATION_STATE_CHANGED,
        TOBII_NOTIFICATION_TYPE_EXCLUSIVE_MODE_STATE_CHANGED,
        TOBII_NOTIFICATION_TYPE_TRACK_BOX_CHANGED,
        TOBII_NOTIFICATION_TYPE_DISPLAY_AREA_CHANGED,
        TOBII_NOTIFICATION_TYPE_FRAMERATE_CHANGED,
        TOBII_NOTIFICATION_TYPE_POWER_SAVE_STATE_CHANGED,
        TOBII_NOTIFICATION_TYPE_DEVICE_PAUSED_STATE_CHANGED,
        TOBII_NOTIFICATION_TYPE_CALIBRATION_ENABLED_EYE_CHANGED,
        TOBII_NOTIFICATION_TYPE_CALIBRATION_ID_CHANGED,
        TOBII_NOTIFICATION_TYPE_COMBINED_GAZE_FACTOR_CHANGED,
        TOBII_NOTIFICATION_TYPE_FAULTS_CHANGED,
        TOBII_NOTIFICATION_TYPE_WARNINGS_CHANGED,
        TOBII_NOTIFICATION_TYPE_FACE_TYPE_CHANGED,
        TOBII_NOTIFICATION_TYPE_CALIBRATION_ACTIVE_CHANGED,
    }

    public enum tobii_notification_value_type_t
    {
        TOBII_NOTIFICATION_VALUE_TYPE_NONE,
        TOBII_NOTIFICATION_VALUE_TYPE_FLOAT,
        TOBII_NOTIFICATION_VALUE_TYPE_STATE,
        TOBII_NOTIFICATION_VALUE_TYPE_DISPLAY_AREA,
        TOBII_NOTIFICATION_VALUE_TYPE_UINT,
        TOBII_NOTIFICATION_VALUE_TYPE_ENABLED_EYE,
        TOBII_NOTIFICATION_VALUE_TYPE_STRING,
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct tobii_notification_value_t
    {
        [FieldOffset(0)]
        public float float_;
        [FieldOffset(0)]
        public tobii_state_bool_t state;
        [FieldOffset(0)]
        public tobii_display_area_t display_area;
        [FieldOffset(0)]
        public uint uint_;
        [FieldOffset(0)]
        public tobii_enabled_eye_t enabled_eye;
        // TODO: Overlapping an object field with a non-object field i.e string and integer,
        // will generate a runtime error. A re-design of this union is probably needed in order
        // for it to work in the .NET bindings.
        // WORK AROUND: When a notification containing a string is received, it needs to be
        // queried through the tobii_get_state_string function.
        //[FieldOffset(0), MarshalAs(UnmanagedType.ByValTStr, SizeConst = 512)]
        //public string string_;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_notification_t
    {
        public tobii_notification_type_t type;
        public tobii_notification_value_type_t value_type;
        public tobii_notification_value_t value;
    }

    public enum tobii_capability_t
    {
        TOBII_CAPABILITY_DISPLAY_AREA_WRITABLE,
        TOBII_CAPABILITY_CALIBRATION_2D,
        TOBII_CAPABILITY_CALIBRATION_3D,
        TOBII_CAPABILITY_PERSISTENT_STORAGE,
        TOBII_CAPABILITY_CALIBRATION_PER_EYE,
        TOBII_CAPABILITY_COMPOUND_STREAM_WEARABLE_3D_GAZE_COMBINED,
        TOBII_CAPABILITY_FACE_TYPE,
        TOBII_CAPABILITY_COMPOUND_STREAM_USER_POSITION_GUIDE_XY,
        TOBII_CAPABILITY_COMPOUND_STREAM_USER_POSITION_GUIDE_Z,
        TOBII_CAPABILITY_COMPOUND_STREAM_WEARABLE_LIMITED_IMAGE,
        TOBII_CAPABILITY_COMPOUND_STREAM_WEARABLE_PUPIL_DIAMETER,
        TOBII_CAPABILITY_COMPOUND_STREAM_WEARABLE_PUPIL_POSITION,
        TOBII_CAPABILITY_COMPOUND_STREAM_WEARABLE_EYE_OPENNESS,
        TOBII_CAPABILITY_COMPOUND_STREAM_WEARABLE_3D_GAZE_PER_EYE,
        TOBII_CAPABILITY_COMPOUND_STREAM_WEARABLE_USER_POSITION_GUIDE_XY,
        TOBII_CAPABILITY_COMPOUND_STREAM_WEARABLE_TRACKING_IMPROVEMENTS,
        TOBII_CAPABILITY_COMPOUND_STREAM_WEARABLE_CONVERGENCE_DISTANCE,
        TOBII_CAPABILITY_COMPOUND_STREAM_WEARABLE_IMPROVE_USER_POSITION_HMD,
        TOBII_CAPABILITY_COMPOUND_STREAM_WEARABLE_INCREASE_EYE_RELIEF,
        TOBII_CAPABILITY_DEVICE_CALIBRATION,
        TOBII_CAPABILITY_STREAM_GAZE_POINT,
        TOBII_CAPABILITY_STREAM_GAZE_ORIGIN,
        TOBII_CAPABILITY_STREAM_GAZE_DATA,
        TOBII_CAPABILITY_STREAM_GAZE,
        TOBII_CAPABILITY_STREAM_USER_PRESENCE,
        TOBII_CAPABILITY_STREAM_HEAD_POSE,
        TOBII_CAPABILITY_STREAM_DIGITAL_SYNCPORT,
        TOBII_CAPABILITY_STREAM_DIAGNOSTICS_IMAGE,
        TOBII_CAPABILITY_STREAM_USER_POSITION_GUIDE,
        TOBII_CAPABILITY_STREAM_WEARABLE_CONSUMER,
        TOBII_CAPABILITY_STREAM_WEARABLE_ADVANCED,
        TOBII_CAPABILITY_STREAM_WEARABLE_FOVEATED_GAZE,
    }

    public enum tobii_stream_t
    {
        TOBII_STREAM_GAZE_POINT,
        TOBII_STREAM_GAZE_ORIGIN,
        TOBII_STREAM_EYE_POSITION_NORMALIZED,
        TOBII_STREAM_USER_PRESENCE,
        TOBII_STREAM_HEAD_POSE,
        TOBII_STREAM_GAZE_DATA,
        TOBII_STREAM_DIGITAL_SYNCPORT,
        TOBII_STREAM_DIAGNOSTICS_IMAGE,
        TOBII_STREAM_USER_POSITION_GUIDE,
        TOBII_STREAM_WEARABLE_CONSUMER,
        TOBII_STREAM_WEARABLE_ADVANCED,
        TOBII_STREAM_WEARABLE_FOVEATED_GAZE,
        TOBII_STREAM_RESPONSIVE_GAZE_POINT,
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_display_area_t
    {
        public TobiiVector3 top_left_mm_xyz;
        public TobiiVector3 top_right_mm_xyz;
        public TobiiVector3 bottom_left_mm_xyz;
    }

    public enum tobii_enabled_eye_t
    {
        TOBII_ENABLED_EYE_LEFT,
        TOBII_ENABLED_EYE_RIGHT,
        TOBII_ENABLED_EYE_BOTH,
    }

    public enum tobii_state_t
    {
        TOBII_STATE_POWER_SAVE_ACTIVE,
        TOBII_STATE_REMOTE_WAKE_ACTIVE,
        TOBII_STATE_DEVICE_PAUSED,
        TOBII_STATE_EXCLUSIVE_MODE,
        TOBII_STATE_FAULT,
        TOBII_STATE_WARNING,
        TOBII_STATE_CALIBRATION_ID,
        TOBII_STATE_CALIBRATION_ACTIVE,
    }

    public enum tobii_state_bool_t
    {
        TOBII_STATE_BOOL_FALSE,
        TOBII_STATE_BOOL_TRUE,
    }

    [StructLayout(LayoutKind.Sequential)]
    struct tobii_log_internal_t
    {
        public IntPtr name;
        public IntPtr data;
        public IntPtr size;
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    delegate void tobii_log_receiver_t(ref tobii_log_internal_t data, IntPtr user_data);

    public struct tobii_log_t
    {
        public string? name;
        public string? data;
    }

    public enum tobii_frame_format_t
    {
        TOBII_FRAME_FORMAT_GRAY8
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_image_frame_t
    {
        public long timestamp_us;
        public int width;
        public int height;
        public int stride;
        public tobii_frame_format_t format;
        public IntPtr data_size;
        public IntPtr data;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_custom_data_t
    {
        public UInt32 custom_stream_id;
        public IntPtr size;
        public IntPtr data;
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    public delegate void tobii_custom_binary_callback_t(ref tobii_custom_data_t data, IntPtr user_data);

    [StructLayout(LayoutKind.Sequential)]
    public struct tobii_timesync_data_t
    {
        public long system_start_us;
        public long system_end_us;
        public long tracker_us;
    }
}
