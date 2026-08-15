import os
import glob
import re

expr = []
for p in glob.glob('src/routes/*.ts'):
    with open(p, encoding='utf-8') as f:
        t = f.read()
    expr.extend([
        (m.group(1).upper(), m.group(2), os.path.basename(p))
        for m in re.finditer(r'router\.(get|post|put|delete|patch)\("(/api/[^"]*)"', t)
    ])

frontend = set()
for dirpath, _, files in os.walk('src'):
    for fn in files:
        if fn.endswith(('.ts', '.tsx')):
            p = os.path.join(dirpath, fn)
            with open(p, encoding='utf-8') as f:
                t = f.read()
            for m in re.finditer(r'"(/api/(?!v1)[^"\']*)"|\'(/api/(?!v1)[^"\']*)\'', t):
                frontend.add(m.group(1) or m.group(2))

print('EXPRESS ROUTES')
for m in sorted(expr):
    print(f'{m[0]} {m[1]} ({m[2]})')
print()
print('FRONTEND LEGACY REFERENCES')
for u in sorted(frontend):
    print(u)
