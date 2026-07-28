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
"""

from app.services.apparel_matrix import ApparelMatrixService

def test_generate_apparel_matrix_grid():
    colors = ["Red", "Blue"]
    sizes = ["S", "M", "L"]
    variants = ApparelMatrixService.generate_matrix_grid("TSHIRT101", colors, sizes, 999.00)

    assert len(variants) == 6  # 2 colors x 3 sizes = 6 SKUs
    assert variants[0]["barcode"] == "TSHIRT101-RED-S"
    assert variants[0]["color"] == "RED"
    assert variants[0]["size"] == "S"
    assert variants[0]["mrp"] == 999.00
    assert variants[5]["barcode"] == "TSHIRT101-BLU-L"
