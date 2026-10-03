"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.42.0
Created      : 2026-09-19
Modified     : 2026-09-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.party import Party, VendorIdentityMigration
from ..models.purchase import Supplier
from ..models.vendor_product_assignment import VendorProductAssignment
from ..schemas.vendor_product_assignment import (
    VendorProductAssignmentCreate,
    VendorProductAssignmentOut,
    VendorProductAssignmentUpdate,
)


# Precedence map: lower number = more specific = wins (Execution Command Rule 13)
_LEVEL_PRECEDENCE: Dict[str, int] = {
    "BARCODE": 1,
    "SKU": 2,
    "MODEL": 3,
    "ARTICLE": 4,
    "STYLE": 5,
    "BRAND": 6,
    "CATEGORY": 7,
}


class VendorProductAssignmentService:
    """
    Manages multi-level, multi-vendor product assignments.

    Architecture principles enforced here:
    - Canonical vendor identity is parties.id (SUPPLIER role). Legacy suppliers.id
      is accepted as input and resolved via VendorIdentityMigration bridge.
    - items.vendor_code / products.vendor_code are NOT touched — those are factory
      item codes, not SMRITI vendor relationships (Execution Command Rule 3).
    - Unique constraint: one ACTIVE assignment per (company, vendor, level, target).
      Multiple INACTIVE/historical records are allowed.
    """

    def __init__(self, db: AsyncSession, tenant: Any):
        self.db = db
        self.tenant = tenant

    @property
    def _company_id(self) -> Optional[str]:
        return getattr(self.tenant, "company_id", None)

    @property
    def _branch_id(self) -> Optional[str]:
        return getattr(self.tenant, "branch_id", None)

    # ─────────────────────────────────────────────────────────────────────────
    # Vendor Resolution (Canonical Rule 2)
    # ─────────────────────────────────────────────────────────────────────────

    async def resolve_vendor_party_id(self, vendor_id: str) -> str:
        """
        Resolve any vendor identifier to a canonical parties.id.
        Accepts:
          - parties.id directly (pty_* prefix)
          - party_code (e.g. "VND-001")
          - legacy suppliers.id (via VendorIdentityMigration)
          - legacy supplier code
        """
        if not vendor_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vendor identifier is required.",
            )

        # 1. Direct party lookup
        stmt = select(Party).where(
            or_(Party.id == vendor_id, Party.party_code == vendor_id),
            Party.is_deleted == False,
        )
        party = (await self.db.execute(stmt)).scalars().first()
        if party:
            return party.id

        # 2. Migration bridge: legacy supplier ID → party ID
        mig_stmt = select(VendorIdentityMigration).where(
            VendorIdentityMigration.legacy_supplier_id == vendor_id
        )
        mig = (await self.db.execute(mig_stmt)).scalars().first()
        if mig:
            return mig.party_id

        # 3. Legacy suppliers table — resolve to party via bridge
        sup_stmt = select(Supplier).where(
            or_(Supplier.id == vendor_id, Supplier.code == vendor_id),
            Supplier.is_deleted == False,
        )
        sup = (await self.db.execute(sup_stmt)).scalars().first()
        if sup:
            mig_stmt2 = select(VendorIdentityMigration).where(
                VendorIdentityMigration.legacy_supplier_id == sup.id
            )
            mig2 = (await self.db.execute(mig_stmt2)).scalars().first()
            if mig2:
                return mig2.party_id
            # Supplier exists but has no migration record
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Vendor '{vendor_id}' was found in the legacy supplier register but has not "
                    "been migrated to the Vendor 360 canonical master. "
                    "Please complete the vendor migration before creating assignments."
                ),
            )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor '{vendor_id}' was not found. Please verify the vendor and try again.",
        )

    # ─────────────────────────────────────────────────────────────────────────
    # CRUD
    # ─────────────────────────────────────────────────────────────────────────

    async def create_assignment(
        self, req: VendorProductAssignmentCreate
    ) -> VendorProductAssignmentOut:
        """
        Create a new vendor-product assignment.

        Validates:
        - Vendor resolves to a canonical Party
        - No duplicate ACTIVE assignment for same vendor+level+target in this company
        - effective_to >= effective_from
        """
        vendor_party_id = await self.resolve_vendor_party_id(req.vendor_party_id)

        # Effective-date guard
        if req.effective_to and req.effective_from and req.effective_to < req.effective_from:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The assignment end date must be on or after the start date.",
            )

        # Duplicate check — one ACTIVE assignment per vendor+level+target per company
        dup_stmt = select(VendorProductAssignment).where(
            VendorProductAssignment.company_id == self._company_id,
            VendorProductAssignment.vendor_party_id == vendor_party_id,
            VendorProductAssignment.assignment_level == req.assignment_level,
            VendorProductAssignment.assignment_target_id == req.assignment_target_id,
            VendorProductAssignment.is_active == True,
            VendorProductAssignment.is_deleted == False,
            VendorProductAssignment.status == "ACTIVE",
        )
        existing = (await self.db.execute(dup_stmt)).scalars().first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"An active assignment already exists for this vendor at "
                    f"{req.assignment_level} level for '{req.assignment_target_code}'. "
                    "Please deactivate the existing assignment before creating a new one."
                ),
            )

        # Resolve legacy_supplier_id bridge
        legacy_sup_id = req.legacy_supplier_id
        if not legacy_sup_id:
            from ..models.party import VendorIdentityMigration as VM
            mig = (await self.db.execute(
                select(VM).where(VM.party_id == vendor_party_id)
            )).scalars().first()
            if mig:
                legacy_sup_id = mig.legacy_supplier_id

        rec_id = f"vpa-{uuid.uuid4().hex[:12]}"
        assignment = VendorProductAssignment(
            id=rec_id,
            company_id=self._company_id,
            branch_id=self._branch_id,
            vendor_party_id=vendor_party_id,
            legacy_supplier_id=legacy_sup_id,
            assignment_level=req.assignment_level,
            assignment_target_id=req.assignment_target_id,
            assignment_target_code=req.assignment_target_code,
            assignment_target_name=req.assignment_target_name,
            vendor_priority=req.vendor_priority,
            status=req.status,
            allow_purchase=req.allow_purchase,
            allow_po=req.allow_po,
            allow_grn=req.allow_grn,
            approval_required=req.approval_required,
            effective_from=req.effective_from,
            effective_to=req.effective_to,
            remarks=req.remarks,
            created_by=getattr(self.tenant, "user_id", None),
        )
        self.db.add(assignment)
        try:
            await self.db.commit()
            await self.db.refresh(assignment)
        except Exception:
            await self.db.rollback()
            raise
        return VendorProductAssignmentOut.model_validate(assignment)

    async def update_assignment(
        self, assignment_id: str, req: VendorProductAssignmentUpdate
    ) -> VendorProductAssignmentOut:
        assignment = await self._get_or_404(assignment_id)
        if req.vendor_priority is not None:
            assignment.vendor_priority = req.vendor_priority
        if req.status is not None:
            assignment.status = req.status
        if req.allow_purchase is not None:
            assignment.allow_purchase = req.allow_purchase
        if req.allow_po is not None:
            assignment.allow_po = req.allow_po
        if req.allow_grn is not None:
            assignment.allow_grn = req.allow_grn
        if req.approval_required is not None:
            assignment.approval_required = req.approval_required
        if req.effective_from is not None:
            assignment.effective_from = req.effective_from
        if req.effective_to is not None:
            assignment.effective_to = req.effective_to
        if req.remarks is not None:
            assignment.remarks = req.remarks
        assignment.modified_at = datetime.now(timezone.utc)
        assignment.modified_by = getattr(self.tenant, "user_id", None)
        await self.db.commit()
        await self.db.refresh(assignment)
        return VendorProductAssignmentOut.model_validate(assignment)

    async def soft_delete_assignment(self, assignment_id: str) -> Dict[str, str]:
        assignment = await self._get_or_404(assignment_id)
        assignment.is_deleted = True
        assignment.is_active = False
        assignment.deleted_at = datetime.now(timezone.utc)
        assignment.deleted_by = getattr(self.tenant, "user_id", None)
        await self.db.commit()
        return {"status": "deleted", "id": assignment_id}

    async def get_assignment(self, assignment_id: str) -> VendorProductAssignmentOut:
        return VendorProductAssignmentOut.model_validate(
            await self._get_or_404(assignment_id)
        )

    async def list_assignments_for_vendor(
        self,
        vendor_id: str,
        level: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[VendorProductAssignmentOut], int]:
        """Return all assignments for a vendor, optionally filtered by level and status."""
        party_id = await self.resolve_vendor_party_id(vendor_id)
        stmt = select(VendorProductAssignment).where(
            VendorProductAssignment.company_id == self._company_id,
            VendorProductAssignment.vendor_party_id == party_id,
            VendorProductAssignment.is_deleted == False,
        )
        if level:
            stmt = stmt.where(VendorProductAssignment.assignment_level == level.upper())
        if status_filter:
            stmt = stmt.where(VendorProductAssignment.status == status_filter.upper())

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(
            VendorProductAssignment.assignment_level,
            VendorProductAssignment.assignment_target_code,
        ).limit(limit).offset(offset)
        rows = (await self.db.execute(stmt)).scalars().all()
        return [VendorProductAssignmentOut.model_validate(r) for r in rows], total

    async def list_assignments_for_product(
        self,
        target_code: Optional[str] = None,
        target_id: Optional[str] = None,
        level: Optional[str] = None,
    ) -> List[VendorProductAssignmentOut]:
        """Return all vendor assignments for a product target."""
        stmt = select(VendorProductAssignment).where(
            VendorProductAssignment.company_id == self._company_id,
            VendorProductAssignment.is_deleted == False,
            VendorProductAssignment.is_active == True,
        )
        if target_id:
            stmt = stmt.where(VendorProductAssignment.assignment_target_id == target_id)
        elif target_code:
            stmt = stmt.where(
                VendorProductAssignment.assignment_target_code.ilike(f"%{target_code}%")
            )
        if level:
            stmt = stmt.where(VendorProductAssignment.assignment_level == level.upper())
        rows = (await self.db.execute(stmt)).scalars().all()
        return [VendorProductAssignmentOut.model_validate(r) for r in rows]

    # ─────────────────────────────────────────────────────────────────────────
    # Core Resolution: find_effective_assignment (used by POProductPolicyEngine)
    # ─────────────────────────────────────────────────────────────────────────

    async def find_effective_assignments(
        self,
        company_id: str,
        target_candidates: List[Tuple[str, str]],  # List of (level, target_id_or_code)
        transaction_date: date,
        vendor_party_id: Optional[str] = None,
    ) -> List[VendorProductAssignment]:
        """
        Find all active, effective assignments for any of the given target candidates.
        Returns all rows — the caller (POProductPolicyEngine) applies level precedence.

        Args:
            company_id: Tenant scope.
            target_candidates: [(level, target_id), ...] in any order — caller provides all
                levels from Barcode down to Category for the product being evaluated.
            transaction_date: The PO date — used for effective_from/effective_to check.
            vendor_party_id: If provided, filter to only this vendor's assignments.
        """
        if not target_candidates:
            return []

        # Build OR conditions for all (level, target) pairs
        or_conditions = [
            and_(
                VendorProductAssignment.assignment_level == level,
                or_(
                    VendorProductAssignment.assignment_target_id == target,
                    VendorProductAssignment.assignment_target_code == target,
                ),
            )
            for level, target in target_candidates
        ]

        stmt = select(VendorProductAssignment).where(
            VendorProductAssignment.company_id == company_id,
            VendorProductAssignment.is_deleted == False,
            VendorProductAssignment.is_active == True,
            # Effective date window
            or_(
                VendorProductAssignment.effective_from.is_(None),
                VendorProductAssignment.effective_from <= transaction_date,
            ),
            or_(
                VendorProductAssignment.effective_to.is_(None),
                VendorProductAssignment.effective_to >= transaction_date,
            ),
            or_(*or_conditions),
        )
        if vendor_party_id:
            stmt = stmt.where(
                VendorProductAssignment.vendor_party_id == vendor_party_id
            )

        rows = (await self.db.execute(stmt)).scalars().all()
        return list(rows)

    @staticmethod
    def select_most_specific(
        assignments: List[VendorProductAssignment],
    ) -> Optional[VendorProductAssignment]:
        """
        From a list of candidate assignments, return the most specific one
        using the SMRITI level precedence (BARCODE > SKU > MODEL > ARTICLE > STYLE > BRAND > CATEGORY).

        If two assignments share the same level, PRIMARY priority wins.
        """
        if not assignments:
            return None
        return min(
            assignments,
            key=lambda a: (
                _LEVEL_PRECEDENCE.get(a.assignment_level, 99),
                {"PRIMARY": 0, "PREFERRED": 1, "SECONDARY": 2}.get(a.vendor_priority, 9),
            ),
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    async def _get_or_404(self, assignment_id: str) -> VendorProductAssignment:
        stmt = select(VendorProductAssignment).where(
            VendorProductAssignment.id == assignment_id,
            VendorProductAssignment.company_id == self._company_id,
            VendorProductAssignment.is_deleted == False,
        )
        row = (await self.db.execute(stmt)).scalars().first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vendor product assignment '{assignment_id}' was not found.",
            )
        return row
