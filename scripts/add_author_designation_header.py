#!/usr/bin/env python3
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.14.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
scripts/add_author_designation_header.py
One-off repo hygiene sweep. Idempotent — safe to re-run;
already-compliant files are left untouched.
Usage: python add_author_designation_header.py --dry-run
       python add_author_designation_header.py            (applies changes)
"""
import re
import subprocess
import sys
from pathlib import Path
from datetime import date

REPO_ROOT = Path(__file__).resolve().parent.parent
TARGET_EXTS = {".py", ".ts", ".tsx", ".md"}
EXCLUDE_DIRS = {"node_modules", "dist", "build", ".git", "__pycache__", ".venv", "venv"}

AUTHOR_NAME = "Jawahar Ramkripal Mallah"
DESIGNATION = "Chief Systems Architect & Creator"
EMAIL = "support@smritibooks.com"
WEBSITES = "smritibooks.com | erpnbook.com | aitdl.com"
COPYRIGHT_LINE = "\u00a9 SMRITIBooks.com. All Rights Reserved."
LICENSE_LINE = "Proprietary Commercial Software"
DEFAULT_VERSION = "3.14.0"  # CONFIRM against backend/app/core/config.py Settings.VERSION before running

FIELD_WIDTH = 13


def pad(label: str) -> str:
    return label.ljust(FIELD_WIDTH)


def git_created_date(path: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "log", "--follow", "--diff-filter=A", "--format=%ad", "--date=short", "--", str(path)],
            cwd=REPO_ROOT, capture_output=True, text=True, check=True,
        ).stdout.strip().splitlines()
        return out[-1] if out else date.today().isoformat()
    except Exception:
        return date.today().isoformat()


def sibling_version(path: Path) -> str:
    for sib in path.parent.glob(f"*{path.suffix}"):
        if sib == path:
            continue
        try:
            text = read_preserving_newlines(sib)[:2000]
        except Exception:
            continue
        m = re.search(r"Version\s*:\s*([0-9.]+)", text)
        if m:
            return m.group(1)
    return DEFAULT_VERSION


def style_for(path: Path) -> str:
    if path.suffix == ".py":
        return "py"
    if path.suffix in (".ts", ".tsx"):
        return "ts"
    return "md"


def build_lines(version: str, created: str) -> list[str]:
    modified = date.today().isoformat()
    return [
        f"{pad('Project')}: SMRITI Retail OS",
        f"{pad('Author')}: {AUTHOR_NAME}",
        f"{pad('Designation')}: {DESIGNATION}",
        f"{pad('Email')}: {EMAIL}",
        f"{pad('Websites')}: {WEBSITES}",
        f"{pad('Version')}: {version}",
        f"{pad('Created')}: {created}",
        f"{pad('Modified')}: {modified}",
        f"{pad('Copyright')}: {COPYRIGHT_LINE}",
        f"{pad('License')}: {LICENSE_LINE}",
    ]


def render_block(lines: list[str], style: str) -> str:
    if style == "py":
        return '"""\n' + "\n".join(lines) + '\n"""\n'
    if style == "ts":
        return "/**\n" + "\n".join(f" * {l}" for l in lines) + "\n */\n"
    return "<!--\n" + "\n".join(f"  {l}" for l in lines) + "\n-->\n"


def insertion_point(text: str, path: Path) -> int:
    if path.suffix == ".py":
        m = re.match(r"^(#!.*\n)?(#.*coding.*\n)?", text)
        return m.end() if m else 0
    if path.suffix in (".ts", ".tsx"):
        m = re.match(r"^(['\"]use (client|strict)['\"];\s*\n)", text)
        return m.end() if m else 0
    return 0


def read_preserving_newlines(path: Path) -> str:
    # newline="" disables Python's universal-newline translation so existing
    # \r\n / \n in the file are read back exactly as they are on disk.
    with path.open("r", encoding="utf-8", newline="") as f:
        return f.read()


def write_preserving_newlines(path: Path, text: str) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        f.write(text)


def process(path: Path, dry_run: bool) -> str:
    try:
        text = read_preserving_newlines(path)
    except Exception:
        return "skipped-unreadable"

    head = text[:3000]

    if "Founders" in head:
        return "skipped-founders"
    if re.search(r"Designation\s*:", head):
        return "skipped-complete"

    author_match = re.search(
        rf"^([ \t]*[*]?[ \t]*)Author(\s*):\s*{re.escape(AUTHOR_NAME)}\s*$",
        text, re.MULTILINE,
    )

    if author_match:
        prefix = author_match.group(1)
        line_end = text.index("\n", author_match.end())
        designation_line = f"\n{prefix}{pad('Designation')}: {DESIGNATION}"
        new_text = text[: line_end] + designation_line + text[line_end:]
        if not dry_run:
            write_preserving_newlines(path, new_text)
        return "designation-added"

    version = sibling_version(path)
    created = git_created_date(path)
    block = render_block(build_lines(version, created), style_for(path))
    at = insertion_point(text, path)
    new_text = text[:at] + block + "\n" + text[at:]
    if not dry_run:
        write_preserving_newlines(path, new_text)
    return "header-added"


def main():
    dry_run = "--dry-run" in sys.argv
    staged_only = "--staged" in sys.argv
    results: dict[str, list[str]] = {}

    if staged_only:
        try:
            out = subprocess.run(
                ["git", "diff", "--cached", "--name-only", "--diff-filter=d"],
                cwd=REPO_ROOT, capture_output=True, text=True, check=True
            ).stdout.strip().splitlines()
            paths = [REPO_ROOT / f for f in out if f]
        except Exception as e:
            print(f"Error fetching staged files: {e}")
            sys.exit(1)
    else:
        paths = REPO_ROOT.rglob("*")

    for path in paths:
        if not path.is_file() or path.suffix not in TARGET_EXTS:
            continue
        if any(part in EXCLUDE_DIRS for part in path.parts):
            continue
        if "alembic" in path.parts and "versions" in path.parts:
            continue

        status = process(path, dry_run)
        results.setdefault(status, []).append(str(path.relative_to(REPO_ROOT)))

    mode = "DRY RUN — no files written" if dry_run else "APPLIED"
    print(f"\n===== {mode} =====")
    for status, files in sorted(results.items()):
        print(f"\n--- {status} ({len(files)}) ---")
        for f in sorted(files):
            print(f"  {f}")


if __name__ == "__main__":
    main()
