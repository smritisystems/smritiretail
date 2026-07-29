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
Classification: Color-Size-Style 3D Matrix Grid Engine
"""

import uuid
from typing import Dict, Any, List


class ApparelMatrixGridEngine:
    """Color-Size-Style 3D Variant Matrix Allocator."""

    @classmethod
    def generate_variant_grid(cls, style_code: str, colors: List[str], sizes: List[str], base_mrp: float, stock_per_variant: int = 10) -> Dict[str, Any]:
        variants = []
        for color in colors:
            for size in sizes:
                barcode = f"890{style_code[:4].upper()}{color[:2].upper()}{size[:2].upper()}"
                variants.append({
                    "variant_id": str(uuid.uuid4()),
                    "style_code": style_code.upper(),
                    "color": color.upper(),
                    "size": size.upper(),
                    "mrp": base_mrp,
                    "stock_qty": stock_per_variant,
                    "barcode": barcode
                })

        return {
            "style_code": style_code.upper(),
            "colors_count": len(colors),
            "sizes_count": len(sizes),
            "total_variants_generated": len(variants),
            "variants": variants
        }
