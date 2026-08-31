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

def inspect_frontend():
    print("=== FRONTEND SEARCH: AWE, SAEF, THEME, LAYOUT, LOCALSTORAGE ===")
    
    files = glob.glob(r"F:\SMRITRretailNX\src\**\*.ts*", recursive=True) + glob.glob(r"F:\SMRITRretailNX\src\**\*.css", recursive=True)

    keywords = {
        "AWE / SAEF": [r"AWE", r"SAEF", r"SIMPLE", r"HYBRID", r"ADVANCED", r"AdaptiveWorkspace", r"max_clicks", r"max_fields"],
        "Theme / Tokens": [r"theme", r"design_tokens", r"dark", r"light", r"density", r"accent", r"smriti-theme"],
        "Layout / Navigation": [r"layout_store", r"registeredWorkspaces", r"onTabChange", r"sidebar", r"dock"],
        "Storage / Cache": [r"localStorage", r"sessionStorage", r"indexedDB"],
        "Form / Field Config": [r"fieldVisibility", r"columnVisibility", r"field_order", r"quick_actions"]
    }

    results = {k: set() for k in keywords}

    for f in files:
        rel_path = os.path.relpath(f, r"F:\SMRITRretailNX")
        content = open(f, "r", encoding="utf-8", errors="ignore").read()
        
        for category, patterns in keywords.items():
            for pat in patterns:
                if re.search(r'\b' + pat + r'\b', content, re.IGNORECASE):
                    results[category].add(rel_path)
                    break

    for cat, matched_files in results.items():
        print(f"\nCategory: {cat} (Matched {len(matched_files)} files):")
        for mf in sorted(list(matched_files))[:15]:
            print(f"  - {mf}")

if __name__ == "__main__":
    inspect_frontend()
