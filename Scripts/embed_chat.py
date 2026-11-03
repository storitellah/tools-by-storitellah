#!/usr/bin/env python3
"""Embed <Tool>/CHAT.md into <Tool>/index.html between the BUILD-CHAT markers.

Usage: python3 embed_chat.py Keepframe
"""
import re, sys, pathlib

tool = pathlib.Path(sys.argv[1])
page = tool / "index.html"
chat = (tool / "CHAT.md").read_text(encoding="utf-8")
if "</script" in chat.lower():
    chat = re.sub(r"(?i)</script", r"<\\/script", chat)
src = page.read_text(encoding="utf-8")
pat = re.compile(r'(<script type="text/markdown" id="build-chat">\n).*?(</script>)', re.S)
if not pat.search(src):
    sys.exit(f"{page}: build-chat markers not found")
page.write_text(pat.sub(lambda m: m.group(1) + chat.rstrip("\n") + "\n" + m.group(2), src, count=1), encoding="utf-8")
print(f"Embedded {len(chat)} chars of CHAT.md into {page}")
