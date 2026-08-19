"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-08-19
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
import pandas as pd

search_terms = ['TW07', 'Commercial Street', '5182778', 'TUK5', 'TYAC']

base_dir = r"F:\Smriti-Clients Data\Tattly Threads"
print(f"Scanning {base_dir}...")
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith(".xlsx") or f.endswith(".xls") or f.endswith(".csv"):
            fp = os.path.join(root, f)
            try:
                if f.endswith(".csv"):
                    df = pd.read_csv(fp, dtype=str)
                    for term in search_terms:
                        matches = df[df.apply(lambda row: row.astype(str).str.contains(term, case=False, na=False).any(), axis=1)]
                        if len(matches) > 0:
                            print(f"[{fp}] MATCH '{term}': {len(matches)} rows")
                else:
                    xl = pd.ExcelFile(fp)
                    for sh in xl.sheet_names:
                        df = xl.parse(sh, dtype=str)
                        for term in search_terms:
                            matches = df[df.apply(lambda row: row.astype(str).str.contains(term, case=False, na=False).any(), axis=1)]
                            if len(matches) > 0:
                                print(f"[{fp} -> {sh}] MATCH '{term}': {len(matches)} rows")
                                if term == 'TW07' or term == 'Commercial Street':
                                    print(matches)
            except Exception as e:
                pass
