"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Semantic Analysis Engine
"""

import re
from typing import Dict, List, Any, Optional

# Known entity route mappings
ENTITY_ROUTE_MAP = {
    "customer": [r"/api/v1/crm/customers", r"/api/v1/customers"],
    "item": [r"/api/v1/items", r"/api/v1/products", r"/api/v1/item-master"],
    "item_variant": [r"/api/v1/variants", r"/api/v1/barcodes"],
    "stock_movement": [r"/api/v1/inventory/stock", r"/api/v1/inventory/movements", r"/api/v1/wms"],
    "sales_invoice": [r"/api/v1/sales/invoices", r"/api/v1/sales", r"/api/v1/billing"],
    "sales_order": [r"/api/v1/sales/orders"],
    "purchase_order": [r"/api/v1/purchase/orders", r"/api/v1/purchase"],
    "tax_rate": [r"/api/v1/compliance/gst", r"/api/v1/tax"],
}

# Known entity field indicators
ENTITY_FIELD_MAP = {
    "customer": ["gst_number", "gstin", "customer_group_id", "credit_limit", "credit_days", "outstanding"],
    "item": ["department", "brand", "item_code", "tax_category", "hsn_code"],
    "item_variant": ["variant_code", "barcode", "size_label", "color", "mrp", "cost_price"],
    "stock_movement": ["movement_type", "batch_no", "warehouse_id", "quantity_delta", "wave_id"],
    "sales_invoice": ["invoice_no", "invoice_date", "subtotal", "tax_total", "grand_total"],
    "sales_order": ["order_no", "order_date", "fulfillment_status"],
    "purchase_order": ["po_number", "vendor_id", "grn_number"],
    "tax_rate": ["cgst_rate", "sgst_rate", "igst_rate", "tax_slab", "reverse_charge"],
}

# Known capability action indicators
CAPABILITY_ACTION_MAP = {
    "lookup": ["search", "find", "browse", "filter", "query", "lookup", "f2", "select"],
    "crud": ["create", "update", "delete", "save", "edit", "master", "ws", "tab", "form"],
    "three_way_match": ["match", "three_way", "po_approval", "variance"],
    "wave_picking": ["wave", "picking", "zone", "bin", "batch_pick"],
    "inter_branch_transfer": ["transfer", "inter_branch", "dispatch", "store_to_store"],
    "gst_calculation": ["gst", "calculate_tax", "tax_engine", "slab_rate"],
}


class SemanticFingerprint:
    def __init__(self, content: str, file_path: str = ""):
        self.content = content
        self.file_path = file_path.lower()
        self.api_routes: List[str] = []
        self.fields_referenced: List[str] = []
        self.detected_entities: List[str] = []
        self.detected_capabilities: List[str] = []
        self.declared_capability: Optional[Dict[str, Any]] = None
        self._analyze()

    def _analyze(self):
        # 1. Extract API routes called
        route_pattern = re.compile(r"""(?:apiFetchV1|fetch|axios|get|post|put|delete)\s*\(\s*[`"']([^`"']+)""", re.IGNORECASE)
        for match in route_pattern.finditer(self.content):
            route = match.group(1)
            self.api_routes.append(route)

        # 2. Check route entity matches
        for entity, patterns in ENTITY_ROUTE_MAP.items():
            for pat in patterns:
                if any(re.search(pat, r) for r in self.api_routes):
                    if entity not in self.detected_entities:
                        self.detected_entities.append(entity)

        # 3. Check field references in content
        for entity, fields in ENTITY_FIELD_MAP.items():
            match_count = sum(1 for f in fields if re.search(r'\b' + re.escape(f) + r'\b', self.content, re.IGNORECASE))
            if match_count >= 2 and entity not in self.detected_entities:
                self.detected_entities.append(entity)
                self.fields_referenced.extend([f for f in fields if re.search(r'\b' + re.escape(f) + r'\b', self.content, re.IGNORECASE)])

        # 4. Check capability action keywords in path or content
        search_corpus = f"{self.file_path} {self.content[:1500]}".lower()
        for cap, keywords in CAPABILITY_ACTION_MAP.items():
            if any(k in search_corpus for k in keywords):
                if cap not in self.detected_capabilities:
                    self.detected_capabilities.append(cap)

        # 5. Extract declared @SmritiCapability or @smriti_capability
        decl_pattern = re.compile(r"""(?:SmritiCapability|smriti_capability)\s*\(\s*\{?([^)]+)\}?\s*\)""", re.DOTALL)
        decl_match = decl_pattern.search(self.content)
        if decl_match:
            raw_meta = decl_match.group(1)
            ent_match = re.search(r"""entity\s*[:=]\s*["']([^"']+)["']""", raw_meta)
            cap_match = re.search(r"""capability\s*[:=]\s*["']([^"']+)["']""", raw_meta)
            role_match = re.search(r"""role\s*[:=]\s*["']([^"']+)["']""", raw_meta)
            self.declared_capability = {
                "entity": ent_match.group(1) if ent_match else None,
                "capability": cap_match.group(1) if cap_match else None,
                "role": role_match.group(1) if role_match else "CANONICAL",
            }
            if self.declared_capability["entity"] and self.declared_capability["entity"] not in self.detected_entities:
                self.detected_entities.insert(0, self.declared_capability["entity"])
            if self.declared_capability["capability"] and self.declared_capability["capability"] not in self.detected_capabilities:
                self.detected_capabilities.insert(0, self.declared_capability["capability"])

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "detected_entities": self.detected_entities,
            "detected_capabilities": self.detected_capabilities,
            "api_routes": self.api_routes,
            "fields_referenced": self.fields_referenced,
            "declared_capability": self.declared_capability,
        }
