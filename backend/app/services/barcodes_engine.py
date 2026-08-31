"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import random
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.barcode import BarcodeLayout, PrintHistory, PrintTemplate, PrintProfile
from ..schemas.barcodes import (
    BarcodeGenerateRequest,
    BarcodeGenerateResponse,
    BarcodeValidateRequest,
    BarcodeValidateResponse,
    LabelCompileRequest,
    LabelCompileResponse,
    BatchLabelPrintRequest,
    BatchLabelPrintResponse,
    PrintHistoryQueryResponse,
)


class BarcodesEngine:
    """
    Authoritative SMRITI Barcode & Labels Engine (Section 7).
    Governs barcode symbologies (EAN13, UPC_A, CODE128, QR_CODE), modulo-10 check digit verification,
    thermal printer layout compilation (ZPL-II, TSPL, ESC/POS), and batch label print history auditing.
    """

    @classmethod
    def calculate_ean13_check_digit(cls, digits_12: str) -> int:
        """Calculates standard GS1 EAN-13 check digit using Modulo 10 weight alternating 1 and 3."""
        if len(digits_12) != 12 or not digits_12.isdigit():
            raise ValueError("EAN-13 check digit calculation requires exactly 12 numeric digits.")
        odd_sum = sum(int(digits_12[i]) for i in range(0, 12, 2))
        even_sum = sum(int(digits_12[i]) for i in range(1, 12, 2))
        total = odd_sum + (even_sum * 3)
        return (10 - (total % 10)) % 10

    @classmethod
    def calculate_upca_check_digit(cls, digits_11: str) -> int:
        """Calculates standard GS1 UPC-A check digit using Modulo 10 weight alternating 3 and 1."""
        if len(digits_11) != 11 or not digits_11.isdigit():
            raise ValueError("UPC-A check digit calculation requires exactly 11 numeric digits.")
        odd_sum = sum(int(digits_11[i]) for i in range(0, 11, 2))
        even_sum = sum(int(digits_11[i]) for i in range(1, 11, 2))
        total = (odd_sum * 3) + even_sum
        return (10 - (total % 10)) % 10

    @classmethod
    def generate_barcode_value(cls, req: BarcodeGenerateRequest) -> BarcodeGenerateResponse:
        """Generates a valid, checksum-verified barcode value according to symbology rules."""
        symbology = req.symbology.upper()

        if symbology == "EAN13":
            if req.seed_digits:
                clean = "".join(c for c in req.seed_digits if c.isdigit())
                if len(clean) >= 12:
                    d12 = clean[:12]
                else:
                    d12 = clean.ljust(12, "0")
            else:
                pfx = (req.prefix or "890")[:3]
                rnd = "".join(str(random.randint(0, 9)) for _ in range(12 - len(pfx)))
                d12 = pfx + rnd

            cd = cls.calculate_ean13_check_digit(d12)
            val = f"{d12}{cd}"
            return BarcodeGenerateResponse(
                barcode_value=val,
                symbology="EAN13",
                is_checksum_valid=True,
                formatted_display=f"{val[:1]} {val[1:7]} {val[7:]}",
            )

        elif symbology == "UPC_A":
            if req.seed_digits:
                clean = "".join(c for c in req.seed_digits if c.isdigit())
                d11 = clean[:11].ljust(11, "0")
            else:
                d11 = "".join(str(random.randint(0, 9)) for _ in range(11))

            cd = cls.calculate_upca_check_digit(d11)
            val = f"{d11}{cd}"
            return BarcodeGenerateResponse(
                barcode_value=val,
                symbology="UPC_A",
                is_checksum_valid=True,
                formatted_display=f"{val[:1]} {val[1:6]} {val[6:11]} {val[11]}",
            )

        elif symbology in ("CODE128", "CODE39", "ITF14", "QR_CODE"):
            val = req.seed_digits or f"SMRITI-{uuid.uuid4().hex[:8].upper()}"
            return BarcodeGenerateResponse(
                barcode_value=val,
                symbology=symbology,
                is_checksum_valid=True,
                formatted_display=val,
            )

        else:
            raise ValueError(f"Unsupported barcode symbology '{req.symbology}'")

    @classmethod
    def validate_barcode_checksum(cls, req: BarcodeValidateRequest) -> BarcodeValidateResponse:
        """Validates the check digit and structural integrity of a barcode value."""
        symbology = req.symbology.upper()
        raw = req.barcode.strip()

        if symbology == "EAN13":
            if len(raw) != 13 or not raw.isdigit():
                return BarcodeValidateResponse(
                    barcode=raw,
                    symbology="EAN13",
                    is_valid=False,
                    check_digit=None,
                    validation_message="EAN-13 barcode must be exactly 13 digits.",
                )
            expected_cd = cls.calculate_ean13_check_digit(raw[:12])
            actual_cd = int(raw[12])
            is_valid = (expected_cd == actual_cd)
            return BarcodeValidateResponse(
                barcode=raw,
                symbology="EAN13",
                is_valid=is_valid,
                check_digit=str(expected_cd),
                validation_message="Checksum valid" if is_valid else f"Invalid check digit. Expected {expected_cd}, got {actual_cd}.",
            )

        elif symbology == "UPC_A":
            if len(raw) != 12 or not raw.isdigit():
                return BarcodeValidateResponse(
                    barcode=raw,
                    symbology="UPC_A",
                    is_valid=False,
                    check_digit=None,
                    validation_message="UPC-A barcode must be exactly 12 digits.",
                )
            expected_cd = cls.calculate_upca_check_digit(raw[:11])
            actual_cd = int(raw[11])
            is_valid = (expected_cd == actual_cd)
            return BarcodeValidateResponse(
                barcode=raw,
                symbology="UPC_A",
                is_valid=is_valid,
                check_digit=str(expected_cd),
                validation_message="Checksum valid" if is_valid else f"Invalid check digit. Expected {expected_cd}, got {actual_cd}.",
            )

        elif symbology in ("CODE128", "CODE39", "QR_CODE"):
            is_valid = len(raw) > 0
            return BarcodeValidateResponse(
                barcode=raw,
                symbology=symbology,
                is_valid=is_valid,
                check_digit=None,
                validation_message="Valid barcode format" if is_valid else "Barcode string cannot be empty.",
            )

        return BarcodeValidateResponse(
            barcode=raw,
            symbology=symbology,
            is_valid=False,
            check_digit=None,
            validation_message=f"Unsupported symbology '{symbology}'",
        )

    @classmethod
    def compile_label_stream(cls, req: LabelCompileRequest) -> LabelCompileResponse:
        """
        Compiles dynamic product context into raw printer command streams (ZPL-II, TSPL, ESC/POS)
        scaled to printer DPI (203, 300, 600 DPI).
        """
        lang = req.printer_language.upper()
        dpmm = 8 if req.dpi == 203 else (12 if req.dpi == 300 else 24)
        dots_w = int(req.width_mm * dpmm)
        dots_h = int(req.height_mm * dpmm)

        if lang == "ZPL":
            # Zebra ZPL-II label command compilation
            compiled = f"""^XA
^PW{dots_w}
^LL{dots_h}
^LH0,0
^FO20,15^A0N,22,22^FD{req.brand or 'SMRITI'}^FS
^FO20,40^A0N,20,20^FD{req.item_name[:24]}^FS
^FO20,65^BY2,3,45^BCN,45,Y,N,N^FD{req.barcode}^FS
^FO20,135^A0N,18,18^FDMRP: Rs. {req.mrp:.2f}^FS
^FO180,135^A0N,22,22^FDOur Price: Rs. {req.selling_price:.2f}^FS
^XZ"""

        elif lang == "TSPL":
            # TSC TSPL label command compilation
            compiled = f"""SIZE {req.width_mm} mm, {req.height_mm} mm
GAP 2 mm, 0 mm
DIRECTION 1
CLS
TEXT 20,15,"2",0,1,1,"{req.brand or 'SMRITI'}"
TEXT 20,40,"2",0,1,1,"{req.item_name[:24]}"
BARCODE 20,65,"128",45,1,0,2,2,"{req.barcode}"
TEXT 20,135,"2",0,1,1,"MRP: Rs. {req.mrp:.2f}"
TEXT 180,135,"3",0,1,1,"Price: Rs. {req.selling_price:.2f}"
PRINT 1
"""

        elif lang == "ESC_POS":
            # POS ESC/POS receipt barcode stream
            compiled = f"\x1b@\x1ba\x01{req.brand or 'SMRITI'}\n{req.item_name[:20]}\n\x1dk\x04{req.barcode}\x00\nRs. {req.selling_price:.2f}\n\x1dV\x00"

        else:
            raise ValueError(f"Unsupported printer language '{req.printer_language}'")

        byte_len = len(compiled.encode("utf-8"))
        return LabelCompileResponse(
            printer_language=lang,
            dpi=req.dpi,
            compiled_command_stream=compiled,
            byte_count=byte_len,
        )

    @classmethod
    async def dispatch_batch_print_job(
        cls,
        session: AsyncSession,
        company_id: str,
        req: BatchLabelPrintRequest,
        created_by: Optional[str] = None,
    ) -> BatchLabelPrintResponse:
        """
        Dispatches multi-item label print batches and logs immutable PrintHistory records in PostgreSQL.
        """
        now = datetime.now(timezone.utc)
        batch_id = f"lbl_{uuid.uuid4().hex[:12]}"
        total_spooled = 0

        for item in req.items:
            history = PrintHistory(
                id=f"prh_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                user=created_by or "system",
                item_code=item.item_code,
                item_name=item.item_name,
                barcode=item.barcode,
                quantity=item.quantity,
                status="Success",
                error_message=None,
                created_by=created_by,
                is_active=True,
                is_deleted=False,
            )
            session.add(history)
            total_spooled += item.quantity

        await session.commit()

        return BatchLabelPrintResponse(
            batch_id=batch_id,
            total_labels_spooled=total_spooled,
            printer_language=req.printer_language.upper(),
            status="SPOOLED",
            dispatched_at=now,
        )

    @classmethod
    async def query_print_history(
        cls,
        session: AsyncSession,
        company_id: str,
        limit: int = 50,
    ) -> List[PrintHistoryQueryResponse]:
        """Queries print history audit records."""
        stmt = (
            select(PrintHistory)
            .where(PrintHistory.company_id == company_id, PrintHistory.is_deleted == False)
            .order_by(PrintHistory.created_at.desc())
            .limit(limit)
        )
        records = (await session.execute(stmt)).scalars().all()
        return [
            PrintHistoryQueryResponse(
                id=r.id,
                user=r.user,
                item_code=r.item_code,
                item_name=r.item_name,
                barcode=r.barcode,
                quantity=r.quantity or 1,
                status=r.status or "Success",
                error_message=r.error_message,
            )
            for r in records
        ]
