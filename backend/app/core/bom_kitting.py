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

"""
SMRITI Inventory & Manufacturing Core Layer - Bill of Materials (BOM) & Kitting Assembly Engine
Conforms to Level 1 SMRITI Architecture Constitution (Rule GR-011 Canonical Ownership: Inventory).

Handles light manufacturing & kit assembly:
1. BOM Definition: Maps finished SKU to component raw materials and required ratios.
2. Component Availability Audit: Validates stock of all component SKUs before kitting.
3. Kitting Execution: Atomically deducts raw material components and adds finished goods stock.
"""

from dataclasses import dataclass, field
import datetime
from typing import List, Dict, Optional


@dataclass
class BomComponent:
    component_sku: str
    component_name: str
    quantity_required: float
    unit_cost: float = 0.0


@dataclass
class BillOfMaterials:
    bom_id: str
    finished_sku: str
    finished_item_name: str
    components: List[BomComponent]
    labor_cost_per_unit: float = 0.0

    @property
    def total_unit_cost(self) -> float:
        comp_cost = sum(c.quantity_required * c.unit_cost for c in self.components)
        return round(comp_cost + self.labor_cost_per_unit, 2)



@dataclass
class KittingExecutionResult:
    work_order_id: str
    finished_sku: str
    build_quantity: float
    total_cost: float
    components_deducted: List[Dict[str, float]]
    timestamp: datetime.datetime = field(default_factory=datetime.datetime.now)


class BillOfMaterialsEngine:
    """
    Canonical Engine for Retail Kitting & BOM Assembly Work Orders.
    """

    def __init__(self, warehouse_stock: Optional[Dict[str, Dict[str, float]]] = None):
        # warehouse_stock format: {warehouse_id: {sku: quantity}}
        self.warehouse_stock: Dict[str, Dict[str, float]] = warehouse_stock or {}
        self.boms: Dict[str, BillOfMaterials] = {}  # Key: finished_sku

    def register_bom(self, bom: BillOfMaterials) -> None:
        self.boms[bom.finished_sku] = bom

    def get_stock(self, warehouse_id: str, sku: str) -> float:
        return self.warehouse_stock.get(warehouse_id, {}).get(sku, 0.0)

    def execute_kitting_order(
        self, work_order_id: str, warehouse_id: str, finished_sku: str, build_quantity: float
    ) -> KittingExecutionResult:
        if build_quantity <= 0:
            raise ValueError("Build quantity must be greater than 0.")

        bom = self.boms.get(finished_sku)
        if not bom:
            raise KeyError(f"No Bill of Materials (BOM) registered for finished SKU '{finished_sku}'.")

        wh_stock = self.warehouse_stock.setdefault(warehouse_id, {})

        # 1. Audit component availability
        for comp in bom.components:
            required_total = comp.quantity_required * build_quantity
            avail = wh_stock.get(comp.component_sku, 0.0)
            if avail < required_total:
                raise ValueError(
                    f"Insufficient stock for component SKU '{comp.component_sku}' ({comp.component_name}). "
                    f"Required: {required_total}, Available: {avail}"
                )

        # 2. Execute atomic kitting (Deduct components & Add finished good)
        deducted_log = []
        for comp in bom.components:
            required_total = comp.quantity_required * build_quantity
            wh_stock[comp.component_sku] -= required_total
            deducted_log.append(
                {"component_sku": comp.component_sku, "deducted_quantity": required_total}
            )

        # Add finished product to stock
        wh_stock[finished_sku] = wh_stock.get(finished_sku, 0.0) + build_quantity

        total_cost = round(bom.total_unit_cost * build_quantity, 2)

        return KittingExecutionResult(
            work_order_id=work_order_id,
            finished_sku=finished_sku,
            build_quantity=build_quantity,
            total_cost=total_cost,
            components_deducted=deducted_log,
        )
