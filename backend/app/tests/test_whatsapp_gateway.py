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
from app.services.whatsapp_gateway import WhatsAppGatewayService

def test_whatsapp_phone_normalization():
    assert WhatsAppGatewayService.format_indian_phone("9876543210") == "919876543210"
    assert WhatsAppGatewayService.format_indian_phone("+91 98765 43210") == "919876543210"

def test_whatsapp_receipt_template_rendering():
    payload = WhatsAppGatewayService.render_invoice_receipt_template(
        "Ramesh Kumar", "9876543210", "INV-10045", Decimal("1500.50"), "https://portal.smritisys.com/inv/10045"
    )
    assert payload["to"] == "919876543210"
    assert payload["template"]["name"] == "invoice_receipt_v1"
    params = payload["template"]["components"][0]["parameters"]
    assert params[0]["text"] == "Ramesh Kumar"
    assert params[1]["text"] == "INV-10045"
    assert params[2]["text"] == "Rs. 1500.50"
