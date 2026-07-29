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

esc_pos_printer.py — Thermal Printer ESC/POS Byte Renderer Engine
Conforms to Level 1 SMRITI Architecture Constitution (ADR-003 & Rule GR-001).
"""

from typing import List, Dict, Any
from decimal import Decimal

class ESCPOSThermalPrinter:
    """ESC/POS Command Encoder for 80mm & 58mm Thermal Receipt Printers."""

    ESC = b'\x1b'
    GS = b'\x1d'
    INIT = ESC + b'@'
    ALIGN_CENTER = ESC + b'a\x01'
    ALIGN_LEFT = ESC + b'a\x00'
    BOLD_ON = ESC + b'E\x01'
    BOLD_OFF = ESC + b'E\x00'
    CUT_PAPER = GS + b'V\x41\x00'

    @staticmethod
    def generate_receipt_bytes(store_name: str, invoice_no: str, items: List[Dict[str, Any]], grand_total: Decimal) -> bytes:
        """
        Encodes invoice details into raw ESC/POS byte stream for thermal printing.
        """
        output = bytearray()
        output.extend(ESCPOSThermalPrinter.INIT)
        output.extend(ESCPOSThermalPrinter.ALIGN_CENTER)
        output.extend(ESCPOSThermalPrinter.BOLD_ON)
        output.extend(f"{store_name}\n".encode('utf-8'))
        output.extend(ESCPOSThermalPrinter.BOLD_OFF)
        output.extend(f"Invoice: {invoice_no}\n".encode('utf-8'))
        output.extend(b"--------------------------------\n")

        output.extend(ESCPOSThermalPrinter.ALIGN_LEFT)
        for item in items:
            name = item.get("name", "Item")[:16].ljust(16)
            qty = str(item.get("qty", 1)).rjust(3)
            price = f"{Decimal(str(item.get('price', 0))):.2f}".rjust(9)
            output.extend(f"{name} {qty} {price}\n".encode('utf-8'))

        output.extend(b"--------------------------------\n")
        output.extend(ESCPOSThermalPrinter.BOLD_ON)
        output.extend(f"TOTAL: RS. {Decimal(str(grand_total)):.2f}\n".encode('utf-8'))
        output.extend(ESCPOSThermalPrinter.BOLD_OFF)
        output.extend(ESCPOSThermalPrinter.ALIGN_CENTER)
        output.extend(b"Thank you for shopping!\n\n")
        output.extend(ESCPOSThermalPrinter.CUT_PAPER)

        return bytes(output)
