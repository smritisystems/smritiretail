"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-07-11
Modified     : 2026-10-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..models.crm import (
    Customer, CustomerGroup, CustomerGSTRegistration, CustomerDeliveryLocation,
    CustomerBillingLocation, CustomerExternalIdentity, CustomerPolicy,
    CustomerCompanyRelationship, CustomerCreditLedgerEntry,
)
from ..models.auth import User, UserRole
from ..models.identity_registry import SmritiNumberingRegistry
from ..models.tenant import Company
from ..models.audit import ComplianceImmutableAuditLog
from ..models.security import SmritiAuditLog
from .identity.engine import IdentityEngine
from .system_parameter import SystemParameterService
from .customer_gstin_validator import (
    validate_and_derive_gstin_state,
    normalize_state,
    warn_city_state_mismatch,
)
from decimal import Decimal
from ..models.sales import SalesInvoice
from ..schemas.crm import (
    CustomerCreate, CustomerUpdate, CustomerGroupCreate,
    CustomerGSTRegistrationCreate, CustomerGSTRegistrationUpdate,
    CustomerDeliveryLocationCreate, CustomerDeliveryLocationUpdate,
    CustomerBillingLocationCreate, CustomerBillingLocationUpdate,
    CustomerExternalIdentityCreate,
    DuplicateDecision, MatchedIdentityType, CustomerDuplicateCheckResponse,
    CustomerDuplicateCheckRequest,
    CustomerDeactivateRequest, CustomerDeleteEligibilityResponse,
    CustomerMergeRequest, CustomerMergeResponse,
    StoreAddressItem, StoreAddressCreate, StoreAddressUpdate, StoreCodeLookupItem,
    CustomerCompanyRelationshipCreate, CustomerCompanyRelationshipUpdate,
    CompanyCreditExposureItem, CustomerCreditExposureResponse,
    CustomerCodeRecommendationResponse, CustomerCodeValidationResponse,
    EligibleCustomerCodeItem,
)
from ..repositories.customer import (
    CustomerRepository, CustomerGroupRepository,
    CustomerGSTRegistrationRepository, CustomerDeliveryLocationRepository,
    CustomerBillingLocationRepository, CustomerExternalIdentityRepository,
)
from .customer_identity import CustomerIdentityService
import asyncio
from ..api.deps import TenantContext

# In-process asynchronous mutex registry per (tenant, store_code) to guarantee
# absolute mutual exclusion during concurrent assignments for unassigned store codes
_store_code_mutexes: Dict[str, asyncio.Lock] = {}
_store_code_mutex_guard = asyncio.Lock()


async def _get_store_code_mutex(company_id: Optional[str], store_code: str) -> asyncio.Lock:
    clean_code = store_code.strip().upper()
    key = f"{company_id or 'global'}:{clean_code}"
    async with _store_code_mutex_guard:
        if key not in _store_code_mutexes:
            _store_code_mutexes[key] = asyncio.Lock()
        return _store_code_mutexes[key]


class CrmService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.customer_repo = CustomerRepository(db, tenant_ctx)
        self.gst_repo = CustomerGSTRegistrationRepository(db, tenant_ctx)
        self.delivery_repo = CustomerDeliveryLocationRepository(db, tenant_ctx)
        self.billing_repo = CustomerBillingLocationRepository(db, tenant_ctx)
        self.ext_ident_repo = CustomerExternalIdentityRepository(db, tenant_ctx)
        self.identity_service = CustomerIdentityService(db, tenant_ctx)

    async def merge_customer(
        self,
        target_id: str,
        source_id: str,
        reason: Optional[str] = None,
        actor_user_id: Optional[str] = None,
        actor_role: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Consolidate source duplicate customer into target canonical customer (BD-2 & Model C).
        - Validates PAN parity (prohibits merging across distinct legal entity PANs).
        - Reassigns GST registrations (consolidating duplicates).
        - Reassigns delivery and billing locations (resolving store code collisions).
        - Reassigns Model C customer_company_relationships.
        - Reassigns all transactional foreign keys (invoices, orders, returns, ledgers, POs).
        - Consolidates outstanding receivables balance.
        - Retires source customer with audit tag.
        - Records cryptographic tamper-evident audit record in compliance_immutable_audit_logs.
        """
        if target_id == source_id:
            raise HTTPException(status_code=400, detail="Target and source customer must be different.")

        result = await self.db.execute(
            select(Customer)
            .where(Customer.id.in_([target_id, source_id]))
            .with_for_update()
        )
        customers = {customer.id: customer for customer in result.scalars().all()}
        target = customers.get(target_id)
        source = customers.get(source_id)
        if not target or not source:
            raise HTTPException(status_code=404, detail="Both target and source customers must exist.")
        if source.is_deleted or source.status in ("Inactive", "Merged"):
            raise HTTPException(status_code=400, detail="Source customer is already inactive, merged, or deleted.")
        if target.is_deleted:
            raise HTTPException(status_code=400, detail="Target customer is deleted and cannot absorb another account.")

        # BD-2 PAN Validation: Corporate entities must match PAN or adopt source PAN
        target_pan = (target.pan_number or "").strip().upper()
        source_pan = (source.pan_number or "").strip().upper()
        if target_pan and source_pan and target_pan != source_pan:
            raise HTTPException(
                status_code=400,
                detail=f"BD-2 Conflict: Cannot merge corporate customers with conflicting PAN numbers (Target: '{target_pan}', Source: '{source_pan}'). Merging across distinct PAN entities is prohibited.",
            )
        if not target_pan and source_pan:
            target.pan_number = source_pan
        if not target.gst_number and source.gst_number:
            target.gst_number = source.gst_number
        if not target.email and source.email:
            target.email = source.email

        reassigned_metrics: Dict[str, int] = {}

        # 1. GST Registrations Consolidation
        source_gst = (await self.db.execute(
            select(CustomerGSTRegistration).where(CustomerGSTRegistration.customer_id == source_id, CustomerGSTRegistration.is_deleted == False)
        )).scalars().all()
        target_gst = (await self.db.execute(
            select(CustomerGSTRegistration).where(CustomerGSTRegistration.customer_id == target_id, CustomerGSTRegistration.is_deleted == False)
        )).scalars().all()
        target_gst_by_value = {registration.gstin.upper(): registration for registration in target_gst}

        gst_transferred = 0
        gst_consolidated = 0
        for registration in source_gst:
            existing = target_gst_by_value.get(registration.gstin.upper())
            if existing:
                await self.db.execute(text(
                    "UPDATE customer_delivery_locations "
                    "SET gst_registration_id = :target_reg "
                    "WHERE gst_registration_id = :source_reg"
                ), {"target_reg": existing.id, "source_reg": registration.id})
                await self.db.execute(text(
                    "UPDATE customer_billing_locations "
                    "SET gst_registration_id = :target_reg "
                    "WHERE gst_registration_id = :source_reg"
                ), {"target_reg": existing.id, "source_reg": registration.id})
                registration.is_deleted = True
                registration.is_active = False
                registration.status = "MERGED"
                gst_consolidated += 1
            else:
                registration.customer_id = target_id
                registration.is_primary = False
                gst_transferred += 1
        reassigned_metrics["gst_registrations_transferred"] = gst_transferred
        reassigned_metrics["gst_registrations_consolidated"] = gst_consolidated

        # 2. Locations Consolidation (Delivery and Billing)
        for table, code_column in (
            ("customer_delivery_locations", "store_code"),
            ("customer_billing_locations", "billing_store_code"),
        ):
            conflicts = await self.db.execute(text(
                f"SELECT source.id, source.{code_column} "
                f"FROM {table} source JOIN {table} target "
                f"ON target.customer_id = :target_id "
                f"AND target.{code_column} = source.{code_column} "
                "AND target.status = 'ACTIVE' AND target.is_deleted = false "
                f"WHERE source.customer_id = :source_id AND source.status = 'ACTIVE' AND source.is_deleted = false"
            ), {"target_id": target_id, "source_id": source_id})
            conflict_rows = conflicts.fetchall()
            if conflict_rows:
                if table == "customer_delivery_locations":
                    await self.db.execute(text(
                        "UPDATE customer_delivery_locations target SET "
                        "location_name = source.location_name, address_line1 = source.address_line1, "
                        "address_line2 = source.address_line2, city = source.city, state = source.state, "
                        "state_code = source.state_code, pincode = source.pincode, country = source.country, "
                        "gst_registration_id = COALESCE(target.gst_registration_id, source.gst_registration_id), gstin = COALESCE(target.gstin, source.gstin), "
                        "contact_person = source.contact_person, phone = source.phone, email = source.email, "
                        "source = source.source, remarks = source.remarks "
                        "FROM customer_delivery_locations source "
                        "WHERE target.customer_id = :target_id AND source.customer_id = :source_id "
                        "AND target.store_code = source.store_code AND target.status = 'ACTIVE' "
                        "AND source.status = 'ACTIVE' AND target.is_deleted = false AND source.is_deleted = false"
                    ), {"target_id": target_id, "source_id": source_id})
                else:
                    await self.db.execute(text(
                        "UPDATE customer_billing_locations target SET "
                        "location_name = source.location_name, address_line1 = source.address_line1, "
                        "address_line2 = source.address_line2, city = source.city, state = source.state, "
                        "state_code = source.state_code, pincode = source.pincode, country = source.country, "
                        "gst_registration_id = COALESCE(target.gst_registration_id, source.gst_registration_id), gstin = COALESCE(target.gstin, source.gstin), "
                        "contact_person = source.contact_person, phone = source.phone, email = source.email, "
                        "source = source.source, remarks = source.remarks "
                        "FROM customer_billing_locations source "
                        "WHERE target.customer_id = :target_id AND source.customer_id = :source_id "
                        "AND target.billing_store_code = source.billing_store_code AND target.status = 'ACTIVE' "
                        "AND source.status = 'ACTIVE' AND target.is_deleted = false AND source.is_deleted = false"
                    ), {"target_id": target_id, "source_id": source_id})
                await self.db.execute(text(
                    f"UPDATE {table} SET status = 'MERGED', is_active = false, is_deleted = true "
                    f"WHERE customer_id = :source_id AND {code_column} IN "
                    f"(SELECT {code_column} FROM {table} WHERE customer_id = :target_id AND status = 'ACTIVE' AND is_deleted = false)"
                ), {"target_id": target_id, "source_id": source_id})

            loc_res = await self.db.execute(text(
                f"UPDATE {table} SET customer_id = :target_id, is_default = false "
                f"WHERE customer_id = :source_id AND status = 'ACTIVE' AND is_deleted = false"
            ), {"target_id": target_id, "source_id": source_id})
            reassigned_metrics[f"{table}_reassigned"] = loc_res.rowcount if hasattr(loc_res, "rowcount") else 0

        # 3. Model C Customer Company Relationships Consolidation
        source_ccr = (await self.db.execute(
            select(CustomerCompanyRelationship).where(CustomerCompanyRelationship.customer_id == source_id, CustomerCompanyRelationship.is_deleted == False)
        )).scalars().all()
        target_ccr = (await self.db.execute(
            select(CustomerCompanyRelationship).where(CustomerCompanyRelationship.customer_id == target_id, CustomerCompanyRelationship.is_deleted == False)
        )).scalars().all()
        target_ccr_companies = {rel.company_id: rel for rel in target_ccr}

        ccr_transferred = 0
        ccr_consolidated = 0
        for rel in source_ccr:
            if rel.company_id in target_ccr_companies:
                # Target already has a relationship for this company; retire source duplicate
                rel.is_deleted = True
                rel.is_active = False
                rel.status = "MERGED"
                ccr_consolidated += 1
            else:
                rel.customer_id = target_id
                ccr_transferred += 1
        reassigned_metrics["company_relationships_transferred"] = ccr_transferred
        reassigned_metrics["company_relationships_consolidated"] = ccr_consolidated

        # 4. Customer Policies Consolidation
        source_policies = (await self.db.execute(
            select(CustomerPolicy).where(CustomerPolicy.customer_id == source_id, CustomerPolicy.is_deleted == False)
        )).scalars().all()
        target_policies = (await self.db.execute(
            select(CustomerPolicy).where(CustomerPolicy.customer_id == target_id, CustomerPolicy.is_deleted == False)
        )).scalars().all()
        if target_policies:
            for p in source_policies:
                p.is_deleted = True
                p.is_active = False
        else:
            for p in source_policies:
                p.customer_id = target_id
        reassigned_metrics["policies_consolidated"] = len(source_policies)

        # 5. Financial & Transactional Tables Reassignment
        for table, column in (
            ("sales_invoices", "customer_id"),
            ("sales_orders", "customer_id"),
            ("sales_returns", "customer_id"),
            ("customer_credit_ledgers", "customer_id"),
            ("customer_purchase_orders", "customer_id"),
            ("psv_parties", "customer_id"),
            ("crm_customer_activities", "customer_id"),
            ("crm_opportunities", "customer_id"),
            ("customer_external_identities", "customer_id"),
            ("loyalty_members", "customer_id"),
            ("loyalty_transactions", "customer_id"),
            ("referral_relationships", "referred_customer_id"),
        ):
            upd_res = await self.db.execute(text(
                f"UPDATE {table} SET {column} = :target_id WHERE {column} = :source_id"
            ), {"target_id": target_id, "source_id": source_id})
            reassigned_metrics[f"{table}_reassigned"] = upd_res.rowcount if hasattr(upd_res, "rowcount") else 0

        # 6. Outstanding Receivables Balance Consolidation
        source_balance = source.outstanding or Decimal("0.00")
        target.outstanding = (target.outstanding or Decimal("0.00")) + source_balance
        source.outstanding = Decimal("0.00")

        # 7. Retire Source Customer Record
        source.status = "Merged"
        source.is_active = False
        source.is_deleted = True
        source.profile_notes = f"[MERGED into {target_id} on {datetime.now(timezone.utc).isoformat()}] {source.profile_notes or ''}".strip()
        source.code = f"{source.code}-MERGED-{source.id[-6:]}" if source.code else f"MERGED-{source.id[-6:]}"

        # 8. Immutable Compliance Regulatory Audit Trail
        before_state = {
            "target": {"id": target.id, "name": target.name, "code": target.code, "pan": target_pan, "outstanding": str(target.outstanding - source_balance)},
            "source": {"id": source.id, "name": source.name, "code": source.code, "pan": source_pan, "outstanding": str(source_balance)},
        }
        after_state = {
            "target": {"id": target.id, "name": target.name, "code": target.code, "pan": target.pan_number, "outstanding": str(target.outstanding)},
            "source": {"id": source.id, "status": "Merged", "is_deleted": True, "outstanding": "0.00"},
            "reassigned_records": reassigned_metrics,
        }
        audit_payload = {
            "operation": "CUSTOMER_ACCOUNT_MERGE",
            "target_id": target_id,
            "source_id": source_id,
            "reason": reason,
            "actor_user_id": actor_user_id or (self.tenant_ctx.user_id if hasattr(self.tenant_ctx, "user_id") else None),
            "actor_role": actor_role or ((self.tenant_ctx.role.value if hasattr(self.tenant_ctx.role, "value") else str(self.tenant_ctx.role)) if self.tenant_ctx.role else None),
            "metrics": reassigned_metrics,
        }
        serialized = json.dumps(audit_payload, sort_keys=True, default=str)
        payload_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        last_stmt = (
            select(ComplianceImmutableAuditLog)
            .order_by(ComplianceImmutableAuditLog.created_at.desc())
            .limit(1)
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            last_stmt = last_stmt.where(ComplianceImmutableAuditLog.company_id == self.tenant_ctx.company_id)
        last_entry = (await self.db.execute(last_stmt)).scalars().first()
        previous_hash = last_entry.payload_hash if last_entry else None

        audit_entry = ComplianceImmutableAuditLog(
            id=f"audit_{uuid.uuid4().hex[:16]}",
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else None,
            event_type="CUSTOMER_MERGED",
            entity_name="CUSTOMER",
            entity_id=target_id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action_summary=f"Customer '{source_id}' merged into '{target_id}'. Reason: {reason or 'PAN consolidation'}.",
            before_state_json=json.dumps(before_state, default=str),
            after_state_json=json.dumps(after_state, default=str),
            payload_hash=payload_hash,
            previous_hash=previous_hash,
            hash_chain_verified=True,
            request_id=f"req_{uuid.uuid4().hex[:12]}",
            retention_policy="STATUTORY_7_YEARS",
            worm_locked=True,
            timestamp=datetime.now(timezone.utc),
        )
        self.db.add(audit_entry)
        await self.db.commit()

        return {
            "target_customer_id": target_id,
            "source_customer_id": source_id,
            "status": "merged",
            "message": f"Customer '{source_id}' successfully merged into canonical account '{target_id}'.",
            "reassigned_records": reassigned_metrics,
            "merged_at": datetime.now(timezone.utc),
        }

    async def create_customer_group(self, group_in: CustomerGroupCreate) -> CustomerGroup:
        # Check for duplicate name
        existing = await self.db.execute(
            select(CustomerGroup).filter(
                CustomerGroup.name == group_in.name,
                CustomerGroup.is_deleted == False,
                (CustomerGroup.company_id == self.tenant_ctx.company_id) | (CustomerGroup.company_id.is_(None))
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Customer group with this name already exists")
        
        grp_dict = group_in.model_dump()
        if not grp_dict.get("id"):
            import uuid
            grp_dict["id"] = f"cg-{uuid.uuid4().hex[:8]}"
        
        valid_grp_data = {k: v for k, v in grp_dict.items() if hasattr(CustomerGroup, k)}
        db_group = CustomerGroup(
            **valid_grp_data,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_group)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
            if "customer_groups_name_key" in err_msg or "name" in err_msg:
                raise HTTPException(status_code=400, detail="Customer group with this name already exists")
            elif "customer_groups_pkey" in err_msg or "id" in err_msg:
                raise HTTPException(status_code=400, detail="Customer group with this ID already exists")
            elif "branch_id" in err_msg or "company_id" in err_msg:
                raise HTTPException(status_code=400, detail="Specified company or branch does not exist")
            else:
                raise HTTPException(status_code=400, detail="Customer group could not be created due to database integrity constraints")
        await self.db.refresh(db_group)
        return db_group

    def _require_company_id(self) -> str:
        """
        Enforce mandatory company context.
        Zero implicit fallback to COMP-001. Fails closed if missing or invalid.
        """
        cid = self.tenant_ctx.company_id if self.tenant_ctx else None
        if not cid or str(cid).strip().lower() in ("none", "null", "undefined", ""):
            raise HTTPException(
                status_code=400,
                detail="Active company context is required for Customer operations."
            )
        return str(cid).strip()

    async def _resolve_code_policy_config(self, company_id: str) -> Dict[str, Any]:
        """
        Resolves authoritative Customer Code assignment policy configuration:
        1. SMRITI.CUSTOMER.CODE_ASSIGNMENT_MODE (default 'HYBRID', options: 'HYBRID', 'AUTO', 'MANUAL')
        2. SMRITI.CUSTOMER.CODE_PREFIX (default 'CUST-')
        3. SMRITI.CUSTOMER.IS_CUST_CODE_ASSIGNED or 'IsCustCodeAssigned' (default True)
        4. SMRITI.CUSTOMER.CODE_MANUAL_ROLES (default 'SYSADMIN,ADMIN,MANAGER')
        """
        config = {
            "assignment_mode": "HYBRID",
            "prefix": "CUST-",
            "is_cust_code_assigned": True,
            "manual_roles": {"SYSADMIN", "ADMIN", "MANAGER"},
        }
        try:
            p_mode = await SystemParameterService.resolve_parameter(
                self.db, "SMRITI.CUSTOMER.CODE_ASSIGNMENT_MODE", company_id=company_id
            )
            if p_mode and p_mode.effective_value:
                val = str(p_mode.effective_value).strip().upper()
                if val in ("HYBRID", "AUTO", "MANUAL"):
                    config["assignment_mode"] = val

            p_prefix = await SystemParameterService.resolve_parameter(
                self.db, "SMRITI.CUSTOMER.CODE_PREFIX", company_id=company_id
            )
            if p_prefix and p_prefix.effective_value:
                pfx = str(p_prefix.effective_value).strip()
                if pfx:
                    config["prefix"] = pfx if pfx.endswith("-") else f"{pfx}-"

            p_assigned = await SystemParameterService.resolve_parameter(
                self.db, "SMRITI.CUSTOMER.IS_CUST_CODE_ASSIGNED", company_id=company_id
            )
            if not p_assigned:
                p_assigned = await SystemParameterService.resolve_parameter(
                    self.db, "IsCustCodeAssigned", company_id=company_id
                )
            if p_assigned is not None and p_assigned.effective_value is not None:
                config["is_cust_code_assigned"] = bool(p_assigned.effective_value)

            p_roles = await SystemParameterService.resolve_parameter(
                self.db, "SMRITI.CUSTOMER.CODE_MANUAL_ROLES", company_id=company_id
            )
            if p_roles and p_roles.effective_value:
                roles_str = str(p_roles.effective_value).strip()
                parsed_roles = {r.strip().upper() for r in roles_str.split(",") if r.strip()}
                if parsed_roles:
                    config["manual_roles"] = parsed_roles
        except Exception as e:
            logger = logging.getLogger("smriti.crm.policy")
            logger.warning(f"Error resolving Customer Code system parameters: {e}")

        return config

    def _is_manual_entry_allowed(
        self,
        current_user: Optional[User],
        manual_roles: Set[str],
    ) -> bool:
        """
        Checks whether the user has privilege to manually assign or customize Customer Codes.
        Evaluates user role enum.
        """
        if not current_user:
            role = self.tenant_ctx.role if self.tenant_ctx else None
            role_str = str(role.value if hasattr(role, "value") else (role or "")).upper()
            return role_str in manual_roles

        # 1. SYSADMIN always allowed
        if current_user.role == UserRole.SYSADMIN:
            return True

        # 2. Check role enum
        user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        if user_role_str.upper() in manual_roles:
            return True

        return False

    async def preview_next_customer_code(self, prefix: Optional[str] = None) -> str:
        """
        Read-only, non-mutating preview of the next valid sequential Customer Code
        within the tenant's company scope.
        Inspects existing customers (including inactive/archived to prevent historical collisions)
        and numbering registry to compute a collision-free candidate.
        DOES NOT reserve, advance, or mutate the numbering registry.
        """
        company_id = self._require_company_id()
        if not prefix:
            cfg = await self._resolve_code_policy_config(company_id)
            prefix = cfg["prefix"]
        prefix_clean = prefix.rstrip("-")

        # Include ALL customer records in the company scope to prevent reuse of historical codes
        stmt = select(Customer.code).where(
            Customer.company_id == company_id,
            Customer.code.like(f"{prefix}%"),
        )
        res = await self.db.execute(stmt)
        existing_codes = {c.strip().upper() for (c,) in res.all() if c}

        max_num = 0
        pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
        for c in existing_codes:
            m = pattern.match(c)
            if m:
                val = int(m.group(1))
                if val > max_num:
                    max_num = val

        reg_stmt = select(SmritiNumberingRegistry.sequence_value).where(
            SmritiNumberingRegistry.entity_type.in_(["CUSTOMER", "CUSTOMER_CODE"]),
            SmritiNumberingRegistry.prefix == prefix_clean,
            SmritiNumberingRegistry.company_id == company_id,
        )
        reg_res = await self.db.execute(reg_stmt)
        reg_val = reg_res.scalar() or 0

        candidate_seq = max(max_num, reg_val) + 1
        while f"{prefix}{candidate_seq:06d}" in existing_codes:
            candidate_seq += 1

        return f"{prefix}{candidate_seq:06d}"

    async def allocate_next_customer_code(self, prefix: Optional[str] = None) -> str:
        """
        Atomic sequential allocation of next customer code under row-lock.
        Advances and synchronizes SmritiNumberingRegistry within company scope.
        Safe against race conditions during first-time initialization using nested savepoints.
        Never reuses inactive or deleted customer codes.
        """
        company_id = self._require_company_id()
        if not prefix:
            cfg = await self._resolve_code_policy_config(company_id)
            prefix = cfg["prefix"]
        prefix_clean = prefix.rstrip("-")

        # 1. Acquire row lock on numbering registry
        num_stmt = (
            select(SmritiNumberingRegistry)
            .where(
                SmritiNumberingRegistry.entity_type == "CUSTOMER_CODE",
                SmritiNumberingRegistry.prefix == prefix_clean,
                SmritiNumberingRegistry.company_id == company_id,
            )
            .with_for_update()
        )
        num_res = await self.db.execute(num_stmt)
        num_rec = num_res.scalars().first()

        # 2. Inspect ALL existing customer records (active, inactive, deleted)
        # to ensure historical sequence continuity and zero silent reuse
        stmt = select(Customer.code).where(
            Customer.company_id == company_id,
            Customer.code.like(f"{prefix}%"),
        )
        res = await self.db.execute(stmt)
        existing_codes = {c.strip().upper() for (c,) in res.all() if c}

        max_num = 0
        pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
        for c in existing_codes:
            m = pattern.match(c)
            if m:
                val = int(m.group(1))
                if val > max_num:
                    max_num = val

        if not num_rec:
            candidate_seq = max(1, max_num + 1)
            while f"{prefix}{candidate_seq:06d}" in existing_codes:
                candidate_seq += 1

            # Safe initialization using nested savepoint
            try:
                async with self.db.begin_nested():
                    new_rec = SmritiNumberingRegistry(
                        id=uuid.uuid4().hex[:32],
                        entity_type="CUSTOMER_CODE",
                        identity_group="CRM",
                        group_code="CRM",
                        prefix=prefix_clean,
                        format_template=f"{prefix_clean}-{{seq:06d}}",
                        scope="COMPANY",
                        sequence_value=candidate_seq,
                        padding=6,
                        reset_policy="NEVER",
                        tenant_id=company_id,
                        company_id=company_id,
                        status="ACTIVE",
                    )
                    self.db.add(new_rec)
                    await self.db.flush()
                    allocated_seq = candidate_seq
            except IntegrityError:
                # Concurrent transaction initialized the registry first; re-query with row lock
                num_res = await self.db.execute(num_stmt)
                num_rec = num_res.scalars().first()
                if num_rec:
                    candidate_seq = max(num_rec.sequence_value + 1, max_num + 1)
                    while f"{prefix}{candidate_seq:06d}" in existing_codes:
                        candidate_seq += 1
                    num_rec.sequence_value = candidate_seq
                    allocated_seq = candidate_seq
                    await self.db.flush()
                else:
                    allocated_seq = candidate_seq
        else:
            candidate_seq = max(num_rec.sequence_value + 1, max_num + 1)
            while f"{prefix}{candidate_seq:06d}" in existing_codes:
                candidate_seq += 1
            num_rec.sequence_value = candidate_seq
            allocated_seq = candidate_seq
            await self.db.flush()

        return f"{prefix}{allocated_seq:06d}"

    async def get_customer_code_recommendation(
        self,
        current_user: Optional[User] = None,
    ) -> CustomerCodeRecommendationResponse:
        """
        Returns governed Customer Code assignment policy and suggested next code.
        Reads policy from SystemParameter configuration hierarchy.
        """
        company_id = self._require_company_id()
        cfg = await self._resolve_code_policy_config(company_id)
        manual_allowed = self._is_manual_entry_allowed(current_user, cfg["manual_roles"])
        if cfg["assignment_mode"] == "AUTO":
            manual_allowed = False

        suggested = await self.preview_next_customer_code(prefix=cfg["prefix"])

        inact_stmt = select(Customer.code).where(
            Customer.company_id == company_id,
            Customer.code.is_not(None),
            (Customer.status != "Active") | (Customer.is_deleted == True),
        ).limit(1)
        inact_res = await self.db.execute(inact_stmt)
        has_eligible = inact_res.scalars().first() is not None

        return CustomerCodeRecommendationResponse(
            suggested_code=suggested,
            assignment_mode=cfg["assignment_mode"],
            uniqueness_scope="COMPANY",
            manual_entry_allowed=manual_allowed,
            prefix=cfg["prefix"],
            has_eligible_existing_codes=has_eligible,
        )

    async def validate_customer_code(
        self,
        code: str,
        current_user: Optional[User] = None,
    ) -> CustomerCodeValidationResponse:
        """
        Validates customer code syntax, format normalization, role permissions, and company uniqueness.
        """
        company_id = self._require_company_id()
        cfg = await self._resolve_code_policy_config(company_id)
        manual_allowed = self._is_manual_entry_allowed(current_user, cfg["manual_roles"])

        code_raw = (code or "").strip()
        if not code_raw:
            return CustomerCodeValidationResponse(
                is_valid=False,
                code=code,
                reason="Customer code cannot be empty.",
                company_id=company_id,
            )

        code_clean = code_raw.upper()

        if len(code_clean) < 2 or len(code_clean) > 50:
            return CustomerCodeValidationResponse(
                is_valid=False,
                code=code_clean,
                reason="Customer code must be between 2 and 50 characters.",
                company_id=company_id,
            )

        # Standard format validation: alphanumeric plus hyphens, underscores, dots
        if not re.match(r"^[A-Z0-9_\-\.]+$", code_clean):
            return CustomerCodeValidationResponse(
                is_valid=False,
                code=code_clean,
                reason="Customer code must contain only alphanumeric characters, hyphens, dots, or underscores.",
                company_id=company_id,
            )

        if cfg["assignment_mode"] == "AUTO":
            return CustomerCodeValidationResponse(
                is_valid=False,
                code=code_clean,
                reason="Manual Customer Code entry is disabled by policy (Assignment Mode is AUTO).",
                company_id=company_id,
            )

        # If user is not authorized for manual entry, verify whether this matches the suggested code
        if not manual_allowed:
            suggested = await self.preview_next_customer_code(prefix=cfg["prefix"])
            if code_clean != suggested:
                return CustomerCodeValidationResponse(
                    is_valid=False,
                    code=code_clean,
                    reason="Manual Customer Code assignment is restricted to authorized roles (Managers and Administrators).",
                    company_id=company_id,
                )

        stmt = select(Customer.id, Customer.name).where(
            Customer.company_id == company_id,
            Customer.code == code_clean,
            Customer.status == "Active",
            Customer.is_deleted == False,
        )
        res = await self.db.execute(stmt)
        existing = res.first()
        if existing:
            return CustomerCodeValidationResponse(
                is_valid=False,
                code=code_clean,
                reason=f"Customer code '{code_clean}' is already assigned to active customer '{existing[1]}' in this company.",
                company_id=company_id,
            )

        return CustomerCodeValidationResponse(
            is_valid=True,
            code=code_clean,
            reason="Code is available.",
            company_id=company_id,
        )

    async def get_eligible_customer_code_pool(self) -> List[EligibleCustomerCodeItem]:
        """
        Returns eligible unassigned or inactive customer codes for reuse in Hybrid mode.
        Scoped strictly to the active company context.
        """
        company_id = self._require_company_id()
        stmt = select(
            Customer.code, Customer.name, Customer.status, Customer.is_deleted
        ).where(
            Customer.company_id == company_id,
            Customer.code.is_not(None),
            (Customer.status != "Active") | (Customer.is_deleted == True),
        ).order_by(Customer.code.asc()).limit(100)
        res = await self.db.execute(stmt)
        rows = res.all()

        active_stmt = select(Customer.code).where(
            Customer.company_id == company_id,
            Customer.code.is_not(None),
            Customer.status == "Active",
            Customer.is_deleted == False,
        )
        active_res = await self.db.execute(active_stmt)
        active_codes = {c.strip().upper() for (c,) in active_res.all() if c}

        pool: List[EligibleCustomerCodeItem] = []
        seen = set()
        for r_code, r_name, r_status, r_is_deleted in rows:
            if not r_code:
                continue
            clean = r_code.strip().upper()
            if clean in active_codes or clean in seen:
                continue
            seen.add(clean)
            stat = "ARCHIVED" if r_status == "Archived" else ("DELETED" if r_is_deleted else "INACTIVE")
            pool.append(EligibleCustomerCodeItem(
                code=clean,
                name=r_name or "Historical Customer",
                status=stat,
                description=f"Inactive code previously assigned to {r_name or 'customer'}",
            ))
        return pool

    async def create_customer(
        self,
        customer_in: CustomerCreate,
        current_user: Optional[User] = None,
    ) -> Customer:
        company_id = self._require_company_id()
        cfg = await self._resolve_code_policy_config(company_id)
        manual_allowed = self._is_manual_entry_allowed(current_user, cfg["manual_roles"])

        # Centralized Authoritative Duplicate Check
        dup_check = await self.identity_service.check_duplicate_customer(customer_in)
        if dup_check.decision == DuplicateDecision.HARD_DUPLICATE:
            if dup_check.matched_identity == MatchedIdentityType.CUSTOMER_CODE:
                fresh_code = await self.preview_next_customer_code(prefix=cfg["prefix"])
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error_code": "CUSTOMER_CODE_COLLISION",
                        "message": dup_check.reason or f"Customer code is already assigned to an active customer in this company.",
                        "suggested_code": fresh_code,
                    }
                )
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "DUPLICATE_CUSTOMER",
                    "decision": dup_check.decision.value,
                    "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                    "reason": dup_check.reason,
                    "existing_customer": dup_check.existing_customer.model_dump() if dup_check.existing_customer else None,
                    "allow_override": False,
                }
            )
        elif dup_check.decision == DuplicateDecision.POSSIBLE_DUPLICATE:
            if not getattr(customer_in, "allow_duplicate_override", False):
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error_code": "POSSIBLE_DUPLICATE_CUSTOMER",
                        "decision": dup_check.decision.value,
                        "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                        "reason": dup_check.reason,
                        "existing_customer": dup_check.existing_customer.model_dump() if dup_check.existing_customer else None,
                        "allow_override": True,
                    }
                )

        cust_dict = customer_in.model_dump()
        policy_fields = {
            "payment_category", "payment_term", "transport_mode", "transport_code", "transit_days",
            "bank_code", "bank_location", "retail_factor", "dealer_factor", "destination_tax_type",
            "allow_cash_bill", "allow_dc_gen", "allow_credit_invoice", "allow_misc_issue", "allow_misc_receipts",
        }
        policy_dict = {key: cust_dict.pop(key) for key in policy_fields if key in cust_dict}

        # Validate customer group exists if specified
        if customer_in.customer_group_id:
            stmt = select(CustomerGroup).filter(
                CustomerGroup.id == customer_in.customer_group_id,
                CustomerGroup.is_deleted == False,
                (CustomerGroup.company_id == company_id) | (CustomerGroup.company_id.is_(None)),
            )
            res = await self.db.execute(stmt)
            group = res.scalars().first()
            if not group:
                cust_dict["customer_group_id"] = None

        if not cust_dict.get("id"):
            tech_id, id_code = await IdentityEngine.allocate_internal(
                session=self.db,
                entity_type="CUSTOMER",
                tenant_id=company_id,
                company_id=company_id,
            )
            cust_dict["id"] = tech_id
            cust_dict["identity_code"] = id_code
        elif not cust_dict.get("identity_code"):
            _, id_code = await IdentityEngine.allocate_internal(
                session=self.db,
                entity_type="CUSTOMER",
                tenant_id=company_id,
                company_id=company_id,
            )
            cust_dict["identity_code"] = id_code

        # Governed Customer Code assignment
        raw_provided = cust_dict.get("code")
        provided_code = str(raw_provided).strip().upper() if raw_provided is not None and str(raw_provided).strip() else None

        is_historical_reuse = False
        historical_cust_info = None

        if provided_code:
            # Policy enforcement: If mode is AUTO, manual entry is disallowed
            if cfg["assignment_mode"] == "AUTO":
                raise HTTPException(
                    status_code=403,
                    detail="Manual Customer Code entry is disabled by policy (Assignment Mode is AUTO)."
                )

            # Role enforcement: manual assignment restricted to authorized users
            if not manual_allowed:
                # Check if it matches the current suggested code
                suggested_code = await self.preview_next_customer_code(prefix=cfg["prefix"])
                if provided_code != suggested_code:
                    raise HTTPException(
                        status_code=403,
                        detail="Manual Customer Code assignment is restricted to authorized roles (Managers and Administrators). System-generated codes are required for your role."
                    )

            # Syntax/length validation
            if len(provided_code) < 2 or len(provided_code) > 50 or not re.match(r"^[A-Z0-9_\-\.]+$", provided_code):
                raise HTTPException(
                    status_code=400,
                    detail="Customer code format is invalid. Must be 2-50 characters containing only alphanumeric characters, hyphens, dots, or underscores."
                )

            # Uniqueness check within active company scope
            dup_stmt = select(Customer.id, Customer.name).where(
                Customer.company_id == company_id,
                Customer.code == provided_code,
                Customer.status == "Active",
                Customer.is_deleted == False,
            )
            dup_res = await self.db.execute(dup_stmt)
            existing_cust = dup_res.first()
            if existing_cust:
                fresh_code = await self.preview_next_customer_code(prefix=cfg["prefix"])
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error_code": "CUSTOMER_CODE_COLLISION",
                        "message": f"Customer code '{provided_code}' is already assigned to active customer '{existing_cust[1]}' in this company.",
                        "suggested_code": fresh_code,
                    }
                )

            # Audit check: Was this code previously used by an inactive/deleted customer?
            hist_stmt = select(Customer.id, Customer.name, Customer.status, Customer.is_deleted).where(
                Customer.company_id == company_id,
                Customer.code == provided_code,
                (Customer.status != "Active") | (Customer.is_deleted == True),
            )
            hist_res = await self.db.execute(hist_stmt)
            hist_match = hist_res.first()
            if hist_match:
                is_historical_reuse = True
                historical_cust_info = hist_match

            cust_dict["code"] = provided_code
        else:
            # Atomic sequential allocation
            cust_dict["code"] = await self.allocate_next_customer_code(prefix=cfg["prefix"])

        # Clean virtual policy and control fields before database column instantiation
        cust_dict.pop("credit_limit", None)
        cust_dict.pop("credit_days", None)
        cust_dict.pop("unlimited_credit", None)
        cust_dict.pop("credit_hold", None)
        cust_dict.pop("allow_duplicate_override", None)

        db_customer = Customer(
            **cust_dict,
            company_id=company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        if any(value is not None for value in policy_dict.values()):
            db_customer.policy = CustomerPolicy(
                id=f"cp-{uuid.uuid4().hex[:12]}",
                **policy_dict,
                company_id=company_id,
                branch_id=self.tenant_ctx.branch_id,
            )

        self.db.add(db_customer)

        # Audit log for historical code reuse (Rule 9)
        if is_historical_reuse and historical_cust_info:
            audit_log = SmritiAuditLog(
                id=uuid.uuid4().hex[:32],
                tenant_id=company_id,
                entity_id=db_customer.id,
                changed_table="customers",
                changed_record_id=db_customer.id,
                field_name="code",
                old_value=f"Reused from inactive customer: {historical_cust_info[1]} (id: {historical_cust_info[0]}, status: {historical_cust_info[2]})",
                new_value=cust_dict["code"],
                change_type="HISTORICAL_CODE_REUSE",
                change_reason="Explicit authorized reassignment of inactive/archived customer code",
                change_source="CRM_CUSTOMER_CREATE",
                changed_by=getattr(current_user, "id", "SYSTEM"),
                changed_by_name=getattr(current_user, "username", "Unknown"),
                changed_at=datetime.now(timezone.utc),
            )
            self.db.add(audit_log)

        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
            if "uq_customers_company_code_active" in err_msg or "code" in err_msg:
                fresh_code = await self.preview_next_customer_code(prefix=cfg["prefix"])
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error_code": "CUSTOMER_CODE_COLLISION",
                        "message": f"Customer code '{cust_dict.get('code')}' collided with a concurrently created customer in this company.",
                        "suggested_code": fresh_code,
                    }
                )
            raise HTTPException(
                status_code=409,
                detail="Customer could not be created due to database integrity constraints or race-condition conflict."
            )
        # Eagerly load customer with group relationship before returning for response serialization
        refreshed = await self.get_customer(db_customer.id)
        return refreshed or db_customer

    async def update_customer(self, customer_id: str, customer_in: CustomerUpdate | CustomerCreate | dict) -> Customer:
        stmt = select(Customer).options(selectinload(Customer.group)).filter(
            Customer.id == customer_id,
            Customer.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        res = await self.db.execute(stmt)
        customer = res.scalars().first()

        data_dict = customer_in.model_dump(exclude_unset=True) if hasattr(customer_in, "model_dump") else dict(customer_in)
        
        # Concurrency / Optimistic Locking Protection
        expected_modified_at = data_dict.pop("expected_modified_at", None)
        if customer and expected_modified_at and customer.modified_at:
            if isinstance(expected_modified_at, str):
                try:
                    expected_modified_at = datetime.fromisoformat(expected_modified_at.replace("Z", "+00:00"))
                except Exception:
                    pass
            # Allow small timestamp precision difference (within 1 second)
            if isinstance(expected_modified_at, datetime):
                exp_dt = expected_modified_at if expected_modified_at.tzinfo else expected_modified_at.replace(tzinfo=timezone.utc)
                curr_dt = customer.modified_at if customer.modified_at.tzinfo else customer.modified_at.replace(tzinfo=timezone.utc)
                if (curr_dt - exp_dt).total_seconds() > 1.0:
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "error_code": "CONCURRENT_MODIFICATION_DETECTED",
                            "message": f"Customer '{customer.name}' was modified by another session at {curr_dt.isoformat()}. Please reload the latest catalogue record before saving.",
                            "current_modified_at": curr_dt.isoformat(),
                        }
                    )

        policy_fields = {
            "payment_category", "payment_term", "transport_mode", "transport_code", "transit_days",
            "bank_code", "bank_location", "retail_factor", "dealer_factor", "destination_tax_type",
            "allow_cash_bill", "allow_dc_gen", "allow_credit_invoice", "allow_misc_issue", "allow_misc_receipts",
        }
        policy_dict = {key: data_dict.pop(key) for key in policy_fields if key in data_dict}

        if not customer:
            # Upsert create if not found
            create_payload = {**data_dict, "id": customer_id}
            if not create_payload.get("name"):
                create_payload["name"] = f"Customer {customer_id}"
            return await self.create_customer(CustomerCreate(**create_payload))

        for k, v in data_dict.items():
            if v is not None and hasattr(customer, k):
                setattr(customer, k, v)

        if policy_dict:
            if customer.policy is None:
                customer.policy = CustomerPolicy(
                    id=f"cp-{uuid.uuid4().hex[:12]}",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                )
            for key, value in policy_dict.items():
                setattr(customer.policy, key, value)

        customer.modified_at = datetime.now(timezone.utc)
        await self._record_audit_event(
            event_type="UPDATE",
            table_name="customers",
            record_id=customer.id,
            details={"updated_fields": list(data_dict.keys())},
            reason="Customer Master Update",
        )
        await self.db.commit()
        refreshed = await self.get_customer(customer.id)
        return refreshed or customer

    async def check_delete_eligibility(self, customer_id: str) -> CustomerDeleteEligibilityResponse:
        """
        Evaluate customer deletion safety across all dependent foreign-key models,
        transaction logs, ledgers, and corporate hierarchies.
        """
        stmt = select(Customer).options(
            selectinload(Customer.delivery_locations),
            selectinload(Customer.billing_locations),
            selectinload(Customer.gst_registrations),
        ).filter(
            Customer.id == customer_id,
            Customer.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        res = await self.db.execute(stmt)
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        from ..models.sales import SalesInvoice, SalesOrder, SalesReturn
        from ..models.customer_po import CustomerPurchaseOrder
        from ..models.crm import CustomerCreditLedgerEntry, CustomerRelationship
        from ..models.psv import PSVParty

        # 1. Tax Invoices (Hard Compliance Blocker)
        inv_q = await self.db.execute(
            select(func.count(SalesInvoice.id)).where(
                SalesInvoice.customer_id == customer_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoice_count = inv_q.scalar_one() or 0

        # 2. Sales Orders
        so_q = await self.db.execute(
            select(func.count(SalesOrder.id)).where(
                SalesOrder.customer_id == customer_id,
                SalesOrder.is_deleted == False,
            )
        )
        order_count = so_q.scalar_one() or 0

        # 3. Sales Returns / Credit Notes
        ret_q = await self.db.execute(
            select(func.count(SalesReturn.id)).where(
                SalesReturn.customer_id == customer_id,
                SalesReturn.is_deleted == False,
            )
        )
        return_count = ret_q.scalar_one() or 0

        # 4. Financial Credit Ledger Entries
        led_q = await self.db.execute(
            select(func.count(CustomerCreditLedgerEntry.id)).where(
                CustomerCreditLedgerEntry.customer_id == customer_id,
                CustomerCreditLedgerEntry.is_deleted == False,
            )
        )
        ledger_count = led_q.scalar_one() or 0

        # 5. Customer Purchase Orders
        po_q = await self.db.execute(
            select(func.count(CustomerPurchaseOrder.id)).where(
                CustomerPurchaseOrder.customer_id == customer_id,
                CustomerPurchaseOrder.is_deleted == False,
            )
        )
        po_count = po_q.scalar_one() or 0

        # 6. PSV Physical Stock Verification Assignments
        psv_q = await self.db.execute(
            select(func.count(PSVParty.id)).where(
                (PSVParty.host_customer_id == customer_id) | (PSVParty.host_customer_id == customer.code)
            )
        )
        psv_count = psv_q.scalar_one() or 0

        # 7. Customer Relationships (Hierarchy / Dependants)
        rel_q = await self.db.execute(
            select(func.count(CustomerRelationship.id)).where(
                (CustomerRelationship.parent_customer_id == customer_id) | (CustomerRelationship.dependant_customer_id == customer_id),
                CustomerRelationship.is_deleted == False,
            )
        )
        relationship_count = rel_q.scalar_one() or 0

        outstanding_bal = float(customer.outstanding or 0.0)

        blockers: List[str] = []
        if invoice_count > 0:
            blockers.append(f"Customer has {invoice_count} tax invoice(s) on record. Tax and statutory compliance laws strictly prohibit deleting billed accounts.")
        if order_count > 0:
            blockers.append(f"Customer has {order_count} active or historical sales order(s).")
        if return_count > 0:
            blockers.append(f"Customer has {return_count} sales return credit note(s).")
        if ledger_count > 0:
            blockers.append(f"Customer has {ledger_count} financial credit ledger transaction(s).")
        if po_count > 0:
            blockers.append(f"Customer has {po_count} customer purchase order contract(s).")
        if psv_count > 0:
            blockers.append(f"Customer is assigned as host account for {psv_count} physical stock verification (PSV) party location(s).")
        if abs(outstanding_bal) > 0.001:
            blockers.append(f"Customer has an unsettled financial ledger balance of ₹{outstanding_bal:,.2f}.")
        if relationship_count > 0:
            blockers.append(f"Customer has {relationship_count} linked child or parent corporate account relationship(s).")

        eligible = len(blockers) == 0
        recommendation = "PERMANENT_DELETE" if eligible else "DEACTIVATE"
        reason = (
            "Customer has zero invoices, zero orders, zero ledger transactions, and zero dependent records. Safe to permanently delete."
            if eligible
            else "Customer has financial, transactional, or compliance dependencies. Permanent deletion is blocked to protect database foreign keys and accounting integrity. Deactivation is recommended."
        )

        return CustomerDeleteEligibilityResponse(
            customer_id=customer.id,
            customer_code=customer.code,
            customer_name=customer.name,
            status=customer.status or "Active",
            eligible=eligible,
            blockers=blockers,
            warnings=["Permanent deletion is irreversible and completely removes this customer record from PostgreSQL."] if eligible else [],
            recommendation=recommendation,
            reason=reason,
            metrics={
                "invoice_count": invoice_count,
                "order_count": order_count,
                "return_count": return_count,
                "ledger_count": ledger_count,
                "po_count": po_count,
                "psv_count": psv_count,
                "relationship_count": relationship_count,
                "outstanding_balance": outstanding_bal,
            }
        )

    async def deactivate_customer(self, customer_id: str, reason: Optional[str] = None) -> Customer:
        """
        Deactivate customer account. Prohibits new sales transactions while preserving
        all existing invoices, ledgers, returns, and audit trails.
        """
        stmt = select(Customer).filter(
            Customer.id == customer_id,
            Customer.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        res = await self.db.execute(stmt)
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if (customer.status or "").lower() == "inactive":
            raise HTTPException(status_code=400, detail=f"Customer '{customer.name}' ({customer.code}) is already inactive.")

        customer.status = "Inactive"
        customer.modified_at = datetime.now(timezone.utc)

        await self._record_audit_event(
            event_type="DEACTIVATE",
            table_name="customers",
            record_id=customer.id,
            details={
                "code": customer.code,
                "name": customer.name,
                "reason": reason,
                "outstanding": float(customer.outstanding or 0.0),
            },
            reason=reason or "Customer Deactivation",
        )
        await self.db.commit()
        refreshed = await self.get_customer(customer.id)
        return refreshed or customer

    async def reactivate_customer(self, customer_id: str) -> Customer:
        """
        Reactivate an inactive customer account, restoring operational transaction privileges.
        """
        stmt = select(Customer).filter(
            Customer.id == customer_id,
            Customer.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        res = await self.db.execute(stmt)
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if (customer.status or "").lower() == "active":
            raise HTTPException(status_code=400, detail=f"Customer '{customer.name}' ({customer.code}) is already active.")

        customer.status = "Active"
        customer.modified_at = datetime.now(timezone.utc)

        await self._record_audit_event(
            event_type="REACTIVATE",
            table_name="customers",
            record_id=customer.id,
            details={
                "code": customer.code,
                "name": customer.name,
            },
            reason="Customer Reactivation",
        )
        await self.db.commit()
        refreshed = await self.get_customer(customer.id)
        return refreshed or customer

    async def permanent_delete_customer(self, customer_id: str) -> Dict[str, Any]:
        """
        Permanently remove a customer from PostgreSQL ONLY if zero transaction or
        ledger dependencies exist. Atomic and concurrency-safe.
        """
        stmt = select(Customer).options(
            selectinload(Customer.delivery_locations),
            selectinload(Customer.billing_locations),
            selectinload(Customer.gst_registrations),
            selectinload(Customer.external_identities),
            selectinload(Customer.policy),
        ).filter(
            Customer.id == customer_id,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        res = await self.db.execute(stmt)
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        eligibility = await self.check_delete_eligibility(customer_id)
        if not eligibility.eligible:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "CUSTOMER_DELETE_BLOCKED",
                    "message": "Permanent deletion blocked by foreign key or transaction constraints.",
                    "blockers": eligibility.blockers,
                    "recommendation": "Use Deactivate instead to preserve historical records.",
                }
            )

        cust_code = customer.code
        cust_name = customer.name

        # Explicitly remove child subordinate records
        for reg in customer.gst_registrations or []:
            await self.db.delete(reg)
        for dloc in customer.delivery_locations or []:
            await self.db.delete(dloc)
        for bloc in customer.billing_locations or []:
            await self.db.delete(bloc)
        for ext in customer.external_identities or []:
            await self.db.delete(ext)
        if customer.policy:
            await self.db.delete(customer.policy)

        await self._record_audit_event(
            event_type="PERMANENT_DELETE",
            table_name="customers",
            record_id=customer.id,
            details={
                "code": cust_code,
                "name": cust_name,
            },
            reason="Customer Permanent Delete (Authorized SYSADMIN)",
        )

        await self.db.delete(customer)
        await self.db.commit()

        return {
            "status": "success",
            "message": f"Customer '{cust_name}' ({cust_code or customer_id}) was permanently deleted from the database.",
            "customer_id": customer_id,
        }

    async def delete_customer(self, customer_id: str) -> bool:
        stmt = select(Customer).filter(
            Customer.id == customer_id,
            Customer.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        res = await self.db.execute(stmt)
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        customer.is_deleted = True
        customer.modified_at = datetime.now(timezone.utc)
        await self._record_audit_event(
            event_type="SOFT_DELETE",
            table_name="customers",
            record_id=customer.id,
            details={"code": customer.code, "name": customer.name},
            reason="Customer Soft Deletion",
        )
        await self.db.commit()
        return True

    async def get_customer(self, customer_id: str) -> Optional[Customer]:
        return await self.customer_repo.get(customer_id)

    async def check_credit_limit(self, customer_id: str, new_amount: float) -> bool:
        if customer_id == "CUST-WALKIN":
            return True

        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        group_stmt = select(CustomerGroup).filter(
            CustomerGroup.id == customer.customer_group_id,
            CustomerGroup.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            group_stmt = group_stmt.filter(
                (CustomerGroup.company_id == self.tenant_ctx.company_id) | (CustomerGroup.company_id.is_(None))
            )
        group_res = await self.db.execute(group_stmt)
        group = group_res.scalars().first()
        if not group:
            return True # No group limits
            
        if getattr(group, "credit_hold", False):
            raise HTTPException(
                status_code=400,
                detail="SMRITI-CREDIT-002: Customer account is on credit hold. Invoicing blocked."
            )

        if getattr(group, "unlimited_credit", False):
            return True
            
        # Assert outstanding + new purchase is within limit
        limit = float(getattr(group, "credit_limit", 0.0) or 0.0)
        current_outstanding = float(customer.outstanding or 0.0)
        if limit > 0 and (current_outstanding + new_amount > limit):
            if getattr(group, "auto_block_sales", True):
                raise HTTPException(
                    status_code=400, 
                    detail=f"SMRITI-CREDIT-001: Customer credit limit of ₹{limit:,.2f} exceeded. Current Balance: ₹{current_outstanding:,.2f}, New Invoice: ₹{new_amount:,.2f}. Sales blocked."
                )
            return False # Limit warning
        return True

    async def _record_audit_event(
        self,
        event_type: str,
        table_name: str,
        record_id: str,
        details: Dict[str, Any],
        reason: Optional[str] = None,
    ):
        logger = logging.getLogger("smriti.crm.audit")
        logger.info(f"AUDIT [{event_type}] table={table_name} id={record_id} details={details}")
        try:
            from ..models.security import SmritiAuditLog
            async with self.db.begin_nested():
                audit_entry = SmritiAuditLog(
                    id=f"aud-{uuid.uuid4().hex[:8]}",
                    tenant_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
                    changed_table=table_name,
                    changed_record_id=record_id,
                    change_type=event_type,
                    change_reason=reason or json.dumps(details),
                    change_source="CRM_API",
                    changed_at=datetime.now(timezone.utc),
                )
                self.db.add(audit_entry)
                await self.db.flush()
        except Exception as e:
            logger.debug(f"Could not persist SmritiAuditLog record: {e}")

    # --- Customer GST Registration Methods ---

    async def list_gst_registrations(
        self, customer_id: str, include_inactive: bool = False
    ) -> List[CustomerGSTRegistration]:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        return await self.gst_repo.get_all_for_customer(customer_id, include_inactive=include_inactive)

    async def get_gst_registration(
        self, customer_id: str, reg_id: str
    ) -> CustomerGSTRegistration:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        reg = await self.gst_repo.get_by_customer_and_id(customer_id, reg_id)
        if not reg:
            raise HTTPException(status_code=404, detail=f"Customer GST registration '{reg_id}' not found.")
        return reg

    async def create_gst_registration(
        self, customer_id: str, reg_in: CustomerGSTRegistrationCreate
    ) -> CustomerGSTRegistration:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        normalized_gstin = reg_in.gstin.strip().upper()

        # Phase 5 Prevention: validate GSTIN format and auto-derive authoritative state fields
        normalized_gstin, derived_state_code, derived_state_name = validate_and_derive_gstin_state(
            gstin=normalized_gstin,
            submitted_state_name=(reg_in.state_name or "").strip() or None,
            submitted_state_code=(reg_in.state_code or "").strip() or None,
        )

        # Centralized Duplicate Protection (Same customer duplicate OR different customer collision)
        dup_check = await self.identity_service.check_duplicate_gst_registration(customer_id, normalized_gstin)
        if dup_check.decision == DuplicateDecision.HARD_DUPLICATE:
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "DUPLICATE_GSTIN",
                    "decision": dup_check.decision.value,
                    "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                    "reason": dup_check.reason,
                    "existing_customer": dup_check.existing_customer.model_dump() if dup_check.existing_customer else None,
                    "allow_override": False,
                }
            )

        if reg_in.is_primary:
            await self.gst_repo.clear_primary_flags(customer_id)
            customer.gst_number = normalized_gstin

        reg_id = reg_in.id or f"cgr-{uuid.uuid4().hex[:8]}"
        db_reg = CustomerGSTRegistration(
            id=reg_id,
            customer_id=customer_id,
            gstin=normalized_gstin,
            state_name=derived_state_name,   # always derived from GSTIN, never NULL
            state_code=derived_state_code,   # always derived from GSTIN, never NULL
            registration_type=reg_in.registration_type or "REGULAR",
            is_primary=bool(reg_in.is_primary),
            status=reg_in.status or "ACTIVE",
            remarks=reg_in.remarks,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            is_active=True,
            is_deleted=False,
        )
        self.db.add(db_reg)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Customer GST registration could not be created due to database integrity constraints or race condition."
            )

        await self.db.refresh(db_reg)
        await self._record_audit_event(
            "CustomerGSTRegistrationCreated",
            "customer_gst_registrations",
            db_reg.id,
            {"gstin": normalized_gstin, "state_code": db_reg.state_code, "is_primary": db_reg.is_primary}
        )
        if db_reg.is_primary:
            await self._record_audit_event(
                "CustomerGSTRegistrationPrimaryChanged",
                "customer_gst_registrations",
                db_reg.id,
                {"gstin": normalized_gstin}
            )
        return db_reg

    async def update_gst_registration(
        self, customer_id: str, reg_id: str, reg_in: CustomerGSTRegistrationUpdate
    ) -> CustomerGSTRegistration:
        reg = await self.get_gst_registration(customer_id, reg_id)
        customer = await self.get_customer(customer_id)

        changes = {}
        if reg_in.gstin:
            new_gstin = reg_in.gstin.strip().upper()
            if new_gstin != reg.gstin:
                existing = await self.gst_repo.get_by_customer_and_gstin(customer_id, new_gstin, include_deleted=False)
                if existing and existing.id != reg_id:
                    raise HTTPException(
                        status_code=400,
                        detail=f"GSTIN '{new_gstin}' is already registered for this customer."
                    )
                changes["gstin"] = {"old": reg.gstin, "new": new_gstin}
                reg.gstin = new_gstin
                if reg.is_primary and customer:
                    customer.gst_number = new_gstin

        if reg_in.state_code:
            target_sc = reg_in.state_code.strip()
            if reg.gstin and reg.gstin[:2] != target_sc:
                raise HTTPException(
                    status_code=400,
                    detail=f"GSTIN prefix '{reg.gstin[:2]}' does not match updated state code '{target_sc}'."
                )
            changes["state_code"] = {"old": reg.state_code, "new": target_sc}
            reg.state_code = target_sc

        if reg_in.state_name:
            reg.state_name = reg_in.state_name.strip()
        if reg_in.registration_type:
            reg.registration_type = reg_in.registration_type
        if reg_in.remarks is not None:
            reg.remarks = reg_in.remarks

        if reg_in.is_primary is True and not reg.is_primary:
            await self.gst_repo.clear_primary_flags(customer_id, exclude_id=reg_id)
            reg.is_primary = True
            if customer:
                customer.gst_number = reg.gstin
            await self._record_audit_event(
                "CustomerGSTRegistrationPrimaryChanged",
                "customer_gst_registrations",
                reg.id,
                {"gstin": reg.gstin}
            )

        if reg_in.status:
            status_val = reg_in.status.upper()
            reg.status = status_val
            if status_val in ("CANCELLED", "SURRENDERED"):
                reg.is_active = False
                if reg.is_primary:
                    reg.is_primary = False
            elif status_val == "ACTIVE":
                reg.is_active = True

        reg.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(reg)
        await self._record_audit_event(
            "CustomerGSTRegistrationUpdated",
            "customer_gst_registrations",
            reg.id,
            {"changes": changes, "is_primary": reg.is_primary, "status": reg.status}
        )
        return reg

    async def set_primary_gst_registration(
        self, customer_id: str, reg_id: str
    ) -> CustomerGSTRegistration:
        reg = await self.get_gst_registration(customer_id, reg_id)
        customer = await self.get_customer(customer_id)
        if not reg.is_active or reg.is_deleted or reg.status != "ACTIVE":
            raise HTTPException(
                status_code=400,
                detail="Cannot set an inactive or cancelled GST registration as primary."
            )

        await self.gst_repo.clear_primary_flags(customer_id, exclude_id=reg_id)
        reg.is_primary = True
        reg.modified_at = datetime.now(timezone.utc)
        if customer:
            customer.gst_number = reg.gstin

        await self.db.commit()
        await self.db.refresh(reg)
        await self._record_audit_event(
            "CustomerGSTRegistrationPrimaryChanged",
            "customer_gst_registrations",
            reg.id,
            {"gstin": reg.gstin}
        )
        return reg

    async def delete_gst_registration(
        self, customer_id: str, reg_id: str
    ) -> Dict[str, str]:
        reg = await self.get_gst_registration(customer_id, reg_id)
        # Check if referenced by issued invoices
        stmt = select(func.count()).select_from(SalesInvoice).filter(SalesInvoice.billed_party_gstin_id == reg_id)
        res = await self.db.execute(stmt)
        inv_count = res.scalar() or 0

        # Project lifecycle soft-delete
        reg.is_deleted = True
        reg.is_active = False
        reg.status = "CANCELLED"
        reg.deleted_at = datetime.now(timezone.utc)
        if reg.is_primary:
            reg.is_primary = False

        await self.db.commit()
        await self._record_audit_event(
            "CustomerGSTRegistrationDeactivated",
            "customer_gst_registrations",
            reg_id,
            {"invoice_references": inv_count}
        )
        return {"status": "success", "message": f"Customer GST registration '{reg_id}' deactivated."}

    # --- Customer Delivery Location Methods ---

    async def list_delivery_locations(
        self, customer_id: str, include_inactive: bool = False
    ) -> List[CustomerDeliveryLocation]:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        return await self.delivery_repo.get_all_for_customer(customer_id, include_inactive=include_inactive)

    async def get_delivery_location(
        self, customer_id: str, location_id: str, with_for_update: bool = False
    ) -> CustomerDeliveryLocation:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        loc = await self.delivery_repo.get_by_customer_and_id(customer_id, location_id, with_for_update=with_for_update)
        if not loc:
            raise HTTPException(status_code=404, detail=f"Customer delivery location '{location_id}' not found.")
        return loc

    async def create_delivery_location(
        self, customer_id: str, loc_in: CustomerDeliveryLocationCreate
    ) -> CustomerDeliveryLocation:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        store_code = loc_in.store_code.strip().upper()
        location_name = loc_in.location_name.strip()

        # Mutual exclusion lock per (tenant, store_code) to serialize concurrent claims on both
        # existing and previously unassigned store codes
        mutex = await _get_store_code_mutex(self.tenant_ctx.company_id, store_code)
        async with mutex:
            # PostgreSQL transaction-level advisory lock across database connections
            if self.db.bind and hasattr(self.db.bind, "dialect") and self.db.bind.dialect.name == "postgresql":
                try:
                    lock_key = f"store_code:{self.tenant_ctx.company_id or 'global'}:{store_code}"
                    await self.db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": lock_key})
                except Exception:
                    pass

            # Centralized Duplicate Protection (Same customer + same store code -> hard duplicate)
            dup_check = await self.identity_service.check_duplicate_delivery_location(
                customer_id=customer_id,
                store_code=store_code,
                address_line1=loc_in.address_line1,
            )
            if dup_check.decision == DuplicateDecision.HARD_DUPLICATE:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error_code": "DUPLICATE_STORE_CODE",
                        "decision": dup_check.decision.value,
                        "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                        "reason": dup_check.reason,
                        "allow_override": False,
                    }
                )

            # Concurrency safety: Pessimistic lock row if existing store_code is in database
            existing_locked = await self.delivery_repo.get_by_store_code(store_code, active_only=False, with_for_update=True)
            if existing_locked and existing_locked.status == "ACTIVE" and not existing_locked.is_deleted:
                if existing_locked.customer_id != customer_id:
                    owning_cust = await self.get_customer(existing_locked.customer_id)
                    cname = owning_cust.name if owning_cust else "another customer"
                    ccode = f" ({owning_cust.code})" if owning_cust and owning_cust.code else ""
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "error_code": "DUPLICATE_STORE_CODE",
                            "decision": "HARD_DUPLICATE",
                            "matched_identity": "STORE_CODE",
                            "reason": f"Store code '{store_code}' is already assigned to customer '{cname}'{ccode}. A Store Code can only belong to one customer profile at a time.",
                            "allow_override": False,
                        }
                    )

        if loc_in.is_default:
            await self.delivery_repo.clear_default_flags(customer_id)

        resolved_gstin = loc_in.gstin.strip().upper() if loc_in.gstin else None
        target_state_code = loc_in.state_code.strip() if loc_in.state_code else None
        target_state = loc_in.state.strip() if loc_in.state else None

        if loc_in.gst_registration_id:
            gst_reg = await self.gst_repo.get_by_customer_and_id(customer_id, loc_in.gst_registration_id)
            if not gst_reg:
                raise HTTPException(
                    status_code=400,
                    detail="GST registration does not belong to this customer or does not exist."
                )
            if not gst_reg.is_active or gst_reg.is_deleted or gst_reg.status != "ACTIVE":
                raise HTTPException(
                    status_code=400,
                    detail="Selected GST registration is inactive or cancelled."
                )
            if resolved_gstin:
                if resolved_gstin != gst_reg.gstin:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Conflicting GSTIN: delivery location GSTIN '{resolved_gstin}' does not match linked customer GST registration GSTIN '{gst_reg.gstin}'."
                    )
            else:
                resolved_gstin = gst_reg.gstin

            if target_state_code and target_state_code != gst_reg.state_code:
                raise HTTPException(
                    status_code=400,
                    detail=f"Conflicting state code: delivery location state code '{target_state_code}' does not match linked customer GST registration state code '{gst_reg.state_code}'."
                )
            if not target_state_code:
                target_state_code = gst_reg.state_code
            if not target_state:
                target_state = gst_reg.state_name
        elif resolved_gstin:
            if target_state_code and resolved_gstin[:2] != target_state_code:
                raise HTTPException(
                    status_code=400,
                    detail=f"Delivery GSTIN prefix '{resolved_gstin[:2]}' does not match state_code '{target_state_code}'."
                )

        loc_id = loc_in.id or f"cdl-{uuid.uuid4().hex[:8]}"
        initial_addr_dict = {
            "id": f"addr-{uuid.uuid4().hex[:12]}",
            "address_type": "Delivery",
            "address_title": "Primary Store Front",
            "address_line1": loc_in.address_line1 or location_name,
            "address_line2": loc_in.address_line2,
            "locality": None,
            "city": loc_in.city or None,
            "district": None,
            "state": normalize_state(target_state) if target_state else None,
            "state_code": target_state_code,
            "pincode": loc_in.pincode or None,
            "country": loc_in.country or "India",
            "contact_person": loc_in.contact_person,
            "phone": loc_in.phone,
            "email": loc_in.email,
            "is_primary": True,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        db_loc = CustomerDeliveryLocation(
            id=loc_id,
            customer_id=customer_id,
            store_code=store_code,
            location_name=location_name,
            address_line1=loc_in.address_line1,
            address_line2=loc_in.address_line2,
            city=loc_in.city or None,
            state=normalize_state(target_state) if target_state else None,
            state_code=target_state_code,
            pincode=loc_in.pincode,
            country=loc_in.country or "India",
            gst_registration_id=loc_in.gst_registration_id,
            gstin=resolved_gstin,
            contact_person=loc_in.contact_person,
            phone=loc_in.phone,
            email=loc_in.email,
            is_default=bool(loc_in.is_default),
            status=loc_in.status or "ACTIVE",
            source=loc_in.source or "MANUAL",
            remarks=loc_in.remarks,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            is_active=True,
            is_deleted=False,
            metadata_json={"addresses": [initial_addr_dict]},
        )
        self.db.add(db_loc)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Customer delivery location could not be created due to duplicate store code or database integrity constraints."
            )

        refreshed = await self.delivery_repo.get(db_loc.id)
        await self._record_audit_event(
            "CustomerDeliveryLocationCreated",
            "customer_delivery_locations",
            db_loc.id,
            {"store_code": store_code, "location_name": location_name, "gstin": resolved_gstin}
        )
        return refreshed or db_loc

    async def update_delivery_location(
        self, customer_id: str, location_id: str, loc_in: CustomerDeliveryLocationUpdate
    ) -> CustomerDeliveryLocation:
        loc = await self.get_delivery_location(customer_id, location_id)

        if loc_in.store_code:
            new_code = loc_in.store_code.strip().upper()
            if new_code != loc.store_code:
                mutex = await _get_store_code_mutex(self.tenant_ctx.company_id, new_code)
                async with mutex:
                    if self.db.bind and hasattr(self.db.bind, "dialect") and self.db.bind.dialect.name == "postgresql":
                        try:
                            lock_key = f"store_code:{self.tenant_ctx.company_id or 'global'}:{new_code}"
                            await self.db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": lock_key})
                        except Exception:
                            pass

                    # Concurrency lock & cross-customer uniqueness check
                    existing_locked = await self.delivery_repo.get_by_store_code(new_code, active_only=False, with_for_update=True)
                    if existing_locked and existing_locked.id != location_id and existing_locked.status == "ACTIVE" and not existing_locked.is_deleted:
                        owning_cust = await self.get_customer(existing_locked.customer_id)
                        cname = owning_cust.name if owning_cust else "another customer"
                        ccode = f" ({owning_cust.code})" if owning_cust and owning_cust.code else ""
                        raise HTTPException(
                            status_code=409,
                            detail={
                                "error_code": "DUPLICATE_STORE_CODE",
                                "decision": "HARD_DUPLICATE",
                                "matched_identity": "STORE_CODE",
                                "reason": f"Store code '{new_code}' is already assigned to customer '{cname}'{ccode}. A Store Code can only belong to one customer profile at a time.",
                                "allow_override": False,
                            }
                        )
                old_code = loc.store_code
                loc.store_code = new_code
                await self._record_audit_event(
                    "StoreCodeChanged",
                    "customer_delivery_locations",
                    location_id,
                    {"old_store_code": old_code, "new_store_code": new_code}
                )

        if loc_in.gst_registration_id is not None:
            if loc_in.gst_registration_id == "":
                loc.gst_registration_id = None
            else:
                gst_reg = await self.gst_repo.get_by_customer_and_id(customer_id, loc_in.gst_registration_id)
                if not gst_reg:
                    raise HTTPException(
                        status_code=400,
                        detail="GST registration does not belong to this customer or does not exist."
                    )
                if not gst_reg.is_active or gst_reg.is_deleted or gst_reg.status != "ACTIVE":
                    raise HTTPException(
                        status_code=400,
                        detail="Selected GST registration is inactive or cancelled."
                    )
                loc.gst_registration_id = loc_in.gst_registration_id
                target_gstin = loc_in.gstin.strip().upper() if loc_in.gstin and loc_in.gstin.strip() else gst_reg.gstin
                if target_gstin != gst_reg.gstin:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Conflicting GSTIN: delivery location GSTIN '{target_gstin}' does not match linked customer GST registration GSTIN '{gst_reg.gstin}'."
                    )
                target_state_code = loc_in.state_code.strip() if loc_in.state_code and loc_in.state_code.strip() else (loc.state_code or gst_reg.state_code)
                if target_state_code and target_state_code != gst_reg.state_code:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Conflicting state code: delivery location state code '{target_state_code}' does not match linked customer GST registration state code '{gst_reg.state_code}'."
                    )
                if loc.gstin != gst_reg.gstin:
                    old_gst = loc.gstin
                    loc.gstin = gst_reg.gstin
                    await self._record_audit_event(
                        "DeliveryGSTINChanged",
                        "customer_delivery_locations",
                        location_id,
                        {"old_gstin": old_gst, "new_gstin": gst_reg.gstin}
                    )
        elif loc_in.gstin is not None:
            input_gstin = loc_in.gstin.strip().upper() if loc_in.gstin.strip() else None
            if loc.gst_registration_id and input_gstin:
                gst_reg = await self.gst_repo.get_by_customer_and_id(customer_id, loc.gst_registration_id)
                if gst_reg and input_gstin != gst_reg.gstin:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Conflicting GSTIN: delivery location GSTIN '{input_gstin}' does not match linked customer GST registration GSTIN '{gst_reg.gstin}'."
                    )
            target_state_code = loc_in.state_code.strip() if loc_in.state_code else loc.state_code
            if input_gstin and target_state_code:
                if input_gstin[:2] != target_state_code:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Delivery GSTIN prefix '{input_gstin[:2]}' does not match state_code '{target_state_code}'."
                    )
            if loc.gstin != input_gstin:
                old_gst = loc.gstin
                loc.gstin = input_gstin
                await self._record_audit_event(
                    "DeliveryGSTINChanged",
                    "customer_delivery_locations",
                    location_id,
                    {"old_gstin": old_gst, "new_gstin": input_gstin}
                )
        elif loc_in.state_code is not None:
            new_state_code = loc_in.state_code.strip() if loc_in.state_code else None
            if loc.gst_registration_id and new_state_code:
                gst_reg = await self.gst_repo.get_by_customer_and_id(customer_id, loc.gst_registration_id)
                if gst_reg and new_state_code != gst_reg.state_code:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Conflicting state code: delivery location state code '{new_state_code}' does not match linked customer GST registration state code '{gst_reg.state_code}'."
                    )
            elif loc.gstin and new_state_code:
                if loc.gstin[:2] != new_state_code:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Delivery state_code '{new_state_code}' does not match existing GSTIN prefix '{loc.gstin[:2]}'."
                    )

        if loc_in.location_name:
            loc.location_name = loc_in.location_name.strip()
        if loc_in.address_line1 is not None:
            loc.address_line1 = loc_in.address_line1
        if loc_in.address_line2 is not None:
            loc.address_line2 = loc_in.address_line2
        if loc_in.city is not None:
            loc.city = loc_in.city or None
        if loc_in.state is not None:
            loc.state = normalize_state(loc_in.state) if loc_in.state else None
        # Phase 5 Prevention: advisory city/state compatibility warning (non-blocking)
        effective_city = loc_in.city if loc_in.city is not None else loc.city
        effective_state = normalize_state(loc_in.state) if loc_in.state is not None else loc.state
        advisory = warn_city_state_mismatch(effective_city, effective_state)
        if advisory:
            import logging as _logging
            _logging.getLogger(__name__).warning(
                "CRM city/state advisory on delivery_location %s: %s", location_id, advisory
            )
        if loc_in.state_code is not None:
            loc.state_code = loc_in.state_code
        if loc_in.pincode is not None:
            loc.pincode = loc_in.pincode
        if loc_in.country is not None:
            loc.country = loc_in.country
        if loc_in.contact_person is not None:
            loc.contact_person = loc_in.contact_person
        if loc_in.phone is not None:
            loc.phone = loc_in.phone
        if loc_in.email is not None:
            loc.email = loc_in.email
        if loc_in.remarks is not None:
            loc.remarks = loc_in.remarks

        if loc_in.status:
            status_val = loc_in.status.upper()
            loc.status = status_val
            if status_val == "INACTIVE":
                loc.is_active = False
            elif status_val == "ACTIVE":
                loc.is_active = True

        loc.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        refreshed = await self.delivery_repo.get(loc.id)
        await self._record_audit_event(
            "CustomerDeliveryLocationUpdated",
            "customer_delivery_locations",
            location_id,
            {"updated_fields": list(loc_in.model_dump(exclude_unset=True).keys())}
        )
        return refreshed or loc

    async def delete_delivery_location(
        self, customer_id: str, location_id: str
    ) -> Dict[str, str]:
        loc = await self.get_delivery_location(customer_id, location_id)
        # Check if referenced by issued invoices
        stmt = select(func.count()).select_from(SalesInvoice).filter(SalesInvoice.delivery_location_id == location_id)
        res = await self.db.execute(stmt)
        inv_count = res.scalar() or 0

        loc.is_deleted = True
        loc.is_active = False
        loc.status = "INACTIVE"
        loc.deleted_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self._record_audit_event(
            "CustomerDeliveryLocationDeactivated",
            "customer_delivery_locations",
            location_id,
            {"invoice_references": inv_count}
        )
        return {"status": "success", "message": f"Customer delivery location '{location_id}' deactivated."}

    async def search_delivery_locations(
        self,
        q: Optional[str] = None,
        customer_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[CustomerDeliveryLocation]:
        return await self.delivery_repo.search(q=q, customer_id=customer_id, skip=skip, limit=limit)

    async def set_default_delivery_location(
        self, customer_id: str, location_id: str
    ) -> CustomerDeliveryLocation:
        loc = await self.get_delivery_location(customer_id, location_id)
        if not loc.is_active or loc.is_deleted or loc.status != "ACTIVE":
            raise HTTPException(
                status_code=400,
                detail="Cannot set an inactive delivery location as default."
            )
        await self.delivery_repo.clear_default_flags(customer_id, exclude_id=location_id)
        loc.is_default = True
        loc.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(loc)
        await self._record_audit_event(
            "CustomerDeliveryLocationDefaultChanged",
            "customer_delivery_locations",
            loc.id,
            {"store_code": loc.store_code}
        )
        return loc

    # --- Store Typed Addresses & Store Code Lookup Methods ---

    def _extract_store_addresses(self, loc: CustomerDeliveryLocation) -> List[dict]:
        meta = loc.metadata_json or {}
        raw = meta.get("addresses")
        if raw and isinstance(raw, list) and len(raw) > 0:
            return raw
        # Synthesize fallback canonical address from loc fields
        return [
            {
                "id": f"addr-{loc.id}",
                "address_type": "Delivery",
                "address_title": "Primary Store Front",
                "address_line1": loc.address_line1 or loc.location_name,
                "address_line2": loc.address_line2,
                "locality": None,
                "city": loc.city or "Mumbai",
                "district": None,
                "state": loc.state or "Maharashtra",
                "state_code": loc.state_code,
                "pincode": loc.pincode or "400001",
                "country": loc.country or "India",
                "contact_person": loc.contact_person,
                "phone": loc.phone,
                "email": loc.email,
                "is_primary": True,
                "is_active": True,
                "created_at": loc.created_at.isoformat() if loc.created_at else datetime.now(timezone.utc).isoformat(),
                "updated_at": loc.modified_at.isoformat() if loc.modified_at else datetime.now(timezone.utc).isoformat(),
            }
        ]

    async def list_store_addresses(
        self, customer_id: str, location_id: str
    ) -> List[StoreAddressItem]:
        loc = await self.get_delivery_location(customer_id, location_id)
        raw_list = self._extract_store_addresses(loc)
        return [StoreAddressItem.model_validate(a) for a in raw_list]

    async def add_store_address(
        self, customer_id: str, location_id: str, addr_in: StoreAddressCreate
    ) -> StoreAddressItem:
        loc = await self.get_delivery_location(customer_id, location_id, with_for_update=True)
        raw_list = list(self._extract_store_addresses(loc))

        # If new address is primary, reset is_primary on existing active addresses of same type
        if addr_in.is_primary:
            for a in raw_list:
                if a.get("address_type") == addr_in.address_type and a.get("is_active", True):
                    a["is_primary"] = False

        new_addr_dict = {
            "id": f"addr-{uuid.uuid4().hex[:12]}",
            "address_type": addr_in.address_type,
            "address_title": addr_in.address_title,
            "address_line1": addr_in.address_line1,
            "address_line2": addr_in.address_line2,
            "locality": addr_in.locality,
            "city": addr_in.city,
            "district": addr_in.district,
            "state": addr_in.state,
            "state_code": addr_in.state_code,
            "pincode": addr_in.pincode,
            "country": addr_in.country or "India",
            "contact_person": addr_in.contact_person,
            "phone": addr_in.phone,
            "email": addr_in.email,
            "is_primary": bool(addr_in.is_primary),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        raw_list.append(new_addr_dict)

        # Sync back to location fields if this is primary Delivery address
        if addr_in.is_primary and addr_in.address_type in ("Delivery", "Billing"):
            loc.address_line1 = addr_in.address_line1
            loc.address_line2 = addr_in.address_line2
            loc.city = addr_in.city
            loc.state = addr_in.state
            loc.state_code = addr_in.state_code
            loc.pincode = addr_in.pincode
            if addr_in.contact_person:
                loc.contact_person = addr_in.contact_person
            if addr_in.phone:
                loc.phone = addr_in.phone
            if addr_in.email:
                loc.email = addr_in.email

        meta = dict(loc.metadata_json or {})
        meta["addresses"] = raw_list
        loc.metadata_json = meta
        loc.modified_at = datetime.now(timezone.utc)
        await self.db.commit()

        await self._record_audit_event(
            "StoreAddressAdded",
            "customer_delivery_locations",
            location_id,
            {"address_id": new_addr_dict["id"], "address_type": addr_in.address_type}
        )
        return StoreAddressItem.model_validate(new_addr_dict)

    async def update_store_address(
        self, customer_id: str, location_id: str, address_id: str, addr_in: StoreAddressUpdate
    ) -> StoreAddressItem:
        loc = await self.get_delivery_location(customer_id, location_id, with_for_update=True)
        raw_list = list(self._extract_store_addresses(loc))

        target = None
        for a in raw_list:
            if a.get("id") == address_id:
                target = a
                break

        if not target:
            raise HTTPException(status_code=404, detail=f"Address '{address_id}' not found on store '{loc.store_code}'.")

        # Check primary reset
        target_type = addr_in.address_type or target.get("address_type")
        if addr_in.is_primary:
            for a in raw_list:
                if a.get("id") != address_id and a.get("address_type") == target_type and a.get("is_active", True):
                    a["is_primary"] = False

        # Apply updates
        update_data = addr_in.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            if v is not None:
                target[k] = v
        target["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Sync location base fields if target is primary Delivery
        if target.get("is_primary") and target.get("address_type") in ("Delivery", "Billing") and target.get("is_active", True):
            loc.address_line1 = target.get("address_line1")
            loc.address_line2 = target.get("address_line2")
            loc.city = target.get("city")
            loc.state = target.get("state")
            loc.state_code = target.get("state_code")
            loc.pincode = target.get("pincode")
            if target.get("contact_person"):
                loc.contact_person = target.get("contact_person")
            if target.get("phone"):
                loc.phone = target.get("phone")
            if target.get("email"):
                loc.email = target.get("email")

        meta = dict(loc.metadata_json or {})
        meta["addresses"] = raw_list
        loc.metadata_json = meta
        loc.modified_at = datetime.now(timezone.utc)
        await self.db.commit()

        await self._record_audit_event(
            "StoreAddressUpdated",
            "customer_delivery_locations",
            location_id,
            {"address_id": address_id}
        )
        return StoreAddressItem.model_validate(target)

    async def deactivate_store_address(
        self, customer_id: str, location_id: str, address_id: str
    ) -> StoreAddressItem:
        loc = await self.get_delivery_location(customer_id, location_id, with_for_update=True)
        raw_list = list(self._extract_store_addresses(loc))

        target = None
        for a in raw_list:
            if a.get("id") == address_id:
                target = a
                break

        if not target:
            raise HTTPException(status_code=404, detail=f"Address '{address_id}' not found on store '{loc.store_code}'.")

        # Soft deactivation: preserves historical address records
        target["is_active"] = False
        target["is_primary"] = False
        target["updated_at"] = datetime.now(timezone.utc).isoformat()

        meta = dict(loc.metadata_json or {})
        meta["addresses"] = raw_list
        loc.metadata_json = meta
        loc.modified_at = datetime.now(timezone.utc)
        await self.db.commit()

        await self._record_audit_event(
            "StoreAddressDeactivated",
            "customer_delivery_locations",
            location_id,
            {"address_id": address_id}
        )
        return StoreAddressItem.model_validate(target)

    async def list_store_code_lookup(
        self,
        q: Optional[str] = None,
        current_customer_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[StoreCodeLookupItem]:
        """
        Master Store Code Lookup endpoint supporting:
        1. All codes in the tenant.
        2. Codes assigned to other customers remain visible but disabled (is_selectable=False)
           with descriptive message 'Already mapped to [Customer Name] ([Code])'.
        3. Codes belonging to current_customer_id remain selectable (is_selectable=True).
        """
        results = await self.delivery_repo.search_store_code_lookup(q=q, skip=skip, limit=limit)
        items: List[StoreCodeLookupItem] = []

        for loc, cust in results:
            addresses = self._extract_store_addresses(loc)
            primary_addr = next((a for a in addresses if a.get("is_primary") and a.get("is_active", True)), addresses[0] if addresses else None)
            addr_summary = (
                f"{primary_addr.get('address_line1', '')}, {primary_addr.get('city', '')} - {primary_addr.get('pincode', '')}"
                if primary_addr
                else (loc.address_line1 or loc.location_name or "—")
            )

            is_assigned = bool(loc.customer_id)
            cust_name = cust.name if cust else None
            cust_code = cust.code if cust else None

            if not is_assigned:
                is_selectable = True
                disabled_reason = None
            elif current_customer_id and loc.customer_id == current_customer_id:
                # Own customer's assigned store code: selectable
                is_selectable = True
                disabled_reason = None
            else:
                # Assigned to another customer: visible but disabled
                is_selectable = False
                desc = f"Already mapped to {cust_name or 'another customer'}"
                if cust_code:
                    desc += f" ({cust_code})"
                disabled_reason = desc

            items.append(StoreCodeLookupItem(
                id=loc.id,
                store_code=loc.store_code,
                store_name=loc.location_name,
                city=loc.city or "Mumbai",
                state=loc.state,
                store_type="Supermarket",
                status="Active" if (loc.status == "ACTIVE" and loc.is_active) else "Inactive",
                address_summary=addr_summary,
                assigned_customer_id=loc.customer_id,
                assigned_customer_name=cust_name,
                assigned_customer_code=cust_code,
                is_assigned=is_assigned,
                is_selectable=is_selectable,
                disabled_reason=disabled_reason,
                addresses_count=len([a for a in addresses if a.get("is_active", True)]),
                psv_value=Decimal("0.00"),
            ))

        return items

    # --- Customer Billing Location Methods ---

    async def list_billing_locations(
        self, customer_id: str, include_inactive: bool = False
    ) -> List[CustomerBillingLocation]:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        return await self.billing_repo.get_all_for_customer(customer_id, include_inactive=include_inactive)

    async def get_billing_location(
        self, customer_id: str, location_id: str
    ) -> CustomerBillingLocation:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        loc = await self.billing_repo.get_by_customer_and_id(customer_id, location_id)
        if not loc:
            raise HTTPException(status_code=404, detail=f"Customer billing location '{location_id}' not found.")
        return loc

    async def create_billing_location(
        self, customer_id: str, loc_in: CustomerBillingLocationCreate
    ) -> CustomerBillingLocation:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        billing_store_code = loc_in.billing_store_code.strip().upper()

        # Check duplicate billing store code for customer
        dup_check = await self.identity_service.check_duplicate_billing_location(
            customer_id=customer_id,
            billing_store_code=billing_store_code,
        )
        if dup_check.decision == DuplicateDecision.HARD_DUPLICATE:
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "DUPLICATE_BILLING_STORE_CODE",
                    "decision": dup_check.decision.value,
                    "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                    "reason": dup_check.reason,
                    "allow_override": False,
                }
            )

        if loc_in.is_default:
            await self.billing_repo.clear_default_flags(customer_id)

        if loc_in.gst_registration_id:
            gst_reg = await self.gst_repo.get_by_customer_and_id(customer_id, loc_in.gst_registration_id)
            if not gst_reg or not gst_reg.is_active or gst_reg.is_deleted or gst_reg.status != "ACTIVE":
                raise HTTPException(
                    status_code=400,
                    detail="Selected GST registration is invalid or inactive."
                )

        loc_id = loc_in.id or f"cbl-{uuid.uuid4().hex[:8]}"
        db_loc = CustomerBillingLocation(
            id=loc_id,
            customer_id=customer_id,
            billing_store_code=billing_store_code,
            location_name=loc_in.location_name.strip() if loc_in.location_name else "Billing Location",
            gst_registration_id=loc_in.gst_registration_id,
            gstin=loc_in.gstin,
            address_line1=loc_in.address_line1.strip(),
            address_line2=loc_in.address_line2.strip() if loc_in.address_line2 else None,
            city=loc_in.city.strip(),
            state=loc_in.state.strip(),
            state_code=loc_in.state_code.strip() if loc_in.state_code else None,
            pincode=loc_in.pincode.strip(),
            country=loc_in.country or "India",
            contact_person=loc_in.contact_person,
            email=loc_in.email,
            phone=loc_in.phone,
            is_default=bool(loc_in.is_default),
            status=loc_in.status or "ACTIVE",
            source=loc_in.source or "MANUAL",
            remarks=loc_in.remarks,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            is_deleted=False,
        )
        self.db.add(db_loc)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Customer billing location could not be created due to duplicate billing store code or integrity constraints."
            )

        refreshed = await self.billing_repo.get(db_loc.id)
        await self._record_audit_event(
            "CustomerBillingLocationCreated",
            "customer_billing_locations",
            db_loc.id,
            {"billing_store_code": billing_store_code, "location_name": loc_in.location_name}
        )
        return refreshed or db_loc

    async def update_billing_location(
        self, customer_id: str, location_id: str, loc_in: CustomerBillingLocationUpdate
    ) -> CustomerBillingLocation:
        loc = await self.get_billing_location(customer_id, location_id)

        if loc_in.billing_store_code:
            new_code = loc_in.billing_store_code.strip().upper()
            if new_code != loc.billing_store_code:
                existing = await self.billing_repo.get_by_customer_and_billing_store_code(customer_id, new_code, active_only=True)
                if existing and existing.id != location_id:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Billing location with store code '{new_code}' already exists for this customer."
                    )
                loc.billing_store_code = new_code

        if loc_in.is_default is True and not loc.is_default:
            await self.billing_repo.clear_default_flags(customer_id, exclude_id=location_id)
            loc.is_default = True

        for field in ("location_name", "gst_registration_id", "gstin", "address_line1", "address_line2",
                      "city", "state", "state_code", "pincode", "country", "contact_person",
                      "email", "phone", "status", "remarks"):
            val = getattr(loc_in, field, None)
            if val is not None:
                setattr(loc, field, val)

        loc.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        refreshed = await self.billing_repo.get(loc.id)
        return refreshed or loc

    async def set_default_billing_location(
        self, customer_id: str, location_id: str
    ) -> CustomerBillingLocation:
        loc = await self.get_billing_location(customer_id, location_id)
        if loc.status != "ACTIVE" or loc.is_deleted:
            raise HTTPException(
                status_code=400,
                detail="Cannot set an inactive billing location as default."
            )
        await self.billing_repo.clear_default_flags(customer_id, exclude_id=location_id)
        loc.is_default = True
        loc.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(loc)
        await self._record_audit_event(
            "CustomerBillingLocationDefaultChanged",
            "customer_billing_locations",
            loc.id,
            {"billing_store_code": loc.billing_store_code}
        )
        return loc

    async def delete_billing_location(
        self, customer_id: str, location_id: str
    ) -> Dict[str, str]:
        loc = await self.get_billing_location(customer_id, location_id)
        loc.is_deleted = True
        loc.status = "INACTIVE"
        loc.is_default = False
        loc.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self._record_audit_event(
            "CustomerBillingLocationDeactivated",
            "customer_billing_locations",
            location_id,
            {"billing_store_code": loc.billing_store_code}
        )
        return {"status": "success", "message": f"Customer billing location '{location_id}' deactivated."}

    # --- Customer External Identity Methods ---

    async def list_external_identities(
        self, customer_id: str, include_inactive: bool = False
    ) -> List[CustomerExternalIdentity]:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        return await self.ext_ident_repo.get_all_for_customer(customer_id, include_inactive=include_inactive)

    async def create_external_identity(
        self, customer_id: str, ext_in: CustomerExternalIdentityCreate
    ) -> CustomerExternalIdentity:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        # Check duplicate external identity
        dup_check = await self.identity_service.check_duplicate_external_identity(
            customer_id=customer_id,
            source_system=ext_in.source_system,
            external_type=ext_in.external_type,
            external_code=ext_in.external_code,
        )
        if dup_check.decision == DuplicateDecision.HARD_DUPLICATE:
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "DUPLICATE_EXTERNAL_IDENTITY",
                    "decision": dup_check.decision.value,
                    "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                    "reason": dup_check.reason,
                    "existing_customer": dup_check.existing_customer.model_dump() if dup_check.existing_customer else None,
                    "allow_override": False,
                }
            )

        ident_id = ext_in.id or f"cei-{uuid.uuid4().hex[:8]}"
        db_ident = CustomerExternalIdentity(
            id=ident_id,
            customer_id=customer_id,
            source_system=ext_in.source_system.strip().upper(),
            external_type=ext_in.external_type.strip().upper(),
            external_code=ext_in.external_code.strip(),
            metadata_json=ext_in.metadata_json,
            status=ext_in.status or "ACTIVE",
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            is_deleted=False,
        )
        self.db.add(db_ident)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Customer external identity could not be created due to composite uniqueness conflict."
            )

        await self.db.refresh(db_ident)
        await self._record_audit_event(
            "CustomerExternalIdentityCreated",
            "customer_external_identities",
            db_ident.id,
            {"source_system": db_ident.source_system, "external_code": db_ident.external_code}
        )
        return db_ident

    async def delete_external_identity(
        self, customer_id: str, identity_id: str
    ) -> Dict[str, str]:
        stmt = select(CustomerExternalIdentity).filter(
            CustomerExternalIdentity.id == identity_id,
            CustomerExternalIdentity.customer_id == customer_id,
            CustomerExternalIdentity.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter(CustomerExternalIdentity.company_id == self.tenant_ctx.company_id)
        res = await self.db.execute(stmt)
        ident = res.scalars().first()
        if not ident:
            raise HTTPException(status_code=404, detail="External identity not found.")
        ident.is_deleted = True
        ident.status = "INACTIVE"
        ident.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return {"status": "success", "message": f"External identity '{identity_id}' removed."}

    # ─── Customer Company Relationship Methods & Cross-Company Group Guard ───

    async def _validate_customer_group_company(self, customer_group_id: Optional[str], company_id: str) -> None:
        """
        Application-level cross-company CustomerGroup guard (Blocker 4 / BD-1).
        Asserts that the customer group belongs to the exact same legal entity (company_id)
        as the customer_company_relationship to prevent cross-company commercial/pricing contamination.
        """
        if not customer_group_id:
            return
        stmt = select(CustomerGroup).filter(CustomerGroup.id == customer_group_id, CustomerGroup.is_deleted == False)
        res = await self.db.execute(stmt)
        group = res.scalars().first()
        if not group:
            raise HTTPException(status_code=404, detail=f"Customer group '{customer_group_id}' not found.")
        if group.company_id and group.company_id != company_id:
            raise HTTPException(
                status_code=422,
                detail=f"Customer group '{customer_group_id}' belongs to company '{group.company_id}', not relationship company '{company_id}'. Cross-company customer group assignment is prohibited.",
            )

    async def create_company_relationship(
        self, customer_id: str, rel_in: CustomerCompanyRelationshipCreate
    ) -> CustomerCompanyRelationship:
        # Validate customer exists
        cust = await self.get_customer(customer_id)
        if not cust:
            raise HTTPException(status_code=404, detail="Customer not found.")

        # Cross-company group guard
        await self._validate_customer_group_company(rel_in.customer_group_id, rel_in.company_id)

        rel_id = f"ccr-{uuid.uuid4().hex[:16]}"
        db_rel = CustomerCompanyRelationship(
            id=rel_id,
            uuid=str(uuid.uuid4()),
            customer_id=customer_id,
            company_id=rel_in.company_id,
            branch_id=rel_in.branch_id or self.tenant_ctx.branch_id,
            customer_group_id=rel_in.customer_group_id,
            price_tier_id=rel_in.price_tier_id,
            credit_limit=rel_in.credit_limit or Decimal("0.00"),
            credit_days=rel_in.credit_days or 0,
            credit_hold=rel_in.credit_hold or False,
            status=rel_in.status or "Active",
            is_active=True,
            is_deleted=False,
            created_by=self.tenant_ctx.user_id if hasattr(self.tenant_ctx, "user_id") else "system",
        )
        self.db.add(db_rel)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=409,
                detail=f"A relationship between customer '{customer_id}' and company '{rel_in.company_id}' already exists.",
            )

        await self.db.refresh(db_rel)
        await self._record_audit_event(
            "CustomerCompanyRelationshipCreated",
            "customer_company_relationships",
            db_rel.id,
            {"customer_id": customer_id, "company_id": rel_in.company_id, "customer_group_id": rel_in.customer_group_id},
        )
        return db_rel

    async def update_company_relationship(
        self, customer_id: str, relationship_id: str, rel_in: CustomerCompanyRelationshipUpdate
    ) -> CustomerCompanyRelationship:
        stmt = select(CustomerCompanyRelationship).filter(
            CustomerCompanyRelationship.id == relationship_id,
            CustomerCompanyRelationship.customer_id == customer_id,
            CustomerCompanyRelationship.is_deleted == False,
        )
        res = await self.db.execute(stmt)
        rel = res.scalars().first()
        if not rel:
            raise HTTPException(status_code=404, detail="Customer company relationship not found.")

        # Cross-company group guard
        if rel_in.customer_group_id is not None:
            await self._validate_customer_group_company(rel_in.customer_group_id, rel.company_id)
            rel.customer_group_id = rel_in.customer_group_id

        if rel_in.price_tier_id is not None:
            rel.price_tier_id = rel_in.price_tier_id
        if rel_in.credit_limit is not None:
            rel.credit_limit = rel_in.credit_limit
        if rel_in.credit_days is not None:
            rel.credit_days = rel_in.credit_days
        if rel_in.credit_hold is not None:
            rel.credit_hold = rel_in.credit_hold
        if rel_in.status is not None:
            rel.status = rel_in.status

        rel.modified_at = datetime.now(timezone.utc)
        rel.updated_by = self.tenant_ctx.user_id if hasattr(self.tenant_ctx, "user_id") else "system"

        await self.db.commit()
        await self.db.refresh(rel)
        await self._record_audit_event(
            "CustomerCompanyRelationshipUpdated",
            "customer_company_relationships",
            rel.id,
            {"customer_id": customer_id, "company_id": rel.company_id},
        )
        return rel

    async def list_company_relationships(
        self, customer_id: str
    ) -> List[CustomerCompanyRelationship]:
        stmt = select(CustomerCompanyRelationship).filter(
            CustomerCompanyRelationship.customer_id == customer_id,
            CustomerCompanyRelationship.is_deleted == False,
        ).order_by(CustomerCompanyRelationship.created_at.desc())
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_company_relationship(
        self, customer_id: str, company_id: str
    ) -> Optional[CustomerCompanyRelationship]:
        stmt = select(CustomerCompanyRelationship).filter(
            CustomerCompanyRelationship.customer_id == customer_id,
            CustomerCompanyRelationship.company_id == company_id,
            CustomerCompanyRelationship.is_deleted == False,
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    # ─── Corporate Customer Merge & Consolidation (BD-2) ───────────────────

    async def merge_customer(
        self,
        target_id: str,
        source_id: str,
        reason: Optional[str] = None,
        actor_user_id: Optional[str] = None,
        actor_role: Optional[str] = None,
    ) -> CustomerMergeResponse:
        """
        Authoritative Corporate Customer Merge & Consolidation (BD-2).
        Enforces strict BD-2 PAN parity, reconciles GST registrations, delivery locations,
        billing locations, Model C company relationships, reassigns transactional history
        across operational tables, soft-retires source, and records a tamper-evident WORM audit log.
        """
        if target_id == source_id:
            raise HTTPException(status_code=400, detail="Cannot merge customer into itself.")

        # 1. Fetch Target and Source with all child entities loaded
        stmt_t = (
            select(Customer)
            .where(Customer.id == target_id)
            .options(
                selectinload(Customer.gst_registrations),
                selectinload(Customer.delivery_locations),
                selectinload(Customer.billing_locations),
                selectinload(Customer.external_identities),
                selectinload(Customer.company_relationships),
            )
        )
        res_t = await self.db.execute(stmt_t)
        target = res_t.scalars().first()
        if not target:
            raise HTTPException(status_code=404, detail=f"Target customer '{target_id}' not found.")

        stmt_s = (
            select(Customer)
            .where(Customer.id == source_id)
            .options(
                selectinload(Customer.gst_registrations),
                selectinload(Customer.delivery_locations),
                selectinload(Customer.billing_locations),
                selectinload(Customer.external_identities),
                selectinload(Customer.company_relationships),
            )
        )
        res_s = await self.db.execute(stmt_s)
        source = res_s.scalars().first()
        if not source:
            raise HTTPException(status_code=404, detail=f"Source customer '{source_id}' not found.")

        if source.status == "Merged":
            raise HTTPException(
                status_code=400,
                detail=f"Source customer '{source_id}' has already been merged into an authoritative master.",
            )

        # 2. Enforce BD-2 PAN Parity Guard
        t_pan = (getattr(target, "pan_number", None) or getattr(target, "pan", None) or "").strip().upper()
        s_pan = (getattr(source, "pan_number", None) or getattr(source, "pan", None) or "").strip().upper()
        if t_pan and s_pan and t_pan != s_pan:
            raise HTTPException(
                status_code=400,
                detail=f"Corporate Customer Merge blocked (BD-2 PAN Parity Violation): Source customer PAN '{s_pan}' does not match target customer PAN '{t_pan}'. Merging entities across distinct PANs is prohibited.",
            )

        # Adopt source PAN / GSTIN / email if target lacks them
        if not t_pan and s_pan:
            target.pan_number = s_pan
        t_gst = (getattr(target, "gst_number", None) or getattr(target, "gstin", None) or "").strip().upper()
        s_gst = (getattr(source, "gst_number", None) or getattr(source, "gstin", None) or "").strip().upper()
        if not t_gst and s_gst:
            target.gst_number = s_gst
        if not (target.email or "").strip() and (source.email or "").strip():
            target.email = source.email.strip()

        reassigned_counts: Dict[str, int] = {}

        # 3. Consolidate GST Registrations
        target_gstins = {r.gstin.upper() for r in (target.gst_registrations or []) if not r.is_deleted}
        gst_reassigned = 0
        for s_reg in (source.gst_registrations or []):
            if s_reg.is_deleted:
                continue
            if s_reg.gstin.upper() in target_gstins:
                s_reg.is_deleted = True
                s_reg.status = "MERGED"
            else:
                s_reg.customer_id = target.id
                s_reg.is_primary = False
                target_gstins.add(s_reg.gstin.upper())
                gst_reassigned += 1
        reassigned_counts["customer_gst_registrations"] = gst_reassigned

        # 4. Consolidate Delivery Locations (Store code collision avoidance)
        target_dl_codes = {dl.store_code.upper() for dl in (target.delivery_locations or []) if not dl.is_deleted and dl.store_code}
        dl_reassigned = 0
        for s_dl in (source.delivery_locations or []):
            if s_dl.is_deleted:
                continue
            code_upper = (s_dl.store_code or "").upper()
            if code_upper in target_dl_codes:
                s_dl.store_code = f"{s_dl.store_code}_{source.id[:6].upper()}"
            s_dl.customer_id = target.id
            s_dl.is_default = False
            target_dl_codes.add(s_dl.store_code.upper())
            dl_reassigned += 1
        reassigned_counts["customer_delivery_locations"] = dl_reassigned

        # 5. Consolidate Billing Locations (Store code collision avoidance)
        target_bl_codes = {bl.billing_store_code.upper() for bl in (target.billing_locations or []) if not bl.is_deleted and bl.billing_store_code}
        bl_reassigned = 0
        for s_bl in (source.billing_locations or []):
            if s_bl.is_deleted:
                continue
            code_upper = (s_bl.billing_store_code or "").upper()
            if code_upper in target_bl_codes:
                s_bl.billing_store_code = f"{s_bl.billing_store_code}_{source.id[:6].upper()}"
            s_bl.customer_id = target.id
            s_bl.is_default = False
            target_bl_codes.add(s_bl.billing_store_code.upper())
            bl_reassigned += 1
        reassigned_counts["customer_billing_locations"] = bl_reassigned

        # 6. Consolidate External Identities
        target_ext_keys = {(ei.source_system.upper(), ei.external_code.upper()) for ei in (target.external_identities or []) if not ei.is_deleted}
        ext_reassigned = 0
        for s_ext in (source.external_identities or []):
            if s_ext.is_deleted:
                continue
            ext_key = (s_ext.source_system.upper(), s_ext.external_code.upper())
            if ext_key in target_ext_keys:
                s_ext.is_deleted = True
                s_ext.status = "MERGED"
            else:
                s_ext.customer_id = target.id
                target_ext_keys.add(ext_key)
                ext_reassigned += 1
        reassigned_counts["customer_external_identities"] = ext_reassigned

        # 7. Consolidate Model C CustomerCompanyRelationships
        target_rel_companies = {r.company_id for r in (target.company_relationships or []) if not r.is_deleted}
        ccr_reassigned = 0
        for s_rel in (source.company_relationships or []):
            if s_rel.is_deleted:
                continue
            if s_rel.company_id in target_rel_companies:
                s_rel.is_deleted = True
                s_rel.is_active = False
                s_rel.status = "Merged"
            else:
                s_rel.customer_id = target.id
                target_rel_companies.add(s_rel.company_id)
                ccr_reassigned += 1
        reassigned_counts["customer_company_relationships"] = ccr_reassigned

        # 8. Reassign Operational and Transactional Tables via direct SQL
        table_mappings = [
            ("sales_invoices", "customer_id"),
            ("sales_orders", "customer_id"),
            ("sales_returns", "customer_id"),
            ("customer_credit_ledger_entries", "customer_id"),
            ("customer_purchase_orders", "customer_id"),
            ("psv_parties", "host_customer_id"),
            ("crm_customer_activities", "customer_id"),
            ("crm_opportunities", "customer_id"),
            ("loyalty_transactions", "customer_id"),
            ("referral_relationships", "referred_customer_id"),
        ]

        for tbl, col in table_mappings:
            try:
                res = await self.db.execute(
                    text(f"UPDATE {tbl} SET {col} = :target_id WHERE {col} = :source_id"),
                    {"target_id": target.id, "source_id": source.id},
                )
                reassigned_counts[tbl] = res.rowcount
            except Exception:
                reassigned_counts[tbl] = 0

        try:
            res_lm = await self.db.execute(
                text("UPDATE loyalty_members SET customer_id = :target_id WHERE customer_id = :source_id"),
                {"target_id": target.id, "source_id": source.id},
            )
            reassigned_counts["loyalty_members"] = res_lm.rowcount
        except Exception:
            reassigned_counts["loyalty_members"] = 0

        # 9. Consolidate Financial Balances and Soft-Retire Source
        target.outstanding = (target.outstanding or Decimal("0.00")) + (source.outstanding or Decimal("0.00"))
        source.outstanding = Decimal("0.00")
        source.status = "Merged"
        source.is_deleted = True
        source.deleted_at = datetime.now(timezone.utc)
        source.deleted_by = actor_user_id or "system"

        now_iso = datetime.now(timezone.utc).isoformat()
        reason_str = reason or "BD-2 Corporate Consolidation"
        source.profile_notes = f"{source.profile_notes or ''}\n[MERGED into {target.id} ({target.code or ''}) at {now_iso} - Reason: {reason_str}]".strip()
        target.profile_notes = f"{target.profile_notes or ''}\n[MERGED customer {source.id} ({source.code or ''}) into this record at {now_iso} - Reason: {reason_str}]".strip()
        source.modified_at = datetime.now(timezone.utc)
        target.modified_at = datetime.now(timezone.utc)

        # 10. Record Cryptographic WORM Immutable Audit Log
        payload_data = {
            "operation": "CUSTOMER_CONSOLIDATION_MERGE",
            "target_customer_id": target.id,
            "source_customer_id": source.id,
            "reason": reason_str,
            "reassigned_counts": reassigned_counts,
            "actor_user_id": actor_user_id,
            "actor_role": actor_role,
            "company_id": self.tenant_ctx.company_id,
            "branch_id": self.tenant_ctx.branch_id,
        }
        serialized = json.dumps(payload_data, sort_keys=True, default=str)
        payload_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        last_stmt = (
            select(ComplianceImmutableAuditLog)
            .order_by(ComplianceImmutableAuditLog.created_at.desc())
            .limit(1)
        )
        if self.tenant_ctx.company_id:
            last_stmt = last_stmt.where(ComplianceImmutableAuditLog.company_id == self.tenant_ctx.company_id)
        last_entry = (await self.db.execute(last_stmt)).scalars().first()
        previous_hash = last_entry.payload_hash if last_entry else None

        audit_entry = ComplianceImmutableAuditLog(
            id=f"audit_{uuid.uuid4().hex[:16]}",
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            event_type="CUSTOMER_MERGE",
            entity_name="CUSTOMER",
            entity_id=target.id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action_summary=f"Corporate customer merge: absorbed source '{source.id}' into target '{target.id}'. Reason: {reason_str}. Reassigned records: {json.dumps(reassigned_counts)}.",
            payload_hash=payload_hash,
            previous_hash=previous_hash,
            hash_chain_verified=True,
            request_id=f"req_{uuid.uuid4().hex[:12]}",
            retention_policy="STATUTORY_7_YEARS",
            worm_locked=True,
            timestamp=datetime.now(timezone.utc),
        )
        self.db.add(audit_entry)

        # Commit transaction atomically
        await self.db.commit()

        return CustomerMergeResponse(
            target_customer_id=target.id,
            source_customer_id=source.id,
            status="merged",
            message=f"Customer '{source.name}' ({source.id}) successfully consolidated into '{target.name}' ({target.id}).",
            reassigned_records=reassigned_counts,
            merged_at=datetime.now(timezone.utc),
        )

    # ─── Consolidated Customer Credit Exposure & Treasury Monitoring (BD-6) ──

    async def get_customer_credit_exposure(
        self, customer_id: str, include_inactive: bool = False
    ) -> CustomerCreditExposureResponse:
        """
        Consolidated Group Credit Exposure & Treasury Monitoring (BD-6).
        Aggregates multi-company commercial credit relationships, queries ledger balances
        across all operating legal entities, computes consolidated exposure metrics,
        and evaluates enterprise treasury credit risk tiers.
        """
        stmt = (
            select(Customer)
            .where(Customer.id == customer_id, Customer.is_deleted == False)
            .options(
                selectinload(Customer.company_relationships),
            )
        )
        res = await self.db.execute(stmt)
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        # Determine active relationships
        rels = [
            r for r in (customer.company_relationships or [])
            if not r.is_deleted and (include_inactive or (r.is_active and r.status == "Active"))
        ]

        # Extract company IDs
        company_ids = {r.company_id for r in rels if r.company_id}
        if not company_ids:
            primary_comp = customer.company_id or customer.company_code or "COMP-001"
            company_ids.add(primary_comp)

        # Bulk fetch company metadata for human-friendly names
        companies_stmt = select(Company.id, Company.name, Company.company_code).where(
            Company.id.in_(company_ids)
        )
        comp_res = await self.db.execute(companies_stmt)
        company_map: Dict[str, Dict[str, Any]] = {
            row[0]: {"name": row[1], "code": row[2]} for row in comp_res.all()
        }

        # Build company exposure list
        company_exposures: List[CompanyCreditExposureItem] = []

        if rels:
            for rel in rels:
                cid = rel.company_id
                comp_info = company_map.get(cid, {})

                # Query latest balance from CustomerCreditLedgerEntry
                stmt_ccle = (
                    select(CustomerCreditLedgerEntry.balance_after)
                    .where(
                        CustomerCreditLedgerEntry.customer_id == customer_id,
                        CustomerCreditLedgerEntry.company_id == cid,
                        CustomerCreditLedgerEntry.is_deleted == False,
                    )
                    .order_by(
                        CustomerCreditLedgerEntry.entry_date.desc(),
                        CustomerCreditLedgerEntry.created_at.desc(),
                    )
                    .limit(1)
                )
                ccle_bal = (await self.db.execute(stmt_ccle)).scalar_one_or_none()

                if ccle_bal is not None:
                    credit_used = Decimal(str(ccle_bal))
                elif cid == (customer.company_id or customer.company_code):
                    credit_used = Decimal(str(customer.outstanding or "0.00"))
                else:
                    credit_used = Decimal("0.00")

                credit_limit = Decimal(str(rel.credit_limit or "0.00"))
                credit_days = rel.credit_days or 0
                credit_hold = bool(rel.credit_hold)
                available_credit = max(Decimal("0.00"), credit_limit - credit_used)

                if credit_limit > Decimal("0.00"):
                    utilization_percent = float(round((credit_used / credit_limit) * 100, 2))
                else:
                    utilization_percent = 0.0

                if credit_hold:
                    exposure_status = "ON_HOLD"
                elif credit_limit > Decimal("0.00") and credit_used > credit_limit:
                    exposure_status = "CRITICAL_BREACH"
                elif credit_limit > Decimal("0.00") and credit_used >= (credit_limit * Decimal("0.8")):
                    exposure_status = "HIGH_WARNING"
                else:
                    exposure_status = "NORMAL"

                company_exposures.append(
                    CompanyCreditExposureItem(
                        company_id=cid,
                        company_name=comp_info.get("name"),
                        company_code=comp_info.get("code") or cid,
                        relationship_id=rel.id,
                        customer_group_id=rel.customer_group_id,
                        credit_limit=credit_limit,
                        credit_days=credit_days,
                        credit_hold=credit_hold,
                        credit_used=credit_used,
                        available_credit=available_credit,
                        utilization_percent=utilization_percent,
                        exposure_status=exposure_status,
                        status=rel.status or "Active",
                    )
                )
        else:
            # Fallback single entity representation if no Model C relationships are seeded yet
            cid = customer.company_id or customer.company_code or "COMP-001"
            comp_info = company_map.get(cid, {})
            credit_used = Decimal(str(customer.outstanding or "0.00"))
            credit_limit = Decimal("0.00")
            company_exposures.append(
                CompanyCreditExposureItem(
                    company_id=cid,
                    company_name=comp_info.get("name"),
                    company_code=comp_info.get("code") or cid,
                    relationship_id=f"rel-{cid}",
                    customer_group_id=customer.customer_group_id,
                    credit_limit=credit_limit,
                    credit_days=0,
                    credit_hold=False,
                    credit_used=credit_used,
                    available_credit=Decimal("0.00"),
                    utilization_percent=0.0,
                    exposure_status="NORMAL",
                    status="Active",
                )
            )

        # Aggregate Group Totals
        total_credit_limit = sum((item.credit_limit for item in company_exposures), Decimal("0.00"))
        total_credit_used = sum((item.credit_used for item in company_exposures), Decimal("0.00"))
        total_available_credit = sum((item.available_credit for item in company_exposures), Decimal("0.00"))

        if total_credit_limit > Decimal("0.00"):
            group_utilization_percent = float(round((total_credit_used / total_credit_limit) * 100, 2))
        else:
            group_utilization_percent = 0.0

        hold_count = sum(1 for item in company_exposures if item.credit_hold or item.exposure_status == "ON_HOLD")

        if hold_count > 0:
            group_risk_level = "ON_HOLD"
        elif group_utilization_percent >= 100.0:
            group_risk_level = "CRITICAL"
        elif group_utilization_percent >= 80.0:
            group_risk_level = "HIGH"
        elif group_utilization_percent >= 50.0:
            group_risk_level = "MODERATE"
        else:
            group_risk_level = "LOW"

        return CustomerCreditExposureResponse(
            customer_id=customer.id,
            customer_name=customer.name,
            code=customer.code,
            identity_code=customer.identity_code,
            pan_number=customer.pan_number,
            total_credit_limit=total_credit_limit,
            total_credit_used=total_credit_used,
            total_available_credit=total_available_credit,
            group_utilization_percent=group_utilization_percent,
            group_risk_level=group_risk_level,
            company_count=len(company_exposures),
            hold_count=hold_count,
            company_exposures=company_exposures,
        )





