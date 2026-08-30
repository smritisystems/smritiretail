"""
Calculate repository language share according to GitHub Linguist rules
"""
import subprocess, os
from pathlib import Path
import json

repo_root = Path("F:/SMRITRretailNX")

res = subprocess.run(["git", "ls-files"], cwd=str(repo_root), capture_output=True, text=True, check=True)
tracked_files = [f.strip() for f in res.stdout.splitlines() if f.strip()]

# Extensions recognized by GitHub Linguist as programming/markup languages (excluding prose/data like MD, JSON, YAML)
LANGUAGE_MAP = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.py': 'Python',
    '.html': 'HTML',
    '.htm': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.sql': 'SQL',
    '.sh': 'Shell',
    '.ps1': 'PowerShell',
    '.bat': 'Batchfile'
}

lang_stats = {}
total_code_bytes = 0
total_code_lines = 0

for rel in tracked_files:
    full_path = repo_root / rel
    if not full_path.is_file():
        continue
    ext = full_path.suffix.lower()
    if ext not in LANGUAGE_MAP:
        continue
    
    lang = LANGUAGE_MAP[ext]
    b = full_path.stat().st_size
    try:
        lines = len(full_path.read_text(encoding='utf-8', errors='ignore').splitlines())
    except Exception:
        lines = 0
        
    if lang not in lang_stats:
        lang_stats[lang] = {'bytes': 0, 'lines': 0, 'files': 0}
    lang_stats[lang]['bytes'] += b
    lang_stats[lang]['lines'] += lines
    lang_stats[lang]['files'] += 1
    total_code_bytes += b
    total_code_lines += lines

print("=== REPOSITORY LANGUAGE STATS (Git Tracked Code Files) ===")
print(f"Total Code Bytes: {total_code_bytes:,} bytes")
print(f"Total Code Lines: {total_code_lines:,} lines\n")

for lang, data in sorted(lang_stats.items(), key=lambda x: x[1]['bytes'], reverse=True):
    pct_bytes = (data['bytes'] / total_code_bytes) * 100 if total_code_bytes else 0
    pct_lines = (data['lines'] / total_code_lines) * 100 if total_code_lines else 0
    print(f"{lang:15} | Files: {data['files']:4} | Bytes: {data['bytes']:10,} ({pct_bytes:5.2f}%) | Lines: {data['lines']:8,} ({pct_lines:5.2f}%)")
