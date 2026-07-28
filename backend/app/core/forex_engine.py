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

"""
SMRITI Indian & International Accounting Core Layer - Multi-Currency Forex Realization Engine
Conforms to Indian Accounting Standard (Ind AS 21) & AS-11 (The Effects of Changes in Foreign Exchange Rates).

Handles:
1. Realized Foreign Exchange Gain/Loss on trade settlement (Receivables / Payables).
2. Unrealized Foreign Exchange Gain/Loss on year-end / balance sheet closing revaluation.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ForexTransactionType(str, Enum):
    RECEIVABLE_INVOICE = "RECEIVABLE_INVOICE"
    PAYABLE_BILL = "PAYABLE_BILL"
    CUSTOMER_RECEIPT = "CUSTOMER_RECEIPT"
    SUPPLIER_PAYMENT = "SUPPLIER_PAYMENT"


@dataclass
class ForexRealizationResult:
    currency: str
    foreign_amount: float
    invoice_exchange_rate: float
    settlement_exchange_rate: float
    base_currency_invoice_val: float
    base_currency_settlement_val: float
    realized_gain_loss: float
    is_gain: bool
    gl_account_code: str


@dataclass
class ForexUnrealizedRevaluationResult:
    currency: str
    outstanding_foreign_amount: float
    original_exchange_rate: float
    closing_exchange_rate: float
    book_value: float
    revalued_value: float
    unrealized_gain_loss: float
    is_gain: bool


class ForexGainLossCalculator:
    """
    Canonical Forex Engine for Foreign Exchange Gain/Loss Accounting under Ind AS 21.
    """

    @staticmethod
    def calculate_realized_gain_loss(
        currency: str,
        foreign_amount: float,
        invoice_exchange_rate: float,
        settlement_exchange_rate: float,
        is_receivable: bool = True,
    ) -> ForexRealizationResult:
        if foreign_amount <= 0:
            raise ValueError("Foreign currency amount must be greater than 0.")
        if invoice_exchange_rate <= 0 or settlement_exchange_rate <= 0:
            raise ValueError("Exchange rates must be greater than 0.")

        invoice_val_inr = foreign_amount * invoice_exchange_rate
        settlement_val_inr = foreign_amount * settlement_exchange_rate

        if is_receivable:
            # For Customer Receivable: If INR received on settlement date > INR recorded at invoice date -> GAIN
            diff = settlement_val_inr - invoice_val_inr
        else:
            # For Supplier Payable: If INR paid on settlement date < INR recorded at bill date -> GAIN
            diff = invoice_val_inr - settlement_val_inr

        is_gain = diff >= 0
        gl_account = "4200-FOREX-GAIN" if is_gain else "5200-FOREX-LOSS"

        return ForexRealizationResult(
            currency=currency.upper(),
            foreign_amount=foreign_amount,
            invoice_exchange_rate=invoice_exchange_rate,
            settlement_exchange_rate=settlement_exchange_rate,
            base_currency_invoice_val=round(invoice_val_inr, 2),
            base_currency_settlement_val=round(settlement_val_inr, 2),
            realized_gain_loss=round(abs(diff), 2),
            is_gain=is_gain,
            gl_account_code=gl_account,
        )

    @staticmethod
    def calculate_unrealized_revaluation(
        currency: str,
        outstanding_foreign_amount: float,
        original_exchange_rate: float,
        closing_exchange_rate: float,
        is_receivable: bool = True,
    ) -> ForexUnrealizedRevaluationResult:
        if outstanding_foreign_amount <= 0:
            raise ValueError("Outstanding foreign currency amount must be greater than 0.")

        book_val = outstanding_foreign_amount * original_exchange_rate
        revalued_val = outstanding_foreign_amount * closing_exchange_rate

        if is_receivable:
            diff = revalued_val - book_val
        else:
            diff = book_val - revalued_val

        is_gain = diff >= 0

        return ForexUnrealizedRevaluationResult(
            currency=currency.upper(),
            outstanding_foreign_amount=outstanding_foreign_amount,
            original_exchange_rate=original_exchange_rate,
            closing_exchange_rate=closing_exchange_rate,
            book_value=round(book_val, 2),
            revalued_value=round(revalued_val, 2),
            unrealized_gain_loss=round(abs(diff), 2),
            is_gain=is_gain,
        )
