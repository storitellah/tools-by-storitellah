#!/usr/bin/env python3
"""Static checks on the Swift sources that do not need a compiler.

Not a substitute for building — it is what can be verified anywhere:

  * brackets, braces and parentheses balance (string and comment aware)
  * nothing is imported except Apple frameworks: no third-party packages
  * no networking API is referenced anywhere: the app is on-device only
  * every file ends in a newline
  * arguments to a memberwise initialiser are in declaration order, which
    Swift requires and which is easy to get wrong by hand
  * no type is built with arguments from another file while a private stored
    property with no default makes its memberwise initialiser private
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDERS = ("Filmcase", "FilmcaseTests")

ALLOWED_IMPORTS = {
    "AVFoundation", "CoreGraphics", "CoreImage", "CoreMedia", "CoreVideo",
    "Foundation", "ImageIO", "Metal", "MetalKit", "Photos", "PhotosUI",
    "SwiftUI", "UIKit", "XCTest",
    "Filmcase",  # @testable import of the app itself
}

# Anything that could put a byte on the wire.
NETWORK_SYMBOLS = [
    "URLSession", "URLRequest", "NSURLConnection", "CFNetwork", "Network.",
    "NWConnection", "CFStream", "Reachability", "WKWebView", "SFSafariViewController",
    "http://", "https://", "socket(", "getaddrinfo",
]

problems = []


def fail(path, message):
    problems.append(f"{os.path.relpath(path, ROOT)}: {message}")


def strip_code(text):
    """Return the source with comments and string bodies blanked out, so the
    checks below cannot be confused by a brace inside a string."""
    out = []
    i = 0
    n = len(text)
    while i < n:
        char = text[i]
        two = text[i:i + 2]
        three = text[i:i + 3]
        if three == '"""':
            end = text.find('"""', i + 3)
            end = n if end == -1 else end + 3
            out.append(" " * (end - i))
            i = end
        elif char == '"':
            i += 1
            out.append(" ")
            while i < n:
                if text[i] == "\\":
                    out.append("  ")
                    i += 2
                    continue
                if text[i] == '"':
                    out.append(" ")
                    i += 1
                    break
                out.append("\n" if text[i] == "\n" else " ")
                i += 1
        elif two == "//":
            end = text.find("\n", i)
            end = n if end == -1 else end
            out.append(" " * (end - i))
            i = end
        elif two == "/*":
            depth = 1
            j = i + 2
            while j < n and depth:
                if text[j:j + 2] == "/*":
                    depth += 1
                    j += 2
                elif text[j:j + 2] == "*/":
                    depth -= 1
                    j += 2
                else:
                    j += 1
            out.append("".join("\n" if c == "\n" else " " for c in text[i:j]))
            i = j
        else:
            out.append(char)
            i += 1
    return "".join(out)


def check_balance(path, code):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    line = 1
    for char in code:
        if char == "\n":
            line += 1
        elif char in "([{":
            stack.append((char, line))
        elif char in ")]}":
            if not stack:
                fail(path, f"line {line}: unmatched '{char}'")
                return
            opener, opened_at = stack.pop()
            if opener != pairs[char]:
                fail(path, f"line {line}: '{char}' closes a '{opener}' opened on line {opened_at}")
                return
    for opener, opened_at in stack:
        fail(path, f"line {opened_at}: '{opener}' is never closed")


def check_imports(path, code):
    for match in re.finditer(r"^\s*(?:@testable\s+)?import\s+([A-Za-z_][A-Za-z0-9_.]*)", code, re.M):
        module = match.group(1).split(".")[0]
        if module not in ALLOWED_IMPORTS:
            fail(path, f"imports {module}, which is not an allowed Apple framework")


def check_no_network(path, code):
    for symbol in NETWORK_SYMBOLS:
        if symbol in code:
            fail(path, f"references {symbol!r} — this app makes no network calls")


# --- memberwise initialiser ordering ---------------------------------------
#
# Swift's synthesised memberwise initialiser only accepts its arguments in
# declaration order, and only for structs that declare no initialiser of their
# own. Getting that wrong is a compile error, so it is worth catching here.

STRUCT_RE = re.compile(r"^(?:@\w+\s+)*(?:public\s+|internal\s+)?struct\s+(\w+)", re.M)


def struct_bodies(code):
    """Yield (name, body) for every struct in a file, using brace depth."""
    for match in STRUCT_RE.finditer(code):
        start = code.find("{", match.end())
        if start == -1:
            continue
        depth = 0
        for i in range(start, len(code)):
            if code[i] == "{":
                depth += 1
            elif code[i] == "}":
                depth -= 1
                if depth == 0:
                    yield match.group(1), code[start + 1:i]
                    break



def stored_properties(body):
    """Instance stored properties of a struct body, in declaration order.

    Computed properties (a `{` on the declaration line) and statics are not
    part of a memberwise initialiser, so they are skipped.
    """
    out = []
    for line in body.split("\n"):
        text = line.strip()
        if not text or text.startswith("//"):
            continue
        bare = re.sub(r"^(?:@\w+(?:\([^)]*\))?\s+)+", "", text)
        match = re.match(r"(private\s+|fileprivate\s+|public\s+|internal\s+)?"
                         r"(?:var|let)\s+(\w+)\s*[:=]", bare)
        if not match:
            continue
        if bare.startswith("static") or " static " in bare:
            continue
        if "{" in bare:
            continue
        has_default = "=" in bare.split(":", 1)[-1] or bare.rstrip().endswith("?")
        wrapped = text.startswith("@")
        out.append(((match.group(1) or "").strip(), match.group(2), has_default, wrapped))
    return out


def collect_memberwise_structs(sources):
    """name -> ordered property list, for structs with no explicit init."""
    result = {}
    for code in sources:
        for name, body in struct_bodies(code):
            if re.search(r"\binit\s*\(", body):
                continue
            properties = [name for _, name, _, _ in stored_properties(body)]
            if properties:
                result[name] = properties
    return result


def check_memberwise_calls(path, code, structs):
    for name, properties in structs.items():
        for match in re.finditer(r"\b" + name + r"\(", code):
            start = match.end()
            depth = 1
            i = start
            while i < len(code) and depth:
                if code[i] == "(":
                    depth += 1
                elif code[i] == ")":
                    depth -= 1
                i += 1
            if depth:
                continue
            arguments = code[start:i - 1]

            labels = []
            depth = 0
            for piece in re.finditer(r"[(\[]|[)\]]|(\w+)\s*:", arguments):
                text = piece.group(0)
                if text in "([":
                    depth += 1
                elif text in ")]":
                    depth -= 1
                elif depth == 0 and piece.group(1):
                    labels.append(piece.group(1))

            known = [label for label in labels if label in properties]
            if len(known) != len(labels):
                continue  # not a memberwise call (a different overload, say)
            positions = [properties.index(label) for label in known]
            if positions != sorted(positions):
                line = code[:match.start()].count("\n") + 1
                fail(path, f"line {line}: {name}(...) arguments are not in declaration order "
                           f"({', '.join(known)})")


# A private stored property that has no initial value becomes a required
# parameter of the synthesised memberwise initialiser, and drags the
# initialiser's access down with it, so the type can no longer be built from
# another file. Private properties that do have a default (including
# property-wrapped view state) do not, which is why the usual SwiftUI
# `@State private var` costs nothing.

def check_private_memberwise(files, stripped, structs_with_private):
    for path, code in stripped.items():
        for name, home in structs_with_private.items():
            if home == path:
                continue
            for match in re.finditer(r"\b" + name + r"\(\s*\w+\s*:", code):
                line = code[:match.start()].count("\n") + 1
                fail(path, f"line {line}: builds {name}(...) with arguments, but {name} has a "
                           f"private stored property, which makes its memberwise initialiser "
                           f"private to {os.path.relpath(home, ROOT)}")


def collect_private_memberwise_structs(stripped):
    """name -> the file it is declared in, for structs whose memberwise
    initialiser Swift would make private."""
    result = {}
    for path, code in stripped.items():
        for name, body in struct_bodies(code):
            if re.search(r"\binit\s*\(", body):
                continue
            restricted = [
                name for access, name, has_default, wrapped in stored_properties(body)
                if access in ("private", "fileprivate") and not has_default and not wrapped
            ]
            if restricted:
                result[name] = path
    return result


def main():
    files = []
    for folder in FOLDERS:
        for dirpath, _, filenames in os.walk(os.path.join(ROOT, folder)):
            for name in sorted(filenames):
                if name.endswith(".swift"):
                    files.append(os.path.join(dirpath, name))
    files.sort()

    if not files:
        print("no Swift files found")
        return 1

    stripped = {}
    for path in files:
        text = open(path).read()
        if not text.endswith("\n"):
            fail(path, "does not end with a newline")
        code = strip_code(text)
        stripped[path] = code
        check_balance(path, code)
        check_imports(path, code)
        check_no_network(path, code)

    structs = collect_memberwise_structs(stripped.values())
    for path, code in stripped.items():
        check_memberwise_calls(path, code, structs)
    check_private_memberwise(files, stripped, collect_private_memberwise_structs(stripped))

    if problems:
        print(f"{len(problems)} problem(s):")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    print(f"{len(files)} Swift files: delimiters balanced, memberwise calls ordered and "
          f"reachable, Apple frameworks only, no network APIs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
