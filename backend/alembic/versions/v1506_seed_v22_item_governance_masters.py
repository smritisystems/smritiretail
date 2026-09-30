"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.48.0
Created      : 2026-09-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Schema Seeding & Master Governance Hardening

v1506: Seed v2.2 Item Governance Master Types and Master Values.
Seeds canonical v2.2 standard validation lists + client onboarding list:
- heel_type: CUBE HEEL, BIG PLATFORM, etc.
- upper_material: LYCRA, FABRIC, etc. (excludes MATERIAL pending confirmation)
- product_type: HALF SHOE, etc. (excludes MUEL pending confirmation)
- gender: MEN, WOMEN, BOYS, GIRLS, MENS, LADIES, KIDS, UNISEX, NA
- design_attribute (subcategory): COMFORT, etc. (excludes REGULAR, CHIKKU, SULTAN)
- outsole_material: SHEET, SHEET SOLE, TPR, EVA, etc.
- collection_type: BASIC, PARTY, CASUAL, etc.
- color: BRONZE, GUNMETAL, MUSTARD, PEACH, ROSE, TOUPE, ROSE GOLD, etc. (excludes CHIKKU, SULTAN)
- uom: Pair, Pcs, Box, Set, Meter
- gst_rate: 0, 5, 12, 18, 28
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1506"
down_revision: Union[str, Sequence[str], None] = "v1505"
branch_labels = None
depends_on = None

MASTER_TYPES_TO_SEED = [
    ("heel_type", "Heel Type"),
    ("upper_material", "Upper Material"),
    ("product_type", "Product Type"),
    ("gender", "Gender"),
    ("subcategory", "Subcategory / Design Attribute"),
    ("outsole_material", "Outsole Material"),
    ("collection_type", "Collection Type"),
    ("color", "Color"),
    ("uom", "Unit of Measure (UOM)"),
    ("gst_rate", "GST Rate (%)"),
]

DIMENSION_VALUES = {
    "heel_type": [
        "BIG PLATFORM",
        "BLOCK",
        "BOX HEEL",
        "CONE",
        "CUBE HEEL",
        "FLAT",
        "KITTEN",
        "PLATFORM",
        "SMALL PLATFORM",
        "STILETTO",
        "WEDGE",
    ],
    "upper_material": [
        "CANVAS",
        "FABRIC",
        "JACQUARD",
        "LEATHER",
        "LYCRA",
        "MESH",
        "PATENT LEATHER",
        "PU",
        "PVC",
        "SUEDE",
        "SYNTHETIC",
        "TEXTILE",
        "VELVET",
    ],
    "product_type": [
        "BELLIES",
        "BOOT",
        "CHAPPAL",
        "CLOG",
        "FLAT",
        "HALF SHOE",
        "HEEL",
        "LOAFER",
        "MULE",
        "SANDAL",
        "SHOE",
        "SLIPPER",
        "SNEAKER",
    ],
    "gender": [
        "BOYS",
        "GIRLS",
        "KIDS",
        "LADIES",
        "MEN",
        "MENS",
        "NA",
        "UNISEX",
        "WOMEN",
    ],
    "subcategory": [
        "AAR PAAR",
        "ANKLE STRAP",
        "BACK STRAP",
        "BUCKLE",
        "BURMY",
        "CHAPPAL",
        "COMFORT",
        "CROSS",
        "DOUBLE STRAP",
        "FLIP FLOP",
        "FULL CLOSE",
        "GANDHI",
        "HALF CLOSE",
        "LACE UP",
        "ONE STRAP",
        "PLAIN",
        "SANDAL",
        "SLIP ON",
        "THONGS",
        "TOE RING",
        "TRANSPARENT",
        "V-SHAPED",
    ],
    "outsole_material": [
        "AIRMAX",
        "EVA",
        "LEATHER",
        "PU",
        "PVC",
        "RUBBER",
        "SHEET",
        "SHEET SOLE",
        "TPR",
        "TPU",
    ],
    "collection_type": [
        "BASIC",
        "BRIDAL",
        "CASUAL",
        "FESTIVE",
        "FORMAL",
        "PARTY",
        "SPORTS",
        "WORKWEAR",
    ],
    "color": [
        "BEIGE",
        "BLACK",
        "BLUE",
        "BRONZE",
        "BROWN",
        "CREAM",
        "GOLD",
        "GREEN",
        "GREY",
        "GUNMETAL",
        "MAROON",
        "MULTI",
        "MUSTARD",
        "NAVY",
        "OLIVE",
        "PEACH",
        "PINK",
        "RED",
        "ROSE",
        "ROSE GOLD",
        "SILVER",
        "TAN",
        "TOUPE",
        "WHITE",
    ],
    "uom": [
        "Box",
        "Meter",
        "Pair",
        "Pcs",
        "Set",
    ],
    "gst_rate": [
        "0",
        "5",
        "12",
        "18",
        "28",
    ],
}


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Check if master_types table exists
    has_master_types = bind.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_types')")
    ).scalar()

    if not has_master_types:
        return

    # 2. Ensure each master_type is registered
    for type_code, type_label in MASTER_TYPES_TO_SEED:
        bind.execute(
            sa.text(
                """
                INSERT INTO master_types (
                    id, code, label, field_schema, ui_schema,
                    used_in_modules, version, evidence_level, created_by, created_at
                )
                VALUES (
                    gen_random_uuid(), :code, :label,
                    CAST(:field_schema AS jsonb), CAST(:ui_schema AS jsonb),
                    ARRAY['item_master', 'universal_import', 'inventory'], 1, 'D', 'system', NOW()
                )
                ON CONFLICT (code) DO UPDATE SET
                    label = EXCLUDED.label,
                    field_schema = EXCLUDED.field_schema,
                    ui_schema = EXCLUDED.ui_schema
                """
            ),
            {
                "code": type_code,
                "label": type_label,
                "field_schema": '{"type":"object","properties":{"description":{"type":"string"}}}',
                "ui_schema": '{"type":"object","valueFields":["code","name","description"]}',
            },
        )

    # 3. Seed canonical master values for each dimension
    has_master_values = bind.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_values')")
    ).scalar()

    if not has_master_values:
        return

    for dim_code, values in DIMENSION_VALUES.items():
        for val in values:
            clean_val = val.strip()
            bind.execute(
                sa.text(
                    """
                    INSERT INTO master_values (
                        id, master_type_id, company_id, branch_id, code, name,
                        vendor_code, data, active, sort_order, updated_at, is_deleted
                    )
                    SELECT 
                        gen_random_uuid(), mt.id, 'GLOBAL', NULL, CAST(:code AS varchar), CAST(:name AS varchar),
                        NULL, jsonb_build_object('description', CAST(:name AS text)), true, 0, NOW(), false
                    FROM master_types mt
                    WHERE mt.code = :dim_code
                      AND NOT EXISTS (
                          SELECT 1 FROM master_values mv
                          WHERE mv.master_type_id = mt.id
                            AND (LOWER(mv.code) = LOWER(CAST(:code AS varchar)) OR LOWER(mv.name) = LOWER(CAST(:name AS varchar)))
                            AND mv.is_deleted = false
                      )
                    """
                ),
                {
                    "dim_code": dim_code,
                    "code": clean_val,
                    "name": clean_val,
                },
            )


def downgrade() -> None:
    pass
