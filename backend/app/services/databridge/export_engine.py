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
Classification: Canonical Enterprise Export Engine — DataBridge Phase 5
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_EXPORT_ENGINE", role="SERVICE", canonicalOwner="backend/app/services/databridge/export_engine.py")

import csv
import io
import json
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.pricing import PriceBookEntry
from app.models.crm import Customer
from app.models.purchase import (
    Supplier,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReceipt,
    PurchaseReceiptItem,
    PurchaseBill,
    PurchaseBillItem,
)
from app.models.sales import (
    SalesInvoice,
    SalesInvoiceItem,
    SalesOrder,
    SalesOrderItem,
    SalesReturn,
    SalesReturnItem,
)
from app.models.inventory import (
    StockTransfer,
    StockTransferItem,
    StockAudit,
    StockAuditItem,
)

from .exceptions import DataBridgeValidationError
from .models import (
    DataBridgeEntityType,
    DataBridgeExportFormat,
    DataBridgeExportRequest,
)
from .service import DataBridgeService


class DataBridgeExportEngine:
    """
    Canonical multi-format streaming export engine for SMRITI Retail OS.
    Extracts tenant-isolated entities across catalog, party, procurement, sales,
    and inventory movement domains, generating CSV, JSON, SMRITI-X, and OpenXML XLSX streams.
    """

    @classmethod
    async def fetch_entity_records(
        cls,
        company_db: AsyncSession,
        company_id: str,
        entity_type: DataBridgeEntityType,
        limit: int = 50000,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Executes tenant-scoped read queries against company PostgreSQL database.
        Unfolds multi-line documents into flat export rows with consistent headers.
        """
        DataBridgeService.verify_tenant_boundary(company_db, company_id)
        records: List[Dict[str, Any]] = []

        if entity_type == DataBridgeEntityType.ITEM:
            stmt = select(Item).where(Item.company_id == company_id).order_by(Item.created_at.desc()).limit(limit)
            items = (await company_db.execute(stmt)).scalars().all()
            for itm in items:
                records.append({
                    "item_id": itm.id,
                    "item_code": itm.item_code,
                    "item_name": itm.item_name,
                    "brand": itm.brand,
                    "category": itm.category,
                    "department": getattr(itm, "department", None),
                    "primary_uom": itm.primary_uom,
                    "mrp": float(itm.mrp or 0.0),
                    "selling_price": float(itm.selling_price or 0.0),
                    "cost_price": float(getattr(itm, "cost_price", 0.0) or 0.0),
                    "hsn_code": getattr(itm, "hsn_code", None),
                    "tax_rate": float(getattr(itm, "tax_rate", 0.0) or 0.0),
                    "is_active": itm.is_active,
                })

        elif entity_type == DataBridgeEntityType.VARIANT:
            stmt = select(ItemVariant).where(ItemVariant.company_id == company_id).order_by(ItemVariant.id.desc()).limit(limit)
            variants = (await company_db.execute(stmt)).scalars().all()
            for v in variants:
                records.append({
                    "variant_id": v.id,
                    "variant_code": v.variant_code or v.sku,
                    "variant_sku": getattr(v, "variant_sku", v.sku),
                    "sku": v.sku,
                    "item_id": v.item_id,
                    "color": v.color,
                    "size": v.size,
                    "mrp": float(v.mrp or 0.0),
                    "selling_price": float(v.selling_price or 0.0),
                    "cost_price": float(v.cost_price or 0.0),
                    "is_active": v.is_active,
                })

        elif entity_type == DataBridgeEntityType.BARCODE:
            stmt = select(ItemBarcode).where(ItemBarcode.company_id == company_id).order_by(ItemBarcode.id.desc()).limit(limit)
            barcodes = (await company_db.execute(stmt)).scalars().all()
            for b in barcodes:
                records.append({
                    "barcode": b.barcode,
                    "item_id": b.item_id,
                    "variant_id": b.variant_id,
                    "barcode_type": getattr(b, "barcode_type", "EAN13"),
                    "is_primary": b.is_primary,
                })

        elif entity_type == DataBridgeEntityType.PRICEBOOK:
            stmt = select(PriceBookEntry).where(PriceBookEntry.company_id == company_id).order_by(PriceBookEntry.id.desc()).limit(limit)
            entries = (await company_db.execute(stmt)).scalars().all()
            for p in entries:
                records.append({
                    "price_book_code": getattr(p, "price_book_code", "DEFAULT"),
                    "item_id": p.item_id,
                    "variant_id": p.variant_id,
                    "mrp": float(p.mrp or 0.0),
                    "selling_price": float(p.selling_price or 0.0),
                    "cost_price": float(p.cost_price or 0.0),
                    "min_quantity": p.min_quantity,
                })

        elif entity_type == DataBridgeEntityType.CUSTOMER:
            stmt = select(Customer).where(Customer.company_id == company_id).order_by(Customer.created_at.desc()).limit(limit)
            customers = (await company_db.execute(stmt)).scalars().all()
            for c in customers:
                records.append({
                    "customer_code": getattr(c, "code", getattr(c, "customer_code", "")),
                    "customer_name": c.name,
                    "phone": getattr(c, "mobile", getattr(c, "phone", "")),
                    "email": c.email or "",
                    "gstin": getattr(c, "gst_number", getattr(c, "gstin", "")),
                    "address_line1": getattr(c, "address", ""),
                    "city": getattr(c, "city", ""),
                    "state": getattr(c, "state", ""),
                    "pincode": getattr(c, "pincode", ""),
                    "credit_limit": float(getattr(c, "credit_limit", 0.0) or 0.0),
                })

        elif entity_type == DataBridgeEntityType.SUPPLIER:
            stmt = select(Supplier).where(Supplier.company_id == company_id).order_by(Supplier.created_at.desc()).limit(limit)
            suppliers = (await company_db.execute(stmt)).scalars().all()
            for s in suppliers:
                records.append({
                    "supplier_code": getattr(s, "code", getattr(s, "supplier_code", "")),
                    "supplier_name": s.name,
                    "contact_person": getattr(s, "contact_person", ""),
                    "phone": getattr(s, "mobile", getattr(s, "phone", "")),
                    "email": s.email or "",
                    "gstin": getattr(s, "gst_number", getattr(s, "gstin", "")),
                    "address_line1": getattr(s, "address", ""),
                    "city": getattr(s, "city", ""),
                    "state": getattr(s, "state", ""),
                    "pincode": getattr(s, "pincode", ""),
                })

        elif entity_type == DataBridgeEntityType.PURCHASE_ORDER:
            stmt = select(PurchaseOrder).where(PurchaseOrder.company_id == company_id).limit(limit)
            orders = (await company_db.execute(stmt)).scalars().all()
            for po in orders:
                fk_col = getattr(PurchaseOrderItem, "order_id", getattr(PurchaseOrderItem, "purchase_order_id", None))
                line_stmt = select(PurchaseOrderItem).where(fk_col == po.id)
                lines = (await company_db.execute(line_stmt)).scalars().all()
                po_date = getattr(po, "order_date", getattr(po, "created_at", None))
                po_tot = getattr(po, "total_amount", getattr(po, "grand_total", 0.0))
                if not lines:
                    records.append({
                        "order_no": po.order_no,
                        "order_date": po_date.isoformat() if po_date else "",
                        "supplier_id": po.supplier_id,
                        "status": po.status,
                        "total_amount": float(po_tot or 0.0),
                        "product_id": None,
                        "item_id": None,
                        "variant_id": None,
                        "item_code": "",
                        "quantity": 0.0,
                        "unit_price": 0.0,
                        "line_total": 0.0,
                    })
                for li in lines:
                    itm_code = getattr(li, "code", getattr(li, "item_code", None)) or str(getattr(li, "variant_id", None) or getattr(li, "product_id", "") or "")
                    u_price = getattr(li, "cost_price", getattr(li, "unit_price", 0.0))
                    records.append({
                        "order_no": po.order_no,
                        "order_date": po_date.isoformat() if po_date else "",
                        "supplier_id": po.supplier_id,
                        "status": po.status,
                        "total_amount": float(po_tot or 0.0),
                        "product_id": getattr(li, "product_id", None),
                        "item_id": getattr(li, "item_id", None),
                        "variant_id": getattr(li, "variant_id", None),
                        "item_code": itm_code,
                        "quantity": float(li.quantity or 0.0),
                        "unit_price": float(u_price or 0.0),
                        "line_total": float(getattr(li, "line_total", 0.0) or 0.0),
                    })

        elif entity_type == DataBridgeEntityType.GOODS_RECEIPT_NOTE:
            stmt = select(PurchaseReceipt).where(PurchaseReceipt.company_id == company_id).limit(limit)
            grns = (await company_db.execute(stmt)).scalars().all()
            for grn in grns:
                fk_col = getattr(PurchaseReceiptItem, "receipt_id", getattr(PurchaseReceiptItem, "purchase_receipt_id", None))
                line_stmt = select(PurchaseReceiptItem).where(fk_col == grn.id)
                lines = (await company_db.execute(line_stmt)).scalars().all()
                grn_date = getattr(grn, "receipt_date", getattr(grn, "created_at", None))
                for li in lines:
                    itm_code = getattr(li, "code", getattr(li, "item_code", None)) or str(getattr(li, "variant_id", None) or getattr(li, "product_id", "") or "")
                    rec_qty = getattr(li, "quantity_received", getattr(li, "received_qty", 0.0))
                    u_cost = getattr(li, "cost_price", getattr(li, "unit_cost", 0.0))
                    records.append({
                        "receipt_no": grn.receipt_no,
                        "receipt_date": grn_date.isoformat() if grn_date else "",
                        "supplier_id": grn.supplier_id,
                        "warehouse_id": getattr(grn, "warehouse_id", "WH-MAIN-001"),
                        "product_id": getattr(li, "product_id", None),
                        "item_id": getattr(li, "item_id", None),
                        "variant_id": getattr(li, "variant_id", None),
                        "item_code": itm_code,
                        "received_qty": float(rec_qty or 0.0),
                        "unit_cost": float(u_cost or 0.0),
                    })

        elif entity_type == DataBridgeEntityType.PURCHASE_INVOICE:
            stmt = select(PurchaseBill).where(PurchaseBill.company_id == company_id).limit(limit)
            bills = (await company_db.execute(stmt)).scalars().all()
            for b in bills:
                fk_col = getattr(PurchaseBillItem, "bill_id", getattr(PurchaseBillItem, "purchase_bill_id", None))
                line_stmt = select(PurchaseBillItem).where(fk_col == b.id)
                lines = (await company_db.execute(line_stmt)).scalars().all()
                b_date = getattr(b, "bill_date", getattr(b, "created_at", None))
                for li in lines:
                    itm_code = getattr(li, "code", getattr(li, "item_code", None)) or str(getattr(li, "variant_id", None) or getattr(li, "product_id", "") or "")
                    qty_val = getattr(li, "quantity", getattr(li, "qty", 0.0))
                    tot_val = getattr(li, "total_amount", getattr(li, "total", 0.0))
                    records.append({
                        "bill_no": b.bill_no,
                        "bill_date": b_date.isoformat() if b_date else "",
                        "supplier_id": b.supplier_id,
                        "total_amount": float(b.total_amount or 0.0),
                        "tax_amount": float(getattr(b, "tax_amount", 0.0) or 0.0),
                        "product_id": getattr(li, "product_id", None),
                        "item_id": getattr(li, "item_id", None),
                        "variant_id": getattr(li, "variant_id", None),
                        "item_code": itm_code,
                        "quantity": float(qty_val or 0.0),
                        "rate": float(li.rate or 0.0),
                        "line_total": float(tot_val or 0.0),
                    })

        elif entity_type == DataBridgeEntityType.SALES_INVOICE:
            stmt = select(SalesInvoice).where(SalesInvoice.company_id == company_id).order_by(SalesInvoice.created_at.desc()).limit(limit)
            invoices = (await company_db.execute(stmt)).scalars().all()
            for inv in invoices:
                fk_col = getattr(SalesInvoiceItem, "invoice_id", getattr(SalesInvoiceItem, "sales_invoice_id", None))
                line_stmt = select(SalesInvoiceItem).where(fk_col == inv.id)
                lines = (await company_db.execute(line_stmt)).scalars().all()
                for li in lines:
                    inv_date = getattr(inv, "invoice_date", getattr(inv, "date", None))
                    tot_amt = getattr(inv, "total_amount", getattr(inv, "grand_total", 0.0))
                    itm_code = getattr(li, "code", getattr(li, "item_code", None)) or str(getattr(li, "variant_id", None) or getattr(li, "product_id", "") or "")
                    u_price = getattr(li, "price", getattr(li, "unit_price", 0.0))
                    n_amt = getattr(li, "total_amount", getattr(li, "net_amount", 0.0))
                    if not getattr(li, "variant_id", None) and getattr(li, "product_id", None):
                        try:
                            from ..legacy_product_telemetry import LegacyProductTelemetrySink
                            LegacyProductTelemetrySink.record_fallback_invoked(
                                company_id=company_id,
                                caller="DataBridgeExportEngine.sales_invoice",
                                product_id=str(getattr(li, "product_id", "")),
                                reason="VARIANT_ID_NULL",
                            )
                        except Exception:
                            pass
                    records.append({
                        "invoice_no": inv.invoice_no,
                        "invoice_date": inv_date.isoformat() if inv_date else "",
                        "customer_id": inv.customer_id,
                        "total_amount": float(tot_amt or 0.0),
                        "tax_amount": float(getattr(inv, "tax_amount", getattr(inv, "tax_total", 0.0)) or 0.0),
                        "payment_status": getattr(inv, "payment_status", getattr(inv, "status", "PAID")),
                        "product_id": getattr(li, "product_id", None),
                        "item_id": getattr(li, "item_id", None),
                        "variant_id": getattr(li, "variant_id", None),
                        "item_code": itm_code,
                        "quantity": float(li.quantity or 0.0),
                        "unit_price": float(u_price or 0.0),
                        "net_amount": float(n_amt or 0.0),
                    })

        elif entity_type == DataBridgeEntityType.SALES_ORDER:
            stmt = select(SalesOrder).where(SalesOrder.company_id == company_id).limit(limit)
            orders = (await company_db.execute(stmt)).scalars().all()
            for so in orders:
                fk_col = getattr(SalesOrderItem, "order_id", getattr(SalesOrderItem, "sales_order_id", None))
                line_stmt = select(SalesOrderItem).where(fk_col == so.id)
                lines = (await company_db.execute(line_stmt)).scalars().all()
                for li in lines:
                    so_date = getattr(so, "order_date", getattr(so, "date", None))
                    tot_amt = getattr(so, "total_amount", getattr(so, "grand_total", 0.0))
                    itm_code = getattr(li, "code", getattr(li, "item_code", None)) or str(getattr(li, "variant_id", None) or getattr(li, "product_id", "") or "")
                    u_price = getattr(li, "price", getattr(li, "unit_price", 0.0))
                    l_tot = getattr(li, "line_total", getattr(li, "total_amount", 0.0))
                    records.append({
                        "order_no": so.order_no,
                        "order_date": so_date.isoformat() if so_date else "",
                        "customer_id": so.customer_id,
                        "total_amount": float(tot_amt or 0.0),
                        "product_id": getattr(li, "product_id", None),
                        "item_id": getattr(li, "item_id", None),
                        "variant_id": getattr(li, "variant_id", None),
                        "item_code": itm_code,
                        "quantity": float(li.quantity or 0.0),
                        "unit_price": float(u_price or 0.0),
                        "line_total": float(l_tot or 0.0),
                    })

        elif entity_type == DataBridgeEntityType.SALES_RETURN:
            stmt = select(SalesReturn).where(SalesReturn.company_id == company_id).limit(limit)
            returns = (await company_db.execute(stmt)).scalars().all()
            for ret in returns:
                fk_col = getattr(SalesReturnItem, "return_id", getattr(SalesReturnItem, "sales_return_id", None))
                line_stmt = select(SalesReturnItem).where(fk_col == ret.id)
                lines = (await company_db.execute(line_stmt)).scalars().all()
                for li in lines:
                    ret_date = getattr(ret, "return_date", getattr(ret, "date", None))
                    tot_amt = getattr(ret, "total_amount", getattr(ret, "grand_total", 0.0))
                    orig_inv = getattr(ret, "original_invoice_no", getattr(ret, "original_invoice_id", ""))
                    itm_code = getattr(li, "code", getattr(li, "item_code", None)) or str(getattr(li, "variant_id", None) or getattr(li, "product_id", "") or "")
                    u_price = getattr(li, "price", getattr(li, "unit_price", 0.0))
                    ref_amt = getattr(li, "refund_amount", getattr(li, "total_amount", 0.0))
                    records.append({
                        "return_no": ret.return_no,
                        "return_date": ret_date.isoformat() if ret_date else "",
                        "customer_id": ret.customer_id,
                        "original_invoice_no": orig_inv,
                        "total_amount": float(tot_amt or 0.0),
                        "product_id": getattr(li, "product_id", None),
                        "item_id": getattr(li, "item_id", None),
                        "variant_id": getattr(li, "variant_id", None),
                        "item_code": itm_code,
                        "quantity": float(li.quantity or 0.0),
                        "unit_price": float(u_price or 0.0),
                        "refund_amount": float(ref_amt or 0.0),
                    })

        elif entity_type == DataBridgeEntityType.STOCK_TRANSFER:
            stmt = select(StockTransfer).where(StockTransfer.company_id == company_id).limit(limit)
            transfers = (await company_db.execute(stmt)).scalars().all()
            for st in transfers:
                line_stmt = select(StockTransferItem).where(StockTransferItem.stock_transfer_id == st.id)
                lines = (await company_db.execute(line_stmt)).scalars().all()
                for li in lines:
                    records.append({
                        "transfer_no": st.transfer_no,
                        "transfer_date": st.transfer_date.isoformat() if st.transfer_date else "",
                        "source_warehouse_id": st.source_warehouse_id,
                        "dest_warehouse_id": st.dest_warehouse_id,
                        "status": st.status,
                        "product_id": getattr(li, "product_id", None),
                        "item_id": getattr(li, "item_id", None),
                        "variant_id": getattr(li, "variant_id", None),
                        "item_code": getattr(li, "item_code", None) or str(getattr(li, "variant_id", None) or getattr(li, "product_id", "") or ""),
                        "quantity": float(li.quantity or 0.0),
                    })

        elif entity_type == DataBridgeEntityType.STOCK_AUDIT:
            stmt = select(StockAudit).where(StockAudit.company_id == company_id).limit(limit)
            audits = (await company_db.execute(stmt)).scalars().all()
            for sa in audits:
                line_stmt = select(StockAuditItem).where(StockAuditItem.stock_audit_id == sa.id)
                lines = (await company_db.execute(line_stmt)).scalars().all()
                for li in lines:
                    records.append({
                        "audit_no": sa.audit_no,
                        "audit_date": sa.audit_date.isoformat() if sa.audit_date else "",
                        "warehouse_id": sa.warehouse_id,
                        "product_id": getattr(li, "product_id", None),
                        "item_id": getattr(li, "item_id", None),
                        "variant_id": getattr(li, "variant_id", None),
                        "item_code": getattr(li, "item_code", None) or str(getattr(li, "variant_id", None) or getattr(li, "product_id", "") or ""),
                        "system_qty": float(li.system_qty or 0.0),
                        "counted_qty": float(li.counted_qty or 0.0),
                        "variance_qty": float(li.variance_qty or 0.0),
                        "unit_cost": float(li.unit_cost or 0.0),
                        "variance_value": float(getattr(li, "variance_value", 0.0) or 0.0),
                    })

        else:
            raise DataBridgeValidationError(f"Entity type '{entity_type}' is not supported for export.")

        return records

    @classmethod
    def format_csv(cls, records: List[Dict[str, Any]]) -> str:
        """Generates standard RFC 4180 CSV string with UTF-8 BOM."""
        if not records:
            return "\ufeff\r\n"

        fieldnames = list(records[0].keys())
        output = io.StringIO()
        output.write("\ufeff")  # Excel-compatible UTF-8 BOM
        writer = csv.DictWriter(output, fieldnames=fieldnames, lineterminator="\r\n")
        writer.writeheader()
        for r in records:
            writer.writerow(r)
        return output.getvalue()

    @classmethod
    def format_json(cls, records: List[Dict[str, Any]]) -> str:
        """Generates formatted JSON array string."""
        return json.dumps(records, indent=2, ensure_ascii=False)

    @classmethod
    def format_smriti_x(
        cls,
        records: List[Dict[str, Any]],
        entity_type: str,
        company_id: str,
        actor_id: str,
    ) -> str:
        """Generates canonical SMRITI-X sealed JSON package with cryptographic integrity digest."""
        data_json = json.dumps(records, sort_keys=True, ensure_ascii=False)
        sha256_hash = hashlib.sha256(data_json.encode("utf-8")).hexdigest()

        package = {
            "metadata": {
                "schema_version": "1.0.0",
                "system": "SMRITI Retail OS DataBridge",
                "classification": "RESTRICTED_EXPORT",
                "entity_type": str(entity_type),
                "company_id": company_id,
                "exported_by": actor_id,
                "record_count": len(records),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "integrity_sha256": sha256_hash,
            },
            "data": records,
        }
        return json.dumps(package, indent=2, ensure_ascii=False)

    @classmethod
    def format_xlsx(cls, records: List[Dict[str, Any]], entity_type: str) -> bytes:
        """Generates professionally styled OpenXML .xlsx binary workbook."""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = str(entity_type)[:31]

        if not records:
            ws.append(["No records found"])
            buf = io.BytesIO()
            wb.save(buf)
            return buf.getvalue()

        headers = list(records[0].keys())
        ws.append(headers)

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
        header_align = Alignment(horizontal="center", vertical="center")
        thin_border = Border(
            left=Side(style="thin", color="CCCCCC"),
            right=Side(style="thin", color="CCCCCC"),
            top=Side(style="thin", color="CCCCCC"),
            bottom=Side(style="thin", color="CCCCCC"),
        )

        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_align
            cell.border = thin_border

        for r_idx, record in enumerate(records, start=2):
            row_vals = [record.get(h) for h in headers]
            ws.append(row_vals)
            for c_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=r_idx, column=c_idx)
                cell.border = thin_border

        # Adjust column widths dynamically
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    @classmethod
    async def export_dataset(
        cls,
        company_db: AsyncSession,
        company_id: str,
        actor_id: str,
        actor_role: str,
        req: DataBridgeExportRequest,
    ) -> Tuple[bytes, str, str, str]:
        """
        Executes export operation, writes WORM audit log, and returns:
        (content_bytes, media_type, download_filename, sha256_hash).
        """
        records = await cls.fetch_entity_records(
            company_db=company_db,
            company_id=company_id,
            entity_type=req.entity_type,
            limit=req.limit or 50000,
            filters=req.filters,
        )

        now_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        base_name = f"SMRITI_{req.entity_type.value}_{now_str}"

        if req.file_format == DataBridgeExportFormat.CSV:
            csv_str = cls.format_csv(records)
            content_bytes = csv_str.encode("utf-8")
            media_type = "text/csv; charset=utf-8"
            filename = f"{base_name}.csv"

        elif req.file_format == DataBridgeExportFormat.JSON:
            json_str = cls.format_json(records)
            content_bytes = json_str.encode("utf-8")
            media_type = "application/json; charset=utf-8"
            filename = f"{base_name}.json"

        elif req.file_format == DataBridgeExportFormat.SMRITI_X:
            smriti_str = cls.format_smriti_x(
                records=records,
                entity_type=req.entity_type.value,
                company_id=company_id,
                actor_id=actor_id,
            )
            content_bytes = smriti_str.encode("utf-8")
            media_type = "application/json; charset=utf-8"
            filename = f"{base_name}.smritix"

        elif req.file_format == DataBridgeExportFormat.XLSX:
            content_bytes = cls.format_xlsx(records, req.entity_type.value)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"{base_name}.xlsx"

        else:
            raise DataBridgeValidationError(f"Unsupported export format '{req.file_format}'.")

        sha256_hash = hashlib.sha256(content_bytes).hexdigest()

        # Write immutable WORM audit log
        if req.include_audit_signature:
            await DataBridgeService.record_audit_entry(
                company_db=company_db,
                company_id=company_id,
                event_type="DATABRIDGE_DATA_EXPORT",
                entity_name=f"databridge_{req.entity_type.value.lower()}",
                entity_id=filename,
                action_summary=f"Exported {len(records)} records in {req.file_format.value} format. Size: {len(content_bytes)} bytes.",
                actor_id=actor_id,
                actor_role=actor_role,
                payload_data={
                    "filename": filename,
                    "format": req.file_format.value,
                    "record_count": len(records),
                    "sha256": sha256_hash,
                },
            )
            await company_db.commit()

        return content_bytes, media_type, filename, sha256_hash
