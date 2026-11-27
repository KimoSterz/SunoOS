# xdg-desktop-portal

Fedora's xdg-desktop-portal, rebuilt by `scripts/packages/build-xdg-desktop-portal.sh`
from the SRPM pinned in `config/desktop/inputs.env` (desktop-components group
`xdg-desktop-portal`, both architectures).

- `0001-open-uri-open-package-files-in-the-system-installer.patch`: OpenURI
  and OpenFile show the application chooser for every file type except web
  and mail links and folders, until one application has been picked three
  times from the same caller (`src/open-uri.c`, `should_use_default_app()` and
  the threshold check in `handle_open_in_thread_func()`). Package files opened
  from a sandboxed file manager or a browser's downloads therefore always
  asked. `/usr/share/Suno/open-directly.list` (`[Open Directly]`, content
  type = desktop id; shipped by Suno-desktop-launcher-policy from
  `src/Suno-desktop-launcher-policy/open-directly.list`) names types that open
  in a system handler without the chooser. While the named handler is the
  default for the type and its desktop entry's real path is in
  `/usr/share/applications` (the read-only OS image), the file opens in it
  directly. Entries anywhere else are ignored, and an application's `ask`
  option and the per-type always-ask setting still show the chooser. Suno
  lists the package types Valet installs; Valet reviews a package and asks
  before installing it. The patch adds OpenURI integration tests for the
  direct, ask, always-ask and untrusted-location cases. Suno-specific.
- `0002-request-run-disconnect-off-the-main-loop.patch`: backport of
  upstream a337e718 (flatpak/xdg-desktop-portal#2093). Every request took
  its lock for every peer leaving the bus before checking the sender, and
  OpenDirectory holds that lock while it calls FileManager1.ShowItems
  synchronously. A client disconnecting during the call parked the main
  loop; a file manager started by ShowItems that reads the Settings portal
  during startup then could not answer, and Show in Files took the full
  25 s D-Bus timeout. Drop when the SRPM is 1.23 or later.
- `0003-open-uri-open-files-in-their-chosen-default.patch`: outside
  open-directly.list, a file still opened the chooser even when its type has
  a default, so a screenshot or PDF double-clicked in Filer asked on a fresh
  install, and "Always Open" in Suno-portal's chooser (which records the
  choice with `g_app_info_set_as_default_for_type()`) never took effect.
  While the type's default is named in `[Default Applications]` of a
  mimeapps list in `$XDG_CONFIG_HOME` or a system configuration directory
  (`/etc/xdg/gnome-mimeapps.list` from Suno-desktop-launcher-policy), the
  file opens in it directly. GIO's fallback default and lists in data
  directories still ask; `ask` and always-ask still win. Suno-specific.
- `0004-audio-capture-portal.patch`: adds `org.freedesktop.portal.AudioCapture`
  (`src/audio-capture.c`, `data/org.freedesktop.portal.AudioCapture.xml`,
  `data/org.freedesktop.impl.portal.AudioCapture.xml`). An application asks to
  record other applications' sound; the backend (Suno-portal) shows the choice
  and returns one PipeWire node; `OpenPipeWireRemote` returns a remote that
  sees only that node (core rwx, node factory r, the node rx, `PW_ID_ANY` 0).
  Sessions, option validation and restore tokens (permission table
  `audio-capture`) follow ScreenCast; `audio_mode` uses the ScreenCast v7
  values from flatpak/xdg-desktop-portal#2208. Tests:
  `tests/test_audiocapture.py`. Written to be proposed upstream.
- `0000-Suno-fedora-spec.patch`: adds the patches, the `Suno.N` release and a
  `%check` running the upstream OpenURI and the AudioCapture integration
  tests.
- `0005-app-info-identify-Suno-applications.patch`: a fourth kind of
  application beside Flatpak, snap and linyaps (`src/xdp-app-info-Suno.c`). A
  peer in the `Suno_application.process` SELinux domain, or in a Suno
  launcher's `app-Suno-NAME-PID.scope`, is named by
  `org.projectSuno.AppPermissions1.Identify(pid)` (Suno-application-installer,
  `Suno_installer.app_identity`: the rules Mutter 0041 uses) and is
  sandboxed: permissions are stored under `org.projectSuno.Installed.ID`,
  chosen files go through the document portal (the launchers bind
  `doc/by-app/ID`), prompts name the application. A peer in the domain that
  cannot be named is refused, never treated as the host. Identify is asked
  by unique name, only of the name's verified owner: the root-owned
  `/usr/libexec/Suno-app-permissions` in `Suno-app-permissions.service`, in
  the portal's mount namespace, its pidfd checked or, without one, its start
  time compared before and after (from `Suno.6`); a host program that took
  the name first is never asked. The verified owner is kept until
  NameOwnerChanged or a different start time, so a lookup costs one call. Suno-specific.
  In the spec from release `Suno.5`. The installer keeps the folders
  applications always had until `sandbox_permissions.portal_names_applications`
  is turned on.

- `0006-Suno-sync-portal-forwarder.patch`: `org.projectSuno.portal.Sync`
  (ADR-057 §3.1), Connect Sync for apps. A forwarder without generated code
  (`src/Suno-sync-portal.c`, `data/org.projectSuno.portal.Sync.xml`): GDBus
  checks each call against the introspection data, the host is refused, and
  the call goes with its descriptors to `org.projectSuno.impl.portal.Sync`
  on `org.projectSuno.ConnectSync1` (Suno-connect-syncd, which ships that
  interface file), prefixed with `{app_id, kind, pidfd, sender}`. Only
  `org.projectSuno.portal.Sync.Error.*` errors pass through, other errors
  and answers of the wrong type become `Failed`; the implementation's
  signals go to the app connection they name only. Tests:
  `tests/test_Suno_sync.py`. Suno-specific.
