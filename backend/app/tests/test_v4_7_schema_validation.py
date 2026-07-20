"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.7.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from decimal import Decimal
from app.compliance.schemas.nic import NICEWayBillRequest, NICEWayBillLineItem
from app.schemas.dispatch import StockDispatchLineResponse, StockDispatchResponse
from app.schemas.sre import SreRuleEngineResponse


def test_pydantic_v2_nic_schema_parsing():
    """Verifies Pydantic V2 schema parsing and json_schema_extra compatibility."""
    item = NICEWayBillLineItem(
        product_name="Basmati Rice 5kg",
        hsn_code="10063020",
        quantity=10.0,
        unit="KGS",
        taxable_amount=2500.0,
    )
    req = NICEWayBillRequest(
        document_number="INV-2026-0089",
        document_date="2026-07-20",
        from_gstin="27ABCDE1234F1Z5",
        from_trd_name="SMRITI Retail Store",
        from_addr1="Plot 45",
        from_place="Mumbai",
        from_pincode=400001,
        to_gstin="27XYZAB5678G2Z9",
        to_trd_name="Apex Wholesalers",
        to_addr1="Sector 18",
        to_place="Thane",
        to_pincode=400601,
        total_value=2500.0,
        items=[item],
    )
    assert req.document_number == "INV-2026-0089"
    assert req.items[0].quantity == 10.0


def test_pydantic_v2_dispatch_schema_configdict():
    """Verifies StockDispatchLineResponse ConfigDict(from_attributes=True) functionality."""
    res = StockDispatchLineResponse(
        id="line_01",
        dispatch_id="dsp_01",
        product_id="prod_01",
        sku="SKU-01",
        name="Test Item",
        qty_sent=Decimal("10.00"),
        rate=Decimal("100.00"),
        qty_invoiced=Decimal("0.00"),
        qty_returned=Decimal("0.00"),
        qty_on_hand=Decimal("10.00"),
        tax_amount=Decimal("18.00"),
        total_amount=Decimal("118.00"),
        tenant_id="tenant_01",
    )
    assert res.id == "line_01"
    assert res.total_amount == Decimal("118.00")


def test_pydantic_v2_sre_schema_configdict():
    """Verifies SreRuleEngineResponse ConfigDict(from_attributes=True) functionality."""
    res = SreRuleEngineResponse(
        id="sre_rule_01",
        uuid="uuid-sre-01",
        tenant_id="tenant_01",
        dispatch_type="APPROVAL",
        tax_timing="ON_APPROVAL",
        max_deferral_days=90,
        warning_buffer_days=15,
        required_document_type="APPROVAL_NOTE",
    )
    assert res.dispatch_type == "APPROVAL"
    assert res.max_deferral_days == 90
