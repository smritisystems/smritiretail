"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.1.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from app.core.bom_kitting import (
    BillOfMaterialsEngine,
    BillOfMaterials,
    BomComponent,
)

def test_bom_kitting_execution_lifecycle():
    initial_stock = {
        "WH-MAIN": {
            "RAW-CPU-I7": 10.0,
            "RAW-RAM-16G": 20.0,
            "RAW-SSD-1T": 10.0,
        }
    }

    engine = BillOfMaterialsEngine(warehouse_stock=initial_stock)

    # 1. Register BOM for Desktop PC
    components = [
        BomComponent("RAW-CPU-I7", "Intel i7 CPU", quantity_required=1.0, unit_cost=25000.0),
        BomComponent("RAW-RAM-16G", "16GB RAM Stick", quantity_required=2.0, unit_cost=4000.0),
        BomComponent("RAW-SSD-1T", "1TB NVMe SSD", quantity_required=1.0, unit_cost=6000.0),
    ]
    bom = BillOfMaterials("BOM-PC-01", "KIT-DESKTOP-PRO", "Pro Desktop PC", components, labor_cost_per_unit=1000.0)
    engine.register_bom(bom)

    # 2. Build 5 Desktop PCs
    result = engine.execute_kitting_order("WO-5001", "WH-MAIN", "KIT-DESKTOP-PRO", build_quantity=5.0)

    assert result.build_quantity == 5.0
    assert result.total_cost == (25000 + 8000 + 6000 + 1000) * 5  # 40,000 * 5 = 200,000

    # Components stock reduced
    assert engine.get_stock("WH-MAIN", "RAW-CPU-I7") == 5.0
    assert engine.get_stock("WH-MAIN", "RAW-RAM-16G") == 10.0

    # Finished Good stock added
    assert engine.get_stock("WH-MAIN", "KIT-DESKTOP-PRO") == 5.0

def test_insufficient_raw_materials_error():
    initial_stock = {"WH-MAIN": {"RAW-CPU-I7": 1.0}}
    engine = BillOfMaterialsEngine(warehouse_stock=initial_stock)

    bom = BillOfMaterials("BOM-02", "KIT-DESKTOP", "Desktop", [BomComponent("RAW-CPU-I7", "CPU", 1.0)])
    engine.register_bom(bom)

    with pytest.raises(ValueError, match="Insufficient stock for component"):
        engine.execute_kitting_order("WO-5002", "WH-MAIN", "KIT-DESKTOP", build_quantity=5.0)
