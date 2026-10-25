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
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.company_policy import CompanyPolicySetting
from ..models.governed_logic import PolicyDefinition

VALID_PROFILES = {"B2C_ONLY", "B2B_ONLY"}

B2C_DEFAULTS: Dict[str, Any] = {
    "billing_profile": "B2C_ONLY",
    "default_sales_channel": "POS_RETAIL",
    "allowed_sales_channels": ["POS_RETAIL", "ECOMMERCE"],
    "allowed_source_types": ["DIRECT"],
    "allowed_bill_types": ["Product", "Service"],
    "default_bill_type": "Product",
    "allowed_transactions": ["CASH"],
    "default_transaction": "CASH",
    "default_source_type": "DIRECT",
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
    "default_sales_channel": "B2B_WHOLESALE",
    "allowed_sales_channels": ["MODERN_TRADE", "GENERAL_TRADE", "B2B_WHOLESALE"],
    "allowed_source_types": ["DIRECT", "CUSTOMER_PO", "SALES_ORDER", "PACKING_SLIP_CONSOLIDATED"],
    "allowed_bill_types": ["Product", "Service"],
    "default_bill_type": "Product",
    "allowed_transactions": ["CASH", "CREDIT"],
    "default_transaction": "CASH",
    "default_source_type": "DIRECT",
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
        branch_id: Optional[str] = None,
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
            except (TypeError, json.JSONDecodeError) as error:
                raise HTTPException(
                    status_code=409,
                    detail="Stored billing configuration is invalid; an administrator must correct the policy.",
                ) from error
            if not isinstance(custom_overrides, dict):
                raise HTTPException(
                    status_code=409,
                    detail="Stored billing configuration must be an object; an administrator must correct the policy.",
                )

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
            if k == "branch_overrides":
                continue
            if k in effective_config and v is not None:
                effective_config[k] = v
        if branch_id:
            branch_overrides = custom_overrides.get("branch_overrides", {})
            branch_config = branch_overrides.get(branch_id, {}) if isinstance(branch_overrides, dict) else {}
            if isinstance(branch_config, dict):
                effective_config.update({
                    key: value for key, value in branch_config.items()
                    if key in effective_config and value is not None
                })
        if (
            effective_config.get("default_sales_channel")
            and effective_config["default_sales_channel"] not in effective_config.get("allowed_sales_channels", [])
        ):
            raise HTTPException(status_code=409, detail="Billing policy default sales channel is not permitted.")
        if (
            effective_config.get("default_source_type")
            and effective_config["default_source_type"] not in effective_config.get("allowed_source_types", [])
        ):
            raise HTTPException(status_code=409, detail="Billing policy default source is not permitted.")
        if (
            effective_config.get("default_bill_type")
            and effective_config["default_bill_type"] not in effective_config.get("allowed_bill_types", [])
        ):
            raise HTTPException(status_code=409, detail="Billing policy default bill type is not permitted.")

        return {
            "configured": True,
            "billing_profile": profile_val,
            "effective_configuration": effective_config,
            "custom_overrides": custom_overrides,
            "history": history,
        }

    @classmethod
    async def resolve_transaction_configuration(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        profile = await cls.get_effective_profile(session, company_id, branch_id)
        if profile["effective_configuration"] is not None:
            return profile["effective_configuration"]

        defaults: Dict[str, Any] = {
            "default_sales_channel": None,
            "allowed_sales_channels": ["MODERN_TRADE", "GENERAL_TRADE", "B2B_WHOLESALE", "POS_RETAIL", "ECOMMERCE"],
            "allowed_source_types": ["DIRECT", "CUSTOMER_PO", "SALES_ORDER", "PACKING_SLIP_CONSOLIDATED"],
            "allowed_bill_types": ["Product", "Service"],
            "allowed_transactions": ["CASH", "CREDIT"],
            "default_transaction": "CASH",
            "default_source_type": "DIRECT",
            "default_bill_type": "Product",
            "customer_po_reference": "OPTIONAL",
        }
        result = await session.execute(
            select(CompanyPolicySetting).where(
                CompanyPolicySetting.company_id == company_id,
                CompanyPolicySetting.key == "billing_configuration",
            )
        )
        record = result.scalars().first()
        if record:
            try:
                overrides = json.loads(record.value)
            except (TypeError, json.JSONDecodeError) as error:
                raise HTTPException(
                    status_code=409,
                    detail="Stored billing configuration is invalid JSON; an administrator must correct the policy.",
                ) from error
            for key, value in overrides.items():
                if key in defaults and value is not None:
                    defaults[key] = value
            branch_overrides = overrides.get("branch_overrides", {})
            branch_settings = branch_overrides.get(branch_id, {}) if branch_id and isinstance(branch_overrides, dict) else {}
            if isinstance(branch_settings, dict):
                for key, value in branch_settings.items():
                    if key in defaults and value is not None:
                        defaults[key] = value

        if defaults["default_sales_channel"] and defaults["default_sales_channel"] not in defaults["allowed_sales_channels"]:
            raise HTTPException(status_code=409, detail="Billing policy default sales channel is not permitted.")
        if defaults["default_source_type"] not in defaults["allowed_source_types"]:
            raise HTTPException(status_code=409, detail="Billing policy default source is not permitted.")
        if defaults["default_bill_type"] not in defaults["allowed_bill_types"]:
            raise HTTPException(status_code=409, detail="Billing policy default bill type is not permitted.")
        return defaults

    @staticmethod
    def resolve_customer_payment_options(
        configuration: Dict[str, Any],
        customer: Any = None,
        group: Any = None,
        relationship: Any = None,
        can_override_credit: bool = False,
        credit_exposure: Optional[Decimal] = None,
    ) -> Dict[str, Any]:
        """Resolve permitted CASH/CREDIT modes from policy and customer eligibility."""
        company_modes = {
            str(mode).strip().upper()
            for mode in configuration.get("allowed_transactions", [])
        }
        if not customer:
            modes = ["CASH"] if "CASH" in company_modes else []
            default_transaction = str(configuration.get("default_transaction") or "").strip().upper()
            default_permitted = default_transaction in modes
            return {
                "allowed_transactions": modes,
                "default_transaction": default_transaction,
                "default_transaction_permitted": default_permitted,
                "configuration_warning": (
                    "Company and branch policy prohibit cash and credit billing."
                    if not modes
                    else (
                        f"The configured {default_transaction.lower()} default is not currently permitted."
                        if default_transaction and not default_permitted
                        else None
                    )
                ),
                "credit_limit": 0.0,
                "outstanding": 0.0,
                "available_credit": 0.0,
                "unlimited_credit": False,
                "credit_hold": False,
                "credit_override_required": False,
            }

        customer_policy = getattr(customer, "policy", None)
        credit_hold = bool(
            (relationship and getattr(relationship, "credit_hold", False))
            or (group and getattr(group, "credit_hold", False))
        )
        cash_allowed = (
            "CASH" in company_modes
            and getattr(customer_policy, "allow_cash_bill", None) is not False
        )
        credit_allowed = (
            "CREDIT" in company_modes
            and bool(group and getattr(group, "can_purchase_on_credit", False))
            and getattr(customer_policy, "allow_credit_invoice", None) is not False
            and not credit_hold
        )

        relation_limit_value = getattr(relationship, "credit_limit", None)
        group_limit_value = getattr(group, "credit_limit", None)
        relation_has_limit = relation_limit_value is not None and Decimal(str(relation_limit_value)) > 0
        if relation_has_limit:
            credit_limit = Decimal(str(relation_limit_value))
        else:
            credit_limit = Decimal(str(group_limit_value or 0))
        unlimited_credit = bool(
            group
            and getattr(group, "unlimited_credit", False)
            and not relation_has_limit
        )
        outstanding = Decimal(str(getattr(customer, "outstanding", None) or 0))
        available_credit = None if unlimited_credit else max(Decimal("0"), credit_limit - outstanding)
        credit_override_required = bool(
            credit_allowed
            and credit_exposure is not None
            and not unlimited_credit
            and Decimal(str(credit_exposure)) > (available_credit or Decimal("0"))
        )
        if credit_allowed and not unlimited_credit and credit_exposure is None and (available_credit or 0) <= 0:
            credit_allowed = bool(can_override_credit)
        elif credit_override_required:
            credit_allowed = bool(can_override_credit)

        modes = [
            mode for mode, allowed in (("CASH", cash_allowed), ("CREDIT", credit_allowed))
            if allowed
        ]
        customer_payment_category = getattr(customer_policy, "payment_category", None)
        raw_default = customer_payment_category or configuration.get("default_transaction")
        normalized_default = str(raw_default or "").strip().upper().replace("-", "_").replace(" ", "_")
        normalized_customer_category = str(customer_payment_category or "").strip().upper().replace("-", "_").replace(" ", "_")
        invalid_customer_category = bool(
            normalized_customer_category
            and normalized_customer_category not in {
                "CASH", "CASH_ON_DELIVERY", "COD", "CARD", "DEBIT_CARD",
                "UPI", "NETBANKING", "CHEQUE", "BANK_TRANSFER",
                "CREDIT", "ON_ACCOUNT", "CREDIT_TERMS",
            }
        )
        if normalized_default in {"ON_ACCOUNT", "CREDIT_TERMS"}:
            normalized_default = "CREDIT"
        elif normalized_default in {
            "CASH", "CASH_ON_DELIVERY", "COD", "CARD", "DEBIT_CARD",
            "UPI", "NETBANKING", "CHEQUE", "BANK_TRANSFER",
        }:
            normalized_default = "CASH"
        if normalized_default not in {"CASH", "CREDIT"}:
            normalized_default = ""

        default_permitted = normalized_default in modes
        warning = None
        if not modes:
            warning = "Customer eligibility and company/branch policy prohibit both cash and credit billing."
        elif invalid_customer_category:
            warning = "The customer's payment category is unsupported. Correct the profile before billing."
        elif normalized_default and not default_permitted:
            warning = (
                f"The configured {normalized_default.lower()} default is not currently permitted. "
                "An authorized user must select an eligible mode or correct the profile."
            )
        elif not normalized_default:
            warning = "No valid billing mode default is configured. An authorized user must select an eligible mode."
        elif credit_override_required and credit_allowed:
            warning = "Credit exceeds available credit; an authorized override and reason are required."

        return {
            "allowed_transactions": modes,
            "default_transaction": normalized_default,
            "default_transaction_permitted": default_permitted,
            "configuration_warning": warning,
            "credit_limit": float(credit_limit),
            "outstanding": float(outstanding),
            "available_credit": None if unlimited_credit else float(available_credit or 0),
            "unlimited_credit": unlimited_credit,
            "credit_hold": credit_hold,
            "credit_override_required": credit_override_required,
        }

    @staticmethod
    async def credit_limit_override_enabled(control_session: AsyncSession) -> bool:
        result = await control_session.execute(
            select(PolicyDefinition)
            .where(
                PolicyDefinition.code == "POLICY_CREDIT_MANAGEMENT",
                PolicyDefinition.is_active == True,
                PolicyDefinition.status == "ACTIVE",
            )
            .order_by(PolicyDefinition.version.desc())
        )
        policy = result.scalars().first()
        return bool(
            policy
            and isinstance(policy.parameters, dict)
            and policy.parameters.get("allow_manager_override_credit_limit") is True
        )

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
        branch_id: Optional[str] = None,
        policy_scope: str = "COMPANY",
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
            "default_sales_channel": {
                "MODERN_TRADE", "GENERAL_TRADE", "B2B_WHOLESALE", "POS_RETAIL", "ECOMMERCE",
            },
            "default_source_type": {"DIRECT", "CUSTOMER_PO", "SALES_ORDER"},
            "default_bill_type": {"PRODUCT", "SERVICE"},
            "default_transaction": {"CASH", "CREDIT"},
        }
        ALLOWED_LIST_VALUES = {
            "allowed_sales_channels": {
                "MODERN_TRADE", "GENERAL_TRADE", "B2B_WHOLESALE", "POS_RETAIL", "ECOMMERCE",
            },
            "allowed_source_types": {"DIRECT", "CUSTOMER_PO", "SALES_ORDER", "PACKING_SLIP_CONSOLIDATED"},
            "allowed_bill_types": {"Product", "Service"},
            "allowed_transactions": {"CASH", "CREDIT"},
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
                cleaned_overrides[k] = val_upper.title() if k == "default_bill_type" else val_upper
            elif k == "post_scan_focus":
                val_clean = str(v).strip().lower()
                if val_clean not in {"scan_field", "qty", "rate", "discount", "salesperson"}:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid value '{v}' for post_scan_focus.",
                    )
                cleaned_overrides[k] = val_clean
            elif k in ALLOWED_LIST_VALUES:
                if not isinstance(v, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"'{k}' must be a list.",
                    )
                normalized = [str(value).strip().upper() if k != "allowed_bill_types" else str(value).strip().title() for value in v]
                if (not normalized and k != "allowed_transactions") or any(value not in ALLOWED_LIST_VALUES[k] for value in normalized):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid or empty values for '{k}'.",
                    )
                if len(normalized) != len(set(normalized)):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Duplicate values are not allowed for '{k}'.",
                    )
                cleaned_overrides[k] = normalized

        scope = str(policy_scope or "COMPANY").strip().upper()
        if scope not in {"COMPANY", "BRANCH"}:
            raise HTTPException(status_code=400, detail="policy_scope must be COMPANY or BRANCH.")
        if scope == "BRANCH" and not branch_id:
            raise HTTPException(status_code=400, detail="A branch context is required for branch policy updates.")

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

        if scope == "BRANCH":
            branch_overrides = existing_overrides.setdefault("branch_overrides", {})
            if not isinstance(branch_overrides, dict):
                branch_overrides = {}
                existing_overrides["branch_overrides"] = branch_overrides
            branch_settings = branch_overrides.setdefault(branch_id, {})
            if not isinstance(branch_settings, dict):
                branch_settings = {}
                branch_overrides[branch_id] = branch_settings
            branch_settings.update(cleaned_overrides)
        else:
            existing_overrides.update(cleaned_overrides)
            if "branch_overrides" not in existing_overrides and branch_id:
                pass

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

        await cls.resolve_transaction_configuration(
            session,
            company_id,
            branch_id if scope == "BRANCH" else None,
        )
        await session.commit()
        return await cls.get_effective_profile(
            session,
            company_id,
            branch_id if scope == "BRANCH" else None,
        )
