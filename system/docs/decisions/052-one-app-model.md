# ADR-052: One application model for every package format

- **Status:** Accepted
- **Date:** 2026-11-20
- **Owner:** Project Suno
- **Review basis:** the installer, launcher and install-command sources on main; Flatpak, OSTree, snap, AppImage, Steam Linux Runtime, Landlock, SELinux and systemd documentation as of November 2026; three independent adversarial reviews (application compatibility, mechanisms, history and outlook)
- **Revisit trigger:** a format the model cannot hold, or a kernel or systemd mechanism that replaces one named here; for Amendment 1 also unprivileged verity mounts (`systemd-mountfsd`, `systemd-nsresourced`) in Suno's systemd, a second person per device, or a move of the image to bootc
- **Extends:** ADR-050 (universal packages). **Replaces for applications:** ADR-038 (`dnf install` adds packages to the system image)
- **Amended:** 2026-11-24 (Amendment 1): plan for steps 4 and 5: the application folder, the dispatcher, workspaces, install scripts, system modules, the one list, order of work and gates; revised after three adversarial reviews. Amendment 1 corrected from the labelled set (953 packages, `src/Suno-installer/tools/classify-labelled-set/`): classification rules 1, 2, 4 and 6, own dependencies, host-provided daemons, the choice outcome and three hard-case rows; corrected again from blind sets 1 and 2 (command-line administration tools, application add-ons, desktop components, PAM/NSS/FUSE choices, libraries with daemons, the window rule); corrected from the blind audit (2026-11-25: modules of system modules, Fedora daemons, borrowed markers, `add_on_of`, boot chain, plugin packs, window and display managers, distribution identity, package-manager front ends, session helpers, desktop data, `/etc` configuration, web applications, `sudo` front ends, score-file games, hardware video drivers, and asking for system markers without a curated decision).

## User problem

Linux has one stable interface, the kernel, and no stable userland. Every package format is a different answer to that, and each brings its own install location, update path, sandbox and permission rules. On Suno today the format decides how an application behaves:

| Arrives as | Today | Weakness |
| --- | --- | --- |
| Flatpak (Depot, Flathub) | Flatpak runtime and sandbox | Permissions are whatever the packager declared |
| `.deb`, `.rpm` file | One podman image per application | 0.5–2.3 GB each; libraries frozen at install; no update source |
| `sudo dnf install`, `sudo apt install` | Layered into the system image | Full trust; files spread through `/usr` and `/etc`; `apt` names are translated to Fedora's |
| AppImage, archive | Unpacked, run on the host `/usr` in a namespace | Depends on host libraries matching |
| snap | snapd | Confinement is degraded without AppArmor; a second store and daemon |

A person cannot say where an application lives, what it can reach, how it updates or what removing it leaves behind without knowing which of these it was. The sandboxes that exist also leak: a capsule today can read the whole keyring, record through the raw PipeWire socket, drive other windows through the accessibility bus and, on X11, watch every other X11 application.

## Constraints

- A package only runs reliably on the userland it was built against. Copying libraries between userlands fails on version mismatches; merging packages into the host allows one distribution only and no clean removal.
- Commands and habits must keep working and must not surprise: `apt install` gives a Debian or Ubuntu package, never a silent substitute.
- Command-line software composes. A compiler, its headers, a language runtime and its packages must see each other.
- Graphics drivers belong to the device, not to the application's userland: an old userland's Mesa cannot drive new hardware, and NVIDIA's libraries must match the loaded kernel module exactly.
- A prompt that blocks an application hangs its window, and toolkits probe folders at start. Landlock rules never widen; autofs and EROFS cannot be mounted from a user namespace.
- No application may work worse after a change than before it.

## Decision

A package format is a way an application arrives. It is not a way it runs. Everything installed is one of three things, and each has one set of rules.

### 1. Applications

1. **One object.** An application is one read-only, versioned tree, one record, and one data folder per person. The record names its origin, its userland, what it may reach and what it exports. Nothing is written anywhere else, and removal deletes the tree and, by choice, the data.
2. **Its own userland, exactly.** The tree is built by its distribution's own package manager (`apt`, `dnf`, `pacman`, `zypper`) in a build sandbox, from that distribution's signed repositories. It holds the release's required set, the application's dependency closure, a recorded desktop baseline (graphics and sound loaders, the toolkit's Wayland plugin, the person's locale) and any library the application's own programs load but its package does not declare. Maintainer scripts and triggers run there, once. Suno hosts no base images. The record keeps the resolved package list and the baseline version.
3. **One store.** Trees are commits in an OSTree repository, checked out as read-only hard links, as Flatpak does. Every file is stored once however many applications contain it, and shared in memory. No privileged mount service is needed. composefs can replace the checkout later without changing the model.
4. **One launcher.** Starting an application assembles a namespace with bubblewrap: its tree as the root, its data folder as home, the session's display, sound, portals, input method, fonts and theme. No container engine runs at launch. Nested user namespaces stay allowed, as Chromium's sandbox needs them.
5. **Graphics come from the device.** Every tree gets the device's graphics drivers in place of its own: Suno builds current Mesa for each supported userland and binds the host's NVIDIA libraries, both moving in step with the system image. Importing host drivers the way Steam Linux Runtime does is the fallback for userlands Suno does not build for; it replaces the tree's C library with the device's, so the record says when it is in use.
6. **Supported userlands.** Suno Platform and the freedesktop runtimes (as Flatpaks); Debian stable and oldstable; Ubuntu LTS releases in standard support; Fedora current and previous; Enterprise Linux 9 and 10; openSUSE; Arch as a dated snapshot that moves atomically with its applications. 32-bit libraries are part of a userland where its distribution has them. On aarch64, an x86_64-only application runs on an x86_64 userland under FEX and is labelled; a native build is always preferred. Adding a userland is data, not design.
7. **Updates.** Each application is re-resolved against its repositories on a schedule; a changed package set builds a new tree. The new tree is started once in a hidden test, replaces the old one only between runs, and the previous tree is kept for rollback. A repository a package adds is recorded as part of its origin. People can hold an application. Applications that update themselves get a writable versioned layer and keep doing so. When a userland leaves upstream support, its applications are rebuilt on the next release if they resolve and start there; the rest are marked as no longer receiving security fixes.
8. **Add-ons.** A package that extends an installed application (plugins, language packs, codecs for one player) is added to that application's tree. Fonts and system-wide codecs install for the whole device.

### 2. Permissions

One system, enforced by Suno, for every format. A package's own declarations are a request shown at install, not a grant.

1. **Never, for any application:** keys (SSH, GPG), the keyring beyond its own entries, browser profiles, password stores, other applications' data, and the hidden files that run at sign-in. An application has its own private space for hidden files.
2. **Files, at one of three levels,** chosen at install from what the application is and shown on the install sheet: the file chooser only (the default; the chooser reaches anything); named folders (a music player has Music, a photo editor Pictures, an office suite Documents); or all files (file managers, sync and backup clients, anything that declares it). The level is changed in Settings and applies while the application runs.
3. **Nothing is hidden and nothing blocks.** Every folder in the home folder is visible to the application at its real path. One it may not use refuses access with a permission error, never an empty folder. Suno sees the refusal and offers the grant quietly, once per folder; the application is never suspended waiting for an answer.
4. **Documents never hide in application data.** A visible file an application saves at the top of its home belongs to the real home folder. Removal lists any documents left in the data folder before deleting it.
5. **Devices.** Camera, microphone, location, screen capture and USB go through portals. PipeWire access is restricted per client; raw device nodes are absent until granted. A package's own udev rules become a device request shown at install (controllers, lighting, serial, HID).
6. **Between applications.** Open-with, share, drag and drop and browser-to-application native messaging go through a broker, so a password manager and a browser work together without either reading the other's data.
7. **Session.** Each X11 application gets its own X server; Wayland clients are tagged with their identity; the accessibility bus and D-Bus are filtered per application; abstract sockets and signals are scoped. Network is on by default and switchable. Background running and start at sign-in are visible and switchable.
8. **Identity.** Every application runs under its own allocated SELinux category pair and its own systemd scope. Suno's portal identifies it from those, so permissions, the tray, resource use and network use are always attributed to an application.

### 3. Workspaces

Command-line tools, libraries, development packages and language runtimes are not applications. They live in a workspace: one shared, mutable userland per distribution, kept in the same store, with the real home folder and working directory. A workspace cannot change the system and never sees the keyring, browser profiles or application data. Commands it provides are exported to `PATH`. Development applications (editors, IDEs, terminals) run in a workspace so they reach its tools, `~/.ssh` and `~/.gitconfig`. Homebrew and Nix are workspaces with their own prefix. `pip`, `npm -g`, `cargo install` and `go install` write to their usual places in the home folder and are listed.

### 4. System modules

Anything that must change the system is a separate, named class, listed apart from applications and removable in one step:

- kernel modules and drivers: built and signed by Suno, or refused with a plain reason;
- services (VPN clients, container engines, sync daemons that need root): run as portable services on their own userland with declared privileges;
- printer and scanner drivers: Printer Applications.

`dnf install` changes the system image only for these.

### 5. The front door

1. Opening a package file, Depot, and the `apt`, `dnf`, `pacman`, `zypper`, `flatpak`, `snap` and `brew` commands all reach one dispatcher. It decides which of the three classes the request is, and the real package manager does the work on the right userland, so output and scripted use (`apt-get -y`, `dpkg -s`, `rpm -q`) stay genuine. Queries are answered from wherever the package lives.
2. No silent substitution. A command installs from its own ecosystem. When the same application is in Depot the dispatcher says so in one line and continues. When a name is not in the distribution but a vendor publishes it, the dispatcher names the vendor source and asks.
3. Install scripts (`curl | sh`, `.run`) are captured: what they would install becomes an application or workspace change, and steps that need the system become a system-module offer.
4. Origin is recorded and shown for everything. Names that map to vendor sources come from a signed list; publishers can be verified and revoked.

### 6. One list

Settings shows every application, workspace and system module the same way: origin, size, what it may reach, what it has used, updates, and Remove.

## What each format becomes

| Arrives as | Result | Change from today |
| --- | --- | --- |
| Depot and Flathub Flatpak | Stays a Flatpak on disk | `home` and `host` requests become a Suno file level; protected paths are always excluded; nothing is redirected to temporary storage. A Flatpak given anything beyond a short list of narrow grants (document folders, its own data, the display, the GPU; `data/flatpak-narrow-grants.json`, each entry with its reason) is shown as **full control**. With stock flatpak that includes the session's sound server and the keyring; Suno's flatpak narrows those, and its read-only home view will narrow home and host |
| `.deb` with a window, `apt install` of an application | Application on Debian or Ubuntu, chosen from its dependencies | No podman image; no name translation |
| `.rpm` with a window, `dnf install` of an application | Application on Fedora, Enterprise Linux or openSUSE | No system-image layering |
| Command-line and development packages | Workspace | Tools see each other |
| AppImage, archive | Application on the newest userland that satisfies it | No dependence on the host `/usr`; update source from embedded update information where present |
| snap | Resolver prefers the same application from its vendor or Flathub and says so; snapd stays for the rest | Conversion is optional and last |
| Android, Windows | The same contract through their own runtimes | Listed and governed the same way |

## Alternatives rejected

- **Convert everything to Flatpak on one runtime.** Breaks whenever copied libraries disagree with the runtime; the `/app` prefix does not fit packages built for `/usr`.
- **Install into the host.** One distribution only, full trust, no clean removal.
- **Shared base image plus a thin layer per application.** The layer carries a copy of the package database and trigger caches that goes stale when the base changes, and Suno would have to build and host every base. File-level sharing gives the same disk use without either.
- **composefs with a privileged mount service, now.** Not mountable from a user namespace and still marked experimental by its users; OSTree checkouts do the job today.
- **Blocking prompts at first access.** Hang windows at start and train people to allow.
- **A store that rebuilds binaries (Nix), a virtual machine per distribution, one container image per application.** Third-party binaries cannot be rebuilt; virtual machines integrate poorly; images are heavy and never updated. Today's capsules remain as the fallback.

## Tradeoffs

- The first windowed application on a release costs about 165 MB of download and 530–610 MB on disk (minimal root 115 MB, the rest graphics, sound and toolkit); later ones on the same release share it. Nothing is shared across releases, so each release in use pays this once. Measured on seven applications: 8.4 GB as capsules, 5.75 GB in the store. Phones show the cost before installing and collect unused files.
- Suno owns current graphics drivers for each supported userland, the build sandbox, the dispatcher, the broker and the SELinux policy. It does not own distribution security fixes; it owns delivering them and saying when they stop.
- An all-files application can read a person's documents. It cannot read keys, sessions or other applications' data, cannot persist at sign-in and cannot change the system.
- Most popular Flathub applications ask for more than narrow grants (measured: 94% of the 200 most popular with stock flatpak, 88% with Suno's flatpak), so most are shown as full control. That is accurate, not a weaker test: Suno's exclusions for them are best effort. Narrowing such an application instead would send its saves to temporary storage; the fix is Suno's flatpak with a per-folder home view.
- Workspaces are trusted with the home folder, as a developer's shell always has been. They are the place to watch as software agents install tools on a person's behalf.
- Snap conversion without snapd means implementing its interfaces and hooks. It may never be worth doing.

## Order of work

1. Close the leaks in today's launcher (keyring, PipeWire, accessibility bus, X11, category allocation). Security refresh, launch test and rollback for the capsules that exist. The single list.
2. The store, per-application userlands, the launcher and device graphics; move existing capsules across.
3. Permissions for every format: levels, refusal and quiet offer, devices, the broker, portal identity.
4. Workspaces and the dispatcher behind every command; install-script capture.
5. System modules.
6. More userlands, x86_64 on aarch64, snap conversion.

Each step ships only when the application matrix passes on both architectures: install, start, update, roll back and remove for every format, on Intel, AMD, NVIDIA and the ARM devices, with a check that removal leaves no files. An application that fails the new path stays on the old one.

## Amendment 1 (2026-11-24): steps 4 and 5

Steps 1–3 are on main: the session boundary, the store with per-application userlands and the bubblewrap launcher (installer 1.Suno.104, #518), and permissions for every format (#534, Settings pages #537). Package files opened in Valet go to the store, with the podman capsule as fallback. Typed commands do not: `dnf`, `yum` and `rpm -i` layer into the system image, and `apt` translates Debian names to Fedora's and layers those (ADR-038, `src/Suno-install-commands`). This amendment plans the rest of the front door (step 4) and system modules (step 5). Three adversarial reviews (security, compatibility, prior art) shaped it. It changes the decision above in four places:

- Workspaces (section 3 above) run at the person's full trust. The claim that a workspace never sees the keyring, browser profiles or application data is withdrawn; safety comes from what may enter a workspace.
- Fonts and system-wide codecs (Applications 8) install per person and per release. Only image-signed system modules are device-wide.
- System modules are carried as signed system extensions; rpm-ostree layering is the fallback.
- `pacman` and `zypper` in the front door are deferred.

### Rules

1. **Same outcome.** A command installs from its own ecosystem; that ecosystem's tool does the work and prints its own output. Suno's lines go to standard error, start with `Suno:`, and never replace the tool's. Nothing is substituted silently. A substitution that is the only working answer (Suno's build of a kernel module, the Windows runtime for `wine`) is announced, and asked when interactive.
2. **Nothing gets worse.** Every sub-step names its fallback to today's behaviour for a request it cannot complete, says which it took and why, and counts it in Vitals. A fallback that grants more trust than the request implied (layering into the image) is asked when interactive and otherwise ends with the tool's failure code.
3. **One object per thing installed.** Application, workspace, system module: one folder or image, one record, one entry in the list, one Remove.
4. **Privileged decisions come from root-owned state.** Package code never runs on the host and never as real root.

### 1. The application folder

#### On disk

Today a store application is spread over eight places (store repository and checkouts, kept package, record, data folder, launcher, icons, command shim, build log). After 4.0 it is one folder per person:

```
~/.local/share/Suno/apps/<id>/
  record.json   origin, userland, resolved packages, baseline, sources, exports, state, scope (user), store backend
  tree          link to the composed checkout the launcher mounts read-only
  data/         the application's home (container_file_t with its category pair)
  exports/      generated launcher, icons, D-Bus service files, command shims
  package/      the package file, when one is needed to rebuild
  log/          the last build log
~/.local/share/Suno/apps/.store/{repo,checkouts}   the shared OSTree repository and checkouts
~/.local/share/Suno/apps/.exports/                 one link farm over every app's exports/
```

- `tree` is a link, replaced by `rename()` of a new link between runs. Today `store_refresh` promotes the ref and composes a new checkout keyed by its commits; 4.0 adds the link. The previous commit stays in the store for rollback.
- **Tree integrity.** Checkout files are person-owned and could be rewritten in place, which would change the shared object and plant code that inherits the application's grants. At compose and at every start the launcher compares the checkout's inodes (inode number, mode, size, link count) with the commit's objects and composes again on a mismatch. fs-verity is enabled on objects where the file system supports it. Before linking, compose stat-checks the modes of the objects it links; a full `ostree fsck` runs weekly, idle and on mains power. Files shows `tree` read-only.
- `CACHEDIR.TAG` is written into `.store/` and every checkout. Connect Sync and Suno backup sync records and `data/`, never trees or the store, because copying hard links multiplies the size (12.8 GB of trees are 6.8 GB stored) and restored modes break a `bare-user-only` repository. Connect Sync's `apps-data/<id>` paths move with the data.
- SELinux: file contexts name `tree`'s checkouts and `.store` (hard links share labels). `restorecon -RF` and autorelabel reset `data/` to `s0`, so the launcher checks the level of `data/` at start and relabels it to the application's pair.
- Category pairs keep space for a person part, for a future second person per device.

#### Exports

- **Only generated regular files** are exported: the launcher as `org.projectSuno.Installed.<id>.desktop` (as `desktop.py` writes it today, `Exec=` Suno's launcher), icons renamed to the application ID, D-Bus service files only for names that pass `bus_names.allowed` and that nothing on the device provides, with `Exec=` Suno's launcher. Nothing else from a tree is exported: no MIME XML, thumbnailers, search providers or `mimeapps.list`. URL schemes keep `SYSTEM_SCHEMES` out.
- **Order.** `.exports/share` comes after `/usr/local/share:/usr/share` in `XDG_DATA_DIRS`. `61-Suno-live-exports` stays first, because it carries image content. `PATH` is: `~/.local/bin`, the image's directories, applications, workspaces.
- **Command names.** A shim is refused for a name the image has, a name in `~/.local/bin`, or a name on the denylist (`sudo`, `su`, `pkexec`, `ssh`, `gpg`, `passwd`, `git`, `sh`, the shells, the package tools). This is re-checked on every rebuild of the farm. A name that is not exported gets one `Suno:` line and can be given with `Suno-appctl alias`.
- **Outside the session** (sudo's `secure_path`, SSH and TTY logins, cron, system units): the dispatcher's privileged half writes generated shims to the root-owned `/var/lib/Suno/exports/bin`. That directory is on `PATH` through `/etc/profile.d` (bash, zsh, fish), `pam_env` and `secure_path` (last). A shim runs its command as the person, or under `sudo` as mapped root in the person's user namespace. No person-writable directory is ever in `secure_path`.
- Command-line path grants for an application run cover the named paths only, never `/`, `$HOME` or a protected path (`permission_views.PROTECTED`).

#### As a person sees it

- **Settings → Apps**, the one list: origin, size (own and shared), permissions, updates, Remove, Show contents.
- **Files**: an "Applications" location that shows each application as a bundle (icon and name; opening it launches the application; "Show contents" opens the folder). Flatpaks appear in it too. Contents are read-only outside `data/`.
- **Terminal**: `Suno-appctl where <name>`.
- Applications never see these folders (hidden folders are never mounted, #534).

#### Removal

Remove deletes the folder except `data/`, deletes the refs, prunes, rebuilds the farm, and deletes the application's keyring items (`Suno:application`) and permission rows. The gate checks both over D-Bus. Data goes by choice; removal lists documents in `data/` first. Kept data leaves the folder with `data/` and a record in state `removed`. That record keeps its category pair (`capsule_identity` counts it) and is listed under "Kept data" with a Delete. `Store.collect()` today deletes the store root when no `app/` or `pending/` ref remains (`app_store.py` 324–327). 4.0 changes it to delete the root only when no kept data, workspace or ref is left. Files owned by subordinate IDs are removed inside the person's user namespace (`closure.remove_tree`), which the gate exercises.

#### Migration

`Suno-app-migrate` moves each application by renames on one file system: repository to `.store`, record, data (`apps-data/<id>` or `installer/data/<sha256>`), kept package, log; it writes `exports/` and removes the old launcher, icons and shim only where they carry Suno's marker. A failed move leaves everything in place and records why; the launcher reads the old paths until 4.0's upgrade gate passes.

The store stays per person for now (open decision 3).

### 2. The dispatcher

#### Commands

| Command | Today | After |
| --- | --- | --- |
| `apt`, `apt-get`, `apt-cache`, `apt-mark` | translated to Fedora names, layered by Suno's `dnf` | dispatcher; the real apt of the target release does the work in the tree or workspace it changes |
| `apt upgrade`, `full-upgrade` | the Suno update, through `dnf upgrade` | the Suno update with its question (as today), then the apt workspace's real upgrade, then a refresh of every apt-family application (`Suno:` lines; each update applies when the application is closed) |
| `dnf upgrade` | the Suno update | the Suno update (as today), the Fedora workspace's real upgrade, refresh of rpm-family applications |
| `apt remove/purge`, `dnf remove`, `rpm -e`, `dpkg -r/-P` | removes the layered package | an application's top-level package: that application's Remove, `data/` kept under "Kept data" without asking; a workspace package: the real tool; an image package: today's `dnf` behaviour |
| `apt-mark hold`, `dnf versionlock add` | layered package held | application hold (`Suno-appctl hold`); in a workspace the real tool |
| `dpkg -i FILE` | not present | `apt install ./FILE` (dependencies resolved; one `Suno:` line) |
| `dpkg -s/-l/-L`, `dpkg-query` | not present | real `dpkg-query --admindir=` of wherever the package lives |
| `dpkg --print-architecture`, `--compare-versions` | not present (guides get an empty `arch=`) | the real dpkg of the default apt release (`amd64`/`arm64`) |
| `dpkg --add-architecture i386` | not present | adds i386 to the apt workspace and to later apt application builds |
| `debconf-set-selections`, `dpkg-reconfigure` | not present | answers stored per release, used by the workspace and later builds; reconfigure runs in the workspace |
| `update-alternatives` | Fedora's, on the image | the image's for image paths; inside a workspace the workspace's |
| `apt-key add` | not present | stores the key with third-party keys; it is used only by sources that name it with `signed-by` (one line says so) |
| `add-apt-repository` | not present | real `add-apt-repository` of the default apt release, against the apt workspace's sources |
| `lsb_release` | the image's | the image's (honest: Suno) |
| `dnf`, `yum`, `rpm -i/-U FILE` | layered, live | classified: applications to the store, workspace packages to the Fedora workspace, system modules as section 5 |
| `rpm -q…` | real rpm on the image | the image, then the Fedora workspace, then applications whose top-level package matches |
| `flatpak` | real flatpak | unchanged (section 6: global override) |
| `snap` | snapd | unchanged; snaps are listed as not sandboxed (section 6) |
| Opening a `.deb`/`.rpm` in Files or Depot | Valet → store (capsule fallback) | Valet → the classifier; a console package becomes a sandboxed console application (today's `export_command` route), never a workspace without the sheet choice |
| `curl \| sh`, `.run` | runs on the host | section 4 |

Inside toolbox, distrobox, podman containers and any root that is not the booted image, nothing is intercepted. The shims check `/run/ostree-booted` and that they run in the host's mount namespace. Today the `rpm` shim checks only the first; 4.3 adds the second. `SUNO_APT_PASSTHROUGH=1` and `SUNO_DNF_PASSTHROUGH=1` give today's behaviour; the image's sudoers keeps them through `env_keep`. `dnf5` stays the real dnf5.

**Library callers** (PackageKit and `pkcon`, `dnf5daemon`, rpm-ostree's D-Bus API, Ansible's `apt`/`dnf` modules) bypass the shims and keep today's behaviour in steps 4–5. A dispatcher API (varlink) for them is later work; records and launchers already carry `scope` so a system scope can be added.

#### Who it acts for, and with what privilege

- The person is `SUDO_UID` or `PKEXEC_UID`, else `/proc/self/loginuid`, else the device's one person. Only a process with no person at all (no login UID, no session) is refused, with one line. Root-only use (provisioning, MDM) gets system modules only.
- The privileged half decides only from root-owned state. Everything that touches the home or package contents runs as the person through `systemd-run --user -M <user>@ --wait --pipe|--pty --collect`. `closure` and `app_store` refuse to run at euid 0; today `closure.userns_prefix()` returns nothing for root, which would run maintainer scripts as real root.
- `bwrap` always gets `--cap-drop ALL`. Package files are passed as file descriptors, not paths. `dpkg-deb`/`rpm` reading an untrusted file run in the sandbox, never on the host.
- Queries never escalate. A query run under `sudo` drops to the person before it reads a database.
- System-module packages are fetched again by the privileged half from root-owned repository configuration; it never acts on output produced on the person's side.
- `polkit`: installing or removing a system module is `auth_admin` (no keep).

#### Building

Download online, install offline. apt runs `--download-only`, then installs with `--no-download` in a fresh sandbox with `--unshare-net`. dnf5 runs `--downloadonly`, then `-C`. Maintainer scripts never see the LAN, loopback or the session's abstract sockets. `file:` sources and package paths given on the command line (USB sticks, offline mirrors) are bound read-only into the build. At run time applications get Landlock's abstract-socket and signal scope. Isolating them from host loopback (pasta) is a later change with its own gate, because some applications talk to local services.

#### Trust anchors and sources

- Distribution keys come only from the image: `/usr/lib/Suno/keyrings`. `SUNO_USERLAND_KEYS` is ignored outside tests.
- `/usr/share/keyrings` and `/usr/share/debsig/keyrings` are links to the writable `/var/lib/Suno/keyrings`, for third-party keys only. A guide's `gpg --dearmor -o /usr/share/keyrings/x.gpg` works, and a `curl | sudo sh` can no longer replace a distribution key.
- A hand-written source in `/etc/apt/sources.list.d` or `/etc/yum.repos.d` is bound only into the release it names, and only into builds whose record lists it. Sources with `[trusted=yes]`, without `signed-by`, or relying on `trusted.gpg.d` are refused, with one line each.
- Suno's `os-release` stays as it is (`ID=Suno`, no Ubuntu codename). A guide line built from `$VERSION_CODENAME` comes out empty, and the real apt rejects it. The dispatcher names the entry and, when interactive, offers to set the suite to the workspace's release. Scripts that need Ubuntu go through `Suno-install` (section 4).

#### Interactivity and terminals

A run is interactive only when it has a controlling terminal and none of `-y`, `--assumeyes` or `DEBIAN_FRONTEND=noninteractive`. Each Suno question has a fixed non-interactive answer:

| Question | Non-interactive |
| --- | --- |
| add a vendor source | no: the tool's "not found" and exit code, plus one line naming the source |
| Suno's build of a kernel module or engine instead of a local build | yes (it is the module asked for), except Secure Boot without a trusted key: refuse |
| a root-equivalent system module (full control) | no: failure code and one line |
| fallback to layering | no: failure code and one line |
| snap-transitional name | no: failure code and one line |

The image sets `dev.tty.legacy_tiocsti=0` (the gate asserts it). Non-interactive builds run with `--new-session`.

#### Classification

The dispatcher (`Suno_installer/classify.py`) reads control data and file lists of the top-level package plus its **own dependencies**: the members a meta-package brings and the packages built from the same source, among the non-baseline packages of the request. Other projects' packages in the request count only for kernel modules; their daemons stay inert and their launchers do not make an application (the labelled set showed the whole closure brings httpd, podman, libvirt and LibreOffice into requests that are none of those). The baseline and the data list of what the device provides (`data/classify/host-provided.txt`: D-Bus, polkit, avahi, colord, cups, udisks2, bluez, upower, rtkit, geoclue, libsane, and systemd, the shell and session, gvfs, PipeWire, NetworkManager, the container tools, fuse and others) stay inert in trees: `policy-rc.d` returns 101, the application talks to the host's daemon. In order:

1. **System module** if those files contain any of: kernel modules or DKMS sources; the package's own system service: a system `.service`, `.socket` or `.timer` or an `/etc/init.d` script running its daemon program, or named like the package (enabled or not, whatever `User=`); PAM or NSS modules (the C library's own NSS modules excepted); PAM stack profiles; polkit rules; D-Bus system services and policies; NetworkManager plugins and configuration; system unit drop-ins and presets; `binfmt.d`, `sysctl.d`, `modprobe.d`, `sudoers.d`; firmware; mount helpers (`mount.*`) and FUSE filesystems; smart-card reader drivers; an init system; boot-chain files (GRUB and its fonts, shim and EFI loaders, initramfs scripts and binaries, Plymouth); a login shell; CUPS filters, backends or PPDs; a package that is only package-manager configuration; for a package without a launcher, a cron job; a desktop environment or display manager (refused: a desktop is a Suno Mod, ADR-012). How much a marker decides: a service running the package's daemon program, kernel and boot parts, firmware and an init system decide on their own. PAM and NSS modules, PAM stack profiles, a PAM service configuration (`/etc/pam.d`, as `screen` ships for its own lock) and FUSE filesystems are always a choice for the person, with that reason shown; the default is the workspace. Every other marker, including a service only named like the package, decides when the package has nothing a person uses directly beside it (no libraries, user commands, language modules or headers); otherwise it is a choice (`libcap` with `pam_cap.so`, `procps` with its sysctl defaults). A library package that also ships its own daemon (`zvbi`: `libzvbi` and `zvbid`) is a choice too. Development packages (`-dev`, `-devel`, headers and link libraries only) are workspace packages whatever else they hold. An optional daemon shipped beside client tools (`svnserve`, ClamAV's `freshclam` and `clamonacc`, `qemu-pr-helper`) stays inert in the workspace, with one line saying how to get the service. Maintenance units, cron jobs and initramfs hooks of command-line tools (`dpkg-db-backup`, `apt-daily`, `fstrim`, `man-db`, `e2scrub`) stay inert too (`data/classify/inert-integration.txt`). A daemon in Fedora's merged `/usr/bin` is decided by its own unit (`haproxy`, `irqbalance`, `znc`), not by where the program lies. Only the request's own files count: a marker in a sibling or dependency package (`epmd`'s unit for `erlang-*`, a dependency's D-Bus policy) never decides. A package that only writes system-wide configuration (`/etc/krb5.conf`, `/etc/profile.d`) is a system module when nothing a person uses directly is beside it. A web application that configures a system web server (`phpmyadmin`) goes with that server: a system module. Distribution identity and edition packages (`fedora-release-*`, `base-files`, `lsb-release`) are image-has-name: installed in the workspace for that release, never on the host.
2. **System tool** if its main function needs root. A command-line package whose commands are all in `sbin` and that links a library reaching devices, the kernel or the network (`parted`, `ethtool`, `dmsetup`, `fdisk`) is a command-line system tool: a workspace's `sudo` is mapped root, so there it would work worse than today. Administration commands without such a library, or beside user commands, or known only from manual section 8 (Fedora merged `sbin` into `bin`), and commands elsewhere that link such a library or a package manager's library (`lsusb`, `aptitude`), are a choice. Otherwise a system tool is one whose main function needs root: the launcher's `Exec` runs only through `pkexec` (Synaptic, Timeshift), a polkit `.policy` has `exec.path` for its main binary (GParted's `gpartedbin`, `gufw`), or its main binary is setuid, setgid or carries file capabilities. Privilege on any other command does not make a system tool: the command goes to the workspace without it and one line says what will not work ("mtr needs raw sockets"; `ping` works unprivileged through `net.ipv4.ping_group_range`, set by systemd's `50-default.conf`). A helper kept out of the command path (`gsm-kill` in `/usr/libexec`), an application's optional "as root" mode (Thunar, BleachBit) and Chromium's setuid sandbox are named as not offered. A graphical front end to `sudo` or `su` (`lxqt-sudo`) is a system tool. A game whose setuid or setgid main binary only reaches a score file under `/var/games` (`nethack`, `qascade`) is not one: it is an application or workspace package with scores kept per person. Data, `-common` packages and backends of a package-manager front end take the front end's choice (application or system tool for Discover and GNOME Software; workspace or system tool for `aptitude`, `tasksel` and PackageKit's command-not-found). A system tool is a system module labelled "full control of this computer", or refused with the reason. VirtualBox and VMware are each one version-locked module (kernel module, setuid helpers, application). Disk writers (rpi-imager, Fedora Media Writer, Etcher) are applications that need the "disks" device permission (udisks2 through the broker, with polkit).
3. **Device request**: udev rules become a device request (ADR Permissions 5). A udev-only package (rules and hwdb data, with at most what installs them: an initramfs or dracut copy, a unit that triggers udev, its group) is a device request, never a system module (`tpm-udev`, `net-naming-sysattrs`). On a grant the privileged half writes them to `/etc/udev/rules.d` through `Suno-installer-system device-access` (`steam-devices`, `android-sdk-platform-tools-common`, qmk, openrgb).
4. **Device add-on**, from a data list of paths (`data/classify/addon-paths.txt`: themes, dictionaries, fonts wherever their files lie but never TeX's, codecs, scanner backends, input methods, thumbnailers, panel and file-manager plugins, Secret Service providers, portal backends). A device add-on is device-wide; an add-on for one application is not one. A data, `-common` or plugin package made for one application (an application of its source depends on it and it has no programs or libraries to link, or its files lie in a dependency's own folder: `gedit-common`, `vlc-data`, `remmina-plugin-secret`, LibreOffice's dictionaries, `smplayer-themes`) is an **application** added to that application's tree (`add_on_of`). A module, plugin, driver or configuration of a system module goes with it (`libnginx-mod-*`, `libapache2-mod-*`, Samba's VFS modules, libvirt's drivers and network configuration, VDR, Munin and SSSD plugins). `add_on_of` always names an application with a window: data of a library or command-line tool (`readline-common`, `proj-data`, `clamav-data`) is a workspace package. A plugin pack for an open plugin standard loaded by any host (LADSPA, LV2, DSSI, frei0r, ALSA PCM plugins) is a device add-on in the release's trees and workspace, like codecs; one named for a single host is that application's add-on. Hardware video drivers (VA-API, VDPAU) follow graphics, which come from the device: a device add-on. Display-manager themes and greeters go with the display manager (refused, or a system module); a standalone window manager and its decorators and plugins are a desktop component (a system module; a choice when it has a window); the themes rule covers only GTK, icon and cursor themes. A user unit running a helper is a user service (it stays with the application or workspace; start at sign-in is a permission) unless it fills a session role the host shell fills (notifications, keyring and SSH agent, global shortcuts, accessibility): then it is a desktop component. Data, documentation and defaults of a desktop component without code or markers are inert: a workspace package. A desktop component (an autostart entry or session D-Bus service running a helper that is not the package's window, a polkit agent, a kded plugin) changes the desktop for everyone: a system module, or, when the image carries it, image-has-name; never a workspace. With its own window it is a choice; with libraries a person uses it is a choice. Data-only add-ons (icon, GTK and cursor themes, dictionaries) install for the person under `~/.local/share` after a file-type check. Add-ons that load native code into the session (input-method engines, Files and Shell extensions, portal backends) are device-wide only as an image-signed system module after an interactive yes, and are otherwise refused with the reason.
5. **Fonts** (wherever their files lie) install for the person in `~/.local/share/fonts`; only font files pass (TrueType, OpenType, WOFF, Type 1 by magic). Device-wide fonts only from a distribution-signed source with administrator approval. **Codecs** (GStreamer, FFmpeg plugins) are add-ons in that release's trees and workspace. Device-wide codecs only as an image-signed system module.
6. **Application** if it, or a meta-package's member, ships a launcher that is not `NoDisplay=true` or `Terminal=true` and whose `Exec` runs a program from the package (a launcher in its source's `-common` package counts when the package has the program; a font or data package is never its source's application). A `Terminal=true` launcher (`htop`, `vim`) makes a console program. A package that ships a launcher a person sees is never silently a workspace package or a device add-on (a windowed application in a full-trust workspace loses its sandbox): it is an application, or a choice that includes application (`kdiff3` with its Files plugin, `xfce4-dict` with its panel plugin). A package manager's window (`System` and `PackageManager` categories) is a choice between application and system tool.
7. **Workspace or console application** otherwise (command-line tools, libraries, `-dev`/`-devel`, runtimes). Something goes into a workspace only through one of three entries: Suno's signed list (editors, IDEs, toolchains), a package-manager command run in the person's session (typed or in their own script, both of which already run with the person's full rights), or the install sheet's explicit choice "Full access to your home and SSH keys". A package file opened from Files or Depot becomes a sandboxed console application by default. Moving an installed application into a workspace needs a yes. A package's categories (`Development`, `IDE`) never decide by themselves.

**Terminal emulators** run on the host, not in a workspace. The terminal's program runs from its tree. Every shell it opens starts on the host through host-exec with the terminal's pty, as Ptyxis does from Flatpak. That permission is shown as full control.

Hard cases:

| Case | Rule |
| --- | --- |
| Window and commands in one package (`code`, `gimp`, `vlc`) | Application; its `/usr/bin` programs are exported as commands that start in its sandbox; named paths are granted for that run |
| Electron `/usr/bin` link to the launcher's program | Exported as the application's command |
| IDE via the signed list or the sheet choice | Workspace, with its dependencies (`-dev` packages land beside the compiler). VS Code installed by 2b moves only on a yes; settings move from `data/` to the home only where the home has none |
| Application with a root service (`tailscale`, `mullvad-vpn`) | Split: the window is an application, the service a system module, one entry and one Remove; a refused service leaves the application installed with what will not work named |
| `postgresql`, `redis-server`, `mariadb-server`, `nginx`, `docker-ce`, `bind9`, `samba` | System module (rule 1, whatever `User=` or preset): a daemon program's own service decides, even with client tools beside it |
| A command-line tool with a service named like it (`cvs`, `fio`, `apt-show-versions`) | Workspace with a notice: the service runs the person's own command (documented in manual section 1) and stays inert; one tap installs it as a system module |
| `gimp`, `gnome-boxes`, `libreoffice` | Application; their dependency daemons stay inert, the host's are used |
| `gvfs-backends` and other backends that load into a service the image runs | Host integration: the image carries its own (image has the name); the package goes to the workspace for workspace applications |
| `virt-manager` | Application that needs the libvirt system module: an application and service split |
| User services (`syncthing`) | Stay with the application or workspace; start at sign-in is a permission |
| Kernel modules, DKMS, `akmod-*`, `cuda-drivers-NNN` | Section 5; never built on the device. A driver version that differs from the device's NVIDIA module asks; `-y` never proceeds |
| Packages that only add a repository (`epel-release`, `packages-microsoft-prod.deb`, `add-apt-repository ppa:`) | A source of that release, recorded, listed, removable |
| Meta-packages (`build-essential`, `@development-tools`, `ubuntu-restricted-extras`) | Members classified one by one; the meta recorded with what it brought; `apt remove` removes the meta only, `autoremove` offers the rest |
| Snap-transitional packages (`firefox`, `chromium-browser`, `thunderbird` on Ubuntu; version contains `snap` or depends on `snapd`) | Never built. One line and an offer: the snap through snapd, or the same application from Depot, Flathub or the vendor's apt repository (asked); non-interactive: failure code |
| `apt install ./x.deb`, `dnf install ./x.rpm` typed | Classified from the file; a console package resolves in the default workspace when it can, otherwise becomes a console application on its own userland |
| `apt install python3-numpy` (modules or headers for an interpreter the image carries) | Installs the workspace's interpreter too and puts it ahead of the image's in the person's `PATH` with one `Suno:` line (listed, reversible with `Suno-appctl alias`); `sudo` and system scripts keep the image's. `dnf` uses the Fedora workspace, which matches the image's ABI |
| The image already has the name (`apt install git`) | Installed in the workspace; not exported; one line names both paths |
| Login shells (`zsh`, `fish`) | Workspace command with a notice: making it the login shell is a system change, one tap installs it as a system module (section 5) |
| `wine` from the distribution | Suno's Windows runtime, announced, with `wine` exported to it. WineHQ's packages from its own repository install as asked into the workspace |
| Steam `.deb` | Application on its userland with i386 graphics layers; the list `steamdeps` would install at first start is resolved at build, because the tree is read-only |
| Vendor name not in the release (signed list) | Interactive: names the source and asks. Otherwise the tool's "not found", its exit code, one line. `-y` never adds a source |
| Same application in Depot | One line; the command continues |
| x86_64-only package on aarch64 (Spotify's repository) | The real tool's "Unable to locate package", exit 100 (FEX is step 6) |

**Curated list first.** For packages from a distribution, a curated list per release (`data/classify/curated-<release>.json`: the most-installed Ubuntu LTS packages and Fedora's comps and windowed, service and command packages; each entry pre-labelled by these rules on the package's own files and checked against the distribution's AppStream, debtags and comps metadata, with disagreements reviewed) decides by name; the rules decide the long tail. The list carries its classifier version and generator commit and is signed like the Depot catalogue.

A request the rules do not place cleanly (rules disagree within one package, or a fact cannot be read) is a **choice**: the classifier returns the candidate classes with their reasons, never a silent system module or system tool. Every result has a **default** (what is installed without asking: for a choice, the first of application, workspace, device add-on among its candidates; never a system kind) and **ask** (only when every candidate is a system kind, or under the marker rule below). When the default is a workspace package or an application but the package carries its own service or a tool that needs root, the result's **notice** says so after the install, with the one-tap alternative (system module or system tool) on its page and an undo. An application with system parts of its own (GNOME Settings' polkit rules) and an application with a privileged command it may need (Wireshark's `dumpcap`) are choices. Non-interactive, a choice takes the fallback, with the reason.

**No silent non-system outcome for a system marker.** A package without a curated decision that carries any system marker of its own (boot-chain files, its own daemon's unit, PAM or NSS modules, a CUPS filter or backend, files in a system daemon's plugin folder, setuid, setgid or capabilities on its main program, a main function on raw sockets, a kernel module, udev rules not carried as a device request, polkit rules, an `sbin` administration program, a greeter or session file) is never placed outside the system without saying so: where the rules above give it a sandboxed kind with no notice, it becomes a choice between that kind and the system kind, the default stays the sandboxed kind, and the person is asked. Packages the image provides are exempt.

#### Output, queries, exit codes

- Workspace changes are the real tool on the workspace root with the person's terminal. The table, `debconf` prompts and errors are the tool's own.
- Applications are built by the real tool on top of the release's base and baseline commits. Its table lists exactly the packages the tree adds beyond that base. Preparing a release's base the first time is one `Suno:` line with its download size.
- Queries (`dpkg -s/-l/-L`, `apt list --installed`, `apt policy`, `rpm -q`, `rpm -qa`, `dnf list --installed`) look in this order: the image (rpm family), then the workspace, then applications whose top-level package matches. They use the real query tool on each database, as the person. Dependencies inside a tree are not reported as installed. A listing across databases is printed one database after another, in the tool's own line format.
- Exit codes are the real tool's: apt 100, dnf5 1, dpkg 1, rpm the failed count. A refusal uses the tool's failure code. A request split across classes exits non-zero if any part failed and names the parts done.

### 3. Workspaces

1. **Trust.** A workspace runs at the person's trust level, like their shell or today's layered `dnf`. It can read and change anything the person can, including sign-in files. The keyring broker gives it its own Secret Service items for tidiness; that is not a security boundary. Safety comes from entry (section 2, rule 7): a package file from Files or Depot never lands in a workspace without the sheet's explicit choice.
2. **One per family.** `~/.local/share/Suno/workspaces/<release>/` with `root/` (an ordinary directory, because package managers rewrite in place), `record.json`, `exports/`. There is one apt workspace on the default apt release and one Fedora workspace on the image's Fedora release (so what is built there runs on the image). It is created at the first command that needs it, with one line giving its download size.
3. **Changes.** The release's own tool runs as mapped root in the person's user namespace (`unshare --map-auto`), never as real root, against `root/`. Running shells see changes at once. The tool's lock serialises transactions; its own history (`/var/log/apt/history.log`, `dnf history`) is the record.
4. **Snapshots** are taken before a release upgrade and on request: a reflink copy where the file system supports it, otherwise a commit to a `bare-user` repository, which keeps ownership in extended attributes. Rollback takes the tool's lock. The gate requires `dpkg --verify` or `rpm -Va` to be clean afterwards. The list shows the workspace's disk use, snapshots included.
5. **What a workspace sees**:
   - the application session boundary: Wayland, the X relay, PipeWire and PulseAudio, portals, fonts, theme, input method;
   - device graphics bound read-only at launch under `/run/Suno/graphics` (Mesa for the release, NVIDIA userspace matching the device's module, i386 layers), found through an `ld.so.conf.d` entry and the GL/Vulkan/EGL vendor paths, as Flatpak's GL extensions are, and never written into `root/`; "provided by device" stub packages (equivs, dummy rpms) for Mesa, NVIDIA userspace and `libcuda` keep apt and dnf from installing their own;
   - the real home folder, `~/.ssh` and the SSH agent;
   - `/run/media`, `/media`, `/mnt`, `/srv`, `/tmp`, `/var/tmp`;
   - the image read-only at `/run/host`;
   - the host's PID namespace, network and devices, and the system and session buses;
   - host-exec, which runs any host command as the person.
   `sudo` inside a workspace is mapped root in the person's user namespace. `apt` and `dnf` typed inside reach the host dispatcher through host-exec.
6. **Exports** follow section 1. Under `sudo` from the host, a workspace command runs as mapped root in the person's namespace; root never executes a file from a person-writable root.
7. Deferred: more than one workspace per family, Homebrew and Nix registration, and listing pip, npm, cargo and go installs. Until then they work as they do today and are not listed.

### 4. Install scripts

1. **Typed pipes** (`curl … | sh`) run on the host as today; Suno does not change `sh`, `bash` or `sudo`. Most vendor scripts read `ID` and refuse `Suno` (get.docker.com: "Unsupported distribution"; Tailscale's falls to "other-linux"), as they do today. Their package-manager calls, when they get that far, reach the dispatcher.
2. **`Suno-install <url|file>`** runs the script in a capture sandbox made from the apt workspace's release, so its `os-release` really is Ubuntu. The sandbox has no home and no session bus; its network is its own (no host loopback). Its `apt` calls reach the dispatcher and are classified as usual. Files it writes outside package managers are shown as a diff and become a console application or workspace change on the person's yes. Docker and Tailscale are on the signed vendor list.
3. **`.run` and makeself archives** are never executed to extract them: Suno parses the header (offset, file sizes) and untars the payload, or extracts inside the capture sandbox (no home, no network, no session bus; a display only for GUI installers). A payload with a launcher becomes an archive application. One that builds kernel modules (NVIDIA's, VMware) is refused with the reason, naming Suno's module where there is one.
4. **Listing.** A stateless scan lists files under `/var/opt`, `/var/usrlocal` and `/etc/systemd/system` that are neither from the image nor in a Suno record. They are listed by path, without attribution, each with a Remove. The privileged half re-checks each file's hash against the scan before it deletes anything, as `Suno-remove-added-package` does. The later attribution mechanism is audit watch rules (`-w /var/opt -w /var/usrlocal -w /etc -p wa`) read through audit multicast with `CAP_AUDIT_READ`: pid, ppid, exe and the audit session ID survive `sudo`. Entries would be root-owned in `/var/lib/Suno/script-entries`, and created users locked, not deleted. fanotify was rejected for this: recursive marks need `FAN_MARK_FILESYSTEM` over all of `/var/home`, and `sudo`'s `use_pty` breaks session grouping.

### 5. System modules (step 5)

1. **Carrier.** System modules are signed dm-verity `systemd-sysext` images in `/var/lib/extensions`, with a `systemd-confext` image for any `/etc` part. They cover kernel modules (with `depmod` output), firmware, login shells, PAM and NSS modules, container engines and root-equivalent services (`docker-ce`, the Nix daemon, VirtualBox as one version-locked module). Suno builds and signs them; activation and removal are `systemd-sysext refresh`. rpm-ostree layering of the Fedora package is the fallback: it is labelled, asked when interactive, and only available while the image is rpm-ostree-based (Fedora's bootc images refuse local layering). Flatcar ships Docker and containerd this way.
2. **Kernel modules.**
   - Small modules (`v4l2loopback`, `xone`) ship in the image and load on demand.
   - Every other out-of-tree module on the signed list is built with each kernel Suno builds, against its exact headers, into one kernel-module extension per kernel and variant. Two variants exist: standard, and NVIDIA proprietary in place of NVIDIA open. Each carries a complete `modules.dep`, because two extensions cannot both provide it. Modules the person did not ask for are not loaded.
   - Signing: a module-only CA in `CONFIG_SYSTEM_TRUSTED_KEYS` (Suno builds its own kernel), with the module-signing extended key usage, so there is no MOK step.
   - The graphics route moves to NVIDIA, and nouveau is left alone, only after the module has loaded once.
   - `dnf install akmod-nvidia`, `apt install nvidia-driver` or `virtualbox-dkms` map through the signed name list to Suno's build, with one `Suno:` line.
   - A module not on the list is refused: the tool's failure code and a line saying why (modules are not built on the device, break at the next kernel and cannot be signed) and where to ask.
   - aarch64: only for Suno's own kernel streams.
3. **Update holds.** The device computes holds from the signed graph; its module list never leaves it. A device with a module stays on its release until the module is built for the new kernel. Each hold shows its reason and a deadline, and offers "update without the module".
4. **Portable services** only for services that can be confined. A unit is rewritten through an allowlist, which rejects:
   - `+`, `!` and `!!` exec prefixes, and `PermissionsStartOnly=`;
   - `BindPaths=` outside the service's own state;
   - `Delegate=` and `RootDirectory=`.
   Non-trusted profiles run with `DynamicUser=` and named `AmbientCapabilities=` (for example `CAP_NET_ADMIN` with `/dev/net/tun`), and a filtered system bus. Declared users are created on the host from the package's `sysusers.d`, so `sudo -u postgres psql` works. The profile binds the host's `/etc/<name>`, `/var/lib/<name>`, `/var/log/<name>`, `/run/<name>`, and `/srv` and `/var/www` where declared, so `nginx` configuration is edited where guides say. The privileged half builds the image from packages it fetches itself, in a sandbox as an unprivileged system user, and copies it (never hard links from a person's store) to `/var/lib/portables/<name>` with its file context. Tailscale's daemon is confinable this way; Tailscale SSH needs NSS and PAM and is named as not working.
5. **`dnf install` changes the system only for system modules**, through extensions or the labelled fallback. Packages already layered stay layered; moving them is deferred until the extension carrier is settled.
6. **Removal in one step.** For an extension: remove its image and `systemd-sysext refresh`; unloading a kernel module needs a restart, which is said first. For a portable service: `portablectl detach --now` and its image, with state by choice. For the fallback: `rpm-ostree uninstall`. An application's service goes with it.
7. Deferred: Printer Applications. Printer driver rpms take the layering fallback as today. Debian printer driver packages are refused with the reason; today they become a capsule that cannot print.

### 6. Permissions and the one list

Every class appears in the one list with the step 3 surface (#534, #537): origin, size, access, use, updates, Remove.

| Class | Shown |
| --- | --- |
| Application (store, capsule, AppImage, Flatpak) | file level, devices, network, background; as step 3. File levels now also cover mounted volumes (`/run/media`, `/media`, `/mnt`): named folders can include a volume, all files includes them |
| Workspace | "Full access to your home and SSH keys"; packages, sources, exported commands, snapshots, disk use |
| System module, system tool | its profile in words, "full control of this computer" where it applies, signer, service state, holds, restart needed |
| Snap | "Not sandboxed on Suno" (snapd without AppArmor confines with seccomp and mount namespaces only); snapd stays as now |
| Scanned file | path, Remove |

- **Flatpak.** A global override denies `home` and `host`; each application's Suno override then grants its chosen level (application overrides apply after the global one). `flatpak install -y X && flatpak run X` never runs with the packager's declared access first.
- **Integration files apps write privately.** Suno watches `data/.local/share/applications` and `data/.config/autostart` and turns what appears there into exports and the start-at-sign-in permission (Steam, JetBrains Toolbox, Lutris, Wine). A DynamicLauncher-style portal is the target. Tray item names are rewritten in the bus proxy so PID-named items cannot collide. 1Password's browser integration goes through the native-messaging broker.
- Engine rows use the same store, under `org.projectSuno.Workspace.<release>` and `org.projectSuno.SystemModule.<id>`.

New UI, as design requests for the Website session (no visuals decided here):

1. Install sheet choice "Full access to your home and SSH keys" and the yes for moving an application into a workspace.
2. Workspace page: packages, sources, exported commands, snapshots, disk use, Remove.
3. System module and system tool page: profile in words, the full-control label, signer, service state, restart needed; the hold with its reason, deadline and "update without the module".
4. Terminal emulator with the host-shell permission (full control).
5. Files "Applications" location: bundles (icon, open = launch, Show contents), Flatpaks included; the read-only contents view.
6. Kept data entries.
7. Snap entries labelled not sandboxed.
8. Scanned files list with Remove.
9. `Suno-install` diff and the yes for its result.
10. The notice after a command-line install (suggested level applied, review pending; never blocks the command).
11. The split entry for an application with its service.
12. Interpreter preference (workspace Python ahead of the image's) and command aliases.
13. Phone layout of all of the above.

### 7. Order of work and gates

| Sub-step | What | Fallback |
| --- | --- | --- |
| 4.0 | Application folder, exports (session and root-owned), tree integrity, removal fixes, migration of every record kind | Old paths read until the move succeeds per application |
| 4.1 | Queries across image, workspaces and applications; root/identity rules; the `dpkg` helper commands | Image-only answers, as today |
| 4.2 | Workspaces: build, session boundary, device graphics, stubs, host-exec, snapshots | — (new) |
| 4.3 | `dnf`, `yum`, `rpm -i` classify | Today's live layering, asked when interactive |
| 4.4 | `apt`, `apt-get`, `dpkg -i`, sources and keyrings; Valet uses the classifier | Today's translation, asked when interactive |
| 4.5 | `Suno-install`, `.run` extraction, stateless scan, Flatpak global override, integration-file watches | Today's behaviour without them |
| 5.1 | Extension carrier, kernel-module extensions, holds | Layering fallback; no extra modules |
| 5.2 | System tools and root-equivalent services as extensions | Layering fallback, labelled |
| 5.3 | Portable services | Layering fallback, labelled |

Deferred, with the reason: `pacman`/`zypper` (no bootstrap yet; the commands stay absent), Printer Applications, per-transaction workspace commits, more than one workspace per family, Homebrew/Nix/pip/npm/cargo/go listing, attributed script tracking, moving today's layered packages.

**Gate for every sub-step**, on x86_64 and aarch64, SELinux enforcing:

1. **Clean install** of the candidate: install, start or run, update, roll back, remove, with the zero-leftover listing (`~`, `/run/user/<uid>`, `/tmp`, `/var/tmp`), and keyring items and permission rows gone (checked over D-Bus).
2. **Upgrade path**: from the previous nightly with a populated home (capsules, 2b store apps, layered `dnf` and apt-translated packages, kept data, Connect Sync on). Everything still starts and keeps its data.
3. **A/B**: the corpus run on today's nightly and on the candidate. Every changed outcome is listed and approved by the owner; anything unapproved is a failure.
4. **Classification**: a blind, held-out labelled set (popular Debian/Ubuntu and Fedora desktop packages), scored with `tools/classify-labelled-set/run.py`; the hand-labelled set the rules were tuned on is the development set. Zero applications classified as system modules or system tools, zero non-system packages classified as either without a choice, zero packages with a launcher put in a workspace or a device add-on; zero silent breakage (a package labelled system module or system tool installed by default as a workspace package or application without a notice); at least 98 % agreement with the labels, a choice counting when the label is among its candidates. The harness reads each package file (launchers, polkit policies, file modes and capabilities, maintainer scripts, autostart entries, session services), as the dispatcher does.
5. **Overhead**: cached `apt install htop` at most 1.2× native apt on the same release; `dpkg -s` across ten applications and the workspace under 200 ms; a workspace command's shim under 50 ms over the bare program.
6. **Slow storage**: the same runs on a Pi 5 SD card and a UFS/eMMC phone, with numbers recorded and targets set from the first run before 4.0 ships.
7. **Assertions**: `dev.tty.legacy_tiocsti=0`; `dpkg --verify`/`rpm -Va` clean after a workspace rollback; the ADR-038 gates (`no-install-hurdles.sh`, `tests/os/no-install-hurdles/matrix.sh`) rewritten for the real tools' output and still passing every check not changed by design; the installer unit suite; `depot-opens`.
8. **Hardware**: kernel modules and graphics on Intel, AMD and NVIDIA (the GPU test plan) and one ARM device.

Corpus:

- **Applications**: Chrome, VS Code (`.deb`, `.rpm`), Discord, Slack, Zoom, Mousepad, FeatherPad, Obsidian AppImage, zsnes (i386), GIMP, gnome-boxes, Steam `.deb`, Spotify, Signal, Brave, 1Password, kitty `.deb`.
- **Workspace**: `htop`, `ripgrep`, `build-essential`, `libssl-dev`, `python3-numpy` import, a venv `pip install` compiling C, `nodejs` from NodeSource, `gh` from its repository, `@development-tools`, an SDL window and a CUDA sample from the workspace.
- **Development**: VS Code from the workspace building against `libssl-dev`, running `podman ps`, `git status`, opening a file on a USB stick, Dev Containers with podman, and `sudo apt install htop` in its terminal.
- **Outside the session**: `sudo iotop`, `ssh localhost htop`, a system unit whose `ExecStart=` is a workspace tool.
- **System modules**:
  - `dnf install tailscale && systemctl enable --now tailscaled`
  - `postgresql` with `sudo -u postgres psql`
  - `redis-server`
  - `nginx`: edit its configuration and reload
  - `docker-ce` with `docker run -v $PWD`
  - GParted, Wireshark, VirtualBox
  - `v4l2loopback`, `akmod-nvidia` (hardware)
  - one module not on the list (refused)
- **Scripts**: get.docker.com through `Suno-install` (passes) and piped directly (fails cleanly, as today), Ollama's `install.sh` through `Suno-install`, a makeself game installer, WineHQ.
- **Ubuntu specifics**: `apt install firefox` (snap-transitional), `dpkg --print-architecture`, `dpkg --add-architecture i386`, `debconf-set-selections`.
- **Scripted**: a Dockerfile-style `apt-get update && apt-get install -y …` without a terminal; `dpkg -s` checks; exit codes on failure.
- **aarch64**: Spotify's amd64-only repository gives exit 100; every other item where the vendor ships aarch64.

**Risks**

- Workspaces carry full trust. A malicious package installed by a typed command has the person's rights, as on any distribution today.
- Vendor scripts piped straight to `sh` still fail on `ID=Suno`; `Suno-install` is the working path, and people must learn it.
- Kernel-module holds tie updates to NVIDIA's support for new kernels; the deadline and "update without the module" bound it.
- The per-person store can be damaged by the person's own tools (`chmod -R go-rwx ~`); tree checks and the weekly fsck catch it, and re-composing or re-pulling repairs it.
- Ubuntu's `universe` has no guaranteed security updates without Ubuntu Pro; the list marks those packages "community-maintained".
- The layering fallback disappears if the image moves to bootc; by then every system module must have an extension or be refused.

**Decided in this amendment**

- The default release for a bare `apt install` is the newest Ubuntu LTS, taken only after its first point release. An existing apt workspace is never moved; it is upgraded in place on the person's word. Snap-transitional names follow the hard-case rule. Package files still choose their userland from their dependencies.
- Suno's `os-release` is not changed for apt.
- Kernel modules beyond the image at launch: NVIDIA (open, and proprietary as the second variant) and VirtualBox; others by request.
- A vendor's root service Suno has not built goes to the labelled layering fallback when interactive, or is refused; no device-local signing key, since it protects nothing against root.
- The store stays per person for applications and workspaces and is system-wide for system modules. Revisit with a second person per device or with unprivileged verity mounts (`systemd-mountfsd`/`nsresourced`).
- Host-exec from a workspace reaches every host command; an allowlist adds no protection under full trust.
- Library callers (PackageKit, `dnf5daemon`, Ansible) keep today's behaviour through step 5; the dispatcher's varlink API comes after.
