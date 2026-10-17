"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.91.0
Created      : 2026-10-17
Modified     : 2026-10-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Billing Profile & Configuration Governance Engine
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.company_policy import CompanyPolicySetting

VALID_PROFILES = {"B2C_ONLY", "B2B_ONLY"}

B2C_DEFAULTS: Dict[str, Any] = {
    "billing_profile": "B2C_ONLY",
    "shift_management": "ENABLED",
    "customer_po_reference": "HIDDEN",
    "customer_selection_required": False,
    "customer_gstin_required": False,
    "billing_delivery_address": "DISABLED",
    "credit_terms_and_due_date": "DISABLED",
    "bulk_add_enabled": "ENABLED",
    "default_scan_mode": "AUTO_ADD",
    "repeat_barcode_policy": "INCREASE_QUANTITY",
    "post_scan_focus": "scan_field",
    "scan_beep": "ENABLED",
    "default_invoice_format": "RETAIL_RECEIPT",
    "salesperson_attribution": "ENABLED",
    "b2b_packing_first_workflow": "DISABLED",
    "packing_slip_qty_default": "MANUAL_ZERO",
    "invoice_qty_default": "MANUAL_ZERO",
    "allow_partial_packing": "DISABLED",
    "allow_partial_invoicing": "DISABLED",
    "allow_editing_prefilled_qty": "DISABLED",
}

B2B_DEFAULTS: Dict[str, Any] = {
    "billing_profile": "B2B_ONLY",
    "shift_management": "DISABLED",
    "customer_po_reference": "OPTIONAL",
    "customer_selection_required": True,
    "customer_gstin_required": True,
    "billing_delivery_address": "ENABLED",
    "credit_terms_and_due_date": "ENABLED",
    "bulk_add_enabled": "ENABLED",
    "default_scan_mode": "AUTO_ADD",
    "repeat_barcode_policy": "INCREASE_QUANTITY",
    "post_scan_focus": "scan_field",
    "scan_beep": "ENABLED",
    "default_invoice_format": "B2B_TAX_INVOICE",
    "salesperson_attribution": "OPTIONAL",
    "b2b_packing_first_workflow": "ENABLED",
    "packing_slip_qty_default": "REMAINING_UNPACKED_QTY",
    "invoice_qty_default": "PACKED_UNBILLED_QTY",
    "allow_partial_packing": "ENABLED",
    "allow_partial_invoicing": "ENABLED",
    "allow_editing_prefilled_qty": "AUTHORIZED_ONLY",
}


class BillingProfileService:
    """
    Authoritative Company-Level Billing Profile & Feature Configuration Service.
    Enforces the two canonical billing profiles (B2C_ONLY and B2B_ONLY) and resolves
    configuration using the 4-tier precedence hierarchy:
      1. Company Policy Overrides
      2. Selected Billing Profile Defaults
      3. Store Configuration
      4. User Preferences
    """

    @classmethod
    async def get_effective_profile(
        cls,
        session: AsyncSession,
        company_id: str,
    ) -> Dict[str, Any]:
        """
        Retrieves company billing profile, overrides, effective configuration, and audit trail.
        """
        stmt = select(CompanyPolicySetting).where(
            CompanyPolicySetting.company_id == company_id,
            CompanyPolicySetting.key.in_(["billing_profile", "billing_configuration", "billing_profile_history"]),
        )
        res = await session.execute(stmt)
        settings_map: Dict[str, str] = {s.key: s.value for s in res.scalars().all()}

        profile_val = settings_map.get("billing_profile")
        if not profile_val or profile_val not in VALID_PROFILES:
            return {
                "configured": False,
                "billing_profile": None,
                "effective_configuration": None,
                "custom_overrides": {},
                "history": [],
            }

        custom_overrides: Dict[str, Any] = {}
        if "billing_configuration" in settings_map:
            try:
                custom_overrides = json.loads(settings_map["billing_configuration"])
            except Exception:
                custom_overrides = {}

        history: List[Dict[str, Any]] = []
        if "billing_profile_history" in settings_map:
            try:
                history = json.loads(settings_map["billing_profile_history"])
            except Exception:
                history = []

        base_defaults = B2C_DEFAULTS.copy() if profile_val == "B2C_ONLY" else B2B_DEFAULTS.copy()
        effective_config = base_defaults.copy()

        # Apply Company Policy Overrides (Tier 1 Precedence)
        for k, v in custom_overrides.items():
            if k in effective_config and v is not None:
                effective_config[k] = v

        return {
            "configured": True,
            "billing_profile": profile_val,
            "effective_configuration": effective_config,
            "custom_overrides": custom_overrides,
            "history": history,
        }

    @classmethod
    async def setup_initial_profile(
        cls,
        session: AsyncSession,
        company_id: str,
        profile: str,
        updated_by: str = "system",
    ) -> Dict[str, Any]:
        """
        Performs initial profile activation. Rejects duplicate setups or invalid profiles.
        """
        profile_norm = profile.strip().upper()
        if profile_norm not in VALID_PROFILES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SMRITI-CONF-002: Invalid billing profile '{profile}'. SMRITI strictly supports 'B2C_ONLY' and 'B2B_ONLY'. Combined profiles are prohibited.",
            )

        existing = await session.execute(
            select(CompanyPolicySetting).where(
                CompanyPolicySetting.company_id == company_id,
                CompanyPolicySetting.key == "billing_profile",
            )
        )
        if existing.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SMRITI-CONF-001: Billing profile has already been established for this company. Use the authorized profile switch workflow to change profiles.",
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        initial_history = [
            {
                "timestamp": now_iso,
                "changed_by": updated_by,
                "old_profile": None,
                "new_profile": profile_norm,
                "reason": "Initial company billing profile setup",
            }
        ]

        session.add(
            CompanyPolicySetting(
                company_id=company_id,
                key="billing_profile",
                value=profile_norm,
                updated_by=updated_by,
            )
        )
        session.add(
            CompanyPolicySetting(
                company_id=company_id,
                key="billing_profile_history",
                value=json.dumps(initial_history),
                updated_by=updated_by,
            )
        )
        await session.commit()
        return await cls.get_effective_profile(session, company_id)

    @classmethod
    async def switch_profile(
        cls,
        session: AsyncSession,
        company_id: str,
        new_profile: str,
        reason: str,
        updated_by: str = "system",
    ) -> Dict[str, Any]:
        """
        Authorized migration between B2C_ONLY and B2B_ONLY.
        Preserves all historical records, invoices, stock movements, and shifts.
        """
        profile_norm = new_profile.strip().upper()
        if profile_norm not in VALID_PROFILES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SMRITI-CONF-002: Invalid billing profile '{new_profile}'. SMRITI strictly supports 'B2C_ONLY' and 'B2B_ONLY'.",
            )

        if not reason or not reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SMRITI-CONF-003: An audit justification reason is required to switch the company billing profile.",
            )

        res_prof = await session.execute(
            select(CompanyPolicySetting).where(
                CompanyPolicySetting.company_id == company_id,
                CompanyPolicySetting.key == "billing_profile",
            )
        )
        prof_record = res_prof.scalars().first()
        old_profile = prof_record.value if prof_record else None

        if old_profile == profile_norm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Company is already operating under profile '{profile_norm}'.",
            )

        res_hist = await session.execute(
            select(CompanyPolicySetting).where(
                CompanyPolicySetting.company_id == company_id,
                CompanyPolicySetting.key == "billing_profile_history",
            )
        )
        hist_record = res_hist.scalars().first()
        history: List[Dict[str, Any]] = []
        if hist_record:
            try:
                history = json.loads(hist_record.value)
            except Exception:
                history = []

        now_iso = datetime.now(timezone.utc).isoformat()
        history.append({
            "timestamp": now_iso,
            "changed_by": updated_by,
            "old_profile": old_profile,
            "new_profile": profile_norm,
            "reason": reason.strip(),
        })

        if prof_record:
            prof_record.value = profile_norm
            prof_record.updated_by = updated_by
            prof_record.updated_at = datetime.now(timezone.utc)
        else:
            session.add(
                CompanyPolicySetting(
                    company_id=company_id,
                    key="billing_profile",
                    value=profile_norm,
                    updated_by=updated_by,
                )
            )

        if hist_record:
            hist_record.value = json.dumps(history)
            hist_record.updated_by = updated_by
            hist_record.updated_at = datetime.now(timezone.utc)
        else:
            session.add(
                CompanyPolicySetting(
                    company_id=company_id,
                    key="billing_profile_history",
                    value=json.dumps(history),
                    updated_by=updated_by,
                )
            )

        await session.commit()
        return await cls.get_effective_profile(session, company_id)

    @classmethod
    async def update_configuration_overrides(
        cls,
        session: AsyncSession,
        company_id: str,
        overrides: Dict[str, Any],
        updated_by: str = "system",
    ) -> Dict[str, Any]:
        """
        Allows authorized administrators to customize permitted features without modifying code.
        """
        # Validate allowed override keys and explicit states
        ALLOWED_EXPLICIT_STATES = {
            "shift_management": {"ENABLED", "DISABLED"},
            "customer_po_reference": {"HIDDEN", "OPTIONAL", "REQUIRED"},
            "bulk_add_enabled": {"ENABLED", "DISABLED"},
            "default_scan_mode": {"AUTO_ADD", "EDIT_THEN_ADD", "CONFIRM_PRODUCT"},
            "repeat_barcode_policy": {"INCREASE_QUANTITY", "NEW_LINE", "ASK_USER"},
            "scan_beep": {"ENABLED", "DISABLED"},
            "salesperson_attribution": {"ENABLED", "DISABLED", "OPTIONAL"},
            "b2b_packing_first_workflow": {"ENABLED", "DISABLED"},
            "packing_slip_qty_default": {"ORDERED_QTY", "REMAINING_UNPACKED_QTY", "MANUAL_ZERO"},
            "invoice_qty_default": {"PACKED_UNBILLED_QTY", "ORDERED_QTY_IF_ELIGIBLE", "MANUAL_ZERO"},
            "allow_partial_packing": {"ENABLED", "DISABLED"},
            "allow_partial_invoicing": {"ENABLED", "DISABLED"},
            "allow_editing_prefilled_qty": {"AUTHORIZED_ONLY", "ENABLED", "DISABLED"},
        }

        cleaned_overrides: Dict[str, Any] = {}
        for k, v in overrides.items():
            if k in ALLOWED_EXPLICIT_STATES:
                val_upper = str(v).strip().upper()
                if val_upper not in ALLOWED_EXPLICIT_STATES[k]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid value '{v}' for '{k}'. Permitted states: {sorted(list(ALLOWED_EXPLICIT_STATES[k]))}.",
                    )
                cleaned_overrides[k] = val_upper
            elif k == "post_scan_focus":
                val_clean = str(v).strip().lower()
                if val_clean not in {"scan_field", "qty", "rate", "discount", "salesperson"}:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid value '{v}' for post_scan_focus.",
                    )
                cleaned_overrides[k] = val_clean

        res_conf = await session.execute(
            select(CompanyPolicySetting).where(
                CompanyPolicySetting.company_id == company_id,
                CompanyPolicySetting.key == "billing_configuration",
            )
        )
        conf_record = res_conf.scalars().first()

        existing_overrides: Dict[str, Any] = {}
        if conf_record:
            try:
                existing_overrides = json.loads(conf_record.value)
            except Exception:
                existing_overrides = {}

        existing_overrides.update(cleaned_overrides)

        if conf_record:
            conf_record.value = json.dumps(existing_overrides)
            conf_record.updated_by = updated_by
            conf_record.updated_at = datetime.now(timezone.utc)
        else:
            session.add(
                CompanyPolicySetting(
                    company_id=company_id,
                    key="billing_configuration",
                    value=json.dumps(existing_overrides),
                    updated_by=updated_by,
                )
            )

        await session.commit()
        return await cls.get_effective_profile(session, company_id)
