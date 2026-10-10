"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — DataBridge Customer Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_CUSTOMER_ADAPTER", role="CANONICAL")

import re
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, Set
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from .base_adapter import BaseDataBridgeAdapter
from ..models import (
    DataBridgeClassification,
    DataBridgeDiff,
    DataBridgeDiffField,
    DataBridgeConflict,
    DataBridgeResultItem,
)
from ..exceptions import (
    DataBridgeValidationError,
)
from app.models.crm import Customer
from app.core.gst_engine import validate_gstin
from app.services.identity.engine import IdentityEngine


class DataBridgeCustomerAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for Customer Party Master.
    Orchestrates validation, matching, diffing, and persistence for Customer records.
    Zero business rule duplication. Enforces multi-tenant company isolation.
    """

    CUSTOMER_HEADER_MAP: Dict[str, List[str]] = {
        "code": [
            "customer_code", "customer code", "cust_code", "cust code",
            "customer no", "customer number", "customer id", "client code",
            "client id", "code", "cust_id", "party_code",
        ],
        "name": [
            "customer_name", "customer name", "client name", "customer",
            "client", "party name", "name", "full name", "party_name",
        ],
        "mobile": [
            "mobile", "phone", "contact", "mobile no", "mobile number",
            "phone no", "phone number", "cell", "contact number", "contact no",
            "tel", "telephone",
        ],
        "email": [
            "email", "email id", "email address", "e mail", "mail",
        ],
        "gst_number": [
            "gst_number", "gstin", "gst no", "gst number", "gst", "tin", "vat no",
        ],
        "pan_number": [
            "pan", "pan no", "pan number", "pan_number", "pan card",
        ],
        "customer_type": [
            "customer_type", "type", "customer type", "party type", "segment",
        ],
        "pricing_basis": [
            "pricing_basis", "pricing basis", "price basis",
        ],
    }

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Maps raw row headers and cleans standard Customer fields."""
        norm: Dict[str, Any] = {}

        # 1. Map against customer specific header dictionary
        for raw_k, raw_v in raw.items():
            if raw_v is None:
                continue
            clean_k = self.clean_header_key(raw_k)
            matched = False
            for target_k, aliases in self.CUSTOMER_HEADER_MAP.items():
                clean_aliases = [self.clean_header_key(a) for a in aliases]
                if clean_k in clean_aliases or clean_k == self.clean_header_key(target_k):
                    norm[target_k] = raw_v
                    matched = True
                    break
            if not matched:
                norm[str(raw_k).strip().lower()] = raw_v

        norm["_row_index"] = row_index

        # Clean string attributes
        for field in ["code", "name", "email", "gst_number", "pan_number", "customer_type", "pricing_basis"]:
            if field in norm and norm[field] is not None:
                norm[field] = str(norm[field]).strip()

        # Name normalization
        if norm.get("name"):
            norm["name"] = str(norm["name"]).strip()

        # Mobile normalization: clean non-digits, extract 10 digits if possible
        if norm.get("mobile"):
            raw_mob = str(norm["mobile"]).strip()
            digits_only = re.sub(r"\D", "", raw_mob)
            if len(digits_only) > 10 and digits_only.startswith("91"):
                digits_only = digits_only[2:]
            norm["mobile"] = digits_only if digits_only else raw_mob

        # GSTIN normalization: uppercase
        if norm.get("gst_number"):
            norm["gst_number"] = str(norm["gst_number"]).strip().upper()

        # PAN normalization: uppercase
        if norm.get("pan_number"):
            norm["pan_number"] = str(norm["pan_number"]).strip().upper()

        # Email normalization: lowercase
        if norm.get("email"):
            norm["email"] = str(norm["email"]).strip().lower()

        return norm

    async def validate(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
        row_index: int,
    ) -> Tuple[List[DataBridgeConflict], List[str]]:
        """Validates Customer mandatory fields and format invariants without mutating DB."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        name = normalized.get("name")
        if not name or str(name).strip() == "":
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-CUST-NAME",
                    message="Customer name is mandatory.",
                    severity="BLOCK",
                )
            )

        mobile = normalized.get("mobile")
        if mobile:
            if not re.match(r"^\d{10}$", mobile):
                warnings.append(f"Mobile '{mobile}' is not a standard 10-digit format.")

        gstin = normalized.get("gst_number")
        if gstin:
            is_valid, _, _ = validate_gstin(gstin)
            if not is_valid:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-VAL-GSTIN-INVALID",
                        message=f"Invalid GSTIN format '{gstin}'. Must adhere to statutory 15-character GST rules.",
                        severity="BLOCK",
                    )
                )

        pan = normalized.get("pan_number")
        if pan:
            if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", pan):
                warnings.append(f"PAN '{pan}' does not match standard 10-character alphanumeric PAN format.")

        return conflicts, warnings

    async def match(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
    ) -> Optional[Customer]:
        """
        Customer matching hierarchy (strictly company-scoped):
        1. Exact code
        2. Exact identity_code
        3. Exact mobile (10 digits)
        4. Exact gst_number
        """
        code = (normalized.get("code") or "").strip().upper()
        identity_code = (normalized.get("identity_code") or "").strip().upper()
        mobile = (normalized.get("mobile") or "").strip()
        gstin = (normalized.get("gst_number") or "").strip().upper()

        # 1. Exact code
        if code:
            stmt = select(Customer).where(
                Customer.company_id == company_id,
                Customer.code == code,
                Customer.is_deleted == False,
            )
            cust = (await session.execute(stmt)).scalars().first()
            return cust

        # 2. Identity code
        if identity_code:
            stmt = select(Customer).where(
                Customer.company_id == company_id,
                Customer.identity_code == identity_code,
                Customer.is_deleted == False,
            )
            cust = (await session.execute(stmt)).scalars().first()
            return cust

        # 3. Mobile (only if code was not provided)
        if mobile and len(mobile) == 10:
            stmt = select(Customer).where(
                Customer.company_id == company_id,
                Customer.mobile == mobile,
                Customer.is_deleted == False,
            )
            cust = (await session.execute(stmt)).scalars().first()
            if cust:
                return cust

        # 4. GSTIN (only if code was not provided)
        if gstin:
            stmt = select(Customer).where(
                Customer.company_id == company_id,
                Customer.gst_number == gstin,
                Customer.is_deleted == False,
            )
            cust = (await session.execute(stmt)).scalars().first()
            if cust:
                return cust

        return None

    async def check_cross_entity_conflicts(
        self,
        normalized: Dict[str, Any],
        existing: Optional[Customer],
        session: AsyncSession,
        company_id: str,
    ) -> List[DataBridgeConflict]:
        """Checks for conflicting master data across other existing customer records."""
        conflicts: List[DataBridgeConflict] = []
        code = (normalized.get("code") or "").strip().upper()
        mobile = (normalized.get("mobile") or "").strip()
        gstin = (normalized.get("gst_number") or "").strip().upper()

        if existing and code:
            # Check if existing matched by code has conflicting GSTIN
            if existing.code and existing.code.upper() == code:
                if existing.gst_number and gstin and existing.gst_number.upper() != gstin:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-CONFL-CUST-GSTIN",
                            message=f"Customer code '{code}' exists with GSTIN '{existing.gst_number}', which conflicts with payload GSTIN '{gstin}'.",
                            conflicting_entity="CUSTOMER",
                            conflicting_id=existing.id,
                            severity="BLOCK",
                        )
                    )

        # Cross-customer phone conflict: mobile exists under a DIFFERENT customer
        if mobile and len(mobile) == 10:
            stmt = select(Customer).where(
                Customer.company_id == company_id,
                Customer.mobile == mobile,
                Customer.is_deleted == False,
            )
            if existing:
                stmt = stmt.where(Customer.id != existing.id)
            other = (await session.execute(stmt)).scalars().first()
            if other:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-CONFL-CUST-PHONE",
                        message=f"Mobile number '{mobile}' is already registered to customer '{other.name}' (code: {other.code}).",
                        conflicting_entity="CUSTOMER",
                        conflicting_id=other.id,
                        severity="BLOCK",
                    )
                )

        return conflicts

    def diff(
        self,
        normalized: Dict[str, Any],
        existing: Optional[Customer],
    ) -> DataBridgeDiff:
        """Calculates attribute-level diff between normalized payload and database customer."""
        diff = DataBridgeDiff()
        if not existing:
            return diff

        mutable_field_pairs = [
            ("name", existing.name, normalized.get("name")),
            ("mobile", existing.mobile, normalized.get("mobile")),
            ("email", existing.email, normalized.get("email")),
            ("gst_number", existing.gst_number, normalized.get("gst_number")),
            ("pan_number", existing.pan_number, normalized.get("pan_number")),
            ("customer_type", existing.customer_type, normalized.get("customer_type")),
            ("pricing_basis", existing.pricing_basis, normalized.get("pricing_basis")),
        ]

        for field_name, old_val, new_val in mutable_field_pairs:
            if new_val is not None and str(new_val).strip() != "":
                clean_old = str(old_val).strip() if old_val is not None else ""
                clean_new = str(new_val).strip()
                if clean_old.upper() != clean_new.upper():
                    diff.fields[field_name] = DataBridgeDiffField(
                        old_value=old_val,
                        new_value=new_val,
                        is_different=True,
                    )

        return diff

    def classify(
        self,
        normalized: Dict[str, Any],
        existing: Optional[Customer],
        diff: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """Authoritative 6-state classification for Customer row."""
        if any(c.severity == "BLOCK" for c in conflicts):
            if any(c.conflict_code.startswith("SMRITI-CONFL-") for c in conflicts):
                return DataBridgeClassification.EXISTING_CONFLICT
            return DataBridgeClassification.VALIDATION_ERROR

        if not existing:
            return DataBridgeClassification.CREATE

        if diff.fields:
            return DataBridgeClassification.UPDATE

        return DataBridgeClassification.NO_CHANGE

    async def preview(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Tuple[List[DataBridgeResultItem], List[str]]:
        """Executes read-only preview for Customer batch."""
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_codes: Set[str] = set()
        seen_mobiles: Set[str] = set()

        for idx, raw_row in enumerate(rows, start=1):
            norm = self.normalize(raw_row, idx)
            target_id = norm.get("code") or norm.get("mobile") or norm.get("name") or f"ROW-{idx}"

            conflicts, warnings = await self.validate(norm, session, company_id, idx)

            # In-file duplicate checking
            code = norm.get("code")
            if code:
                clean_code = str(code).strip().upper()
                if clean_code in seen_codes:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-VAL-DUP-ROW-CODE",
                            message=f"Duplicate customer code '{code}' found in the same import file.",
                            severity="BLOCK",
                        )
                    )
                seen_codes.add(clean_code)

            mobile = norm.get("mobile")
            if mobile and len(mobile) == 10:
                if mobile in seen_mobiles:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-VAL-DUP-ROW-PHONE",
                            message=f"Duplicate mobile number '{mobile}' found in the same import file.",
                            severity="BLOCK",
                        )
                    )
                seen_mobiles.add(mobile)

            # Match
            existing = await self.match(norm, session, company_id)

            # Cross-entity conflict checks
            cross_conflicts = await self.check_cross_entity_conflicts(norm, existing, session, company_id)
            conflicts.extend(cross_conflicts)

            d = self.diff(norm, existing)
            classification = self.classify(norm, existing, d, conflicts)

            for c in conflicts:
                if c.severity == "BLOCK":
                    blocking_reasons.append(f"Row {idx} [{target_id}]: {c.message}")

            result_items.append(
                DataBridgeResultItem(
                    row_index=idx,
                    record_id=existing.id if existing else None,
                    entity_type="CUSTOMER",
                    classification=classification,
                    target_identifier=str(target_id),
                    diff=d,
                    conflicts=conflicts,
                    warnings=warnings,
                )
            )

        return result_items, blocking_reasons

    async def commit(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
        actor_id: str = "SYSTEM",
    ) -> Tuple[List[DataBridgeResultItem], int]:
        """Atomically persists Customer records into the tenant database."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit Customer batch: {'; '.join(blocking)}")

        committed_count = 0
        final_items: List[DataBridgeResultItem] = []

        for item_res, raw_row in zip(preview_items, rows):
            norm = self.normalize(raw_row, item_res.row_index)
            if item_res.classification == DataBridgeClassification.NO_CHANGE:
                final_items.append(item_res)
                continue

            if item_res.classification == DataBridgeClassification.CREATE:
                tech_id, id_code = await IdentityEngine.allocate_internal(
                    session=session,
                    entity_type="CUSTOMER",
                    company_id=company_id,
                    branch_id=branch_id,
                )
                code_to_use = norm.get("code") or id_code

                new_cust = Customer(
                    id=tech_id,
                    identity_code=id_code,
                    code=code_to_use,
                    name=norm["name"],
                    mobile=norm.get("mobile"),
                    email=norm.get("email"),
                    gst_number=norm.get("gst_number"),
                    pan_number=norm.get("pan_number"),
                    customer_type=norm.get("customer_type") or "RETAIL",
                    pricing_basis=norm.get("pricing_basis") or "MRP",
                    company_id=company_id,
                    branch_id=branch_id,
                    status="Active",
                )
                session.add(new_cust)
                await session.flush()
                committed_count += 1

                item_res.record_id = new_cust.id
                item_res.target_identifier = new_cust.code or new_cust.name
                final_items.append(item_res)

            elif item_res.classification == DataBridgeClassification.UPDATE:
                existing = await self.match(norm, session, company_id)
                if existing:
                    if norm.get("name"):
                        existing.name = norm["name"]
                    if norm.get("mobile"):
                        existing.mobile = norm["mobile"]
                    if norm.get("email"):
                        existing.email = norm["email"]
                    if norm.get("gst_number"):
                        existing.gst_number = norm["gst_number"]
                    if norm.get("pan_number"):
                        existing.pan_number = norm["pan_number"]
                    if norm.get("customer_type"):
                        existing.customer_type = norm["customer_type"]
                    if norm.get("pricing_basis"):
                        existing.pricing_basis = norm["pricing_basis"]

                    await session.flush()
                    committed_count += 1
                final_items.append(item_res)

        return final_items, committed_count
