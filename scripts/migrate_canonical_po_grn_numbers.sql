-- SMRITI RETAIL OS: CANONICAL DOCUMENT NUMBERING MIGRATION SCRIPT
-- Database: smriti001
-- Generated: 2026-10-19
BEGIN;

-- Transaction #1: Vendor Bill 462
UPDATE purchase_orders SET order_no = 'PO/26-27/0001', notes = 'Canonical Purchase Order: PO/26-27/0001 | Vendor Bill: 462 (Dated 2026-06-26) | PO Issued: 2026-05-27 | Legacy Ref: PO-A-462', created_at = '2026-05-27 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-A-462';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0001', notes = 'Canonical GRN: GRN/26-27/0001 | Inward against Vendor Bill 462 (Dated 2026-06-26) | PO Date: 2026-05-27 | [LOGISTICS & LANDED COST: Date: 2026-06-26] | [VALUATION_COMPLETED] | Legacy Ref: GRN-A-462', created_at = '2026-06-26 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-A-462';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0001' WHERE purchase_order_no = 'PO-A-462';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0001', created_at = '2026-06-26 11:30:00+00' WHERE reference_doc_id = 'GRN-A-462';

-- Transaction #2: Vendor Bill 485
UPDATE purchase_orders SET order_no = 'PO/26-27/0002', notes = 'Canonical Purchase Order: PO/26-27/0002 | Vendor Bill: 485 (Dated 2026-06-27) | PO Issued: 2026-05-28 | Legacy Ref: PO-E-485', created_at = '2026-05-28 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-E-485';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0002', notes = 'Canonical GRN: GRN/26-27/0002 | Inward against Vendor Bill 485 (Dated 2026-06-27) | PO Date: 2026-05-28 | [LOGISTICS & LANDED COST: Date: 2026-06-27] | [VALUATION_COMPLETED] | Legacy Ref: GRN-E-485', created_at = '2026-06-27 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-E-485';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0002' WHERE purchase_order_no = 'PO-E-485';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0002', created_at = '2026-06-27 11:30:00+00' WHERE reference_doc_id = 'GRN-E-485';

-- Transaction #3: Vendor Bill AS/26-27/0013
UPDATE purchase_orders SET order_no = 'PO/26-27/0003', notes = 'Canonical Purchase Order: PO/26-27/0003 | Vendor Bill: AS/26-27/0013 (Dated 2026-07-02) | PO Issued: 2026-06-02 | Legacy Ref: PO-G-AS_26-27_0013', created_at = '2026-06-02 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-G-AS_26-27_0013';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0003', notes = 'Canonical GRN: GRN/26-27/0003 | Inward against Vendor Bill AS/26-27/0013 (Dated 2026-07-02) | PO Date: 2026-06-02 | [LOGISTICS & LANDED COST: Date: 2026-07-02] | [VALUATION_COMPLETED] | Legacy Ref: GRN-G-AS_26-27_0013', created_at = '2026-07-02 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-G-AS_26-27_0013';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0003' WHERE purchase_order_no = 'PO-G-AS_26-27_0013';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0003', created_at = '2026-07-02 11:30:00+00' WHERE reference_doc_id = 'GRN-G-AS_26-27_0013';

-- Transaction #4: Vendor Bill 846
UPDATE purchase_orders SET order_no = 'PO/26-27/0004', notes = 'Canonical Purchase Order: PO/26-27/0004 | Vendor Bill: 846 (Dated 2026-07-06) | PO Issued: 2026-06-06 | Legacy Ref: PO-C-846', created_at = '2026-06-06 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-C-846';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0004', notes = 'Canonical GRN: GRN/26-27/0004 | Inward against Vendor Bill 846 (Dated 2026-07-06) | PO Date: 2026-06-06 | [LOGISTICS & LANDED COST: Date: 2026-07-06] | [VALUATION_COMPLETED] | Legacy Ref: GRN-C-846', created_at = '2026-07-06 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-C-846';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0004' WHERE purchase_order_no = 'PO-C-846';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0004', created_at = '2026-07-06 11:30:00+00' WHERE reference_doc_id = 'GRN-C-846';

-- Transaction #5: Vendor Bill 847
UPDATE purchase_orders SET order_no = 'PO/26-27/0005', notes = 'Canonical Purchase Order: PO/26-27/0005 | Vendor Bill: 847 (Dated 2026-07-16) | PO Issued: 2026-06-16 | Legacy Ref: PO-C-847', created_at = '2026-06-16 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-C-847';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0005', notes = 'Canonical GRN: GRN/26-27/0005 | Inward against Vendor Bill 847 (Dated 2026-07-16) | PO Date: 2026-06-16 | [LOGISTICS & LANDED COST: Date: 2026-07-16] | [VALUATION_COMPLETED] | Legacy Ref: GRN-C-847', created_at = '2026-07-16 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-C-847';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0005' WHERE purchase_order_no = 'PO-C-847';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0005', created_at = '2026-07-16 11:30:00+00' WHERE reference_doc_id = 'GRN-C-847';

-- Transaction #6: Vendor Bill 522
UPDATE purchase_orders SET order_no = 'PO/26-27/0006', notes = 'Canonical Purchase Order: PO/26-27/0006 | Vendor Bill: 522 (Dated 2026-07-17) | PO Issued: 2026-06-17 | Legacy Ref: PO-D-522', created_at = '2026-06-17 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-D-522';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0006', notes = 'Canonical GRN: GRN/26-27/0006 | Inward against Vendor Bill 522 (Dated 2026-07-17) | PO Date: 2026-06-17 | [LOGISTICS & LANDED COST: Date: 2026-07-17] | [VALUATION_COMPLETED] | Legacy Ref: GRN-D-522', created_at = '2026-07-17 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-D-522';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0006' WHERE purchase_order_no = 'PO-D-522';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0006', created_at = '2026-07-17 11:30:00+00' WHERE reference_doc_id = 'GRN-D-522';

-- Transaction #7: Vendor Bill AS/26-27/0016
UPDATE purchase_orders SET order_no = 'PO/26-27/0007', notes = 'Canonical Purchase Order: PO/26-27/0007 | Vendor Bill: AS/26-27/0016 (Dated 2026-07-20) | PO Issued: 2026-06-20 | Legacy Ref: PO-G-AS_26-27_0016', created_at = '2026-06-20 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-G-AS_26-27_0016';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0007', notes = 'Canonical GRN: GRN/26-27/0007 | Inward against Vendor Bill AS/26-27/0016 (Dated 2026-07-20) | PO Date: 2026-06-20 | [LOGISTICS & LANDED COST: Date: 2026-07-20] | [VALUATION_COMPLETED] | Legacy Ref: GRN-G-AS_26-27_0016', created_at = '2026-07-20 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-G-AS_26-27_0016';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0007' WHERE purchase_order_no = 'PO-G-AS_26-27_0016';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0007', created_at = '2026-07-20 11:30:00+00' WHERE reference_doc_id = 'GRN-G-AS_26-27_0016';

-- Transaction #8: Vendor Bill 525
UPDATE purchase_orders SET order_no = 'PO/26-27/0008', notes = 'Canonical Purchase Order: PO/26-27/0008 | Vendor Bill: 525 (Dated 2026-07-21) | PO Issued: 2026-06-21 | Legacy Ref: PO-D-525', created_at = '2026-06-21 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-D-525';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0008', notes = 'Canonical GRN: GRN/26-27/0008 | Inward against Vendor Bill 525 (Dated 2026-07-21) | PO Date: 2026-06-21 | [LOGISTICS & LANDED COST: Date: 2026-07-21] | [VALUATION_COMPLETED] | Legacy Ref: GRN-D-525', created_at = '2026-07-21 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-D-525';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0008' WHERE purchase_order_no = 'PO-D-525';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0008', created_at = '2026-07-21 11:30:00+00' WHERE reference_doc_id = 'GRN-D-525';

-- Transaction #9: Vendor Bill 463
UPDATE purchase_orders SET order_no = 'PO/26-27/0009', notes = 'Canonical Purchase Order: PO/26-27/0009 | Vendor Bill: 463 (Dated 2026-07-22) | PO Issued: 2026-06-22 | Legacy Ref: PO-A-463', created_at = '2026-06-22 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-A-463';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0009', notes = 'Canonical GRN: GRN/26-27/0009 | Inward against Vendor Bill 463 (Dated 2026-07-22) | PO Date: 2026-06-22 | [LOGISTICS & LANDED COST: Date: 2026-07-22] | [VALUATION_COMPLETED] | Legacy Ref: GRN-A-463', created_at = '2026-07-22 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-A-463';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0009' WHERE purchase_order_no = 'PO-A-463';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0009', created_at = '2026-07-22 11:30:00+00' WHERE reference_doc_id = 'GRN-A-463';

-- Transaction #10: Vendor Bill 464
UPDATE purchase_orders SET order_no = 'PO/26-27/0010', notes = 'Canonical Purchase Order: PO/26-27/0010 | Vendor Bill: 464 (Dated 2026-07-22) | PO Issued: 2026-06-22 | Legacy Ref: PO-A-464', created_at = '2026-06-22 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-A-464';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0010', notes = 'Canonical GRN: GRN/26-27/0010 | Inward against Vendor Bill 464 (Dated 2026-07-22) | PO Date: 2026-06-22 | [LOGISTICS & LANDED COST: Date: 2026-07-22] | [VALUATION_COMPLETED] | Legacy Ref: GRN-A-464', created_at = '2026-07-22 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-A-464';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0010' WHERE purchase_order_no = 'PO-A-464';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0010', created_at = '2026-07-22 11:30:00+00' WHERE reference_doc_id = 'GRN-A-464';

-- Transaction #11: Vendor Bill 941
UPDATE purchase_orders SET order_no = 'PO/26-27/0011', notes = 'Canonical Purchase Order: PO/26-27/0011 | Vendor Bill: 941 (Dated 2026-07-22) | PO Issued: 2026-06-22 | Legacy Ref: PO-I-941', created_at = '2026-06-22 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-I-941';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0011', notes = 'Canonical GRN: GRN/26-27/0011 | Inward against Vendor Bill 941 (Dated 2026-07-22) | PO Date: 2026-06-22 | [LOGISTICS & LANDED COST: Date: 2026-07-22] | [VALUATION_COMPLETED] | Legacy Ref: GRN-I-941', created_at = '2026-07-22 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-I-941';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0011' WHERE purchase_order_no = 'PO-I-941';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0011', created_at = '2026-07-22 11:30:00+00' WHERE reference_doc_id = 'GRN-I-941';

-- Transaction #12: Vendor Bill 22
UPDATE purchase_orders SET order_no = 'PO/26-27/0012', notes = 'Canonical Purchase Order: PO/26-27/0012 | Vendor Bill: 22 (Dated 2026-07-24) | PO Issued: 2026-06-24 | Legacy Ref: PO-J-22', created_at = '2026-06-24 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-J-22';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0012', notes = 'Canonical GRN: GRN/26-27/0012 | Inward against Vendor Bill 22 (Dated 2026-07-24) | PO Date: 2026-06-24 | [LOGISTICS & LANDED COST: Date: 2026-07-24] | [VALUATION_COMPLETED] | Legacy Ref: GRN-J-22', created_at = '2026-07-24 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-J-22';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0012' WHERE purchase_order_no = 'PO-J-22';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0012', created_at = '2026-07-24 11:30:00+00' WHERE reference_doc_id = 'GRN-J-22';

-- Transaction #13: Vendor Bill LF/26-27/144
UPDATE purchase_orders SET order_no = 'PO/26-27/0013', notes = 'Canonical Purchase Order: PO/26-27/0013 | Vendor Bill: LF/26-27/144 (Dated 2026-07-25) | PO Issued: 2026-06-25 | Legacy Ref: PO-B-LF_26-27_144', created_at = '2026-06-25 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-B-LF_26-27_144';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0013', notes = 'Canonical GRN: GRN/26-27/0013 | Inward against Vendor Bill LF/26-27/144 (Dated 2026-07-25) | PO Date: 2026-06-25 | [LOGISTICS & LANDED COST: Date: 2026-07-25] | [VALUATION_COMPLETED] | Legacy Ref: GRN-B-LF_26-27_144', created_at = '2026-07-25 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-B-LF_26-27_144';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0013' WHERE purchase_order_no = 'PO-B-LF_26-27_144';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0013', created_at = '2026-07-25 11:30:00+00' WHERE reference_doc_id = 'GRN-B-LF_26-27_144';

-- Transaction #14: Vendor Bill 526
UPDATE purchase_orders SET order_no = 'PO/26-27/0014', notes = 'Canonical Purchase Order: PO/26-27/0014 | Vendor Bill: 526 (Dated 2026-07-27) | PO Issued: 2026-06-27 | Legacy Ref: PO-D-526', created_at = '2026-06-27 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-D-526';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0014', notes = 'Canonical GRN: GRN/26-27/0014 | Inward against Vendor Bill 526 (Dated 2026-07-27) | PO Date: 2026-06-27 | [LOGISTICS & LANDED COST: Date: 2026-07-27] | [VALUATION_COMPLETED] | Legacy Ref: GRN-D-526', created_at = '2026-07-27 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-D-526';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0014' WHERE purchase_order_no = 'PO-D-526';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0014', created_at = '2026-07-27 11:30:00+00' WHERE reference_doc_id = 'GRN-D-526';

-- Transaction #15: Vendor Bill 702
UPDATE purchase_orders SET order_no = 'PO/26-27/0015', notes = 'Canonical Purchase Order: PO/26-27/0015 | Vendor Bill: 702 (Dated 2026-07-27) | PO Issued: 2026-06-27 | Legacy Ref: PO-F-702', created_at = '2026-06-27 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-F-702';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0015', notes = 'Canonical GRN: GRN/26-27/0015 | Inward against Vendor Bill 702 (Dated 2026-07-27) | PO Date: 2026-06-27 | [LOGISTICS & LANDED COST: Date: 2026-07-27] | [VALUATION_COMPLETED] | Legacy Ref: GRN-F-702', created_at = '2026-07-27 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-F-702';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0015' WHERE purchase_order_no = 'PO-F-702';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0015', created_at = '2026-07-27 11:30:00+00' WHERE reference_doc_id = 'GRN-F-702';

-- Transaction #16: Vendor Bill 25
UPDATE purchase_orders SET order_no = 'PO/26-27/0016', notes = 'Canonical Purchase Order: PO/26-27/0016 | Vendor Bill: 25 (Dated 2026-07-31) | PO Issued: 2026-07-01 | Legacy Ref: PO-J-25', created_at = '2026-07-01 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-J-25';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0016', notes = 'Canonical GRN: GRN/26-27/0016 | Inward against Vendor Bill 25 (Dated 2026-07-31) | PO Date: 2026-07-01 | [LOGISTICS & LANDED COST: Date: 2026-07-31] | [VALUATION_COMPLETED] | Legacy Ref: GRN-J-25', created_at = '2026-07-31 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-J-25';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0016' WHERE purchase_order_no = 'PO-J-25';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0016', created_at = '2026-07-31 11:30:00+00' WHERE reference_doc_id = 'GRN-J-25';

-- Transaction #17: Vendor Bill AS/26-27/0019
UPDATE purchase_orders SET order_no = 'PO/26-27/0017', notes = 'Canonical Purchase Order: PO/26-27/0017 | Vendor Bill: AS/26-27/0019 (Dated 2026-07-31) | PO Issued: 2026-07-01 | Legacy Ref: PO-G-AS_26-27_0019', created_at = '2026-07-01 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-G-AS_26-27_0019';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0017', notes = 'Canonical GRN: GRN/26-27/0017 | Inward against Vendor Bill AS/26-27/0019 (Dated 2026-07-31) | PO Date: 2026-07-01 | [LOGISTICS & LANDED COST: Date: 2026-07-31] | [VALUATION_COMPLETED] | Legacy Ref: GRN-G-AS_26-27_0019', created_at = '2026-07-31 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-G-AS_26-27_0019';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0017' WHERE purchase_order_no = 'PO-G-AS_26-27_0019';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0017', created_at = '2026-07-31 11:30:00+00' WHERE reference_doc_id = 'GRN-G-AS_26-27_0019';

-- Transaction #18: Vendor Bill 489
UPDATE purchase_orders SET order_no = 'PO/26-27/0018', notes = 'Canonical Purchase Order: PO/26-27/0018 | Vendor Bill: 489 (Dated 2026-08-01) | PO Issued: 2026-07-02 | Legacy Ref: PO-E-489', created_at = '2026-07-02 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-E-489';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0018', notes = 'Canonical GRN: GRN/26-27/0018 | Inward against Vendor Bill 489 (Dated 2026-08-01) | PO Date: 2026-07-02 | [LOGISTICS & LANDED COST: Date: 2026-08-01] | [VALUATION_COMPLETED] | Legacy Ref: GRN-E-489', created_at = '2026-08-01 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-E-489';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0018' WHERE purchase_order_no = 'PO-E-489';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0018', created_at = '2026-08-01 11:30:00+00' WHERE reference_doc_id = 'GRN-E-489';

-- Transaction #19: Vendor Bill 490
UPDATE purchase_orders SET order_no = 'PO/26-27/0019', notes = 'Canonical Purchase Order: PO/26-27/0019 | Vendor Bill: 490 (Dated 2026-08-01) | PO Issued: 2026-07-02 | Legacy Ref: PO-E-490', created_at = '2026-07-02 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-E-490';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0019', notes = 'Canonical GRN: GRN/26-27/0019 | Inward against Vendor Bill 490 (Dated 2026-08-01) | PO Date: 2026-07-02 | [LOGISTICS & LANDED COST: Date: 2026-08-01] | [VALUATION_COMPLETED] | Legacy Ref: GRN-E-490', created_at = '2026-08-01 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-E-490';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0019' WHERE purchase_order_no = 'PO-E-490';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0019', created_at = '2026-08-01 11:30:00+00' WHERE reference_doc_id = 'GRN-E-490';

-- Transaction #20: Vendor Bill LF/26-27/154
UPDATE purchase_orders SET order_no = 'PO/26-27/0020', notes = 'Canonical Purchase Order: PO/26-27/0020 | Vendor Bill: LF/26-27/154 (Dated 2026-08-07) | PO Issued: 2026-07-08 | Legacy Ref: PO-B-LF_26-27_154', created_at = '2026-07-08 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-B-LF_26-27_154';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0020', notes = 'Canonical GRN: GRN/26-27/0020 | Inward against Vendor Bill LF/26-27/154 (Dated 2026-08-07) | PO Date: 2026-07-08 | [LOGISTICS & LANDED COST: Date: 2026-08-07] | [VALUATION_COMPLETED] | Legacy Ref: GRN-B-LF_26-27_154', created_at = '2026-08-07 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-B-LF_26-27_154';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0020' WHERE purchase_order_no = 'PO-B-LF_26-27_154';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0020', created_at = '2026-08-07 11:30:00+00' WHERE reference_doc_id = 'GRN-B-LF_26-27_154';

-- Transaction #21: Vendor Bill 704
UPDATE purchase_orders SET order_no = 'PO/26-27/0021', notes = 'Canonical Purchase Order: PO/26-27/0021 | Vendor Bill: 704 (Dated 2026-08-10) | PO Issued: 2026-07-11 | Legacy Ref: PO-F-704', created_at = '2026-07-11 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-F-704';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0021', notes = 'Canonical GRN: GRN/26-27/0021 | Inward against Vendor Bill 704 (Dated 2026-08-10) | PO Date: 2026-07-11 | [LOGISTICS & LANDED COST: Date: 2026-08-10] | [VALUATION_COMPLETED] | Legacy Ref: GRN-F-704', created_at = '2026-08-10 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-F-704';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0021' WHERE purchase_order_no = 'PO-F-704';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0021', created_at = '2026-08-10 11:30:00+00' WHERE reference_doc_id = 'GRN-F-704';

-- Transaction #22: Vendor Bill 944
UPDATE purchase_orders SET order_no = 'PO/26-27/0022', notes = 'Canonical Purchase Order: PO/26-27/0022 | Vendor Bill: 944 (Dated 2026-08-16) | PO Issued: 2026-07-17 | Legacy Ref: PO-I-944', created_at = '2026-07-17 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-I-944';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0022', notes = 'Canonical GRN: GRN/26-27/0022 | Inward against Vendor Bill 944 (Dated 2026-08-16) | PO Date: 2026-07-17 | [LOGISTICS & LANDED COST: Date: 2026-08-16] | [VALUATION_COMPLETED] | Legacy Ref: GRN-I-944', created_at = '2026-08-16 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-I-944';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0022' WHERE purchase_order_no = 'PO-I-944';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0022', created_at = '2026-08-16 11:30:00+00' WHERE reference_doc_id = 'GRN-I-944';

-- Transaction #23: Vendor Bill 945
UPDATE purchase_orders SET order_no = 'PO/26-27/0023', notes = 'Canonical Purchase Order: PO/26-27/0023 | Vendor Bill: 945 (Dated 2026-08-17) | PO Issued: 2026-07-18 | Legacy Ref: PO-I-945', created_at = '2026-07-18 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-I-945';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0023', notes = 'Canonical GRN: GRN/26-27/0023 | Inward against Vendor Bill 945 (Dated 2026-08-17) | PO Date: 2026-07-18 | [LOGISTICS & LANDED COST: Date: 2026-08-17] | [VALUATION_COMPLETED] | Legacy Ref: GRN-I-945', created_at = '2026-08-17 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-I-945';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0023' WHERE purchase_order_no = 'PO-I-945';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0023', created_at = '2026-08-17 11:30:00+00' WHERE reference_doc_id = 'GRN-I-945';

-- Transaction #24: Vendor Bill 706
UPDATE purchase_orders SET order_no = 'PO/26-27/0024', notes = 'Canonical Purchase Order: PO/26-27/0024 | Vendor Bill: 706 (Dated 2026-08-22) | PO Issued: 2026-07-23 | Legacy Ref: PO-F-706', created_at = '2026-07-23 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-F-706';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0024', notes = 'Canonical GRN: GRN/26-27/0024 | Inward against Vendor Bill 706 (Dated 2026-08-22) | PO Date: 2026-07-23 | [LOGISTICS & LANDED COST: Date: 2026-08-22] | [VALUATION_COMPLETED] | Legacy Ref: GRN-F-706', created_at = '2026-08-22 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-F-706';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0024' WHERE purchase_order_no = 'PO-F-706';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0024', created_at = '2026-08-22 11:30:00+00' WHERE reference_doc_id = 'GRN-F-706';

-- Transaction #25: Vendor Bill AS/26-27/0023
UPDATE purchase_orders SET order_no = 'PO/26-27/0025', notes = 'Canonical Purchase Order: PO/26-27/0025 | Vendor Bill: AS/26-27/0023 (Dated 2026-08-23) | PO Issued: 2026-07-24 | Legacy Ref: PO-G-AS_26-27_0023', created_at = '2026-07-24 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-G-AS_26-27_0023';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0025', notes = 'Canonical GRN: GRN/26-27/0025 | Inward against Vendor Bill AS/26-27/0023 (Dated 2026-08-23) | PO Date: 2026-07-24 | [LOGISTICS & LANDED COST: Date: 2026-08-23] | [VALUATION_COMPLETED] | Legacy Ref: GRN-G-AS_26-27_0023', created_at = '2026-08-23 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-G-AS_26-27_0023';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0025' WHERE purchase_order_no = 'PO-G-AS_26-27_0023';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0025', created_at = '2026-08-23 11:30:00+00' WHERE reference_doc_id = 'GRN-G-AS_26-27_0023';

-- Transaction #26: Vendor Bill LF/26-27/186
UPDATE purchase_orders SET order_no = 'PO/26-27/0026', notes = 'Canonical Purchase Order: PO/26-27/0026 | Vendor Bill: LF/26-27/186 (Dated 2026-08-24) | PO Issued: 2026-07-25 | Legacy Ref: PO-B-LF_26-27_186', created_at = '2026-07-25 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-B-LF_26-27_186';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0026', notes = 'Canonical GRN: GRN/26-27/0026 | Inward against Vendor Bill LF/26-27/186 (Dated 2026-08-24) | PO Date: 2026-07-25 | [LOGISTICS & LANDED COST: Date: 2026-08-24] | [VALUATION_COMPLETED] | Legacy Ref: GRN-B-LF_26-27_186', created_at = '2026-08-24 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-B-LF_26-27_186';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0026' WHERE purchase_order_no = 'PO-B-LF_26-27_186';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0026', created_at = '2026-08-24 11:30:00+00' WHERE reference_doc_id = 'GRN-B-LF_26-27_186';

-- Transaction #27: Vendor Bill 707
UPDATE purchase_orders SET order_no = 'PO/26-27/0027', notes = 'Canonical Purchase Order: PO/26-27/0027 | Vendor Bill: 707 (Dated 2026-09-07) | PO Issued: 2026-08-08 | Legacy Ref: PO-F-707', created_at = '2026-08-08 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-F-707';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0027', notes = 'Canonical GRN: GRN/26-27/0027 | Inward against Vendor Bill 707 (Dated 2026-09-07) | PO Date: 2026-08-08 | [LOGISTICS & LANDED COST: Date: 2026-09-07] | [VALUATION_COMPLETED] | Legacy Ref: GRN-F-707', created_at = '2026-09-07 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-F-707';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0027' WHERE purchase_order_no = 'PO-F-707';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0027', created_at = '2026-09-07 11:30:00+00' WHERE reference_doc_id = 'GRN-F-707';

-- Transaction #28: Vendor Bill 849
UPDATE purchase_orders SET order_no = 'PO/26-27/0028', notes = 'Canonical Purchase Order: PO/26-27/0028 | Vendor Bill: 849 (Dated 2026-10-05) | PO Issued: 2026-09-05 | Legacy Ref: PO-C-849', created_at = '2026-09-05 09:00:00+00', modified_at = NOW() WHERE order_no = 'PO-C-849';
UPDATE purchase_receipts SET receipt_no = 'GRN/26-27/0028', notes = 'Canonical GRN: GRN/26-27/0028 | Inward against Vendor Bill 849 (Dated 2026-10-05) | PO Date: 2026-09-05 | [LOGISTICS & LANDED COST: Date: 2026-10-05] | [VALUATION_COMPLETED] | Legacy Ref: GRN-C-849', created_at = '2026-10-05 11:00:00+00', modified_at = NOW() WHERE receipt_no = 'GRN-C-849';
UPDATE purchase_receipt_items SET purchase_order_no = 'PO/26-27/0028' WHERE purchase_order_no = 'PO-C-849';
UPDATE stock_movements SET reference_doc_id = 'GRN/26-27/0028', created_at = '2026-10-05 11:30:00+00' WHERE reference_doc_id = 'GRN-C-849';

COMMIT;
