---
title: Color
summary: Suno’s color tokens with their light and dark values, the Frost, Glass and high contrast treatments, how to use the accent and tones, and the rule against literal colors.
order: 4
section: Design
---

# Color

Color in a Suno app is **named, never written**. Your stylesheet refers to
tokens such as `@Suno_ink` and `@Suno_accent`; SunoUI defines them for the
current appearance and re-parses your stylesheet when the appearance changes.
Treat a literal hex or `rgba()` color in an app stylesheet as a bug.

```css
/* Good */
.notebook-card-title { color: @Suno_ink; }
.notebook-card-meta  { color: @Suno_muted; }
.notebook-tag        { background: @Suno_accent_soft; color: @Suno_accent_ink; }

/* Wrong: breaks in dark, Frost, Glass and high contrast */
.notebook-card-title { color: #283038; }
```

Load app stylesheets with `add_style_sheet()` (Python) or
`Suno_ui_add_style_resource()` (C) so token changes reach them.

## Tokens

These tokens are defined in every appearance (light, dark, Frost, Glass and high
contrast) and are safe to use.

### Surfaces

| Token | Meaning | Light | Dark |
| --- | --- | --- | --- |
| `@Suno_window` | The window ground, seen in the gutter | `#eceef1` | `#202124` |
| `@Suno_content` | An island’s surface | `#ffffff` | `#25282d` |
| `@Suno_island` | Raised fill inside an island, such as cards | `#ffffff` | white at 3.5% |
| `@Suno_menu` | Menu surface | `#f6f7f8` | `#252a30` |
| `@Suno_menu_raised` | Raised element inside a menu | `#ffffff` | `#30363d` |

### Ink

| Token | Meaning | Light | Dark |
| --- | --- | --- | --- |
| `@Suno_ink` | Text and glyphs | `#14161a` | `#f2f3f5` |
| `@Suno_muted` | Secondary text | `#6c6f73` | `#8d8f93` |
| `@Suno_faint` | Placeholders and disabled text only | `#96989c` | `#616367` |

### Lines and states

In light, these are a dark grey at the opacity shown; in dark, white.

| Token | Meaning | Light | Dark |
| --- | --- | --- | --- |
| `@Suno_line` | Rules, rings and hairlines | 9.5% | 8% |
| `@Suno_line_faint` | Faint dividers | 8% | 6.5% |
| `@Suno_fill` | Quiet fill: segments, inputs, chips | 4% | 3.8% |
| `@Suno_hover` | The pointer’s fill | 6% | 6% |
| `@Suno_selected` | The selected row’s fill | 10.5% | 10.8% |

### Accent and tones

| Token | Meaning | Light | Dark |
| --- | --- | --- | --- |
| `@Suno_accent` | The one accent: focus, selection marks, links, active state | `#527fae` | `#80a8d2` |
| `@Suno_accent_ink` | Accent used as text, with enough contrast | a darker accent, 6.5:1 on white | a lighter accent |
| `@Suno_accent_link` | Link text | same as accent ink | accent mixed 38% toward white |
| `@Suno_accent_soft` | A tinted background behind accent ink | accent at 14% | accent at 20% |
| `@Suno_destructive` | Destructive actions and errors | `#b75048` | `#e97870` |
| `@Suno_blue`, `@Suno_green`, `@Suno_violet`, `@Suno_amber` | Identity and category tones | `#527fae`, `#3b8967`, `#865f9f`, `#a06d34` | `#80a8d2`, `#65b58c`, `#b58bd0`, `#d19447` |

SunoUI’s primary button (`.Suno-button.primary`) is filled with `@Suno_ink`
and labeled in `@Suno_content`, not in the accent. The `@Suno_primary`,
`@Suno_primary_ink` and `@Suno_primary_hover` tokens exist, but SunoUI’s own
controls do not use them.

`@Suno_border`, `@Suno_passive` and `@Suno_pressed` are older aliases of
`@Suno_line`, `@Suno_fill` and `@Suno_selected`. Use the new names.

A few other tokens are defined only in the light set (`@Suno_card`,
`@Suno_chrome`, `@Suno_hairline`, `@Suno_application_ink`). Do not use them;
in dark they keep their light values.

Use the `@Suno_*` tokens rather than GTK’s or libadwaita’s named colors
(`@window_bg_color`, `@accent_color` and so on).

## Appearances

| Appearance | What changes | Your job |
| --- | --- | --- |
| **Light** | The default | Use tokens |
| **Dark** | Every token | Use tokens; check images and illustrations |
| **Frost** | A translucent window ground with a strong blur behind it; islands stay opaque | Nothing, if you use tokens and do not paint your own backgrounds over the window ground |
| **Glass** | A clearer window ground with a lighter blur | Same as Frost |
| **High contrast** | Tokens map to the system’s high contrast window, text and accent colors | Never rely on subtle fills alone to show state |

People choose Frost and Glass in Settings. SunoUI changes the treatment for
you in three cases:

- With **reduce transparency** on, Frost and Glass are painted as light.
- With **high contrast** on, the high contrast colors replace every other
  treatment.
- When the compositor cannot blur, the window keeps its Frost or Glass colors
  with nothing blurred behind it.

SunoUI follows the desktop’s light or dark choice. It also reads the portal’s
`org.freedesktop.appearance` color scheme, so a Suno app on another distribution
follows that system’s light or dark preference.

## Using color well

- **One accent per view.** It marks focus, the current selection and the single
  most important action. Do not use it for decoration.
- **Tones identify, they do not rank.** Use `@Suno_blue`, `@Suno_green`,
  `@Suno_violet` and `@Suno_amber` for categories, calendars, tags and avatars.
  `Avatar` derives a person’s tone from their name so it matches across apps.
- **Destructive color appears at the moment of commitment,** such as on hover of
  a destructive menu row or on a confirm button, not on every delete icon at rest.
- **Never use color alone** to convey meaning. Pair it with a label, icon or
  shape.
- **Contrast:** body text must reach 4.5:1 against its background and large text
  and essential glyphs 3:1. Tokens meet this in their intended pairings (ink on
  content, accent ink on accent soft); check anything else.
- **Document content keeps its own colors.** A photo, a user’s chosen text
  color, a color swatch or a video surround is data, not interface. Drawing it
  with a literal color is correct; say so in a code comment.
