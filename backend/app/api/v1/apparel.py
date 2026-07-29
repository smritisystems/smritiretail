"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 25.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Apparel & Fashion Retail REST API Gateway
"""

from typing import Dict, Any, List
from fastapi import APIRouter, Body, Query

from app.core.apparel.matrix_grid import ApparelMatrixGridEngine
from app.core.apparel.markdown_engine import SeasonalMarkdownEngine
from app.core.apparel.hangtag_generator import HangtagGeneratorEngine

router = APIRouter(prefix="/apparel", tags=["Domain Release: Apparel & Fashion 3D Matrix Engine (v25.0.0)"])


@router.post("/matrix/generate")
async def generate_apparel_matrix_grid(style_code: str = Body(...), colors: List[str] = Body(...), sizes: List[str] = Body(...), base_mrp: float = Body(...), stock_per_variant: int = Body(10)):
    """Generates 3D Color-Size-Style matrix variant grid."""
    return ApparelMatrixGridEngine.generate_variant_grid(style_code, colors, sizes, base_mrp, stock_per_variant)


@router.post("/markdown/calculate")
async def calculate_seasonal_markdown(original_mrp: float = Body(...), inventory_age_days: int = Body(...)):
    """Calculates automated markdown discount based on inventory age."""
    return SeasonalMarkdownEngine.calculate_markdown(original_mrp, inventory_age_days)


@router.get("/hangtags/render")
async def render_thermal_hangtag(style_code: str = Query(...), color: str = Query(...), size: str = Query(...), mrp: float = Query(...), barcode: str = Query(...)):
    """Renders ZPL thermal barcode hangtag layout for clothing tags."""
    return HangtagGeneratorEngine.render_hangtag(style_code, color, size, mrp, barcode)
