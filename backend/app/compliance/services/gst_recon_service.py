"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.42.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import logging
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.compliance.models.reconciliation import GSTReconciliationRecord

logger = logging.getLogger("smriti.gst_recon_service")


class GSTReconciliationService:
    """
    Service for automated ITC reconciliation between Purchase Register entries and GSTR-2B data.
    """

    async def reconcile_gstr2b(
        self,
        db: AsyncSession,
        gstin: str,
        financial_period: str,
        purchase_invoices: List[Dict[str, Any]],
        gstr2b_invoices: List[Dict[str, Any]],
    ) -> List[GSTReconciliationRecord]:
        """
        Compares purchase invoices against GSTR-2B statement rows and generates reconciliation records.
        """
        # Create map of GSTR-2B invoices by (supplier_gstin, invoice_number)
        gstr2b_map = {
            (item["supplier_gstin"], item["invoice_number"].upper()): item
            for item in gstr2b_invoices
        }

        reconciled_records = []
        matched_gstr_keys = set()

        for inv in purchase_invoices:
            supp_gstin = inv["supplier_gstin"]
            inv_no = inv["invoice_number"].upper()
            key = (supp_gstin, inv_no)

            p_val = Decimal(str(inv.get("taxable_value", "0.00")))
            p_tax = Decimal(str(inv.get("tax_amount", "0.00")))

            if key in gstr2b_map:
                matched_gstr_keys.add(key)
                g2b = gstr2b_map[key]
                g_val = Decimal(str(g2b.get("taxable_value", "0.00")))
                g_tax = Decimal(str(g2b.get("tax_amount", "0.00")))

                var_amount = abs(p_tax - g_tax)
                if var_amount == Decimal("0.00"):
                    status = "MATCHED"
                    remarks = "Exact match between Purchase Register and GSTR-2B."
                else:
                    status = "MISMATCHED_AMOUNT"
                    remarks = f"Tax variance of ₹{var_amount:.2f} detected."

                rec = GSTReconciliationRecord(
                    id=str(uuid.uuid4()),
                    gstin=gstin,
                    financial_period=financial_period,
                    supplier_gstin=supp_gstin,
                    supplier_name=inv.get("supplier_name", "Supplier"),
                    invoice_number=inv_no,
                    invoice_date=inv.get("invoice_date", date.today()),
                    purchase_taxable_value=p_val,
                    purchase_tax_amount=p_tax,
                    gstr2b_taxable_value=g_val,
                    gstr2b_tax_amount=g_tax,
                    variance_amount=var_amount,
                    reconciliation_status=status,
                    remarks=remarks,
                )
            else:
                rec = GSTReconciliationRecord(
                    id=str(uuid.uuid4()),
                    gstin=gstin,
                    financial_period=financial_period,
                    supplier_gstin=supp_gstin,
                    supplier_name=inv.get("supplier_name", "Supplier"),
                    invoice_number=inv_no,
                    invoice_date=inv.get("invoice_date", date.today()),
                    purchase_taxable_value=p_val,
                    purchase_tax_amount=p_tax,
                    gstr2b_taxable_value=Decimal("0.00"),
                    gstr2b_tax_amount=Decimal("0.00"),
                    variance_amount=p_tax,
                    reconciliation_status="MISSING_IN_GSTR2B",
                    remarks="Invoice recorded in Purchase Register but missing in GSTR-2B.",
                )
            db.add(rec)
            reconciled_records.append(rec)

        # Process GSTR-2B invoices missing in Purchase Register
        for key, g2b in gstr2b_map.items():
            if key not in matched_gstr_keys:
                g_val = Decimal(str(g2b.get("taxable_value", "0.00")))
                g_tax = Decimal(str(g2b.get("tax_amount", "0.00")))
                rec = GSTReconciliationRecord(
                    id=str(uuid.uuid4()),
                    gstin=gstin,
                    financial_period=financial_period,
                    supplier_gstin=key[0],
                    supplier_name=g2b.get("supplier_name", "Supplier"),
                    invoice_number=key[1],
                    invoice_date=g2b.get("invoice_date", date.today()),
                    purchase_taxable_value=Decimal("0.00"),
                    purchase_tax_amount=Decimal("0.00"),
                    gstr2b_taxable_value=g_val,
                    gstr2b_tax_amount=g_tax,
                    variance_amount=g_tax,
                    reconciliation_status="MISSING_IN_PURCHASE",
                    remarks="Invoice present in GSTR-2B but unrecorded in Purchase Register.",
                )
                db.add(rec)
                reconciled_records.append(rec)

        await db.commit()
        return reconciled_records
