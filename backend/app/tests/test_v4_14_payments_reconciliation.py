"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.14.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
Test Suite: v4.14.0 Indian Payments & Bank Reconciliation Suite

Tests:
1. Payment Gateway Abstraction & UPI scheme generator
2. Wallet settlement reconciliation engine
3. Bank statement CSV parser and transaction auto-matcher
"""

import pytest
import hmac
import hashlib
from decimal import Decimal
from datetime import date, timedelta

from app.core.pg_gateway import RazorpayGateway, PaytmGateway, CashfreeGateway
from app.services.wallet_reconciler import (
    reconcile_wallet_settlements, POSReceipt, PGSettlementRow,
    WalletReconciliationItem
)
from app.services.bank_reconciler import (
    reconcile_bank_statement, parse_bank_statement_csv,
    BankStatementEntry, BookLedgerEntry
)


# ===========================================================================
# 1. Payment Gateway Abstraction Tests
# ===========================================================================

class TestPaymentGateways:

    def test_razorpay_dynamic_qr_url(self):
        rzp = RazorpayGateway()
        qr = rzp.generate_dynamic_qr_string(
            merchant_vpa="merchant@razor",
            merchant_name="SMRITI Books",
            transaction_id="txn_1001",
            amount=Decimal("1250.50")
        )
        assert "upi://pay?" in qr
        assert "pa=merchant@razor" in qr
        assert "pn=SMRITI%20Books" in qr
        assert "am=1250.50" in qr

    def test_razorpay_payment_request(self):
        rzp = RazorpayGateway()
        req = rzp.create_payment_request("txn_1002", Decimal("500.00"), "9876543210")
        assert req["gateway"] == "RAZORPAY"
        assert req["amount"] == 50000 # 500 INR * 100 paise
        assert req["order_id"] == "order_rzp_txn_1002"

    def test_razorpay_signature_verification_success(self):
        rzp = RazorpayGateway()
        secret = "super_webhook_secret_key"
        payload = b'{"event":"payment.captured","amount":50000}'
        signature = hmac.new(
            secret.encode("utf-8"),
            payload,
            hashlib.sha256
        ).hexdigest()
        assert rzp.verify_webhook_signature(payload, signature, secret) is True

    def test_razorpay_signature_verification_failure(self):
        rzp = RazorpayGateway()
        secret = "super_webhook_secret_key"
        payload = b'{"event":"payment.captured","amount":50000}'
        assert rzp.verify_webhook_signature(payload, "invalid_sig", secret) is False

    def test_paytm_payment_request(self):
        paytm = PaytmGateway()
        req = paytm.create_payment_request("txn_1003", Decimal("150.75"), "9999988888")
        assert req["gateway"] == "PAYTM"
        assert req["amount"] == "150.75"
        assert req["txnToken"] == "token_paytm_txn_1003"

    def test_cashfree_payment_request(self):
        cf = CashfreeGateway()
        req = cf.create_payment_request("txn_1004", Decimal("99.00"), "8888877777")
        assert req["gateway"] == "CASHFREE"
        assert req["order_amount"] == 99.0
        assert "cf_order_txn_1004" in req["cf_order_id"]


# ===========================================================================
# 2. Wallet Settlement Reconciler Tests
# ===========================================================================

class TestWalletReconciliation:

    def test_perfect_reconciliation_match(self):
        pos = [POSReceipt("TXN-101", Decimal("1000.00"), "UPI", "2026-07-20")]
        # Expected fee: 1.8% MDR = 18.00; 18% GST = 3.24; Net = 1000 - 18 - 3.24 = 978.76
        pg = [PGSettlementRow("TXN-101", "SET-201", Decimal("1000.00"), Decimal("978.76"), Decimal("18.00"), Decimal("3.24"), "2026-07-21")]
        
        result = reconcile_wallet_settlements(pos, pg, Decimal("1.8"))
        assert result.matched_count == 1
        assert result.mismatched_count == 0
        assert result.total_leaks == Decimal("0")
        assert result.items[0].status == "MATCHED"

    def test_gross_amount_leak_detected(self):
        pos = [POSReceipt("TXN-102", Decimal("1200.00"), "UPI", "2026-07-20")]
        pg = [PGSettlementRow("TXN-102", "SET-202", Decimal("1000.00"), Decimal("978.76"), Decimal("18.00"), Decimal("3.24"), "2026-07-21")]
        
        result = reconcile_wallet_settlements(pos, pg, Decimal("1.8"))
        assert result.matched_count == 0
        assert result.mismatched_count == 1
        assert result.total_leaks == Decimal("200.00") # POS was 1200, PG says 1000
        assert result.items[0].status == "LEAK_DETECTED"

    def test_incorrect_fees_charged_by_pg(self):
        pos = [POSReceipt("TXN-103", Decimal("1000.00"), "UPI", "2026-07-20")]
        # PG charged 25.00 MDR instead of 18.00
        pg = [PGSettlementRow("TXN-103", "SET-203", Decimal("1000.00"), Decimal("970.50"), Decimal("25.00"), Decimal("4.50"), "2026-07-21")]
        
        result = reconcile_wallet_settlements(pos, pg, Decimal("1.8"))
        assert result.items[0].status == "FEE_MISMATCH"

    def test_missing_gateway_settlement(self):
        pos = [POSReceipt("TXN-104", Decimal("500.00"), "UPI", "2026-07-20")]
        result = reconcile_wallet_settlements(pos, [], Decimal("1.8"))
        assert result.matched_count == 0
        assert result.mismatched_count == 1
        assert result.total_leaks == Decimal("500.00")
        assert result.items[0].status == "MISSING_SETTLEMENT"

    def test_ledger_leak_missing_in_pos(self):
        pg = [PGSettlementRow("TXN-105", "SET-205", Decimal("300.00"), Decimal("293.63"), Decimal("5.40"), Decimal("0.97"), "2026-07-21")]
        result = reconcile_wallet_settlements([], pg, Decimal("1.8"))
        assert result.items[0].status == "POS_MISSING"


# ===========================================================================
# 3. Bank Statement Reconciler Tests
# ===========================================================================

class TestBankReconciliation:

    def test_csv_parser(self):
        csv = "Date,Description,Ref Number,Amount,Type\n2026-07-20,UPI/999111,UTR-0982,500.00,CR"
        entries = parse_bank_statement_csv(csv)
        assert len(entries) == 1
        assert entries[0].amount == Decimal("500.00")
        assert entries[0].ref_number == "UTR-0982"
        assert entries[0].is_credit is True

    def test_exact_bank_match(self):
        stmt = [BankStatementEntry("s1", date(2026, 7, 20), "UPI transfer", "UTR1009", Decimal("500.00"), True)]
        ledger = [BookLedgerEntry("l1", date(2026, 7, 20), "Sales record", "UTR1009", Decimal("500.00"), True)]
        
        result = reconcile_bank_statement(stmt, ledger)
        assert result.exact_matches == 1
        assert result.unmatched_statement == 0
        assert result.items[0].match_status == "EXACT"

    def test_fuzzy_match_by_reference_different_dates(self):
        # Transaction cleared in bank 5 days late
        stmt = [BankStatementEntry("s2", date(2026, 7, 25), "NEFT Inward", "UTR1010", Decimal("15000.00"), True)]
        ledger = [BookLedgerEntry("l2", date(2026, 7, 20), "NEFT Sale", "UTR1010", Decimal("15000.00"), True)]
        
        result = reconcile_bank_statement(stmt, ledger, date_tolerance_days=3)
        assert result.fuzzy_matches == 1
        assert result.exact_matches == 0
        assert result.items[0].match_status == "FUZZY_REF"

    def test_fuzzy_match_by_amount_and_date_reference_mismatch(self):
        # Reference entered in books is slightly different (e.g. human typo or placeholder)
        stmt = [BankStatementEntry("s3", date(2026, 7, 20), "UPI payment", "UTR1020", Decimal("250.00"), True)]
        ledger = [BookLedgerEntry("l3", date(2026, 7, 21), "Cashier sale", "REF_WRONG", Decimal("250.00"), True)]
        
        result = reconcile_bank_statement(stmt, ledger)
        assert result.fuzzy_matches == 1
        assert result.items[0].match_status == "FUZZY_DATE"

    def test_unmatched_entries(self):
        stmt = [BankStatementEntry("s4", date(2026, 7, 20), "Bank charges", None, Decimal("17.70"), False)]
        result = reconcile_bank_statement(stmt, [])
        assert result.unmatched_statement == 1
        assert result.reconciled_percentage == Decimal("0.00")
        assert result.items[0].match_status == "UNMATCHED"
