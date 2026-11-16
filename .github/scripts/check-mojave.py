#!/usr/bin/env python3
"""Mojave gate: fail if any Mach-O binary inside the given .app declares a
minimum macOS version above 10.14, or the app's Info.plist does."""
import os
import plistlib
import sys

import lief

TARGET = (10, 14, 0)


def min_os_versions(binary):
    results = []
    for cmd in binary.commands:
        cname = cmd.__class__.__name__
        if cname == "BuildVersion":
            results.append(tuple(cmd.minos))
        elif cname == "VersionMin":
            v = cmd.version
            if isinstance(v, (list, tuple)):
                results.append(tuple(v))
            else:
                v = int(v)
                results.append(((v >> 16) & 0xFFFF, (v >> 8) & 0xFF, v & 0xFF))
    return results


def iter_binaries(path):
    try:
        parsed = lief.parse(path)
    except Exception:
        return
    if parsed is None:
        return
    if isinstance(parsed, lief.MachO.FatBinary):
        yield from parsed
    elif isinstance(parsed, lief.MachO.Binary):
        yield parsed


def main():
    app = sys.argv[1]
    failures = []
    checked = 0

    plist_path = os.path.join(app, "Contents", "Info.plist")
    with open(plist_path, "rb") as fh:
        plist = plistlib.load(fh)
    ls_min = plist.get("LSMinimumSystemVersion")
    if ls_min:
        parts = tuple(int(p) for p in str(ls_min).split("."))
        parts = parts + (0,) * (3 - len(parts))
        if parts > TARGET:
            failures.append(f"Info.plist LSMinimumSystemVersion {ls_min} > 10.14")
        print(f"Info.plist LSMinimumSystemVersion: {ls_min}")

    for root, _dirs, files in os.walk(app):
        for name in files:
            path = os.path.join(root, name)
            for binary in iter_binaries(path):
                checked += 1
                for version in min_os_versions(binary):
                    if version > TARGET:
                        failures.append(
                            f"{os.path.relpath(path, app)} declares min macOS "
                            f"{'.'.join(map(str, version))} > 10.14"
                        )
    print(f"Mach-O binaries checked: {checked}")
    if failures:
        print("MOJAVE GATE FAILED:")
        for failure in failures:
            print(" -", failure)
        sys.exit(1)
    print("MOJAVE GATE PASSED: every binary declares min macOS <= 10.14")


if __name__ == "__main__":
    main()
