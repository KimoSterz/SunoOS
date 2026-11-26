# Viola Linux changes

## 2026-11-24

- Find on page in the page bar. Ctrl+F, or Find on page in the browser menu
  (the phone's ⋯ panel), turns the bar's row into the find field: the query,
  the engine's match count at its end ("2 of 4", "No matches"), Previous,
  Next and Close. It searches as you type; Enter and Shift+Enter step and
  wrap; Esc or Close clears the highlights and gives the page its focus back.
  A click into the page keeps it open; another tab, page or reload closes it.
  Engine patch 0010 puts the overlay's find channels into the bridge's
  implemented contract. The active match is scrolled clear of the page bar
  (on TV, into the middle of the screen); engine patch 0011 adds the match's
  rect to find:result. Host release native54, engines native52 (x86) and
  native53 (ARM).
- A channel the engine's bridge refuses (an engine without it) no longer stops
  the host: that one feature reports itself unavailable.
- The launcher opens the installer's repair window, named for the problem,
  when the signed installation needs repair.

## 2026-11-21

- Two open windows no longer rewrite each other's active tab in the shared
  workspace at frame rate (engine patch 0009); each pass also pushed a new
  sidebar state to every window. The engine sends a sidebar state only when it
  differs from the last one sent. Host release native48.

## 2026-11-20

- An idle window no longer redraws its chrome dozens of times per second. The
  sidebar publishes a state only when it differs from the last one, and sends
  a media stop only after an offer. The host drops a state equal to the last
  rendered one, renders the newest state at most once per frame from a single
  pending callback, and leaves the address text, pin button and connection
  icon alone when their values have not changed. A stop with nothing
  previewing no longer clears the preview.

## 2026-11-02

- The address bar handle shows only while the bar is hidden. It is drawn as a
  notch of the window's bottom frame: the frame's colour, inverted corners and
  no outline. Hiding the bar sinks it into the handle; revealing it rises back
  out. With animations disabled both happen at once.
- Sign-in no longer stalls at a passkey step. Chromium's passkey dialog is drawn
  on the hidden engine display, so the engine no longer advertises WebAuthn
  (`PublicKeyCredential` is undefined) and sites offer their other methods.
  Real passkey support returns when the host draws that dialog.

## 2026-10-08

- Restored the shared floating page toolbar, sidebar surfaces, address suggestions,
  downloads, sharing and Mini controls from the qualified native application.
  Native release 36 and independent app version 0.2.10.36 include the current
  pointer-and-rings artwork.
- Retained the Chromium engine, signed host service, application identity and
  profile paths. Added a regression covering bookmark and committed SQLite
  history preservation, including later changes inside the app profile.
