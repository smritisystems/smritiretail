"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from app.core.gstr2b_reconciler import (
    GstReconciliationEngine,
    PurchaseInvoiceRecord,
    Gstr2bRecord,
    ReconciliationStatus,
)

def test_gstr2b_reconciliation_categories():
    books = [
        # Matched invoice
        PurchaseInvoiceRecord("INV-101", "27AAACS1234A1Z1", "2026-07-01", 10000.0, cgst=900.0, sgst=900.0),
        # Mismatched tax
        PurchaseInvoiceRecord("INV-102", "27AAACS1234A1Z1", "2026-07-05", 20000.0, cgst=1800.0, sgst=1800.0),
        # Missing in GSTR-2B
        PurchaseInvoiceRecord("INV-103", "09BBBCC5678B1Z2", "2026-07-10", 5000.0, cgst=450.0, sgst=450.0),
    ]

    gstr2b = [
        # Matched invoice
        Gstr2bRecord("INV-101", "27AAACS1234A1Z1", "2026-07-01", 10000.0, cgst=900.0, sgst=900.0),
        # Mismatched tax (Supplier filed 12% instead of 18%)
        Gstr2bRecord("INV-102", "27AAACS1234A1Z1", "2026-07-05", 20000.0, cgst=1200.0, sgst=1200.0),
        # Missing in books
        Gstr2bRecord("INV-999", "07DDDEE9012C1Z3", "2026-07-12", 8000.0, igst=1440.0),
    ]

    engine = GstReconciliationEngine(tolerance=1.0)
    summary = engine.reconcile(books, gstr2b)

    assert summary.matched_count == 1
    assert summary.tax_mismatch_count == 1
    assert summary.missing_in_gstr2b_count == 1
    assert summary.missing_in_books_count == 1

    # Eligible ITC should cap at GSTR-2B amount for mismatched invoice
    assert summary.eligible_itc_claimable == (1800.0 + 2400.0)
