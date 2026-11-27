---
type: fix
component: Raspberry Pi 5
packages: [Suno-rpi5-platform]
highlight: false
---
Summary: Android apps start on a Raspberry Pi 5
Details: Android never finished starting on a Raspberry Pi 5, because its memory manager needs pressure information that the Pi's kernel leaves switched off. Suno now starts the Pi with it switched on.
