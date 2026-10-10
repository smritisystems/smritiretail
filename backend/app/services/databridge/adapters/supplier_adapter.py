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
Classification: Internal — DataBridge Supplier Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_SUPPLIER_ADAPTER", role="CANONICAL")

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
from app.models.purchase import Supplier
from app.core.gst_engine import validate_gstin
from app.services.identity.engine import IdentityEngine


class DataBridgeSupplierAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for Supplier Party Master.
    Orchestrates validation, matching, diffing, and persistence for Supplier records.
    Zero business rule duplication. Enforces multi-tenant company isolation.
    """

    SUPPLIER_HEADER_MAP: Dict[str, List[str]] = {
        "code": [
            "supplier_code", "supplier code", "vendor_code", "vendor code",
            "vendor no", "vendor id", "supplier no", "supplier id", "code",
            "supp_code", "party_code",
        ],
        "name": [
            "supplier_name", "supplier name", "vendor_name", "vendor name",
            "supplier", "vendor", "party_name", "name", "company_name",
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
        "address": [
            "address", "street", "street address", "address line 1", "addr",
        ],
        "city": [
            "city", "town", "district",
        ],
        "state": [
            "state", "province",
        ],
        "pincode": [
            "pincode", "pin code", "postal code", "zip", "zip code",
        ],
    }

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Maps raw row headers and cleans standard Supplier fields."""
        norm: Dict[str, Any] = {}

        # 1. Map against supplier specific header dictionary
        for raw_k, raw_v in raw.items():
            if raw_v is None:
                continue
            clean_k = self.clean_header_key(raw_k)
            matched = False
            for target_k, aliases in self.SUPPLIER_HEADER_MAP.items():
                clean_aliases = [self.clean_header_key(a) for a in aliases]
                if clean_k in clean_aliases or clean_k == self.clean_header_key(target_k):
                    norm[target_k] = raw_v
                    matched = True
                    break
            if not matched:
                norm[str(raw_k).strip().lower()] = raw_v

        norm["_row_index"] = row_index

        # Clean string attributes
        for field in ["code", "name", "email", "gst_number", "address", "city", "state", "pincode"]:
            if field in norm and norm[field] is not None:
                norm[field] = str(norm[field]).strip()

        # Name normalization
        if norm.get("name"):
            norm["name"] = str(norm["name"]).strip()

        # Mobile normalization
        if norm.get("mobile"):
            raw_mob = str(norm["mobile"]).strip()
            digits_only = re.sub(r"\D", "", raw_mob)
            if len(digits_only) > 10 and digits_only.startswith("91"):
                digits_only = digits_only[2:]
            norm["mobile"] = digits_only if digits_only else raw_mob

        # GSTIN normalization: uppercase
        if norm.get("gst_number"):
            norm["gst_number"] = str(norm["gst_number"]).strip().upper()

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
        """Validates Supplier mandatory fields and format invariants without mutating DB."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        name = normalized.get("name")
        if not name or str(name).strip() == "":
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-SUPP-NAME",
                    message="Supplier name is mandatory.",
                    severity="BLOCK",
                )
            )

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

        mobile = normalized.get("mobile")
        if mobile and not re.match(r"^\d{10}$", mobile):
            warnings.append(f"Mobile '{mobile}' is not a standard 10-digit format.")

        pincode = normalized.get("pincode")
        if pincode and not re.match(r"^\d{6}$", pincode):
            warnings.append(f"Pincode '{pincode}' is not a standard 6-digit postal code.")

        return conflicts, warnings

    async def match(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
    ) -> Optional[Supplier]:
        """
        Supplier matching hierarchy (strictly company-scoped):
        1. Exact code
        2. Exact identity_code
        3. Case-insensitive exact name
        """
        code = (normalized.get("code") or "").strip().upper()
        identity_code = (normalized.get("identity_code") or "").strip().upper()
        name = (normalized.get("name") or "").strip()

        # 1. Exact code
        if code:
            stmt = select(Supplier).where(
                Supplier.company_id == company_id,
                Supplier.code == code,
                Supplier.is_deleted == False,
            )
            supp = (await session.execute(stmt)).scalars().first()
            return supp

        # 2. Identity code
        if identity_code:
            stmt = select(Supplier).where(
                Supplier.company_id == company_id,
                Supplier.identity_code == identity_code,
                Supplier.is_deleted == False,
            )
            supp = (await session.execute(stmt)).scalars().first()
            return supp

        # 3. Exact name (case-insensitive, only if code was not provided)
        if name:
            stmt = select(Supplier).where(
                Supplier.company_id == company_id,
                Supplier.name.ilike(name),
                Supplier.is_deleted == False,
            )
            supp = (await session.execute(stmt)).scalars().first()
            if supp:
                return supp

        return None

    async def check_cross_entity_conflicts(
        self,
        normalized: Dict[str, Any],
        existing: Optional[Supplier],
        session: AsyncSession,
        company_id: str,
    ) -> List[DataBridgeConflict]:
        """Checks for conflicting master data against existing supplier records."""
        conflicts: List[DataBridgeConflict] = []
        code = (normalized.get("code") or "").strip().upper()
        gstin = (normalized.get("gst_number") or "").strip().upper()

        if existing and code:
            if existing.code and existing.code.upper() == code:
                if existing.gst_number and gstin and existing.gst_number.upper() != gstin:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-CONFL-SUPP-GSTIN",
                            message=f"Supplier code '{code}' exists with GSTIN '{existing.gst_number}', which conflicts with payload GSTIN '{gstin}'.",
                            conflicting_entity="SUPPLIER",
                            conflicting_id=existing.id,
                            severity="BLOCK",
                        )
                    )

        return conflicts

    def diff(
        self,
        normalized: Dict[str, Any],
        existing: Optional[Supplier],
    ) -> DataBridgeDiff:
        """Calculates attribute-level diff between normalized payload and database supplier."""
        diff = DataBridgeDiff()
        if not existing:
            return diff

        mutable_field_pairs = [
            ("name", existing.name, normalized.get("name")),
            ("mobile", existing.mobile, normalized.get("mobile")),
            ("email", existing.email, normalized.get("email")),
            ("gst_number", existing.gst_number, normalized.get("gst_number")),
            ("address", existing.address, normalized.get("address")),
            ("city", existing.city, normalized.get("city")),
            ("state", existing.state, normalized.get("state")),
            ("pincode", existing.pincode, normalized.get("pincode")),
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
        existing: Optional[Supplier],
        diff: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """Authoritative 6-state classification for Supplier row."""
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
        """Executes read-only preview for Supplier batch."""
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_codes: Set[str] = set()

        for idx, raw_row in enumerate(rows, start=1):
            norm = self.normalize(raw_row, idx)
            target_id = norm.get("code") or norm.get("name") or f"ROW-{idx}"

            conflicts, warnings = await self.validate(norm, session, company_id, idx)

            # In-file duplicate checking
            code = norm.get("code")
            if code:
                clean_code = str(code).strip().upper()
                if clean_code in seen_codes:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-VAL-DUP-ROW-CODE",
                            message=f"Duplicate supplier code '{code}' found in the same import file.",
                            severity="BLOCK",
                        )
                    )
                seen_codes.add(clean_code)

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
                    entity_type="SUPPLIER",
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
        """Atomically persists Supplier records into the tenant database."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit Supplier batch: {'; '.join(blocking)}")

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
                    entity_type="SUPPLIER",
                    company_id=company_id,
                    branch_id=branch_id,
                )
                code_to_use = norm.get("code") or id_code

                new_supp = Supplier(
                    id=tech_id,
                    identity_code=id_code,
                    code=code_to_use,
                    name=norm["name"],
                    mobile=norm.get("mobile"),
                    email=norm.get("email"),
                    gst_number=norm.get("gst_number"),
                    address=norm.get("address"),
                    city=norm.get("city"),
                    state=norm.get("state"),
                    pincode=norm.get("pincode"),
                    company_id=company_id,
                    branch_id=branch_id,
                    outstanding=Decimal("0.00"),
                )
                session.add(new_supp)
                await session.flush()
                committed_count += 1

                item_res.record_id = new_supp.id
                item_res.target_identifier = new_supp.code or new_supp.name
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
                    if norm.get("address"):
                        existing.address = norm["address"]
                    if norm.get("city"):
                        existing.city = norm["city"]
                    if norm.get("state"):
                        existing.state = norm["state"]
                    if norm.get("pincode"):
                        existing.pincode = norm["pincode"]

                    await session.flush()
                    committed_count += 1
                final_items.append(item_res)

        return final_items, committed_count
