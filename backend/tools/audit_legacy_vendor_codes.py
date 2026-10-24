"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-09-12
Modified     : 2026-09-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
import argparse
import os
import sys
from pathlib import Path
from typing import Dict, List, Any

# Ensure backend path is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Default test keys if not supplied in environment
os.environ.setdefault("JWT_SECRET_KEY", "jwt-secret-key-32-chars-long-smriti-test")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "internal-service-key-32-chars-test")
os.environ.setdefault("SGIP_VAULT_MASTER_KEY", "dev-test-sgip-vault-master-key-32-chars")

from sqlalchemy import select, update, func, text, and_, or_
from app.db.session import get_company_sessionmaker
from app.models.inventory import Product
from app.models.purchase import Supplier


async def audit_legacy_products(company_code: str = "smriti001", apply_fix: bool = False, default_code: str = "LEGACY-UNASSIGNED") -> Dict[str, Any]:
    """
    Scans products with missing or blank vendor_code,
    detects style-level grouping, and optionally backfills canonical/fallback vendor codes.
    """
    session_factory = get_company_sessionmaker(company_code)
    async with session_factory() as session:
        # 1. Total products count
        total_stmt = select(func.count(Product.id)).where(Product.is_deleted.is_(False))
        total_products = (await session.execute(total_stmt)).scalar() or 0

        # 2. Products missing vendor_code
        missing_stmt = select(Product).where(
            and_(
                Product.is_deleted.is_(False),
                or_(Product.vendor_code.is_(None), Product.vendor_code == "")
            )
        ).order_by(Product.style_code.asc(), Product.name.asc())

        missing_records = (await session.execute(missing_stmt)).scalars().all()
        missing_count = len(missing_records)

        # 3. Group by style_code
        styles_map: Dict[str, List[Product]] = {}
        for p in missing_records:
            style_key = p.style_code or "NO_STYLE"
            if style_key not in styles_map:
                styles_map[style_key] = []
            styles_map[style_key].append(p)

        print("=" * 70)
        print(f"SMRITI LEGACY VENDOR CODE AUDIT REPORT — Company: {company_code}")
        print("=" * 70)
        print(f"Total Active Products in Database : {total_products}")
        print(f"Products with Missing Vendor Code : {missing_count} ({(missing_count / total_products * 100) if total_products else 0:.1f}%)")
        print(f"Distinct Impacted Styles/Articles : {len(styles_map)}")
        print("-" * 70)

        for style, items in list(styles_map.items())[:20]:
            print(f"• Style: '{style}' — {len(items)} variant(s) — Sample: '{items[0].name}' (Brand: {items[0].brand or 'N/A'})")
        if len(styles_map) > 20:
            print(f"... and {len(styles_map) - 20} more distinct styles.")
        print("-" * 70)

        updated_count = 0
        if apply_fix and missing_count > 0:
            print(f"Applying controlled backfill with fallback code '{default_code}'...")
            update_stmt = (
                update(Product)
                .where(
                    and_(
                        Product.is_deleted.is_(False),
                        or_(Product.vendor_code.is_(None), Product.vendor_code == "")
                    )
                )
                .values(vendor_code=default_code)
            )
            res = await session.execute(update_stmt)
            await session.commit()
            updated_count = res.rowcount
            print(f"SUCCESS: Successfully backfilled {updated_count} legacy product records with '{default_code}'.")
        elif missing_count > 0:
            print("DRY-RUN COMPLETE: Run with --apply to execute the controlled migration backfill.")
        else:
            print("ALL PRODUCTS GOVERNED: Zero legacy products with missing vendor codes detected.")

        print("=" * 70)
        return {
            "total_products": total_products,
            "missing_count": missing_count,
            "distinct_styles": len(styles_map),
            "updated_count": updated_count
        }


def main():
    parser = argparse.ArgumentParser(description="Audit and migrate legacy Article/Style records with missing Vendor Code.")
    parser.add_argument("--company", default="smriti001", help="Company database identifier (default: smriti001)")
    parser.add_argument("--apply", action="store_true", help="Execute the migration and backfill records")
    parser.add_argument("--fallback-code", default="LEGACY-UNASSIGNED", help="Fallback vendor code (default: LEGACY-UNASSIGNED)")
    args = parser.parse_args()

    asyncio.run(audit_legacy_products(
        company_code=args.company,
        apply_fix=args.apply,
        default_code=args.fallback_code
    ))


if __name__ == "__main__":
    main()
