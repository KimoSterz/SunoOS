<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Settings › Apps › Background Activity render

Renders `patches/gnome-control-center/0014-Suno-background-activity-page.patch`
with the pinned Suno toolkit (gtk4 `1.Suno.17.preview1`, libadwaita
`1.Suno.45.preview20260914`, platform `1.Suno.64`, Figtree, Prairie icons) and
the candidate `gnome-control-center-50.4-1.Suno.15.preview20260915.1`, in Xvfb
inside a disposable Fedora 44 container.

- `fake_agents.py` serves `org.projectSuno.Background1` with five agents in
  every state the page draws: Always On and running, waiting, an essential app
  turned off, and one paused for Power Saver.
- `session.sh` starts a system bus, Xvfb, the fake service and
  `gnome-control-center applications`.

Drive it with `xdotool` inside the container (`DISPLAY=:77`): click the
Background Activity row, expand a row, flip an essential app's switch (the
confirmation appears), confirm, and turn on Show Only Running; capture each
state with `import -window root`. AT-SPI was not usable in the container, so
the clicks are coordinate-based and must be re-aimed if the layout changes.
