"""Plan and optionally migrate legacy product catalog dimensions.

Default behavior is a read-only report. Use --commit only after reviewing the
report. The migration creates canonical records and links legacy products; it
does not delete or rewrite legacy identity values.

Examples:
    python -m scripts.migrate_legacy_catalog --database smriti001 --company-id 001
    python -m scripts.migrate_legacy_catalog --database smriti001 --company-id 001 --commit
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import uuid
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import async_session, get_company_sessionmaker
from app.models.inventory import Product
from app.models.item_master import Item, ItemBarcode, ItemVariant
from app.models.master_lookup import MasterType, MasterValue


LOOKUP_TYPES = ("style_article", "color", "size")


def normalize(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).upper()


def barcode_values(product: Product) -> list[str]:
    values = [product.barcode]
    values.extend(product.secondary_barcodes or [])
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = normalize(value)
        if normalized and normalized not in seen:
            result.append(normalized)
            seen.add(normalized)
    return result


@dataclass
class Conflict:
    kind: str
    message: str
    product_ids: list[str] = field(default_factory=list)


@dataclass
class MigrationReport:
    database: str
    company_id: str
    product_count: int = 0
    barcode_count: int = 0
    style_count: int = 0
    color_count: int = 0
    size_count: int = 0
    variant_count: int = 0
    existing_links: int = 0
    conflicts: list[Conflict] = field(default_factory=list)
    actions: list[str] = field(default_factory=list)

    @property
    def ready(self) -> bool:
        return not self.conflicts


def add_conflict(report: MigrationReport, kind: str, message: str, product_ids: list[str]) -> None:
    report.conflicts.append(Conflict(kind, message, product_ids))


async def load_products(session: AsyncSession, company_id: str) -> list[Product]:
    result = await session.execute(
        select(Product).where(
            Product.company_id == company_id,
            Product.is_deleted.is_(False),
        ).order_by(Product.id.asc())
    )
    return list(result.scalars().all())


async def build_report(
    company_session: AsyncSession,
    control_session: AsyncSession,
    database: str,
    company_id: str,
) -> tuple[MigrationReport, list[Product]]:
    products = await load_products(company_session, company_id)
    report = MigrationReport(database=database, company_id=company_id, product_count=len(products))

    dimension_products: dict[str, dict[str, list[str]]] = {
        kind: defaultdict(list) for kind in LOOKUP_TYPES
    }
    barcode_products: dict[str, list[str]] = defaultdict(list)
    style_vendor: dict[str, set[str]] = defaultdict(set)
    combinations: dict[tuple[str, str, str], list[str]] = defaultdict(list)

    for product in products:
        product_id = str(product.id)
        style = normalize(product.style_code)
        color = normalize(product.color)
        size = normalize(product.size)
        if style:
            dimension_products["style_article"][style].append(product_id)
            if normalize(product.vendor_code):
                style_vendor[style].add(normalize(product.vendor_code))
        if color:
            dimension_products["color"][color].append(product_id)
        if size:
            dimension_products["size"][size].append(product_id)
        if style and color and size:
            combinations[(style, color, size)].append(product_id)
        for barcode in barcode_values(product):
            barcode_products[barcode].append(product_id)

    report.barcode_count = len(barcode_products)
    report.style_count = len(dimension_products["style_article"])
    report.color_count = len(dimension_products["color"])
    report.size_count = len(dimension_products["size"])

    for barcode, product_ids in barcode_products.items():
        if len(set(product_ids)) > 1:
            add_conflict(report, "BARCODE_COLLISION", f"Barcode {barcode} belongs to multiple legacy products.", product_ids)

    for style, vendors in style_vendor.items():
        if len(vendors) > 1:
            add_conflict(report, "STYLE_VENDOR_COLLISION", f"Style/article {style} has multiple vendor owners: {sorted(vendors)}.", dimension_products["style_article"][style])

    for combination, product_ids in combinations.items():
        if len(set(product_ids)) > 1:
            add_conflict(report, "VARIANT_COLLISION", f"Style/color/size combination {combination} is duplicated.", product_ids)

    existing_links = sum(1 for product in products if product.item_id or product.item_variant_id)
    report.existing_links = existing_links

    type_result = await control_session.execute(select(MasterType).where(MasterType.code.in_(LOOKUP_TYPES)))
    master_types = {item.code: item for item in type_result.scalars().all()}
    for kind in LOOKUP_TYPES:
        if kind not in master_types:
            add_conflict(report, "MISSING_LOOKUP_TYPE", f"Master type {kind} is not seeded.", [])

    if report.ready:
        report.actions.extend([
            "Create or reuse company-scoped style_article, color, and size master values.",
            "Create or reuse canonical Item and ItemVariant records for each legacy product.",
            "Copy style_article, color, and size into ItemVariant.attributes_json.",
            "Create or reuse ItemBarcode records for primary and secondary barcodes.",
            "Populate products.item_id and products.item_variant_id without deleting legacy data.",
        ])
    return report, products


async def find_master_value(control_session: AsyncSession, master_type: MasterType, company_id: str, code: str) -> MasterValue | None:
    return await control_session.scalar(
        select(MasterValue).where(
            MasterValue.master_type_id == master_type.id,
            MasterValue.company_id == company_id,
            MasterValue.code == code,
            MasterValue.is_deleted.is_(False),
        )
    )


async def ensure_master_value(control_session: AsyncSession, master_type: MasterType, company_id: str, code: str, vendor_code: str | None = None) -> None:
    existing = await find_master_value(control_session, master_type, company_id, code)
    if existing:
        if master_type.code == "style_article" and vendor_code and existing.vendor_code and existing.vendor_code != vendor_code:
            raise ValueError(f"Style/article {code} is owned by {existing.vendor_code}, not {vendor_code}")
        if master_type.code == "style_article" and vendor_code and not existing.vendor_code:
            existing.vendor_code = vendor_code
        return
    control_session.add(MasterValue(
        id=uuid.uuid4(),
        master_type_id=master_type.id,
        company_id=company_id,
        branch_id=None,
        code=code,
        name=code,
        vendor_code=vendor_code if master_type.code == "style_article" else None,
        data={"source": "LEGACY_PRODUCT_MIGRATION"},
        active=True,
        sort_order=0,
        is_deleted=False,
    ))


async def commit_migration(company_session: AsyncSession, control_session: AsyncSession, products: list[Product], company_id: str) -> None:
    type_result = await control_session.execute(select(MasterType).where(MasterType.code.in_(LOOKUP_TYPES)))
    master_types = {item.code: item for item in type_result.scalars().all()}

    for product in products:
        style = normalize(product.style_code)
        color = normalize(product.color)
        size = normalize(product.size)
        if style:
            await ensure_master_value(control_session, master_types["style_article"], company_id, style, normalize(product.vendor_code) or None)
        if color:
            await ensure_master_value(control_session, master_types["color"], company_id, color)
        if size:
            await ensure_master_value(control_session, master_types["size"], company_id, size)

    await control_session.commit()

    for product in products:
        style = normalize(product.style_code)
        color = normalize(product.color)
        size = normalize(product.size)
        item = await company_session.scalar(select(Item).where(
            Item.company_id == company_id,
            Item.item_code == normalize(product.style_code or product.code),
            Item.is_deleted.is_(False),
        ))
        if not item:
            item = Item(
                id=f"itm_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=product.branch_id,
                item_code=normalize(product.style_code or product.code),
                item_name=product.name,
                item_type="FINISHED_GOOD",
                category=product.category,
                brand=product.brand,
                hsn_code=product.hsn_code,
                tax_rate=Decimal(str(product.gst_percentage or 0)),
                primary_uom="PCS",
                status="ACTIVE",
                mrp=product.mrp or 0,
                selling_price=product.price or 0,
                cost_price=product.cost_price or 0,
                attributes_json={"source": "LEGACY_PRODUCT_MIGRATION"},
                is_deleted=False,
            )
            company_session.add(item)
            await company_session.flush()

        variant_sku = normalize(product.sku or product.code)
        variant = await company_session.scalar(select(ItemVariant).where(
            ItemVariant.company_id == company_id,
            ItemVariant.variant_sku == variant_sku,
            ItemVariant.is_deleted.is_(False),
        ))
        if not variant:
            variant = ItemVariant(
                id=f"var_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=product.branch_id,
                item_id=item.id,
                variant_sku=variant_sku,
                variant_name=product.name,
                attributes_json={"style_article": style, "color": color, "size": size, "legacy_product_id": str(product.id)},
                hsn_code=product.hsn_code,
                tax_rate=product.gst_percentage or 0,
                mrp=product.mrp or 0,
                selling_price=product.price or 0,
                cost_price=product.cost_price or 0,
                is_active=True,
                is_deleted=False,
            )
            company_session.add(variant)
            await company_session.flush()
        product.item_id = item.id
        product.item_variant_id = variant.id

        for barcode in barcode_values(product):
            existing = await company_session.scalar(select(ItemBarcode).where(
                ItemBarcode.company_id == company_id,
                ItemBarcode.barcode_normalized == barcode,
                ItemBarcode.is_deleted.is_(False),
            ))
            if existing:
                if existing.variant_id not in (None, variant.id) or existing.item_id not in (None, item.id):
                    raise ValueError(f"Barcode {barcode} is assigned to another canonical record")
                existing.item_id = item.id
                existing.variant_id = variant.id
                continue
            company_session.add(ItemBarcode(
                id=f"bc_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=product.branch_id,
                item_id=item.id,
                variant_id=variant.id,
                barcode=barcode,
                barcode_normalized=barcode,
                barcode_type="EAN13" if len(barcode) == 13 and barcode.isdigit() else "CUSTOM",
                barcode_purpose="RETAIL",
                encoding_standard="NONE",
                is_primary=barcode == normalize(product.barcode),
                status="ASSIGNED",
                source="LEGACY_PRODUCT_MIGRATION",
                source_reference=str(product.id),
                assigned_at=date.today(),
                is_active=True,
                is_deleted=False,
            ))

    await company_session.commit()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Dry-run or commit legacy catalog convergence.")
    parser.add_argument("--database", required=True, help="Registered company database, e.g. smriti001")
    parser.add_argument("--company-id", required=True, help="Company ID stored on products/master values")
    parser.add_argument("--report", type=Path, help="Write JSON report to this path")
    parser.add_argument("--commit", action="store_true", help="Write canonical records after conflict checks")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    company_factory = get_company_sessionmaker(args.database)
    async with company_factory() as company_session, async_session() as control_session:
        report, products = await build_report(company_session, control_session, args.database, args.company_id)
        if args.commit:
            if not report.ready:
                raise SystemExit("Migration blocked: resolve all report conflicts before using --commit")
            await commit_migration(company_session, control_session, products, args.company_id)
            report.actions.append("Committed canonical records and legacy links.")
        payload = asdict(report)
        payload["conflicts"] = [asdict(item) for item in report.conflicts]
        rendered = json.dumps(payload, indent=2, default=str)
        if args.report:
            args.report.write_text(rendered + "\n", encoding="utf-8")
        print(rendered)


if __name__ == "__main__":
    asyncio.run(main())
