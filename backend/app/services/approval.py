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

ApprovalService -- Stub for v3.27.0. Full implementation in v3.29.x.

Architecture:
  v3.27.0: All approval checks pass (returns True). Interface is stable.
  v3.29.x: Role-based + amount-threshold-based approval rules engine.

Every module that needs approval MUST call approval_service.check() even now.
When real rules are added in v3.29.x, zero module code changes required.
"""

import logging
from decimal import Decimal
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("smriti.approval")


class ApprovalService:
    """
    Document approval service.

    v3.27.0: STUB -- all requests auto-approved. Logs intent.
    v3.29.x: Full rule engine -- role-based, amount-threshold-based, multi-level.

    Approval rules (v3.29.x):
        If document amount <= threshold[role]: auto-approved
        Else: requires explicit approval from higher role
        Multi-level: Manager -> GM -> Director for escalating thresholds
    """

    _thresholds = {
        "STAFF": Decimal("10000.00"),
        "MANAGER": Decimal("50000.00"),
        "GM": Decimal("200000.00"),
        "DIRECTOR": Decimal("1000000.00"),
    }

    async def check(
        self,
        document_type: str,
        document_id: str,
        amount: Decimal,
        requesting_user: str,
        requesting_role: str,
        session: AsyncSession,
        *,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> dict:
        """
        Check if a document requires approval.

        Returns:
            {
                "approved": bool,
                "requires_approval_from": str | None,
                "approval_level": int,
                "auto_approved": bool,
                "message": str,
            }

        Approval is required when the amount exceeds the threshold for the requesting role.
        """
        normalized_role = (requesting_role or "STAFF").upper()
        amount_value = Decimal(str(amount))

        logger.info(
            "ApprovalService | DocType=%s DocID=%s Amount=%.2f User=%s Role=%s",
            document_type, document_id, amount_value, requesting_user, normalized_role,
        )

        threshold = self._thresholds.get(normalized_role)
        if threshold is None:
            threshold = self._thresholds["STAFF"]

        if amount_value <= threshold:
            return {
                "approved": True,
                "requires_approval_from": None,
                "approval_level": 0,
                "auto_approved": True,
                "message": f"Auto-approved below {threshold:,.2f} threshold for {normalized_role}.",
            }

        next_role = None
        if normalized_role == "STAFF":
            next_role = "MANAGER"
        elif normalized_role == "MANAGER":
            next_role = "GM"
        elif normalized_role == "GM":
            next_role = "DIRECTOR"

        return {
            "approved": False,
            "requires_approval_from": next_role,
            "approval_level": 1,
            "auto_approved": False,
            "message": f"Amount exceeds {threshold:,.2f} threshold for {normalized_role}; approval required from {next_role}.",
        }

    async def approve(
        self,
        document_type: str,
        document_id: str,
        approving_user: str,
        session: AsyncSession,
        *,
        remarks: Optional[str] = None,
    ) -> None:
        """Explicitly approve a pending document. Stub -- no-op in v3.27.0."""
        logger.info(
            "ApprovalService [STUB] Approved | DocType=%s DocID=%s ApprovedBy=%s",
            document_type, document_id, approving_user,
        )

    async def reject(
        self,
        document_type: str,
        document_id: str,
        rejecting_user: str,
        session: AsyncSession,
        *,
        remarks: Optional[str] = None,
    ) -> None:
        """Reject a pending document. Stub -- no-op in v3.27.0."""
        logger.info(
            "ApprovalService [STUB] Rejected | DocType=%s DocID=%s RejectedBy=%s",
            document_type, document_id, rejecting_user,
        )


# Module-level singleton
approval_service = ApprovalService()
