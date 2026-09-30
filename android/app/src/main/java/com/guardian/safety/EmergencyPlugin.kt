package com.guardian.safety

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.util.UUID

/** Capacitor bridge for the native emergency service. */
@CapacitorPlugin(name = "EmergencyPlugin")
class EmergencyPlugin : Plugin() {
    companion object {
        private const val PERMISSION_REQUEST_CODE = 4101
    }

    override fun load() {
        super.load()
        EmergencyForegroundService.eventListener = { eventName, data ->
            notifyListeners(eventName, JSObject(data.toString()))
        }
    }

    @PluginMethod
    fun requestEmergencyPermissions(call: PluginCall) {
        val missing = runtimePermissions().filterNot(::hasGrantedPermission)
        if (missing.isEmpty()) {
            call.resolve(permissionResult())
            return
        }
        val currentActivity = activity ?: run {
            call.reject("ACTIVITY_UNAVAILABLE")
            return
        }
        ActivityCompat.requestPermissions(currentActivity, missing.toTypedArray(), PERMISSION_REQUEST_CODE)
        call.resolve(JSObject().put("requested", true).put("missing", missing.joinToString(",")))
    }

    @PluginMethod
    fun checkEmergencyPermissions(call: PluginCall) {
        call.resolve(permissionResult())
    }

    @PluginMethod
    fun triggerSOS(call: PluginCall) {
        if (!hasEmergencyPermissions()) {
            call.reject("PERMISSIONS_REQUIRED", "Grant location, microphone, and notification permissions first")
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

    private fun runtimePermissions(): List<String> = buildList {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
        add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
        // Android requires background location to be requested after foreground location.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasLocationPermission()) {
            add(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
    }

    private fun hasEmergencyPermissions(): Boolean =
        hasLocationPermission() &&
            hasGrantedPermission(Manifest.permission.RECORD_AUDIO) &&
            (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || hasGrantedPermission(Manifest.permission.POST_NOTIFICATIONS))

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
