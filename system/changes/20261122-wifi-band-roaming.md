---
type: improvement
component: Networking
packages: [NetworkManager, wpa_supplicant]
---
Summary: Wi-Fi prefers the faster band and holds steady
Details: On routers with several bands, Wi-Fi now prefers 5 GHz or 6 GHz whenever the signal there is good, instead of the stronger but slower 2.4 GHz. It no longer switches bands while a call, stream or download is running on a good connection, stops retrying access points that refused it, and scans less often when the signal is good. A connection that really weakens still moves quickly.
