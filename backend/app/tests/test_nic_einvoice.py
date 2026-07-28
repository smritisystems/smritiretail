"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from decimal import Decimal
from app.services.nic_einvoice_gateway import NICEInvoiceGatewayService

def test_nic_einvoice_irn_computation():
    irn = NICEInvoiceGatewayService.compute_irn_hash("09AAACS1234A1Z1", "INV", "INV-2026-001", "2026-27")
    assert len(irn) == 64
    assert irn.isalnum()

def test_nic_einvoice_payload_compilation():
    items = [{"item_name": "Paracetamol 500", "qty": 10, "rate": 25.0}]
    payload = NICEInvoiceGatewayService.compile_einvoice_payload(
        "09AAACS1234A1Z1", "27AABCU9603R1ZM", "INV-2026-001", "28/07/2026", items, Decimal("250.00")
    )
    assert payload["Version"] == "1.03"
    assert payload["DocDtls"]["No"] == "INV-2026-001"
    assert payload["ValDtls"]["TotVal"] == 250.0
    assert len(payload["Irn"]) == 64
