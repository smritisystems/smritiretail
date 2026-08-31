"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI HTML Language Share Audit (Read-Only)
"""

import os, sys, subprocess, json, re
from pathlib import Path

repo_root = Path("F:/SMRITRretailNX")

# 1. Get git-tracked html/htm files
try:
    res = subprocess.run(
        ["git", "ls-files", "*.html", "*.htm"],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
        check=True
    )
    tracked_files = [f.strip() for f in res.stdout.splitlines() if f.strip()]
except Exception as e:
    tracked_files = []

# Also find all filesystem html/htm files (excluding node_modules, .git, venv)
all_fs_files = []
for root, dirs, files in os.walk(repo_root):
    # prune common ignored dirs
    dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache')]
    for f in files:
        if f.lower().endswith(('.html', '.htm')):
            rel = Path(root, f).relative_to(repo_root).as_posix()
            all_fs_files.append(rel)

target_files = sorted(list(set(tracked_files if tracked_files else all_fs_files)))
print(f"Total HTML/HTM files found: {len(target_files)}")

# 2. Search references for each file across the codebase
# Pre-cache all text files in repo for fast reference search
search_files = []
for root, dirs, files in os.walk(repo_root):
    dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', 'dist', 'build')]
    for f in files:
        if f.endswith(('.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.yml', '.yaml', '.md', '.html', '.htm', '.sh', '.bat', '.ps1')):
            search_files.append(Path(root, f).relative_to(repo_root).as_posix())

print(f"Total searchable source files: {len(search_files)}")

def find_references(rel_path):
    basename = Path(rel_path).name
    stem = Path(rel_path).stem
    exact_refs = []
    
    # regex patterns to look for
    p_exact = re.compile(re.escape(basename), re.IGNORECASE)
    p_rel = re.compile(re.escape(rel_path), re.IGNORECASE)
    
    for sf in search_files:
        if sf == rel_path:
            continue
        try:
            full_p = repo_root / sf
            content = full_p.read_text(encoding='utf-8', errors='ignore')
            if p_exact.search(content) or p_rel.search(content):
                exact_refs.append(sf)
        except Exception:
            pass
    return exact_refs

# 3. Categorize files
# Categories: RUNTIME_UI, PRINT_PDF, EMAIL_TEMPLATE, STATIC, LEGACY, GENERATED, TEST_FIXTURE, UNKNOWN
def categorize_file(rel_path, refs, content):
    p_lower = rel_path.lower()
    base_lower = Path(rel_path).name.lower()
    
    if "index.html" == base_lower and ("src" in p_lower or p_lower == "index.html"):
        return "RUNTIME_UI"
    if "test" in p_lower or "fixture" in p_lower or "mock" in p_lower or "test_playwright" in p_lower:
        return "TEST_FIXTURE"
    if "generated" in p_lower or "output" in p_lower or "report" in p_lower or "systemconfigurationcheck_report" in p_lower or "coverage" in p_lower:
        return "GENERATED"
    if "print" in p_lower or "invoice" in p_lower or "pdf" in p_lower or "pos_receipt" in p_lower or "tax_invoice" in p_lower or "barcode" in p_lower or "template" in p_lower:
        return "PRINT_PDF"
    if "email" in p_lower or "mail" in p_lower or "newsletter" in p_lower:
        return "EMAIL_TEMPLATE"
    if "legacy" in p_lower or "archive" in p_lower or "backup" in p_lower or "old" in p_lower:
        return "LEGACY"
    if "static" in p_lower or "docs" in p_lower or "public" in p_lower:
        return "STATIC"
    
    # Check content clues
    if "jinja" in content or "{{ " in content or "{% " in content:
        if "invoice" in content.lower() or "receipt" in content.lower() or "print" in content.lower():
            return "PRINT_PDF"
        if "email" in content.lower() or "subject:" in content.lower():
            return "EMAIL_TEMPLATE"
        return "PRINT_PDF"
        
    if refs:
        # Check referring files
        if any("pdf" in r.lower() or "print" in r.lower() or "invoice" in r.lower() for r in refs):
            return "PRINT_PDF"
        if any("test" in r.lower() for r in refs):
            return "TEST_FIXTURE"
            
    return "UNKNOWN"

file_details = []

for rel in target_files:
    full_path = repo_root / rel
    if not full_path.is_file():
        continue
    
    bytes_count = full_path.stat().st_size
    try:
        content = full_path.read_text(encoding='utf-8', errors='ignore')
        lines_count = len(content.splitlines())
    except Exception:
        content = ""
        lines_count = 0
        
    refs = find_references(rel)
    cat = categorize_file(rel, refs, content)
    
    file_details.append({
        'path': rel,
        'bytes': bytes_count,
        'lines': lines_count,
        'directory': Path(rel).parent.as_posix(),
        'runtime_reference': len(refs) > 0,
        'referenced_by': refs,
        'category': cat,
        'is_tracked': rel in tracked_files
    })

# Totals
total_bytes = sum(f['bytes'] for f in file_details)
total_lines = sum(f['lines'] for f in file_details)

print(f"\nTotal HTML Bytes: {total_bytes:,} bytes")
print(f"Total HTML Lines: {total_lines:,} lines")

# By category
cat_stats = {}
for f in file_details:
    cat = f['category']
    if cat not in cat_stats:
        cat_stats[cat] = {'bytes': 0, 'lines': 0, 'count': 0, 'files': []}
    cat_stats[cat]['bytes'] += f['bytes']
    cat_stats[cat]['lines'] += f['lines']
    cat_stats[cat]['count'] += 1
    cat_stats[cat]['files'].append(f)

# Top 30 largest
top_30 = sorted(file_details, key=lambda x: x['bytes'], reverse=True)[:30]

# Candidate cleanup files
# Unused, generated, test fixture, or duplicate HTML files
cleanup_candidates = []
for f in file_details:
    if f['category'] in ('GENERATED', 'LEGACY', 'UNKNOWN') and len(f['referenced_by']) == 0:
        cleanup_candidates.append(f)
    elif f['category'] == 'TEST_FIXTURE' and 'tmp' in f['path'].lower() and len(f['referenced_by']) == 0:
        cleanup_candidates.append(f)

# Save JSON results
audit_data = {
    'total_files': len(file_details),
    'total_bytes': total_bytes,
    'total_lines': total_lines,
    'categories': {k: {'bytes': v['bytes'], 'lines': v['lines'], 'count': v['count'], 'pct_bytes': round(v['bytes']/total_bytes*100, 2) if total_bytes else 0} for k, v in cat_stats.items()},
    'top_30': top_30,
    'cleanup_candidates': cleanup_candidates,
    'all_files': file_details
}

with open("backend/html_language_share_audit.json", "w", encoding="utf-8") as out:
    json.dump(audit_data, out, indent=2)

print("\nAudit completed and saved to backend/html_language_share_audit.json")
