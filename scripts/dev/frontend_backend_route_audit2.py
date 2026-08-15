import os
import sys
import re
import json
from pathlib import Path

# Setup environment for backend import
os.environ['JWT_SECRET_KEY'] = 'testsecret123'
os.environ['SGIP_VAULT_MASTER_KEY'] = 'testvaultkey'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///./test.db'
os.environ['PYTHONPATH'] = os.pathsep.join([os.environ.get('PYTHONPATH',''), os.path.abspath('backend')])
sys.path.insert(0, 'backend')

from app.main import app

backend_routes = set(r.path for r in app.routes if r.path.startswith('/api'))

# Remove comments to avoid false-positive matches in comments
comment_re = re.compile(r'//.*?$|/\*.*?\*/', re.DOTALL | re.MULTILINE)

root = Path('src')
regexes = {
    'apiFetchV1': re.compile(r'apiFetchV1\(\s*["`\']([^"`\']*)["`\']'),
    'apiFetch': re.compile(r'apiFetch\(\s*["`\']([^"`\']*)["`\']'),
    'fetch': re.compile(r'fetch\(\s*["`\']([^"`\']*)["`\']'),
    'axios': re.compile(r'axios\.(?:get|post|put|delete|patch)\(\s*["`\']([^"`\']*)["`\']'),
}

matches = {}
for path in sorted(root.rglob('*.ts*')):
    text = path.read_text(encoding='utf-8', errors='ignore')
    text_nocomments = re.sub(comment_re, '', text)
    found = []
    for helper, regex in regexes.items():
        for m in regex.finditer(text_nocomments):
            endpoint = m.group(1)
            if not endpoint.startswith('/'):
                endpoint = '/' + endpoint
            if helper == 'apiFetchV1':
                endpoint = '/api/v1' + endpoint
            found.append((endpoint, helper))
    if found:
        matches[str(path)] = sorted(set(found))

frontend_paths = set(endpoint for entries in matches.values() for endpoint, _ in entries)
exact_matches = sorted(p for p in frontend_paths if p in backend_routes)
unmatched = sorted(p for p in frontend_paths if p not in backend_routes)

potential_mappings = []
for p in unmatched:
    if p.startswith('/api/') and not p.startswith('/api/v1/'):
        candidate = '/api/v1' + p[4:]
        if candidate in backend_routes:
            potential_mappings.append((p, candidate))

# Map backend routes never referenced by frontend
unused_backend_routes = sorted(r for r in backend_routes if r not in frontend_paths)

output = {
    'backend_route_count': len(backend_routes),
    'frontend_path_count': len(frontend_paths),
    'exact_match_count': len(exact_matches),
    'unmatched_count': len(unmatched),
    'exact_matches': exact_matches[:200],
    'unmatched_sample': unmatched[:200],
    'potential_mappings': potential_mappings[:200],
    'frontend_files_with_api_calls': sorted(matches.keys()),
    'unused_backend_routes_count': len(unused_backend_routes),
    'unused_backend_routes_sample': unused_backend_routes[:200],
}
with open('frontend_backend_route_audit2.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)
print('wrote frontend_backend_route_audit2.json')
