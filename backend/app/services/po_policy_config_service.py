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
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..services.system_parameter import SystemParameterService
from ..schemas.vendor_product_assignment import (
    POPolicyConfigOut,
    POPolicyTemplateOut,
    POPolicyApplyRequest,
)

# ─────────────────────────────────────────────────────────────────────────────
# Canonical parameter codes
# ─────────────────────────────────────────────────────────────────────────────
_P_VISIBILITY   = "SMRITI.PURCHASE.ORDER.VENDOR_ITEM_VISIBILITY_MODE"
_P_CROSS_VENDOR = "SMRITI.PURCHASE.ORDER.CROSS_VENDOR_ITEM_POLICY"
_P_UNASSIGNED   = "SMRITI.PURCHASE.ORDER.UNASSIGNED_ITEM_POLICY"
_P_RESTRICTED   = "SMRITI.PURCHASE.ORDER.RESTRICTED_ITEM_POLICY"
_P_SHOW_STATUS  = "SMRITI.PURCHASE.ORDER.SHOW_VENDOR_STATUS"
_P_SHOW_EXPL    = "SMRITI.PURCHASE.ORDER.SHOW_EXPLANATION"
_P_REASON_REQ   = "SMRITI.PURCHASE.ORDER.APPROVAL_REASON_REQUIRED"
_P_AUDIT        = "SMRITI.PURCHASE.ORDER.AUDIT_APPROVAL_DECISION"

# ─────────────────────────────────────────────────────────────────────────────
# Business-language labels (Rule 5 — normal user must never see param codes)
# ─────────────────────────────────────────────────────────────────────────────
_VISIBILITY_LABELS = {
    "ASSIGNED_ONLY":      "Show only products registered to this vendor",
    "ASSIGNED_PLUS_ALL":  "Show registered products first, with other products also available",
    "ALL_ITEMS":          "Show all products",
}
_POLICY_LABELS = {
    "ALLOW":                "Allowed without restriction",
    "ALLOW_WITH_APPROVAL":  "Allowed with manager approval",
    "READ_ONLY":            "Visible but cannot be edited or approved",
    "BLOCK":                "Not allowed — will be blocked",
}

# ─────────────────────────────────────────────────────────────────────────────
# Business Templates (Rule 17 — templates are DATA, not code)
# ─────────────────────────────────────────────────────────────────────────────
_TEMPLATES: List[Dict[str, Any]] = [
    {
        "code": "GENERAL_RETAIL",
        "name": "General Retail",
        "description": "Balanced purchasing control for most retail businesses. Assigned products are prioritised; cross-vendor requires approval.",
        "recommended_for": ["Retail", "Multi-brand Store", "Apparel", "General Merchandise"],
        "values": {
            _P_VISIBILITY:   "ASSIGNED_PLUS_ALL",
            _P_CROSS_VENDOR: "ALLOW_WITH_APPROVAL",
            _P_UNASSIGNED:   "ALLOW_WITH_APPROVAL",
            _P_RESTRICTED:   "BLOCK",
            _P_SHOW_STATUS:  True, _P_SHOW_EXPL: True,
            _P_REASON_REQ:   True, _P_AUDIT: True,
        },
    },
    {
        "code": "SIMPLE_RETAIL",
        "name": "Simple Retail (Open)",
        "description": "Minimal restrictions. Buyers can purchase from any vendor without approval. Suitable for small businesses starting out.",
        "recommended_for": ["Small Business", "Startup", "Convenience Store"],
        "values": {
            _P_VISIBILITY:   "ALL_ITEMS",
            _P_CROSS_VENDOR: "ALLOW",
            _P_UNASSIGNED:   "ALLOW",
            _P_RESTRICTED:   "BLOCK",
            _P_SHOW_STATUS:  True, _P_SHOW_EXPL: False,
            _P_REASON_REQ:   False, _P_AUDIT: True,
        },
    },
    {
        "code": "CONTROLLED_PURCHASING",
        "name": "Controlled Purchasing",
        "description": "Strict vendor discipline. Only registered vendor products shown. Cross-vendor needs approval; unassigned is blocked.",
        "recommended_for": ["Chain Store", "Franchise", "Compliance-heavy Operations"],
        "values": {
            _P_VISIBILITY:   "ASSIGNED_PLUS_ALL",
            _P_CROSS_VENDOR: "ALLOW_WITH_APPROVAL",
            _P_UNASSIGNED:   "BLOCK",
            _P_RESTRICTED:   "BLOCK",
            _P_SHOW_STATUS:  True, _P_SHOW_EXPL: True,
            _P_REASON_REQ:   True, _P_AUDIT: True,
        },
    },
    {
        "code": "OPEN_PURCHASING",
        "name": "Open Purchasing",
        "description": "Fully open — any product from any vendor is allowed without approval.",
        "recommended_for": ["Wholesale", "Project Procurement", "Ad-hoc Purchasing"],
        "values": {
            _P_VISIBILITY:   "ALL_ITEMS",
            _P_CROSS_VENDOR: "ALLOW",
            _P_UNASSIGNED:   "ALLOW",
            _P_RESTRICTED:   "ALLOW",
            _P_SHOW_STATUS:  False, _P_SHOW_EXPL: False,
            _P_REASON_REQ:   False, _P_AUDIT: False,
        },
    },
    {
        "code": "ENTERPRISE_PROCUREMENT",
        "name": "Enterprise Procurement",
        "description": "Maximum control. Only assigned products are visible. Any deviation requires approval. Full audit trail.",
        "recommended_for": ["Enterprise", "Government", "Large Organisation"],
        "values": {
            _P_VISIBILITY:   "ASSIGNED_ONLY",
            _P_CROSS_VENDOR: "ALLOW_WITH_APPROVAL",
            _P_UNASSIGNED:   "BLOCK",
            _P_RESTRICTED:   "BLOCK",
            _P_SHOW_STATUS:  True, _P_SHOW_EXPL: True,
            _P_REASON_REQ:   True, _P_AUDIT: True,
        },
    },
    {
        "code": "FOOTWEAR",
        "name": "Footwear",
        "description": "Optimised for footwear retail. Brand and style assignments drive vendor control.",
        "recommended_for": ["Footwear Store", "Shoe Retail", "Multi-brand Footwear"],
        "values": {
            _P_VISIBILITY:   "ASSIGNED_PLUS_ALL",
            _P_CROSS_VENDOR: "ALLOW_WITH_APPROVAL",
            _P_UNASSIGNED:   "ALLOW_WITH_APPROVAL",
            _P_RESTRICTED:   "BLOCK",
            _P_SHOW_STATUS:  True, _P_SHOW_EXPL: True,
            _P_REASON_REQ:   True, _P_AUDIT: True,
        },
    },
    {
        "code": "APPAREL",
        "name": "Apparel & Fashion",
        "description": "Optimised for apparel. Style and brand-level vendor assignments. Approval for cross-vendor.",
        "recommended_for": ["Clothing Store", "Fashion Retail", "Garment"],
        "values": {
            _P_VISIBILITY:   "ASSIGNED_PLUS_ALL",
            _P_CROSS_VENDOR: "ALLOW_WITH_APPROVAL",
            _P_UNASSIGNED:   "ALLOW_WITH_APPROVAL",
            _P_RESTRICTED:   "BLOCK",
            _P_SHOW_STATUS:  True, _P_SHOW_EXPL: True,
            _P_REASON_REQ:   True, _P_AUDIT: True,
        },
    },
    {
        "code": "MEDICAL",
        "name": "Medical / Pharmacy",
        "description": "Strict vendor control for regulated products. Only registered vendors allowed; deviations blocked.",
        "recommended_for": ["Pharmacy", "Medical Equipment", "Healthcare"],
        "values": {
            _P_VISIBILITY:   "ASSIGNED_ONLY",
            _P_CROSS_VENDOR: "BLOCK",
            _P_UNASSIGNED:   "BLOCK",
            _P_RESTRICTED:   "BLOCK",
            _P_SHOW_STATUS:  True, _P_SHOW_EXPL: True,
            _P_REASON_REQ:   True, _P_AUDIT: True,
        },
    },
    {
        "code": "ELECTRONICS",
        "name": "Electronics",
        "description": "Model-level vendor control. Approval for cross-brand; blocked for restricted.",
        "recommended_for": ["Electronics Store", "Consumer Electronics", "Gadgets"],
        "values": {
            _P_VISIBILITY:   "ASSIGNED_PLUS_ALL",
            _P_CROSS_VENDOR: "ALLOW_WITH_APPROVAL",
            _P_UNASSIGNED:   "ALLOW_WITH_APPROVAL",
            _P_RESTRICTED:   "BLOCK",
            _P_SHOW_STATUS:  True, _P_SHOW_EXPL: True,
            _P_REASON_REQ:   True, _P_AUDIT: True,
        },
    },
    {
        "code": "JEWELLERY",
        "name": "Jewellery",
        "description": "High-control purchasing. Only registered vendor products. Approval for any deviation.",
        "recommended_for": ["Jewellery Store", "Gold", "Precious Metals"],
        "values": {
            _P_VISIBILITY:   "ASSIGNED_PLUS_ALL",
            _P_CROSS_VENDOR: "ALLOW_WITH_APPROVAL",
            _P_UNASSIGNED:   "BLOCK",
            _P_RESTRICTED:   "BLOCK",
            _P_SHOW_STATUS:  True, _P_SHOW_EXPL: True,
            _P_REASON_REQ:   True, _P_AUDIT: True,
        },
    },
    {
        "code": "RESTAURANT",
        "name": "Restaurant / F&B",
        "description": "Flexible purchasing for food & beverage. All items visible; only restricted blocked.",
        "recommended_for": ["Restaurant", "Cafe", "Cloud Kitchen", "Food Service"],
        "values": {
            _P_VISIBILITY:   "ALL_ITEMS",
            _P_CROSS_VENDOR: "ALLOW",
            _P_UNASSIGNED:   "ALLOW",
            _P_RESTRICTED:   "BLOCK",
            _P_SHOW_STATUS:  False, _P_SHOW_EXPL: False,
            _P_REASON_REQ:   False, _P_AUDIT: True,
        },
    },
    {
        "code": "WHOLESALE",
        "name": "Wholesale / Distribution",
        "description": "Open purchasing with full audit. All products accessible; approval only for restricted.",
        "recommended_for": ["Wholesale", "Distributor", "C&F Agent"],
        "values": {
            _P_VISIBILITY:   "ALL_ITEMS",
            _P_CROSS_VENDOR: "ALLOW",
            _P_UNASSIGNED:   "ALLOW",
            _P_RESTRICTED:   "ALLOW_WITH_APPROVAL",
            _P_SHOW_STATUS:  True, _P_SHOW_EXPL: True,
            _P_REASON_REQ:   False, _P_AUDIT: True,
        },
    },
]


class POPolicyConfigService:
    """
    Business-language configuration layer for PO purchasing policy.

    Architecture (Execution Command Rule 4):
        BUSINESS TEMPLATE  ─→  Business names like "Footwear" or "Enterprise"
              ↓
        BUSINESS CONFIG    ─→  What products should buyers see? (human labels)
              ↓
        SYSTEM PARAMETERS  ─→  SMRITI.PURCHASE.ORDER.* canonical codes (internal only)
              ↓
        PO POLICY ENGINE   ─→  evaluateProductForVendor()

    Normal users see ONLY business configuration (Rules 5, 6).
    Technical canonical keys are shown only in Advanced mode (SYSADMIN).
    Template application requires compare → confirm → apply (Rule 18).
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
    # Read current policy
    # ─────────────────────────────────────────────────────────────────────────

    async def get_policy(self, include_canonical: bool = False) -> POPolicyConfigOut:
        vals = await self._load_all()
        result = POPolicyConfigOut(
            what_products_should_buyers_see=_VISIBILITY_LABELS.get(
                vals.get(_P_VISIBILITY, "ASSIGNED_PLUS_ALL"),
                vals.get(_P_VISIBILITY, "ASSIGNED_PLUS_ALL"),
            ),
            cross_vendor_product_policy=_POLICY_LABELS.get(
                vals.get(_P_CROSS_VENDOR, "ALLOW_WITH_APPROVAL"),
                vals.get(_P_CROSS_VENDOR, "ALLOW_WITH_APPROVAL"),
            ),
            unassigned_product_policy=_POLICY_LABELS.get(
                vals.get(_P_UNASSIGNED, "ALLOW_WITH_APPROVAL"),
                vals.get(_P_UNASSIGNED, "ALLOW_WITH_APPROVAL"),
            ),
            restricted_product_policy=_POLICY_LABELS.get(
                vals.get(_P_RESTRICTED, "BLOCK"),
                vals.get(_P_RESTRICTED, "BLOCK"),
            ),
            show_vendor_status_to_buyer=bool(vals.get(_P_SHOW_STATUS, True)),
            show_explanation_for_restrictions=bool(vals.get(_P_SHOW_EXPL, True)),
            require_approval_reason=bool(vals.get(_P_REASON_REQ, True)),
            audit_approval_decisions=bool(vals.get(_P_AUDIT, True)),
            canonical_params=vals if include_canonical else None,
        )
        return result

    def list_templates(self) -> List[POPolicyTemplateOut]:
        """Return all business templates for Guided/Custom mode."""
        return [self._template_to_out(t) for t in _TEMPLATES]

    async def preview_template(self, template_code: str) -> Dict[str, Any]:
        """
        Return a diff between the current configuration and a template's values.
        This is the data shown to the user in the compare→confirm step (Rule 18).
        """
        template = self._find_template(template_code)
        current = await self._load_all()
        diff = []
        for code, new_val in template["values"].items():
            old_val = current.get(code)
            if old_val != new_val:
                diff.append({
                    "parameter": code,
                    "current_value": old_val,
                    "current_label": self._label_for(code, old_val),
                    "proposed_value": new_val,
                    "proposed_label": self._label_for(code, new_val),
                })
        return {
            "template_code": template_code,
            "template_name": template["name"],
            "changes": diff,
            "no_changes": len(diff) == 0,
        }

    async def apply_policy(self, req: POPolicyApplyRequest) -> POPolicyConfigOut:
        """
        Apply a template or custom values to SystemParameters.
        MUST be called with confirmed=True — enforced at the API layer (Rule 18).
        Does NOT overwrite existing company params without explicit instruction.
        """
        if req.template_code:
            template = self._find_template(req.template_code)
            target_values = dict(template["values"])
            # Apply custom_values overrides on top of template
            if req.custom_values:
                target_values.update(req.custom_values)
        elif req.custom_values:
            target_values = dict(req.custom_values)
        else:
            raise ValueError("Either template_code or custom_values must be provided.")

        # Apply each parameter via SystemParameterService upsert
        for canonical_code, value in target_values.items():
            await self._upsert_param(canonical_code, value, req.applied_by)

        await self.db.commit()
        return await self.get_policy()

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    async def _load_all(self) -> Dict[str, Any]:
        """Load all 8 PO policy parameters, resolved via 4-tier hierarchy."""
        result: Dict[str, Any] = {}
        for code in [
            _P_VISIBILITY, _P_CROSS_VENDOR, _P_UNASSIGNED, _P_RESTRICTED,
            _P_SHOW_STATUS, _P_SHOW_EXPL, _P_REASON_REQ, _P_AUDIT,
        ]:
            p = await SystemParameterService.resolve_parameter(
                db=self.db,
                param_code=code,
                company_id=self._company_id,
                branch_id=self._branch_id,
            )
            if p is not None:
                result[code] = p.get_value()
            else:
                # Return raw canonical code value as string (or None)
                result[code] = None
        return result

    async def _upsert_param(
        self, canonical_code: str, value: Any, applied_by: str
    ) -> None:
        """
        Upsert a SystemParameter for the current company.
        If a company-level record exists, update it.
        If only global exists, create a company-level override (never modify global).
        """
        from ..models.system_parameter import SystemParameter
        from sqlalchemy import select, or_

        # Find existing company-level record
        stmt = select(SystemParameter).where(
            SystemParameter.canonical_code == canonical_code,
            SystemParameter.company_id == self._company_id,
            SystemParameter.terminal_id == "COMMON",
        )
        existing = (await self.db.execute(stmt)).scalars().first()

        if existing:
            if isinstance(value, bool):
                existing.bool_value = value
                existing.data_type = "Boolean"
            else:
                existing.text_value = str(value)
                existing.data_type = "Text"
            existing.modified_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
            existing.updated_by = applied_by
        else:
            # Find the GLOBAL record to copy metadata from
            global_stmt = select(SystemParameter).where(
                SystemParameter.canonical_code == canonical_code,
                SystemParameter.company_id.is_(None),
            )
            global_param = (await self.db.execute(global_stmt)).scalars().first()

            param_code = global_param.param_code if global_param else f"SMRITI_PO_{canonical_code.split('.')[-1]}"
            rec_id = f"SP-{self._company_id or 'GBL'}-{param_code}"[:50]
            new_param = SystemParameter(
                id=rec_id,
                company_id=self._company_id,
                branch_id=None,
                param_code=param_code,
                canonical_code=canonical_code,
                description=global_param.description if global_param else canonical_code,
                category="07. Purchase Order",
                category_name="Purchase Order",
                data_type="Boolean" if isinstance(value, bool) else "Text",
                bool_value=value if isinstance(value, bool) else None,
                text_value=str(value) if not isinstance(value, bool) else None,
                mutability="Variable",
                profile_type="COMMON",
                scope_level="COMPANY",
                terminal_id="COMMON",
                is_locked=False,
                created_by=applied_by,
            )
            self.db.add(new_param)

    def _find_template(self, code: str) -> Dict[str, Any]:
        for t in _TEMPLATES:
            if t["code"] == code:
                return t
        raise __import__("fastapi").HTTPException(
            status_code=404,
            detail=f"Business template '{code}' was not found. Available templates: {[t['code'] for t in _TEMPLATES]}",
        )

    def _template_to_out(self, t: Dict[str, Any]) -> POPolicyTemplateOut:
        vals = t["values"]
        return POPolicyTemplateOut(
            template_code=t["code"],
            template_name=t["name"],
            description=t["description"],
            recommended_for=t["recommended_for"],
            preview=POPolicyConfigOut(
                what_products_should_buyers_see=_VISIBILITY_LABELS.get(
                    vals.get(_P_VISIBILITY, "ASSIGNED_PLUS_ALL"), ""
                ),
                cross_vendor_product_policy=_POLICY_LABELS.get(
                    vals.get(_P_CROSS_VENDOR, ""), ""
                ),
                unassigned_product_policy=_POLICY_LABELS.get(
                    vals.get(_P_UNASSIGNED, ""), ""
                ),
                restricted_product_policy=_POLICY_LABELS.get(
                    vals.get(_P_RESTRICTED, ""), ""
                ),
                show_vendor_status_to_buyer=bool(vals.get(_P_SHOW_STATUS, True)),
                show_explanation_for_restrictions=bool(vals.get(_P_SHOW_EXPL, True)),
                require_approval_reason=bool(vals.get(_P_REASON_REQ, True)),
                audit_approval_decisions=bool(vals.get(_P_AUDIT, True)),
            ),
        )

    @staticmethod
    def _label_for(code: str, value: Any) -> str:
        if code == _P_VISIBILITY:
            return _VISIBILITY_LABELS.get(str(value), str(value))
        if code in (_P_CROSS_VENDOR, _P_UNASSIGNED, _P_RESTRICTED):
            return _POLICY_LABELS.get(str(value), str(value))
        if isinstance(value, bool):
            return "Yes" if value else "No"
        return str(value) if value is not None else "Not configured"
