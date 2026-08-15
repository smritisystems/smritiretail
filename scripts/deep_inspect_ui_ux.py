"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os, glob, re

sys.stdout.reconfigure(encoding='utf-8')

def deep_inspect():
    print("=== THEME & DESIGN TOKENS AUDIT ===")
    css_files = glob.glob(r"F:\SMRITRretailNX\src\**\*.css", recursive=True)
    for cf in css_files:
        content = open(cf, "r", encoding="utf-8", errors="ignore").read()
        vars_found = re.findall(r"(--theme-[a-zA-Z0-9_-]+)", content)
        print(f"CSS File: {os.path.basename(cf):<25} | Vars Count: {len(set(vars_found))} | Sample Vars: {list(set(vars_found))[:5]}")

    print("\n=== LOCAL STORAGE PREFERENCES AUDIT ===")
    ts_files = glob.glob(r"F:\SMRITRretailNX\src\**\*.ts*", recursive=True)
    storage_keys = set()
    for tf in ts_files:
        content = open(tf, "r", encoding="utf-8", errors="ignore").read()
        keys = re.findall(r'localStorage\.(?:getItem|setItem)\(\s*"([^"]+)"', content)
        storage_keys.update(keys)
    
    print("Discovered localStorage Keys:")
    for k in sorted(list(storage_keys)):
        print(f"  - {k}")

if __name__ == "__main__":
    deep_inspect()
