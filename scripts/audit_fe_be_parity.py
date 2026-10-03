import os
import re
import sys

sys.path.insert(0, 'backend')

try:
    from app.main import app
except Exception as e:
    print("Failed to import app:", e)
    sys.exit(1)

# Collect all FastAPI paths
fastapi_routes = {}
for r in app.routes:
    if hasattr(r, 'path'):
        methods = getattr(r, 'methods', None) or ['GET']
        fastapi_routes[r.path] = {
            'methods': list(methods),
            'name': getattr(r, 'name', ''),
            'endpoint': str(getattr(r, 'endpoint', ''))
        }

# Regex for matching dynamic path segments
# e.g. /api/v1/orders/{order_id} -> ^/api/v1/orders/[^/]+$
def route_to_regex(route_path):
    # replace {param:path} with .+
    regex = re.sub(r'\{[^}]+:path\}', r'.+', route_path)
    # replace {param} with [^/]+
    regex = re.sub(r'\{[^}]+\}', r'[^/]+', regex)
    return re.compile(f'^{regex}$')

compiled_routes = [(r, route_to_regex(r)) for r in fastapi_routes.keys()]

# Collect all frontend API calls
frontend_dir = 'src'
endpoint_pattern = re.compile(r"""(?:apiFetchV1|apiFetch|fetch)\s*\(\s*[`'"](/api/v1/[^`'"]+|/[^`'"]+)[`'"]""")

fe_calls = []

for root, dirs, files in os.walk(frontend_dir):
    for f in files:
        if f.endswith('.ts') or f.endswith('.tsx'):
            filepath = os.path.join(root, f).replace('\\', '/')
            try:
                content = open(filepath, 'r', encoding='utf-8', errors='ignore').read()
                matches = endpoint_pattern.findall(content)
                for m in matches:
                    # Distinguish query params from path params in template literals
                    # If ${...} has query-like variable names or ternary query expressions, strip it
                    cleaned = re.sub(r'\$\{(?:params|qs|activeFilter|filter|query)[^}]*\}', '', m)
                    # If template expression contains a ternary like ? `?status=...` : ""
                    if "${" in cleaned and ("?" in cleaned or "qs" in cleaned or "activeFilter" in cleaned):
                        cleaned = re.sub(r'\$\{[^}]*(?:\?|\bqs\b|\bactiveFilter\b).*$', '', cleaned)
                    cleaned = cleaned.split('?')[0].split('&')[0]
                    # Ensure starts with /api/v1
                    if not cleaned.startswith('/api/v1'):
                        api_v1_path = '/api/v1' + (cleaned if cleaned.startswith('/') else '/' + cleaned)
                    else:
                        api_v1_path = cleaned
                    
                    # Convert remaining JS template string interpolation ${...} to dummy value like 1
                    test_path = re.sub(r'\$\{[^}]+\}', '1', api_v1_path)
                    test_path = re.sub(r'\$\{[^}]*$', '1', test_path)
                    
                    fe_calls.append({
                        'raw': m,
                        'normalized': api_v1_path,
                        'test_path': test_path,
                        'file': filepath
                    })
            except Exception:
                pass

print(f"Total frontend API call instances: {len(fe_calls)}")

# Match against FastAPI routes
unmatched_calls = []
matched_calls = []

for call in fe_calls:
    tp = call['test_path']
    # Check direct or regex match
    matched = False
    for r_path, r_regex in compiled_routes:
        if r_regex.match(tp):
            matched = True
            break
    if matched:
        matched_calls.append(call)
    else:
        unmatched_calls.append(call)

print(f"Matched calls: {len(matched_calls)}")
print(f"Unmatched calls: {len(unmatched_calls)}")

# Deduplicate unmatched calls
unmatched_by_path = {}
for u in unmatched_calls:
    p = u['normalized']
    if p not in unmatched_by_path:
        unmatched_by_path[p] = []
    unmatched_by_path[p].append(u['file'])

print(f"\nUnique UNMATCHED frontend API endpoints: {len(unmatched_by_path)}")
for p, files in sorted(unmatched_by_path.items()):
    unique_files = sorted(list(set(files)))
    print(f"  - {p} (called in {len(unique_files)} files: {', '.join(unique_files[:2])})")
