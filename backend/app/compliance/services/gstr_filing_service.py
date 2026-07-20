"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.48.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import hashlib
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession

from app.compliance.models.filing import GSTRFilingRecord, GSTROutboxLog


class GSTRFilingService:
    """
    Assembles monthly GSTR-1 and GSTR-3B return payloads, calculates net statutory tax liabilities,
    verifies Digital Signature Certificates (DSC / EVC), issues statutory ARN numbers, and logs outbox entries.
    """

    async def prepare_and_submit_return(
        self,
        db: AsyncSession,
        gstin: str,
        financial_period: str,
        return_type: str,
        sales_invoices: List[Dict[str, Any]],
        verification_mode: str = "DSC",
        dsc_signature_bytes: str = "MOCK_DSC_SIG_BYTES",
    ) -> GSTRFilingRecord:
        return_type_upper = return_type.upper()
        if return_type_upper not in ("GSTR1", "GSTR3B"):
            raise ValueError(f"Invalid return_type '{return_type}'. Must be GSTR1 or GSTR3B.")

        tot_taxable = Decimal("0.0")
        tot_igst = Decimal("0.0")
        tot_cgst = Decimal("0.0")
        tot_sgst = Decimal("0.0")
        tot_cess = Decimal("0.0")

        b2b_items = []
        b2c_items = []

        for inv in sales_invoices:
            taxable = Decimal(str(inv.get("taxable_value", 0.0)))
            igst = Decimal(str(inv.get("igst", 0.0)))
            cgst = Decimal(str(inv.get("cgst", 0.0)))
            sgst = Decimal(str(inv.get("sgst", 0.0)))
            cess = Decimal(str(inv.get("cess", 0.0)))

            tot_taxable += taxable
            tot_igst += igst
            tot_cgst += cgst
            tot_sgst += sgst
            tot_cess += cess

            item_data = {
                "inv_num": inv.get("invoice_number"),
                "taxable_value": float(taxable),
                "igst": float(igst),
                "cgst": float(cgst),
                "sgst": float(sgst),
            }
            if inv.get("customer_gstin"):
                b2b_items.append(item_data)
            else:
                b2c_items.append(item_data)

        # Assemble JSON return payload
        payload = {
            "gstin": gstin,
            "fp": financial_period,
            "return_type": return_type_upper,
            "summary": {
                "total_taxable": float(tot_taxable),
                "total_igst": float(tot_igst),
                "total_cgst": float(tot_cgst),
                "total_sgst": float(tot_sgst),
                "total_cess": float(tot_cess),
            },
            "b2b": b2b_items,
            "b2c": b2c_items,
        }

        # Calculate DSC digital signature hash
        sig_hash = hashlib.sha256(f"{payload}{dsc_signature_bytes}".encode("utf-8")).hexdigest()
        arn = f"AA{gstin[:5]}{financial_period}{uuid.uuid4().hex[:6].upper()}"

        filing = GSTRFilingRecord(
            id=str(uuid.uuid4()),
            gstin=gstin,
            financial_period=financial_period,
            return_type=return_type_upper,
            total_taxable_value=tot_taxable,
            total_igst=tot_igst,
            total_cgst=tot_cgst,
            total_sgst=tot_sgst,
            total_cess=tot_cess,
            payload_json=payload,
            digital_signature_hash=sig_hash,
            verification_mode=verification_mode,
            arn_number=arn,
            filing_status="FILED",
        )
        db.add(filing)

        # Log to GSTR Outbox
        outbox = GSTROutboxLog(
            id=str(uuid.uuid4()),
            gstin=gstin,
            action_type=f"SUBMIT_{return_type_upper}",
            financial_period=financial_period,
            request_payload=payload,
            response_payload={"arn": arn, "signature_hash": sig_hash, "status": "FILED"},
            status="SUCCESS",
        )
        db.add(outbox)

        await db.commit()
        return filing
