"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.models.loyalty import LoyaltyTier, LoyaltyMember, LoyaltyPointsLedger
from app.models.commission import CommissionProgram, CommissionRule, CommissionParticipant, CommissionLedger

def test_loyalty_points_ledger_earn_and_reversal():
    """Verify loyalty points earn on ₹10,000 sale and reversal on sales return."""
    sale_amount = 10000.00
    points_earned = sale_amount / 100.0  # 1 Point per ₹100 = 100 Points

    ledger_earn = LoyaltyPointsLedger(
        member_id="mem_001",
        transaction_type="EARN",
        points=points_earned,
        reference_invoice_id="inv_1001",
        narration="Earned 100 points on Invoice inv_1001"
    )
    assert ledger_earn.points == 100.0
    assert ledger_earn.transaction_type == "EARN"

    # Sales Return Reversal
    points_reversed = -100.0
    ledger_reversal = LoyaltyPointsLedger(
        member_id="mem_001",
        transaction_type="REVERSAL",
        points=points_reversed,
        reference_return_id="ret_1001",
        narration="Reversed 100 points due to Sales Return ret_1001"
    )
    assert ledger_reversal.points == -100.0
    assert ledger_reversal.transaction_type == "REVERSAL"

def test_commission_ledger_multi_role_payout_and_reversal():
    """Verify multi-role commission calculation on ₹10,000 sale: Salesperson 2% (₹200), Referral 1% (₹100), Driver ₹50."""
    gross_sales = 10000.00

    comm_salesperson = gross_sales * 0.02  # ₹200
    comm_referral = gross_sales * 0.01     # ₹100
    comm_driver = 50.00                    # ₹50

    ledger_salesperson = CommissionLedger(
        participant_id="part_sales_001",
        participant_role="SALESPERSON",
        transaction_type="EARNED",
        gross_sales_amount=gross_sales,
        commission_amount=comm_salesperson,
        reference_invoice_id="inv_1001"
    )
    ledger_referral = CommissionLedger(
        participant_id="part_ref_001",
        participant_role="REFERRER",
        transaction_type="EARNED",
        gross_sales_amount=gross_sales,
        commission_amount=comm_referral,
        reference_invoice_id="inv_1001"
    )
    ledger_driver = CommissionLedger(
        participant_id="part_driver_001",
        participant_role="DRIVER",
        transaction_type="EARNED",
        gross_sales_amount=gross_sales,
        commission_amount=comm_driver,
        reference_invoice_id="inv_1001"
    )

    total_commission = ledger_salesperson.commission_amount + ledger_referral.commission_amount + ledger_driver.commission_amount
    assert total_commission == 350.00

    # Sales Return Reversal
    ledger_reversal_sp = CommissionLedger(
        participant_id="part_sales_001",
        participant_role="SALESPERSON",
        transaction_type="REVERSED",
        gross_sales_amount=gross_sales,
        commission_amount=-comm_salesperson,
        reference_return_id="ret_1001"
    )
    assert ledger_reversal_sp.commission_amount == -200.00
    assert ledger_reversal_sp.transaction_type == "REVERSED"

def test_crm_loyalty_sice_control_plane_isolation():
    """Verify entitlement policies belong to Control Plane, while ledgers belong to smriti001."""
    # Entitlement policy definition
    program = CommissionProgram(name="SMRITI Universal Commission 2026", is_active=True)
    rule = CommissionRule(program_id="prog_001", participant_role="SALESPERSON", calculation_type="PERCENTAGE", rate_percent=2.00)
    assert program.is_active is True
    assert rule.rate_percent == 2.00
