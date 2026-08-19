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

import openpyxl

fp = r"F:\Smriti-Clients Data\Tattly Threads\Invoice\Tattly_Threads_Consolidated_PO_Extraction.xlsx"
wb = openpyxl.load_workbook(fp, read_only=True, data_only=True)
ws = wb['PO_Summary_Register']
for row in ws.iter_rows(values_only=True):
    print(row[0], row[1], row[2], row[4])
