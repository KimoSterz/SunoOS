---
title: Adaptive layouts
summary: How one Suno app adapts from a 360px phone to a wide desktop using width breakpoints, SunoUI's width tiers, presentation mode and input mode, with the required test widths and common patterns.
order: 7
section: Kit
---

# Adaptive layouts

A Suno app is one app on every screen. The same binary runs in a desktop window,
fullscreen on a tablet, and fullscreen on a phone. Three independent signals
decide how it looks:

| Signal | Decides | Read it from | Never use it to |
| --- | --- | --- | --- |
| **Available width** | Layout: how many panes, what collapses | `Adw.Breakpoint` conditions on the window or a breakpoint bin | Guess the device |
| **Presentation mode** | Chrome: whether there is a title row and window frame | `AppContext.presentation` / `Suno_context_get_presentation()` | Choose a layout |
| **Input mode** | Targets and affordances: touch sizes, hover-only hints | `AppContext.input_mode` / `Suno_context_get_touch_targets()` | Choose a layout |

A narrow desktop window gets the phone layout with a title row and pointer
targets. A tablet held landscape gets the desktop layout without a title row and
with touch targets. Both are correct.

## Test widths

Your app must work at these logical widths, which `Suno-app.toml` declares and
`Suno lint` checks:

| Width | Represents | Minimum height to test |
| --- | --- | --- |
| **360** | A phone in portrait | 294 (the SDK’s compact minimum), and a tall phone such as 360 by 800 |
| **500** | A large phone, or a narrow window | 800 |
| **1024** | A tablet in landscape, or a laptop window | 600 |
| Your widest | A full desktop window, such as 1440 or 1920 | Your default height |

Set `minimum_width=360, minimum_height=294` on `AppWindow` (its defaults are 460
by 380), or `gtk_widget_set_size_request(window, 360, 294)` in C.

## Breakpoints

Use breakpoints (`Adw.Breakpoint`, one of the non-visual helpers SunoUI builds
on). They re-evaluate as the window resizes, and they work the same in a window
and fullscreen.

```python
compact = Adw.Breakpoint.new(Adw.BreakpointCondition.parse("max-width: 600sp"))
compact.add_setter(self.split, "collapsed", True)
self.add_breakpoint(compact)          # AppWindow is an Adw.ApplicationWindow
```

Guidelines:

- Prefer **`sp`** units so layouts respond to the person’s text size. Use `px`
  for measurements tied to fixed artwork.
- Use **two or three breakpoints** at most: typically one to drop a secondary
  pane on a medium window, and one to collapse to a single page.
- SunoUI’s own parts change shape at two widths: **phone** below 560px,
  **compact** from 560 to 900px, and **regular** above that. In Python,
  `AppWindow.tier` returns `"phone"`, `"compact"` or `"regular"`, and the window
  carries a matching `SunoUI-phone`, `SunoUI-compact` or `SunoUI-regular` class.
  In C, `Suno_ui_get_tier()` and `Suno_ui_tier_for_width()` give the same answer.
  The Python constant is `Suno_appkit.SunoUI_tokens.PHONE_MAX_WIDTH` (559).
- `SunoAdaptiveScaffold` in C collapses at `max-width: 559px` by default; move
  it with `Suno_adaptive_scaffold_set_compact_width()`.

## Patterns

### Sidebar and content

Wide: the sidebar and the content island side by side. Narrow: a navigation
stack with the sidebar as the first page and a back button to return.

- Python: `IslandSplitView` with a breakpoint setting `collapsed`.
- C: `SunoAdaptiveScaffold`; call `_set_show_content(TRUE)` when the person
  picks something.

When collapsed, selecting a sidebar row must show the content page
(`split.set_show_content(True)`), and back must return to the list.

### Three panes

Wide: navigation, content and inspector. Medium: hide the inspector behind a
toggle or show it as an overlay. Narrow: navigation stack for navigation and
content, with the inspector as a bottom drawer or a pushed page.

### Transport and tabs

A media app can keep a full-width transport island at the bottom on wide
windows, and on compact widths replace the sidebar, queue and transport with a
mini player and bottom tabs. Every function stays reachable.

### Welcome and editor

Creative apps often open to a welcome surface and switch to an editor. Give the
welcome surface its own remembered size with
`AppWindow.set_geometry_scope("welcome", default_width=900, default_height=560)`,
so opening a project does not inherit a small welcome window.

## Presentation mode

In `windowed` presentation SunoUI draws the frame and title row. In
`fullscreen-mobile` the window is undecorated, the title row is hidden, and the
shell provides the system chrome.

What your app does differently when fullscreen:

- Show a page header inside your content, such as `MobileHeader` in Python.
- Move identity menu commands somewhere reachable, such as an overflow button in
  the page header, because the identity is not shown.
- Let the shell size the window. Do not call `fullscreen()` or size the window to
  the screen yourself when the presentation is already fullscreen.

```python
if self.context.presentation is PresentationMode.FULLSCREEN:
    header = MobileHeader("All notes", context=self.context,
                          trailing_icon="view-more-symbolic")
    header.trailing.connect("clicked",
        lambda button: command_popover(self.commands).present_for(button))
    page_box.prepend(header)
```

## Input mode

With touch input:

- Make interactive targets at least **44 by 44 px**. SunoUI components that support
  it switch automatically (`ColorSwatch`, compact `ConnectedButtonGroup`), and
  `SunoApplicationWindow` adds the `Suno-touch` class to the window for your own
  styles.
- Nothing may depend on hover. Show on focus or tap anything you reveal on hover.
- Every secondary-click menu must also open by long press;
  `attach_context_menu` does this for you.
- Drag handles and sliders need generous hit areas.

With pointer input, use the control sizes and hover states SunoUI provides.

Keyboard is always available on every presentation: every function must be
reachable and operable from the keyboard, with a visible focus indicator.

## Testing presentations on a desktop

```sh
# Phone presentation with touch targets
SUNO_PRESENTATION_MODE=fullscreen-mobile SUNO_INPUT_MODE=touch python3 src/main.py

# Tablet: fullscreen, touch
SUNO_DEVICE_CLASS=tablet SUNO_PRESENTATION_MODE=fullscreen-mobile python3 src/main.py

# GTK Inspector for sizes and accessibility
GTK_DEBUG=interactive python3 src/main.py
```

> **Known difference in 0.1.0.** With `SUNO_DEVICE_CLASS=tablet` and no
> `SUNO_INPUT_MODE`, the Python `AppContext` chooses touch input while the C
> `SunoContext` chooses pointer. Set `SUNO_INPUT_MODE` explicitly when testing
> tablets.

## Checklist

- [ ] Works at 360, 500, 1024 and your widest width, in both orientations where it
      applies.
- [ ] No function is missing at any width; compact layouts move actions rather
      than drop them.
- [ ] Layout decisions use width only.
- [ ] Fullscreen presentation has page headers and a reachable home for identity
      menu commands.
- [ ] Touch targets are 44px; nothing depends on hover.
- [ ] Long translated labels wrap or ellipsize without clipping; test with
      German or Finnish strings and a right-to-left language.
- [ ] Large text (the text scaling setting) does not clip or overlap.
