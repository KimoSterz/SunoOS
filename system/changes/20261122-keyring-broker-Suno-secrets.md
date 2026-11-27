---
type: security
component: Installer
packages: [Suno-application-installer]
highlight: false
---
Summary: Apps can no longer reach Suno's own saved keys
Details: The keyring broker that apps use refuses every entry that belongs to Suno itself, such as Connect Sync and Messages keys, whatever the app asks for.
