# Miter & Mat for WordPress

`miter-and-mat.zip` is an installable WordPress plugin that puts the framing
tool on any page.

## Install

1. In WordPress, go to **Plugins → Add New Plugin → Upload Plugin**, choose
   `miter-and-mat.zip`, then click **Install Now** and **Activate**.
2. Optional: set the starting frame, mat, background, accent color and height
   under **Settings → Miter & Mat**.
3. Add the **Miter & Mat** block to a page, or paste the shortcode
   `[miter_and_mat]`.

Every setting can be overridden per page:

```
[miter_and_mat frame="cherry-round" background="sage" layout="4:5" mat="linen2" size="16" height="900"]
```

Attributes: `frame`, `matStyle`, `mat`, `background`, `layout`, `measure`,
`size`, `theme`, `names`, `accent`, `height`, `credit`. The settings page lists
every id.

## How it's built

- `miter-and-mat.php` handles the shortcode, the block (server-rendered), the
  settings page and the per-page overrides. Every value is checked against a
  list of allowed ids, and an unknown value falls back to the site setting.
- The tool runs in an iframe (`app/index.html`), so the theme's CSS and the
  tool's CSS can't affect each other. On phones, the tool reports its height to
  `assets/embed.js`, which grows the iframe so the page scrolls normally.
- The fonts (Bricolage Grotesque and IBM Plex, OFL) and JSZip (MIT) are bundled
  in the plugin. It makes no third-party requests, and photos never leave the
  visitor's browser.
- By default, frames use descriptive names such as "Walnut · Flat" instead of
  the source page's product names. You can switch this under **Frame names**
  in the settings.

## Rebuilding

`app/index.html` is generated from `../index.html`, the same file published as
the standalone tool. After you change the tool, run:

```
python3 MiterAndMat/wordpress/build.py
```

That regenerates `miter-and-mat/app/index.html` and `miter-and-mat.zip`.
