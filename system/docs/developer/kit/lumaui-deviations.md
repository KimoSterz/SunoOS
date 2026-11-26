# LumaUI conformance deviations

This documents the existing exceptions in
[`accepted-deviations.json`](../../../tools/lumaui-conform/accepted-deviations.json).
The registry is authoritative for match conditions and limits. These exceptions
record implementation constraints and pending decisions; they do not authorize
new differences or establish that pending features have shipped.

When changing an exception, update both the registry and this document. Keep
matching narrow, retain explicit bounds where present, and remove a temporary
exception when its underlying limitation is resolved.

An exception with `"phone": true` (or `false`) applies only to the phone (or the
computer) captures of its app.

## no-backdrop-blur

GTK has no backdrop-filter; the kit paints a denser token surface, so the sampled surface colour differs a little.

## named-hues

No runtime oklch(): avatars and the hero wash use the five category hues, not the person's exact hue.

## hero-field-30

In edit mode the name field stays 30/700 (hero role) instead of v70's 26 px input.

## no-corner-shape

GTK has no corner-shape: round; plain radii stand in.

## pending-block

Nick hasn't decided whether Block ships; the more menu leaves it out until he does.

## pending-video-calling

There is no Luma calling service yet, so the Video tile stays disabled where v70 shows it enabled.

## pending-block-offset

With Block left out, the rows below it in the more menu sit one row (36 px) higher.

## whole-pixel-lines-cards

GTK allocates whole pixels; v70's 1.45 line boxes and rows are fractional (49.525, 16.675), so rows drift by up to half a pixel each. The tokens round so a card's or list's first and last rows stay close; what is left is at most 3 px.

## whole-pixel-lines-sidebar

GTK allocates whole pixels; v70's 1.45 line boxes and rows are fractional (49.525, 16.675), so rows drift by up to half a pixel each. The tokens round so a card's or list's first and last rows stay close; what is left is at most 3 px.

## lcd-system-mono

v70's LCD asks for var(--mono, ui-monospace); outside Terminal --mono is unset (the LCD, hex colour codes), so Chromium draws the Mac's ui-monospace. Luma's system monospace is IBM Plex Mono (v70 line 745, TY1 mono), which the kit uses.

## system-mono-face

v70 asks for ui-monospace, the Mac's system monospace; Chromium resolves it to a platform face. Luma's system monospace is IBM Plex Mono (v70 line 745, TY1 mono), which the kit's mono role draws. Only that pair is accepted: a mono spec face against IBM Plex Mono.

## system-mono-metrics

The same texts as system-mono-face: IBM Plex Mono's advance differs from the face Chromium draws for ui-monospace, so a mono value's width, and what follows it on its line, differ by that much. Settings' values only.

## glyph-fallback-family

A character Figtree lacks (U+23CE ⏎) falls back on both sides; the spec reports the CSS family, GTK the face that drew it.

## rating-stars-fallback

Figtree has no stars (U+2605 ★, U+2606 ☆). Depot's TV app page draws a rating as five of them; both sides draw them from a fallback face, the spec reports Figtree, GTK the face that drew them, and that face's advances make the run a few px wider. Only that run, on tv-depot.

## nb-hyphen-fallback

Figtree has no non-breaking hyphen (U+2011, v70's "Wi‑Fi"); Pango draws it from the next face in the stack and Chromium from its own fallback, whose advances differ by a few px. The rest of the string is Figtree on both sides.

## pending-identity-menu

Pending Nick: v70's identity is plain header content (no role) in Contacts; the kit's is the app menu's button.

## identity-name-advance

Pango lays Figtree 600 about 5 px narrower than Chromium; the chevron after the name moves with it.

## frost-backdrop

The Frost frame's blur is the compositor's; a headless capture has neither blur nor wallpaper behind it.

## whole-pixel-lines-text-buttons

GTK gives each text button a whole-pixel width (its label's ceil); a row of them (a mode switch) and the bar holding only it grow by up to 1 px a button.

## pending-reading-serif

v70 names Newsreader/Literata for cover art and reading surfaces; neither font is available yet (Nick's decision pending), so both sides fall back to a system serif.

## frost-backdrop-ink

The Frost frame's ink is translucent (v70 rgba(242,243,246,.84)); it composites over the blurred wallpaper in v70 and over nothing in a headless capture.

## frost-backdrop-ink-title

The Frost frame's ink is translucent (v70 rgba(242,243,246,.84)); it composites over the blurred wallpaper in v70 and over nothing in a headless capture.

## calc-linux-shortcut-spec

The v70 macOS glyphs are represented by working Ctrl+1 and Ctrl+2 accelerators with visible Linux Ctrl keycaps.

## calc-linux-shortcut-gtk

The visible Ctrl keycaps describe the actual Linux accelerators for Basic and Scientific.

## calc-linux-shortcut-digit

The 1 and 2 keycaps complete the visible Ctrl+1 and Ctrl+2 Linux shortcuts on their respective menu rows.

## hinted-figtree-advance

The device hints Figtree (Nick's setting, the real one): GTK rounds each glyph's advance to whole pixels where Chromium keeps fractions, so a run comes out up to about 3% wider. Text-run width only, Figtree runs only; never boxes, positions of other parts, size or weight.

## hinted-figtree-anchor

The same hinted advances: an end-aligned Figtree run keeps its right edge, so its start moves by exactly its own width difference (up to 3%) and nowhere else. Only that shift of that text; never other parts.

## hinted-figtree-label-small

Ruled 2 November 2026. The field label (the label role, 11.5 px semibold) is a fractional size; the hinted Figtree advances of a short run at that size come out more than the 3% of hinted-figtree-advance wider: the saved-passwords phone sheet's "Password" is 53.3 px in GTK against 51.2 in the mockup (4.1%). The token stays 11.5 px (the label and caption roles share it). That label's text-run width only, up to 5%; never boxes, positions, size or weight.

## pending-nb-hyphen-line

PENDING google-figtree-fonts 1.luma.4 (U+2010/U+2011 mapped to Figtree's hyphen). Until it ships, a line holding U+2011 draws its fallback face's taller line box, 1 px, and what follows on Settings' Wi‑Fi pages sits up to 2.5 px lower. Remove when the font is on the ThinkPad.

## placeholder-ink-dark

v70 leaves some inputs on Chromium's placeholder grey #757575, 3.8:1 on the dark well; the coordinator ruled an AA dark value, so @luma_placeholder_ink is #85878b in dark. Only that pair.

## tv-page-edge-fade

A TV page's scroll edge fades are longer and eased (about 48 at the top, 128 at the bottom, only where the page continues), Nick's ruling of 1 November 2026 over the mockup's 12/40 linear mask. A glyph in the bottom strip (from y 952 at 1080) stands on a differently faded ground, so its sampled colour differs by up to ΔE 8. Glyph colour only, in that strip; never positions, sizes or other parts.

## figtree-axis-floor-250

v71 draws Memos' recording clock (`.metime.big`) at weight 250. Figtree's `wght` axis runs from 300, so Chromium and GTK both draw the 300 instance; the spec's computed style still reports 250. Memos only, a time of the form m:ss, font weight 250 against 300; never size, width or position.

## First-boot setup (first-boot-*)

The first-boot sheet departs from the Design Center mockup where the one-session redesign was approved, and where the spec capture reads something the design does not draw:

- `first-boot-accessibility`: the head's Accessibility button (screen reader, larger text, zoom), asked for in the design handoff but not drawn.
- `first-boot-wordmark`: the Luma mark is the luma-logos wordmark icon, not a painted box.
- `first-boot-one-session-key`: Name this Luma's key is Continue, not Finish; Make it yours, Luma Connect and Add apps follow in the same sheet, and the last page's key is "Start using Luma".
- `first-boot-placeholder-weight`: placeholders are 450 in the design (`input::placeholder`); the spec capture reports the input's 500.
- `first-boot-first-focus`: each page focuses its first field as it opens, so that field shows its focus ring; the mockup's pages open unfocused.
- `first-boot-photo-button`: the photo button is exactly its avatar, so the avatar's gradient and ring are also reported under the button.
- `first-boot-password-bullets`: the spec capture measures a password value's letters; both sides draw bullets.

## Depot redesign (depot-*)

Depot (`depot-redesign`) against the Design Center mockup:

- `depot-your-apps`: the sidebar's foot holds "Your apps" (the developer portal, code-xml) for everyone; the mockup predates it and has no foot.
- `depot-identity-chevron`: the mockup's Depot title row drops the app menu's chevron; the kit's identity keeps the app menu every window has.
- `depot-identity-sidebar-button`: the same row, so the sidebar button sits after the chevron, up to 23 px further right.
- `depot-95-tahoma`: the 95 theme's specimen asks for Tahoma, then MS Sans Serif; neither is installed, so both sides draw the sans-serif fallback and the spec reports the family it asked for.
- `depot-story-photo-capture`: the capture's Design Center copy lacks `social-luma/photos`, so the spec's Today story is its gradient alone, while Depot and the Design Center draw the blurred photo on it. Surface colour of the story and its app strip only, on Today. `conform-serve.sh` copies the photos; remove this once the service is reinstalled.
- `depot-specimen-panel`: FramedPicture draws a specimen's panel (round clip and drop shadow) in its own snapshot at the specimen's box, so the capture gives them to the Off and On panel itself; the mockup draws them on its parent at the same box. Radius and shadow of that panel only.
- `depot-float-back-blur`: `no-backdrop-blur` for the item page's floating Back key over a picture, up to ΔE 5.

## Settings Display over other apps (overlay-perms-*)

- overlay-perms-lone-row: the list's Not allowed group holds one row. GTK clips that row with its group's 16 px corners and the comparator gives the clip, and the standard Settings group's filled well behind it, to the row; the reference's row is transparent over a hairline card. The two-row Allowed group draws the same way and is not reported.
- overlay-perms-hero-wash: the reference is the page alone on a plain stage; Settings draws Apps' page wash (hue 300) behind the page, and in light the app hero's translucent well and its Open key take a little of it (up to ΔE 5).

## Charlie's phone (charlie-*, phone-no-key-hints)

- charlie-island-one-control: v71 draws the list's title island (☰ | the mailbox) as one `<button>`, the island itself. LumaUI's TitleIsland draws the same island with ☰ a presentation square merged into the title button (one control for the keyboard and screen readers), so the measured control starts after ☰ and the island's surface (fill, 16 radius, shadow) is the island's. v71 draws ☰ and the grown island's ✕ in ways the capture does not read as glyphs. Nothing on screen differs. Phone captures of list, unread and mailboxes only.
- charlie-older-date: v71 writes every older day as a weekday; Charlie writes the date once a message is more than a week old ("Sep 19" where v71 says "Sat"). The scenario's text_aliases pair the words; only their width and the end-aligned start differ.
- phone-no-key-hints: ruled 1 October 2026, no keyboard hints on a phone. v71's phone composer still shows "⌘ Return"; LumaUI's composer keeps its 36 keys on a phone (ActionEditor keep_hint) and drops the hint. Phone captures only (deviation key `phone`).
- charlie-placeholder-pseudo: v71 draws the composer's placeholder as the editor's ::before content; the capture reports it as the editable element's text, with that element's box and ink. LumaUI draws it where v71 shows it, 16 in and in ink-3.
- charlie-account-heading-bleed: in the mailboxes grown from the title island, v71 runs an account's heading 10 px past the panel on each side and the panel clips it; LumaUI's heading and hairline span the panel itself, so the measured box is 8 px narrower.
- charlie-new-email-title: v71's New email composer names itself with plain words in its header; LumaUI's ActionEditor draws its title as the mode chip (a button that takes no focus or taps with one mode), which the comparator pairs with v71's header.
- charlie-info-rows: v71's Information lists its people as plain rows; LumaUI's DetailsRow is one control each (name and address), for the keyboard and screen readers.
- charlie-photo-clip: v71 rounds a lone photo with its grid's 18 px clip (the photo inside is square); GTK clips the grid the same at the same box, and the comparator gives that clip to the photo.
- charlie-open-key-wrap: v71's phone bar wraps its items (.crphbar flex-wrap) and, with a file picked, the Open key's glyph lands over its word: that bar is 8 px taller and its keys sit 4 px higher. LumaUI keeps the key on one line, as every other bar key.

## Connect Sync (connect-sync-*)

The shell's banners, status popover and approval card (`connect-sync-banner*`, `connect-sync-status`, `connect-sync-approve*`, pixel mode) are scored as the app-perms offer (ruling, design-center b118c1d): Lucide glyphs count as text and stay out of fill heat, since Chromium and librsvg anti-alias a 1.5 px stroke differently, and the mean leaves out text.

Luma account › Sync's sheets (`settings-connect-sync-sheet`) against design-center 38858a5 `mockups/connect-sync/sheet.html`:

- `connect-sync-caret`: the reference draws the recovery key field's caret as a "|" character; GTK draws a real caret. The enter state's one "|" only.
- `connect-sync-card-names`: the reference's rows are plain divs, so What syncs' and App data's cards are named after their first row, which in Settings is a switch with that name; the comparator pairs the card with the row. Size and place only, those cards (What syncs is named for its Off row when scrolled).
- `connect-sync-restore-artwork`: Valet's restore list (`valet-restore`) draws Kiln's own artwork where the reference draws a placeholder tile, and a placeholder where the reference draws Recipe Box's app-window glyph; one app icon is reported missing and one extra.
- `connect-sync-insensitive-key`: review 1 ruling: a key button that can't be pressed yet (Continue, Turn on Sync, Join, the new key's Done) uses LumaUI's insensitive style, which is canonical; the reference dims the key's fill and label. Fill and label colour only, those four buttons.
- `connect-sync-lumaui-buttons`: review 1: LumaUI's controls are canonical. The sheet's buttons are LumaUI's key and fill buttons (12 px corners, LumaUI padding and fill) where the reference draws the kit's .bt (10 px corners); corners, up to 4 px of width, fill, and a right-aligned button's place by that width.
- `connect-sync-sheet-material`: review 1: Settings' material is canonical. The sheet is LumaUI's dialog surface, lighter than the reference's in dark, so the step tiles and device chips on it are lighter by as much. Their fill colour only.
- `connect-sync-page-material`: review 1: Settings' material is canonical; the reference draws the Sync pages flat with its own card fill. Card fill, and the tiles and tags on the cards, only.
- `connect-sync-switch-rows`: the reference's switch and navigation rows are plain divs; in Settings they are switches and buttons named for the row. Those extra controls only.
- `connect-sync-whole-pixel-rows`: the reference's two-line rows are 53.7 px; Settings' are 54, so rows drift 0.3 px each, at most 4.5 px.
- `connect-sync-clipped-card`: on the new-key page's lower state the window's top edge cuts What syncs (that page has no storage bar to scroll past); the reference measures the card whole and Settings only its visible part, so the visible rows' offsets inside it differ by the hidden height. Those rows' places, newkey-lower only.
- `connect-sync-newkey-rewrap`: on a phone the new key's paragraph just fills its second line in the reference (356.5 of 360 px); hinted Figtree carries its last word to a third line. That paragraph's width, the new-key states only.
- `connect-sync-mono-code`: the join code in IBM Plex Mono is about 2 px narrower per half than in the reference's ui-monospace (`system-mono-face`); the wells' width and the second half's start, join and wait states only.
- `banner-button-width-follows-label` (pixel): the 22 Nov ruling as layer permissions' TV offer: a banner button's width follows its label's advance (Pango against Chromium, ≤1 px). On the phone card Sign in again's edges come out a little over 5%; the edge limit is 7% there.
- `connect-sync-tick-role`: the reference's tick is a span with no role; Settings' is a check box. That one extra check box (the recovery key and the new recovery key).
- `connect-sync-mono-wrap`: the recovery key field's IBM Plex Mono is wider than the reference's ui-monospace (`system-mono-face`), so the 18 pasted words wrap differently: four lines instead of three on a phone, and a field up to 3 px taller with its text 3 px higher. That field and its text only.

### Layer permissions status cell (Shell, pixel mode)

`island-fill-shell-material` and `cell-text-aa` (`overlay-indicator`, states `cell-*`): the status island's fill is the Shell's own island material, so the cell is compared over its own pixels only (its icons and rings, the stack, the +N square); the antialiasing of the 16 px icons, the whole-pixel rings and the 9 px +N is accepted while the mean ΔE over those pixels stays at or under 3. Layer permissions design review 1.

### Translucent shell material (layer permissions)

`translucent-shell-material` (`overlay-offer-tv`) and `translucent-shell-material-tv-popover` (`overlay-indicator-tv`): the Shell's translucent material is canonical. The standard banner's surface, its button fills (white at 10% over the banner) and the badge ring are that material, so the TV offer is compared over the icon and badge art, the text and the button labels (the desktop and phone offer use the Connect Sync banner's keep-surface material: the banner surface is material with the tile kept as art, and edges are judged by which material each image shows; the badge ring is material up to its inner corner, `ring_radius` 5, so the ring colour that shows inside the badge's rounded corners is left out with the ring); the TV popover over the wallpaper is compared over its content (icons, text, buttons). The popover rows' app icons are art, left out of every score (`exclude_groups: artwork`), as on the mixer. On TV the banner's content-width actions follow their labels' advance (Pango vs Chromium, the desktop "Not now about 1 px wider" ruling at x1.5), so `banner-button-width-follows-label-tv` allows 7% of their edges over ΔE 10. Shell surfaces are judged by the shell rule of layer permissions review 3: mean ΔE ≤ 4.0 and no heat on fills (surfaces, wells, chips, icons, buttons), text and 1–2 px rims being edges (`scenario.pixel.fills`, `max_fill_over10` 0.5%).

## Shell banner text

- continue-banner-text-wrap: the Continue banner's body is set by Pango in the shell and by Chromium in the reference, and the two break and antialias it differently. At the 314 px line Chromium carries "2 apps" of the partial result to its second line, where the shell keeps it on the first, and the continued notice's dark-on-light text differs by its antialiasing alone. Conform lets these two light states' fill heat reach 0.75 %; their mean ΔE and every other state, light and dark, are judged as built.

## App permissions (ADR-052 step 3)

Pixel mode at 2x (`spec.scale`) against design-center `mockups/app-perms` (review 3: 2659aed; the banner at 42e7cbf); VM captures at 2x with `LUMA_MUTTER_ALLOW_SOFTWARE_BLUR=1`. App artwork (Valet's and Settings' tiles, the offer's tile) is left out of every score (`exclude_groups`). Text and glyph strokes (Lucide at LumaUI's 1.6) count as text: heat there is allowed and the verdict's mean leaves them out (`glyphs_as_text`, `mean_without_text`).
- valet-keeps-its-header: spec section 1 keeps Valet's header and its main column's surface (the recessed card under the app's lit header wash); the reference draws its own header on a flat window fill, replaced in the comparison by Valet's measured surface. The sheet is compared over its blocks.
- lumaui-controls-canonical: LumaUI's real controls are canonical (the radio dot's accent, the switch, button rims); their pixels are left out of the fill-heat check (`fill_exclude`), the mean still counts them.
- shell-banner-as-built: the Shell banner's placement, type, badge and Not now width are accepted as built; its buttons are left out of the fill-heat check.
- settings-page-wash: the page's top hue wash is Settings' own material; Settings is compared over its content, and the wash's band (the island's top 300 px) is left out.
- shell-banner-as-built / material masks: the banner's surface, button fills and badge ring are translucent material and masked; text, the tile and badge art and the buttons' geometry count.
- tv-tile-edge-and-not-now-box: at x1.5 the tile's sub-pixel edge ring is a rim; Not now's slightly wider box and its focus ring are edges.
- phone-lip-buttons-over-the-home: on a phone the lip shows the home's widgets through the buttons' rims; their boxes are checked by position, not edge colour.
- settings-card-rim-slip: light Settings' all-files card's bottom rim after a 1 px slip is an edge.
- translucent-shell-material-folder-offer: the folder offer is the Shell's standard banner, whose material shows what is behind it; compared over its content (tile and badge, words, buttons). The Shell's banner metrics are canonical (layer-permissions review).

## Settings Volume mixer (mixer-*)

Settings › Sound › Volume mixer (`settings-volume-mixer`) against the Design Center reference page:

- `mixer-group-wells`, `-chip`: Playing now and Other sounds are the standard Settings group, a filled well, where the reference draws hairline cards on the page; a row's plain output picker is its fill over that well.
- `mixer-tiles-taller`, `-below`: the output tiles are the Sound page's own, about 2 px taller than the reference's; the hero is that much taller and what follows sits up to 4 px lower.
- `sound-page-system-accent`, `sound-page-standard-slider`: accepted as built in design review 1 (21 Nov): Quick Options' Sound page takes the system accent and the Shell's standard slider. The page is compared in pixel mode, which applies no deviation list; these record the review's decision.
- `media-row-pause-glyph`: the reference's compact pause glyph is two CSS bars the spec capture does not list as an icon; the row draws `lumaui-pause-filled` there.
- `media-row-panel-chip`: the compact and touch play key is the toolkit's raised chip (`@luma_chip`); the reference's sheet uses the Shell's own sheet chip, a slightly darker grey.
