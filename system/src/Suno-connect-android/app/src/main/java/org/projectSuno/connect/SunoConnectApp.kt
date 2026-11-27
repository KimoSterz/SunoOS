package org.projectSuno.connect

import android.app.Application
import org.projectSuno.connect.core.Connect
import org.projectSuno.connect.service.Notifications

class SunoConnectApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
        Connect.init(this)
    }
}
