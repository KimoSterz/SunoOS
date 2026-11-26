---
type: security
component: Applications
packages: [luma-application-installer]
highlight: false
---
Summary: Apps can no longer change their own permission records
Details: Luma checks the records it keeps about running apps and saved app settings before it uses them, so an app cannot widen its own access through them.
