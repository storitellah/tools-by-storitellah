#!/usr/bin/env python3
"""Build the archive site from an Instagram data export.

    python3 scripts/build.py --posts <export>/your_instagram_activity/media/posts_1.html \
                             --media <dir with the post media files> \
                             --out site

Reads the post index (HTML export), resizes every photo to two WebP sizes,
re-encodes videos, scores each post and writes site/data/posts.json plus
site/index.html (from src/index.html). Re-running only processes new media.
"""
import argparse
import html
import json
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from bs4 import BeautifulSoup
from PIL import Image, ImageOps
import pillow_heif

pillow_heif.register_heif_opener()

SMALL, LARGE = 480, 1600
ROOT = Path(__file__).resolve().parent.parent

MILESTONES = re.compile(
    r"\b(exhibition|exhibit|award|won|winner|published|publication|featured|feature|premiere|"
    r"launch|launched|book|film|documentary|festival|grant|fellowship|workshop|anniversary|"
    r"years? (ago|apart)|first|milestone|thank you|grateful|world photography day|"
    r"magazine|screening|interview)\b",
    re.I,
)


def parse_posts(path):
    soup = BeautifulSoup(Path(path).read_text(encoding="utf-8"), "html.parser")
    main = soup.find(attrs={"role": "main"})
    posts = []
    for box in main.find_all("div", class_="_a6-g", recursive=False):
        h2 = box.find("h2")
        stamp = box.find("div", class_="_a6-o")
        media, seen = [], set()
        for tag in box.select("img, video"):
            src = tag.get("src")
            if src and src not in seen:
                seen.add(src)
                media.append(src.rsplit("/", 1)[-1])
        cells = [c.get_text(" ", strip=True) for c in box.select("td")]
        lat = lng = None
        for c in cells:
            if c.startswith("Latitude"):
                lat = float(c.split()[-1])
            elif c.startswith("Longitude"):
                lng = float(c.split()[-1])
        posts.append({
            "caption": (h2.get_text() if h2 else "").strip(),
            "date": datetime.strptime(stamp.get_text(strip=True), "%b %d, %Y %I:%M %p"),
            "media": media,
            "geo": [lat, lng] if lat is not None and lng is not None else None,
        })
    posts.sort(key=lambda p: p["date"])
    return posts


def dominant(img):
    return "#%02x%02x%02x" % img.convert("RGB").resize((1, 1), Image.LANCZOS).getpixel((0, 0))


def save_webp(img, width, dest, quality):
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(dest, "WEBP", quality=quality, method=6)


def process_image(src, stem, out):
    small, large = out / f"{stem}-s.webp", out / f"{stem}-l.webp"
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        if not small.exists():
            save_webp(im, SMALL, small, 70)
        if not large.exists():
            save_webp(im, LARGE, large, 78)
        return im.width, im.height, dominant(im)


def process_video(src, stem, out, ffmpeg):
    video, poster = out / f"{stem}.mp4", out / f"{stem}-poster.jpg"
    if not video.exists():
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(src),
                        "-vf", "scale='min(1080,iw)':-2", "-c:v", "libx264", "-crf", "26",
                        "-preset", "slow", "-c:a", "aac", "-b:a", "96k",
                        "-movflags", "+faststart", str(video)], check=True)
    if not poster.exists():
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-ss", "0.5", "-i", str(src),
                        "-frames:v", "1", "-q:v", "3", str(poster)], check=True)
    dims = process_image(poster, stem, out)
    poster.unlink()
    return dims


def score(post):
    cap = post["caption"]
    words = len(cap.split())
    kinds = {m["type"] for m in post["media"]}
    s = min(len(post["media"]), 10) * 3.0          # carousel depth
    s += min(words, 160) / 160 * 28                 # story told in the caption
    s += 8 if "video" in kinds else 0
    s += 3 if post["geo"] else 0
    s += min(len(set(MILESTONES.findall(cap))), 3) * 6  # milestone language
    s += min(len(re.findall(r"[@#]\w+", cap)), 8) * 0.75
    return round(s, 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--posts", required=True)
    ap.add_argument("--media", required=True)
    ap.add_argument("--out", default=str(ROOT / "site"))
    args = ap.parse_args()

    from imageio_ffmpeg import get_ffmpeg_exe
    ffmpeg = get_ffmpeg_exe()

    media_dir, out = Path(args.media), Path(args.out)
    (out / "m").mkdir(parents=True, exist_ok=True)
    (out / "data").mkdir(parents=True, exist_ok=True)

    cache_file = out / "data" / "dims.json"
    cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}

    posts, missing = [], 0
    for raw in parse_posts(args.posts):
        items = []
        for name in raw["media"]:
            stem, ext = name.rsplit(".", 1)[0], name.rsplit(".", 1)[-1].lower()
            kind = "video" if ext == "mp4" else "image"
            src = media_dir / name
            if stem not in cache:
                if not src.exists():
                    missing += 1
                    continue
                try:
                    dims = (process_video(src, stem, out / "m", ffmpeg) if kind == "video"
                            else process_image(src, stem, out / "m"))
                except Exception as err:  # corrupt or unsupported file
                    print(f"skip {name}: {err}")
                    continue
                cache[stem] = list(dims)
            w, h, color = cache[stem]
            items.append({"id": stem, "type": kind, "w": w, "h": h, "c": color})
        if not items:
            continue
        posts.append({**raw, "media": items})

    for i, p in enumerate(posts):
        p["score"] = score(p)
        p["i"] = i

    ranked = sorted(posts, key=lambda p: -p["score"])
    cutoff = ranked[min(len(ranked) - 1, max(24, len(ranked) // 12))]["score"]

    data = [{
        "i": p["i"],
        "t": p["date"].strftime("%Y-%m-%dT%H:%M"),
        "c": p["caption"],
        "m": [[m["id"], m["w"], m["h"], m["c"], 1 if m["type"] == "video" else 0] for m in p["media"]],
        "s": p["score"],
        "k": 1 if p["score"] >= cutoff else 0,
        **({"g": p["geo"]} if p["geo"] else {}),
    } for p in posts]

    (out / "data" / "posts.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    cache_file.write_text(json.dumps(cache, separators=(",", ":")))

    # Bake the first post into the page so the opening scene paints before any JS or JSON loads.
    first = posts[0]
    hero = first["media"][0]
    page = (ROOT / "src" / "index.html").read_text(encoding="utf-8")
    page = (page.replace("{{HERO_ID}}", hero["id"])
                .replace("{{HERO_COLOR}}", hero["c"])
                .replace("{{HERO_RATIO}}", f'{hero["w"]} / {hero["h"]}')
                .replace("{{HERO_DATE}}", first["date"].strftime("%B %-d, %Y"))
                .replace("{{HERO_CAPTION}}", html.escape(first["caption"] or "The first post."))
                .replace("{{POST_COUNT}}", f"{len(posts):,}")
                .replace("{{FIRST_YEAR}}", str(posts[0]["date"].year))
                .replace("{{LAST_YEAR}}", str(posts[-1]["date"].year)))
    (out / "index.html").write_text(page, encoding="utf-8")
    for asset in ("app.js", "style.css"):
        shutil.copy(ROOT / "src" / asset, out / asset)

    print(f"{len(posts)} posts, {sum(len(p['media']) for p in posts)} media, {missing} media missing")


if __name__ == "__main__":
    main()
