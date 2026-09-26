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
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Tuple

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.item_master import Item, ItemBarcode, ItemVariant
from ..models.inventory import Product
from ..models.vendor_product_assignment import POProductDecisionLog, VendorProductAssignment
from ..schemas.vendor_product_assignment import POProductDecision
from ..services.system_parameter import SystemParameterService
from ..services.vendor_product_assignment import VendorProductAssignmentService

# ─────────────────────────────────────────────────────────────────────────────
# Canonical parameter codes (Execution Command Rule 15)
# ─────────────────────────────────────────────────────────────────────────────

_P_VISIBILITY   = "SMRITI.PURCHASE.ORDER.VENDOR_ITEM_VISIBILITY_MODE"
_P_CROSS_VENDOR = "SMRITI.PURCHASE.ORDER.CROSS_VENDOR_ITEM_POLICY"
_P_UNASSIGNED   = "SMRITI.PURCHASE.ORDER.UNASSIGNED_ITEM_POLICY"
_P_RESTRICTED   = "SMRITI.PURCHASE.ORDER.RESTRICTED_ITEM_POLICY"
_P_SHOW_STATUS  = "SMRITI.PURCHASE.ORDER.SHOW_VENDOR_STATUS"
_P_SHOW_EXPL    = "SMRITI.PURCHASE.ORDER.SHOW_EXPLANATION"
_P_REASON_REQ   = "SMRITI.PURCHASE.ORDER.APPROVAL_REASON_REQUIRED"
_P_AUDIT        = "SMRITI.PURCHASE.ORDER.AUDIT_APPROVAL_DECISION"

# Policy value → Action mapping (Execution Command Rule 9 — STATUS ≠ ACTION)
_POLICY_TO_ACTION: Dict[str, str] = {
    "ALLOW":                "ALLOW",
    "ALLOW_WITH_APPROVAL":  "APPROVAL_REQUIRED",
    "READ_ONLY":            "READ_ONLY",
    "BLOCK":                "BLOCK",
}

# Default safe-fallback values if parameters are not yet seeded (Execution Command Rule 10)
_DEFAULTS: Dict[str, Any] = {
    _P_VISIBILITY:   "ASSIGNED_PLUS_ALL",
    _P_CROSS_VENDOR: "ALLOW_WITH_APPROVAL",
    _P_UNASSIGNED:   "ALLOW_WITH_APPROVAL",
    _P_RESTRICTED:   "BLOCK",
    _P_SHOW_STATUS:  True,
    _P_SHOW_EXPL:    True,
    _P_REASON_REQ:   True,
    _P_AUDIT:        True,
}

# Approval reason defaults (loaded at runtime from master_values if available)
_DEFAULT_REASONS = [
    {"code": "BETTER_PRICE",           "label": "Better Price Available"},
    {"code": "STOCK_AVAILABILITY",     "label": "Stock Not Available from Registered Vendor"},
    {"code": "REGISTERED_VENDOR_OOS",  "label": "Registered Vendor is Out of Stock"},
    {"code": "URGENT_REQUIREMENT",     "label": "Urgent Requirement"},
    {"code": "BETTER_CREDIT_TERMS",    "label": "Better Credit Terms Offered"},
    {"code": "DELIVERY_REQUIREMENT",   "label": "Delivery Timeline Requirement"},
    {"code": "TERRITORY_REQUIREMENT",  "label": "Territory or Location Requirement"},
    {"code": "NEW_VENDOR_TRIAL",       "label": "New Vendor Trial / Evaluation"},
    {"code": "MANAGEMENT_INSTRUCTION", "label": "Management Instruction"},
    {"code": "OTHER",                  "label": "Other (please specify)"},
]


# ─────────────────────────────────────────────────────────────────────────────
# Policy snapshot (internal — not exposed to frontend)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class _PolicySnapshot:
    visibility_mode: str = "ASSIGNED_PLUS_ALL"
    cross_vendor_policy: str = "ALLOW_WITH_APPROVAL"
    unassigned_policy: str = "ALLOW_WITH_APPROVAL"
    restricted_policy: str = "BLOCK"
    show_vendor_status: bool = True
    show_explanation: bool = True
    approval_reason_required: bool = True
    audit_approval_decision: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            _P_VISIBILITY:   self.visibility_mode,
            _P_CROSS_VENDOR: self.cross_vendor_policy,
            _P_UNASSIGNED:   self.unassigned_policy,
            _P_RESTRICTED:   self.restricted_policy,
            _P_SHOW_STATUS:  self.show_vendor_status,
            _P_SHOW_EXPL:    self.show_explanation,
            _P_REASON_REQ:   self.approval_reason_required,
            _P_AUDIT:        self.audit_approval_decision,
        }

    def version_hash(self) -> str:
        import hashlib, json
        raw = json.dumps(self.to_dict(), sort_keys=True)
        return "v" + hashlib.md5(raw.encode()).hexdigest()[:8]


# ─────────────────────────────────────────────────────────────────────────────
# Product resolution result (internal)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class _ResolvedProduct:
    product_ref: str                            # Original input ref
    product_id: Optional[str] = None           # legacy products.id
    item_id: Optional[str] = None              # canonical items.id
    variant_id: Optional[str] = None           # item_variants.id
    item_code: Optional[str] = None
    style_code: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    barcode: Optional[str] = None
    variant_sku: Optional[str] = None
    item_name: Optional[str] = None

    def assignment_candidates(self) -> List[Tuple[str, str]]:
        """
        Returns (level, target_id_or_code) pairs from most specific to most broad.
        Used by VendorProductAssignmentService.find_effective_assignments().
        Precedence: BARCODE > SKU/VARIANT > ARTICLE/ITEM > STYLE > BRAND > CATEGORY
        """
        candidates: List[Tuple[str, str]] = []
        if self.barcode:
            candidates.append(("BARCODE", self.barcode))
        if self.variant_id:
            candidates.append(("SKU", self.variant_id))
        if self.variant_sku:
            candidates.append(("SKU", self.variant_sku))
        if self.item_id:
            candidates.append(("ARTICLE", self.item_id))
        if self.item_code:
            candidates.append(("ARTICLE", self.item_code))
        if self.style_code:
            candidates.append(("STYLE", self.style_code))
        if self.brand:
            candidates.append(("BRAND", self.brand))
        if self.category:
            candidates.append(("CATEGORY", self.category))
        return candidates


# ─────────────────────────────────────────────────────────────────────────────
# POProductPolicyEngine
# ─────────────────────────────────────────────────────────────────────────────

class POProductPolicyEngine:
    """
    Authoritative PO Product Policy Engine.

    Architecture (Execution Command Rule 4):
        VendorProductAssignment table
                ↓
        VendorProductAssignmentService.find_effective_assignments()
                ↓
        POProductPolicyEngine.evaluate_product_for_vendor()
                ↓
        SystemParameters (policy config)
                ↓
        ALLOW | READ_ONLY | APPROVAL_REQUIRED | BLOCK
                ↓
        POProductDecisionLog (audit)

    KEY PRINCIPLE (Rule 9 — STATUS ≠ ACTION):
        CROSS_VENDOR + ALLOW_WITH_APPROVAL → status=CROSS_VENDOR, action=APPROVAL_REQUIRED
        UNASSIGNED   + ALLOW_WITH_APPROVAL → status=UNASSIGNED,   action=APPROVAL_REQUIRED

    The backend is authoritative. The frontend NEVER calculates authorization independently.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # ─────────────────────────────────────────────────────────────────────────
    # Main entry point
    # ─────────────────────────────────────────────────────────────────────────

    async def evaluate_product_for_vendor(
        self,
        company_id: str,
        branch_id: Optional[str],
        vendor_party_id: str,         # already resolved to canonical parties.id
        product_ref: str,             # barcode, item_code, item_id, variant_id, or variant_sku
        transaction_date: date,
        user_id: Optional[str] = None,
        purchase_order_id: Optional[str] = None,
        write_log: bool = True,
    ) -> POProductDecision:
        """
        Evaluate whether a product can be purchased from a vendor in a PO context.

        Returns a POProductDecision with status + action + full explainability.
        Optionally writes the decision to po_product_decision_log (audit).
        """
        # 1. Resolve the product across both catalog layers (Items + Products)
        resolved = await self._resolve_product(company_id, product_ref)

        # 2. Load the effective policy snapshot for this company/branch
        policy = await self._load_policy(company_id, branch_id)

        # 3. Load approval reasons for this company
        reasons = await self._load_approval_reasons(company_id)

        # 4. Find applicable assignments (all levels, all vendors)
        vpa_svc = VendorProductAssignmentService.__new__(VendorProductAssignmentService)
        vpa_svc.db = self.db

        all_assignments = await vpa_svc.find_effective_assignments(
            company_id=company_id,
            target_candidates=resolved.assignment_candidates(),
            transaction_date=transaction_date,
        )

        # 5. Classify: ASSIGNED / CROSS_VENDOR / UNASSIGNED / RESTRICTED
        (
            decision_status,
            winning_assignment,
        ) = self._classify(vendor_party_id, all_assignments)

        # 6. Map status → action using policy (STATUS ≠ ACTION — Rule 9)
        decision_action, explanation = self._apply_policy(
            decision_status=decision_status,
            policy=policy,
            resolved=resolved,
            vendor_party_id=vendor_party_id,
            winning_assignment=winning_assignment,
        )

        # 6a. Per-assignment approval_required override
        if winning_assignment and winning_assignment.approval_required:
            if decision_action == "ALLOW":
                decision_action = "APPROVAL_REQUIRED"
                explanation += " (Approval required by assignment rule.)"

        # 7. Build the decision object
        approval_required = decision_action == "APPROVAL_REQUIRED"
        reason_required = approval_required and policy.approval_reason_required

        decision = POProductDecision(
            product_ref=product_ref,
            status=decision_status,
            action=decision_action,
            assignment_id=winning_assignment.id if winning_assignment else None,
            assignment_level=winning_assignment.assignment_level if winning_assignment else None,
            assignment_vendor_id=winning_assignment.vendor_party_id if winning_assignment else None,
            approval_required=approval_required,
            approval_reason_required=reason_required,
            approval_reasons=reasons if reason_required else [],
            explanation=explanation if policy.show_explanation else "",
            policy_snapshot=policy.to_dict(),
            policy_version=policy.version_hash(),
        )

        # 8. Write audit log (if enabled by policy and caller requests it)
        if write_log and policy.audit_approval_decision:
            log_id = await self._write_decision_log(
                company_id=company_id,
                branch_id=branch_id,
                resolved=resolved,
                vendor_party_id=vendor_party_id,
                purchase_order_id=purchase_order_id,
                decision_status=decision_status,
                decision_action=decision_action,
                winning_assignment=winning_assignment,
                policy=policy,
                decided_by=user_id,
                explanation=explanation,
            )
            decision.decision_log_id = log_id

        return decision

    async def evaluate_batch(
        self,
        company_id: str,
        branch_id: Optional[str],
        vendor_party_id: str,
        product_refs: List[str],
        transaction_date: date,
        user_id: Optional[str] = None,
        purchase_order_id: Optional[str] = None,
    ) -> List[POProductDecision]:
        """
        Batch-evaluate multiple products for the browse dialog pre-evaluation.
        Shares a single policy load across all evaluations for efficiency.
        """
        results = []
        for ref in product_refs:
            try:
                decision = await self.evaluate_product_for_vendor(
                    company_id=company_id,
                    branch_id=branch_id,
                    vendor_party_id=vendor_party_id,
                    product_ref=ref,
                    transaction_date=transaction_date,
                    user_id=user_id,
                    purchase_order_id=purchase_order_id,
                    write_log=False,  # Don't log browse-time evaluations individually
                )
                results.append(decision)
            except Exception:
                # Return UNASSIGNED/ALLOW as safe fallback for unresolvable refs
                results.append(
                    POProductDecision(
                        product_ref=ref,
                        status="UNASSIGNED",
                        action="ALLOW",
                        explanation="Product information could not be verified at this time.",
                        policy_snapshot={},
                        policy_version="",
                    )
                )
        return results

    async def build_diagnostic(
        self,
        company_id: str,
        branch_id: Optional[str],
        vendor_party_id: str,
        product_ref: str,
        transaction_date: date,
    ) -> Dict[str, Any]:
        """
        Admin diagnostic: return full resolution chain for support/audit (Rule 25).
        """
        resolved = await self._resolve_product(company_id, product_ref)
        policy = await self._load_policy(company_id, branch_id)
        reasons = await self._load_approval_reasons(company_id)

        vpa_svc = VendorProductAssignmentService.__new__(VendorProductAssignmentService)
        vpa_svc.db = self.db

        all_assignments = await vpa_svc.find_effective_assignments(
            company_id=company_id,
            target_candidates=resolved.assignment_candidates(),
            transaction_date=transaction_date,
        )
        decision_status, winning = self._classify(vendor_party_id, all_assignments)
        decision_action, explanation = self._apply_policy(
            decision_status, policy, resolved, vendor_party_id, winning
        )

        candidate_dicts = [
            {
                "id": a.id,
                "level": a.assignment_level,
                "target_code": a.assignment_target_code,
                "vendor_party_id": a.vendor_party_id,
                "priority": a.vendor_priority,
                "status": a.status,
                "effective_from": str(a.effective_from) if a.effective_from else None,
                "effective_to": str(a.effective_to) if a.effective_to else None,
            }
            for a in all_assignments
        ]

        return {
            "vendor_id": vendor_party_id,
            "product_ref": product_ref,
            "product_name": resolved.item_name,
            "item_id": resolved.item_id,
            "item_code": resolved.item_code,
            "style_code": resolved.style_code,
            "brand": resolved.brand,
            "category": resolved.category,
            "assignment_candidates_searched": resolved.assignment_candidates(),
            "candidate_assignments": candidate_dicts,
            "winning_assignment": {
                "id": winning.id,
                "level": winning.assignment_level,
                "target_code": winning.assignment_target_code,
                "vendor_party_id": winning.vendor_party_id,
                "priority": winning.vendor_priority,
                "status": winning.status,
            } if winning else None,
            "active_policy": policy.to_dict(),
            "policy_version": policy.version_hash(),
            "decision": {
                "status": decision_status,
                "action": decision_action,
                "explanation": explanation,
            },
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Classification (ASSIGNED / CROSS_VENDOR / UNASSIGNED / RESTRICTED)
    # ─────────────────────────────────────────────────────────────────────────

    def _classify(
        self,
        vendor_party_id: str,
        all_assignments: List[VendorProductAssignment],
    ) -> Tuple[str, Optional[VendorProductAssignment]]:
        """
        Classify the product relative to the PO vendor using all found assignments.

        Decision logic:
        1. Find most-specific assignment overall (any vendor).
        2. If its status == RESTRICTED → RESTRICTED.
        3. If winning assignment's vendor_party_id == PO vendor → ASSIGNED.
        4. If winning assignment's vendor_party_id != PO vendor → CROSS_VENDOR.
        5. No assignment found → UNASSIGNED.
        """
        if not all_assignments:
            return "UNASSIGNED", None

        # Select most specific assignment across all vendors (any vendor)
        winning = VendorProductAssignmentService.select_most_specific(all_assignments)

        if winning is None:
            return "UNASSIGNED", None

        if winning.status == "RESTRICTED":
            return "RESTRICTED", winning

        if winning.vendor_party_id == vendor_party_id:
            return "ASSIGNED", winning

        # Winning assignment is for a different vendor — check if PO vendor also has one
        po_vendor_assignments = [a for a in all_assignments if a.vendor_party_id == vendor_party_id]
        if po_vendor_assignments:
            # PO vendor has an assignment but it's less specific — still CROSS_VENDOR
            # (the primary assignment at the most specific level belongs to another vendor)
            return "CROSS_VENDOR", winning

        return "CROSS_VENDOR", winning

    # ─────────────────────────────────────────────────────────────────────────
    # Policy application (STATUS → ACTION)
    # ─────────────────────────────────────────────────────────────────────────

    def _apply_policy(
        self,
        decision_status: str,
        policy: _PolicySnapshot,
        resolved: _ResolvedProduct,
        vendor_party_id: str,
        winning_assignment: Optional[VendorProductAssignment],
    ) -> Tuple[str, str]:
        """
        Map business status to action using the company's SystemParameter policy.
        Returns (action, human_readable_explanation).
        """
        if decision_status == "ASSIGNED":
            action = "ALLOW"
            explanation = (
                f"'{resolved.item_name or resolved.product_ref}' is registered to this vendor. "
                "Purchase is allowed."
            )

        elif decision_status == "CROSS_VENDOR":
            policy_val = policy.cross_vendor_policy
            action = _POLICY_TO_ACTION.get(policy_val, "APPROVAL_REQUIRED")
            registered_vendor = (
                winning_assignment.assignment_target_code
                if winning_assignment
                else "another vendor"
            )
            explanation = (
                f"'{resolved.item_name or resolved.product_ref}' is registered to "
                f"'{registered_vendor}', not to the selected vendor. "
                f"Your business policy requires: {self._action_label(action)}."
            )

        elif decision_status == "UNASSIGNED":
            policy_val = policy.unassigned_policy
            action = _POLICY_TO_ACTION.get(policy_val, "APPROVAL_REQUIRED")
            explanation = (
                f"'{resolved.item_name or resolved.product_ref}' has no vendor assignment. "
                f"Your business policy requires: {self._action_label(action)}."
            )

        elif decision_status == "RESTRICTED":
            action = "BLOCK"
            explanation = (
                f"'{resolved.item_name or resolved.product_ref}' is restricted for purchase "
                "from this vendor. This product cannot be added to the order."
            )

        else:
            action = "ALLOW"
            explanation = "Product status could not be determined. Proceeding with default allow."

        return action, explanation

    @staticmethod
    def _action_label(action: str) -> str:
        return {
            "ALLOW": "allowed",
            "READ_ONLY": "view only (cannot edit quantity/rate)",
            "APPROVAL_REQUIRED": "approval from a manager",
            "BLOCK": "not allowed",
        }.get(action, action)

    # ─────────────────────────────────────────────────────────────────────────
    # Product resolution (dual-layer: items + products)
    # ─────────────────────────────────────────────────────────────────────────

    async def _resolve_product(
        self, company_id: str, product_ref: str
    ) -> _ResolvedProduct:
        """
        Resolve a product_ref to a _ResolvedProduct containing all catalog
        identifiers needed for multi-level assignment lookup.

        Resolution order:
        1. item_barcodes (barcode match)
        2. item_variants (variant_sku or id match)
        3. items (item_code or id match)
        4. products (fallback — legacy catalog)
        """
        resolved = _ResolvedProduct(product_ref=product_ref)

        # --- Layer 1: Barcode ---
        bc_stmt = select(ItemBarcode).where(
            or_(
                ItemBarcode.barcode == product_ref,
                ItemBarcode.id == product_ref,
            )
        )
        bc = (await self.db.execute(bc_stmt)).scalars().first()
        if bc:
            resolved.barcode = bc.barcode
            if bc.variant_id:
                resolved.variant_id = bc.variant_id
                variant = (await self.db.execute(
                    select(ItemVariant).where(ItemVariant.id == bc.variant_id)
                )).scalars().first()
                if variant:
                    resolved.variant_sku = variant.variant_sku
                    resolved.item_id = variant.item_id
            if bc.item_id:
                resolved.item_id = bc.item_id
            if resolved.item_id:
                await self._enrich_from_item(resolved)
            return resolved

        # --- Layer 2: Variant ---
        var_stmt = select(ItemVariant).where(
            or_(
                ItemVariant.id == product_ref,
                ItemVariant.variant_sku == product_ref,
            ),
            ItemVariant.is_active == True,
        )
        variant = (await self.db.execute(var_stmt)).scalars().first()
        if variant:
            resolved.variant_id = variant.id
            resolved.variant_sku = variant.variant_sku
            resolved.item_id = variant.item_id
            await self._enrich_from_item(resolved)
            return resolved

        # --- Layer 3: Item ---
        item_stmt = select(Item).where(
            or_(
                Item.id == product_ref,
                Item.item_code == product_ref,
                Item.identity_code == product_ref,
            ),
            Item.is_deleted == False,
        )
        if company_id:
            item_stmt = item_stmt.where(
                or_(Item.company_id == company_id, Item.company_id.is_(None))
            )
        item = (await self.db.execute(item_stmt)).scalars().first()
        if item:
            resolved.item_id = item.id
            resolved.item_code = item.item_code
            resolved.item_name = item.item_name
            resolved.style_code = item.style_code
            resolved.brand = item.brand
            resolved.category = item.category
            return resolved

        # --- Layer 4: Legacy Product ---
        prod_stmt = select(Product).where(
            or_(
                Product.id == product_ref,
                Product.code == product_ref,
                Product.barcode == product_ref,
            ),
            Product.is_deleted == False,
        )
        if company_id:
            prod_stmt = prod_stmt.where(
                or_(Product.company_id == company_id, Product.company_id.is_(None))
            )
        product = (await self.db.execute(prod_stmt)).scalars().first()
        if product:
            resolved.product_id = product.id
            resolved.item_id = getattr(product, "item_id", None)
            resolved.item_code = product.code
            resolved.item_name = product.name
            resolved.style_code = getattr(product, "style_code", None)
            resolved.brand = getattr(product, "brand", None)
            resolved.barcode = product.barcode
            if resolved.item_id:
                await self._enrich_from_item(resolved)
            return resolved

        # Product not found — return bare resolved so engine returns UNASSIGNED
        resolved.item_code = product_ref
        return resolved

    async def _enrich_from_item(self, resolved: _ResolvedProduct) -> None:
        """Backfill item-level fields on resolved from items table."""
        if not resolved.item_id:
            return
        item_stmt = select(Item).where(Item.id == resolved.item_id)
        item = (await self.db.execute(item_stmt)).scalars().first()
        if item:
            resolved.item_code = resolved.item_code or item.item_code
            resolved.item_name = resolved.item_name or item.item_name
            resolved.style_code = resolved.style_code or item.style_code
            resolved.brand = resolved.brand or item.brand
            resolved.category = resolved.category or item.category

    # ─────────────────────────────────────────────────────────────────────────
    # Policy loading
    # ─────────────────────────────────────────────────────────────────────────

    async def _load_policy(
        self, company_id: str, branch_id: Optional[str]
    ) -> _PolicySnapshot:
        """
        Load the 8 PO policy SystemParameters using the existing 4-tier resolve hierarchy.
        Falls back to _DEFAULTS if a parameter has not been seeded.
        """

        async def _get(code: str) -> Any:
            p = await SystemParameterService.resolve_parameter(
                db=self.db,
                param_code=code,
                company_id=company_id,
                branch_id=branch_id,
            )
            if p is None:
                return _DEFAULTS.get(code)
            return p.get_value()

        return _PolicySnapshot(
            visibility_mode=await _get(_P_VISIBILITY) or "ASSIGNED_PLUS_ALL",
            cross_vendor_policy=await _get(_P_CROSS_VENDOR) or "ALLOW_WITH_APPROVAL",
            unassigned_policy=await _get(_P_UNASSIGNED) or "ALLOW_WITH_APPROVAL",
            restricted_policy=await _get(_P_RESTRICTED) or "BLOCK",
            show_vendor_status=bool(await _get(_P_SHOW_STATUS) if await _get(_P_SHOW_STATUS) is not None else True),
            show_explanation=bool(await _get(_P_SHOW_EXPL) if await _get(_P_SHOW_EXPL) is not None else True),
            approval_reason_required=bool(await _get(_P_REASON_REQ) if await _get(_P_REASON_REQ) is not None else True),
            audit_approval_decision=bool(await _get(_P_AUDIT) if await _get(_P_AUDIT) is not None else True),
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Approval reasons
    # ─────────────────────────────────────────────────────────────────────────

    async def _load_approval_reasons(self, company_id: str) -> List[Dict[str, str]]:
        """
        Load PO cross-vendor approval reasons from master_values.
        Falls back to _DEFAULT_REASONS if master_types/values not yet seeded.
        """
        try:
            from ..models.master_lookup import MasterType, MasterValue
            mt_stmt = select(MasterType).where(MasterType.code == "PO_CROSS_VENDOR_REASON")
            mt = (await self.db.execute(mt_stmt)).scalars().first()
            if not mt:
                return _DEFAULT_REASONS
            mv_stmt = select(MasterValue).where(
                MasterValue.master_type_id == mt.id,
                MasterValue.active == True,
            ).order_by(MasterValue.sort_order)
            rows = (await self.db.execute(mv_stmt)).scalars().all()
            if not rows:
                return _DEFAULT_REASONS
            return [{"code": r.code, "label": r.name} for r in rows]
        except Exception:
            return _DEFAULT_REASONS

    # ─────────────────────────────────────────────────────────────────────────
    # Audit log writer
    # ─────────────────────────────────────────────────────────────────────────

    async def _write_decision_log(
        self,
        company_id: str,
        branch_id: Optional[str],
        resolved: _ResolvedProduct,
        vendor_party_id: str,
        purchase_order_id: Optional[str],
        decision_status: str,
        decision_action: str,
        winning_assignment: Optional[VendorProductAssignment],
        policy: _PolicySnapshot,
        decided_by: Optional[str],
        explanation: str,
    ) -> str:
        log_id = f"ppdl-{uuid.uuid4().hex[:12]}"
        log = POProductDecisionLog(
            id=log_id,
            company_id=company_id,
            branch_id=branch_id,
            purchase_order_id=purchase_order_id,
            vendor_party_id=vendor_party_id,
            product_id=resolved.product_id or resolved.item_id or resolved.product_ref,
            item_id=resolved.item_id,
            variant_id=resolved.variant_id,
            product_code=resolved.item_code or resolved.product_ref,
            transaction_date=date.today(),
            decision_status=decision_status,
            decision_action=decision_action,
            assignment_id=winning_assignment.id if winning_assignment else None,
            assignment_level=winning_assignment.assignment_level if winning_assignment else None,
            assignment_source_vendor_id=winning_assignment.vendor_party_id if winning_assignment else None,
            policy_snapshot=policy.to_dict(),
            explanation=explanation,
            decided_by=decided_by,
        )
        self.db.add(log)
        try:
            await self.db.flush()
        except Exception:
            await self.db.rollback()
            raise
        return log_id
