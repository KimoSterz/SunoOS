---
title: Motion
summary: SunoUI’s motion tokens and easing, what should and should not animate, and how to honor reduced motion.
order: 7
section: Design
---

# Motion

Motion in Suno explains a change: where something came from, where it went, or
that work is happening. It is never decoration.

## Durations

SunoUI’s parts use these motion tokens. Your own animations should use the one
that matches what is moving. In CSS, read them as `var(--SunoUI-duration-…)`.

| Token | Duration | Use |
| --- | --- | --- |
| `--SunoUI-duration-hover` | 120ms | Hover feedback |
| `--SunoUI-duration-press` | 150ms | Pressed feedback |
| `--SunoUI-duration-dialog-fade` | 160ms | A dialog fading in or out |
| `--SunoUI-duration-fade` | 200ms | Crossfades, showing and hiding |
| `--SunoUI-duration-scrim` | 200ms | The dimmed layer behind a dialog or drawer |
| `--SunoUI-duration-drawer` | 260ms | A drawer rising from the bottom edge |
| `--SunoUI-duration-morph` | 300ms | A control changing shape |
| `--SunoUI-duration-toast-in` | 300ms | A toast arriving |
| `--SunoUI-duration-grow` | 320ms | Something growing into place |
| `--SunoUI-duration-dialog-move` | 360ms | A dialog moving into place |

Progress that follows real work, such as the install ring in
`TransactionCard`, animates over 450ms to smooth out updates.

Keep interface motion under 400ms. Nothing should make a person wait for an
animation to finish before they can act.

## Easing

SunoUI has two curves:

- `--SunoUI-ease`, `cubic-bezier(0.3, 0.7, 0.2, 1)`: starts quickly and
  settles. SunoUI uses it for scrims, drawers and shape changes.
- `--SunoUI-spring`, `cubic-bezier(0.3, 1.3, 0.5, 1)`: overshoots slightly.
  SunoUI uses it when something moves or scales into place, such as a dialog,
  a toast or a pressed button.

Opacity changes on their own use plain `ease`.

Prefer the motion SunoUI parts already have (drawers, toasts, dialogs, the
details pane) and GTK’s own transitions (`GtkStack` crossfade, `GtkRevealer`).
See [SunoUI behaviour](../kit/behaviour.md).

## What should animate

- Navigation between pages, so people keep their place.
- Panels and sheets appearing and disappearing.
- Progress for work that takes more than about a second.
- Direct manipulation: dragging, resizing, reordering.

## What should not

- Content that is loading instantly. Show it.
- Attention-seeking loops, bouncing badges and pulsing buttons.
- Parallax, background motion and decorative transitions.
- Text scrolling on its own.

## Reduced motion

People can reduce animation in Settings under Accessibility. GTK then reports
it, and its own transitions stop. Your custom animations must follow.

Python: `reduced_motion()` is true when animations are off or reduced motion is
on. `motion_duration()` returns `0` when animations are off.

```python
from Suno_appkit import motion_duration, reduced_motion

revealer.set_transition_type(
    Gtk.RevealerTransitionType.CROSSFADE if reduced_motion()
    else Gtk.RevealerTransitionType.SLIDE_DOWN)
revealer.set_transition_duration(motion_duration(200))
```

C: `Suno_ui_reduced_motion()` answers the same question.

```c
gboolean reduced = Suno_ui_reduced_motion ();
gtk_revealer_set_transition_type (revealer, reduced
    ? GTK_REVEALER_TRANSITION_TYPE_CROSSFADE
    : GTK_REVEALER_TRANSITION_TYPE_SLIDE_DOWN);
```

With reduced motion, replace movement with an instant change or a short
crossfade (SunoUI uses 150ms, `--SunoUI-duration-reduced-fade`). For
indeterminate progress, prefer a static indicator with a text label, as
`TransactionCard` does: its ring stops turning when animations are off.
