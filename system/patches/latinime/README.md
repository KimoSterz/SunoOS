# Suno LatinIME host decoder

Project Suno uses the Apache-2.0 AOSP LatinIME C++ decoder as a small native
mobile input adapter. It does **not** ship Android, a JVM, an Android service,
Qt, KDE, KWin, or a second compositor.

`0001-Suno-host-decoder-api.patch` exposes the existing proximity and ranked
suggestion objects to AOSP's supported `HOST_TOOL` build. Suno's wrapper,
IBus bridge, and Shell surface remain in `src/Suno-keyboard`.

The source commit, English dictionary, Zig cross-compiler archives, and every
checksum are pinned in `config/mobile/latinime-source.env`. Build the AArch64
runtime with `scripts/mobile/build-Suno-keyboard-fp6.sh`.
