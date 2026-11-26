---
type: improvement
component: Updates
packages: [luma-update]
---
Summary: Device checks hold only that device's update
Details: When a device's own check has not passed on a new ARM release, only that device waits on its last good release. Every other ARM device updates as normal.
