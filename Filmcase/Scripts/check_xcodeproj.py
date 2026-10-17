#!/usr/bin/env python3
"""Structural checks on Filmcase.xcodeproj.

Xcode is not available on every machine that touches this repo, so this parses
the project file the way Xcode would and verifies the things a broken project
file gets wrong:

  * every object id that is referenced is also defined
  * every file reference resolves to a file that exists on disk
  * every Swift file on disk is compiled by exactly one target
  * the app's Info.plist and privacy manifest are valid XML plists
  * the shared scheme points at targets that exist

Exit code 0 means the project is internally consistent.
"""

import os
import plistlib
import re
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.join(ROOT, "Filmcase.xcodeproj")
PBXPROJ = os.path.join(PROJECT, "project.pbxproj")

problems = []


def fail(message):
    problems.append(message)


# --- a small OpenStep plist reader (the format .pbxproj uses) ---------------

class Parser:
    TOKEN = re.compile(r'\s*(/\*.*?\*/|//[^\n]*)?\s*', re.S)

    def __init__(self, text):
        self.text = text
        self.pos = 0

    def skip(self):
        while True:
            match = self.TOKEN.match(self.text, self.pos)
            if not match or match.end() == self.pos:
                break
            self.pos = match.end()

    def parse(self):
        self.skip()
        value = self.value()
        self.skip()
        return value

    def value(self):
        self.skip()
        char = self.text[self.pos]
        if char == "{":
            return self.dictionary()
        if char == "(":
            return self.array()
        if char == '"':
            return self.quoted()
        return self.bare()

    def dictionary(self):
        assert self.text[self.pos] == "{"
        self.pos += 1
        result = {}
        while True:
            self.skip()
            if self.text[self.pos] == "}":
                self.pos += 1
                return result
            key = self.value()
            self.skip()
            if self.text[self.pos] != "=":
                raise ValueError(f"expected = after {key!r} at {self.pos}")
            self.pos += 1
            result[key] = self.value()
            self.skip()
            if self.text[self.pos] == ";":
                self.pos += 1

    def array(self):
        assert self.text[self.pos] == "("
        self.pos += 1
        result = []
        while True:
            self.skip()
            if self.text[self.pos] == ")":
                self.pos += 1
                return result
            result.append(self.value())
            self.skip()
            if self.text[self.pos] == ",":
                self.pos += 1

    def quoted(self):
        self.pos += 1
        out = []
        while True:
            char = self.text[self.pos]
            if char == "\\":
                out.append(self.text[self.pos + 1])
                self.pos += 2
                continue
            if char == '"':
                self.pos += 1
                return "".join(out)
            out.append(char)
            self.pos += 1

    def bare(self):
        match = re.match(r'[^\s;,=(){}]+', self.text[self.pos:])
        if not match:
            raise ValueError(f"cannot read a value at {self.pos}: {self.text[self.pos:self.pos+40]!r}")
        self.pos += match.end()
        return match.group(0)


def main():
    if not os.path.exists(PBXPROJ):
        fail(f"{PBXPROJ} is missing")
        return report()

    text = open(PBXPROJ).read()
    if not text.startswith("// !$*UTF8*$!"):
        fail("project.pbxproj is missing its UTF-8 header comment")

    try:
        project = Parser(text).parse()
    except Exception as error:  # noqa: BLE001 - report, do not crash
        fail(f"project.pbxproj does not parse: {error}")
        return report()

    objects = project["objects"]
    root = project["rootObject"]
    if root not in objects:
        fail("rootObject points at an object that does not exist")
        return report()

    # 1. dangling references
    ids = set(objects)
    referenced = set(re.findall(r"\b[0-9A-F]{24}\b", text))
    for missing in sorted(referenced - ids):
        fail(f"reference to undefined object {missing}")

    # 2. file references resolve on disk
    def resolve(obj_id, seen=()):
        """Walk up the group tree to build a path, the way Xcode does."""
        for parent_id, parent in objects.items():
            if parent.get("isa") != "PBXGroup":
                continue
            if obj_id in parent.get("children", []):
                prefix = resolve(parent_id, seen + (obj_id,))
                path = parent.get("path")
                return os.path.join(prefix, path) if path else prefix
        return ""

    file_paths = {}
    for obj_id, obj in objects.items():
        if obj.get("isa") != "PBXFileReference":
            continue
        if obj.get("sourceTree") == "BUILT_PRODUCTS_DIR":
            continue
        rel = os.path.join(resolve(obj_id), obj["path"])
        file_paths[obj_id] = rel
        if not os.path.exists(os.path.join(ROOT, rel)):
            fail(f"file reference points at a missing file: {rel}")

    # 3. every Swift file on disk is built exactly once
    built = {}
    for obj_id, obj in objects.items():
        if obj.get("isa") != "PBXBuildFile":
            continue
        ref = obj.get("fileRef")
        if ref in file_paths:
            built.setdefault(file_paths[ref], 0)
            built[file_paths[ref]] += 1

    on_disk = []
    for folder in ("Filmcase", "FilmcaseTests"):
        for dirpath, _, filenames in os.walk(os.path.join(ROOT, folder)):
            for name in filenames:
                if name.endswith(".swift"):
                    on_disk.append(os.path.relpath(os.path.join(dirpath, name), ROOT))

    for path in sorted(on_disk):
        count = built.get(path, 0)
        if count == 0:
            fail(f"{path} exists but is not in any build phase")
        elif count > 1:
            fail(f"{path} is compiled {count} times")

    for path, count in sorted(built.items()):
        if path.endswith(".swift") and path not in on_disk:
            fail(f"{path} is in a build phase but not on disk")

    # 4. targets look sane
    targets = {i: o for i, o in objects.items() if o.get("isa") == "PBXNativeTarget"}
    if len(targets) != 2:
        fail(f"expected an app target and a test target, found {len(targets)}")
    for obj in targets.values():
        for phase_id in obj.get("buildPhases", []):
            if phase_id not in objects:
                fail(f"target {obj.get('name')} references a missing build phase")
        if obj.get("buildConfigurationList") not in objects:
            fail(f"target {obj.get('name')} has no build configuration list")

    # 5. required build settings
    settings = {}
    for obj in objects.values():
        if obj.get("isa") == "XCBuildConfiguration":
            for key, value in obj.get("buildSettings", {}).items():
                settings.setdefault(key, set()).add(
                    value if isinstance(value, str) else str(value)
                )
    for key in ("IPHONEOS_DEPLOYMENT_TARGET", "SWIFT_VERSION", "INFOPLIST_FILE",
                "PRODUCT_BUNDLE_IDENTIFIER", "TEST_HOST", "BUNDLE_LOADER",
                "ASSETCATALOG_COMPILER_APPICON_NAME"):
        if key not in settings:
            fail(f"no build configuration sets {key}")

    # 6. plists are valid, and say what they must say
    info_path = os.path.join(ROOT, "Filmcase", "Resources", "Info.plist")
    try:
        with open(info_path, "rb") as handle:
            info = plistlib.load(handle)
    except Exception as error:  # noqa: BLE001
        fail(f"Info.plist is not a valid plist: {error}")
        info = {}

    for key in ("NSCameraUsageDescription", "NSPhotoLibraryAddUsageDescription",
                "NSPhotoLibraryUsageDescription"):
        if not info.get(key):
            fail(f"Info.plist is missing {key}")
    if info.get("UISupportedInterfaceOrientations") != ["UIInterfaceOrientationPortrait"]:
        fail("Info.plist does not pin the app to portrait")

    privacy_path = os.path.join(ROOT, "Filmcase", "Resources", "PrivacyInfo.xcprivacy")
    try:
        with open(privacy_path, "rb") as handle:
            privacy = plistlib.load(handle)
        if privacy.get("NSPrivacyTracking") is not False:
            fail("privacy manifest should declare no tracking")
    except Exception as error:  # noqa: BLE001
        fail(f"PrivacyInfo.xcprivacy is not a valid plist: {error}")

    # 7. the shared scheme
    scheme_path = os.path.join(PROJECT, "xcshareddata", "xcschemes", "Filmcase.xcscheme")
    if not os.path.exists(scheme_path):
        fail("the shared Filmcase scheme is missing, so `xcodebuild -scheme Filmcase` will fail")
    else:
        try:
            tree = ET.parse(scheme_path)
            blueprints = {node.get("BlueprintIdentifier") for node in tree.iter("BuildableReference")}
            for blueprint in blueprints:
                if blueprint not in objects:
                    fail(f"the scheme references unknown target {blueprint}")
            if not any(objects.get(b, {}).get("productType", "").endswith("unit-test") for b in blueprints):
                fail("the scheme does not include the unit test target")
        except ET.ParseError as error:
            fail(f"the scheme is not valid XML: {error}")

    return report()


def report():
    if problems:
        print(f"{len(problems)} problem(s):")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print("Filmcase.xcodeproj: consistent (references, files, phases, settings, plists, scheme)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
