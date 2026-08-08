#!/usr/bin/env python3
"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

import os
import re
import sys
from pathlib import Path

# Repository root
REPO_ROOT = Path(__file__).resolve().parent.parent

# Excluded directory names
EXCLUDED_DIRS = {
    "node_modules", "vendor", "third_party", "dist", "build",
    "coverage", ".next", ".venv", ".git", ".pytest_cache",
    "__pycache__", "backups", "run_logs", "test-results",
    "myImages", "Presentation", "DemoAndIssues", "DemoTraining", ".wiki_clone", ".wiki_init_tmp", "versions"
}

# Excluded file extensions & filenames
EXCLUDED_EXTS = {
    ".png", ".jpg", ".jpeg", ".ico", ".gif", ".zip", ".pdf", ".exe",
    ".dll", ".so", ".dylib", ".pyc", ".pyo", ".pyd", ".db", ".sqlite",
    ".sqlite3", ".log", ".txt", ".bin", ".tar", ".gz", ".7z"
}

EXCLUDED_FILES = {
    "package-lock.json", "db_store.json", "metadata.json", "platform.json",
    "product.json", "repository.json", "smriti-config.json", "desktop.ini"
}

# Canonical Full Author Signature for Public Docs / Architectures / Constitutions / AUTHORS.md
FULL_AUTHOR_SIGNATURE_MARKDOWN = """# AUTHORS

## Author, Creator & Chief Systems Architect

**Jawahar Ramkripal Mallah**

### Founder
- SmritiSys
- AITDL Networks

### Creator
- SMRITI Retail OS

### Responsibilities
- Product Vision
- Product Strategy
- Platform Architecture
- Enterprise Architecture
- UX Architecture
- Inventory Kernel Architecture
- Platform Constitution
- Engineering Standards & Governance

### Websites
- smritisys.com
- smritibooks.com
- aitdl.com

### Contact
- jawahar.mallah@gmail.com

---

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

# Short Source Headers by file type
SHORT_HEADER_PYTHON = '''"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""'''

SHORT_HEADER_JS = '''/*
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
*/'''

SHORT_HEADER_SQL = '''-- Author & Creator:
-- Jawahar Ramkripal Mallah
--
-- Founder:
-- SmritiSys
-- AITDL Networks
--
-- Role:
-- Chief Systems Architect
--
-- Web:
-- smritisys.com | smritibooks.com | aitdl.com
--
-- Email:
-- jawahar.mallah@gmail.com
--
-- Copyright © 2026 SmritiSys.
-- All Rights Reserved.'''

SHORT_HEADER_MARKDOWN_COMMENT = '''<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->'''

SHORT_HEADER_HASH = '''# Author & Creator:
# Jawahar Ramkripal Mallah
#
# Founder:
# SmritiSys
# AITDL Networks
#
# Role:
# Chief Systems Architect
#
# Web:
# smritisys.com | smritibooks.com | aitdl.com
#
# Email:
# jawahar.mallah@gmail.com
#
# Copyright © 2026 SmritiSys.
# All Rights Reserved.'''

# Public architecture docs that receive the full signature in markdown format
PUBLIC_DOC_FILES = {
    "INVENTORY_KERNEL_CONSTITUTION.md",
    "REPOSITORY_CONSTITUTION.md",
    "RC2_INVENTORY_KERNEL_CERTIFICATION.md",
    "ADR_001_return_pending_semantics.md",
    "CONSUMER_CERTIFICATION_MATRIX.md",
    "AUTHORS.md"
}

# Regex to detect if canonical short or full signature is already present
CANONICAL_CHECK_PATTERN = re.compile(
    r"Jawahar\s+Ramkripal\s+Mallah.*(?:smritisys\.com|jawahar\.mallah@gmail\.com|Copyright\s+©\s+2026\s+SmritiSys)",
    re.DOTALL | re.IGNORECASE
)

# Pattern to detect legacy / old header docstrings to replace
OLD_HEADER_DOCSTRING_PY = re.compile(
    r'^\s*"""\s*(?:Project|Author|Organization|Founders|Copyright).*?"""',
    re.DOTALL | re.IGNORECASE
)

OLD_HEADER_COMMENT_MD = re.compile(
    r'^\s*<!--\s*(?:Project|Author|Organization|Founders|Copyright).*?-->',
    re.DOTALL | re.IGNORECASE
)

OLD_HEADER_JS = re.compile(
    r'^\s*/\*\*\s*(?:Project|Author|Organization|Founders|Copyright).*?\*/',
    re.DOTALL | re.IGNORECASE
)


def is_excluded(path: Path) -> bool:
    for parent in path.parents:
        if parent.name in EXCLUDED_DIRS:
            return True
    if path.name in EXCLUDED_DIRS or path.name in EXCLUDED_FILES:
        return True
    if path.suffix.lower() in EXCLUDED_EXTS:
        return True
    return False


def process_python(content: str) -> tuple[str, bool, bool]:
    """Returns (new_content, was_updated, already_compliant)"""
    # Extract any from __future__ import statement
    future_pattern = re.compile(r'^(from\s+__future__\s+import\s+[^\n]+\n?)', re.MULTILINE)
    future_match = future_pattern.search(content)
    future_line = ""
    clean_content = content
    if future_match:
        future_line = future_match.group(1).rstrip() + "\n"
        clean_content = future_pattern.sub("", content)

    # Check if canonical header is present in clean_content
    is_compliant = bool(CANONICAL_CHECK_PATTERN.search(clean_content[:1000]))

    if is_compliant:
        # Ensure future_line is at the very top
        if future_line:
            # Strip future line if it was already at top, re-prepend
            lines = clean_content.lstrip().splitlines(keepends=True)
            new_content = future_line + "".join(lines)
            if new_content != content:
                return new_content, True, False
        return content, False, True

    # If clean_content starts with an old docstring header, replace it
    if OLD_HEADER_DOCSTRING_PY.match(clean_content):
        new_rest = OLD_HEADER_DOCSTRING_PY.sub(SHORT_HEADER_PYTHON, clean_content, count=1)
    else:
        new_rest = SHORT_HEADER_PYTHON + "\n\n" + clean_content.lstrip()

    new_content = future_line + new_rest if future_line else new_rest
    return new_content, True, False


def process_js_ts(content: str) -> tuple[str, bool, bool]:
    """Returns (new_content, was_updated, already_compliant)"""
    if CANONICAL_CHECK_PATTERN.search(content[:600]):
        return content, False, True

    if OLD_HEADER_JS.match(content):
        new_content = OLD_HEADER_JS.sub(SHORT_HEADER_JS, content, count=1)
    else:
        new_content = SHORT_HEADER_JS + "\n\n" + content.lstrip()

    return new_content, True, False


def process_sql(content: str) -> tuple[str, bool, bool]:
    """Returns (new_content, was_updated, already_compliant)"""
    if CANONICAL_CHECK_PATTERN.search(content[:600]):
        return content, False, True

    new_content = SHORT_HEADER_SQL + "\n\n" + content.lstrip()
    return new_content, True, False


def process_markdown(content: str, filename: str) -> tuple[str, bool, bool]:
    """Returns (new_content, was_updated, already_compliant)"""
    if CANONICAL_CHECK_PATTERN.search(content[:600]):
        return content, False, True

    if filename in PUBLIC_DOC_FILES or filename == "AUTHORS.md":
        # Full Author signature at top or replacing old header
        if OLD_HEADER_COMMENT_MD.match(content):
            new_content = OLD_HEADER_COMMENT_MD.sub(FULL_AUTHOR_SIGNATURE_MARKDOWN, content, count=1)
        else:
            new_content = FULL_AUTHOR_SIGNATURE_MARKDOWN + "\n\n" + content.lstrip()
    else:
        # Internal doc receives comment short header
        if OLD_HEADER_COMMENT_MD.match(content):
            new_content = OLD_HEADER_COMMENT_MD.sub(SHORT_HEADER_MARKDOWN_COMMENT, content, count=1)
        else:
            new_content = SHORT_HEADER_MARKDOWN_COMMENT + "\n\n" + content.lstrip()

    return new_content, True, False


def process_hash_comment(content: str) -> tuple[str, bool, bool]:
    """For Shell, PowerShell, YAML files"""
    if CANONICAL_CHECK_PATTERN.search(content[:600]):
        return content, False, True

    lines = content.splitlines(keepends=True)
    shebang = ""
    rest_lines = lines
    if lines and (lines[0].startswith("#!") or lines[0].startswith("#!/")):
        shebang = lines[0]
        rest_lines = lines[1:]

    rest_content = "".join(rest_lines)
    new_content = shebang + SHORT_HEADER_HASH + "\n\n" + rest_content.lstrip()
    return new_content, True, False


def main():
    print("Starting SMRITI Retail OS Author Signature Audit...")

    # Ensure AUTHORS.md exists
    authors_file = REPO_ROOT / "AUTHORS.md"
    if not authors_file.exists():
        authors_file.write_text(FULL_AUTHOR_SIGNATURE_MARKDOWN + "\n", encoding="utf-8")
        print("Created AUTHORS.md with canonical signature.")

    total_scanned = 0
    updated = 0
    already_compliant = 0
    skipped = 0
    manual_review = 0

    updated_files = []

    # Directories to traverse
    target_dirs = [
        REPO_ROOT / "backend",
        REPO_ROOT / "frontend",
        REPO_ROOT / "docs",
        REPO_ROOT / "scripts",
        REPO_ROOT / ".agents",
        REPO_ROOT / "validation",
    ]

    # Target root files
    root_files = [f for f in REPO_ROOT.iterdir() if f.is_file()]

    all_files = []
    for d in target_dirs:
        if d.exists():
            for p in d.rglob("*"):
                if p.is_file():
                    all_files.append(p)

    for rf in root_files:
        all_files.append(rf)

    for path in all_files:
        total_scanned += 1

        if is_excluded(path):
            skipped += 1
            continue

        ext = path.suffix.lower()
        if ext not in {".py", ".ts", ".tsx", ".js", ".jsx", ".sql", ".md", ".sh", ".ps1", ".yml", ".yaml", ".bat"}:
            skipped += 1
            continue

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            print(f"Error reading {path}: {e}")
            manual_review += 1
            continue

        new_content = content
        was_updated = False
        compliant = False

        if ext == ".py":
            new_content, was_updated, compliant = process_python(content)
        elif ext in {".ts", ".tsx", ".js", ".jsx"}:
            new_content, was_updated, compliant = process_js_ts(content)
        elif ext == ".sql":
            new_content, was_updated, compliant = process_sql(content)
        elif ext == ".md":
            new_content, was_updated, compliant = process_markdown(content, path.name)
        elif ext in {".sh", ".ps1", ".yml", ".yaml", ".bat"}:
            new_content, was_updated, compliant = process_hash_comment(content)

        if compliant:
            already_compliant += 1
        elif was_updated:
            path.write_text(new_content, encoding="utf-8")
            updated += 1
            updated_files.append(str(path.relative_to(REPO_ROOT)))

    print("\n--- AUTHOR SIGNATURE AUDIT REPORT ---")
    print(f"Total files scanned    : {total_scanned}")
    print(f"Files updated          : {updated}")
    print(f"Files already compliant: {already_compliant}")
    print(f"Files skipped/excluded : {skipped}")
    print(f"Manual review required : {manual_review}")
    print("------------------------------------\n")

    if updated_files:
        print(f"Sample updated files (first 10 of {len(updated_files)}):")
        for u in updated_files[:10]:
            print(f"  - {u}")


if __name__ == "__main__":
    main()
