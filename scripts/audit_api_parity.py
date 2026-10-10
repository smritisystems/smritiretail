import os
import re

# 1. Collect all API endpoints called in frontend
frontend_dir = 'src'
api_calls = set()

endpoint_pattern = re.compile(r"""(?:apiFetchV1|apiFetch|fetch)\s*\(\s*[`'"](/api/v1/[^`'"]+|/[^`'"]+)[`'"]""")

for root, dirs, files in os.walk(frontend_dir):
    for f in files:
        if f.endswith('.ts') or f.endswith('.tsx') or f.endswith('.js'):
            filepath = os.path.join(root, f)
            try:
                content = open(filepath, 'r', encoding='utf-8', errors='ignore').read()
                matches = endpoint_pattern.findall(content)
                for m in matches:
                    # Clean up query params and path params (${...} or :id)
                    clean_m = m.split('?')[0]
                    # Normalize /api/v1 prefix
                    if clean_m.startswith('/api/v1'):
                        clean_m = clean_m[len('/api/v1'):]
                    if not clean_m.startswith('/'):
                        clean_m = '/' + clean_m
                    # collapse ${...} to {param}
                    clean_m = re.sub(r'\$\{[^}]+\}', '{param}', clean_m)
                    api_calls.add((clean_m, filepath.replace('\\', '/')))
            except Exception:
                pass

print(f"Total unique frontend API route calls: {len(api_calls)}")

# 2. Collect all backend routes from backend/app/api/v1 and backend/app/main.py
backend_routes = set()
backend_dir = os.path.join('backend', 'app', 'api', 'v1')

route_pattern = re.compile(r"""@router\.(?:get|post|put|delete|patch|options)\s*\(\s*["']([^"']+)["']""")

for root, dirs, files in os.walk(backend_dir):
    for f in files:
        if f.endswith('.py'):
            filepath = os.path.join(root, f)
            try:
                content = open(filepath, 'r', encoding='utf-8', errors='ignore').read()
                matches = route_pattern.findall(content)
                for m in matches:
                    clean_m = m.split('?')[0]
                    clean_m = re.sub(r'\{[^}]+\}', '{param}', clean_m)
                    backend_routes.add((clean_m, filepath.replace('\\', '/')))
            except Exception:
                pass

print(f"Total registered backend routes in v1: {len(backend_routes)}")

# Check prefix inclusions from router registrations in backend/app/api/v1/__init__.py
# or FastAPI include_router
router_prefixes = {}
init_file = os.path.join('backend', 'app', 'api', 'v1', '__init__.py')
if os.path.exists(init_file):
    init_content = open(init_file, 'r', encoding='utf-8').read()
    # router.include_router(xyz.router, prefix="/abc", tags=[...])
    inc_pattern = re.compile(r"""include_router\s*\(\s*([a-zA-Z0-9_]+)\.router\s*,\s*prefix\s*=\s*["']([^"']+)["']""")
    for var, pfx in inc_pattern.findall(init_content):
        router_prefixes[var] = pfx

print(f"Router prefixes detected: {len(router_prefixes)}")

# Print sample frontend endpoints
print("\nSample unique frontend API paths:")
unique_fe_paths = sorted(list(set(c[0] for c in api_calls)))
for p in unique_fe_paths[:30]:
    print("  ", p)
