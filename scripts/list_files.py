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

for path in [r"F:\Smriti-Clients Data\Tattly Threads\Invoice", r"F:\SMRITRretailNX\TT"]:
    if os.path.exists(path):
        print(f"=== Files in {path} ===")
        for f in os.listdir(path):
            print(" ", f)
