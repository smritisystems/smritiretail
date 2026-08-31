"""
Forensic Analysis of All HTML Files in Repository (Tracked + Filesystem + History)
"""
import os, sys, subprocess, json, re
from pathlib import Path

repo_root = Path("F:/SMRITRretailNX")

# 1. Collect all HTML files on filesystem (ignoring node_modules and .git)
fs_html = []
for root, dirs, files in os.walk(repo_root):
    dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache')]
    for f in files:
        if f.lower().endswith(('.html', '.htm')):
            rel = Path(root, f).relative_to(repo_root).as_posix()
            fs_html.append(rel)

# 2. Get tracked status
res = subprocess.run(["git", "ls-files", "*.html", "*.htm"], cwd=str(repo_root), capture_output=True, text=True)
tracked_set = set(f.strip() for f in res.stdout.splitlines() if f.strip())

# 3. Categorize each file
# Categories: RUNTIME_UI, PRINT_PDF, EMAIL_TEMPLATE, STATIC, LEGACY, GENERATED, TEST_FIXTURE, UNKNOWN
def classify(path_str):
    p = path_str.lower()
    if path_str == "index.html" or path_str == "src/index.html":
        return "RUNTIME_UI"
    if "coverage/" in p or "dist/" in p:
        return "GENERATED"
    if "exports/" in p or "exported_pdf" in p:
        return "GENERATED"
    if "scratch/" in p:
        return "TEST_FIXTURE"
    if "backend/app/templates/" in p:
        return "PRINT_PDF"
    if "presentation/" in p or "docs/" in p:
        return "STATIC"
    if "toot/" in p or "pos_" in p:
        return "LEGACY"
    if "email" in p or "mail" in p:
        return "EMAIL_TEMPLATE"
    return "UNKNOWN"

file_records = []
for rel in sorted(fs_html):
    full_p = repo_root / rel
    b = full_p.stat().st_size
    try:
        content = full_p.read_text(encoding='utf-8', errors='ignore')
        lines = len(content.splitlines())
    except Exception:
        content = ""
        lines = 0
        
    cat = classify(rel)
    
    # Check runtime references
    is_tracked = rel in tracked_set
    
    file_records.append({
        'path': rel,
        'bytes': b,
        'lines': lines,
        'directory': Path(rel).parent.as_posix(),
        'category': cat,
        'is_tracked': is_tracked
    })

total_bytes = sum(f['bytes'] for f in file_records)
total_lines = sum(f['lines'] for f in file_records)

# Category breakdown
cat_summary = {}
for f in file_records:
    c = f['category']
    if c not in cat_summary:
        cat_summary[c] = {'bytes': 0, 'lines': 0, 'count': 0}
    cat_summary[c]['bytes'] += f['bytes']
    cat_summary[c]['lines'] += f['lines']
    cat_summary[c]['count'] += 1

print(f"Total HTML files on disk: {len(file_records)}")
print(f"Total HTML Bytes: {total_bytes:,}")
print(f"Total HTML Lines: {total_lines:,}\n")

print("=== CATEGORY BREAKDOWN (All Filesystem HTML) ===")
for c, d in sorted(cat_summary.items(), key=lambda x: x[1]['bytes'], reverse=True):
    pct_b = (d['bytes'] / total_bytes) * 100
    pct_l = (d['lines'] / total_lines) * 100
    print(f"{c:15} | Files: {d['count']:3} | Bytes: {d['bytes']:10,} ({pct_b:5.2f}%) | Lines: {d['lines']:8,} ({pct_l:5.2f}%)")

# Top 30 largest
top_30 = sorted(file_records, key=lambda x: x['bytes'], reverse=True)[:30]

with open("backend/html_forensic_breakdown.json", "w", encoding="utf-8") as out:
    json.dump({
        'total_files': len(file_records),
        'total_bytes': total_bytes,
        'total_lines': total_lines,
        'categories': cat_summary,
        'top_30': top_30,
        'all_files': file_records
    }, out, indent=2)

print("\nSaved breakdown to backend/html_forensic_breakdown.json")
