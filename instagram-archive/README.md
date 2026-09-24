# Instagram Archive

Every post from [@storitellah](https://www.instagram.com/storitellah/), from the
first one in 2014 to today, as a single static site. The first post opens the
page as a full-screen scene. Below it are the twelve most significant posts, then
a year-by-year timeline where standout posts take up four tiles. Any post opens
in a full-screen viewer with swipe and arrow-key navigation, carousels, video,
the full caption and a map link.

No framework or build step runs in the browser. It's one HTML page, one
stylesheet, one ES module and a JSON index. Photos come in two WebP sizes. The
timeline adds tiles in chunks as they scroll into view, so a 1,600-post archive
stays light.

## Significance, not likes

Instagram's data export doesn't include like or comment counts on your own
posts, so "most significant" is scored from what each post contains:

| Signal | Weight |
| --- | --- |
| Frames in the carousel | 3 per frame, up to 10 frames |
| Caption length | up to 28, at 160 words |
| Video | 8 |
| Location attached | 3 |
| Milestone language (exhibition, film, feature, anniversary, "years apart", …) | 6 per distinct term, up to 3 |
| Mentions and hashtags | 0.75 each, up to 8 |

The top twelfth of posts are flagged as standouts. The weights live in
`score()` in `scripts/build.py`.

## Layout

```
src/        page template, styles and script (edit these)
scripts/    build.py: export → site
site/       the built, deployable site (generated)
  m/        <media-id>-s.webp (480px), -l.webp (1600px), <media-id>.mp4
  data/     posts.json (the index), dims.json (build cache)
```

## Rebuild from a new export

Request a **Download your information** export from Instagram (HTML or JSON
format both carry `posts_1.html`; HTML is what this parser reads). Unzip it,
then:

```sh
pip install pillow pillow-heif beautifulsoup4 imageio-ffmpeg
python3 scripts/build.py \
  --posts <export>/your_instagram_activity/media/posts_1.html \
  --media <folder containing every file under <export>/media/posts, flattened> \
  --out site
```

Media that's already been processed is skipped, so only new posts cost time.

## Deploy

`.github/workflows/instagram-archive-pages.yml` publishes `site/` to GitHub
Pages whenever it changes on the default branch. Turn it on once under **Settings → Pages →
Source: GitHub Actions**.

To preview locally, run `python3 -m http.server -d site`.
