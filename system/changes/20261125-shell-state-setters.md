---
type: security
component: Desktop
packages: [Suno-shell-state]
highlight: false
---
Summary: Apps can no longer change desktop settings such as the screen-lock delay
Details: Sandboxed apps can no longer change the dock, wallpaper, appearance, screen-lock delay, Home layout or presentation; only the shell and Settings can. Apps still see the appearance and presentation so they can match the desktop, but no longer see the wallpaper, the dock's apps, the Home layout or the weather location. Programs you run outside a sandbox are not limited by this.
