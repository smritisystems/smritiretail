"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import re
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.inventory import StockTransfer, StockTransferItem, Warehouse, Product
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.crm import Customer
from ..models.tenant import Company
from ..api.deps import TenantContext
from ..core.config import settings

# Statutory Indian GSTIN validation pattern
GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def compute_gstin_checksum(gstin14: str) -> str:
    """Calculate the 15th statutory check character using GSTN Luhn Mod 36 algorithm."""
    total = 0
    for i, ch in enumerate(gstin14.upper()):
        cval = GSTIN_CHARS.index(ch)
        factor = 1 if (i % 2 == 0) else 2
        prod = cval * factor
        quotient, remainder = divmod(prod, 36)
        total += quotient + remainder
    check_val = (36 - (total % 36)) % 36
    return GSTIN_CHARS[check_val]


def is_valid_gstin_checksum(gstin: str) -> bool:
    """Verify statutory checksum digit on 15-character GSTIN."""
    if not gstin or len(gstin) != 15:
        return False
    try:
        return compute_gstin_checksum(gstin[:14]) == gstin[14].upper()
    except (ValueError, KeyError, IndexError):
        return False


# Statutory Indian GST State Codes dictionary per GSTN master
VALID_GST_STATE_CODES = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu",
    "27": "Maharashtra",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "97": "Other Territory",
    "99": "Centre Jurisdiction",
}


class EWayBillService:
    """
    Engine for generating NIC-shaped GST E-Way Bill JSON payloads (v1.0.0 schema)
    and Rule 55 Delivery Challans for inter-godown transfers and B2B invoices.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def _get_company(self) -> Optional[Company]:
        res = await self.db.execute(
            select(Company).where(
                Company.id == self.tenant.company_id,
                Company.is_deleted == False
            )
        )
        return res.scalar_one_or_none()

    async def _batch_load_products(self, product_ids: List[str]) -> Dict[str, Product]:
        """Batch load products in a single SQL query to prevent N+1 overhead."""
        unique_ids = list(set(pid for pid in product_ids if pid))
        if not unique_ids:
            return {}
        res = await self.db.execute(
            select(Product).where(Product.id.in_(unique_ids))
        )
        return {p.id: p for p in res.scalars().all()}

    def _validate_gstin(self, gstin: Optional[str], label: str = "GSTIN") -> Tuple[bool, Optional[str]]:
        """Validate format, state code, and Mod 36 checksum of statutory GSTIN."""
        if not gstin or gstin == "URP":
            return True, None # Unregistered Person
        if not GSTIN_REGEX.match(gstin):
            return False, f"Invalid {label} format '{gstin}'. Expected 15-character alphanumeric GSTIN."
        state_prefix = gstin[:2]
        if state_prefix not in VALID_GST_STATE_CODES:
            return False, f"Invalid State Code '{state_prefix}' in {label} '{gstin}'."
        if not is_valid_gstin_checksum(gstin):
            expected = compute_gstin_checksum(gstin[:14])
            return False, f"Invalid {label} checksum in '{gstin}'. Expected check digit '{expected}', got '{gstin[14]}'."
        return True, None

    async def generate_transfer_eway_bill_payload(
        self,
        transfer_id: str,
        trans_distance_km: int = 50,
        trans_mode: str = "1",
        vehicle_type: str = "R",
        strict_validation: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Generate export-ready NIC GST E-Way Bill JSON payload for Inter-Godown Stock Transfer (Delivery Challan).
        Batch queries products to guarantee high performance on multi-item consignments.
        Enforces non-overrideable strict validation in production mode.
        """
        is_strict = True if settings.STRICT_STATUTORY_MODE else bool(strict_validation)

        res = await self.db.execute(
            select(StockTransfer).where(
                StockTransfer.id == transfer_id,
                StockTransfer.company_id == self.tenant.company_id,
                StockTransfer.is_deleted == False
            ).options(selectinload(StockTransfer.items))
        )
        transfer = res.scalar_one_or_none()
        if not transfer:
            raise HTTPException(status_code=404, detail=f"Stock transfer {transfer_id} not found.")

        # Source and destination warehouses
        src_res = await self.db.execute(
            select(Warehouse).where(Warehouse.id == transfer.source_warehouse_id)
        )
        src_wh = src_res.scalar_one_or_none()

        dst_res = await self.db.execute(
            select(Warehouse).where(Warehouse.id == transfer.dest_warehouse_id)
        )
        dst_wh = dst_res.scalar_one_or_none()

        company = await self._get_company()
        company_gstin = (getattr(company, 'gst_number', None) or getattr(company, 'gstin', None) or "27AAXFT2508H1ZR") if company else "27AAXFT2508H1ZR"
        company_name = company.name if company else "SMRITI Enterprise"
        company_state_code = int(company_gstin[:2]) if company_gstin and len(company_gstin) >= 2 and company_gstin[:2].isdigit() else 27

        warnings: List[str] = []
        is_valid_gstin, gstin_err = self._validate_gstin(company_gstin, "Company GSTIN")
        if not is_valid_gstin:
            if is_strict:
                raise HTTPException(status_code=422, detail=f"SMRITI-STAT-001: {gstin_err}")
            warnings.append(gstin_err)

        if not transfer.vehicle_number and trans_mode == "1":
            msg = "Missing vehicle number for Road Transport."
            if is_strict:
                raise HTTPException(status_code=422, detail=f"SMRITI-STAT-004: {msg}")
            warnings.append(msg)

        # Batch load all products in a single query
        product_ids = [it.product_id for it in transfer.items if it.product_id]
        products_map = await self._batch_load_products(product_ids)

        items_payload = []
        total_taxable_value = 0.0
        item_no = 1

        for item in transfer.items:
            product = products_map.get(item.product_id)
            prod_name = product.name if product else f"Product {item.product_id}"
            raw_hsn = getattr(product, 'hsn_code', None) or getattr(product, 'hsn', None)
            if not raw_hsn or not str(raw_hsn).strip().isdigit() or len(str(raw_hsn).strip()) not in (2, 4, 6, 8):
                if is_strict:
                    raise HTTPException(status_code=422, detail=f"SMRITI-STAT-002: Product '{prod_name}' has missing or invalid statutory HSN code.")
                hsn_code = 8471
                warnings.append(f"Product '{prod_name}' missing HSN; defaulted to 8471.")
            else:
                hsn_code = int(str(raw_hsn).strip())

            unit_cost = float(item.unit_cost or 100.0)
            qty = float(item.quantity_dispatched or 1.0)
            taxable_amt = round(qty * unit_cost, 2)
            total_taxable_value += taxable_amt

            items_payload.append({
                "itemNo": item_no,
                "productName": prod_name,
                "productDesc": f"{prod_name} (Batch: {item.batch_no})",
                "hsnCode": hsn_code,
                "quantity": qty,
                "qtyUnit": "NOS",
                "taxableAmount": taxable_amt,
                "cgstRate": 0.0,
                "sgstRate": 0.0,
                "igstRate": 0.0,
                "cessRate": 0.0
            })
            item_no += 1

        doc_date = transfer.created_at.strftime("%d/%m/%Y") if transfer.created_at else datetime.now().strftime("%d/%m/%Y")

        is_threshold_applicable = total_taxable_value >= 50000.0

        eway_payload = {
            "version": "1.0.0",
            "compliance": {
                "status": "VALID" if not warnings else "WITH_WARNINGS",
                "warnings": warnings,
                "mandatory_threshold_applicable": is_threshold_applicable,
                "threshold_rule": "Rule 138 CGST Rules (Mandatory for consignment value >= ₹50,000)",
                "schema_specification": "NIC GST E-Way Bill Bulk Upload JSON Schema v1.0.0",
                "portal_integration_status": "EXPORT_READY"
            },
            "billLists": [
                {
                    "userGstin": company_gstin,
                    "supplyType": "O",
                    "subSupplyType": "8", # 8 = Others (Stock Transfer Delivery Challan)
                    "subSupplyDesc": "Inter-Godown Branch Transfer",
                    "docType": "CHL", # Delivery Challan
                    "docNo": transfer.transfer_no,
                    "docDate": doc_date,
                    "transType": "1", # Regular
                    "fromGstin": company_gstin,
                    "fromTrdName": company_name,
                    "fromAddr1": src_wh.address if src_wh and src_wh.address else "Central Warehouse Road",
                    "fromAddr2": src_wh.name if src_wh else "Godown A",
                    "fromPlace": src_wh.city if src_wh and src_wh.city else "Mumbai",
                    "fromPincode": int(src_wh.pincode) if src_wh and src_wh.pincode and src_wh.pincode.isdigit() else 400001,
                    "actFromStateCode": company_state_code,
                    "fromStateCode": company_state_code,
                    "toGstin": company_gstin, # Same GSTIN for distinct branch godowns
                    "toTrdName": company_name,
                    "toAddr1": dst_wh.address if dst_wh and dst_wh.address else "Branch Retail Hub",
                    "toAddr2": dst_wh.name if dst_wh else "Godown B",
                    "toPlace": dst_wh.city if dst_wh and dst_wh.city else "Pune",
                    "toPincode": int(dst_wh.pincode) if dst_wh and dst_wh.pincode and dst_wh.pincode.isdigit() else 411001,
                    "actToStateCode": company_state_code,
                    "toStateCode": company_state_code,
                    "totalValue": round(total_taxable_value, 2),
                    "cgstValue": 0.0,
                    "sgstValue": 0.0,
                    "igstValue": 0.0,
                    "cessValue": 0.0,
                    "totInvValue": round(total_taxable_value, 2),
                    "transporterId": "",
                    "transporterName": transfer.transporter_name or "Internal Logistics",
                    "transDocNo": transfer.lr_number or "",
                    "transDocDate": doc_date,
                    "transMode": trans_mode,
                    "transDistance": trans_distance_km,
                    "vehicleNo": transfer.vehicle_number or "MH-04-TR-1000",
                    "vehicleType": vehicle_type,
                    "itemList": items_payload
                }
            ]
        }
        return eway_payload

    async def generate_delivery_challan(
        self,
        transfer_id: str,
        strict_validation: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Generate statutory Delivery Challan (Rule 55 CGST Rules 2017) format for printing and records.
        Batch queries products to eliminate N+1 latency.
        Enforces non-overrideable strict validation in production mode.
        """
        is_strict = True if settings.STRICT_STATUTORY_MODE else bool(strict_validation)

        res = await self.db.execute(
            select(StockTransfer).where(
                StockTransfer.id == transfer_id,
                StockTransfer.company_id == self.tenant.company_id,
                StockTransfer.is_deleted == False
            ).options(selectinload(StockTransfer.items))
        )
        transfer = res.scalar_one_or_none()
        if not transfer:
            raise HTTPException(status_code=404, detail=f"Stock transfer {transfer_id} not found.")

        src_res = await self.db.execute(
            select(Warehouse).where(Warehouse.id == transfer.source_warehouse_id)
        )
        src_wh = src_res.scalar_one_or_none()

        dst_res = await self.db.execute(
            select(Warehouse).where(Warehouse.id == transfer.dest_warehouse_id)
        )
        dst_wh = dst_res.scalar_one_or_none()

        company = await self._get_company()
        company_gstin = (getattr(company, 'gst_number', None) or getattr(company, 'gstin', None) or "27AAXFT2508H1ZR") if company else "27AAXFT2508H1ZR"

        if is_strict:
            is_valid_gst, gst_err = self._validate_gstin(company_gstin, "Company GSTIN")
            if not is_valid_gst:
                raise HTTPException(status_code=422, detail=f"SMRITI-STAT-001: {gst_err}")
            if not src_wh or not (src_wh.address or src_wh.city) or not dst_wh or not (dst_wh.address or dst_wh.city):
                raise HTTPException(status_code=422, detail="SMRITI-STAT-005: Source or destination godown is missing registered dispatch location.")

        product_ids = [it.product_id for it in transfer.items if it.product_id]
        products_map = await self._batch_load_products(product_ids)

        items = []
        total_qty = 0.0
        total_val = 0.0

        for item in transfer.items:
            prod = products_map.get(item.product_id)
            prod_name = prod.name if prod else item.product_id
            raw_hsn = getattr(prod, 'hsn_code', None) or getattr(prod, 'hsn', None)
            if not raw_hsn or not str(raw_hsn).strip().isdigit() or len(str(raw_hsn).strip()) not in (2, 4, 6, 8):
                if is_strict:
                    raise HTTPException(status_code=422, detail=f"SMRITI-STAT-002: Product '{prod_name}' has missing or invalid statutory HSN code.")
                hsn_str = "8471"
            else:
                hsn_str = str(raw_hsn).strip()

            qty = float(item.quantity_dispatched)
            rate = float(item.unit_cost)
            amt = round(qty * rate, 2)
            total_qty += qty
            total_val += amt

            items.append({
                "product_id": item.product_id,
                "product_name": prod_name,
                "hsn": hsn_str,
                "batch_no": item.batch_no,
                "quantity": qty,
                "rate": rate,
                "amount": amt
            })

        return {
            "challan_title": "DELIVERY CHALLAN",
            "statutory_subtitle": "Issued under Rule 55 of CGST Rules, 2017",
            "declaration": "Supply of goods on inter-branch/godown transfer without consideration.",
            "challan_no": f"DC/{transfer.transfer_no}",
            "transfer_no": transfer.transfer_no,
            "date": transfer.created_at.strftime("%d-%b-%Y") if transfer.created_at else datetime.now().strftime("%d-%b-%Y"),
            "company": {
                "name": company.name if company else "SMRITI Enterprise",
                "gstin": company_gstin,
                "address": getattr(company, 'address', "Corporate Head Office") if company else "Corporate Head Office"
            },
            "dispatch_from": {
                "warehouse_id": src_wh.id if src_wh else transfer.source_warehouse_id,
                "name": src_wh.name if src_wh else "Source Godown",
                "code": src_wh.code if src_wh else "WH-SRC",
                "address": src_wh.address if src_wh else "Source Address"
            },
            "dispatch_to": {
                "warehouse_id": dst_wh.id if dst_wh else transfer.dest_warehouse_id,
                "name": dst_wh.name if dst_wh else "Destination Godown",
                "code": dst_wh.code if dst_wh else "WH-DST",
                "address": dst_wh.address if dst_wh else "Destination Address"
            },
            "transport": {
                "transporter_name": transfer.transporter_name or "Internal Logistics",
                "vehicle_number": transfer.vehicle_number or "MH-04-TR-1000",
                "lr_number": transfer.lr_number or "N/A",
                "e_way_bill_no": transfer.e_way_bill_no or "N/A"
            },
            "items": items,
            "summary": {
                "total_quantity": total_qty,
                "total_value": round(total_val, 2)
            }
        }

    async def generate_invoice_eway_bill_payload(
        self,
        invoice_id: str,
        transporter_name: Optional[str] = None,
        vehicle_no: Optional[str] = None,
        lr_number: Optional[str] = None,
        trans_distance_km: int = 50,
        trans_mode: str = "1",
        vehicle_type: str = "R",
        strict_validation: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Generate export-ready NIC GST E-Way Bill JSON payload for B2B Sales Invoices.
        Batch queries products to eliminate N+1 latency.
        Enforces non-overrideable strict validation in production mode.
        """
        is_strict = True if settings.STRICT_STATUTORY_MODE else bool(strict_validation)

        res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.id == invoice_id,
                SalesInvoice.company_id == self.tenant.company_id,
                SalesInvoice.is_deleted == False
            ).options(selectinload(SalesInvoice.items))
        )
        invoice = res.scalar_one_or_none()
        if not invoice:
            raise HTTPException(status_code=404, detail=f"Sales invoice {invoice_id} not found.")

        cust_res = await self.db.execute(
            select(Customer).where(Customer.id == invoice.customer_id)
        )
        customer = cust_res.scalar_one_or_none()
        company = await self._get_company()

        company_gstin = (getattr(company, 'gst_number', None) or getattr(company, 'gstin', None) or "27AABCS1429B1Z") if company else "27AABCS1429B1Z"
        company_name = company.name if company else "SMRITI Enterprise"
        company_state_code = int(company_gstin[:2]) if company_gstin and len(company_gstin) >= 2 and company_gstin[:2].isdigit() else 27

        customer_gstin = (getattr(customer, 'gst_number', None) or getattr(customer, 'gstin', None) or "URP") if customer else "URP"
        customer_name = customer.name if customer else "Walk-in Retailer"
        customer_state_code = int(customer_gstin[:2]) if customer_gstin and customer_gstin != "URP" and len(customer_gstin) >= 2 and customer_gstin[:2].isdigit() else company_state_code

        is_inter_state = company_state_code != customer_state_code

        warnings: List[str] = []
        is_valid_gst, gst_err = self._validate_gstin(company_gstin, "Company GSTIN")
        if not is_valid_gst:
            if is_strict:
                raise HTTPException(status_code=422, detail=f"SMRITI-STAT-001: {gst_err}")
            warnings.append(gst_err)

        if customer_gstin != "URP":
            is_valid_cgst, cgst_err = self._validate_gstin(customer_gstin, "Customer GSTIN")
            if not is_valid_cgst:
                if is_strict:
                    raise HTTPException(status_code=422, detail=f"SMRITI-STAT-001: {cgst_err}")
                warnings.append(cgst_err)

        product_ids = [it.product_id for it in invoice.items if it.product_id]
        products_map = await self._batch_load_products(product_ids)

        items_payload = []
        item_no = 1

        for item in invoice.items:
            prod = products_map.get(item.product_id)
            prod_name = item.name or (prod.name if prod else f"Product {item.product_id}")
            raw_hsn = getattr(prod, 'hsn_code', None) or getattr(prod, 'hsn', None)
            if not raw_hsn or not str(raw_hsn).strip().isdigit() or len(str(raw_hsn).strip()) not in (2, 4, 6, 8):
                if is_strict:
                    raise HTTPException(status_code=422, detail=f"SMRITI-STAT-002: Product '{prod_name}' has missing or invalid statutory HSN code.")
                hsn_code = 8471
                warnings.append(f"Product '{prod_name}' missing HSN; defaulted to 8471.")
            else:
                hsn_code = int(str(raw_hsn).strip())

            taxable_amt = float(getattr(item, 'taxable_value', None) or (item.price * item.quantity))
            gst_rate = float(item.gst_rate or 18.0)

            cgst_rate = 0.0 if is_inter_state else gst_rate / 2.0
            sgst_rate = 0.0 if is_inter_state else gst_rate / 2.0
            igst_rate = gst_rate if is_inter_state else 0.0

            items_payload.append({
                "itemNo": item_no,
                "productName": prod_name,
                "productDesc": f"{prod_name} (Batch: {item.batch_no or 'DEFAULT'})",
                "hsnCode": hsn_code,
                "quantity": float(item.quantity),
                "qtyUnit": "NOS",
                "taxableAmount": round(taxable_amt, 2),
                "cgstRate": cgst_rate,
                "sgstRate": sgst_rate,
                "igstRate": igst_rate,
                "cessRate": 0.0
            })
            item_no += 1

        doc_date = invoice.created_at.strftime("%d/%m/%Y") if invoice.created_at else datetime.now().strftime("%d/%m/%Y")

        tax_tot = float(invoice.tax_total or 0.0)
        cgst_val = 0.0 if is_inter_state else round(tax_tot / 2.0, 2)
        sgst_val = 0.0 if is_inter_state else round(tax_tot / 2.0, 2)
        igst_val = round(tax_tot, 2) if is_inter_state else 0.0
        taxable_tot = float(getattr(invoice, 'taxable_value', None) or (invoice.grand_total - invoice.tax_total))

        is_threshold_applicable = float(invoice.grand_total) >= 50000.0

        eway_payload = {
            "version": "1.0.0",
            "compliance": {
                "status": "VALID" if not warnings else "WITH_WARNINGS",
                "warnings": warnings,
                "mandatory_threshold_applicable": is_threshold_applicable,
                "threshold_rule": "Rule 138 CGST Rules (Mandatory for consignment value >= ₹50,000)",
                "schema_specification": "NIC GST E-Way Bill Bulk Upload JSON Schema v1.0.0",
                "portal_integration_status": "EXPORT_READY"
            },
            "billLists": [
                {
                    "userGstin": company_gstin,
                    "supplyType": "O",
                    "subSupplyType": "1", # 1 = Supply
                    "docType": "INV",
                    "docNo": invoice.invoice_no,
                    "docDate": doc_date,
                    "transType": "1",
                    "fromGstin": company_gstin,
                    "fromTrdName": company_name,
                    "fromAddr1": getattr(company, 'address', "Plot 12, Industrial Estate") if company else "Plot 12, Industrial Estate",
                    "fromAddr2": "Central Warehouse",
                    "fromPlace": "Mumbai",
                    "fromPincode": 400001,
                    "actFromStateCode": company_state_code,
                    "fromStateCode": company_state_code,
                    "toGstin": customer_gstin,
                    "toTrdName": customer_name,
                    "toAddr1": getattr(customer, 'address', None) or getattr(invoice, 'billing_address', None) or "Retail Market Shop",
                    "toAddr2": "Commercial District",
                    "toPlace": getattr(customer, 'city', None) or getattr(invoice, 'pos_state', None) or "Mumbai",
                    "toPincode": 400002,
                    "actToStateCode": customer_state_code,
                    "toStateCode": customer_state_code,
                    "totalValue": round(taxable_tot, 2),
                    "cgstValue": cgst_val,
                    "sgstValue": sgst_val,
                    "igstValue": igst_val,
                    "cessValue": 0.0,
                    "totInvValue": float(invoice.grand_total),
                    "transporterId": "",
                    "transporterName": transporter_name or "Logistics Partner",
                    "transDocNo": lr_number or "",
                    "transDocDate": doc_date,
                    "transMode": trans_mode,
                    "transDistance": trans_distance_km,
                    "vehicleNo": vehicle_no or "MH-04-TR-1000",
                    "vehicleType": vehicle_type,
                    "itemList": items_payload
                }
            ]
        }
        return eway_payload


