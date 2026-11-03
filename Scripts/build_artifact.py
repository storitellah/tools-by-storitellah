#!/usr/bin/env python3
"""Turn a standalone <Tool>/index.html into the page body the claude.ai Artifact host expects.

The host wraps the page in its own <!doctype html><html><head>…<body> skeleton, so this strips
the document-level tags (doctype, html, head, body, charset and viewport metas) and keeps
everything else in order: <title>, font links, <style>, markup and scripts.

Usage: python3 Scripts/build_artifact.py Keepframe [out.html]
"""
import re, sys, pathlib

tool = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else tool / "dist" / "artifact.html"
src = (tool / "index.html").read_text(encoding="utf-8")

# Leave script bodies untouched: only strip tags outside <script>…</script>.
parts = re.split(r"(<script\b.*?</script>)", src, flags=re.S | re.I)
strip = [
    r"<!doctype[^>]*>\s*", r"</?html\b[^>]*>\s*", r"</?head\b[^>]*>\s*", r"</?body\b[^>]*>\s*",
    r"<meta\s+charset=[^>]*>\s*", r'<meta\s+name="viewport"[^>]*>\s*',
]
for i in range(0, len(parts), 2):
    for pat in strip:
        parts[i] = re.sub(pat, "", parts[i], flags=re.I)
html = "".join(parts).strip() + "\n"
if "<title>" not in html[:8192]:
    sys.exit("build_artifact: <title> must stay within the first 8KB")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"Wrote {out} ({len(html):,} bytes)")
