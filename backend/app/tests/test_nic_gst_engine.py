"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 26.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for Domain Release Phase 32 NIC GST Gateway

test_nic_gst_engine.py — Integration test suite for NIC GST Gateway (v26.0.0).
"""

import pytest

from app.core.nic_gst.nic_einvoice import NICEInvoiceEngine
from app.core.nic_gst.nic_ewaybill import NICEWayBillEngine
from app.core.nic_gst.nic_gstr_reconciler import NICGSTRReconcilerEngine


@pytest.mark.asyncio
async def test_einvoice_irn_computation():
    """Verify NICEInvoiceEngine computes SHA-256 IRN hash and signed QR payload."""
    res = NICEInvoiceEngine.generate_irn_and_qr("INV-2026-001", "27AAAAA0000A1Z5", "27BBBBA1111B1Z2", 118000.0)
    assert res["status"] == "IRN_GENERATED_SUCCESSFULLY"
    assert len(res["irn_hash"]) == 64
    assert "JWT_NIC_SIGNED" in res["signed_qr_code"]


@pytest.mark.asyncio
async def test_ewaybill_threshold_evaluation():
    """Verify NICEWayBillEngine enforces Rs.50,000 consignment threshold."""
    # Consignment <= Rs 50,000 -> Not required
    res_sub = NICEWayBillEngine.generate_eway_bill("INV-SUB-50K", "27TRANS1234", "MH-12-AB-1234", 45000.0)
    assert res_sub["is_eway_bill_required"] is False

    # Consignment > Rs 50,000 -> Required & Generated
    res_above = NICEWayBillEngine.generate_eway_bill("INV-ABOVE-50K", "27TRANS1234", "MH-12-AB-1234", 150000.0, distance_km=350)
    assert res_above["is_eway_bill_required"] is True
    assert res_above["status"] == "EWAY_BILL_GENERATED"
    assert len(res_above["eway_bill_no"]) == 12


@pytest.mark.asyncio
async def test_gstr1_summary_compilation():
    """Verify NICGSTRReconcilerEngine compiles tax return filing summary payload."""
    res = NICGSTRReconcilerEngine.compile_gstr1_summary("2026-07")
    assert res["period"] == "2026-07"
    assert res["reconciliation_status"] == "BALANCED_READY_FOR_FILING"
    assert res["total_tax"] == res["total_cgst"] + res["total_sgst"] + res["total_igst"]
