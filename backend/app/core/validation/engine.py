"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.2.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
import time
from typing import Any, Dict, List, Optional
from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from .schemas import (
    CasingRule,
    FieldValidationConfig,
    ConditionalRuleConfig,
    ValidationMode,
    ValidationPolicy,
    ValidationResult,
)
from .rules import RuleEvaluator
from ...models.master_lookup import MasterType, MasterValue


class ValidationPolicyCache:
    """In-memory cache for ValidationPolicy definitions to guarantee low latency."""
    def __init__(self, ttl_seconds: int = 300):
        self._cache: Dict[str, ValidationPolicy] = {}
        self._timestamps: Dict[str, float] = {}
        self.ttl = ttl_seconds

    def get(self, key: str) -> Optional[ValidationPolicy]:
        if key in self._cache:
            if time.time() - self._timestamps[key] < self.ttl:
                return self._cache[key]
            else:
                del self._cache[key]
                del self._timestamps[key]
        return None

    def set(self, key: str, policy: ValidationPolicy):
        self._cache[key] = policy
        self._timestamps[key] = time.time()

    def invalidate(self, key: Optional[str] = None):
        if key:
            self._cache.pop(key, None)
            self._timestamps.pop(key, None)
        else:
            self._cache.clear()
            self._timestamps.clear()


# Global Policy Cache instance
_POLICY_CACHE = ValidationPolicyCache()


class PlatformValidationEngine:
    """
    SMRITI Universal Platform Validation Engine (PVE v5.2.0).
    Decoupled, policy-driven validation engine for Product, Customer, Supplier, and Transaction masters.
    """

    def __init__(self, cache: Optional[ValidationPolicyCache] = None):
        self.cache = cache or _POLICY_CACHE

    def invalidate_policy_cache(self, entity_type: Optional[str] = None, tenant_id: Optional[str] = None):
        if entity_type:
            key = f"{entity_type}:{tenant_id or 'default'}"
            self.cache.invalidate(key)
        else:
            self.cache.invalidate()

    async def get_effective_policy(
        self,
        db: AsyncSession,
        entity_type: str,
        tenant_id: Optional[str] = None
    ) -> ValidationPolicy:
        cache_key = f"{entity_type}:{tenant_id or 'default'}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        # Default fallback configuration for Product Master
        if entity_type == "product":
            policy = ValidationPolicy(
                entity_type="product",
                tenant_id=tenant_id,
                fields={
                    "color": FieldValidationConfig(
                        mandatory=False,
                        mode=ValidationMode.STRICT,
                        master_type="product_color",
                        casing=CasingRule.TITLE
                    ),
                    "size": FieldValidationConfig(
                        mandatory=False,
                        mode=ValidationMode.STRICT,
                        master_type="product_size",
                        casing=CasingRule.UPPER
                    ),
                    "brand": FieldValidationConfig(
                        mandatory=False,
                        mode=ValidationMode.STRICT,
                        master_type="product_brand",
                        casing=CasingRule.TITLE
                    ),
                    "category": FieldValidationConfig(
                        mandatory=True,
                        mode=ValidationMode.STRICT,
                        master_type="product_category",
                        casing=CasingRule.TITLE
                    ),
                },
                conditional_rules=[
                    ConditionalRuleConfig(
                        id="footwear_requirements",
                        priority=100,
                        when={"category": "Footwear"},
                        require=["size", "color", "brand"]
                    ),
                    ConditionalRuleConfig(
                        id="service_item_rules",
                        priority=200,
                        when={"item_type": "Service"},
                        disable=["stock", "weight_grams"],
                        set_mode={"color": ValidationMode.NONE, "size": ValidationMode.NONE}
                    )
                ]
            )
        else:
            policy = ValidationPolicy(entity_type=entity_type, tenant_id=tenant_id)

        self.cache.set(cache_key, policy)
        return policy

    @staticmethod
    def _apply_casing(val: str, casing: CasingRule) -> str:
        if not val or not val.strip():
            return val
        s = val.strip()
        if casing == CasingRule.UPPER:
            return s.upper()
        elif casing == CasingRule.LOWER:
            return s.lower()
        elif casing == CasingRule.TITLE:
            return s.title()
        return s

    async def validate_entity(
        self,
        db: AsyncSession,
        entity_type: str,
        data: Dict[str, Any],
        tenant_id: Optional[str] = None,
        user_role: Optional[str] = "MANAGER"
    ) -> ValidationResult:
        policy = await self.get_effective_policy(db, entity_type, tenant_id)
        data_copy = dict(data)

        # 1. Evaluate Conditional Cross-Field Rules by Priority
        req_fields, dis_fields, mode_overrides, applied_rules = RuleEvaluator.evaluate_conditional_rules(
            policy.conditional_rules, data_copy
        )

        warnings: List[Dict[str, Any]] = []
        auto_created: List[Dict[str, Any]] = []

        # 2. Iterate through defined fields
        for field_name, field_cfg in policy.fields.items():
            raw_val = data_copy.get(field_name)
            str_val = str(raw_val).strip() if raw_val is not None and str(raw_val).strip() else None

            # Check if field is disabled by conditional rule
            if field_name in dis_fields:
                if str_val is not None:
                    warnings.append({
                        "field": field_name,
                        "warning": f"Field '{field_name}' is disabled by rule priority resolution and will be ignored.",
                        "policy_id": f"{entity_type}.disabled.{field_name}"
                    })
                    data_copy[field_name] = None
                continue

            # Effective mandatory flag
            is_mandatory = field_cfg.mandatory or (field_name in req_fields)
            if is_mandatory and not str_val:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "title": f"Mandatory Field Missing",
                        "explanation": f"Field '{field_name}' is mandatory for {entity_type}.",
                        "suggested_action": f"Please provide a valid {field_name} value.",
                        "reference_id": "SMRITI-VAL-010",
                        "policy_id": f"{entity_type}.{field_name}.mandatory",
                        "field": field_name,
                    }
                )

            if not str_val:
                data_copy[field_name] = None
                continue

            # Apply Casing Normalization
            normalized_val = self._apply_casing(str_val, field_cfg.casing)

            # Effective Validation Mode
            eff_mode = mode_overrides.get(field_name, field_cfg.mode)
            if eff_mode == ValidationMode.NONE:
                data_copy[field_name] = normalized_val
                continue

            # If field is mapped to a Master Lookup type
            if field_cfg.master_type:
                mt_res = await db.execute(
                    select(MasterType).where(MasterType.code == field_cfg.master_type)
                )
                mt = mt_res.scalar_one_or_none()
                if not mt:
                    # Type not seeded yet — allow through gracefully
                    data_copy[field_name] = normalized_val
                    continue

                # Query Master Value
                mv_res = await db.execute(
                    select(MasterValue).where(
                        MasterValue.master_type_id == mt.id,
                        MasterValue.is_deleted.is_(False),
                        MasterValue.active.is_(True),
                        func.upper(MasterValue.name) == normalized_val.upper(),
                        or_(
                            MasterValue.is_system.is_(True),
                            MasterValue.tenant_id == tenant_id
                        )
                    )
                )
                mv = mv_res.scalar_one_or_none()

                if mv:
                    data_copy[field_name] = mv.name  # Canonical DB casing
                else:
                    # Option 1: WARNING mode
                    if eff_mode == ValidationMode.WARNING:
                        warnings.append({
                            "field": field_name,
                            "warning": f"'{raw_val}' is not a recognized {field_name}. Saved as unverified custom entry.",
                            "policy_id": f"{entity_type}.{field_name}.warning",
                            "master_type": field_cfg.master_type
                        })
                        data_copy[field_name] = normalized_val

                    # Option 2: AUTO_CREATE mode
                    elif eff_mode == ValidationMode.AUTO_CREATE:
                        allowed = field_cfg.auto_create_allowed_roles
                        if user_role in allowed or user_role == "SYSADMIN":
                            # Auto-create new tenant master value
                            new_val = MasterValue(
                                id=uuid.uuid4(),
                                master_type_id=mt.id,
                                code=f"CUSTOM-{normalized_val.upper().replace(' ', '_')}",
                                name=normalized_val,
                                is_system=False,
                                tenant_id=tenant_id,
                                active=True
                            )
                            db.add(new_val)
                            await db.commit()
                            await db.refresh(new_val)

                            auto_created.append({
                                "field": field_name,
                                "created_value": normalized_val,
                                "master_type": field_cfg.master_type,
                                "id": str(new_val.id)
                            })
                            data_copy[field_name] = new_val.name
                        else:
                            # User unauthorized to AUTO_CREATE → fallback to STRICT failure
                            opts_res = await db.execute(
                                select(MasterValue.name).where(
                                    MasterValue.master_type_id == mt.id,
                                    MasterValue.is_deleted.is_(False),
                                    MasterValue.active.is_(True),
                                    or_(
                                        MasterValue.is_system.is_(True),
                                        MasterValue.tenant_id == tenant_id
                                    )
                                ).order_by(MasterValue.sort_order.asc(), MasterValue.name.asc())
                            )
                            valid_opts = [r[0] for r in opts_res.fetchall()]
                            raise HTTPException(
                                status_code=422,
                                detail={
                                    "title": f"Invalid {field_name.title()}",
                                    "explanation": f"'{raw_val}' is not a valid {field_name}. You lack permissions to auto-create master values.",
                                    "suggested_action": f"Valid options are: {', '.join(valid_opts) if valid_opts else 'none'}",
                                    "reference_id": "SMRITI-VAL-010",
                                    "policy_id": f"{entity_type}.{field_name}.strict",
                                    "validation_mode": "AUTO_CREATE_UNAUTHORIZED",
                                    "master_type": field_cfg.master_type
                                }
                            )

                    # Option 3: STRICT mode
                    else:
                        opts_res = await db.execute(
                            select(MasterValue.name).where(
                                MasterValue.master_type_id == mt.id,
                                MasterValue.is_deleted.is_(False),
                                MasterValue.active.is_(True),
                                or_(
                                    MasterValue.is_system.is_(True),
                                    MasterValue.tenant_id == tenant_id
                                )
                            ).order_by(MasterValue.sort_order.asc(), MasterValue.name.asc())
                        )
                        valid_opts = [r[0] for r in opts_res.fetchall()]
                        raise HTTPException(
                            status_code=422,
                            detail={
                                "title": f"Invalid {field_name.title()}",
                                "explanation": f"'{raw_val}' is not a valid {field_name}. Valid options are: {', '.join(valid_opts) if valid_opts else 'none configured yet'}.",
                                "suggested_action": f"Check spelling or configure '{normalized_val}' in Settings → Master Values → {field_name.title()}.",
                                "reference_id": "SMRITI-VAL-010",
                                "policy_id": f"{entity_type}.{field_name}.strict",
                                "validation_mode": "STRICT",
                                "master_type": field_cfg.master_type
                            }
                        )
            else:
                data_copy[field_name] = normalized_val

        return ValidationResult(
            valid=True,
            normalized_data=data_copy,
            warnings=warnings,
            auto_created_values=auto_created,
            applied_rules=applied_rules
        )


def get_validation_engine() -> PlatformValidationEngine:
    return PlatformValidationEngine()
