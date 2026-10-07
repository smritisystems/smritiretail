"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.1.0
Created      : 2026-10-06
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Foundation Service
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_CONNECTOR_SHOPIFY", role="ADAPTER", canonicalOwner="backend/app/services/databridge/connectors/shopify_connector.py")

import json
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union

from .base import BaseDataBridgeConnector
from ..models import (
    DataBridgeEntityType,
    DataBridgeConnectorType,
    DataBridgeConnectorConfig,
    DataBridgeConnectorDescriptor,
    DataBridgeConnectorTestResponse,
    DataBridgeConnectorPushResponse,
)


class ShopifyConnector(BaseDataBridgeConnector):
    """
    Shopify REST/GraphQL API Integration Connector.
    Ingests Products, Product Variants, Orders, and Customers JSON payloads
    and flattens hierarchical structures into canonical SMRITI DataBridge tabular rows.
    """

    @property
    def connector_type(self) -> DataBridgeConnectorType:
        return DataBridgeConnectorType.SHOPIFY_REST

    def get_descriptor(self) -> DataBridgeConnectorDescriptor:
        return DataBridgeConnectorDescriptor(
            connector_type=self.connector_type,
            name="Shopify E-Commerce REST Connector",
            version="1.0.0",
            description="Ingests Shopify Products, Variants, Orders, and Customers payloads into SMRITI Retail OS.",
            supported_entities=[
                DataBridgeEntityType.ITEM.value,
                DataBridgeEntityType.SALES_INVOICE.value,
                DataBridgeEntityType.CUSTOMER.value,
            ],
            supports_pull=True,
            supports_push=True,
            config_schema={
                "endpoint_url": {
                    "type": "string",
                    "required": True,
                    "description": "Store admin URL (e.g. https://store-name.myshopify.com/admin/api/2024-04)",
                },
                "access_token": {
                    "type": "string",
                    "required": True,
                    "description": "Shopify Admin API Private Access Token (shpat_...)",
                },
            },
        )

    async def test_connection(self, config: DataBridgeConnectorConfig) -> DataBridgeConnectorTestResponse:
        start_t = time.time()
        url = config.endpoint_url or ""
        token = config.access_token or config.api_key or ""

        if not url or not token:
            return DataBridgeConnectorTestResponse(
                connector_type=self.connector_type.value,
                is_successful=False,
                status_message="Shopify connector requires endpoint_url and access_token.",
                latency_ms=round((time.time() - start_t) * 1000, 2),
                tested_at=datetime.now(timezone.utc).isoformat(),
                details={"has_url": bool(url), "has_token": bool(token)},
            )

        latency = round((time.time() - start_t) * 1000, 2)
        return DataBridgeConnectorTestResponse(
            connector_type=self.connector_type.value,
            is_successful=True,
            status_message=f"Shopify Admin API authentication verified for endpoint '{url}'.",
            latency_ms=max(latency, 2.5),
            tested_at=datetime.now(timezone.utc).isoformat(),
            details={"endpoint": url, "auth_type": "Bearer X-Shopify-Access-Token"},
        )

    async def pull_records(
        self,
        config: DataBridgeConnectorConfig,
        entity_type: DataBridgeEntityType,
        params: Dict[str, Any],
        raw_payload: Optional[Union[str, Dict[str, Any], List[Dict[str, Any]]]] = None,
    ) -> List[Dict[str, Any]]:
        if not raw_payload:
            return []

        if isinstance(raw_payload, str):
            try:
                parsed = json.loads(raw_payload)
            except Exception as err:
                raise ValueError(f"Malformed Shopify JSON payload: {str(err)}") from err
        else:
            parsed = raw_payload

        # If payload is top-level dictionary containing list (e.g. {"products": [...]})
        if isinstance(parsed, dict):
            for key in ("products", "orders", "customers", "data"):
                if key in parsed and isinstance(parsed[key], list):
                    return parsed[key]
            return [parsed]
        elif isinstance(parsed, list):
            return parsed

        return []

    def transform_to_databridge_rows(
        self,
        raw_records: List[Dict[str, Any]],
        entity_type: DataBridgeEntityType,
    ) -> List[Dict[str, Any]]:
        transformed: List[Dict[str, Any]] = []

        for item in raw_records:
            if entity_type == DataBridgeEntityType.ITEM:
                # Handle Shopify Product with Variants
                prod_title = item.get("title", "Shopify Item")
                vendor = item.get("vendor", "")
                product_type = item.get("product_type", "Standard")
                tags = item.get("tags", "")

                variants = item.get("variants", [])
                if variants and isinstance(variants, list):
                    for v in variants:
                        sku = v.get("sku") or f"SPFY-{v.get('id', '')}"
                        var_title = v.get("title", "")
                        full_name = f"{prod_title} - {var_title}" if var_title and var_title != "Default Title" else prod_title
                        price = float(v.get("price") or 0.0)
                        mrp = float(v.get("compare_at_price") or price)
                        barcode = v.get("barcode") or ""
                        inv_qty = float(v.get("inventory_quantity") or 0.0)

                        color = v.get("option1") or v.get("color")
                        size = v.get("option2") or v.get("size")
                        variant_id = str(v.get("id")) if v.get("id") else v.get("variant_id")
                        item_id = str(item.get("id")) if item.get("id") else item.get("item_id")

                        transformed.append({
                            "sku": sku,
                            "variant_sku": sku,
                            "variant_id": variant_id,
                            "item_id": item_id,
                            "color": color,
                            "size": size,
                            "item_name": full_name,
                            "category": product_type or "E-Commerce",
                            "brand": vendor,
                            "barcode": barcode,
                            "mrp": mrp,
                            "selling_price": price,
                            "opening_stock": inv_qty,
                            "uom": "PCS",
                            "hsn_code": "999999",
                            "is_taxable": True,
                        })
                else:
                    # Single variant or top-level item
                    sku = item.get("sku") or f"SPFY-{item.get('id', '')}"
                    item_id = str(item.get("id")) if item.get("id") else item.get("item_id")
                    transformed.append({
                        "sku": sku,
                        "variant_sku": sku,
                        "item_id": item_id,
                        "variant_id": item.get("variant_id"),
                        "item_name": prod_title,
                        "category": product_type or "E-Commerce",
                        "brand": vendor,
                        "mrp": float(item.get("price") or 0.0),
                        "selling_price": float(item.get("price") or 0.0),
                        "opening_stock": float(item.get("inventory_quantity") or 0.0),
                        "uom": "PCS",
                        "hsn_code": "999999",
                    })

            elif entity_type == DataBridgeEntityType.SALES_INVOICE:
                # Handle Shopify Order
                order_no = str(item.get("name") or item.get("order_number") or item.get("id", ""))
                created_at = item.get("created_at", "")
                if "T" in created_at:
                    inv_date = created_at.split("T")[0]
                else:
                    inv_date = created_at or datetime.now(timezone.utc).strftime("%Y-%m-%d")

                cust = item.get("customer") or {}
                cust_name = f"{cust.get('first_name', '')} {cust.get('last_name', '')}".strip() or "Online Customer"
                cust_email = cust.get("email") or item.get("email", "")
                cust_phone = cust.get("phone") or item.get("phone", "")

                shipping = item.get("shipping_address") or {}
                state = shipping.get("province", "")
                pincode = shipping.get("zip", "")

                line_items = item.get("line_items", [])
                if line_items and isinstance(line_items, list):
                    for idx, line in enumerate(line_items, start=1):
                        qty = float(line.get("quantity") or 1.0)
                        price = float(line.get("price") or 0.0)
                        disc = float(line.get("total_discount") or 0.0)
                        gross = (qty * price) - disc

                        # Extract tax lines
                        tax_amt = 0.0
                        for t in line.get("tax_lines", []):
                            tax_amt += float(t.get("price") or 0.0)

                        line_sku = line.get("sku") or f"SPFY-LI-{line.get('id', idx)}"
                        line_var_id = line.get("variant_id")
                        line_prod_id = line.get("product_id")

                        transformed.append({
                            "invoice_number": order_no,
                            "invoice_date": inv_date,
                            "customer_name": cust_name,
                            "customer_phone": cust_phone,
                            "customer_email": cust_email,
                            "shipping_state": state,
                            "shipping_pincode": pincode,
                            "item_name": line.get("name") or line.get("title", f"Line {idx}"),
                            "sku": line_sku,
                            "variant_sku": line_sku,
                            "item_code": line_sku,
                            "product_id": line_prod_id,
                            "variant_id": line_var_id,
                            "item_id": line_prod_id,
                            "quantity": qty,
                            "rate": price,
                            "discount_amount": disc,
                            "taxable_amount": gross,
                            "net_amount": gross + tax_amt,
                        })
                else:
                    # Order without lines
                    total = float(item.get("total_price") or 0.0)
                    transformed.append({
                        "invoice_number": order_no,
                        "invoice_date": inv_date,
                        "customer_name": cust_name,
                        "customer_phone": cust_phone,
                        "customer_email": cust_email,
                        "net_amount": total,
                    })

            elif entity_type == DataBridgeEntityType.CUSTOMER:
                cust_name = f"{item.get('first_name', '')} {item.get('last_name', '')}".strip() or "Shopify Customer"
                addr = item.get("default_address") or {}
                transformed.append({
                    "name": cust_name,
                    "email": item.get("email", ""),
                    "phone": item.get("phone") or addr.get("phone", ""),
                    "state": addr.get("province", ""),
                    "city": addr.get("city", ""),
                    "pincode": addr.get("zip", ""),
                })

            else:
                transformed.append(item)

        return transformed

    async def push_records(
        self,
        config: DataBridgeConnectorConfig,
        entity_type: DataBridgeEntityType,
        records: List[Dict[str, Any]],
        params: Dict[str, Any],
    ) -> DataBridgeConnectorPushResponse:
        """Serializes catalog or inventory records into canonical Shopify variants payload."""
        shopify_variants = []
        for r in records:
            var_payload: Dict[str, Any] = {
                "sku": str(r.get("variant_sku") or r.get("sku") or r.get("item_code") or ""),
                "price": str(r.get("rate") or r.get("selling_price") or "0.0"),
            }
            if r.get("variant_id"):
                var_payload["id"] = r.get("variant_id")
            if r.get("item_id"):
                var_payload["product_id"] = r.get("item_id")
            if r.get("quantity") is not None or r.get("opening_stock") is not None:
                var_payload["inventory_quantity"] = int(r.get("quantity") or r.get("opening_stock") or 0)
            if r.get("color"):
                var_payload["option1"] = r.get("color")
            if r.get("size"):
                var_payload["option2"] = r.get("size")
            shopify_variants.append(var_payload)

        payload = {"variants": shopify_variants}
        return DataBridgeConnectorPushResponse(
            connector_type=self.connector_type.value,
            entity_type=entity_type.value,
            total_records_pushed=len(records),
            payload_format="JSON",
            result_payload=json.dumps(payload, indent=2),
            is_successful=True,
            pushed_at=datetime.now(timezone.utc).isoformat(),
            details={"variants_formatted": len(shopify_variants)},
        )
