#!/usr/bin/env python3
"""Build the macOS app and its .dmg installers.

Produces, for Apple silicon (arm64) and Intel (x64):

    dist/Photobook-<version>-AppleSilicon.dmg
    dist/Photobook-<version>-Intel.dmg

Each disk image holds Photobook.app (Electron with the web app inside), a
shortcut to Applications and an install guide. Runs on Linux or macOS.

Tools it needs (paths can be overridden with the environment variables shown):

    unzip                          (UNZIP)
    mkfs.hfsplus  from hfsprogs    (MKFS_HFSPLUS)
    hfsplus       from planetbeing/libdmg-hfsplus  (HFSPLUS)
    dmg           from libdmg-hfsplus              (DMG)
    rcodesign     from `cargo install apple-codesign`  (RCODESIGN) — optional;
                  without it the app is unsigned and macOS calls it "damaged"

and the Electron release zips, downloaded automatically into .cache/:

    python3 scripts/build_mac.py
"""
import json
import os
import pathlib
import plistlib
import shutil
import subprocess
import sys
import urllib.request

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAC = ROOT / "mac"
DIST = ROOT / "dist"
CACHE = ROOT / ".cache"
WORK = CACHE / "mac-build"

ELECTRON = "33.2.1"
VERSION = json.loads((MAC / "package.json").read_text())["version"]
BUNDLE_ID = "com.storitellah.photobook"
ARCHES = {"arm64": "AppleSilicon", "x64": "Intel"}

# What goes into the app from the web tool.
WEB_FILES = ["index.html", "css", "js", "assets", "demo", "fonts"]

tool = lambda env, name: os.environ.get(env) or shutil.which(name)


def run(*args, **kw):
    return subprocess.run([str(a) for a in args], check=True, **kw)


def electron_zip(arch):
    CACHE.mkdir(exist_ok=True)
    z = CACHE / f"electron-v{ELECTRON}-darwin-{arch}.zip"
    if not z.exists():
        url = f"https://github.com/electron/electron/releases/download/v{ELECTRON}/{z.name}"
        print("downloading", url)
        urllib.request.urlretrieve(url, z)
    return z


def make_icon(out):
    """Amber mark on an ink rounded square, as an .icns."""
    mark = Image.open(ROOT / "assets/logos/Logo-07.png").convert("RGBA")
    size = 1024
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pad = 100  # macOS icon grid: the tile sits inside a margin
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle([pad, pad, size - pad, size - pad], radius=185, fill=(15, 15, 15, 255))
    icon.alpha_composite(tile)
    m = mark.copy()
    m.thumbnail((560, 560), Image.LANCZOS)
    icon.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    icon.save(out, format="ICNS", sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)])


def build_app(arch, icns):
    out = WORK / arch
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    # unzip keeps the framework symlinks that Python's zipfile would flatten.
    run(tool("UNZIP", "unzip"), "-q", electron_zip(arch), "-d", out)
    app = out / "Photobook.app"
    (out / "Electron.app").rename(app)
    res = app / "Contents" / "Resources"
    (res / "default_app.asar").unlink(missing_ok=True)
    (res / "electron.icns").unlink(missing_ok=True)
    shutil.copy(icns, res / "photobook.icns")

    dest = res / "app"
    dest.mkdir()
    shutil.copy(MAC / "main.js", dest / "main.js")
    shutil.copy(MAC / "package.json", dest / "package.json")
    for name in WEB_FILES:
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, dest / "web" / name, ignore=shutil.ignore_patterns(".*"))
        else:
            (dest / "web").mkdir(exist_ok=True)
            shutil.copy(src, dest / "web" / name)

    plist_path = app / "Contents" / "Info.plist"
    plist = plistlib.loads(plist_path.read_bytes())
    plist.update({
        "CFBundleName": "Photobook",
        "CFBundleDisplayName": "Photobook",
        "CFBundleIdentifier": BUNDLE_ID,
        "CFBundleIconFile": "photobook.icns",
        "CFBundleShortVersionString": VERSION,
        "CFBundleVersion": VERSION,
        "NSHumanReadableCopyright": "Photobook by Storitellah",
        "LSApplicationCategoryType": "public.app-category.graphics-design",
    })
    plist_path.write_bytes(plistlib.dumps(plist))

    signer = tool("RCODESIGN", "rcodesign")
    if signer:
        # Ad-hoc signature: no Apple Developer ID, but a valid, sealed bundle,
        # so macOS offers "Open Anyway" instead of calling the app damaged.
        run(signer, "sign", app, stdout=subprocess.DEVNULL)
    else:
        print("warning: rcodesign not found — the app is not signed", file=sys.stderr)
    return app


def hfs_image(stage, img, volname):
    """Write the staging folder into a fresh HFS+ image, keeping symlinks and modes."""
    hfsplus = tool("HFSPLUS", "hfsplus")
    size = sum(f.lstat().st_size for f in stage.rglob("*")) // (1 << 20)
    img.unlink(missing_ok=True)
    run("dd", "if=/dev/zero", f"of={img}", "bs=1M", f"count={int(size * 1.15) + 40}", stderr=subprocess.DEVNULL)
    run(tool("MKFS_HFSPLUS", "mkfs.hfsplus"), "-v", volname, img, stdout=subprocess.DEVNULL)
    quiet = dict(stdout=subprocess.DEVNULL)
    for dirpath, dirnames, filenames in os.walk(stage):
        rel = "/" + os.path.relpath(dirpath, stage).replace(os.sep, "/")
        rel = "" if rel == "/." else rel
        for d in sorted(dirnames):
            p = pathlib.Path(dirpath, d)
            if p.is_symlink():
                run(hfsplus, img, "symlink", f"{rel}/{d}", os.readlink(p), **quiet)
            else:
                run(hfsplus, img, "mkdir", f"{rel}/{d}", **quiet)
                run(hfsplus, img, "chmod", "755", f"{rel}/{d}", **quiet)
        dirnames[:] = [d for d in dirnames if not pathlib.Path(dirpath, d).is_symlink()]
        for f in sorted(filenames):
            p = pathlib.Path(dirpath, f)
            if p.is_symlink():
                run(hfsplus, img, "symlink", f"{rel}/{f}", os.readlink(p), **quiet)
                continue
            run(hfsplus, img, "add", p, f"{rel}/{f}", **quiet)
            mode = "755" if os.access(p, os.X_OK) else "644"
            run(hfsplus, img, "chmod", mode, f"{rel}/{f}", **quiet)


def build_dmg(arch, app):
    label = ARCHES[arch]
    stage = WORK / f"stage-{arch}"
    shutil.rmtree(stage, ignore_errors=True)
    stage.mkdir()
    shutil.move(str(app), stage / "Photobook.app")
    os.symlink("/Applications", stage / "Applications")
    shutil.copy(MAC / "INSTALL.txt", stage / "How to install.txt")
    shutil.copy(MAC / "Install Photobook.command", stage / "Install Photobook.command")
    os.chmod(stage / "Install Photobook.command", 0o755)
    img = WORK / f"{arch}.hfs"
    hfs_image(stage, img, "Photobook")
    DIST.mkdir(exist_ok=True)
    out = DIST / f"Photobook-{VERSION}-{label}.dmg"
    out.unlink(missing_ok=True)
    run(tool("DMG", "dmg"), img, out, stdout=subprocess.DEVNULL)  # HFS+ image -> compressed UDIF
    img.unlink()
    print(f"{out.relative_to(ROOT)}  {out.stat().st_size / 1048576:.0f} MB")


def main():
    arches = sys.argv[1:] or list(ARCHES)
    WORK.mkdir(parents=True, exist_ok=True)
    icns = WORK / "photobook.icns"
    make_icon(icns)
    for arch in arches:
        build_dmg(arch, build_app(arch, icns))


if __name__ == "__main__":
    main()
