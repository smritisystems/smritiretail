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

import sys, os, glob

sys.stdout.reconfigure(encoding='utf-8')

OLD_NAME = "smritisys"
NEW_NAME = "smritisys"

def update_references():
    print("============================================================")
    print(f"UPDATING DATABASE REFERENCES FROM {OLD_NAME} TO {NEW_NAME}")
    print("============================================================")

    file_patterns = [
        r"F:\SMRITRretailNX\backend\**\*.py",
        r"F:\SMRITRretailNX\scripts\**\*.py",
        r"F:\SMRITRretailNX\docs\**\*.md",
        r"F:\SMRITRretailNX\**\.env*",
    ]

    updated_files = 0
    total_replacements = 0

    for pat in file_patterns:
        for filepath in glob.glob(pat, recursive=True):
            if "migrate_db_to_smritisys.py" in filepath:
                continue
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                if OLD_NAME in content:
                    count = content.count(OLD_NAME)
                    new_content = content.replace(OLD_NAME, NEW_NAME)
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    
                    rel = os.path.relpath(filepath, r"F:\SMRITRretailNX")
                    print(f"  - Updated {rel} ({count} occurrences)")
                    updated_files += 1
                    total_replacements += count
            except Exception as e:
                print(f"⚠️ Error reading {filepath}: {e}")

    print("\n============================================================")
    print(f"REFERENCE UPDATE COMPLETE: Updated {updated_files} files ({total_replacements} total replacements).")
    print("============================================================")

if __name__ == "__main__":
    update_references()
