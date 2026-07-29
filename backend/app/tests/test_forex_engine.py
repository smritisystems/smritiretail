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
from app.core.forex_engine import ForexGainLossCalculator

def test_realized_forex_gain_receivable():
    # Export invoice of $10,000 USD at 1 USD = 83.00 INR (Booked at ₹830,000)
    # Payment received at 1 USD = 85.50 INR (Received ₹855,000)
    # Realized Gain: ₹25,000 INR
    res = ForexGainLossCalculator.calculate_realized_gain_loss(
        currency="USD",
        foreign_amount=10000.0,
        invoice_exchange_rate=83.00,
        settlement_exchange_rate=85.50,
        is_receivable=True,
    )
    assert res.is_gain is True
    assert res.realized_gain_loss == 25000.0
    assert res.gl_account_code == "4200-FOREX-GAIN"

def test_realized_forex_loss_payable():
    # Import bill of $5,000 USD at 1 USD = 83.00 INR (Booked at ₹415,000)
    # Paid supplier at 1 USD = 84.00 INR (Paid ₹420,000)
    # Realized Loss: ₹5,000 INR
    res = ForexGainLossCalculator.calculate_realized_gain_loss(
        currency="USD",
        foreign_amount=5000.0,
        invoice_exchange_rate=83.00,
        settlement_exchange_rate=84.00,
        is_receivable=False,
    )
    assert res.is_gain is False
    assert res.realized_gain_loss == 5000.0
    assert res.gl_account_code == "5200-FOREX-LOSS"

def test_unrealized_forex_revaluation():
    # Year-end revaluation of $1,000 outstanding receivable: original 82.00, closing 84.00
    res = ForexGainLossCalculator.calculate_unrealized_revaluation(
        currency="USD",
        outstanding_foreign_amount=1000.0,
        original_exchange_rate=82.00,
        closing_exchange_rate=84.00,
        is_receivable=True,
    )
    assert res.is_gain is True
    assert res.unrealized_gain_loss == 2000.0
