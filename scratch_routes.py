import os
import re

api_dir = 'backend/app/api/v1'
routes = []
for fname in sorted(os.listdir(api_dir)):
    if not fname.endswith('.py'):
        continue
    fpath = os.path.join(api_dir, fname)
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        for line_no, line in enumerate(f, 1):
            m = re.match(r'@router\.(get|post|put|patch|delete)\s*\(\s*["\']([^"\']*)["\']', line.strip())
            if m:
                routes.append((fname, m.group(1).upper(), m.group(2)))

print(f"Total endpoints found: {len(routes)}")
for f, method, path in sorted(routes):
    if any(k in path.lower() or k in f.lower() for k in ['query', 'exec', 'sql', 'db', 'data', 'triage', 'admin', 'sync', 'maintenance']):
        print(f"{f:25} {method:6} {path}")
