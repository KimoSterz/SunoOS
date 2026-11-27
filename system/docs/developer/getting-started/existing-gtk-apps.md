---
title: Bringing an existing GTK app
summary: How an unmodified GTK 4 app looks on Suno, how to move it onto SunoUI one step at a time, and what must leave your stylesheet when you do.
order: 6
section: Getting started
---

# Bringing an existing GTK app

You do not have to rewrite a GTK 4 app to run it on Suno. There are two levels,
and you can move from the first to the second one piece at a time.

| Level | What you do | What people see |
| --- | --- | --- |
| **Runs on Suno** | Nothing | Your app’s own GTK look, with standard integration: Suno’s accent color, the Figtree font, the Prairie icons and the person’s light or dark choice |
| **Built on SunoUI** | Use SunoUI’s window, components, commands and adaptive layouts | A Suno app, which can be reviewed for the Suno tier |

## Running unchanged

A GTK app that does not use SunoUI is meant to keep its own look on Suno, with
standard integration only: the Suno accent color, the Figtree interface font,
the Prairie icon theme and dark mode. SunoUI does not restyle it, and nothing
is injected at run time: there is no `GTK_THEME` override, user stylesheet or
wrapper. Some of Suno’s styling still lives in the system GTK and libadwaita
rather than in SunoUI, so for now an unmodified app can show some Suno
styling, and those details can change between Suno releases. Do not design
around them.

Qt, Electron and games keep their own look too.

## Moving onto SunoUI

SunoUI draws the whole visible Suno app: the frame, the title row, the identity
and window controls, the islands and every component. Your app keeps its logic
and its content; you replace the pieces around them.

1. **The window.** Use [`AppWindow`](../kit/appkit-reference.md#appwindow) in
   Python or
   [`SunoApplicationWindow`](../kit/SunoUI-reference.md#Sunoapplicationwindow)
   in C and C++. Both draw the Suno frame and identity and handle presentation;
   `AppWindow` also remembers the window’s size. A C app with an existing `AdwApplicationWindow`
   subclass can call `Suno_application_window_frame_adopt()` first, which gives
   it the Suno frame and keeps its content, actions and template children in
   place.
2. **Islands.** Put each area of work in an island (`Island`, `SunoIsland`)
   inside the window body. See [windows and islands](../kit/windows-and-islands.md).
3. **Components.** Replace hand-built pieces one at a time: the sidebar with
   `NavigationSidebar`, empty panes with `EmptyState`, confirmations with
   `DestructiveDialog`, notices with `Toast`, and fixed layouts with a split view
   and breakpoints. The [Python reference](../kit/appkit-reference.md) and
   [SunoUI for C](../kit/SunoUI-c.md) list every component.
4. **Commands.** In Python, move your actions into a `CommandRegistry`, so the
   identity menu, context menus, shortcuts and buttons share one list. See
   [commands and menus](../kit/commands-and-menus.md).

### Give the identity a real menu

The identity menu is your app’s best home for app-wide commands. In Python it is
built from the `CommandRegistry` you pass to `AppWindow`. In C, build a
`GMenu` whose items target your `app.` actions and pass it to
`Suno_application_window_set_menu_model()`.

## What must leave your stylesheet

When your app moves onto SunoUI, remove everything SunoUI already owns:

- rules for `windowcontrols`, `headerbar`, `.Suno-titlebar` or `.Suno-identity-*`;
- radius, ring, shadow, margin or padding on `.Suno-window-body`,
  `.Suno-island` or `.Suno-pane`;
- a `border-radius` on the window, or a `box-shadow` on an island;
- any `@define-color`;
- any literal hex or `rgba()` color. Use the [color tokens](../design/color.md).
