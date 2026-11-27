package org.projectSuno.connect.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.projectSuno.connect.core.Connect
import org.projectSuno.connect.media.CameraStreamService
import org.projectSuno.connect.media.ScreenStreamService

class ActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            STOP_RING -> Ringer.stop(context)
            PAUSE -> {
                Connect.setLinkState(Connect.LinkState.Paused)
                LinkService.refresh(context)
            }
            RESUME -> {
                Connect.resume()
                LinkService.start(context)
            }
            STOP_CAMERA -> context.stopService(Intent(context, CameraStreamService::class.java))
            STOP_SCREEN -> context.stopService(Intent(context, ScreenStreamService::class.java))
        }
    }

    companion object {
        const val STOP_RING = "org.projectSuno.connect.STOP_RING"
        const val PAUSE = "org.projectSuno.connect.PAUSE"
        const val RESUME = "org.projectSuno.connect.RESUME"
        const val STOP_CAMERA = "org.projectSuno.connect.STOP_CAMERA"
        const val STOP_SCREEN = "org.projectSuno.connect.STOP_SCREEN"
    }
}
