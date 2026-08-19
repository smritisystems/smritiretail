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
from pypdf import PdfReader

files = [
    r"exports\all_54_pdf_invoices\8319_TT2026-2027_73.pdf",
    r"exports\Final_TaxInvoice\8319_TT2026-2027_73.pdf",
    r"exports\Final_TaxInvoice\S4NN_8319_TT2026-2027_73.pdf",
    r"exports\Old_Invoices\SIS_8319_TaxInvoice_TT2026-2027_73.pdf",
    r"TT\Pending\SIS_8319_TaxInvoice_TT2026-2027_73.pdf",
    r"TT\Pending\updated\8319_TT2026-2027_73.pdf"
]

for f in files:
    if os.path.exists(f):
        print(f"=== File: {f} ===")
        reader = PdfReader(f)
        text = reader.pages[0].extract_text()
        print(text[:400])
        print("...")
