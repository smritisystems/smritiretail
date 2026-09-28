"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.20.0
Created      : 2026-09-28
Modified     : 2026-09-28 (Seed DB master_values from Item Master Creation Standard v2.2)
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Seeding & Master Registry Alignment
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path
from typing import Dict, List, Tuple

import openpyxl
from sqlalchemy import select

backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import dotenv_values
env_file = backend_dir.parent / ".env"
if env_file.exists():
    for k, v in dotenv_values(env_file).items():
        if v is not None and k not in os.environ:
            os.environ[k] = v

from app.db.session import async_session
from app.models.master_lookup import MasterType, MasterValue
from app.services.catalog_validation import CatalogDimensionValidator

# Dimension mapping from Workbook header to MasterType code
WORKBOOK_HEADER_TO_TYPE_CODE: Dict[str, Tuple[str, str]] = {
    "BRAND_NAME": ("brand", "Brand"),
    "COLOR": ("color", "Color"),
    "SIZE": ("size", "Size"),
    "GENDER": ("gender", "Gender"),
    "MERCHANDISE_DEPARTMENT": ("department", "Department"),
    "MERCHANDISE_CATEGORY": ("category", "Category"),
    "PRODUCT_TYPE": ("product_type", "Product Type"),
    "DESIGN_ATTRIBUTE": ("subcategory", "Subcategory"),
    "HEEL_TYPE": ("heel_type", "Heel Type"),
    "UPPER_MATERIAL": ("upper_material", "Upper Material"),
    "OUTSOLE_MATERIAL": ("outsole_material", "Outsole Material"),
    "UOM": ("uom", "Unit of Measure (UOM)"),
    "COLLECTION_TYPE": ("collection_type", "Collection Type"),
    # v2.2: Statutory GST slabs — IM-001 BLOCK on any value outside 0/5/12/18
    "GST_RATE_PERCENT": ("gst_rate", "GST Rate (%)"),
}


async def seed_master_dimensions_from_standard(workbook_path: Path):
    if not workbook_path.is_file():
        raise FileNotFoundError(f"Canonical workbook not found: {workbook_path}")

    print(f"Loading canonical standard workbook: {workbook_path}")
    wb = openpyxl.load_workbook(workbook_path, data_only=True)
    if "Validation Lists" not in wb.sheetnames:
        raise ValueError(f"'Validation Lists' sheet missing in {workbook_path}")

    ws = wb["Validation Lists"]
    sheet_data: Dict[str, List[str]] = {}
    for col in ws.iter_cols(values_only=True):
        header = col[0]
        if header:
            h_key = str(header).strip().upper()
            vals = [str(c).strip() for c in col[1:] if c is not None and str(c).strip()]
            if vals:
                sheet_data[h_key] = vals

    async with async_session() as session:
        for wb_header, (type_code, type_label) in WORKBOOK_HEADER_TO_TYPE_CODE.items():
            approved_vals = sheet_data.get(wb_header, [])
            if not approved_vals:
                print(f"Skipping {wb_header}: no values found in sheet.")
                continue

            # 1. Ensure MasterType exists
            stmt = select(MasterType).where(MasterType.code == type_code)
            res = await session.execute(stmt)
            m_type = res.scalar_one_or_none()
            if not m_type:
                m_type = MasterType(
                    id=uuid.uuid4(),
                    code=type_code,
                    label=type_label,
                    field_schema={"type": "object", "properties": {"description": {"type": "string"}}},
                    ui_schema={"type": "object", "valueFields": ["code", "name", "description"]},
                    used_in_modules=["item_master", "master_registry"],
                    version=1,
                    evidence_level="A",
                    created_by="seed_master_values_from_standard",
                )
                session.add(m_type)
                await session.flush()
                print(f"Created MasterType: {type_code} ({type_label})")

            # 2. Fetch existing active values for this type
            existing_res = await session.execute(
                select(MasterValue.code).where(
                    MasterValue.master_type_id == m_type.id,
                    MasterValue.is_deleted == False,
                )
            )
            existing_codes = {str(r[0]).strip().upper() for r in existing_res.all()}

            added_count = 0
            for val in approved_vals:
                code_clean = val.strip()
                if code_clean.upper() not in existing_codes:
                    session.add(MasterValue(
                        id=uuid.uuid4(),
                        master_type_id=m_type.id,
                        company_id=None,
                        branch_id=None,
                        code=code_clean,
                        name=code_clean,
                        active=True,
                        sort_order=0,
                        is_deleted=False,
                        data={"source": "STANDARD_WORKBOOK_SEED", "standard_version": "v2.2"},
                    ))
                    existing_codes.add(code_clean.upper())
                    added_count += 1

            print(f"Dimension '{type_code}': added {added_count} new values, {len(existing_codes)} total active.")

        await session.commit()
    print("Master values seeding complete.")


async def main():
    root = Path(__file__).resolve().parent.parent
    v2_2_path = root / "assets" / "Itemmasters" / "SMRITI_Item_Master_Creation_Standard_v2.2.xlsx"
    if not v2_2_path.exists():
        v2_2_path = root / "assets" / "Itemmasters" / "SMRITI_Item_Master_Creation_Standard_v2.1.xlsx"

    await seed_master_dimensions_from_standard(v2_2_path)

    # Verification: test CatalogDimensionValidator
    print("\n--- Verifying CatalogDimensionValidator ---")
    for wb_header, (type_code, _) in WORKBOOK_HEADER_TO_TYPE_CODE.items():
        vals = await CatalogDimensionValidator.get_approved_values(type_code)
        print(f"  {type_code}: {len(vals)} DB approved values")


if __name__ == "__main__":
    asyncio.run(main())
