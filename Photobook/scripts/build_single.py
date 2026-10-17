#!/usr/bin/env python3
"""Build dist/photobook.html: the whole tool in one file.

Bundles js/ with esbuild (via npx), inlines css/app.css, and embeds the logos
and demo photos as data: URLs so the page opens straight from disk, no server.

    python3 scripts/build_single.py
"""
import base64
import json
import mimetypes
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "photobook.html"


def data_url(path):
    mime = mimetypes.guess_type(path.name)[0] or ("font/woff2" if path.suffix == ".woff2" else "application/octet-stream")
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def main():
    js = subprocess.run(
        ["npx", "--yes", "esbuild@0.24.0", "js/main.js", "--bundle", "--format=iife", "--minify", "--target=es2022"],
        cwd=ROOT, check=True, capture_output=True, text=True,
    ).stdout
    css = (ROOT / "css" / "app.css").read_text()

    embedded = {}
    for folder in ("assets/logos", "demo"):
        for f in sorted((ROOT / folder).iterdir()):
            if f.suffix.lower() in (".png", ".jpg", ".jpeg"):
                embedded[f"{folder}/{f.name}"] = data_url(f)

    html = (ROOT / "index.html").read_text()
    html = html.replace('<link rel="stylesheet" href="css/app.css">', f"<style>\n{css}</style>")
    fonts_css = re.sub(
        r'url\("\.\./(fonts/[^"]+)"\)',
        lambda m: f'url("{data_url(ROOT / m.group(1))}")',
        (ROOT / "css" / "fonts.css").read_text(),
    )
    html = html.replace('<link rel="stylesheet" href="css/fonts.css">', f"<style>\n{fonts_css}</style>")
    html = html.replace(
        '<script type="module" src="js/main.js"></script>',
        "<script>window.PHOTOBOOK_EMBEDDED=" + json.dumps(embedded) + ";</script>",
    )
    # Images referenced directly by the page.
    html = re.sub(r'(href|src)="(assets/logos/[^"]+)"', lambda m: f'{m.group(1)}="{embedded[m.group(2)]}"', html)
    # The app script goes last so it runs after the body exists.
    js = js.replace("</script", "<\\/script")
    html = html.replace("</body>", f"<script>\n{js}</script>\n</body>")

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html)
    print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1048576:.1f} MB")


if __name__ == "__main__":
    main()
