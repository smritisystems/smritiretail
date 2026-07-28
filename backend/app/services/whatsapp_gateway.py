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

whatsapp_gateway.py — WhatsApp Business API Automated Receipt Notification Gateway Service
Conforms to Level 1 SMRITI Architecture Constitution (ADR-003 & Rule GR-001).
"""

from typing import Dict, Any
from decimal import Decimal

class WhatsAppGatewayService:
    """WhatsApp Cloud API integration for automated customer receipt & invoice PDF links."""

    @staticmethod
    def format_indian_phone(phone_raw: str) -> str:
        """Normalizes Indian phone numbers to E.164 format (+91XXXXXXXXXX)."""
        clean = ''.join(c for c in phone_raw if c.isdigit())
        if len(clean) == 10:
            return f"91{clean}"
        elif len(clean) == 12 and clean.startswith("91"):
            return clean
        return clean

    @staticmethod
    def render_invoice_receipt_template(
        customer_name: str,
        phone: str,
        invoice_no: str,
        grand_total: Decimal,
        pdf_download_url: str
    ) -> Dict[str, Any]:
        """
        Renders WhatsApp Business Cloud API JSON payload for invoice_receipt_v1 template.
        """
        formatted_phone = WhatsAppGatewayService.format_indian_phone(phone)
        return {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": formatted_phone,
            "type": "template",
            "template": {
                "name": "invoice_receipt_v1",
                "language": {"code": "en_US"},
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": customer_name},
                            {"type": "text", "text": invoice_no},
                            {"type": "text", "text": f"Rs. {Decimal(str(grand_total)):.2f}"},
                            {"type": "text", "text": pdf_download_url}
                        ]
                    }
                ]
            }
        }
