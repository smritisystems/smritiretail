"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

apparel_matrix.py — Apparel Color/Size Variant Grid & SKU Generator Service
Conforms to Level 1 SMRITI Architecture Constitution (ADR-003 & ADR-006).
"""

from typing import List, Dict, Any

class ApparelMatrixService:
    """Service handling Apparel multi-dimensional Color/Size matrix grid generation."""

    @staticmethod
    def generate_matrix_grid(style_code: str, colors: List[str], sizes: List[str], base_mrp: float) -> List[Dict[str, Any]]:
        """
        Generates 2D Color x Size SKU variant matrix with unique barcodes.
        """
        variants = []
        for color in colors:
            for size in sizes:
                clean_color = color.strip().upper()
                clean_size = size.strip().upper()
                barcode = f"{style_code.upper()}-{clean_color[:3]}-{clean_size}"
                variants.append({
                    "style_code": style_code.upper(),
                    "color": clean_color,
                    "size": clean_size,
                    "fit": "REGULAR",
                    "mrp": float(base_mrp),
                    "stock_qty": 0,
                    "barcode": barcode
                })
        return variants
