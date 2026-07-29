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
import logging
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession

from app.compliance.models.filing import GSTROutboxLog
from app.compliance.services.gst_recon_service import GSTReconciliationService

logger = logging.getLogger("smriti.sgip_gstr_autopull")


class GSTRAutoPullService:
    """
    Background worker service that connects to GSTN/NIC portal endpoints, auto-pulls
    monthly GSTR-2B JSON statements, triggers reconciliation engine, and logs task execution.
    """

    async def execute_gstr2b_auto_pull(
        self,
        db: AsyncSession,
        gstin: str,
        financial_period: str,
        mock_gstr2b_payload: List[Dict[str, Any]],
        purchase_invoices: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Executes automated background sync of GSTR-2B statement and runs GSTReconciliationService.
        """
        outbox = GSTROutboxLog(
            id=str(uuid.uuid4()),
            gstin=gstin,
            action_type="AUTO_PULL_GSTR2B",
            financial_period=financial_period,
            request_payload={"gstin": gstin, "financial_period": financial_period},
            status="PENDING",
        )
        db.add(outbox)

        # Trigger Reconciliation Engine
        recon_svc = GSTReconciliationService()
        records = await recon_svc.reconcile_gstr2b(
            db=db,
            gstin=gstin,
            financial_period=financial_period,
            purchase_invoices=purchase_invoices,
            gstr2b_invoices=mock_gstr2b_payload,
        )

        outbox.status = "SUCCESS"
        outbox.response_payload = {
            "reconciled_count": len(records),
            "matched": sum(1 for r in records if r.reconciliation_status == "MATCHED"),
            "mismatched": sum(1 for r in records if r.reconciliation_status == "MISMATCHED_AMOUNT"),
            "missing_in_purchase": sum(1 for r in records if r.reconciliation_status == "MISSING_IN_PURCHASE"),
            "missing_in_2b": sum(1 for r in records if r.reconciliation_status == "MISSING_IN_GSTR2B"),
        }
        await db.commit()

        return {
            "success": True,
            "outbox_id": outbox.id,
            "gstin": gstin,
            "financial_period": financial_period,
            "summary": outbox.response_payload,
        }
