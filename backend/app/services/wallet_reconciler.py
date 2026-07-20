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
SMRITI Indian Compliance Core Layer (ICCL) - Wallet & PG Settlement Reconciler

Reconciles local POS digital receipts against PG payout/settlement statements.
Features:
- Validates gross values against POS transaction books.
- Validates Merchant Discount Rate (MDR) charges against standard rate parameters.
- Validates 18% GST calculation on MDR fee.
- Identifies settlement leaks, payout delays, and math discrepancies.
"""

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any


@dataclass
class POSReceipt:
    transaction_id: str
    amount: Decimal
    payment_mode: str             # e.g., Razorpay UPI, Paytm Wallet, Card
    transaction_date: str


@dataclass
class PGSettlementRow:
    transaction_id: str
    settlement_id: str
    gross_amount: Decimal
    settlement_amount: Decimal
    mdr_fee_charged: Decimal
    gst_charged: Decimal
    settlement_date: str


@dataclass
class WalletReconciliationItem:
    transaction_id: str
    status: str                   # MATCHED, LEAK_DETECTED, MISSING_SETTLEMENT, POS_MISSING, FEE_MISMATCH
    pos_amount: Decimal
    pg_gross: Decimal
    pg_net: Decimal
    mdr_fee_expected: Decimal
    mdr_fee_charged: Decimal
    gst_expected: Decimal
    gst_charged: Decimal
    discrepancy: Decimal          # difference between pg_net and expected net
    message: str


@dataclass
class WalletReconciliationSummary:
    total_pos_receipts: int
    total_pg_rows: int
    matched_count: int
    mismatched_count: int
    total_mdr_fee: Decimal
    total_gst: Decimal
    total_leaks: Decimal
    items: List[WalletReconciliationItem] = field(default_factory=list)


def reconcile_wallet_settlements(
    pos_receipts: List[POSReceipt],
    pg_rows: List[PGSettlementRow],
    mdr_rate_percent: Decimal,
) -> WalletReconciliationSummary:
    """
    Reconciles POS transactions against payment aggregator settlements.
    GST on payment gateway fee is standardized at 18% in India.
    """
    # Lookups
    pos_map = {r.transaction_id: r for r in pos_receipts}
    pg_map = {r.transaction_id: r for r in pg_rows}
    all_keys = set(pos_map.keys()) | set(pg_map.keys())

    items: List[WalletReconciliationItem] = []
    matched_count = 0
    mismatched_count = 0
    total_mdr = Decimal("0.00")
    total_gst = Decimal("0.00")
    total_leaks = Decimal("0.00")

    gst_rate = Decimal("0.18") # Standard 18% GST on service fee

    for txn_id in all_keys:
        pos = pos_map.get(txn_id)
        pg = pg_map.get(txn_id)

        if pos and pg:
            # Check amounts
            mdr_expected = (pg.gross_amount * mdr_rate_percent / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            gst_expected = (mdr_expected * gst_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            expected_net = pg.gross_amount - mdr_expected - gst_expected

            discrepancy = pg.settlement_amount - expected_net
            fee_diff = abs(pg.mdr_fee_charged - mdr_expected)
            gst_diff = abs(pg.gst_charged - gst_expected)

            status = "MATCHED"
            msg = "Settlement reconciled perfectly."

            if pos.amount != pg.gross_amount:
                status = "LEAK_DETECTED"
                msg = f"Discrepancy in gross sales. POS={pos.amount}, PG Gross={pg.gross_amount}."
                mismatched_count += 1
                total_leaks += abs(pos.amount - pg.gross_amount)
            elif fee_diff > Decimal("0.05") or gst_diff > Decimal("0.05"):
                status = "FEE_MISMATCH"
                msg = f"PG charged incorrect MDR/GST fee. Expected fee={mdr_expected}, Charged={pg.mdr_fee_charged}."
                mismatched_count += 1
            elif abs(discrepancy) > Decimal("0.05"):
                status = "LEAK_DETECTED"
                msg = f"Net payout mismatch. Expected={expected_net}, Received={pg.settlement_amount}."
                mismatched_count += 1
                total_leaks += abs(discrepancy)
            else:
                matched_count += 1

            total_mdr += pg.mdr_fee_charged
            total_gst += pg.gst_charged

            items.append(WalletReconciliationItem(
                transaction_id=txn_id,
                status=status,
                pos_amount=pos.amount,
                pg_gross=pg.gross_amount,
                pg_net=pg.settlement_amount,
                mdr_fee_expected=mdr_expected,
                mdr_fee_charged=pg.mdr_fee_charged,
                gst_expected=gst_expected,
                gst_charged=pg.gst_charged,
                discrepancy=discrepancy,
                message=msg
            ))

        elif pos and not pg:
            # POS has transaction, no PG settlement row found (Delayed payout or gateway failure)
            mismatched_count += 1
            total_leaks += pos.amount
            items.append(WalletReconciliationItem(
                transaction_id=txn_id,
                status="MISSING_SETTLEMENT",
                pos_amount=pos.amount,
                pg_gross=Decimal("0.00"),
                pg_net=Decimal("0.00"),
                mdr_fee_expected=Decimal("0.00"),
                mdr_fee_charged=Decimal("0.00"),
                gst_expected=Decimal("0.00"),
                gst_charged=Decimal("0.00"),
                discrepancy=-pos.amount,
                message="Transaction logged in POS but not received/settled by Payment Gateway."
            ))

        else:  # pg only
            # Settlement received but transaction not found in local POS (ledger leak)
            mismatched_count += 1
            items.append(WalletReconciliationItem(
                transaction_id=txn_id,
                status="POS_MISSING",
                pos_amount=Decimal("0.00"),
                pg_gross=pg.gross_amount,
                pg_net=pg.settlement_amount,
                mdr_fee_expected=Decimal("0.00"),
                mdr_fee_charged=pg.mdr_fee_charged,
                gst_expected=Decimal("0.00"),
                gst_charged=pg.gst_charged,
                discrepancy=pg.settlement_amount,
                message="Payment settled by PG but transaction record missing in internal POS database."
            ))

    return WalletReconciliationSummary(
        total_pos_receipts=len(pos_receipts),
        total_pg_rows=len(pg_rows),
        matched_count=matched_count,
        mismatched_count=mismatched_count,
        total_mdr_fee=total_mdr,
        total_gst=total_gst,
        total_leaks=total_leaks,
        items=items
    )
