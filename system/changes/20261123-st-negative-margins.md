---
type: fix
component: Desktop
packages: [gnome-shell, gnome-shell-common]
highlight: false
---
Summary: Panels no longer collapse to nothing
Details: A shell panel whose style had a negative margin could lay out at zero width and show its text as dots. Negative margins and padding are now treated as 0.
