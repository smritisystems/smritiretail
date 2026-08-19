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

base = r"F:\Smriti-Clients Data\Tattly Threads\Invoice"
excel_files = [
    "Tattly_Threads_Consolidated_PO_Extraction.xlsx",
    "Tattly_Threads_Consolidated_PO_Extraction2.xlsx",
    "All_86_Bills_Audit_12_and_14_Aug.xlsx",
    "RIL_Dispatch_09-08-2026.xlsx",
    "RIL_Dispatch_09-08-2026-1.xlsx",
    "RIL FINAL LIST.xlsx"
]

target_sis = ['TW07', 'TUK5', 'TYAC']

for ef in excel_files:
    fp = os.path.join(base, ef)
    if os.path.exists(fp):
        print(f"\n==================== {ef} ====================")
        try:
            xl = pd.ExcelFile(fp)
            for sh in xl.sheet_names:
                df = xl.parse(sh, dtype=str)
                for s in target_sis:
                    matches = df[df.apply(lambda row: row.astype(str).str.contains(s, case=False, na=False).any(), axis=1)]
                    if len(matches) > 0:
                        print(f"[{ef} -> {sh}] MATCH {s}: {len(matches)} rows")
                        for idx, r in matches.iterrows():
                            print("  Row:", dict(r.dropna()))
        except Exception as e:
            print(f"Error {ef}: {e}")
