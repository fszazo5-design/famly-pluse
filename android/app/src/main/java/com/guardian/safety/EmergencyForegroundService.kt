package com.guardian.safety

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Long-running emergency service for Capacitor.
 *
 * The service remains alive for the emergency/power-button monitoring lifecycle,
 * streams location readings to the Capacitor plugin, and records audio only
 * after an explicit SOS or audio command. Runtime permissions are enforced by
 * EmergencyPlugin before these commands are sent.
 */
class EmergencyForegroundService : Service() {
    companion object {
        const val ACTION_START_SERVICE = "com.guardian.safety.START_SERVICE"
        const val ACTION_TRIGGER_SOS = "com.guardian.safety.TRIGGER_SOS"
        const val ACTION_CANCEL_SOS = "com.guardian.safety.CANCEL_SOS"
        const val ACTION_START_TRACKING = "com.guardian.safety.START_TRACKING"
        const val ACTION_STOP_TRACKING = "com.guardian.safety.STOP_TRACKING"
        const val ACTION_START_AUDIO = "com.guardian.safety.START_AUDIO"
        const val ACTION_STOP_AUDIO = "com.guardian.safety.STOP_AUDIO"

        const val CHANNEL_ID = "guardian_safety_monitoring"
        const val ALERT_CHANNEL_ID = "guardian_emergency_alerts"
        const val NOTIFICATION_ID = 1001
        const val TAG = "GuardianEmergency"
        const val POWER_PRESS_THRESHOLD = 5
        const val POWER_PRESS_WINDOW_MS = 3_000L

        @Volatile var eventListener: ((String, JSONObject) -> Unit)? = null
    }

    private val handler = Handler(Looper.getMainLooper())
    private var locationManager: LocationManager? = null
    private var locationListener: LocationListener? = null
    private var recorder: MediaRecorder? = null
    private var audioFile: File? = null
    private var recordingStartedAt = 0L
    private var tracking = false
    private var recording = false
    private var sosActive = false
    private var currentSessionId: String? = null
    private var powerPressCount = 0
    private var resetPowerPress: Runnable? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        registerScreenReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Android requires startForeground shortly after startForegroundService.
        promoteToForeground(includeMicrophone = false)
        when (intent?.action) {
            ACTION_START_SERVICE -> Unit
            ACTION_TRIGGER_SOS -> triggerSOS(intent.getStringExtra("event_id"))
            ACTION_CANCEL_SOS -> cancelSOS()
            ACTION_START_TRACKING -> {
                currentSessionId = intent.getStringExtra("session_id")
                startLocationTracking()
            }
            ACTION_STOP_TRACKING -> stopLocationTracking()
            ACTION_START_AUDIO -> startAudioRecording()
            ACTION_STOP_AUDIO -> stopAudioRecording()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopLocationTracking()
        stopAudioRecording()
        resetPowerPress?.let(handler::removeCallbacks)
        unregisterReceiver(screenReceiver)
        super.onDestroy()
    }

    private fun promoteToForeground(includeMicrophone: Boolean) {
        val notification = buildNotification(
            if (sosActive) "SOS نشط — تتم متابعة الموقع والتسجيل" else "مراقبة أمان حارس مفعلة"
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            var serviceTypes = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            if (includeMicrophone && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                serviceTypes = serviceTypes or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            }
            startForeground(NOTIFICATION_ID, notification, serviceTypes)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotificationChannels() {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "مراقبة الأمان", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "خدمة مراقبة الأمان في الخلفية"
                    setShowBadge(false)
                },
            )
            manager.createNotificationChannel(
                NotificationChannel(ALERT_CHANNEL_ID, "تنبيهات الطوارئ", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "تنبيهات SOS العاجلة"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                },
            )
        }
    }

    private fun buildNotification(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("حارس")
            .setContentText(text)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private fun triggerSOS(requestedId: String?) {
        val eventId = requestedId ?: UUID.randomUUID().toString()
        sosActive = true
        promoteToForeground(includeMicrophone = true)
        startLocationTracking()
        startAudioRecording()
        emit("sos_triggered", JSONObject().put("eventId", eventId))
    }

    private fun cancelSOS() {
        sosActive = false
        stopLocationTracking()
        stopAudioRecording()
        currentSessionId = null
        promoteToForeground(includeMicrophone = false)
        emit("sos_cancelled", JSONObject())
    }

    private fun startLocationTracking() {
        if (tracking) return
        if (!hasLocationPermission()) {
            emit("permission_error", JSONObject().put("permission", Manifest.permission.ACCESS_FINE_LOCATION))
            return
        }
        tracking = true
        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager
        locationListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                emit("gps_reading", JSONObject().apply {
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    put("accuracy", location.accuracy)
                    put("speed", if (location.hasSpeed()) location.speed else JSONObject.NULL)
                    put("heading", if (location.hasBearing()) location.bearing else JSONObject.NULL)
                    put("altitude", if (location.hasAltitude()) location.altitude else JSONObject.NULL)
                    put("timestamp", System.currentTimeMillis())
                    currentSessionId?.let { put("sessionId", it) }
                })
            }
        }
        try {
            locationManager?.requestLocationUpdates(
                LocationManager.GPS_PROVIDER, 5_000L, 2f, locationListener!!, Looper.getMainLooper()
            )
            locationManager?.requestLocationUpdates(
                LocationManager.NETWORK_PROVIDER, 5_000L, 2f, locationListener!!, Looper.getMainLooper()
            )
        } catch (securityException: SecurityException) {
            tracking = false
            emit("permission_error", JSONObject().put("permission", Manifest.permission.ACCESS_FINE_LOCATION))
            Log.w(TAG, "Location permission was revoked", securityException)
        }
    }

    private fun stopLocationTracking() {
        locationListener?.let { listener -> locationManager?.removeUpdates(listener) }
        locationListener = null
        locationManager = null
        tracking = false
    }

    private fun startAudioRecording() {
        if (recording || !hasPermission(Manifest.permission.RECORD_AUDIO)) return
        try {
            val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            audioFile = File(filesDir, "audio_vault_$timestamp.aac")
            recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            recorder?.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.AAC_ADTS)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128_000)
                setAudioSamplingRate(44_100)
                setOutputFile(audioFile!!.absolutePath)
                prepare()
                start()
            }
            recordingStartedAt = System.currentTimeMillis()
            recording = true
        } catch (error: Exception) {
            recording = false
            recorder?.release()
            recorder = null
            Log.e(TAG, "Unable to start audio recording", error)
            emit("audio_error", JSONObject().put("message", "recording_failed"))
        }
    }

    private fun stopAudioRecording() {
        if (!recording) return
        val duration = ((System.currentTimeMillis() - recordingStartedAt) / 1_000L).toInt()
        try {
            recorder?.stop()
        } catch (error: RuntimeException) {
            Log.w(TAG, "Recorder stopped before data was available", error)
        } finally {
            recorder?.release()
            recorder = null
            recording = false
        }
        emit("audio_stopped", JSONObject().apply {
            put("path", audioFile?.absolutePath ?: "")
            put("durationSec", duration)
            put("sizeBytes", audioFile?.length() ?: 0L)
            put("mimeType", "audio/aac")
        })
    }

    private fun registerScreenReceiver() {
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(screenReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION") registerReceiver(screenReceiver, filter)
        }
    }

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != Intent.ACTION_SCREEN_OFF && intent.action != Intent.ACTION_SCREEN_ON) return
            powerPressCount += 1
            resetPowerPress?.let(handler::removeCallbacks)
            resetPowerPress = Runnable { powerPressCount = 0 }
            handler.postDelayed(resetPowerPress!!, POWER_PRESS_WINDOW_MS)
            if (powerPressCount >= POWER_PRESS_THRESHOLD) {
                powerPressCount = 0
                triggerSOS(null)
            }
        }
    }

    private fun hasLocationPermission(): Boolean =
        hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) || hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun emit(event: String, data: JSONObject) {
        eventListener?.invoke(event, data)
    }

}
