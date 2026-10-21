package com.guardian.safety

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject
import java.util.UUID

/** Capacitor bridge for the native emergency service. */
@CapacitorPlugin(
    name = "EmergencyPlugin",
    permissions = [
        Permission(
            alias = "location",
            strings = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION],
        ),
        Permission(alias = "microphone", strings = [Manifest.permission.RECORD_AUDIO]),
    ],
)
class EmergencyPlugin : Plugin() {
    override fun load() {
        super.load()
        EmergencyForegroundService.eventListener = { eventName, data ->
            notifyListeners(eventName, JSObject(data.toString()))
        }
    }

    @PluginMethod
    fun requestEmergencyPermissions(call: PluginCall) {
        val missingAliases = mutableListOf<String>()
        if (!hasLocationPermission()) missingAliases.add("location")
        if (!hasGrantedPermission(Manifest.permission.RECORD_AUDIO)) missingAliases.add("microphone")
        if (missingAliases.isEmpty()) {
            call.resolve(permissionResult())
            return
        }
        requestPermissionForAliases(missingAliases.toTypedArray(), call, "emergencyPermissionsCallback")
    }

    @PermissionCallback
    private fun emergencyPermissionsCallback(call: PluginCall) {
        call.resolve(permissionResult())
    }

    @PluginMethod
    fun checkEmergencyPermissions(call: PluginCall) {
        call.resolve(permissionResult())
    }

    @PluginMethod
    fun triggerSOS(call: PluginCall) {
        if (!hasLocationPermission()) {
            call.reject("LOCATION_PERMISSION_REQUIRED", "Grant location permission first")
            return
        }
        val eventId = call.getString("eventId") ?: UUID.randomUUID().toString()
        startService(EmergencyForegroundService.ACTION_TRIGGER_SOS) { putExtra("event_id", eventId) }
        call.resolve(JSObject().put("eventId", eventId))
    }

    @PluginMethod
    fun cancelSOS(call: PluginCall) {
        startService(EmergencyForegroundService.ACTION_CANCEL_SOS)
        call.resolve()
    }

    @PluginMethod
    fun startGPSTracking(call: PluginCall) {
        if (!hasLocationPermission()) {
            call.reject("LOCATION_PERMISSION_REQUIRED")
            return
        }
        val sessionId = call.getString("sessionId") ?: ""
        startService(EmergencyForegroundService.ACTION_START_TRACKING) { putExtra("session_id", sessionId) }
        call.resolve()
    }

    @PluginMethod
    fun stopGPSTracking(call: PluginCall) {
        startService(EmergencyForegroundService.ACTION_STOP_TRACKING)
        call.resolve()
    }

    @PluginMethod
    fun startAudioRecording(call: PluginCall) {
        if (!hasGrantedPermission(Manifest.permission.RECORD_AUDIO)) {
            call.reject("MICROPHONE_PERMISSION_REQUIRED")
            return
        }
        startService(EmergencyForegroundService.ACTION_START_AUDIO)
        call.resolve()
    }

    @PluginMethod
    fun stopAudioRecording(call: PluginCall) {
        startService(EmergencyForegroundService.ACTION_STOP_AUDIO)
        call.resolve()
    }

    private fun startService(action: String, configure: Intent.() -> Unit = {}) {
        val intent = Intent(context, EmergencyForegroundService::class.java).apply {
            this.action = action
            configure()
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, intent)
        } else {
            context.startService(intent)
        }
    }

    private fun hasLocationPermission(): Boolean =
        hasGrantedPermission(Manifest.permission.ACCESS_FINE_LOCATION) || hasGrantedPermission(Manifest.permission.ACCESS_COARSE_LOCATION)

    private fun hasGrantedPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    private fun permissionResult(): JSObject = JSObject().apply {
        put("location", hasLocationPermission())
        put("microphone", hasGrantedPermission(Manifest.permission.RECORD_AUDIO))
        put("notifications", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || hasGrantedPermission(Manifest.permission.POST_NOTIFICATIONS))
        put("backgroundLocation", Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || hasGrantedPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION))
    }
}
