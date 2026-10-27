"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.1
Created      : 2026-10-13
Modified     : 2026-10-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Central Price Revision Service (Phase 3)
"""

import uuid
import logging
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, and_, or_, func, update, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.pricing import ItemPriceRevision, PriceBook, PriceBookEntry
from ..models.item_master import Item, ItemVariant, ItemBarcode, ItemPrice
from ..models.inventory import Product
from ..services.approval_engine import ApprovalEngine
from ..schemas.pricing import (
    PriceRevisionCreateRequest,
    PriceRevisionResponse,
    PriceRevisionApprovalDecision,
    PriceRevisionBulkRequest,
    PriceRevisionBulkResponse,
    BulkItemFilterRequest,
    BulkItemCandidate,
    BulkItemFilterResponse,
)

logger = logging.getLogger("smriti.price_revision")


class PriceRevisionService:
    """
    Central Authoritative Price Revision Service (MRP, Selling Price, Cost Price).
    Coordinates temporal price revisions across Item UI, APIs, and bulk imports.
    Guarantees:
      - Statutory ceiling invariant (Selling Price <= MRP).
      - Effective date gating (future revisions never prematurely activate).
      - Zero destructive overwrites: preserves immutable audit trail and historical reconstruction.
      - Configurable approval matrix and supervisor overrides.
      - Baseline synchronization with ItemVariant & PriceBookEntry when active.
    """

    AUTHORIZED_APPROVER_ROLES = {
        "SYSADMIN",
        "DIRECTOR",
        "FINANCE_CONTROLLER",
        "STORE_MANAGER",
        "MANAGER",
    }

    # Threshold for requiring supervisor approval if not an authorized manager:
    # 1. Any price increase > 20%
    # 2. Any price decrease > 10%
    PRICE_CHANGE_INCREASE_THRESHOLD_PCT = Decimal("20.0")
    PRICE_CHANGE_DECREASE_THRESHOLD_PCT = Decimal("10.0")

    @classmethod
    async def get_approval_policy(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Resolves configurable approval policy from SystemParameterService (ADR-042).
        Falls back safely to class defaults if parameters are not configured.
        """
        increase_threshold = cls.PRICE_CHANGE_INCREASE_THRESHOLD_PCT
        decrease_threshold = cls.PRICE_CHANGE_DECREASE_THRESHOLD_PCT
        authorized_roles = set(cls.AUTHORIZED_APPROVER_ROLES)

        try:
            from .system_parameter import SystemParameterService
            # 1. Price increase threshold parameter
            param_inc = await SystemParameterService.resolve_parameter(
                db=session,
                param_code="SMRITI.PRICE.APPROVAL.THRESHOLD_INCREASE_PCT",
                company_id=company_id,
                branch_id=branch_id,
            )
            if param_inc and param_inc.param_val is not None:
                increase_threshold = Decimal(str(param_inc.param_val))

            # 2. Price decrease threshold parameter
            param_dec = await SystemParameterService.resolve_parameter(
                db=session,
                param_code="SMRITI.PRICE.APPROVAL.THRESHOLD_DECREASE_PCT",
                company_id=company_id,
                branch_id=branch_id,
            )
            if param_dec and param_dec.param_val is not None:
                decrease_threshold = Decimal(str(param_dec.param_val))

            # 3. Authorized approver roles parameter
            param_roles = await SystemParameterService.resolve_parameter(
                db=session,
                param_code="SMRITI.PRICE.APPROVAL.ROLES",
                company_id=company_id,
                branch_id=branch_id,
            )
            if param_roles and param_roles.param_val:
                roles_list = [r.strip().upper() for r in str(param_roles.param_val).split(",") if r.strip()]
                if roles_list:
                    authorized_roles = set(roles_list)
        except Exception as e:
            logger.warning(f"Failed to resolve price approval parameters for company {company_id}, using defaults: {e}")

        return {
            "increase_threshold_pct": increase_threshold,
            "decrease_threshold_pct": decrease_threshold,
            "authorized_roles": authorized_roles,
        }

    @classmethod
    async def create_revision(
        cls,
        session: AsyncSession,
        company_id: str,
        user_id: str,
        user_role: str,
        req: PriceRevisionCreateRequest,
        branch_id: Optional[str] = None,
        source: str = "MANUAL",
        batch_id: Optional[str] = None,
        commit: bool = True,
    ) -> ItemPriceRevision:
        """
        Creates a temporal price revision record with validation, approval gating,
        and atomic baseline synchronization.
        """
        # 1. Resolve ItemVariant and Item
        stmt_var = select(ItemVariant).where(
            ItemVariant.id == req.variant_id,
            ItemVariant.company_id == company_id,
        )
        variant = (await session.execute(stmt_var)).scalars().first()
        if not variant:
            raise ValueError(f"SMRITI-ITEM-001: ItemVariant '{req.variant_id}' not found for company '{company_id}'.")

        item_id = req.item_id or variant.item_id
        stmt_item = select(Item).where(
            Item.id == item_id,
            Item.company_id == company_id,
        )
        item = (await session.execute(stmt_item)).scalars().first()
        if not item:
            raise ValueError(f"SMRITI-ITEM-002: Item '{item_id}' not found for company '{company_id}'.")

        # 2. Statutory and commercial price validations
        rev_mrp = Decimal(str(req.revised_mrp)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        rev_sp = Decimal(str(req.revised_selling_price)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        rev_dp = (
            Decimal(str(req.revised_distributor_price)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if req.revised_distributor_price is not None
            else None
        )
        rev_cp = (
            Decimal(str(req.revised_cost_price)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if req.revised_cost_price is not None
            else None
        )

        if rev_mrp < Decimal("0.00"):
            raise ValueError("SMRITI-PRICE-003: Revised MRP cannot be negative.")
        if rev_sp < Decimal("0.00"):
            raise ValueError("SMRITI-PRICE-004: Revised Selling Price cannot be negative.")
        if rev_dp is not None:
            if rev_dp < Decimal("0.00"):
                raise ValueError("SMRITI-PRICE-010: Revised Distributor Price cannot be negative.")
            if rev_dp > rev_sp:
                raise ValueError(
                    f"SMRITI-PRICE-002: Distributor price (₹{rev_dp:,.2f}) cannot exceed retail selling price (₹{rev_sp:,.2f})."
                )
        if rev_cp is not None and rev_cp < Decimal("0.00"):
            raise ValueError("SMRITI-PRICE-005: Revised Cost Price cannot be negative.")
        if rev_sp > rev_mrp:
            item_display = getattr(item, "item_name", getattr(item, "name", "Item"))
            raise ValueError(
                f"SMRITI-PRICE-001: Selling price (₹{rev_sp:,.2f}) cannot exceed statutory MRP (₹{rev_mrp:,.2f}) for item '{item_display}'."
            )

        # 3. Temporal bounds validation
        now = datetime.now(timezone.utc)
        effective_from = req.effective_from or now
        if effective_from.tzinfo is None:
            effective_from = effective_from.replace(tzinfo=timezone.utc)

        effective_to = req.effective_to
        if effective_to is not None:
            if effective_to.tzinfo is None:
                effective_to = effective_to.replace(tzinfo=timezone.utc)
            if effective_to <= effective_from:
                raise ValueError("SMRITI-PRICE-006: 'effective_to' must be strictly after 'effective_from'.")

        # 4. Resolve baseline values
        prev_mrp = Decimal(str(variant.mrp or item.mrp or 0.00)).quantize(Decimal("0.01"))
        prev_sp = Decimal(str(variant.selling_price or item.selling_price or 0.00)).quantize(Decimal("0.01"))
        prev_cp = (
            Decimal(str(variant.cost_price or item.cost_price)).quantize(Decimal("0.01"))
            if (variant.cost_price or item.cost_price) is not None
            else None
        )

        stmt_ip_cur = select(ItemPrice).where(
            ItemPrice.company_id == company_id,
            ItemPrice.item_variant_id == variant.id,
        )
        ip_cur = (await session.execute(stmt_ip_cur)).scalars().first()
        prev_dp = (
            Decimal(str(ip_cur.wholesale_price)).quantize(Decimal("0.01"))
            if ip_cur and ip_cur.wholesale_price is not None
            else None
        )

        # 5. Overlapping period check
        # Check if there is an identical scheduled revision starting at the exact same time
        stmt_dup = select(ItemPriceRevision).where(
            ItemPriceRevision.company_id == company_id,
            ItemPriceRevision.variant_id == variant.id,
            ItemPriceRevision.effective_from == effective_from,
            ItemPriceRevision.status.in_(["PENDING_APPROVAL", "APPROVED", "SCHEDULED", "ACTIVE"]),
        )
        if req.price_book_id:
            stmt_dup = stmt_dup.where(ItemPriceRevision.price_book_id == req.price_book_id)
        else:
            stmt_dup = stmt_dup.where(ItemPriceRevision.price_book_id.is_(None))

        dup_rev = (await session.execute(stmt_dup)).scalars().first()
        if dup_rev:
            raise ValueError(
                f"SMRITI-PRICE-007: An active or scheduled revision (ID: {dup_rev.id}) already exists for this item at effective timestamp {effective_from.isoformat()}."
            )

        # 6. Approval matrix evaluation
        policy = await cls.get_approval_policy(session=session, company_id=company_id, branch_id=branch_id)
        inc_threshold = policy["increase_threshold_pct"]
        dec_threshold = policy["decrease_threshold_pct"]
        authorized_roles = policy["authorized_roles"]

        role_upper = (user_role or "CASHIER").upper()
        is_authorized_role = role_upper in authorized_roles

        # Calculate price delta percentage
        requires_approval = False
        approval_reason = "Standard revision within authorized thresholds."
        if prev_sp > Decimal("0.00"):
            delta_pct = ((rev_sp - prev_sp) / prev_sp) * Decimal("100.0")
            if delta_pct > inc_threshold and not is_authorized_role:
                requires_approval = True
                approval_reason = f"Selling price increase of {delta_pct:.1f}% exceeds authorized threshold ({inc_threshold}%)."
            elif delta_pct < -dec_threshold and not is_authorized_role:
                requires_approval = True
                approval_reason = f"Selling price decrease of {abs(delta_pct):.1f}% exceeds authorized discount threshold ({dec_threshold}%)."
        elif not is_authorized_role:
            requires_approval = True
            approval_reason = "First-time price assignment requires manager authorization."

        if not req.auto_approve_if_eligible:
            requires_approval = True
            approval_reason = "Manual approval requested by submitter."

        # Determine revision lifecycle state
        revision_id = f"ipr_{uuid.uuid4().hex[:12]}"
        audit_ref = f"AUD-PR-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        if requires_approval:
            status = "PENDING_APPROVAL"
            approved_by = None
            approved_at = None
        else:
            # Auto-approved or pre-authorized by manager
            approved_by = user_id
            approved_at = now
            if effective_from <= now:
                status = "ACTIVE"
            else:
                status = "SCHEDULED"

        # 7. Create ItemPriceRevision entity
        meta_dict = {}
        if rev_dp is not None or prev_dp is not None:
            meta_dict["previous_distributor_price"] = float(prev_dp) if prev_dp is not None else None
            meta_dict["revised_distributor_price"] = float(rev_dp) if rev_dp is not None else None

        revision = ItemPriceRevision(
            id=revision_id,
            company_id=company_id,
            branch_id=branch_id,
            item_id=item.id,
            variant_id=variant.id,
            price_book_id=req.price_book_id,
            currency="INR",
            previous_mrp=prev_mrp,
            revised_mrp=rev_mrp,
            previous_selling_price=prev_sp,
            revised_selling_price=rev_sp,
            previous_cost_price=prev_cp,
            revised_cost_price=rev_cp,
            # G1: Wholesale price revision audit trail (migration v1548)
            previous_wholesale_price=prev_dp,
            revised_wholesale_price=rev_dp,
            effective_from=effective_from,
            effective_to=effective_to,
            status=status,
            reason_code=req.reason_code,
            justification=req.justification or approval_reason,
            approval_required=requires_approval,
            approved_by=approved_by,
            approved_at=approved_at,
            source=source,
            batch_id=batch_id,
            audit_ref=audit_ref,
            metadata_json=meta_dict,
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(revision)

        # 8. If ACTIVE immediately, supersede prior active revisions & sync baseline
        if status == "ACTIVE":
            await cls._activate_revision_internal(
                session=session,
                company_id=company_id,
                revision=revision,
                acting_user=user_id,
            )

        if commit:
            await session.commit()
            await session.refresh(revision)
        else:
            await session.flush()

        logger.info(
            f"Price revision {revision.id} created for variant {variant.id} "
            f"(MRP: ₹{prev_mrp} -> ₹{rev_mrp}, SP: ₹{prev_sp} -> ₹{rev_sp}, Status: {status})"
        )
        return revision

    @classmethod
    async def _activate_revision_internal(
        cls,
        session: AsyncSession,
        company_id: str,
        revision: ItemPriceRevision,
        acting_user: str,
    ) -> None:
        """
        Internal helper: transitions an approved revision to ACTIVE.
        Supersedes prior active revisions at effective_from and synchronizes
        ItemVariant and default PriceBookEntry baselines.
        """
        # A. Supersede preceding active revisions for this variant and price book
        stmt_prev = select(ItemPriceRevision).where(
            ItemPriceRevision.company_id == company_id,
            ItemPriceRevision.variant_id == revision.variant_id,
            ItemPriceRevision.id != revision.id,
            ItemPriceRevision.status == "ACTIVE",
            ItemPriceRevision.effective_from <= revision.effective_from,
            or_(
                ItemPriceRevision.effective_to.is_(None),
                ItemPriceRevision.effective_to > revision.effective_from,
            ),
        )
        if revision.price_book_id:
            stmt_prev = stmt_prev.where(ItemPriceRevision.price_book_id == revision.price_book_id)
        else:
            stmt_prev = stmt_prev.where(ItemPriceRevision.price_book_id.is_(None))

        active_revisions = (await session.execute(stmt_prev)).scalars().all()
        for prev_rev in active_revisions:
            prev_rev.effective_to = revision.effective_from
            prev_rev.status = "SUPERSEDED"
            prev_rev.updated_by = acting_user

        # B. Synchronize active baseline cache in ItemVariant
        stmt_var = select(ItemVariant).where(ItemVariant.id == revision.variant_id)
        var_obj = (await session.execute(stmt_var)).scalars().first()
        if var_obj:
            var_obj.selling_price = float(revision.revised_selling_price)
            var_obj.mrp = float(revision.revised_mrp)
            if revision.revised_cost_price is not None:
                var_obj.cost_price = float(revision.revised_cost_price)
            var_obj.updated_by = acting_user

        # C. Synchronize default PriceBookEntry if this revision applies to default book
        if revision.price_book_id:
            target_pb_id = revision.price_book_id
        else:
            # Check default price book
            stmt_def_pb = select(PriceBook).where(
                PriceBook.company_id == company_id,
                PriceBook.is_default == True,
            )
            def_pb = (await session.execute(stmt_def_pb)).scalars().first()
            target_pb_id = def_pb.id if def_pb else None

        if target_pb_id:
            stmt_pbe = select(PriceBookEntry).where(
                PriceBookEntry.company_id == company_id,
                PriceBookEntry.price_book_id == target_pb_id,
                PriceBookEntry.variant_id == revision.variant_id,
                PriceBookEntry.min_quantity == Decimal("1.00"),
            )
            pbe = (await session.execute(stmt_pbe)).scalars().first()
            if pbe:
                pbe.selling_price = revision.revised_selling_price
                pbe.mrp = revision.revised_mrp
                if revision.revised_cost_price is not None:
                    pbe.cost_price = revision.revised_cost_price
                pbe.updated_by = acting_user

        # D. Synchronize authoritative ItemPrice record (mrp, selling_price, wholesale_price, cost_price)
        # G1: prefer the typed columns on the revision entity; fall back to metadata_json for
        # legacy revision records that pre-date v1548 and have NULL in the typed columns.
        rev_dp_entity = revision.revised_wholesale_price
        rev_dp_meta_raw = (revision.metadata_json or {}).get("revised_distributor_price")
        rev_dp = (
            rev_dp_entity
            if rev_dp_entity is not None
            else (Decimal(str(rev_dp_meta_raw)).quantize(Decimal("0.01")) if rev_dp_meta_raw is not None else None)
        )

        stmt_ip = select(ItemPrice).where(
            ItemPrice.company_id == company_id,
            ItemPrice.item_variant_id == revision.variant_id,
        )
        ip_obj = (await session.execute(stmt_ip)).scalars().first()
        if ip_obj:
            # G1: capture old wholesale before overwriting, stamp on revision entity
            if revision.previous_wholesale_price is None and ip_obj.wholesale_price is not None:
                revision.previous_wholesale_price = ip_obj.wholesale_price
            ip_obj.selling_price = revision.revised_selling_price
            ip_obj.mrp = revision.revised_mrp
            if revision.revised_cost_price is not None:
                ip_obj.cost_price = revision.revised_cost_price
            if rev_dp is not None:
                ip_obj.wholesale_price = rev_dp
                revision.revised_wholesale_price = rev_dp  # ensure entity is in sync
            ip_obj.modified_at = datetime.now(timezone.utc)
        else:
            cp_val = revision.revised_cost_price
            if cp_val is None and var_obj and var_obj.cost_price is not None:
                cp_val = Decimal(str(var_obj.cost_price))
            ip_obj = ItemPrice(
                item_variant_id=revision.variant_id,
                company_id=company_id,
                branch_id=revision.branch_id,
                cost_price=cp_val or Decimal("0.00"),
                selling_price=revision.revised_selling_price,
                mrp=revision.revised_mrp,
                wholesale_price=rev_dp,
                currency=revision.currency or "INR",
                is_active=True,
            )
            session.add(ip_obj)

    @classmethod
    async def approve_revision(
        cls,
        session: AsyncSession,
        company_id: str,
        revision_id: str,
        approver_id: str,
        approver_role: str,
        supervisor_pin: Optional[str] = None,
        commit: bool = True,
    ) -> ItemPriceRevision:
        """
        Approves a pending price revision. If effective timestamp has already passed,
        activates it immediately; otherwise marks it SCHEDULED.
        """
        stmt = select(ItemPriceRevision).where(
            ItemPriceRevision.id == revision_id,
            ItemPriceRevision.company_id == company_id,
        )
        rev = (await session.execute(stmt)).scalars().first()
        if not rev:
            raise ValueError(f"SMRITI-PRICE-008: Price revision '{revision_id}' not found.")

        if rev.status not in ("PENDING_APPROVAL", "DRAFT"):
            raise ValueError(f"SMRITI-PRICE-009: Revision '{revision_id}' is already in status '{rev.status}'.")

        policy = await cls.get_approval_policy(session=session, company_id=company_id, branch_id=rev.branch_id)
        role_upper = (approver_role or "").upper()
        if role_upper not in policy["authorized_roles"] and not supervisor_pin:
            raise ValueError(
                f"SMRITI-PERM-001: Role '{approver_role}' is not authorized to approve price revisions. Manager role or Supervisor PIN required."
            )

        # Segregation of duties: prevent non-admin submitter from self-approving
        if rev.created_by == approver_id and role_upper not in ("SYSADMIN", "DIRECTOR") and not supervisor_pin:
            raise ValueError(
                f"SMRITI-PERM-002: User '{approver_id}' cannot self-approve their own price revision. Separate manager approval or Supervisor PIN required."
            )


        now = datetime.now(timezone.utc)
        rev.approved_by = approver_id
        rev.approved_at = now

        if rev.effective_from <= now:
            rev.status = "ACTIVE"
            await cls._activate_revision_internal(
                session=session,
                company_id=company_id,
                revision=rev,
                acting_user=approver_id,
            )
        else:
            rev.status = "SCHEDULED"

        if commit:
            await session.commit()
            await session.refresh(rev)
        else:
            await session.flush()

        logger.info(f"Price revision {rev.id} approved by {approver_id} ({approver_role}) -> Status: {rev.status}")
        return rev

    @classmethod
    async def reject_revision(
        cls,
        session: AsyncSession,
        company_id: str,
        revision_id: str,
        rejecter_id: str,
        rejecter_role: str,
        rejection_reason: str,
        commit: bool = True,
    ) -> ItemPriceRevision:
        """
        Rejects a pending price revision with required business explanation.
        """
        stmt = select(ItemPriceRevision).where(
            ItemPriceRevision.id == revision_id,
            ItemPriceRevision.company_id == company_id,
        )
        rev = (await session.execute(stmt)).scalars().first()
        if not rev:
            raise ValueError(f"SMRITI-PRICE-008: Price revision '{revision_id}' not found.")

        if rev.status not in ("PENDING_APPROVAL", "DRAFT"):
            raise ValueError(f"SMRITI-PRICE-009: Revision '{revision_id}' cannot be rejected in status '{rev.status}'.")

        if not rejection_reason or not rejection_reason.strip():
            raise ValueError("SMRITI-VAL-004: Rejection reason is mandatory when rejecting a price revision.")

        rev.status = "REJECTED"
        rev.rejection_reason = rejection_reason.strip()
        rev.updated_by = rejecter_id

        if commit:
            await session.commit()
            await session.refresh(rev)
        else:
            await session.flush()

        logger.info(f"Price revision {rev.id} rejected by {rejecter_id} ({rejecter_role}): {rejection_reason}")
        return rev

    @classmethod
    async def resolve_effective_price(
        cls,
        session: AsyncSession,
        company_id: str,
        variant_id: str,
        price_book_id: Optional[str] = None,
        as_of_date: Optional[datetime] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Authoritatively resolves the effective price revision at a given point in time (as_of_date).
        Supports zero-drift historical reconstruction and prevents premature future revision leaks.
        """
        now = as_of_date or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        else:
            now = now.astimezone(timezone.utc)


        # Look up approved/active/superseded revisions covering the given as_of_date
        stmt = select(ItemPriceRevision).where(
            ItemPriceRevision.company_id == company_id,
            ItemPriceRevision.variant_id == variant_id,
            ItemPriceRevision.status.in_(["ACTIVE", "APPROVED", "SUPERSEDED", "SCHEDULED"]),
            ItemPriceRevision.effective_from <= now,
            or_(
                ItemPriceRevision.effective_to.is_(None),
                ItemPriceRevision.effective_to > now,
            ),
        )
        if price_book_id:
            stmt = stmt.where(
                or_(
                    ItemPriceRevision.price_book_id == price_book_id,
                    ItemPriceRevision.price_book_id.is_(None),
                )
            )

        stmt = stmt.order_by(ItemPriceRevision.effective_from.desc())
        rev = (await session.execute(stmt)).scalars().first()

        if not rev:
            return None

        return {
            "revision_id": rev.id,
            "variant_id": rev.variant_id,
            "item_id": rev.item_id,
            "price_book_id": rev.price_book_id,
            "mrp": Decimal(str(rev.revised_mrp)),
            "selling_price": Decimal(str(rev.revised_selling_price)),
            "cost_price": Decimal(str(rev.revised_cost_price)) if rev.revised_cost_price is not None else None,
            "effective_from": rev.effective_from,
            "effective_to": rev.effective_to,
            "status": rev.status,
            "reason_code": rev.reason_code,
            "pricing_source": "PRICE_REVISION_HISTORY",
        }

    @classmethod
    async def activate_scheduled_revisions(
        cls,
        session: AsyncSession,
        company_id: Optional[str] = None,
    ) -> int:
        """
        Cron or daemon task: transitions SCHEDULED revisions whose effective_from <= now()
        into ACTIVE status and synchronizes the baseline records.
        """
        now = datetime.now(timezone.utc)
        stmt = (
            select(ItemPriceRevision)
            .where(
                ItemPriceRevision.status == "SCHEDULED",
                ItemPriceRevision.effective_from <= now,
            )
            .with_for_update(skip_locked=True)
        )
        if company_id:
            stmt = stmt.where(ItemPriceRevision.company_id == company_id)

        scheduled = (await session.execute(stmt)).scalars().all()
        count = 0
        for rev in scheduled:
            rev.status = "ACTIVE"
            await cls._activate_revision_internal(
                session=session,
                company_id=rev.company_id,
                revision=rev,
                acting_user="system-scheduler",
            )
            count += 1

        if count > 0:
            await session.commit()
            logger.info(f"Activated {count} scheduled price revisions as of {now.isoformat()}.")
        return count

    @classmethod
    async def bulk_create_revisions(
        cls,
        session: AsyncSession,
        company_id: str,
        user_id: str,
        user_role: str,
        req: PriceRevisionBulkRequest,
        branch_id: Optional[str] = None,
    ) -> PriceRevisionBulkResponse:
        """
        Executes atomic bulk price revisions from Excel/CSV import sheets.
        Resolves items by Barcode, SKU, or Code, validates all business rules,
        and creates revisions with batch tracing.
        """
        batch_id = req.batch_id or f"BATCH-PR-{uuid.uuid4().hex[:8].upper()}"
        revisions: List[PriceRevisionResponse] = []
        errors: List[Dict[str, Any]] = []
        approved_count = 0
        pending_count = 0

        for idx, item_input in enumerate(req.items):
            row_num = idx + 1
            code_val = item_input.sku_or_barcode.strip()

            # Resolve variant by variant_sku or sku
            stmt_var = select(ItemVariant).where(
                ItemVariant.company_id == company_id,
                or_(ItemVariant.variant_sku == code_val, ItemVariant.sku == code_val),
            )
            variant = (await session.execute(stmt_var)).scalars().first()

            if not variant:
                # Try Barcode lookup
                stmt_bar = (
                    select(ItemBarcode)
                    .where(
                        ItemBarcode.company_id == company_id,
                        ItemBarcode.barcode == code_val,
                    )
                )
                bar = (await session.execute(stmt_bar)).scalars().first()
                if bar and bar.variant_id:
                    stmt_var_b = select(ItemVariant).where(ItemVariant.id == bar.variant_id)
                    variant = (await session.execute(stmt_var_b)).scalars().first()

            if not variant:
                # Try Item code match if single variant exists
                stmt_item = select(Item).where(
                    Item.company_id == company_id,
                    or_(Item.item_code == code_val, Item.item_name == code_val),
                )
                item_obj = (await session.execute(stmt_item)).scalars().first()
                if item_obj:
                    stmt_first_var = select(ItemVariant).where(ItemVariant.item_id == item_obj.id)
                    variant = (await session.execute(stmt_first_var)).scalars().first()

            if not variant:
                errors.append({
                    "row": row_num,
                    "sku_or_barcode": code_val,
                    "error": f"Item or variant '{code_val}' not found in catalog.",
                })
                continue

            try:
                eff_mrp = item_input.revised_mrp if item_input.revised_mrp is not None else float(variant.mrp or 0.0)
                eff_sp = item_input.revised_selling_price if item_input.revised_selling_price is not None else float(variant.selling_price or 0.0)
                single_req = PriceRevisionCreateRequest(
                    variant_id=variant.id,
                    item_id=variant.item_id,
                    price_book_id=req.price_book_id,
                    revised_mrp=eff_mrp,
                    revised_selling_price=eff_sp,
                    revised_distributor_price=item_input.revised_distributor_price,
                    revised_cost_price=None,  # Permanently read-only in bulk revision workflow
                    effective_from=item_input.effective_from,
                    effective_to=item_input.effective_to,
                    reason_code=item_input.reason_code or "BULK_IMPORT",
                    justification=item_input.justification or f"Bulk import batch {batch_id}",
                    auto_approve_if_eligible=True,
                )
                rev = await cls.create_revision(
                    session=session,
                    company_id=company_id,
                    user_id=user_id,
                    user_role=user_role,
                    req=single_req,
                    branch_id=branch_id,
                    source="BULK_IMPORT",
                    batch_id=batch_id,
                    commit=False,
                )

                if rev.status in ("ACTIVE", "APPROVED", "SCHEDULED"):
                    approved_count += 1
                else:
                    pending_count += 1

                margin_pct = None
                if rev.revised_cost_price and rev.revised_selling_price > Decimal("0.00"):
                    margin_pct = float(
                        ((rev.revised_selling_price - rev.revised_cost_price) / rev.revised_selling_price)
                        * Decimal("100.00")
                    )

                meta_res = rev.metadata_json or {}
                prev_dp_res = float(meta_res["previous_distributor_price"]) if "previous_distributor_price" in meta_res and meta_res["previous_distributor_price"] is not None else None
                rev_dp_res = float(meta_res["revised_distributor_price"]) if "revised_distributor_price" in meta_res and meta_res["revised_distributor_price"] is not None else None

                revisions.append(
                    PriceRevisionResponse(
                        id=rev.id,
                        company_id=rev.company_id,
                        branch_id=rev.branch_id,
                        item_id=rev.item_id,
                        variant_id=rev.variant_id,
                        price_book_id=rev.price_book_id,
                        currency=rev.currency,
                        previous_mrp=float(rev.previous_mrp),
                        revised_mrp=float(rev.revised_mrp),
                        previous_selling_price=float(rev.previous_selling_price),
                        revised_selling_price=float(rev.revised_selling_price),
                        previous_distributor_price=prev_dp_res,
                        revised_distributor_price=rev_dp_res,
                        previous_cost_price=float(rev.previous_cost_price) if rev.previous_cost_price else None,
                        revised_cost_price=float(rev.revised_cost_price) if rev.revised_cost_price else None,
                        margin_pct=margin_pct,
                        effective_from=rev.effective_from,
                        effective_to=rev.effective_to,
                        status=rev.status,
                        reason_code=rev.reason_code,
                        justification=rev.justification,
                        approval_required=rev.approval_required,
                        approval_request_id=rev.approval_request_id,
                        approved_by=rev.approved_by,
                        approved_at=rev.approved_at,
                        source=rev.source,
                        batch_id=rev.batch_id,
                        created_by=rev.created_by,
                        created_at=rev.created_at,
                    )
                )
            except Exception as row_err:
                errors.append({
                    "row": row_num,
                    "sku_or_barcode": code_val,
                    "error": str(row_err),
                })

        # Commit all successful rows in this batch
        await session.commit()

        return PriceRevisionBulkResponse(
            batch_id=batch_id,
            total_rows=len(req.items),
            approved_count=approved_count,
            pending_count=pending_count,
            error_count=len(errors),
            errors=errors,
            revisions=revisions,
        )

    @classmethod
    async def filter_bulk_items(
        cls,
        session: AsyncSession,
        company_id: str,
        req: BulkItemFilterRequest,
    ) -> BulkItemFilterResponse:
        """
        Tenant-scoped live item and variant search for Bulk Price Revision Studio.
        Supports multi-facet filtering (Style, Article, Brand, Category, Supplier, Color, Size, Status),
        aggregates candidate counts and returns available catalog facets for filter dropdowns.
        """
        base_conditions = [
            Item.company_id == company_id,
            ItemVariant.company_id == company_id,
            Item.is_deleted == False,
            ItemVariant.is_deleted == False,
        ]

        if req.status and req.status.upper() != "ALL":
            base_conditions.append(Item.status == req.status.upper())
            base_conditions.append(ItemVariant.is_active == True)

        if req.style_code and req.style_code.strip():
            sc = f"%{req.style_code.strip()}%"
            base_conditions.append(Item.style_code.ilike(sc))

        if req.article_no and req.article_no.strip():
            art = f"%{req.article_no.strip()}%"
            base_conditions.append(
                or_(
                    Item.style_code.ilike(art),
                    Item.item_code.ilike(art),
                    Item.attributes_json["article_no"].astext.ilike(art),
                )
            )

        if req.brand and req.brand.strip() and req.brand.upper() != "ALL":
            base_conditions.append(Item.brand.ilike(f"%{req.brand.strip()}%"))

        if req.category and req.category.strip() and req.category.upper() != "ALL":
            base_conditions.append(
                or_(
                    Item.category.ilike(f"%{req.category.strip()}%"),
                    Item.category_code.ilike(f"%{req.category.strip()}%"),
                )
            )

        if req.supplier_code and req.supplier_code.strip() and req.supplier_code.upper() != "ALL":
            base_conditions.append(Item.vendor_code.ilike(f"%{req.supplier_code.strip()}%"))

        if req.colors:
            valid_colors = [c.strip() for c in req.colors if c and c.strip()]
            if valid_colors:
                base_conditions.append(ItemVariant.color.in_(valid_colors))
        elif req.color and req.color.strip() and req.color.upper() != "ALL":
            base_conditions.append(ItemVariant.color.ilike(req.color.strip()))

        if req.sizes:
            valid_sizes = [s.strip() for s in req.sizes if s and s.strip()]
            if valid_sizes:
                base_conditions.append(ItemVariant.size.in_(valid_sizes))
        elif req.size and req.size.strip() and req.size.upper() != "ALL":
            base_conditions.append(ItemVariant.size.ilike(req.size.strip()))

        if req.query and req.query.strip():
            q = f"%{req.query.strip()}%"
            base_conditions.append(
                or_(
                    Item.item_code.ilike(q),
                    Item.item_name.ilike(q),
                    Item.style_code.ilike(q),
                    ItemVariant.variant_sku.ilike(q),
                    ItemVariant.variant_name.ilike(q),
                )
            )

        # 1. Total matching variants count
        count_stmt = (
            select(func.count(ItemVariant.id))
            .select_from(ItemVariant)
            .join(Item, ItemVariant.item_id == Item.id)
            .where(*base_conditions)
        )
        total_count = await session.scalar(count_stmt) or 0

        # 2. Distinct style count
        style_count_stmt = (
            select(func.count(distinct(Item.id)))
            .select_from(ItemVariant)
            .join(Item, ItemVariant.item_id == Item.id)
            .where(*base_conditions)
        )
        total_styles = await session.scalar(style_count_stmt) or 0

        # 3. Primary/first Barcode subquery
        subq_barcode = (
            select(ItemBarcode.variant_id, func.min(ItemBarcode.barcode).label("barcode"))
            .where(ItemBarcode.company_id == company_id, ItemBarcode.is_deleted == False)
            .group_by(ItemBarcode.variant_id)
            .subquery()
        )

        # 4. Fetch candidates page
        candidate_stmt = (
            select(
                Item.id.label("item_id"),
                ItemVariant.id.label("variant_id"),
                Item.style_code,
                Item.item_code,
                Item.item_name,
                Item.attributes_json,
                ItemVariant.variant_sku,
                ItemVariant.color,
                ItemVariant.size,
                Item.brand,
                Item.category,
                Item.vendor_code,
                Item.status.label("item_status"),
                ItemVariant.is_active.label("variant_is_active"),
                ItemVariant.mrp.label("variant_mrp"),
                ItemVariant.selling_price.label("variant_sp"),
                ItemVariant.cost_price.label("variant_cp"),
                ItemPrice.wholesale_price,
                ItemPrice.mrp.label("price_mrp"),
                ItemPrice.selling_price.label("price_sp"),
                ItemPrice.cost_price.label("price_cp"),
                subq_barcode.c.barcode,
            )
            .select_from(ItemVariant)
            .join(Item, ItemVariant.item_id == Item.id)
            .outerjoin(ItemPrice, ItemPrice.item_variant_id == ItemVariant.id)
            .outerjoin(subq_barcode, subq_barcode.c.variant_id == ItemVariant.id)
            .where(*base_conditions)
            .order_by(Item.style_code.asc().nulls_last(), Item.item_code.asc(), ItemVariant.variant_sku.asc())
            .limit(req.limit)
            .offset(req.offset)
        )
        rows = (await session.execute(candidate_stmt)).all()

        candidates: List[BulkItemCandidate] = []
        for r in rows:
            cur_mrp = float(r.price_mrp or r.variant_mrp or 0.0)
            cur_sp = float(r.price_sp or r.variant_sp or 0.0)
            cur_cp = float(r.price_cp or r.variant_cp or 0.0)
            cur_dp = float(r.wholesale_price) if r.wholesale_price is not None else None

            # Article number fallback
            art_no = None
            if r.attributes_json and isinstance(r.attributes_json, dict):
                art_no = r.attributes_json.get("article_no")
            if not art_no:
                art_no = r.style_code or r.item_code

            candidates.append(
                BulkItemCandidate(
                    item_id=r.item_id,
                    variant_id=r.variant_id,
                    style_code=r.style_code or r.item_code,
                    article_no=art_no,
                    item_code=r.item_code,
                    item_name=r.item_name,
                    variant_sku=r.variant_sku,
                    barcode=r.barcode,
                    brand=r.brand,
                    category=r.category,
                    color=r.color,
                    size=r.size,
                    vendor_code=r.vendor_code,
                    current_mrp=cur_mrp,
                    current_selling_price=cur_sp,
                    current_distributor_price=cur_dp,
                    current_cost_price=cur_cp,
                    status="ACTIVE" if r.variant_is_active else "INACTIVE",
                )
            )

        # 5. Distinct facets for UI dropdowns
        brands_res = (await session.execute(
            select(distinct(Item.brand))
            .where(Item.company_id == company_id, Item.brand.isnot(None), Item.is_deleted == False)
            .order_by(Item.brand)
        )).scalars().all()

        cats_res = (await session.execute(
            select(distinct(Item.category))
            .where(Item.company_id == company_id, Item.category.isnot(None), Item.is_deleted == False)
            .order_by(Item.category)
        )).scalars().all()

        colors_res = (await session.execute(
            select(distinct(ItemVariant.color))
            .where(ItemVariant.company_id == company_id, ItemVariant.color.isnot(None), ItemVariant.is_deleted == False)
            .order_by(ItemVariant.color)
        )).scalars().all()

        sizes_res = (await session.execute(
            select(distinct(ItemVariant.size))
            .where(ItemVariant.company_id == company_id, ItemVariant.size.isnot(None), ItemVariant.is_deleted == False)
            .order_by(ItemVariant.size)
        )).scalars().all()

        suppliers_res = (await session.execute(
            select(distinct(Item.vendor_code))
            .where(Item.company_id == company_id, Item.vendor_code.isnot(None), Item.is_deleted == False)
            .order_by(Item.vendor_code)
        )).scalars().all()

        return BulkItemFilterResponse(
            total_count=total_count,
            total_styles=total_styles,
            items=candidates,
            available_brands=[str(b) for b in brands_res if b],
            available_categories=[str(c) for c in cats_res if c],
            available_colors=[str(c) for c in colors_res if c],
            available_sizes=[str(s) for s in sizes_res if s],
            available_suppliers=[str(v) for v in suppliers_res if v],
        )
