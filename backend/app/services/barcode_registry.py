import uuid
from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.item_master import BarcodeRegistryAudit, Item, ItemBarcode, ItemVariant
from .barcode_policy import BARCODE_TYPE_POLICY, detect_barcode_type, validate_barcode_value


class BarcodeRegistryService:
    """Tenant-scoped lifecycle operations for GS1 and internal barcodes."""

    STATUSES = {"UNASSIGNED", "ASSIGNED", "QUARANTINED", "CONFLICT", "RETIRED"}

    @staticmethod
    def normalize(value: str) -> str:
        return "".join(value.strip().upper().split())

    @staticmethod
    def type_policy():
        return BARCODE_TYPE_POLICY

    @staticmethod
    def detect(value: str):
        return detect_barcode_type(value)

    @classmethod
    async def metrics(cls, session: AsyncSession, company_id: str):
        rows = await session.execute(
            select(ItemBarcode.status, func.count(ItemBarcode.id))
            .where(ItemBarcode.company_id == company_id, ItemBarcode.is_deleted == False)
            .group_by(ItemBarcode.status)
        )
        counts = {status: count for status, count in rows.all()}
        return {
            "total": sum(counts.values()),
            "assigned": counts.get("ASSIGNED", 0),
            "waiting": counts.get("UNASSIGNED", 0),
            "needs_review": counts.get("CONFLICT", 0),
            "blocked": counts.get("QUARANTINED", 0),
            "retired": counts.get("RETIRED", 0),
        }

    @classmethod
    async def list_records(cls, session: AsyncSession, company_id: str, query: Optional[str] = None, status: Optional[str] = None, limit: int = 100):
        stmt = (
            select(ItemBarcode)
            .options(selectinload(ItemBarcode.item), selectinload(ItemBarcode.variant))
            .where(ItemBarcode.company_id == company_id, ItemBarcode.is_deleted == False)
            .order_by(ItemBarcode.created_at.desc())
            .limit(limit)
        )
        if status:
            normalized_status = status.upper()
            if normalized_status not in cls.STATUSES:
                raise ValueError("Invalid barcode registry status")
            stmt = stmt.where(ItemBarcode.status == normalized_status)
        if query:
            raw_query = query.strip()
            stmt = stmt.where(or_(
                ItemBarcode.barcode_normalized.ilike(f"%{raw_query.upper()}%"),
                ItemBarcode.barcode.ilike(f"%{raw_query}%"),
            ))
        return (await session.execute(stmt)).scalars().all()

    @classmethod
    async def intake(cls, session: AsyncSession, company_id: str, branch_id: str, user_id: str, barcode: str, barcode_type: str, source: str, source_reference: Optional[str], barcode_purpose: str = "RETAIL", encoding_standard: str = "NONE") -> ItemBarcode:
        normalized_type = validate_barcode_value(barcode_type, barcode, barcode_purpose, encoding_standard)
        normalized = cls.normalize(barcode)
        if not normalized:
            raise ValueError("Barcode cannot be empty")
        existing = (
            await session.execute(select(ItemBarcode).where(
                ItemBarcode.company_id == company_id,
                or_(ItemBarcode.barcode_normalized == normalized, ItemBarcode.barcode == barcode.strip()),
                ItemBarcode.is_deleted == False,
            ))
        ).scalars().first()
        if existing:
            raise ValueError(f"Barcode '{barcode}' already exists with status {existing.status}")

        record = ItemBarcode(
            id=f"bc_{uuid.uuid4().hex[:12]}", company_id=company_id, branch_id=branch_id,
            barcode=barcode.strip(), barcode_normalized=normalized, barcode_type=normalized_type,
            barcode_purpose=barcode_purpose.upper(), encoding_standard=encoding_standard.upper(),
            is_primary=False, status="UNASSIGNED", source=source.upper(), source_reference=source_reference,
            is_active=True, is_deleted=False, created_by=user_id, updated_by=user_id,
        )
        session.add(record)
        await session.flush()
        session.add(BarcodeRegistryAudit(
            id=f"bca_{uuid.uuid4().hex[:12]}", company_id=company_id, branch_id=branch_id,
            barcode_id=record.id, action="INTAKE", next_status="UNASSIGNED",
            details_json={"source": source.upper(), "source_reference": source_reference}, created_by=user_id,
        ))
        await session.commit()
        await session.refresh(record)
        return record

    @classmethod
    async def preview_bulk(cls, session: AsyncSession, company_id: str, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        results = []
        seen = set()
        for row_number, row in enumerate(rows, start=1):
            raw_barcode = str(row.get("barcode") or "").strip()
            sku = str(row.get("sku") or "").strip().upper() or None
            if not raw_barcode:
                results.append({"row_number": row_number, "barcode": "", "sku": sku, "state": "INVALID", "message": "Barcode is required"})
                continue
            normalized = cls.normalize(raw_barcode)
            if normalized in seen:
                results.append({"row_number": row_number, "barcode": raw_barcode, "sku": sku, "state": "DUPLICATE", "message": "Duplicate barcode in this file"})
                continue
            seen.add(normalized)
            try:
                validate_barcode_value(str(row.get("barcode_type") or "EAN13"), raw_barcode, str(row.get("barcode_purpose") or "RETAIL"), str(row.get("encoding_standard") or "NONE"))
            except ValueError as exc:
                results.append({"row_number": row_number, "barcode": raw_barcode, "sku": sku, "state": "INVALID", "message": str(exc)})
                continue
            existing = (await session.execute(select(ItemBarcode.id).where(
                ItemBarcode.company_id == company_id,
                ItemBarcode.barcode_normalized == normalized,
                ItemBarcode.is_deleted == False,
            ))).scalar_one_or_none()
            if existing:
                results.append({"row_number": row_number, "barcode": raw_barcode, "sku": sku, "state": "DUPLICATE", "message": "Barcode already exists; existing record will be kept"})
                continue
            if sku:
                variant_exists = (await session.execute(select(ItemVariant.id).where(
                    ItemVariant.company_id == company_id,
                    ItemVariant.variant_sku == sku,
                    ItemVariant.is_deleted == False,
                ))).scalar_one_or_none()
                if not variant_exists:
                    results.append({"row_number": row_number, "barcode": raw_barcode, "sku": sku, "state": "UNKNOWN_SKU", "message": "SKU was not found; barcode can be imported only after review"})
                    continue
            results.append({"row_number": row_number, "barcode": raw_barcode, "sku": sku, "state": "READY", "message": "Barcode will be added as unassigned"})
        counts = {state: sum(result["state"] == state for result in results) for state in {result["state"] for result in results}}
        return {"total": len(results), "ready": counts.get("READY", 0), "duplicates": counts.get("DUPLICATE", 0), "invalid": counts.get("INVALID", 0), "unknown_skus": counts.get("UNKNOWN_SKU", 0), "rows": results}

    @classmethod
    async def commit_bulk(cls, session: AsyncSession, company_id: str, branch_id: str, user_id: str, rows: List[Dict[str, Any]], approval_reason: str) -> Dict[str, Any]:
        preview = await cls.preview_bulk(session, company_id, rows)
        if preview["ready"] != preview["total"]:
            raise ValueError("Bulk import contains rows requiring review; commit only the validated preview")
        imported = 0
        for row in rows:
            await cls.intake(session, company_id, branch_id, user_id, row["barcode"], row.get("barcode_type", "EAN13"), row.get("source", "GS1_IMPORT"), f"BULK_IMPORT:{approval_reason}", row.get("barcode_purpose", "RETAIL"), row.get("encoding_standard", "NONE"))
            imported += 1
        return {"imported": imported, "status": "COMMITTED", "approval_reason": approval_reason}

    @classmethod
    async def assign(cls, session: AsyncSession, company_id: str, branch_id: str, user_id: str, barcode_id: str, variant_sku: Optional[str] = None, item_code: Optional[str] = None, reason: Optional[str] = None) -> ItemBarcode:
        record = (
            await session.execute(select(ItemBarcode).options(
                selectinload(ItemBarcode.item), selectinload(ItemBarcode.variant)
            ).where(
                ItemBarcode.id == barcode_id, ItemBarcode.company_id == company_id, ItemBarcode.is_deleted == False,
            ))
        ).scalars().first()
        if not record:
            raise LookupError("Barcode registry record not found")
        if record.status != "UNASSIGNED":
            raise ValueError(f"Only UNASSIGNED barcodes can be assigned; current status is {record.status}")
        if bool(variant_sku) == bool(item_code):
            raise ValueError("Provide exactly one of variant_sku or item_code")

        item = None
        variant = None
        if variant_sku:
            variant = (
                await session.execute(select(ItemVariant).where(
                    ItemVariant.company_id == company_id,
                    ItemVariant.variant_sku == variant_sku.strip().upper(),
                    ItemVariant.is_deleted == False,
                ))
            ).scalars().first()
            if not variant:
                raise LookupError("Variant SKU not found in this company")
            item = (
                await session.execute(select(Item).where(
                    Item.id == variant.item_id, Item.company_id == company_id, Item.is_deleted == False,
                ))
            ).scalars().first()
        else:
            item = (
                await session.execute(select(Item).where(
                    Item.company_id == company_id,
                    Item.item_code == item_code.strip().upper(),
                    Item.is_deleted == False,
                ))
            ).scalars().first()
            if not item:
                raise LookupError("Item code not found in this company")

        previous_status = record.status
        record.item_id = item.id
        record.variant_id = variant.id if variant else None
        record.status = "ASSIGNED"
        record.assigned_at = date.today()
        record.assigned_by = user_id
        record.updated_by = user_id
        session.add(BarcodeRegistryAudit(
            id=f"bca_{uuid.uuid4().hex[:12]}", company_id=company_id, branch_id=branch_id,
            barcode_id=record.id, action="ASSIGN", previous_status=previous_status, next_status="ASSIGNED",
            details_json={"item_id": item.id, "variant_id": variant.id if variant else None},
            reason=reason, created_by=user_id,
        ))
        await session.commit()
        await session.refresh(record)
        return record

    @staticmethod
    def serialize(record: ItemBarcode) -> Dict[str, Any]:
        return {
            "id": record.id, "barcode": record.barcode, "barcode_normalized": record.barcode_normalized,
            "barcode_type": record.barcode_type, "status": record.status, "source": record.source,
            "barcode_purpose": record.barcode_purpose, "encoding_standard": record.encoding_standard,
            "source_reference": record.source_reference, "item_id": record.item_id,
            "item_code": record.item.item_code if record.item else None, "variant_id": record.variant_id,
            "variant_sku": record.variant.variant_sku if record.variant else None,
            "item_name": record.item.item_name if record.item else None,
            "assigned_at": record.assigned_at.isoformat() if record.assigned_at else None,
            "assigned_by": record.assigned_by,
        }