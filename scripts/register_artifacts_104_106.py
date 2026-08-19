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
import sys
import io
import uuid
import hashlib
import psycopg2

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
cur = conn.cursor()

invoices = [
    ("TT2026-2027/104", "TUK5", "inv-tt-104", 2, r"F:\SMRITRretailNX\exports\tt_batch_104_106\SIS_TUK5_TaxInvoice_TT2026-2027_104.pdf"),
    ("TT2026-2027/105", "TYAC", "inv-tt-105", 3, r"F:\SMRITRretailNX\exports\tt_batch_104_106\SIS_TYAC_TaxInvoice_TT2026-2027_105.pdf"),
    ("TT2026-2027/106", "TW07", "inv-tt-106", 4, r"F:\SMRITRretailNX\exports\tt_batch_104_106\SIS_TW07_TaxInvoice_TT2026-2027_106.pdf"),
]

for inv_no, sis, inv_id, pages, pdf_path in invoices:
    if os.path.exists(pdf_path):
        with open(pdf_path, "rb") as f:
            b = f.read()
        sha256 = hashlib.sha256(b).hexdigest()
        size = len(b)
        
        cur.execute("DELETE FROM invoice_document_artifacts WHERE invoice_no = %s;", (inv_no,))
        cur.execute("""
            INSERT INTO invoice_document_artifacts (
                id, uuid, company_id, branch_id, invoice_id, invoice_no,
                document_type, template_code, template_version, template_status,
                storage_path, sha256_hash, file_size, page_count,
                generated_at, modified_at, created_by, is_active, is_deleted,
                is_valid, reprint_count, created_at, version, artifact_subtype, source_type
            )
            VALUES (
                %s, %s, 'COMP-001', 'MAIN', %s, %s,
                'TAX_INVOICE', 'TAX_INVOICE_TATTLY_THREADS', 'V1', 'FROZEN',
                %s, %s, %s, %s,
                NOW(), NOW(), 'SYSTEM', true, false,
                true, 0, NOW(), 1, 'CANONICAL', 'LIVE'
            );
        """, (
            f"art-{inv_id}", str(uuid.uuid4()), inv_id, inv_no,
            pdf_path, sha256, size, pages
        ))
        print(f"[OK] Registered artifact for {inv_no} (SHA256: {sha256[:12]}..., Size: {size} bytes, Pages: {pages})")

conn.commit()
conn.close()
