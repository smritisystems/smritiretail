"""
SMRITI Filename Governance Inventory Scanner
Scans src/, backend/, scripts/, docs/ and reports all filenames
with their character counts (including extension).
Outputs a CSV + summary for the rename map.
"""
import os
import csv
import sys
from pathlib import Path

SCAN_DIRS = ["src", "backend", "scripts", "docs"]

SKIP_DIRS = {
    "node_modules", "__pycache__", ".venv", ".git",
    "dist", "build", ".pytest_cache", "coverage",
    "alembic", "migrations",  # version-named by convention
}

SKIP_EXTENSIONS = {
    ".pyc", ".pyo", ".map", ".lock", ".ico", ".png",
    ".jpg", ".jpeg", ".svg", ".woff", ".woff2", ".ttf",
    ".eot", ".gz", ".zip", ".tar", ".pdf", ".xlsx",
    ".csv", ".txt",
}

PREFERRED_MAX = 16
HARD_MAX = 22

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")

rows = []
total = 0
over_preferred = 0
over_hard = 0

for scan_dir in SCAN_DIRS:
    scan_path = ROOT / scan_dir
    if not scan_path.exists():
        continue
    for dirpath, dirnames, filenames in os.walk(scan_path):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for filename in filenames:
            ext = Path(filename).suffix.lower()
            if ext in SKIP_EXTENSIONS:
                continue
            full_path = Path(dirpath) / filename
            rel = full_path.relative_to(ROOT).as_posix()
            length = len(filename)
            total += 1
            flag = ""
            if length > HARD_MAX:
                flag = "HARD_VIOLATION"
                over_hard += 1
            elif length > PREFERRED_MAX:
                flag = "PREFERRED_VIOLATION"
                over_preferred += 1
            rows.append({
                "path": rel,
                "filename": filename,
                "length": length,
                "flag": flag,
            })

rows.sort(key=lambda r: -r["length"])

output = ROOT / "scripts" / "naming_inventory.csv"
with open(output, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["path", "filename", "length", "flag"])
    writer.writeheader()
    writer.writerows(rows)

print(f"Total files scanned : {total}")
print(f"Over preferred (>16): {over_preferred + over_hard}")
print(f"Over hard max  (>22): {over_hard}")
print(f"Within preferred    : {total - over_preferred - over_hard}")
print(f"")
print(f"TOP 40 LONGEST FILENAMES:")
for r in rows[:40]:
    print(f"  [{r['length']:>3}] {r['flag']:<20} {r['filename']}")
print(f"")
print(f"CSV written to: {output}")
