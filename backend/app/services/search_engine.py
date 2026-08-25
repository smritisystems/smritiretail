"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import time
from decimal import Decimal
from typing import Dict, Any, List, Optional, Set
from sqlalchemy import select, or_, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.item_master import Item, ItemVariant, ItemBarcode
from ..models.party import Party
from ..models.sales import SalesInvoice
from ..models.purchase import PurchaseOrder
from ..models.fulfillment import Dispatch, PackingSlip
from ..models.approval import ApprovalRequest
from ..models.payment_ledger import PaymentTransaction
from ..models.inventory import Warehouse
from ..schemas.search import (
    UniversalSearchRequest,
    UniversalSearchResponse,
    SearchResultItem,
    BarcodeQuickScanRequest,
    BarcodeQuickScanResponse,
)


class UniversalSearchEngine:
    """
    Authoritative SMRITI Universal Search Engine (Section 7).
    Executes permission-aware, multi-domain omni-search across Parties, Items, Barcodes,
    Documents, Warehouses, and Transactions with relevance ranking and fast POS scanning.
    """

    DOMAIN_PERMISSIONS: Dict[str, Set[str]] = {
        "CASHIER": {"ITEMS", "BARCODES", "DOCUMENTS"},
        "SALES_EXECUTIVE": {"ITEMS", "BARCODES", "DOCUMENTS", "PARTIES"},
        "STORE_MANAGER": {"ITEMS", "BARCODES", "DOCUMENTS", "PARTIES", "WAREHOUSES", "TRANSACTIONS"},
        "FINANCE_CONTROLLER": {"ITEMS", "BARCODES", "DOCUMENTS", "PARTIES", "WAREHOUSES", "TRANSACTIONS"},
        "DIRECTOR": {"ITEMS", "BARCODES", "DOCUMENTS", "PARTIES", "WAREHOUSES", "TRANSACTIONS"},
        "SYSADMIN": {"ITEMS", "BARCODES", "DOCUMENTS", "PARTIES", "WAREHOUSES", "TRANSACTIONS"},
    }

    ALL_DOMAINS = ["ITEMS", "PARTIES", "BARCODES", "DOCUMENTS", "WAREHOUSES", "TRANSACTIONS"]

    @classmethod
    def get_allowed_domains(cls, role: str) -> Set[str]:
        return cls.DOMAIN_PERMISSIONS.get(role.upper(), {"ITEMS", "BARCODES"})

    @classmethod
    async def quick_barcode_scan(
        cls,
        session: AsyncSession,
        company_id: str,
        req: BarcodeQuickScanRequest,
    ) -> BarcodeQuickScanResponse:
        """
        Ultra-fast 4-tier scanner resolver for POS billing and inventory scanning.
        Tier 1: ItemBarcode table match
        Tier 2: ItemVariant SKU match
        Tier 3: Item item_code match
        """
        raw_code = req.barcode.strip()

        # Tier 1: Search ItemBarcode table
        stmt_bc = (
            select(ItemBarcode, Item, ItemVariant)
            .join(Item, ItemBarcode.item_id == Item.id)
            .outerjoin(ItemVariant, ItemBarcode.variant_id == ItemVariant.id)
            .where(
                ItemBarcode.company_id == company_id,
                ItemBarcode.barcode == raw_code,
                ItemBarcode.is_active == True,
                ItemBarcode.is_deleted == False,
            )
        )
        bc_match = (await session.execute(stmt_bc)).first()
        if bc_match:
            bc_row, item_row, var_row = bc_match
            selling_price = var_row.selling_price if var_row and var_row.selling_price else item_row.selling_price
            mrp = var_row.mrp if var_row and var_row.mrp else item_row.mrp
            sku = var_row.variant_sku if var_row else item_row.item_code
            return BarcodeQuickScanResponse(
                found=True,
                scan_type="EXACT_BARCODE",
                item_id=item_row.id,
                item_code=item_row.item_code,
                item_name=item_row.item_name,
                variant_id=var_row.id if var_row else None,
                sku=sku,
                barcode=bc_row.barcode,
                uom=item_row.primary_uom or "PCS",
                mrp=mrp,
                selling_price=selling_price,
                hsn_sac=item_row.hsn_code,
                tax_rate=item_row.tax_rate or Decimal("18.00"),
                metadata={"brand": item_row.brand, "category": item_row.category},
            )

        # Tier 2: Search ItemVariant SKU
        stmt_sku = (
            select(ItemVariant, Item)
            .join(Item, ItemVariant.item_id == Item.id)
            .where(
                ItemVariant.company_id == company_id,
                ItemVariant.variant_sku == raw_code,
                ItemVariant.is_active == True,
                ItemVariant.is_deleted == False,
            )
        )
        sku_match = (await session.execute(stmt_sku)).first()
        if sku_match:
            var_row, item_row = sku_match
            return BarcodeQuickScanResponse(
                found=True,
                scan_type="SKU",
                item_id=item_row.id,
                item_code=item_row.item_code,
                item_name=item_row.item_name,
                variant_id=var_row.id,
                sku=var_row.variant_sku,
                barcode=raw_code,
                uom=item_row.primary_uom or "PCS",
                mrp=var_row.mrp or item_row.mrp,
                selling_price=var_row.selling_price or item_row.selling_price,
                hsn_sac=item_row.hsn_code,
                tax_rate=item_row.tax_rate or Decimal("18.00"),
                metadata={"brand": item_row.brand, "category": item_row.category},
            )

        # Tier 3: Search Item by item_code
        stmt_item = (
            select(Item)
            .where(
                Item.company_id == company_id,
                Item.item_code == raw_code,
                Item.is_active == True,
                Item.is_deleted == False,
            )
        )
        item_row = (await session.execute(stmt_item)).scalars().first()
        if item_row:
            return BarcodeQuickScanResponse(
                found=True,
                scan_type="ITEM_CODE",
                item_id=item_row.id,
                item_code=item_row.item_code,
                item_name=item_row.item_name,
                variant_id=None,
                sku=item_row.item_code,
                barcode=raw_code,
                uom=item_row.primary_uom or "PCS",
                mrp=item_row.mrp,
                selling_price=item_row.selling_price,
                hsn_sac=item_row.hsn_code,
                tax_rate=item_row.tax_rate or Decimal("18.00"),
                metadata={"brand": item_row.brand, "category": item_row.category},
            )

        return BarcodeQuickScanResponse(
            found=False,
            scan_type="NOT_FOUND",
            barcode=raw_code,
        )

    @classmethod
    async def execute_universal_search(
        cls,
        session: AsyncSession,
        company_id: str,
        req: UniversalSearchRequest,
        caller_role: str = "STORE_MANAGER",
    ) -> UniversalSearchResponse:
        """
        Executes multi-domain omni-search respecting role-based domain filtering and relevance ranking.
        """
        start_time = time.perf_counter()
        q_raw = req.query.strip()
        q_like = f"%{q_raw}%"
        limit = req.limit_per_domain

        allowed_domains = cls.get_allowed_domains(caller_role)
        requested_domains = set([d.upper() for d in req.domains]) if req.domains else set(cls.ALL_DOMAINS)
        active_domains = allowed_domains.intersection(requested_domains)

        results_by_domain: Dict[str, List[SearchResultItem]] = {}
        all_items: List[SearchResultItem] = []

        # --------------------------------------------------------------------
        # 1. ITEMS DOMAIN
        # --------------------------------------------------------------------
        if "ITEMS" in active_domains:
            items_list: List[SearchResultItem] = []
            stmt_items = (
                select(Item)
                .where(
                    Item.company_id == company_id,
                    Item.is_deleted == False,
                    or_(
                        Item.item_code.ilike(q_like),
                        Item.item_name.ilike(q_like),
                        Item.brand.ilike(q_like),
                        Item.category.ilike(q_like),
                        Item.hsn_code.ilike(q_like),
                    ),
                )
                .limit(limit)
            )
            found_items = (await session.execute(stmt_items)).scalars().all()
            for it in found_items:
                score = 100 if it.item_code.upper() == q_raw.upper() else (75 if it.item_name.upper().startswith(q_raw.upper()) else 50)
                items_list.append(
                    SearchResultItem(
                        id=it.id,
                        domain="ITEMS",
                        type="ITEM",
                        title=it.item_name,
                        subtitle=f"Code: {it.item_code} | Brand: {it.brand or 'N/A'}",
                        badge=f"₹{it.selling_price:.2f}" if it.selling_price else None,
                        score=score,
                        metadata={"uom": it.primary_uom, "hsn": it.hsn_code, "category": it.category},
                        navigation_url=f"/inventory/items/{it.id}",
                    )
                )
            results_by_domain["ITEMS"] = items_list
            all_items.extend(items_list)

        # --------------------------------------------------------------------
        # 2. PARTIES DOMAIN
        # --------------------------------------------------------------------
        if "PARTIES" in active_domains:
            parties_list: List[SearchResultItem] = []
            stmt_parties = (
                select(Party)
                .where(
                    Party.company_id == company_id,
                    Party.is_deleted == False,
                    or_(
                        Party.party_code.ilike(q_like),
                        Party.legal_name.ilike(q_like),
                        Party.trade_name.ilike(q_like),
                        Party.phone.ilike(q_like),
                        Party.email.ilike(q_like),
                        Party.gstin.ilike(q_like),
                        Party.pan.ilike(q_like),
                    ),
                )
                .limit(limit)
            )
            found_parties = (await session.execute(stmt_parties)).scalars().all()
            for p in found_parties:
                title = p.trade_name or p.legal_name
                score = 100 if (p.party_code.upper() == q_raw.upper() or p.phone == q_raw) else 50
                parties_list.append(
                    SearchResultItem(
                        id=p.id,
                        domain="PARTIES",
                        type="PARTY",
                        title=title,
                        subtitle=f"Code: {p.party_code} | GSTIN: {p.gstin or 'N/A'} | Phone: {p.phone or 'N/A'}",
                        badge=p.party_type,
                        score=score,
                        metadata={"gstin": p.gstin, "phone": p.phone, "city": p.city},
                        navigation_url=f"/masters/parties/{p.id}",
                    )
                )
            results_by_domain["PARTIES"] = parties_list
            all_items.extend(parties_list)

        # --------------------------------------------------------------------
        # 3. BARCODES DOMAIN
        # --------------------------------------------------------------------
        if "BARCODES" in active_domains:
            barcodes_list: List[SearchResultItem] = []
            stmt_bc = (
                select(ItemBarcode, Item)
                .join(Item, ItemBarcode.item_id == Item.id)
                .where(
                    ItemBarcode.company_id == company_id,
                    ItemBarcode.is_deleted == False,
                    ItemBarcode.barcode.ilike(q_like),
                )
                .limit(limit)
            )
            found_bc = (await session.execute(stmt_bc)).all()
            for bc_row, item_row in found_bc:
                score = 100 if bc_row.barcode.upper() == q_raw.upper() else 60
                barcodes_list.append(
                    SearchResultItem(
                        id=bc_row.id,
                        domain="BARCODES",
                        type="BARCODE",
                        title=bc_row.barcode,
                        subtitle=f"Item: {item_row.item_name} ({item_row.item_code})",
                        badge=bc_row.barcode_type or "EAN13",
                        score=score,
                        metadata={"symbology": bc_row.barcode_type, "item_id": item_row.id},
                        navigation_url=f"/inventory/items/{item_row.id}",
                    )
                )
            results_by_domain["BARCODES"] = barcodes_list
            all_items.extend(barcodes_list)

        # --------------------------------------------------------------------
        # 4. DOCUMENTS DOMAIN
        # --------------------------------------------------------------------
        if "DOCUMENTS" in active_domains:
            docs_list: List[SearchResultItem] = []

            # Invoices
            stmt_inv = (
                select(SalesInvoice)
                .where(
                    SalesInvoice.company_id == company_id,
                    SalesInvoice.is_deleted == False,
                    SalesInvoice.invoice_no.ilike(q_like),
                )
                .limit(limit)
            )
            found_inv = (await session.execute(stmt_inv)).scalars().all()
            for inv in found_inv:
                docs_list.append(
                    SearchResultItem(
                        id=inv.id,
                        domain="DOCUMENTS",
                        type="SALES_INVOICE",
                        title=f"Invoice {inv.invoice_no}",
                        subtitle=f"Customer: {inv.customer_id or 'Walk-in'} | Total: ₹{inv.grand_total:.2f}",
                        badge=inv.status,
                        score=100 if inv.invoice_no.upper() == q_raw.upper() else 60,
                        metadata={"grand_total": float(inv.grand_total), "status": inv.status},
                        navigation_url=f"/sales/invoices/{inv.id}",
                    )
                )

            # Purchase Orders
            stmt_po = (
                select(PurchaseOrder)
                .where(
                    PurchaseOrder.company_id == company_id,
                    PurchaseOrder.is_deleted == False,
                    PurchaseOrder.order_no.ilike(q_like),
                )
                .limit(limit)
            )
            found_po = (await session.execute(stmt_po)).scalars().all()
            for po in found_po:
                docs_list.append(
                    SearchResultItem(
                        id=po.id,
                        domain="DOCUMENTS",
                        type="PURCHASE_ORDER",
                        title=f"PO {po.order_no}",
                        subtitle=f"Supplier: {po.supplier_id} | Total: ₹{po.grand_total:.2f}",
                        badge=po.status,
                        score=100 if po.order_no.upper() == q_raw.upper() else 60,
                        metadata={"grand_total": float(po.grand_total), "status": po.status},
                        navigation_url=f"/procurement/orders/{po.id}",
                    )
                )

            # Dispatches
            stmt_disp = (
                select(Dispatch)
                .where(
                    Dispatch.company_id == company_id,
                    Dispatch.is_deleted == False,
                    or_(
                        Dispatch.dispatch_number.ilike(q_like),
                        Dispatch.tracking_number.ilike(q_like),
                    ),
                )
                .limit(limit)
            )
            found_disp = (await session.execute(stmt_disp)).scalars().all()
            for d in found_disp:
                docs_list.append(
                    SearchResultItem(
                        id=d.id,
                        domain="DOCUMENTS",
                        type="DISPATCH",
                        title=f"Dispatch {d.dispatch_number}",
                        subtitle=f"Courier: {d.courier_partner} | AWB: {d.tracking_number or 'N/A'}",
                        badge=d.status,
                        score=100 if (d.dispatch_number.upper() == q_raw.upper() or d.tracking_number == q_raw) else 60,
                        metadata={"courier": d.courier_partner, "awb": d.tracking_number},
                        navigation_url=f"/fulfillment/dispatches/{d.id}",
                    )
                )

            # Approvals
            stmt_app = (
                select(ApprovalRequest)
                .where(
                    ApprovalRequest.company_id == company_id,
                    ApprovalRequest.is_deleted == False,
                    ApprovalRequest.request_no.ilike(q_like),
                )
                .limit(limit)
            )
            found_app = (await session.execute(stmt_app)).scalars().all()
            for apr in found_app:
                docs_list.append(
                    SearchResultItem(
                        id=apr.id,
                        domain="DOCUMENTS",
                        type="APPROVAL_REQUEST",
                        title=f"Approval {apr.request_no}",
                        subtitle=f"Doc: {apr.reference_doc_type} ({apr.reference_doc_id}) | Amount: ₹{apr.document_amount:.2f}",
                        badge=apr.status,
                        score=100 if apr.request_no.upper() == q_raw.upper() else 60,
                        metadata={"assigned_role": apr.current_assigned_role, "status": apr.status},
                        navigation_url=f"/governance/approvals/{apr.id}",
                    )
                )

            results_by_domain["DOCUMENTS"] = docs_list
            all_items.extend(docs_list)

        # --------------------------------------------------------------------
        # 5. WAREHOUSES DOMAIN
        # --------------------------------------------------------------------
        if "WAREHOUSES" in active_domains:
            wh_list: List[SearchResultItem] = []
            stmt_wh = (
                select(Warehouse)
                .where(
                    Warehouse.company_id == company_id,
                    Warehouse.is_deleted == False,
                    or_(
                        Warehouse.code.ilike(q_like),
                        Warehouse.name.ilike(q_like),
                        Warehouse.city.ilike(q_like),
                    ),
                )
                .limit(limit)
            )
            found_wh = (await session.execute(stmt_wh)).scalars().all()
            for wh in found_wh:
                score = 100 if wh.code.upper() == q_raw.upper() else 50
                wh_list.append(
                    SearchResultItem(
                        id=wh.id,
                        domain="WAREHOUSES",
                        type="WAREHOUSE",
                        title=wh.name,
                        subtitle=f"Code: {wh.code} | City: {wh.city or 'N/A'}",
                        badge=wh.warehouse_type or "STORE",
                        score=score,
                        metadata={"code": wh.code, "city": wh.city},
                        navigation_url=f"/inventory/warehouses/{wh.id}",
                    )
                )
            results_by_domain["WAREHOUSES"] = wh_list
            all_items.extend(wh_list)

        # --------------------------------------------------------------------
        # 6. TRANSACTIONS DOMAIN
        # --------------------------------------------------------------------
        if "TRANSACTIONS" in active_domains:
            tx_list: List[SearchResultItem] = []
            stmt_tx = (
                select(PaymentTransaction)
                .where(
                    PaymentTransaction.company_id == company_id,
                    PaymentTransaction.is_deleted == False,
                    or_(
                        PaymentTransaction.transaction_no.ilike(q_like),
                        PaymentTransaction.idempotency_key.ilike(q_like),
                        PaymentTransaction.gateway_reference.ilike(q_like),
                    ),
                )
                .limit(limit)
            )
            found_tx = (await session.execute(stmt_tx)).scalars().all()
            for tx in found_tx:
                score = 100 if tx.transaction_no.upper() == q_raw.upper() else 50
                tx_list.append(
                    SearchResultItem(
                        id=tx.id,
                        domain="TRANSACTIONS",
                        type="PAYMENT",
                        title=f"Payment {tx.transaction_no}",
                        subtitle=f"Tender: {tx.tender_type} | Amount: ₹{tx.amount:.2f}",
                        badge=tx.status,
                        score=score,
                        metadata={"tender": tx.tender_type, "amount": float(tx.amount)},
                        navigation_url=f"/finance/payments/{tx.id}",
                    )
                )
            results_by_domain["TRANSACTIONS"] = tx_list
            all_items.extend(tx_list)

        # Sort all items by score descending
        all_items.sort(key=lambda x: x.score, reverse=True)
        latency = (time.perf_counter() - start_time) * 1000.0

        return UniversalSearchResponse(
            query=q_raw,
            total_hits=len(all_items),
            domains_searched=sorted(list(active_domains)),
            results_by_domain=results_by_domain,
            items=all_items,
            latency_ms=round(latency, 2),
        )
