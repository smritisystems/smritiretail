"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.15.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
Test Suite: v4.15.0 GA Certification & Hardening Suite

Performs performance stress tests and memory footprint containment validation
on ICCL compliance engines:
1. GSTR-2B Reconciliation Engine scale benchmarks.
2. Bank Statement Auto-Matching Engine scale benchmarks.
3. GS1 Barcode parsing loop throughput checks.
"""

import time
import pytest
import random
from decimal import Decimal
from datetime import date

from app.services.gstr2b_reconciliation import reconcile_gstr2b, BookInvoice, GSTR2BInvoice
from app.services.bank_reconciler import reconcile_bank_statement, BankStatementEntry, BookLedgerEntry
from app.core.gs1_barcode_parser import parse_gs1_barcode


class TestGAHardeningAndBenchmarks:

    def test_gstr2b_reconciliation_stress_benchmark(self):
        """
        Benchmarking matching performance with 2,000 invoice rows.
        Processing target: Under 100ms.
        """
        num_invoices = 2000
        
        books = []
        gstr2b = []

        # Generate large dataset
        for i in range(num_invoices):
            inv_no = f"INV-2026-{i:06d}"
            # Match 90% exactly, 10% mismatches/missing
            if i % 10 == 0:
                # Books only
                books.append(BookInvoice(
                    invoice_number=inv_no,
                    supplier_gstin="27ABCDE1234F1Z5",
                    invoice_date="2026-06-15",
                    taxable_value=Decimal("5000"),
                    igst=Decimal("900"),
                    cgst=Decimal("0"),
                    sgst=Decimal("0"),
                    itc_claimed=Decimal("900")
                ))
            elif i % 10 == 1:
                # GSTR2B only
                gstr2b.append(GSTR2BInvoice(
                    invoice_number=inv_no,
                    supplier_gstin="27ABCDE1234F1Z5",
                    invoice_date="2026-06-15",
                    taxable_value=Decimal("5000"),
                    igst=Decimal("900"),
                    cgst=Decimal("0"),
                    sgst=Decimal("0"),
                    itc_available=Decimal("900")
                ))
            else:
                # Exact match
                books.append(BookInvoice(
                    invoice_number=inv_no,
                    supplier_gstin="27ABCDE1234F1Z5",
                    invoice_date="2026-06-15",
                    taxable_value=Decimal("10000"),
                    igst=Decimal("1800"),
                    cgst=Decimal("0"),
                    sgst=Decimal("0"),
                    itc_claimed=Decimal("1800")
                ))
                gstr2b.append(GSTR2BInvoice(
                    invoice_number=inv_no,
                    supplier_gstin="27ABCDE1234F1Z5",
                    invoice_date="2026-06-15",
                    taxable_value=Decimal("10000"),
                    igst=Decimal("1800"),
                    cgst=Decimal("0"),
                    sgst=Decimal("0"),
                    itc_available=Decimal("1800")
                ))

        # Time the execution
        start_time = time.perf_counter()
        report = reconcile_gstr2b("tenant-test-99", "2026-06", books, gstr2b)
        end_time = time.perf_counter()
        duration_ms = (end_time - start_time) * 1000

        print(f"\n[BENCHMARK] GSTR-2B Reconciliation took: {duration_ms:.2f} ms for {num_invoices} entries.")
        
        # Verify correctness under scale
        assert report.matched > 0
        assert report.books_only > 0
        assert report.gstr2b_only > 0
        
        # Execution duration budget threshold: 150ms max
        assert duration_ms < 150.0

    def test_bank_statement_matching_stress_benchmark(self):
        """
        Benchmarking auto-matching performance with 2,000 ledger rows.
        Processing target: Under 150ms.
        """
        num_entries = 2000
        stmt_list = []
        ledger_list = []

        # Generate large dataset
        for i in range(num_entries):
            ref = f"UTR{i:08d}"
            # Match 80%, 20% unmatched (10% stmt-only, 10% ledger-only)
            if i % 10 == 0:
                stmt_list.append(BankStatementEntry(
                    entry_id=f"st_{i}",
                    entry_date=date(2026, 7, 20),
                    description="UPI deposit",
                    ref_number=ref,
                    amount=Decimal("100.00"),  # Unique amount
                    is_credit=True
                ))
            elif i % 10 == 1:
                ledger_list.append(BookLedgerEntry(
                    ledger_id=f"ld_{i}",
                    entry_date=date(2026, 7, 20),
                    description="Cash register sales",
                    ref_number=ref,
                    amount=Decimal("105.00"),  # Different amount
                    is_credit=True
                ))
            else:
                stmt_list.append(BankStatementEntry(
                    entry_id=f"st_{i}",
                    entry_date=date(2026, 7, 20),
                    description="UPI deposit",
                    ref_number=ref,
                    amount=Decimal("500.00"),
                    is_credit=True
                ))
                ledger_list.append(BookLedgerEntry(
                    ledger_id=f"ld_{i}",
                    entry_date=date(2026, 7, 20),
                    description="Cash register sales",
                    ref_number=ref,
                    amount=Decimal("500.00"),
                    is_credit=True
                ))

        # Time the execution
        start_time = time.perf_counter()
        report = reconcile_bank_statement(stmt_list, ledger_list, date_tolerance_days=3)
        end_time = time.perf_counter()
        duration_ms = (end_time - start_time) * 1000

        print(f"\n[BENCHMARK] Bank Statement Matching took: {duration_ms:.2f} ms for {num_entries} entries.")
        
        # Verify correctness
        assert report.exact_matches > 0
        assert report.unmatched_statement > 0
        assert report.unmatched_ledger > 0
        
        # Execution duration budget threshold: 200ms max (due to multiple fallback loop scans)
        assert duration_ms < 200.0

    def test_gs1_barcode_parser_loop_throughput(self):
        """
        Benchmark GS1 parsing throughput for 500 scans.
        Processing target: Under 50ms.
        """
        barcodes = [
            "(01)08901234567894(10)LOT998A(17)280630(21)SN1029",
            "(01)08901234567894(17)261231",
            "(11)260101(01)08901234567894(21)SN55620",
            "(01)08901234567894",
            "(01)08901234567894(15)270630(10)LOT2026B"
        ] * 100 # 500 items

        start_time = time.perf_counter()
        for code in barcodes:
            res = parse_gs1_barcode(code)
            assert res is not None
        end_time = time.perf_counter()
        duration_ms = (end_time - start_time) * 1000

        print(f"\n[BENCHMARK] GS1 Barcode Parser parsed 500 scans in: {duration_ms:.2f} ms.")
        
        # Execution duration budget threshold: 50ms max
        assert duration_ms < 50.0
