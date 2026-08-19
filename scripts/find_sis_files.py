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
import glob
import pandas as pd

dirs_to_check = [
    r"F:\Smriti-Clients Data\Tattly Threads",
    r"F:\SMRITRretailNX\TT",
    r"F:\Smriti-Clients Data",
    r"C:\Users\netma\Downloads",
    r"F:\SMRITRretailNX"
]

target_sis = ['TW07', 'TUK5', 'TYAC']

for d in dirs_to_check:
    if os.path.exists(d):
        print(f"Checking directory: {d}")
        for root, dirs, files in os.walk(d):
            for f in files:
                if f.endswith(".xlsx") or f.endswith(".xls") or f.endswith(".csv"):
                    full_path = os.path.join(root, f)
                    try:
                        if f.endswith(".csv"):
                            df = pd.read_csv(full_path, dtype=str)
                            for s in target_sis:
                                matches = df[df.apply(lambda row: row.astype(str).str.contains(s, case=False, na=False).any(), axis=1)]
                                if len(matches) > 0:
                                    print(f"  --> MATCH {s} in CSV: {full_path}")
                                    print(matches)
                        else:
                            xl = pd.ExcelFile(full_path)
                            for sh in xl.sheet_names:
                                df = xl.parse(sh, dtype=str)
                                for s in target_sis:
                                    matches = df[df.apply(lambda row: row.astype(str).str.contains(s, case=False, na=False).any(), axis=1)]
                                    if len(matches) > 0:
                                        print(f"  --> MATCH {s} in {full_path} (Sheet: {sh})")
                                        print(matches)
                    except Exception as e:
                        # print(f"Error {full_path}: {e}")
                        pass
