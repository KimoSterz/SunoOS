---
type: security
component: Background activity
packages: [Suno-background]
highlight: false
---
Summary: Apps can no longer change another app's background permission
Details: Only the system's portal service can ask Suno's background service on an app's behalf, and apps can see only their own background activity and login setting. Installing an app with the same name as a built-in one no longer stops the built-in app's background work.
