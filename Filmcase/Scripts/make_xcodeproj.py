#!/usr/bin/env python3
"""Regenerate Filmcase.xcodeproj from what is on disk.

The project file is committed, so you only need this when you add, remove or
move a source file. Run it from the folder that contains `Filmcase/`:

    python3 Scripts/make_xcodeproj.py

Then `Scripts/check_xcodeproj.py` verifies the result.
"""

import hashlib
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = "Filmcase"
TESTS = "FilmcaseTests"
BUNDLE_ID = "com.storitellah.filmcase"
DEPLOYMENT_TARGET = "17.0"
SWIFT_VERSION = "5.0"

used_ids = {}


def oid(*parts):
    """A stable 24-hex object id, so regenerating gives a readable diff."""
    key = "|".join(parts)
    value = hashlib.md5(key.encode()).hexdigest()[:24].upper()
    if value in used_ids and used_ids[value] != key:
        raise SystemExit(f"object id collision between {key} and {used_ids[value]}")
    used_ids[value] = key
    return value


def swift_sources(folder):
    """Every .swift file under `folder`, grouped by its directory."""
    tree = {}
    base = os.path.join(ROOT, folder)
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames.sort()
        rel = os.path.relpath(dirpath, base)
        rel = "" if rel == "." else rel
        files = sorted(f for f in filenames if f.endswith(".swift"))
        if files:
            tree[rel] = files
    return tree


def quote(value):
    if value == "":
        return '""'
    safe = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_./$")
    if all(c in safe for c in value):
        return value
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


class Project:
    def __init__(self):
        self.file_refs = []      # (id, path, name, type, source_tree)
        self.build_files = []    # (id, file_ref_id, name, phase)
        self.groups = []         # (id, name, path, children ids)

    def file_ref(self, key, path, file_type, source_tree="<group>", name=None):
        fid = oid("fileref", key)
        self.file_refs.append((fid, path, name, file_type, source_tree))
        return fid

    def build_file(self, key, file_ref_id, name):
        bid = oid("buildfile", key)
        self.build_files.append((bid, file_ref_id, name))
        return bid

    def group(self, key, children, name=None, path=None):
        gid = oid("group", key)
        self.groups.append((gid, name, path, children))
        return gid


FILE_TYPES = {
    ".swift": "sourcecode.swift",
    ".plist": "text.plist.xml",
    ".xcprivacy": "text.plist.xml",
    ".xcassets": "folder.assetcatalog",
}


def main():
    p = Project()

    # ---- app sources -----------------------------------------------------
    app_tree = swift_sources(APP)
    if "" not in app_tree:
        raise SystemExit(f"no Swift files directly inside {APP}/")

    app_source_build_files = []
    app_group_children = []
    subgroup_ids = []

    for rel in sorted(app_tree):
        child_ids = []
        for name in app_tree[rel]:
            rel_path = os.path.join(APP, rel, name) if rel else os.path.join(APP, name)
            fid = p.file_ref(rel_path, name, FILE_TYPES[".swift"])
            child_ids.append(fid)
            app_source_build_files.append(p.build_file(rel_path, fid, name))
        if rel == "":
            app_group_children.extend(child_ids)
        else:
            subgroup_ids.append((rel, p.group(os.path.join(APP, rel), child_ids, path=rel)))

    # ---- app resources ---------------------------------------------------
    assets_ref = p.file_ref(f"{APP}/Assets.xcassets", "Assets.xcassets", FILE_TYPES[".xcassets"])
    privacy_ref = p.file_ref(f"{APP}/Resources/PrivacyInfo.xcprivacy", "PrivacyInfo.xcprivacy",
                             FILE_TYPES[".xcprivacy"])
    info_ref = p.file_ref(f"{APP}/Resources/Info.plist", "Info.plist", FILE_TYPES[".plist"])

    resources_group = p.group(f"{APP}/Resources", [info_ref, privacy_ref], path="Resources")
    app_resource_build_files = [
        p.build_file(f"{APP}/Assets.xcassets", assets_ref, "Assets.xcassets"),
        p.build_file(f"{APP}/Resources/PrivacyInfo.xcprivacy", privacy_ref, "PrivacyInfo.xcprivacy"),
    ]

    app_group_children += [gid for _, gid in subgroup_ids]
    app_group_children += [assets_ref, resources_group]
    app_group = p.group(APP, app_group_children, path=APP)

    # ---- test sources ----------------------------------------------------
    test_tree = swift_sources(TESTS)
    test_children = []
    test_source_build_files = []
    for rel in sorted(test_tree):
        for name in test_tree[rel]:
            rel_path = os.path.join(TESTS, rel, name) if rel else os.path.join(TESTS, name)
            fid = p.file_ref(rel_path, name, FILE_TYPES[".swift"])
            test_children.append(fid)
            test_source_build_files.append(p.build_file(rel_path, fid, name))
    test_group = p.group(TESTS, test_children, path=TESTS)

    # ---- products --------------------------------------------------------
    app_product = oid("product", "app")
    test_product = oid("product", "tests")
    products_group = p.group("Products", [app_product, test_product], name="Products")
    main_group = p.group("MainGroup", [app_group, test_group, products_group])

    ids = {
        "project": oid("object", "project"),
        "app_target": oid("target", "app"),
        "test_target": oid("target", "tests"),
        "app_sources": oid("phase", "app-sources"),
        "app_frameworks": oid("phase", "app-frameworks"),
        "app_resources": oid("phase", "app-resources"),
        "test_sources": oid("phase", "test-sources"),
        "test_frameworks": oid("phase", "test-frameworks"),
        "project_config_list": oid("configlist", "project"),
        "app_config_list": oid("configlist", "app"),
        "test_config_list": oid("configlist", "tests"),
        "project_debug": oid("config", "project-debug"),
        "project_release": oid("config", "project-release"),
        "app_debug": oid("config", "app-debug"),
        "app_release": oid("config", "app-release"),
        "test_debug": oid("config", "test-debug"),
        "test_release": oid("config", "test-release"),
        "dependency": oid("dependency", "tests-on-app"),
        "container_proxy": oid("proxy", "tests-on-app"),
    }

    out = []
    w = out.append
    w("// !$*UTF8*$!")
    w("{")
    w("\tarchiveVersion = 1;")
    w("\tclasses = {")
    w("\t};")
    w("\tobjectVersion = 56;")
    w(f"\tobjects = {{")

    # PBXBuildFile
    w("")
    w("/* Begin PBXBuildFile section */")
    for bid, fid, name in sorted(p.build_files, key=lambda item: item[2]):
        w(f"\t\t{bid} /* {name} in Build Phase */ = {{isa = PBXBuildFile; fileRef = {fid} /* {name} */; }};")
    w("/* End PBXBuildFile section */")

    # PBXContainerItemProxy
    w("")
    w("/* Begin PBXContainerItemProxy section */")
    w(f"\t\t{ids['container_proxy']} /* PBXContainerItemProxy */ = {{")
    w("\t\t\tisa = PBXContainerItemProxy;")
    w(f"\t\t\tcontainerPortal = {ids['project']} /* Project object */;")
    w("\t\t\tproxyType = 1;")
    w(f"\t\t\tremoteGlobalIDString = {ids['app_target']};")
    w(f"\t\t\tremoteInfo = {APP};")
    w("\t\t};")
    w("/* End PBXContainerItemProxy section */")

    # PBXFileReference
    w("")
    w("/* Begin PBXFileReference section */")
    w(f"\t\t{app_product} /* {APP}.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = {APP}.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
    w(f"\t\t{test_product} /* {TESTS}.xctest */ = {{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = {TESTS}.xctest; sourceTree = BUILT_PRODUCTS_DIR; }};")
    for fid, path, name, ftype, tree in sorted(p.file_refs, key=lambda item: item[1]):
        label = name or path
        extra = f"name = {quote(name)}; " if name else ""
        w(f"\t\t{fid} /* {label} */ = {{isa = PBXFileReference; lastKnownFileType = {ftype}; {extra}path = {quote(path)}; sourceTree = {quote(tree)}; }};")
    w("/* End PBXFileReference section */")

    # PBXFrameworksBuildPhase
    w("")
    w("/* Begin PBXFrameworksBuildPhase section */")
    for key, label in ((ids["app_frameworks"], APP), (ids["test_frameworks"], TESTS)):
        w(f"\t\t{key} /* Frameworks */ = {{")
        w("\t\t\tisa = PBXFrameworksBuildPhase;")
        w("\t\t\tbuildActionMask = 2147483647;")
        w("\t\t\tfiles = (")
        w("\t\t\t);")
        w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
        w("\t\t};")
    w("/* End PBXFrameworksBuildPhase section */")

    # PBXGroup
    w("")
    w("/* Begin PBXGroup section */")
    for gid, name, path, children in p.groups:
        label = name or path or "Group"
        w(f"\t\t{gid} /* {label} */ = {{")
        w("\t\t\tisa = PBXGroup;")
        w("\t\t\tchildren = (")
        for child in children:
            w(f"\t\t\t\t{child},")
        w("\t\t\t);")
        if name:
            w(f"\t\t\tname = {quote(name)};")
        if path:
            w(f"\t\t\tpath = {quote(path)};")
        w("\t\t\tsourceTree = \"<group>\";")
        w("\t\t};")
    w("/* End PBXGroup section */")

    # PBXNativeTarget
    w("")
    w("/* Begin PBXNativeTarget section */")
    w(f"\t\t{ids['app_target']} /* {APP} */ = {{")
    w("\t\t\tisa = PBXNativeTarget;")
    w(f"\t\t\tbuildConfigurationList = {ids['app_config_list']};")
    w("\t\t\tbuildPhases = (")
    w(f"\t\t\t\t{ids['app_sources']} /* Sources */,")
    w(f"\t\t\t\t{ids['app_frameworks']} /* Frameworks */,")
    w(f"\t\t\t\t{ids['app_resources']} /* Resources */,")
    w("\t\t\t);")
    w("\t\t\tbuildRules = (")
    w("\t\t\t);")
    w("\t\t\tdependencies = (")
    w("\t\t\t);")
    w(f"\t\t\tname = {APP};")
    w(f"\t\t\tproductName = {APP};")
    w(f"\t\t\tproductReference = {app_product} /* {APP}.app */;")
    w("\t\t\tproductType = \"com.apple.product-type.application\";")
    w("\t\t};")
    w(f"\t\t{ids['test_target']} /* {TESTS} */ = {{")
    w("\t\t\tisa = PBXNativeTarget;")
    w(f"\t\t\tbuildConfigurationList = {ids['test_config_list']};")
    w("\t\t\tbuildPhases = (")
    w(f"\t\t\t\t{ids['test_sources']} /* Sources */,")
    w(f"\t\t\t\t{ids['test_frameworks']} /* Frameworks */,")
    w("\t\t\t);")
    w("\t\t\tbuildRules = (")
    w("\t\t\t);")
    w("\t\t\tdependencies = (")
    w(f"\t\t\t\t{ids['dependency']} /* PBXTargetDependency */,")
    w("\t\t\t);")
    w(f"\t\t\tname = {TESTS};")
    w(f"\t\t\tproductName = {TESTS};")
    w(f"\t\t\tproductReference = {test_product} /* {TESTS}.xctest */;")
    w("\t\t\tproductType = \"com.apple.product-type.bundle.unit-test\";")
    w("\t\t};")
    w("/* End PBXNativeTarget section */")

    # PBXProject
    w("")
    w("/* Begin PBXProject section */")
    w(f"\t\t{ids['project']} /* Project object */ = {{")
    w("\t\t\tisa = PBXProject;")
    w("\t\t\tattributes = {")
    w("\t\t\t\tBuildIndependentTargetsInParallel = 1;")
    w("\t\t\t\tLastSwiftUpdateCheck = 1520;")
    w("\t\t\t\tLastUpgradeCheck = 1520;")
    w("\t\t\t\tTargetAttributes = {")
    w(f"\t\t\t\t\t{ids['app_target']} = {{")
    w("\t\t\t\t\t\tCreatedOnToolsVersion = 15.2;")
    w("\t\t\t\t\t};")
    w(f"\t\t\t\t\t{ids['test_target']} = {{")
    w("\t\t\t\t\t\tCreatedOnToolsVersion = 15.2;")
    w(f"\t\t\t\t\t\tTestTargetID = {ids['app_target']};")
    w("\t\t\t\t\t};")
    w("\t\t\t\t};")
    w("\t\t\t};")
    w(f"\t\t\tbuildConfigurationList = {ids['project_config_list']};")
    w("\t\t\tcompatibilityVersion = \"Xcode 14.0\";")
    w("\t\t\tdevelopmentRegion = en;")
    w("\t\t\thasScannedForEncodings = 0;")
    w("\t\t\tknownRegions = (")
    w("\t\t\t\ten,")
    w("\t\t\t\tBase,")
    w("\t\t\t);")
    w(f"\t\t\tmainGroup = {main_group};")
    w(f"\t\t\tproductRefGroup = {products_group} /* Products */;")
    w("\t\t\tprojectDirPath = \"\";")
    w("\t\t\tprojectRoot = \"\";")
    w("\t\t\ttargets = (")
    w(f"\t\t\t\t{ids['app_target']} /* {APP} */,")
    w(f"\t\t\t\t{ids['test_target']} /* {TESTS} */,")
    w("\t\t\t);")
    w("\t\t};")
    w("/* End PBXProject section */")

    # PBXResourcesBuildPhase
    w("")
    w("/* Begin PBXResourcesBuildPhase section */")
    w(f"\t\t{ids['app_resources']} /* Resources */ = {{")
    w("\t\t\tisa = PBXResourcesBuildPhase;")
    w("\t\t\tbuildActionMask = 2147483647;")
    w("\t\t\tfiles = (")
    for bid in app_resource_build_files:
        w(f"\t\t\t\t{bid},")
    w("\t\t\t);")
    w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    w("\t\t};")
    w("/* End PBXResourcesBuildPhase section */")

    # PBXSourcesBuildPhase
    w("")
    w("/* Begin PBXSourcesBuildPhase section */")
    for phase_id, files in ((ids["app_sources"], app_source_build_files),
                            (ids["test_sources"], test_source_build_files)):
        w(f"\t\t{phase_id} /* Sources */ = {{")
        w("\t\t\tisa = PBXSourcesBuildPhase;")
        w("\t\t\tbuildActionMask = 2147483647;")
        w("\t\t\tfiles = (")
        for bid in sorted(files):
            w(f"\t\t\t\t{bid},")
        w("\t\t\t);")
        w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
        w("\t\t};")
    w("/* End PBXSourcesBuildPhase section */")

    # PBXTargetDependency
    w("")
    w("/* Begin PBXTargetDependency section */")
    w(f"\t\t{ids['dependency']} /* PBXTargetDependency */ = {{")
    w("\t\t\tisa = PBXTargetDependency;")
    w(f"\t\t\ttarget = {ids['app_target']} /* {APP} */;")
    w(f"\t\t\ttargetProxy = {ids['container_proxy']} /* PBXContainerItemProxy */;")
    w("\t\t};")
    w("/* End PBXTargetDependency section */")

    # XCBuildConfiguration
    shared = [
        ("ALWAYS_SEARCH_USER_PATHS", "NO"),
        ("ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS", "YES"),
        ("CLANG_ANALYZER_NONNULL", "YES"),
        ("CLANG_ENABLE_MODULES", "YES"),
        ("CLANG_ENABLE_OBJC_ARC", "YES"),
        ("COPY_PHASE_STRIP", "NO"),
        ("ENABLE_STRICT_OBJC_MSGSEND", "YES"),
        ("ENABLE_USER_SCRIPT_SANDBOXING", "YES"),
        ("GCC_C_LANGUAGE_STANDARD", "gnu17"),
        ("GCC_NO_COMMON_BLOCKS", "YES"),
        ("IPHONEOS_DEPLOYMENT_TARGET", DEPLOYMENT_TARGET),
        ("LOCALIZATION_PREFERS_STRING_CATALOGS", "YES"),
        ("MTL_FAST_MATH", "YES"),
        ("SDKROOT", "iphoneos"),
        ("SWIFT_STRICT_CONCURRENCY", "minimal"),
        ("SWIFT_VERSION", SWIFT_VERSION),
    ]
    debug_only = [
        ("DEBUG_INFORMATION_FORMAT", "dwarf"),
        ("ENABLE_TESTABILITY", "YES"),
        ("GCC_DYNAMIC_NO_PIC", "NO"),
        ("GCC_OPTIMIZATION_LEVEL", "0"),
        ("GCC_PREPROCESSOR_DEFINITIONS", '"DEBUG=1 $(inherited)"'),
        ("MTL_ENABLE_DEBUG_INFO", "INCLUDE_SOURCE"),
        ("ONLY_ACTIVE_ARCH", "YES"),
        ("SWIFT_ACTIVE_COMPILATION_CONDITIONS", '"DEBUG $(inherited)"'),
        ("SWIFT_OPTIMIZATION_LEVEL", '"-Onone"'),
    ]
    release_only = [
        ("DEBUG_INFORMATION_FORMAT", '"dwarf-with-dsym"'),
        ("ENABLE_NS_ASSERTIONS", "NO"),
        ("MTL_ENABLE_DEBUG_INFO", "NO"),
        ("SWIFT_COMPILATION_MODE", "wholemodule"),
        ("VALIDATE_PRODUCT", "YES"),
    ]
    app_settings = [
        ("ASSETCATALOG_COMPILER_APPICON_NAME", "AppIcon"),
        ("ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME", "AccentColor"),
        ("CODE_SIGN_STYLE", "Automatic"),
        ("CURRENT_PROJECT_VERSION", "1"),
        ("ENABLE_PREVIEWS", "YES"),
        ("GENERATE_INFOPLIST_FILE", "NO"),
        ("INFOPLIST_FILE", f"{APP}/Resources/Info.plist"),
        ("LD_RUNPATH_SEARCH_PATHS", '(\n\t\t\t\t\t"$(inherited)",\n\t\t\t\t\t"@executable_path/Frameworks",\n\t\t\t\t)'),
        ("MARKETING_VERSION", "1.0"),
        ("PRODUCT_BUNDLE_IDENTIFIER", BUNDLE_ID),
        ("PRODUCT_NAME", '"$(TARGET_NAME)"'),
        ("SUPPORTS_MACCATALYST", "NO"),
        ("SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD", "NO"),
        ("SWIFT_EMIT_LOC_STRINGS", "YES"),
        ("TARGETED_DEVICE_FAMILY", '"1"'),
    ]
    test_settings = [
        ("ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES", "YES"),
        ("BUNDLE_LOADER", '"$(TEST_HOST)"'),
        ("CODE_SIGN_STYLE", "Automatic"),
        ("CURRENT_PROJECT_VERSION", "1"),
        ("GENERATE_INFOPLIST_FILE", "YES"),
        ("MARKETING_VERSION", "1.0"),
        ("PRODUCT_BUNDLE_IDENTIFIER", f"{BUNDLE_ID}.tests"),
        ("PRODUCT_NAME", '"$(TARGET_NAME)"'),
        ("TARGETED_DEVICE_FAMILY", '"1"'),
        ("TEST_HOST", f'"$(BUILT_PRODUCTS_DIR)/{APP}.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/{APP}"'),
    ]

    def emit_config(config_id, name, settings):
        w(f"\t\t{config_id} /* {name} */ = {{")
        w("\t\t\tisa = XCBuildConfiguration;")
        w("\t\t\tbuildSettings = {")
        for key, value in settings:
            w(f"\t\t\t\t{key} = {value};")
        w("\t\t\t};")
        w(f"\t\t\tname = {name};")
        w("\t\t};")

    w("")
    w("/* Begin XCBuildConfiguration section */")
    emit_config(ids["project_debug"], "Debug", sorted(shared + debug_only))
    emit_config(ids["project_release"], "Release", sorted(shared + release_only))
    emit_config(ids["app_debug"], "Debug", app_settings)
    emit_config(ids["app_release"], "Release", app_settings)
    emit_config(ids["test_debug"], "Debug", test_settings)
    emit_config(ids["test_release"], "Release", test_settings)
    w("/* End XCBuildConfiguration section */")

    # XCConfigurationList
    w("")
    w("/* Begin XCConfigurationList section */")
    for list_id, label, debug_id, release_id in (
        (ids["project_config_list"], f"PBXProject \"{APP}\"", ids["project_debug"], ids["project_release"]),
        (ids["app_config_list"], f"PBXNativeTarget \"{APP}\"", ids["app_debug"], ids["app_release"]),
        (ids["test_config_list"], f"PBXNativeTarget \"{TESTS}\"", ids["test_debug"], ids["test_release"]),
    ):
        w(f"\t\t{list_id} /* Build configuration list for {label} */ = {{")
        w("\t\t\tisa = XCConfigurationList;")
        w("\t\t\tbuildConfigurations = (")
        w(f"\t\t\t\t{debug_id} /* Debug */,")
        w(f"\t\t\t\t{release_id} /* Release */,")
        w("\t\t\t);")
        w("\t\t\tdefaultConfigurationIsVisible = 0;")
        w("\t\t\tdefaultConfigurationName = Release;")
        w("\t\t};")
    w("/* End XCConfigurationList section */")

    w("\t};")
    w(f"\trootObject = {ids['project']} /* Project object */;")
    w("}")

    project_dir = os.path.join(ROOT, f"{APP}.xcodeproj")
    os.makedirs(project_dir, exist_ok=True)
    with open(os.path.join(project_dir, "project.pbxproj"), "w") as handle:
        handle.write("\n".join(out) + "\n")

    write_scheme(project_dir, ids, app_product, test_product)
    print(f"wrote {os.path.relpath(project_dir, ROOT)}/project.pbxproj "
          f"({len(app_source_build_files)} app sources, {len(test_source_build_files)} test sources)")


def write_scheme(project_dir, ids, app_product, test_product):
    schemes = os.path.join(project_dir, "xcshareddata", "xcschemes")
    os.makedirs(schemes, exist_ok=True)
    scheme = f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1520"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{ids['app_target']}"
               BuildableName = "{APP}.app"
               BlueprintName = "{APP}"
               ReferencedContainer = "container:{APP}.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
         <TestableReference
            skipped = "NO">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{ids['test_target']}"
               BuildableName = "{TESTS}.xctest"
               BlueprintName = "{TESTS}"
               ReferencedContainer = "container:{APP}.xcodeproj">
            </BuildableReference>
         </TestableReference>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{ids['app_target']}"
            BuildableName = "{APP}.app"
            BlueprintName = "{APP}"
            ReferencedContainer = "container:{APP}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{ids['app_target']}"
            BuildableName = "{APP}.app"
            BlueprintName = "{APP}"
            ReferencedContainer = "container:{APP}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
"""
    with open(os.path.join(schemes, f"{APP}.xcscheme"), "w") as handle:
        handle.write(scheme)


if __name__ == "__main__":
    sys.exit(main())
