import os
import re

src_dir = 'src'
components = []
for root, dirs, files in os.walk(os.path.join(src_dir, 'components')):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            components.append(os.path.join(root, f).replace('\\', '/'))

all_src_files = []
for root, dirs, files in os.walk(src_dir):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            all_src_files.append(os.path.join(root, f).replace('\\', '/'))

file_contents = {}
for sf in all_src_files:
    try:
        with open(sf, 'r', encoding='utf-8', errors='ignore') as fp:
            file_contents[sf] = fp.read()
    except Exception:
        pass

# Category 1: Modals & Dialogs
modals = [c for c in components if ('Modal' in c or 'Dlg' in c or 'Dialog' in c) and not c.endswith('.test.ts')]

modal_report = []
for m in modals:
    name = os.path.splitext(os.path.basename(m))[0]
    content = file_contents.get(m, '')
    imported_by = [sf for sf, c in file_contents.items() if sf != m and name in c]
    has_api = ('apiFetch' in content) or ('/api/v1' in content) or ('fetch(' in content)
    rendered = any(('<' + name in file_contents.get(sf, '')) for sf in imported_by)
    modal_report.append({
        'path': m,
        'name': name,
        'imported_count': len(imported_by),
        'rendered': rendered,
        'has_api': has_api
    })

print('=== MODALS / DIALOGS AUDIT ===')
print('Total Modals/Dialogs:', len(modal_report))
unref_modals = [m for m in modal_report if m['imported_count'] == 0]
import_only_modals = [m for m in modal_report if m['imported_count'] > 0 and not m['rendered']]
rendered_no_api = [m for m in modal_report if m['rendered'] and not m['has_api']]
rendered_with_api = [m for m in modal_report if m['rendered'] and m['has_api']]

print(f'Unreferenced Modals (Orphaned): {len(unref_modals)}')
for m in unref_modals:
    print(f"  - [Unreferenced] {m['path']} (has_api={m['has_api']})")

print(f'\nImport-Only Modals (Imported but never mounted in JSX): {len(import_only_modals)}')
for m in import_only_modals:
    print(f"  - [Import-Only] {m['path']} (has_api={m['has_api']})")

print(f'\nRendered Modals with NO Backend API (Pure client mock/in-memory): {len(rendered_no_api)}')
for m in rendered_no_api:
    print(f"  - [Rendered NO API] {m['path']}")

# Category 2: Tabs / Workspaces / Studios
workspaces = [c for c in components if any(k in os.path.basename(c) for k in ['Tab', 'Ws', 'Studio', 'Desk', 'Section']) and not ('Modal' in c or 'Dlg' in c or 'Dialog' in c) and not c.endswith('.test.ts')]

print(f'\n=== WORKSPACES / TABS / STUDIOS AUDIT (Total: {len(workspaces)}) ===')
ws_unref = []
ws_no_api = []
ws_rendered_with_api = []
for w in workspaces:
    name = os.path.splitext(os.path.basename(w))[0]
    content = file_contents.get(w, '')
    imported_by = [sf for sf, c in file_contents.items() if sf != w and name in c]
    has_api = ('apiFetch' in content) or ('/api/v1' in content) or ('fetch(' in content)
    rendered = any(('<' + name in file_contents.get(sf, '')) for sf in imported_by)
    if len(imported_by) == 0:
        ws_unref.append(w)
    elif not has_api:
        ws_no_api.append(w)
    else:
        ws_rendered_with_api.append(w)

print(f'Unreferenced Tabs/Workspaces: {len(ws_unref)}')
for w in ws_unref:
    print(f'  - [Unreferenced Tab/Ws] {w}')

print(f'\nReferenced Tabs/Workspaces with NO Backend API: {len(ws_no_api)}')
for w in ws_no_api:
    print(f'  - [Referenced Tab/Ws NO API] {w}')
