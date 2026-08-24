"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import re

v_dir = r"F:\SMRITRretailNX\backend\alembic\versions"
files = [f for f in os.listdir(v_dir) if f.endswith(".py")]
rev_map = {}
down_map = {}

for f in files:
    with open(os.path.join(v_dir, f), "r", encoding="utf-8", errors="ignore") as fh:
        c = fh.read()
    r = re.search(r"revision\s*:\s*.*?\s*=\s*[\"'](.*?)[\"']", c) or re.search(r"revision\s*=\s*[\"'](.*?)[\"']", c)
    d = re.search(r"down_revision\s*:\s*.*?\s*=\s*[\"'](.*?)[\"']", c) or re.search(r"down_revision\s*=\s*[\"'](.*?)[\"']", c)
    r_val = r.group(1) if r else "UNKNOWN"
    d_val = d.group(1) if d else None
    rev_map[r_val] = (f, d_val)
    if d_val:
        down_map.setdefault(d_val, []).append(r_val)

print(f"Total migration files: {len(files)}")
heads = [r for r in rev_map if r not in down_map]
print("Heads:", heads)
for h in heads:
    print("  Head:", h, "->", rev_map[h])

print("\nKey versions:")
for k in ["v1346_pos_cash_denominations", "v1360_pos_sct_fk_constraints", "v1370_tenant_capability_binding_status", "v1374", "v1375"]:
    if k in rev_map:
        print(f"  {k}: file={rev_map[k][0]} | down={rev_map[k][1]} | children={down_map.get(k)}")
