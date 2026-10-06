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
Classification: Internal — DataBridge Purchase Debit Note Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_PURCHASE_DEBIT_NOTE_ADAPTER", role="CANONICAL")

from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple, Set
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from .base_adapter import BaseDataBridgeAdapter
from ..models import (
    DataBridgeClassification,
    DataBridgeDiff,
    DataBridgeDiffField,
    DataBridgeConflict,
    DataBridgeResultItem,
)
from ..exceptions import DataBridgeValidationError
from app.models.purchase import Supplier, PurchaseReceipt
from app.models.identity_registry import SmritiIdentityAlias
from app.schemas.purchase import DebitNoteCreate
from app.services.purchase import PurchaseService
from app.services.identity.engine import IdentityEngine
from app.api.deps import TenantContext


class DataBridgePurchaseDebitNoteAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for Purchase Return / Supplier Debit Notes.
    Validates claim and tax amounts, supplier bindings, posts double-entry GL reversals,
    and updates supplier outstanding liabilities atomically.
    """

    DN_HEADER_MAP: Dict[str, List[str]] = {
        "debit_note_no": [
            "debit_note_no", "debit note no", "dn_no", "dn no", "debit_note_number",
            "debit note number", "return_no", "return no", "purchase_return_no", "dn_number",
        ],
        "supplier_id": [
            "supplier_id", "supplier id", "vendor_id", "vendor id",
        ],
        "supplier_code": [
            "supplier_code", "supplier code", "vendor_code", "vendor code", "supp_code",
        ],
        "supplier_name": [
            "supplier_name", "supplier name", "supplier", "vendor", "vendor_name",
            "party_name", "supp_name",
        ],
        "supplier_gstin": [
            "supplier_gstin", "vendor_gstin", "gstin", "gst_number", "gst_no",
        ],
        "receipt_no": [
            "receipt_no", "grn_no", "grn_number", "receipt_number", "grn",
        ],
        "claim_amount": [
            "claim_amount", "claim amount", "taxable_amount", "taxable_value", "amount", "return_amount",
        ],
        "tax_amount": [
            "tax_amount", "tax", "gst_amount", "tax amount",
        ],
        "total_debit_amount": [
            "total_debit_amount", "total_amount", "total debit amount", "net_debit", "total", "debit_amount",
        ],
        "reason": [
            "reason", "remarks", "notes", "narration", "comment",
        ],
        "status": [
            "status",
        ],
    }

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Normalizes raw input row headers and numerical values."""
        norm: Dict[str, Any] = {}

        for raw_k, raw_v in raw.items():
            if raw_v is None:
                continue
            clean_k = self.clean_header_key(raw_k)
            matched = False
            for target_k, aliases in self.DN_HEADER_MAP.items():
                clean_aliases = [self.clean_header_key(a) for a in aliases]
                if clean_k in clean_aliases or clean_k == self.clean_header_key(target_k):
                    norm[target_k] = raw_v
                    matched = True
                    break
            if not matched:
                norm[str(raw_k).strip().lower()] = raw_v

        norm["_row_index"] = row_index

        for s_f in ["debit_note_no", "supplier_id", "supplier_code", "supplier_name", "receipt_no", "reason", "status"]:
            if s_f in norm and norm[s_f] is not None:
                norm[s_f] = str(norm[s_f]).strip()

        if norm.get("debit_note_no"):
            norm["debit_note_no"] = str(norm["debit_note_no"]).strip().upper()

        for num_f in ["claim_amount", "tax_amount", "total_debit_amount"]:
            if num_f in norm and norm[num_f] is not None:
                try:
                    norm[num_f] = Decimal(str(norm[num_f]).strip())
                except (InvalidOperation, TypeError, ValueError):
                    pass

        if isinstance(norm.get("claim_amount"), Decimal) and isinstance(norm.get("tax_amount"), Decimal) and norm.get("total_debit_amount") is None:
            norm["total_debit_amount"] = norm["claim_amount"] + norm["tax_amount"]
        elif isinstance(norm.get("total_debit_amount"), Decimal) and norm.get("claim_amount") is None:
            norm["claim_amount"] = norm["total_debit_amount"]
            norm["tax_amount"] = Decimal("0.00")

        return norm

    async def validate(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str, row_index: int
    ) -> Tuple[List[DataBridgeConflict], List[str]]:
        """Validates debit note document fields and mathematical consistency."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        dn_no = norm.get("debit_note_no")
        if not dn_no or not str(dn_no).strip():
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-DN-NO-REQ",
                    message="Debit note number (debit_note_no) is mandatory.",
                    severity="BLOCK",
                )
            )

        has_supplier = bool(
            norm.get("supplier_id")
            or norm.get("supplier_code")
            or norm.get("supplier_name")
        )
        if not has_supplier:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-DN-SUPPLIER-REQ",
                    message="Supplier reference is required for debit note creation.",
                    severity="BLOCK",
                )
            )

        tot = norm.get("total_debit_amount")
        if tot is None or not isinstance(tot, Decimal) or tot <= Decimal("0"):
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-DN-TOTAL-REQ",
                    message="Total debit amount must be a positive decimal value.",
                    severity="BLOCK",
                )
            )

        claim = norm.get("claim_amount")
        tax = norm.get("tax_amount") or Decimal("0.00")
        if isinstance(claim, Decimal) and isinstance(tax, Decimal) and isinstance(tot, Decimal):
            if abs((claim + tax) - tot) > Decimal("0.05"):
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-VAL-DN-MATH-INVARIANT",
                        message=f"Total debit ({tot}) does not equal claim ({claim}) + tax ({tax}).",
                        severity="BLOCK",
                    )
                )

        return conflicts, warnings

    async def match(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str
    ) -> Optional[SmritiIdentityAlias]:
        """Checks for existing debit note by alias in IdentityEngine."""
        dn_no = norm.get("debit_note_no")
        if not dn_no:
            return None

        stmt = select(SmritiIdentityAlias).where(
            SmritiIdentityAlias.company_id == company_id,
            SmritiIdentityAlias.alias_code == dn_no,
            SmritiIdentityAlias.entity_type == "DEBIT_NOTE",
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    def diff(
        self, norm: Dict[str, Any], existing: Optional[SmritiIdentityAlias]
    ) -> DataBridgeDiff:
        """Diffs debit note (immutable once issued)."""
        return DataBridgeDiff(fields={})

    def classify(
        self,
        norm: Dict[str, Any],
        existing: Optional[SmritiIdentityAlias],
        diff_res: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """Classifies debit note action."""
        if any(c.severity == "BLOCK" for c in conflicts):
            if any("EXIST" in c.conflict_code or "ALREADY" in c.conflict_code for c in conflicts):
                return DataBridgeClassification.EXISTING_CONFLICT
            return DataBridgeClassification.VALIDATION_ERROR

        if not existing:
            return DataBridgeClassification.CREATE

        return DataBridgeClassification.EXISTING_CONFLICT

    async def preview(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Tuple[List[DataBridgeResultItem], List[str]]:
        """Executes preview pipeline for debit notes."""
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_notes: Set[str] = set()

        for idx, row in enumerate(rows, start=1):
            doc = self.normalize(row, idx)
            dn_no = doc.get("debit_note_no")
            target_id = dn_no or f"ROW-{idx}"
            conflicts, warnings = await self.validate(doc, session, company_id, idx)

            if dn_no:
                if dn_no in seen_notes:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-CONFL-DN-DUP-FILE",
                            message=f"Duplicate debit note number '{dn_no}' found in the same import file.",
                            severity="BLOCK",
                        )
                    )
                seen_notes.add(dn_no)

            existing = await self.match(doc, session, company_id)
            if existing:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="DEBIT_NOTE_ALREADY_EXISTS",
                        message=f"Debit note '{dn_no}' was already issued and recorded in general ledger.",
                        severity="BLOCK",
                    )
                )

            d = self.diff(doc, existing)
            classification = self.classify(doc, existing, d, conflicts)

            for c in conflicts:
                if c.severity == "BLOCK":
                    blocking_reasons.append(f"Row {idx} [{target_id}]: {c.message}")

            preview_data = {
                "debit_note_no": dn_no,
                "supplier_name": doc.get("supplier_name") or doc.get("supplier_code") or doc.get("supplier_id"),
                "claim_amount": str(doc.get("claim_amount", Decimal("0.00"))),
                "tax_amount": str(doc.get("tax_amount", Decimal("0.00"))),
                "total_debit_amount": str(doc.get("total_debit_amount", Decimal("0.00"))),
                "receipt_no": doc.get("receipt_no"),
                "reason": doc.get("reason"),
            }

            result_items.append(
                DataBridgeResultItem(
                    row_index=idx,
                    record_id=existing.id if existing else None,
                    entity_type="PURCHASE_DEBIT_NOTE",
                    classification=classification,
                    target_identifier=str(target_id),
                    diff=d,
                    conflicts=conflicts,
                    warnings=warnings,
                    normalized_data=preview_data,
                )
            )

        return result_items, blocking_reasons

    async def _resolve_or_create_supplier(
        self, session: AsyncSession, doc: Dict[str, Any], company_id: str, branch_id: Optional[str]
    ) -> str:
        sid = doc.get("supplier_id")
        scode = doc.get("supplier_code")
        sname = doc.get("supplier_name")

        if sid:
            stmt = select(Supplier.id).where(
                Supplier.company_id == company_id,
                Supplier.id == sid,
                Supplier.is_deleted == False,
            )
            s_res = (await session.execute(stmt)).scalars().first()
            if s_res:
                return s_res

        clauses = []
        if scode:
            clauses.append(Supplier.code == scode)
        if sname:
            clauses.append(Supplier.name == sname)
        if clauses:
            stmt = select(Supplier.id).where(
                Supplier.company_id == company_id,
                Supplier.is_deleted == False,
                or_(*clauses),
            )
            s_res = (await session.execute(stmt)).scalars().first()
            if s_res:
                return s_res

        eff_branch = branch_id if branch_id and branch_id != "MAIN" else "BR-MAIN-001"
        tech_id, id_code = await IdentityEngine.allocate_internal(
            session=session,
            entity_type="SUPPLIER",
            group_code="SUP",
            company_id=company_id,
            branch_id=eff_branch,
            purpose="DATABRIDGE_AUTO_PROVISION",
        )
        new_supp = Supplier(
            id=tech_id,
            identity_code=id_code,
            code=scode or id_code,
            name=sname or scode or f"Supplier-{doc.get('debit_note_no')}",
            gst_number=doc.get("supplier_gstin"),
            company_id=company_id,
            branch_id=eff_branch,
            outstanding=Decimal("0.00"),
        )
        session.add(new_supp)
        await session.flush()
        return new_supp.id

    async def commit(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
        actor_id: str = "SYSTEM",
    ) -> Tuple[List[DataBridgeResultItem], int]:
        """Commits debit notes via PurchaseService."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit Debit Note batch: {'; '.join(blocking)}")

        eff_branch = branch_id if branch_id and branch_id != "MAIN" else "BR-MAIN-001"
        tenant_ctx = TenantContext(company_id=company_id, branch_id=eff_branch)
        purchase_service = PurchaseService(session, tenant_ctx)

        committed_count = 0
        final_items: List[DataBridgeResultItem] = []

        for item_res, raw_row in zip(preview_items, rows):
            doc = self.normalize(raw_row, item_res.row_index)
            dn_no = doc.get("debit_note_no")
            supplier_id = await self._resolve_or_create_supplier(session, doc, company_id, branch_id)

            receipt_id = None
            if doc.get("receipt_no"):
                r_stmt = select(PurchaseReceipt.id).where(
                    PurchaseReceipt.company_id == company_id,
                    PurchaseReceipt.receipt_no == doc["receipt_no"],
                    PurchaseReceipt.is_deleted == False,
                )
                receipt_id = (await session.execute(r_stmt)).scalars().first()

            dn_create_schema = DebitNoteCreate(
                debit_note_no=dn_no,
                supplier_id=supplier_id,
                receipt_id=receipt_id,
                claim_amount=doc.get("claim_amount", Decimal("0.00")),
                tax_amount=doc.get("tax_amount", Decimal("0.00")),
                total_debit_amount=doc.get("total_debit_amount", Decimal("0.00")),
                status=doc.get("status") or "ISSUED",
                reason=doc.get("reason"),
            )

            created_dn = await purchase_service.create_debit_note(dn_create_schema)
            created_id = created_dn.get("id") if isinstance(created_dn, dict) else getattr(created_dn, "id", None)
            total_amt_str = str(created_dn.get("total_debit_amount") if isinstance(created_dn, dict) else getattr(created_dn, "total_debit_amount", ""))

            committed_count += 1
            final_items.append(
                DataBridgeResultItem(
                    row_index=item_res.row_index,
                    record_id=created_id,
                    entity_type="PURCHASE_DEBIT_NOTE",
                    classification=item_res.classification,
                    target_identifier=str(dn_no),
                    diff=item_res.diff,
                    conflicts=[],
                    warnings=[],
                    normalized_data={
                        "debit_note_id": created_id,
                        "debit_note_no": dn_no,
                        "supplier_id": supplier_id,
                        "total_debit_amount": total_amt_str,
                    },
                )
            )

        return final_items, committed_count
