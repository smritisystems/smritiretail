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
SMRITI Indian Compliance Core Layer (ICCL) - Bank Statement Reconciler

Auto-reconciliation engine to match bank statement entries against local ledgers:
- Supports Indian banking references (UTR, IMPS/NEFT, UPI ref, cheque numbers).
- Auto-matching rules: Reference matching, date-window offsets, amount matching.
- Generates detailed reconciliation report distinguishing matched, unmatched, and flagged charges.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Tuple


@dataclass
class BankStatementEntry:
    entry_id: str
    entry_date: date
    description: str
    ref_number: Optional[str]     # UTR, Cheque number, UPI ref
    amount: Decimal
    is_credit: bool               # True = Credit (receipt), False = Debit (payment)


@dataclass
class BookLedgerEntry:
    ledger_id: str
    entry_date: date
    description: str
    ref_number: Optional[str]
    amount: Decimal
    is_credit: bool


@dataclass
class BankMatchItem:
    statement_entry: BankStatementEntry
    ledger_entry: Optional[BookLedgerEntry]
    match_status: str             # EXACT, FUZZY_REF, FUZZY_DATE, UNMATCHED
    matching_score: int           # 0 to 100
    notes: str


@dataclass
class BankReconciliationReport:
    total_statement_entries: int
    total_ledger_entries: int
    exact_matches: int
    fuzzy_matches: int
    unmatched_statement: int
    unmatched_ledger: int
    reconciled_percentage: Decimal
    items: List[BankMatchItem] = field(default_factory=list)
    unmatched_ledger_entries: List[BookLedgerEntry] = field(default_factory=list)


def parse_bank_statement_csv(csv_content: str) -> List[BankStatementEntry]:
    """
    Mock parser for Indian Bank statements (e.g. CSV dump from HDFC/ICICI).
    Lines format: Date,Description,Ref Number,Amount,Transaction Type (CR/DR)
    """
    entries = []
    lines = csv_content.strip().split("\n")
    for idx, line in enumerate(lines):
        if not line or idx == 0: # Skip header
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 5:
            continue
        try:
            entry_date = datetime.strptime(parts[0], "%Y-%m-%d").date()
            amount = Decimal(parts[3])
            is_credit = parts[4].upper() in ("CR", "CREDIT", "IN")
            entries.append(BankStatementEntry(
                entry_id=f"stmt_{idx}",
                entry_date=entry_date,
                description=parts[1],
                ref_number=parts[2] if parts[2] else None,
                amount=amount,
                is_credit=is_credit
            ))
        except (ValueError, IndexError):
            continue
    return entries


def reconcile_bank_statement(
    statement_entries: List[BankStatementEntry],
    ledger_entries: List[BookLedgerEntry],
    date_tolerance_days: int = 3
) -> BankReconciliationReport:
    """
    Executes multi-rule matching to reconcile statement rows with book ledger logs.
    """
    # Clone ledger list to keep track of matched items
    unmatched_ledgers = list(ledger_entries)
    report_items: List[BankMatchItem] = []
    
    exact_count = 0
    fuzzy_count = 0

    # Normalization helper for references (e.g. NEFT-100293 -> 100293)
    def normalize_ref(ref: Optional[str]) -> str:
        if not ref:
            return ""
        # Keep only alphanumeric characters
        return re.sub(r"[^a-zA-Z0-9]", "", ref).upper()

    for stmt in statement_entries:
        match_found = None
        match_status = "UNMATCHED"
        score = 0
        notes = "No matching entry found in books."

        stmt_ref_norm = normalize_ref(stmt.ref_number)

        # Rule 1: Exact Match (Amount + normalized Ref + direction)
        for led in unmatched_ledgers:
            if led.amount == stmt.amount and led.is_credit == stmt.is_credit:
                led_ref_norm = normalize_ref(led.ref_number)
                if stmt_ref_norm and led_ref_norm and stmt_ref_norm == led_ref_norm:
                    # Check date difference
                    date_diff = abs((stmt.entry_date - led.entry_date).days)
                    if date_diff <= date_tolerance_days:
                        match_found = led
                        match_status = "EXACT"
                        score = 100
                        notes = f"Matched exactly by reference and amount (Date delta: {date_diff} days)."
                        exact_count += 1
                        break

        # Rule 2: Fuzzy match by Ref and Amount (wider date tolerance or date mismatch)
        if not match_found:
            for led in unmatched_ledgers:
                if led.amount == stmt.amount and led.is_credit == stmt.is_credit:
                    led_ref_norm = normalize_ref(led.ref_number)
                    if stmt_ref_norm and led_ref_norm and stmt_ref_norm == led_ref_norm:
                        match_found = led
                        match_status = "FUZZY_REF"
                        score = 80
                        notes = "Matched by reference and amount; date difference exceeds normal tolerance."
                        fuzzy_count += 1
                        break

        # Rule 3: Fuzzy match by Date and Amount (Reference mismatch / missing reference)
        if not match_found:
            for led in unmatched_ledgers:
                if led.amount == stmt.amount and led.is_credit == stmt.is_credit:
                    date_diff = abs((stmt.entry_date - led.entry_date).days)
                    if date_diff <= date_tolerance_days:
                        # Match by amount and close dates, ref differs or is missing
                        match_found = led
                        match_status = "FUZZY_DATE"
                        score = 60
                        notes = f"Matched by amount and date delta ({date_diff} days), but reference codes differ or are blank."
                        fuzzy_count += 1
                        break

        if match_found:
            unmatched_ledgers.remove(match_found)
            report_items.append(BankMatchItem(
                statement_entry=stmt,
                ledger_entry=match_found,
                match_status=match_status,
                matching_score=score,
                notes=notes
            ))
        else:
            report_items.append(BankMatchItem(
                statement_entry=stmt,
                ledger_entry=None,
                match_status="UNMATCHED",
                matching_score=0,
                notes=notes
            ))

    reconciled_count = exact_count + fuzzy_count
    total_stmt = len(statement_entries)
    percentage = (
        Decimal(reconciled_count) / Decimal(total_stmt) * Decimal("100")
        if total_stmt > 0 else Decimal("100.00")
    ).quantize(Decimal("0.01"))

    return BankReconciliationReport(
        total_statement_entries=total_stmt,
        total_ledger_entries=len(ledger_entries),
        exact_matches=exact_count,
        fuzzy_matches=fuzzy_count,
        unmatched_statement=total_stmt - reconciled_count,
        unmatched_ledger=len(unmatched_ledgers),
        reconciled_percentage=percentage,
        items=report_items,
        unmatched_ledger_entries=unmatched_ledgers
    )
