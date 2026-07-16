import os
import sys
import re
import json
from pathlib import Path

os.environ['JWT_SECRET_KEY'] = 'testsecret123'
os.environ['SGIP_VAULT_MASTER_KEY'] = 'testvaultkey'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///./test.db'
os.environ['PYTHONPATH'] = os.pathsep.join([os.environ.get('PYTHONPATH', ''), os.path.abspath('backend')])
sys.path.insert(0, 'backend')

from app.main import app
backend_routes = set(r.path for r in app.routes if r.path.startswith('/api'))
root = Path('src')
regexes = [
    re.compile(r'apiFetchV1\(\s*["\'](/[^"\']*)["\']'),
    re.compile(r'apiFetch\(\s*["\'](/[^"\']*)["\']'),
    re.compile(r'fetch\(\s*["\'](/[^"\']*)["\']'),
    re.compile(r'axios\.(?:get|post|put|delete|patch)\(\s*["\'](/[^"\']*)["\']'),
    re.compile(r'["\'](/api(?:/v1)?/[^"\']*)["\']'),
]

matches = {}
for path in root.rglob('*.ts*'):
    text = path.read_text(encoding='utf-8', errors='ignore')
    found = set()
    for regex in regexes:
        for m in regex.finditer(text):
            found.add(m.group(1))
    if found:
        matches[str(path)] = sorted(found)

frontend_paths = set(p for paths in matches.values() for p in paths)
exact_matches = sorted(p for p in frontend_paths if p in backend_routes)
unmatched = sorted(p for p in frontend_paths if p not in backend_routes)
potential_mappings = []
for p in unmatched:
    if p.startswith('/api/v1/'):
        continue
    if p.startswith('/api/'):
        candidate = '/api/v1' + p[4:]
        if candidate in backend_routes:
            potential_mappings.append((p, candidate))
    if p.startswith('/api') and not p.startswith('/api/v1'):
        candidate = p.replace('/api', '/api/v1', 1)
        if candidate in backend_routes:
            potential_mappings.append((p, candidate))

output = {
    'backend_route_count': len(backend_routes),
    'frontend_path_count': len(frontend_paths),
    'exact_match_count': len(exact_matches),
    'unmatched_count': len(unmatched),
    'unmatched_sample': unmatched[:100],
    'potential_mappings': potential_mappings[:100],
    'frontend_files_with_api_calls': sorted(matches.keys())
}
with open('frontend_backend_route_audit.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)
print('wrote frontend_backend_route_audit.json')
