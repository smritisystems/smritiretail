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

from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.inventory import StockTransfer, StockTransferItem, Warehouse, Product
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.crm import Customer
from ..models.tenant import Company
from ..api.deps import TenantContext


class EWayBillService:
    """
    Engine for generating statutory GST NIC E-Way Bill JSON payloads
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

    async def generate_transfer_eway_bill_payload(
        self,
        transfer_id: str,
        trans_distance_km: int = 50,
        trans_mode: str = "1",
        vehicle_type: str = "R"
    ) -> Dict[str, Any]:
        """
        Generate standard NIC GST E-Way Bill JSON payload for Inter-Godown Stock Transfer (Delivery Challan).
        """
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
        company_gstin = (getattr(company, 'gst_number', None) or getattr(company, 'gstin', None) or "27AABCS1429B1Z") if company else "27AABCS1429B1Z"
        company_name = company.name if company else "SMRITI Enterprise"
        company_state_code = int(company_gstin[:2]) if company_gstin and len(company_gstin) >= 2 and company_gstin[:2].isdigit() else 27

        items_payload = []
        total_taxable_value = 0.0
        item_no = 1

        for item in transfer.items:
            prod_res = await self.db.execute(
                select(Product).where(Product.id == item.product_id)
            )
            product = prod_res.scalar_one_or_none()
            prod_name = product.name if product else f"Product {item.product_id}"
            raw_hsn = getattr(product, 'hsn_code', None) or getattr(product, 'hsn', '8471')
            hsn_code = int(raw_hsn) if raw_hsn and str(raw_hsn).isdigit() else 8471
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

        eway_payload = {
            "version": "1.0.0",
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

    async def generate_delivery_challan(self, transfer_id: str) -> Dict[str, Any]:
        """
        Generate statutory Delivery Challan (Rule 55 CGST Rules 2017) format for printing and records.
        """
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

        items = []
        total_qty = 0.0
        total_val = 0.0

        for item in transfer.items:
            prod_res = await self.db.execute(
                select(Product).where(Product.id == item.product_id)
            )
            prod = prod_res.scalar_one_or_none()
            qty = float(item.quantity_dispatched)
            rate = float(item.unit_cost)
            amt = round(qty * rate, 2)
            total_qty += qty
            total_val += amt

            items.append({
                "product_id": item.product_id,
                "product_name": prod.name if prod else item.product_id,
                "hsn": getattr(prod, 'hsn_code', None) or getattr(prod, 'hsn', '8471'),
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
                "gstin": (getattr(company, 'gst_number', None) or getattr(company, 'gstin', None) or "27AABCS1429B1Z") if company else "27AABCS1429B1Z",
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
        vehicle_type: str = "R"
    ) -> Dict[str, Any]:
        """
        Generate standard NIC GST E-Way Bill JSON payload for B2B Sales Invoices.
        """
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

        items_payload = []
        item_no = 1

        for item in invoice.items:
            prod_res = await self.db.execute(
                select(Product).where(Product.id == item.product_id)
            )
            prod = prod_res.scalar_one_or_none()
            prod_name = item.name or (prod.name if prod else f"Product {item.product_id}")
            raw_hsn = getattr(prod, 'hsn_code', None) or getattr(prod, 'hsn', '8471')
            hsn_code = int(raw_hsn) if raw_hsn and str(raw_hsn).isdigit() else 8471
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

        eway_payload = {
            "version": "1.0.0",
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
