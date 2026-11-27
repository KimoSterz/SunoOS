---
title: Open in Depot links and badges
summary: Link to an app from a website or README with its web listing, Suno-depot:// and appstream:// links, or its .flatpakref file, how the Get button behaves on Suno and elsewhere, and what to use until badge artwork exists.
order: 9
section: Publishing
---

# Open in Depot links and badges

Send people from your website, README or release announcement straight to your
app in Depot.

> **Status.** `Suno-depot://` and `appstream://` links work in Depot on Suno
> today, and `.flatpakref` files are served from the Suno remote. The web
> listings at `simplyluma.com/apps` are offline for now; until they return, use
> a `Suno-depot://` link or the `.flatpakref` file. Official
> badge artwork is not available yet. Your own app gets a listing once the
> [developer program](developer-program.md) opens.

## The best link: your web listing

For almost every case, link to your app’s web page:

```text
https://simplyluma.com/apps/<slug>
```

For example, Calendar is at `https://simplyluma.com/apps/calendar`. The page works
for everyone. Its **Get** button:

- **on Suno** opens the app’s page in Depot;
- **anywhere else** opens a sheet that offers to get Suno and, when the app has
  a Flatpak on the Suno remote or on Flathub, shows the command to install it on
  the current system.

The page decides it is on Suno from the `Suno` token in the browser’s user
agent.

## `Suno-depot://` links

On Suno, Depot handles the `Suno-depot://` scheme
(`x-scheme-handler/Suno-depot`):

| Link | Opens |
| --- | --- |
| `Suno-depot://app/<app-id>` | The app’s page in Depot |
| `Suno-depot://install/<app-id>` | The app’s page with the install confirmation ready. Depot never installs without the person pressing Install. |
| `Suno-depot://collection/<collection-id>` | A Suno collection: `office`, `creative` or `studio` |

```html
<a href="Suno-depot://app/com.example.Notebook">Open in Depot</a>
```

Use these when you know the reader is on Suno, such as inside another Suno app
(open them with `Gtk.UriLauncher`) or in documentation for Suno users. On other
systems the link does nothing, so on the web prefer the listing URL.

Depot also handles standard **`appstream://<app-id>`** links
(`x-scheme-handler/appstream`), which many Linux apps and websites already use.
They open the app’s page.

## Installing on other distributions

Every app on the Suno remote has a `.flatpakref` file for each branch it is
on:

```text
https://dl.simplyluma.com/apps/<app-id>.beta.flatpakref   # beta branch
https://dl.simplyluma.com/apps/<app-id>.flatpakref        # stable branch, once the app has a stable release
```

People can open it in a Flatpak-aware software center, or install from a
terminal:

```sh
flatpak install --from https://dl.simplyluma.com/apps/com.example.Notebook.beta.flatpakref
```

The remote serves `x86_64` only for now.

## Badges

Until official artwork exists, use a plain text link or button that says
**“Get it on Depot”** or **“Open in Depot”**, linking to your web listing. Do
not make a badge that imitates Suno’s logo.

Rules for any Depot link or badge:

1. Link only to your own app’s listing.
2. Do not modify official badge artwork once it is available, or combine it with
   other store badges into one image.
3. Use “Made for Suno” only for apps in the Suno tier.
4. Do not suggest Suno endorses anything beyond your listing.

## Examples

Markdown for a README:

```markdown
[Get Notebook on Depot](https://simplyluma.com/apps/notebook)

Not on Suno? Install with Flatpak:

    flatpak install --from https://dl.simplyluma.com/apps/com.example.Notebook.flatpakref
```

From inside a Python app on Suno:

```python
launcher = Gtk.UriLauncher.new("Suno-depot://app/com.example.Notebook")
launcher.launch(window, None, None, None)
```
