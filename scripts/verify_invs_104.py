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
import hashlib
import psycopg2
from pypdf import PdfReader

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def verify_all():
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()

    invoices_to_check = [
        ("TT2026-2027/104", "TUK5", 36, 48, 55244.00, 52613.76, 2630.69, "5182778198", 2),
        ("TT2026-2027/105", "TYAC", 42, 56, 64216.00, 61157.76, 3057.89, "5182778209", 3),
        ("TT2026-2027/106", "TW07", 84, 112, 129376.00, 123215.36, 6160.77, "PO-PENDING", 4),
    ]

    print("================================================================================")
    print("                     INVOICES 104 - 106 VERIFICATION REPORT                      ")
    print("================================================================================")

    for inv_no, sis, exp_lines, exp_pairs, exp_gt, exp_taxable, exp_tax, exp_po, exp_pages in invoices_to_check:
        print(f"\n--- Checking Invoice: {inv_no} (SIS: {sis}) ---")
        cur.execute("""
            SELECT id, invoice_no, date, sis_code, po_reference, customer_name, customer_gstin,
                   pos_state, taxable_value, tax_total, rounding_amount, grand_total, amount_in_words,
                   billing_address, shipping_address, site_name
            FROM sales_invoices
            WHERE invoice_no = %s;
        """, (inv_no,))
        row = cur.fetchone()
        assert row is not None, f"Invoice {inv_no} missing from database"
        inv_id, _, date, sis_code, po_ref, cust_name, gstin, state, tx_val, tax_tot, rnd, gt, words, bill_addr, ship_addr, site = row

        print(f"  DB ID               : {inv_id}")
        print(f"  Date                : {date}")
        print(f"  SIS Code            : {sis_code}")
        print(f"  PO Reference        : {po_ref}")
        print(f"  Customer GSTIN      : {gstin} ({state})")
        print(f"  Taxable Value (DB)  : Rs. {float(tx_val):,.2f} (Expected: Rs. {exp_taxable:,.2f})")
        print(f"  Tax Total (DB)      : Rs. {float(tax_tot):,.2f} (Expected: Rs. {exp_tax:,.2f})")
        print(f"  Rounding (DB)       : Rs. {float(rnd):.4f}")
        print(f"  Grand Total (DB)    : Rs. {float(gt):,.2f} (Expected: Rs. {exp_gt:,.2f})")
        print(f"  Amount in Words     : {words}")

        assert float(tx_val) == exp_taxable, f"Taxable value mismatch on {inv_no}"
        assert float(tax_tot) == exp_tax, f"Tax total mismatch on {inv_no}"
        assert float(gt) == exp_gt, f"Grand total mismatch on {inv_no}"
        assert sis_code == sis, f"SIS code mismatch on {inv_no}"

        # Check line items
        cur.execute("""
            SELECT COUNT(*), SUM(quantity), SUM(taxable_value), SUM(tax_amount), SUM(total_amount)
            FROM sales_invoice_items
            WHERE invoice_id = %s;
        """, (inv_id,))
        it_count, it_qty, it_tx, it_tax, it_tot = cur.fetchone()
        print(f"  Line Items Count    : {it_count} (Expected: {exp_lines})")
        print(f"  Total Quantity/Pairs: {int(it_qty)} (Expected: {exp_pairs})")
        assert it_count == exp_lines, f"Line count mismatch on {inv_no}"
        assert int(it_qty) == exp_pairs, f"Quantity mismatch on {inv_no}"

        # PDF Verification
        pdf_path = f"exports/tt_batch_104_106/SIS_{sis}_TaxInvoice_TT2026-2027_{inv_no.split('/')[-1]}.pdf"
        assert os.path.exists(pdf_path), f"PDF missing: {pdf_path}"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        sha256_hash = hashlib.sha256(pdf_bytes).hexdigest()

        reader = PdfReader(pdf_path)
        actual_pages = len(reader.pages)
        print(f"  PDF Path            : {pdf_path}")
        print(f"  PDF SHA256          : {sha256_hash}")
        print(f"  PDF Pages           : {actual_pages} (Expected: {exp_pages})")
        assert actual_pages == exp_pages, f"Page count mismatch on {inv_no}: got {actual_pages}, expected {exp_pages}"

        # Verify text elements
        p1_text = reader.pages[0].extract_text()
        assert inv_no in p1_text, f"Invoice number {inv_no} missing in PDF text"
        assert "64041990" in p1_text, "HSN code missing in PDF text"
        print(f"  [PASS] {inv_no} Verified: Database & PDF integrity 100% compliant.")

    conn.close()
    print("\n================================================================================")
    print("                ALL 3 INVOICES (104, 105, 106) VERIFIED PASSED                 ")
    print("================================================================================")

if __name__ == "__main__":
    verify_all()
