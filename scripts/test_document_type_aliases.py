"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS & SMRITI Systems
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.50.2
Created      : 2026-10-30
Modified     : 2026-10-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Description  : Unit verification for Document Type Aliases and Bidirectional Canonical Resolution
"""

import sys
sys.path.insert(0, 'backend')

from app.services.documents_engine import resolve_document_type_aliases, DOCUMENT_TYPE_ALIASES


def test_sales_invoice_aliases():
    aliases = resolve_document_type_aliases("SALES_INVOICE")
    assert "SALES_INVOICE" in aliases, "Expected SALES_INVOICE in aliases"
    assert "RETAIL INVOICE" in aliases, "Expected RETAIL INVOICE in aliases"
    assert "TAX INVOICE" in aliases, "Expected TAX INVOICE in aliases"
    assert "SALES_CASH" in aliases, "Expected SALES_CASH in aliases"

    # Reverse resolution from human readable
    reverse_aliases = resolve_document_type_aliases("Retail Invoice")
    assert "SALES_INVOICE" in reverse_aliases, "Expected SALES_INVOICE in reverse aliases"
    assert "RETAIL INVOICE" in reverse_aliases, "Expected RETAIL INVOICE in reverse aliases"
    print("[PASS] test_sales_invoice_aliases passed")


def test_purchase_order_aliases():
    aliases = resolve_document_type_aliases("PURCHASE_ORDER")
    assert "PURCHASE_ORDER" in aliases, "Expected PURCHASE_ORDER in aliases"
    assert "PURCHASE ORDER" in aliases, "Expected PURCHASE ORDER in aliases"
    assert "PO" in aliases, "Expected PO in aliases"

    reverse_aliases = resolve_document_type_aliases("Purchase Order")
    assert "PURCHASE_ORDER" in reverse_aliases, "Expected PURCHASE_ORDER in reverse aliases"
    print("[PASS] test_purchase_order_aliases passed")


def test_goods_receipt_aliases():
    aliases = resolve_document_type_aliases("GOODS_RECEIPT_NOTE")
    assert "GOODS_RECEIPT_NOTE" in aliases, "Expected GOODS_RECEIPT_NOTE in aliases"
    assert "GOODS RECEIPT" in aliases, "Expected GOODS RECEIPT in aliases"
    assert "GRN" in aliases, "Expected GRN in aliases"

    reverse_aliases = resolve_document_type_aliases("Goods Receipt")
    assert "GOODS_RECEIPT_NOTE" in reverse_aliases, "Expected GOODS_RECEIPT_NOTE in reverse aliases"
    print("[PASS] test_goods_receipt_aliases passed")


def test_article_aliases():
    aliases = resolve_document_type_aliases("ARTICLE")
    assert "ARTICLE" in aliases, "Expected ARTICLE in aliases"
    assert "DESIGN" in aliases, "Expected DESIGN in aliases"
    assert "SKU" in aliases, "Expected SKU in aliases"
    print("[PASS] test_article_aliases passed")


if __name__ == "__main__":
    test_sales_invoice_aliases()
    test_purchase_order_aliases()
    test_goods_receipt_aliases()
    test_article_aliases()
    print("All 4 document type alias verification suites passed successfully!")
