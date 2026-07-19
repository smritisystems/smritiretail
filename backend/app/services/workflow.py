"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

WorkflowService -- Generic document state machine for SMRITI Retail OS.

Standard lifecycle:  Draft -> Submitted -> Approved -> Posted -> Cancelled | Closed

Document-specific transition rules override defaults via WORKFLOW_RULES.
All modules must call WorkflowService.transition() to change document status.
No module sets document status directly.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.platform import DocumentWorkflow


# ---------------------------------------------------------------------------
# Transition rules per document type.
# Key: (from_status, to_status) -> allowed (True/False) or list of roles allowed.
# None means ALL transitions from/to this status follow default rules.
# ---------------------------------------------------------------------------

ALLOWED_TRANSITIONS: dict[str, dict[tuple[str, str], bool | list[str]]] = {
    # Default rules apply to all document types unless overridden below
    "__default__": {
        ("Draft",     "Submitted"):  True,
        ("Draft",     "Cancelled"):  True,
        ("Submitted", "Approved"):   True,
        ("Submitted", "Draft"):      True,   # send back for revision
        ("Submitted", "Cancelled"):  True,
        ("Approved",  "Posted"):     True,
        ("Approved",  "Cancelled"):  True,
        ("Posted",    "Closed"):     True,
        ("Posted",    "Cancelled"):  False,  # cannot cancel a posted doc directly
    },
    "SalesInvoice": {
        ("Draft",     "Posted"):     True,   # shortcut: skip Submitted/Approved for POS
        ("Draft",     "Cancelled"):  True,
        ("Posted",    "Closed"):     True,
        ("Posted",    "Cancelled"):  False,
    },
    "ConsignmentTransfer": {
        ("Draft",     "Dispatched"): True,
        ("Dispatched","PartialReturn"): True,
        ("Dispatched","Settled"):    True,
        ("Dispatched","Closed"):     True,
        ("PartialReturn","Closed"):  True,
    },
    "ConsignmentSaleReport": {
        ("Draft",     "Submitted"):  True,
        ("Submitted", "Processed"):  True,
        ("Submitted", "Rejected"):   True,
        ("Processed", "Settled"):    True,
    },
    "ConsignmentSettlement": {
        ("Draft",     "Agreed"):     True,
        ("Agreed",    "Paid"):       True,
        ("Agreed",    "Disputed"):   True,
        ("Disputed",  "Agreed"):     True,
        ("Paid",      "Closed"):     True,
    },
}


class WorkflowService:
    """
    Centralized document workflow manager.

    Methods:
        transition()            -- move a document to a new status
        get_current_status()    -- read current status without locking
        get_allowed_next()      -- list valid next states for UI rendering
        get_history()           -- full transition audit trail
        ensure_status()         -- assert document is in expected status (guard)
    """

    def _get_rules(self, document_type: str) -> dict:
        """Merge document-specific rules over defaults."""
        rules = dict(ALLOWED_TRANSITIONS["__default__"])
        if document_type in ALLOWED_TRANSITIONS:
            rules.update(ALLOWED_TRANSITIONS[document_type])
        return rules

    def _is_allowed(self, document_type: str, from_status: str, to_status: str) -> bool:
        rules = self._get_rules(document_type)
        key = (from_status, to_status)
        return bool(rules.get(key, False))

    async def transition(
        self,
        document_type: str,
        document_id: str,
        to_status: str,
        session: AsyncSession,
        *,
        user: str = "system",
        remarks: Optional[str] = None,
        document_number: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> DocumentWorkflow:
        """
        Transition a document to a new status.

        Raises:
            ValueError: If the transition is not permitted.
            ValueError: If document is already in the target status.
        """
        result = await session.execute(
            select(DocumentWorkflow)
            .where(
                DocumentWorkflow.document_type == document_type,
                DocumentWorkflow.document_id == document_id,
            )
            .with_for_update()
        )
        workflow = result.scalar_one_or_none()

        if workflow is None:
            # First transition: auto-create workflow record
            if to_status != "Draft" and not self._is_allowed(document_type, "Draft", to_status):
                raise ValueError(
                    f"Cannot initialise {document_type} directly to status '{to_status}'."
                )
            workflow = DocumentWorkflow(
                id=f"WF-{document_type[:6]}-{document_id}",
                document_type=document_type,
                document_id=document_id,
                document_number=document_number,
                current_status=to_status,
                status_history=[{
                    "from": None,
                    "to": to_status,
                    "user": user,
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "remarks": remarks,
                }],
                company_id=company_id,
                branch_id=branch_id,
            )
            session.add(workflow)
            await session.flush()
            return workflow

        from_status = workflow.current_status
        if from_status == to_status:
            raise ValueError(
                f"{document_type} is already in status '{to_status}'."
            )

        if not self._is_allowed(document_type, from_status, to_status):
            raise ValueError(
                f"Transition '{from_status}' → '{to_status}' is not permitted "
                f"for {document_type}."
            )

        # Append to history
        history = list(workflow.status_history or [])
        history.append({
            "from": from_status,
            "to": to_status,
            "user": user,
            "ts": datetime.now(timezone.utc).isoformat(),
            "remarks": remarks,
        })

        workflow.current_status = to_status
        workflow.status_history = history
        workflow.modified_at = datetime.now(timezone.utc)
        await session.flush()
        return workflow

    async def get_current_status(
        self, document_type: str, document_id: str, session: AsyncSession
    ) -> Optional[str]:
        result = await session.execute(
            select(DocumentWorkflow.current_status).where(
                DocumentWorkflow.document_type == document_type,
                DocumentWorkflow.document_id == document_id,
            )
        )
        row = result.scalar_one_or_none()
        return row

    def get_allowed_next(self, document_type: str, current_status: str) -> list[str]:
        """Return list of valid next statuses for UI button rendering."""
        rules = self._get_rules(document_type)
        return [
            to for (frm, to), allowed in rules.items()
            if frm == current_status and allowed
        ]

    async def get_history(
        self, document_type: str, document_id: str, session: AsyncSession
    ) -> list[dict]:
        result = await session.execute(
            select(DocumentWorkflow.status_history).where(
                DocumentWorkflow.document_type == document_type,
                DocumentWorkflow.document_id == document_id,
            )
        )
        row = result.scalar_one_or_none()
        return row or []

    async def ensure_status(
        self,
        document_type: str,
        document_id: str,
        expected_status: str | list[str],
        session: AsyncSession,
        *,
        error_code: str = "SMRITI-WF-001",
    ) -> None:
        """
        Guard: raise if document is not in expected_status.
        Use as idempotency guard before any mutating operation.
        """
        current = await self.get_current_status(document_type, document_id, session)
        allowed = [expected_status] if isinstance(expected_status, str) else expected_status
        if current not in allowed:
            raise ValueError(
                f"[{error_code}] {document_type} '{document_id}' must be in status "
                f"{allowed} to perform this operation. Current status: '{current}'."
            )


# Module-level singleton
workflow_service = WorkflowService()
