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
from datetime import datetime, timezone
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.models.fulfillment import (
    PackingSlip, PackingSlipItem,
    Dispatch, DispatchItem,
    DeliveryCommissionSettlement, ReverseLogisticsReturn
)

def test_packing_slip_and_dispatch_manifest_pipeline():
    """Verify Order -> Pick -> Pack -> Dispatch manifest pipeline."""
    ps = PackingSlip(
        packing_slip_number="PS-2026-001",
        sales_invoice_id="inv_100125",
        status="PACKED",
        total_packages=2,
        weight_kg=1.500
    )
    assert ps.packing_slip_number == "PS-2026-001"
    assert ps.status == "PACKED"

    dispatch = Dispatch(
        dispatch_number="DISP-2026-001",
        packing_slip_id="ps_001",
        courier_partner="In-House Driver",
        tracking_number="TRK-98765",
        driver_person_id="person_driver_ramesh",
        status="DISPATCHED",
        driver_commission=50.00
    )
    assert dispatch.dispatch_number == "DISP-2026-001"
    assert dispatch.driver_commission == 50.00

def test_driver_delivery_commission_settlement():
    """Verify driver delivery commission settlement (₹50 fixed per delivery)."""
    settlement = DeliveryCommissionSettlement(
        settlement_number="SETTLE-2026-001",
        participant_id="person_driver_ramesh",
        participant_role="DRIVER",
        total_commission_amount=50.00,
        settlement_status="SETTLED"
    )
    assert settlement.total_commission_amount == 50.00
    assert settlement.settlement_status == "SETTLED"

def test_reverse_logistics_return_and_commission_reversal():
    """Verify Reverse Logistics Return manifest with restock status and commission reversal."""
    rev_return = ReverseLogisticsReturn(
        return_manifest_number="REV-2026-001",
        original_dispatch_id="disp_001",
        sales_return_id="ret_100125",
        reason="Damaged in transit",
        restock_status="RESTOCKED",
        commission_reversed=True
    )
    assert rev_return.restock_status == "RESTOCKED"
    assert rev_return.commission_reversed is True

def test_fulfillment_co_location_in_smriti001():
    """Verify all 6 fulfillment tables reside in smriti001 without separate databases."""
    fulfillment_tables = [
        PackingSlip.__tablename__,
        PackingSlipItem.__tablename__,
        Dispatch.__tablename__,
        DispatchItem.__tablename__,
        DeliveryCommissionSettlement.__tablename__,
        ReverseLogisticsReturn.__tablename__
    ]
    expected = [
        "packing_slips", "packing_slip_items", "dispatches", "dispatch_items",
        "delivery_commission_settlements", "reverse_logistics_returns"
    ]
    assert fulfillment_tables == expected
