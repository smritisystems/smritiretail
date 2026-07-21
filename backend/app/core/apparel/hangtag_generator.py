"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 25.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Custom Hang-Tag Thermal Barcode Generator
"""

from typing import Dict, Any


class HangtagGeneratorEngine:
    """Thermal Printer ZPL/EAN-13 Hangtag Generator."""

    @staticmethod
    def render_hangtag(style_code: str, color: str, size: str, mrp: float, barcode: str) -> Dict[str, Any]:
        zpl_payload = (
            f"^XA\n"
            f"^FO50,30^A0N,30,30^FDSMRITI FASHION^FS\n"
            f"^FO50,70^A0N,25,25^FDSTYLE: {style_code}^FS\n"
            f"^FO50,105^A0N,25,25^FDCLR: {color} | SIZE: {size}^FS\n"
            f"^FO50,140^A0N,35,35^FDMRP: Rs.{mrp:.2f}^FS\n"
            f"^FO50,180^BEN,50,Y,N^FD{barcode}^FS\n"
            f"^XZ"
        )

        return {
            "style_code": style_code,
            "color": color,
            "size": size,
            "mrp": mrp,
            "barcode": barcode,
            "thermal_zpl_payload": zpl_payload
        }
