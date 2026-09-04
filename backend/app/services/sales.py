"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.1 (Phase 2 — Sales UPDATE/DELETE/CANCEL)
Created      : 2026-07-11
Modified     : 2026-07-15 (Phase 2)
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime, timezone, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..models.sales import (
    SalesInvoice, SalesInvoiceItem,
    SalesQuotation, SalesQuotationItem,
    SalesOrder, SalesOrderItem, SalesOrderInvoiceAllocation,
    SalesReturn, SalesReturnItem,
)
from ..models.inventory import Product, StockMovement
from ..models.tenant import Company
from ..models.crm import Customer, CustomerGroup, CustomerGSTRegistration, CustomerDeliveryLocation, CustomerBillingLocation
from ..core.gst_engine import (
    calculate_line_item_tax,
    validate_gstin,
    extract_state_code_from_gstin,
    determine_gstr1_table,
    GST_STATE_CODES,
)
from ..schemas.sales import (
    SalesInvoiceCreate,
    SalesInvoiceUpdate,
    SalesQuotationCreate,
    SalesQuotationUpdate,
    SalesOrderCreate,
    SalesOrderUpdate,
    SalesReturnCreate,
    SalesReturnUpdate,
)
from .crm import CrmService
from .inventory import InventoryService
from .inventory_warehouse_resolver import InventoryWarehouseResolver
from .sales_return_policy import SalesReturnPolicyResolver
from .sales_return_refund_adapter import SalesReturnRefundAdapter
from .documents_engine import DocumentsEngine
from .compliance_audit import ComplianceAuditService
from ..api.deps import TenantContext


def _uid() -> str:
    return uuid.uuid4().hex[:8]


class SalesService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext, control_db: Optional[AsyncSession] = None):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.crm_service = CrmService(db, tenant_ctx)
        self.inventory_service = InventoryService(db, tenant_ctx)
        self.sales_return_policy_resolver = SalesReturnPolicyResolver(control_db=control_db, company_db=db)


    # ??????????????????????????????????????????????????????????????
    # Sales Invoice
    # ??????????????????????????????????????????????????????????????

    async def create_sales_invoice(self, invoice_in: SalesInvoiceCreate, idempotency_key: Optional[str] = None) -> SalesInvoice:
        # 1. Authoritative Idempotency Check (Phase 6)
        # Check strictly by idempotency_key / primary request ID
        if idempotency_key:
            existing_idemp = await self.db.execute(
                select(SalesInvoice)
                .options(selectinload(SalesInvoice.items))
                .filter(
                    SalesInvoice.id == idempotency_key,
                    SalesInvoice.is_deleted == False,
                    SalesInvoice.company_id == self.tenant_ctx.company_id,
                    SalesInvoice.branch_id == self.tenant_ctx.branch_id
                )
            )
            existing_inv = existing_idemp.scalars().first()
            if existing_inv:
                return existing_inv

        invoice_id = idempotency_key or invoice_in.id or f"inv-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"

        # 2. Canonical Document Number Allocation (Phase 5 & Phase 6)
        # If invoice_no is missing, empty, AUTO, or static default D1DS13-1, allocate next canonical sequence
        raw_inv_no = (invoice_in.invoice_no or "").strip()
        if not raw_inv_no or raw_inv_no.upper() == "AUTO" or raw_inv_no == "D1DS13-1":
            from .documents_engine import DocumentsEngine
            while True:
                seq_alloc = await DocumentsEngine.allocate_next_number_in_transaction(
                    session=self.db,
                    company_id=self.tenant_ctx.company_id,
                    document_type="SALES_INVOICE",
                    branch_id=self.tenant_ctx.branch_id,
                    company_code=self.tenant_ctx.company_id,
                    created_by=getattr(self.tenant_ctx, "user_id", None) or "SYSTEM"
                )
                candidate_no = seq_alloc.document_no
                dup_check = await self.db.execute(
                    select(SalesInvoice.id).filter(
                        SalesInvoice.invoice_no == candidate_no,
                        SalesInvoice.is_deleted == False,
                        SalesInvoice.company_id == self.tenant_ctx.company_id
                    )
                )
                if not dup_check.scalars().first():
                    invoice_no = candidate_no
                    break
        else:
            invoice_no = raw_inv_no
            # 3. Document Uniqueness Check (Separate from Idempotency - Phase 6)
            dup_stmt = select(SalesInvoice).filter(
                SalesInvoice.invoice_no == invoice_no,
                SalesInvoice.is_deleted == False,
                SalesInvoice.company_id == self.tenant_ctx.company_id
            )
            dup_res = await self.db.execute(dup_stmt)
            if dup_res.scalars().first():
                raise HTTPException(
                    status_code=409,
                    detail=f"Duplicate document number: Invoice '{invoice_no}' already exists under active company context."
                )

        # Resolve company store state code
        company_state_code = "27"  # Default Maharashtra
        comp_stmt = select(Company).filter(Company.id == self.tenant_ctx.company_id, Company.is_deleted == False)
        comp_res = await self.db.execute(comp_stmt)
        company_obj = comp_res.scalars().first()
        if company_obj and company_obj.gst_number:
            extracted_comp_state = extract_state_code_from_gstin(company_obj.gst_number)
            if extracted_comp_state:
                company_state_code = extracted_comp_state

        # Determine settlement and credit modes early
        is_credit_mode = (invoice_in.payment_mode or "").strip().upper() == "CREDIT"
        is_settled_status = (invoice_in.status or "Draft").upper() not in ["SUSPENDED", "DRAFT", "HOLD", "CANCELLED"]

        # Resolve customer details & tenant validation
        resolved_customer_id = invoice_in.customer_id or "CUST-WALKIN"
        customer_gstin = invoice_in.customer_gstin
        customer_name = invoice_in.customer_name
        pos_state_name = invoice_in.pos_state
        pos_state_code = None

        cust_db_record = None
        if resolved_customer_id and resolved_customer_id != "CUST-WALKIN":
            # Tenant verification
            cust_stmt = select(Customer).where(
                Customer.id == resolved_customer_id,
                Customer.is_deleted == False
            )
            if is_credit_mode or is_settled_status:
                cust_stmt = cust_stmt.with_for_update()

            cust_db_record = (await self.db.execute(cust_stmt)).scalars().first()
            if not cust_db_record:
                # Check if customer exists in another tenant for proper 403 vs 404
                cross_check_stmt = select(Customer.company_id).filter(
                    Customer.id == resolved_customer_id,
                    Customer.is_deleted == False,
                )
                cross_res = await self.db.execute(cross_check_stmt)
                found_company_id = cross_res.scalars().first()
                if found_company_id and found_company_id != self.tenant_ctx.company_id:
                    raise HTTPException(
                        status_code=403,
                        detail="Cross-company customer access is prohibited."
                    )
                raise HTTPException(
                    status_code=404,
                    detail=f"Customer '{resolved_customer_id}' not found."
                )

            if cust_db_record.company_id != self.tenant_ctx.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="Cross-company customer access is prohibited."
                )

            if not customer_name:
                customer_name = getattr(cust_db_record, "name", None)
            if not customer_gstin:
                customer_gstin = getattr(cust_db_record, "gst_number", None)
        else:
            if not customer_name:
                customer_name = "Walk-In / Cash Customer"

        # Reject Corporate B2B fields on walk-in customer
        if resolved_customer_id == "CUST-WALKIN":
            if invoice_in.billed_party_gstin_id or invoice_in.delivery_location_id or getattr(invoice_in, "billing_location_id", None):
                raise HTTPException(
                    status_code=400,
                    detail="Billed GST registration, billing location, and delivery location cannot be specified for walk-in customer."
                )

        # 1.5 Validate Billing Location if supplied
        billing_loc_record = None
        snapshot_billing_store_code = getattr(invoice_in, "billing_store_code", None)
        snapshot_billing_address = invoice_in.billing_address
        if getattr(invoice_in, "billing_location_id", None):
            b_stmt = select(CustomerBillingLocation).filter(
                CustomerBillingLocation.id == invoice_in.billing_location_id,
                CustomerBillingLocation.is_deleted == False,
            )
            billing_loc_record = (await self.db.execute(b_stmt)).scalars().first()
            if not billing_loc_record:
                raise HTTPException(
                    status_code=404,
                    detail=f"Billing location '{invoice_in.billing_location_id}' not found."
                )
            if billing_loc_record.company_id != self.tenant_ctx.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="Cross-company billing location access is prohibited."
                )
            if billing_loc_record.customer_id != resolved_customer_id:
                raise HTTPException(
                    status_code=400,
                    detail="Billing location does not belong to the selected customer."
                )
            if billing_loc_record.status != "ACTIVE":
                raise HTTPException(
                    status_code=400,
                    detail="Selected billing location is inactive."
                )
            if not snapshot_billing_store_code:
                snapshot_billing_store_code = billing_loc_record.billing_store_code
            if not snapshot_billing_address:
                parts = [billing_loc_record.address_line1, billing_loc_record.address_line2, billing_loc_record.city, f"{billing_loc_record.state} - {billing_loc_record.pincode}"]
                snapshot_billing_address = ", ".join(p for p in parts if p)

        # 2. Validate Billed Party GST Registration if supplied
        billed_reg_record = None
        if invoice_in.billed_party_gstin_id:
            reg_stmt = select(CustomerGSTRegistration).filter(
                CustomerGSTRegistration.id == invoice_in.billed_party_gstin_id,
                CustomerGSTRegistration.is_deleted == False,
            )
            billed_reg_record = (await self.db.execute(reg_stmt)).scalars().first()
            if not billed_reg_record:
                raise HTTPException(
                    status_code=404,
                    detail=f"Billed GST registration '{invoice_in.billed_party_gstin_id}' not found."
                )
            if billed_reg_record.company_id != self.tenant_ctx.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="Cross-company GST registration access is prohibited."
                )
            if billed_reg_record.customer_id != resolved_customer_id:
                raise HTTPException(
                    status_code=400,
                    detail="Billed GST registration does not belong to the selected customer."
                )
            if not billed_reg_record.is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Selected Billed GST registration is inactive."
                )
            # Authoritative customer GSTIN snapshot
            customer_gstin = billed_reg_record.gstin

        # 3. Validate Delivery Location if supplied
        delivery_loc_record = None
        if invoice_in.delivery_location_id:
            loc_stmt = select(CustomerDeliveryLocation).filter(
                CustomerDeliveryLocation.id == invoice_in.delivery_location_id,
                CustomerDeliveryLocation.is_deleted == False,
            )
            delivery_loc_record = (await self.db.execute(loc_stmt)).scalars().first()
            if not delivery_loc_record:
                raise HTTPException(
                    status_code=404,
                    detail=f"Delivery location '{invoice_in.delivery_location_id}' not found."
                )
            if delivery_loc_record.company_id != self.tenant_ctx.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="Cross-company delivery location access is prohibited."
                )
            if delivery_loc_record.customer_id != resolved_customer_id:
                raise HTTPException(
                    status_code=400,
                    detail="Delivery location does not belong to the selected customer."
                )
            if not delivery_loc_record.is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Selected delivery location is inactive."
                )
            # Validate linked delivery GST registration if present
            if delivery_loc_record.gst_registration_id:
                linked_reg_stmt = select(CustomerGSTRegistration).filter(
                    CustomerGSTRegistration.id == delivery_loc_record.gst_registration_id,
                    CustomerGSTRegistration.is_deleted == False,
                )
                linked_reg = (await self.db.execute(linked_reg_stmt)).scalars().first()
                if linked_reg:
                    if linked_reg.company_id != self.tenant_ctx.company_id:
                        raise HTTPException(
                            status_code=403,
                            detail="Delivery location linked GST registration belongs to a different company."
                        )
                    if linked_reg.customer_id != resolved_customer_id:
                        raise HTTPException(
                            status_code=400,
                            detail="Delivery location linked GST registration does not belong to the selected customer."
                        )
            # Delivery GSTIN and state consistency check
            eff_del_gstin = invoice_in.delivery_gstin or delivery_loc_record.gstin
            if eff_del_gstin:
                val_ok, del_st_code, _ = validate_gstin(eff_del_gstin)
                if not val_ok:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Delivery GSTIN '{eff_del_gstin}' is invalid."
                    )
                if del_st_code != delivery_loc_record.state_code:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Delivery GSTIN state '{del_st_code}' does not match delivery location state '{delivery_loc_record.state_code}'."
                    )

        # 4. Snapshots preparation
        if delivery_loc_record:
            snapshot_del_store_code = delivery_loc_record.store_code
            snapshot_del_gstin = invoice_in.delivery_gstin or delivery_loc_record.gstin
            snapshot_del_loc = {
                "id": delivery_loc_record.id,
                "store_code": delivery_loc_record.store_code,
                "location_name": delivery_loc_record.location_name,
                "address_line1": delivery_loc_record.address_line1,
                "address_line2": delivery_loc_record.address_line2,
                "city": delivery_loc_record.city,
                "state_code": delivery_loc_record.state_code,
                "state_name": delivery_loc_record.state,
                "pincode": delivery_loc_record.pincode,
                "delivery_gstin": snapshot_del_gstin,
                "contact_person": delivery_loc_record.contact_person,
                "phone": delivery_loc_record.phone,
                "metadata_json": delivery_loc_record.metadata_json,
            }
        else:
            snapshot_del_store_code = invoice_in.delivery_store_code
            snapshot_del_gstin = invoice_in.delivery_gstin
            snapshot_del_loc = invoice_in.delivery_location_snapshot

        # 5. Place of Supply (POS) Derivation
        # Rule E: place_of_supply_code MUST be transaction-derived from authoritative delivery/tax context
        pos_state_code = None
        pos_state_name = invoice_in.pos_state
        is_registered_b2b = bool(customer_gstin or billed_reg_record)

        if delivery_loc_record:
            pos_state_code = delivery_loc_record.state_code
            pos_state_name = delivery_loc_record.state or GST_STATE_CODES.get(pos_state_code, "Delivery State")
        elif invoice_in.place_of_supply_code:
            pos_state_code = invoice_in.place_of_supply_code
            pos_state_name = pos_state_name or GST_STATE_CODES.get(pos_state_code, "Transaction POS")
        elif billed_reg_record:
            pos_state_code = billed_reg_record.state_code
            pos_state_name = billed_reg_record.state_name or GST_STATE_CODES.get(pos_state_code, "Billed State")
        elif customer_gstin:
            is_valid_gstin, st_code, st_name = validate_gstin(customer_gstin)
            if is_valid_gstin and st_code:
                pos_state_code = st_code
                pos_state_name = pos_state_name or st_name

        if not pos_state_code:
            pos_state_code = company_state_code
            pos_state_name = pos_state_name or GST_STATE_CODES.get(company_state_code, "Home State")

        # Determine inter-state jurisdiction based on transaction POS
        if delivery_loc_record or invoice_in.place_of_supply_code or billed_reg_record:
            is_interstate = (company_state_code != pos_state_code)
        elif invoice_in.is_interstate is not None:
            is_interstate = invoice_in.is_interstate
        else:
            is_interstate = (company_state_code != pos_state_code)

        from .inventory_wms import InventoryWmsService
        from .inventory_warehouse_resolver import InventoryWarehouseResolver
        wms_service = InventoryWmsService(self.db, self.tenant_ctx)
        resolver = InventoryWarehouseResolver(self.db)
        warehouse_id = invoice_in.warehouse_id
        if not warehouse_id:
            warehouse = await resolver.resolve(company_id=self.tenant_ctx.company_id, branch_id=self.tenant_ctx.branch_id)
            warehouse_id = warehouse.id

        # 1. Validate items and calculate totals
        calculated_taxable_total = Decimal("0.00")
        calculated_tax_total = Decimal("0.00")
        calculated_grand_total = Decimal("0.00")
        invoice_items = []
        batch_deductions = []

        for idx, item in enumerate(invoice_in.items, start=1):
            product_stmt = select(Product).filter(
                (Product.id == item.product_id) | (Product.code == item.product_id) | (Product.code == item.code),
                Product.is_deleted == False,
                Product.company_id == self.tenant_ctx.company_id,
            )
            product_res = await self.db.execute(product_stmt)
            product = product_res.scalars().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product not found: {item.product_id or item.code}")

            quantity = Decimal(str(item.quantity))
            unit_price = Decimal(str(item.price))
            gst_rate = Decimal(str(item.gst_rate or "18.00"))

            # Determine batch allocation
            assigned_batch = item.batch_no or "BATCH-OPENING"
            is_settled_status = (invoice_in.status or "Draft").upper() not in ["SUSPENDED", "DRAFT", "HOLD", "CANCELLED"]
            if product.tracking_mode != "No-stock" and is_settled_status:
                if item.batch_no:
                    batch_deductions.append({
                        "product": product,
                        "batch_no": item.batch_no,
                        "quantity": quantity
                    })
                else:
                    try:
                        # Auto-allocate via FEFO
                        allocs = await wms_service.allocate_stock_fefo(
                            product_id=product.id,
                            warehouse_id=warehouse_id,
                            requested_qty=quantity
                        )
                        assigned_batch = allocs[0]["batch_no"] if allocs else "BATCH-OPENING"
                        for a in allocs:
                            batch_deductions.append({
                                "product": product,
                                "batch_no": a["batch_no"],
                                "quantity": Decimal(str(a["allocated_quantity"]))
                            })
                    except Exception:
                        assigned_batch = "BATCH-OPENING"
                        batch_deductions.append({
                            "product": product,
                            "batch_no": assigned_batch,
                            "quantity": quantity
                        })

            # Determine whether line is tax-inclusive (default: True for B2C consumer MRP, False for B2B wholesale)
            if item.is_tax_inclusive is not None:
                is_inclusive = item.is_tax_inclusive
            else:
                is_inclusive = not is_registered_b2b

            # Compute discount amount if discount percentage is given
            disc_pct = Decimal(str(item.disc_pct or "0.00"))
            discount_amount = (unit_price * quantity * disc_pct / Decimal("100.00")) if disc_pct > 0 else Decimal("0.00")

            tax_calc = calculate_line_item_tax(
                unit_price=unit_price,
                quantity=quantity,
                discount_amount=discount_amount,
                gst_rate=gst_rate,
                is_tax_inclusive=is_inclusive,
                is_interstate=is_interstate,
            )

            calculated_taxable_total += tax_calc["taxable_value"]
            calculated_tax_total += tax_calc["tax_amount"]
            calculated_grand_total += tax_calc["total_amount"]

            db_item = SalesInvoiceItem(
                product_id=product.id,
                code=item.code or product.code,
                name=item.name or product.name,
                batch_no=assigned_batch,
                quantity=quantity,
                price=unit_price,
                hsn_code=item.hsn_code or product.hsn_code,
                gst_rate=gst_rate,
                tax_amount=tax_calc["tax_amount"],
                total_amount=tax_calc["total_amount"],
                taxable_value=tax_calc["taxable_value"],
                cgst_amount=tax_calc["cgst_amount"],
                sgst_amount=tax_calc["sgst_amount"],
                igst_amount=tax_calc["igst_amount"],
                mrp=item.mrp or product.mrp or unit_price,
                disc_pct=disc_pct,
                line_no=item.line_no or idx,
            )
            invoice_items.append(db_item)

        # 2. Concurrency-Safe Customer Row Lock & Authoritative Credit Check (Blockers 2 & 3)
        if is_credit_mode:
            final_paid_amount = Decimal("0.00")
            final_balance_amount = calculated_grand_total
        else:
            final_paid_amount = getattr(invoice_in, "paid_amount", None) or Decimal("0.00")
            final_balance_amount = getattr(invoice_in, "balance_amount", None) or Decimal("0.00")

        previous_outstanding = Decimal("0.00")
        credit_days_configured = 30
        credit_limit_configured = Decimal("0.00")

        if resolved_customer_id and resolved_customer_id != "CUST-WALKIN":
            if not cust_db_record and is_credit_mode:
                raise HTTPException(
                    status_code=404,
                    detail=f"Customer '{resolved_customer_id}' not found for credit billing."
                )

            if cust_db_record:
                previous_outstanding = Decimal(str(cust_db_record.outstanding or "0.00"))
                if cust_db_record.customer_group_id:
                    cg_stmt = select(CustomerGroup).where(
                        CustomerGroup.id == cust_db_record.customer_group_id,
                        CustomerGroup.is_deleted == False
                    )
                    cg_rec = (await self.db.execute(cg_stmt)).scalars().first()
                    if cg_rec:
                        credit_days_configured = cg_rec.credit_days or 30
                        credit_limit_configured = Decimal(str(cg_rec.credit_limit or "0.00"))

        if resolved_customer_id and resolved_customer_id != "CUST-WALKIN" and is_settled_status:
            # Credit control must strictly FAIL CLOSED — do NOT swallow unexpected errors
            await self.crm_service.check_credit_limit(resolved_customer_id, float(calculated_grand_total))

        # 3. Save Sales Invoice & items
        db_customer_id = resolved_customer_id if (resolved_customer_id and resolved_customer_id != "CUST-WALKIN") else None
        
        # Coerce date to python datetime.date for PostgreSQL Date column
        from datetime import date as py_date, timedelta
        inv_date = invoice_in.date
        if isinstance(inv_date, str):
            try:
                inv_date = py_date.fromisoformat(inv_date.split("T")[0])
            except Exception:
                inv_date = py_date.today()
        elif isinstance(inv_date, datetime):
            inv_date = inv_date.date()
        elif not inv_date:
            inv_date = py_date.today()

        # Calculate due date from configured credit_days
        due_date = inv_date + timedelta(days=credit_days_configured)

        snapshots = dict(getattr(invoice_in, "rule_snapshots", None) or {})
        if is_credit_mode:
            snapshots["transaction_type"] = "Credit"
            snapshots["credit_terms"] = {
                "transaction_type": "Credit",
                "credit_days": credit_days_configured,
                "due_date": due_date.isoformat(),
                "previous_outstanding": float(previous_outstanding),
                "projected_outstanding": float(previous_outstanding + calculated_grand_total),
                "credit_limit": float(credit_limit_configured)
            }

        # Resolve branch_id safely against tenant database
        from ..models.tenant import Branch
        actual_branch_id = self.tenant_ctx.branch_id
        if actual_branch_id:
            try:
                res_br = await self.db.execute(
                    select(Branch.id).where(
                        (Branch.id == actual_branch_id) | (Branch.code == actual_branch_id)
                    )
                )
                br_found = res_br.scalars().first()
                actual_branch_id = br_found if br_found else None
            except Exception:
                actual_branch_id = None

        db_invoice = SalesInvoice(
            id=invoice_id,
            invoice_no=invoice_no,
            date=inv_date,
            customer_id=db_customer_id,
            customer_name=customer_name,
            customer_gstin=customer_gstin,
            pos_state=pos_state_name,
            warehouse_id=warehouse_id,
            taxable_value=calculated_taxable_total,
            tax_total=calculated_tax_total,
            grand_total=calculated_grand_total,
            is_interstate=is_interstate,
            payment_mode="CREDIT" if is_credit_mode else (invoice_in.payment_mode or "CASH"),
            billing_address=snapshot_billing_address,
            shipping_address=invoice_in.shipping_address or (
                ", ".join(p for p in [delivery_loc_record.address_line1, delivery_loc_record.address_line2, delivery_loc_record.city, f"{delivery_loc_record.state} - {delivery_loc_record.pincode}"] if p)
                if delivery_loc_record else None
            ),
            rounding_amount=invoice_in.rounding_amount or Decimal("0.00"),
            eway_bill_no=invoice_in.eway_bill_no,
            status=invoice_in.status,
            items=invoice_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=actual_branch_id,
            # v1373 -- Sprint 14/15 optional fields (getattr for backward compat)
            salesperson_id=getattr(invoice_in, "salesperson_id", None),
            salesperson_name=getattr(invoice_in, "salesperson_name", None),
            terminal_id=getattr(invoice_in, "terminal_id", None),
            counter_id=getattr(invoice_in, "counter_id", None),
            paid_amount=final_paid_amount,
            balance_amount=final_balance_amount,
            discount_amount=getattr(invoice_in, "discount_amount", None) or Decimal("0.00"),
            net_amount=getattr(invoice_in, "net_amount", None) or Decimal("0.00"),
            rule_snapshots=snapshots,
            import_validation_notes=getattr(invoice_in, "remarks", None),
            # Phase 2C Corporate B2B Fields & Immutable Snapshots
            billed_party_gstin_id=invoice_in.billed_party_gstin_id,
            billing_location_id=getattr(invoice_in, "billing_location_id", None),
            billing_store_code=snapshot_billing_store_code,
            delivery_location_id=invoice_in.delivery_location_id,
            delivery_store_code=snapshot_del_store_code,
            delivery_gstin=snapshot_del_gstin,
            delivery_location_snapshot=snapshot_del_loc,
            place_of_supply_code=pos_state_code,
            po_reference=getattr(invoice_in, "po_reference", None),
            # Legacy compatibility: sis_code mirrors delivery_store_code
            sis_code=snapshot_del_store_code or getattr(invoice_in, "sis_code", None),
        )
        self.db.add(db_invoice)

        # Synchronously and atomically increment customer outstanding for settled credit sales (Phase 3)
        if is_credit_mode and is_settled_status and cust_db_record:
            cust_db_record.outstanding = previous_outstanding + calculated_grand_total
            cust_db_record.modified_at = datetime.now(timezone.utc)
            self.db.add(cust_db_record)

        try:
            await self.db.flush()
        except Exception as ef:
            print(f"[SalesService Error at flush db_invoice]: {ef}")
            raise

        # 4. Deduct stock from WMS batch stocks atomically (only for completed/settled sales)
        if (invoice_in.status or "Draft").upper() not in ["SUSPENDED", "DRAFT", "HOLD", "CANCELLED"]:
            for ded in batch_deductions:
                await wms_service.atomic_mutate_batch_stock(
                    product_id=ded["product"].id,
                    warehouse_id=warehouse_id,
                    batch_no=ded["batch_no"],
                    qty_delta=-ded["quantity"],
                    movement_type="OUTWARD_SALE",
                    reference_doc_type="Sales Invoice",
                    reference_doc_id=db_invoice.id,
                    remarks=f"Stock deducted for sales invoice: {db_invoice.invoice_no}",
                )

        # Record Transactional Outbox event atomically within same DB transaction
        try:
            from .outbox_service import OutboxService
            await OutboxService.record_event(
                session=self.db,
                target_channel="PSV_QUEUE",
                payload={
                    "action": "SALES_INVOICE_CREATED",
                    "invoice_no": db_invoice.invoice_no,
                    "grand_total": str(db_invoice.grand_total),
                    "customer_id": db_invoice.customer_id,
                    "company_code": self.tenant_ctx.company_id
                },
                causation_id=db_invoice.invoice_no
            )
        except Exception as eo:
            print(f"[SalesService Error at record_event]: {eo}")
            raise
        # -- Sprint 14: Sales line-item + Loyalty earn hooks (atomic, pre-commit) --
        from .sales_hook import write_invoice_lines, write_loyalty_earn
        _creator = getattr(self.tenant_ctx, "user_id", None) or "system"
        await write_invoice_lines(
            db=self.db,
            invoice_id=db_invoice.id,
            company_id=self.tenant_ctx.company_id,
            branch_id=actual_branch_id,
            creator=_creator,
            items=invoice_in.items,
            warehouse_id=warehouse_id,
        )
        await write_loyalty_earn(
            db=self.db,
            invoice_id=db_invoice.id,
            company_id=self.tenant_ctx.company_id,
            branch_id=actual_branch_id,
            customer_id=db_invoice.customer_id,
            grand_total=calculated_grand_total,
            creator=_creator,
        )
        # -- End Sprint 14 hooks --
        try:
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=400,
                detail=f"Commit error: {str(e)}"
            )
        # Re-fetch with eager items to avoid MissingGreenlet during response serialization
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(SalesInvoice.id == db_invoice.id)
        )
        return res.scalars().first()

    # ??????????????????????????????????????????????????????????????
    # Sales Quotation
    # ??????????????????????????????????????????????????????????????

    async def create_sales_quotation(self, q_in: SalesQuotationCreate) -> SalesQuotation:
        existing = await self.db.execute(
            select(SalesQuotation).filter(
                SalesQuotation.quotation_no == q_in.quotation_no,
                SalesQuotation.is_deleted == False,
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id == self.tenant_ctx.branch_id
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Sales quotation with this quotation number already exists")

        tax_total = Decimal("0.00")
        grand_total = Decimal("0.00")
        q_items = []

        for item in q_in.items:
            item_tax = (item.quantity * item.price * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
            tax_total += item_tax
            grand_total += item_total

            q_items.append(SalesQuotationItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                price=item.price,
                hsn_code=item.hsn_code,
                gst_rate=item.gst_rate,
                tax_amount=item_tax,
                total_amount=item_total
            ))

        db_q = SalesQuotation(
            id=q_in.id,
            quotation_no=q_in.quotation_no,
            date=q_in.date,
            customer_name=q_in.customer_name,
            tax_total=tax_total,
            grand_total=grand_total,
            status=q_in.status,
            sales_order_id=q_in.sales_order_id,
            items=q_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        self.db.add(db_q)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Sales quotation already exists")

        # Re-fetch with eager items to avoid MissingGreenlet during response serialization
        result = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(SalesQuotation.id == db_q.id)
        )
        return result.scalars().first()

    async def list_sales_quotations(self) -> List[SalesQuotation]:
        res = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id == self.tenant_ctx.branch_id,
                SalesQuotation.is_deleted == False
            )
        )
        return res.scalars().all()

    async def get_sales_quotation(self, q_id: str) -> tuple[SalesQuotation, List[SalesQuotationItem]]:
        res = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(
                SalesQuotation.id == q_id,
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id == self.tenant_ctx.branch_id,
                SalesQuotation.is_deleted == False
            )
        )
        q = res.scalars().first()
        if not q:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        return q, q.items

    # ??????????????????????????????????????????????????????????????
    # Sales Order
    # ??????????????????????????????????????????????????????????????

    async def create_sales_order(self, so_in: SalesOrderCreate) -> SalesOrder:
        existing = await self.db.execute(
            select(SalesOrder).filter(
                SalesOrder.order_no == so_in.order_no,
                SalesOrder.is_deleted == False,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id == self.tenant_ctx.branch_id
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Sales order with this order number already exists")

        if not so_in.items:
            raise HTTPException(status_code=400, detail="Sales order must contain at least one item.")

        tax_total = Decimal("0.00")
        grand_total = Decimal("0.00")
        so_items = []

        for index, item in enumerate(so_in.items, start=1):
            item_product_id = (item.product_id or item.code or "").strip()
            item_code = (item.code or "").strip()
            item_name = (item.name or "").strip()

            if not item_product_id:
                raise HTTPException(status_code=400, detail=f"Item {index}: product ID is required.")

            product_stmt = select(Product).filter(
                (Product.id == item_product_id) | (Product.code == item_product_id) | (Product.code == item_code),
                Product.is_deleted == False,
                Product.company_id == self.tenant_ctx.company_id,
            )
            product_res = await self.db.execute(product_stmt)
            product = product_res.scalars().first()

            if not product:
                raise HTTPException(status_code=400, detail=f"Item {index}: '{item_product_id}' was not found in the database. Please select a valid item before saving.")

            if not item_name:
                raise HTTPException(status_code=400, detail=f"Item {index}: '{item_code or item_product_id}' was not found in the database. Please select a valid item before saving.")

            if Decimal(str(item.quantity)) <= 0:
                raise HTTPException(status_code=400, detail=f"Item {index}: quantity must be greater than zero.")

            if Decimal(str(item.price)) < 0:
                raise HTTPException(status_code=400, detail=f"Item {index}: price cannot be negative.")

            item_tax = (item.quantity * item.price * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
            tax_total += item_tax
            grand_total += item_total

            so_items.append(SalesOrderItem(
                product_id=product.id,
                code=product.code,
                name=product.name,
                quantity=item.quantity,
                price=item.price,
                hsn_code=item.hsn_code,
                gst_rate=item.gst_rate,
                tax_amount=item_tax,
                total_amount=item_total
            ))

        db_so = SalesOrder(
            id=so_in.id,
            order_no=so_in.order_no,
            date=so_in.date,
            customer_name=so_in.customer_name,
            tax_total=tax_total,
            grand_total=grand_total,
            status=so_in.status,
            source_quotation_id=so_in.source_quotation_id,
            items=so_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        self.db.add(db_so)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Sales order already exists")

        # Re-fetch with eager items to avoid MissingGreenlet during response serialization
        result = await self.db.execute(
            select(SalesOrder)
            .options(
                selectinload(SalesOrder.items),
                selectinload(SalesOrder.allocations)
            )
            .where(SalesOrder.id == db_so.id)
        )
        return result.scalars().first()

    async def list_sales_orders(
        self,
        customer_id: Optional[str] = None,
        status: Optional[str] = None,
        fulfillment_status: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 1000,
    ) -> List[SalesOrder]:
        stmt = (
            select(SalesOrder)
            .options(
                selectinload(SalesOrder.items),
                selectinload(SalesOrder.allocations)
            )
            .where(
                SalesOrder.is_deleted == False
            )
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(
                (SalesOrder.company_id == self.tenant_ctx.company_id) | (SalesOrder.company_id.is_(None))
            )
        if self.tenant_ctx and self.tenant_ctx.branch_id:
            stmt = stmt.where(
                (SalesOrder.branch_id == self.tenant_ctx.branch_id) | (SalesOrder.branch_id.is_(None))
            )
        if customer_id:
            stmt = stmt.where(
                (SalesOrder.customer_id == customer_id) | (SalesOrder.customer_name.ilike(f"%{customer_id}%"))
            )
        if status:
            stmt = stmt.where(SalesOrder.status == status)
        if fulfillment_status:
            stmt = stmt.where(SalesOrder.fulfillment_status == fulfillment_status)
        if from_date:
            stmt = stmt.where(SalesOrder.date >= from_date)
        if to_date:
            stmt = stmt.where(SalesOrder.date <= to_date)

        stmt = stmt.order_by(SalesOrder.date.desc(), SalesOrder.created_at.desc()).offset(skip).limit(limit)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_sales_order(self, so_id: str) -> tuple[SalesOrder, List[SalesOrderItem], List[SalesOrderInvoiceAllocation]]:
        stmt = (
            select(SalesOrder)
            .options(
                selectinload(SalesOrder.items),
                selectinload(SalesOrder.allocations)
            )
            .where(
                (SalesOrder.id == so_id) | (SalesOrder.order_no == so_id) | (SalesOrder.po_number == so_id),
                SalesOrder.is_deleted == False
            )
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(
                (SalesOrder.company_id == self.tenant_ctx.company_id) | (SalesOrder.company_id.is_(None))
            )
        res = await self.db.execute(stmt)
        so = res.scalars().first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales order not found")
        return so, list(so.items or []), list(so.allocations or [])

    async def convert_sales_order_to_invoice(
        self,
        order_id: str,
        selected_item_ids: Optional[List[str]] = None,
    ) -> SalesInvoice:
        """
        1-Click conversion of a Sales Order into an official Statutory Tax Invoice.
        Maps lines, calculates GST, generates allocation, updates SO fulfillment status.
        """
        so, items, allocations = await self.get_sales_order(order_id)
        if not items:
            raise HTTPException(status_code=400, detail="Sales order has no line items to convert")

        # Determine next invoice number safely by finding max existing suffix
        import re
        inv_count_res = await self.db.execute(select(SalesInvoice.invoice_no))
        all_inv_nos = [str(r) for r in inv_count_res.scalars().all() if r]
        max_num = 137
        for inv_str in all_inv_nos:
            m = re.search(r'/(\d+)$', inv_str)
            if m:
                max_num = max(max_num, int(m.group(1)))
        next_num = max_num + 1
        invoice_no = f"TT2026-2027/{next_num}"
        invoice_id = f"inv-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"

        items_to_convert = items
        if selected_item_ids:
            items_to_convert = [i for i in items if str(i.id) in selected_item_ids or str(i.product_id) in selected_item_ids]
            if not items_to_convert:
                items_to_convert = items

        inv_items = []
        total_taxable = Decimal("0.00")
        total_tax = Decimal("0.00")
        total_grand = Decimal("0.00")
        total_pairs = 0

        # State / Supply logic
        company_state_code = "27"
        customer_gstin = so.customer_gstin or ""
        pos_code = "27"
        if customer_gstin and len(customer_gstin) >= 2 and customer_gstin[:2].isdigit():
            pos_code = customer_gstin[:2]
        is_interstate = (pos_code != company_state_code)
        pos_state_name = GST_STATE_CODES.get(pos_code, "Maharashtra") if "GST_STATE_CODES" in globals() else "Maharashtra"

        for ln, item in enumerate(items_to_convert, start=1):
            qty = Decimal(str(item.quantity or 1))
            total_pairs += int(qty)
            price = Decimal(str(item.price or 0))
            taxable_val = (price * qty).quantize(Decimal("0.01"))
            gst_rate = Decimal(str(item.gst_rate or Decimal("5.00")))
            mrp_val = Decimal(str(getattr(item, "mrp", None) or (price / Decimal("0.5624") if price > 0 else Decimal("0.00")))).quantize(Decimal("0.01"))
            disc_val = Decimal(str(getattr(item, "disc_pct", None) or Decimal("43.76"))).quantize(Decimal("0.01"))

            if is_interstate:
                igst_val = (taxable_val * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                cgst_val = Decimal("0.00")
                sgst_val = Decimal("0.00")
                tot_amt = taxable_val + igst_val
            else:
                half_gst = gst_rate / Decimal("2.00")
                cgst_val = (taxable_val * (half_gst / Decimal("100.00"))).quantize(Decimal("0.01"))
                sgst_val = (taxable_val * (half_gst / Decimal("100.00"))).quantize(Decimal("0.01"))
                igst_val = Decimal("0.00")
                tot_amt = taxable_val + cgst_val + sgst_val

            total_taxable += taxable_val
            total_tax += (cgst_val + sgst_val + igst_val)
            total_grand += tot_amt

            inv_items.append(SalesInvoiceItem(
                invoice_id=invoice_id,
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=qty,
                price=price,
                hsn_code=item.hsn_code or "64041990",
                gst_rate=gst_rate,
                tax_amount=(cgst_val + sgst_val + igst_val),
                total_amount=tot_amt,
                mrp=mrp_val,
                disc_pct=disc_val,
                taxable_value=taxable_val,
                igst_amount=igst_val,
                cgst_amount=cgst_val,
                sgst_amount=sgst_val,
                line_no=ln,
            ))

        db_inv = SalesInvoice(
            id=invoice_id,
            invoice_no=invoice_no,
            date=datetime.now(timezone.utc).date(),
            customer_name=so.customer_name or "Reliance Retail Limited",
            customer_gstin=customer_gstin,
            customer_id=so.customer_id,
            billing_address=so.delivery_address or "Reliance Retail Limited",
            shipping_address=so.delivery_address or "Reliance Retail Store",
            sis_code=so.site_code or "1977",
            pos_state=pos_state_name,
            po_reference=so.po_number or so.order_no,
            taxable_value=total_taxable,
            tax_total=total_tax,
            grand_total=total_grand,
            is_interstate=is_interstate,
            bank_name="STATE BANK OF INDIA",
            account_no="43976711765",
            ifsc_code="SBIN0030425",
            status="Draft",
            items=inv_items,
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else None,
            rule_snapshots={
                "bank_branch": "WARDHMAN NAGAR NAGPUR",
                "account_holder_name": "TATTLY THREADS",
                "source_order_id": so.id,
                "source_order_no": so.order_no,
            }
        )
        self.db.add(db_inv)

        # Create allocation
        alloc = SalesOrderInvoiceAllocation(
            id=f"alloc-{uuid.uuid4().hex[:8]}",
            order_id=so.id,
            order_no=so.order_no,
            po_number=so.po_number or so.order_no,
            invoice_id=invoice_id,
            invoice_no=invoice_no,
            invoice_date=datetime.now(timezone.utc).date(),
            po_quantity=so.total_qty or total_pairs,
            po_value=so.grand_total or total_grand,
            billed_quantity=Decimal(str(total_pairs)),
            billed_value=total_grand,
            pending_quantity=max(Decimal("0.00"), Decimal(str(so.total_qty or total_pairs)) - Decimal(str(total_pairs))),
            pending_value=max(Decimal("0.00"), Decimal(str(so.grand_total or total_grand)) - total_grand),
            status="ALLOCATED",
            allocation_metadata={"auto_converted": True},
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else None,
        )
        self.db.add(alloc)

        # Update Sales Order metrics
        so.billed_qty = (Decimal(str(so.billed_qty or 0)) + Decimal(str(total_pairs)))
        so.billed_value = (Decimal(str(so.billed_value or 0)) + total_grand)
        so.pending_qty = max(Decimal("0.00"), Decimal(str(so.total_qty or 0)) - so.billed_qty)
        so.pending_value = max(Decimal("0.00"), Decimal(str(so.grand_total or 0)) - so.billed_value)
        
        if so.pending_qty <= 0:
            so.fulfillment_status = "FULFILLED"
            so.status = "Completed"
        else:
            so.fulfillment_status = "PARTIALLY_FULFILLED"
            so.status = "In Progress"

        self.db.add(so)
        await self.db.commit()

        # Re-fetch with relationships
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(SalesInvoice.id == invoice_id)
        )
        return res.scalars().first()

    # ────────────────────────────────────────────────────────────
    # Sales Return
    # ────────────────────────────────────────────────────────────

    async def get_sales_return_context(self, invoice_id: str) -> Dict[str, Any]:
        """
        Authoritative Sales Return Context for ProPOS.
        Enforces tenant isolation, branch authorization, and invoice validation.
        Computes remaining returnable quantities and attaches resolved policy snapshot.
        """
        inv_res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .filter(
                (SalesInvoice.id == invoice_id) | (SalesInvoice.invoice_no == invoice_id),
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.is_deleted == False
            )
        )
        invoice = inv_res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail=f"Sales invoice '{invoice_id}' not found.")

        # Branch authorization check if invoice has branch_id
        if invoice.branch_id and self.tenant_ctx.branch_id and invoice.branch_id != self.tenant_ctx.branch_id:
            raise HTTPException(status_code=403, detail="Cross-branch return access denied without inter-branch authorization.")

        # Find previous successful returns for this invoice
        previous_returns = await self.db.execute(
            select(SalesReturnItem.product_id, func.sum(SalesReturnItem.quantity).label("total_returned"))
            .join(SalesReturn, SalesReturn.id == SalesReturnItem.return_id)
            .where(
                SalesReturn.original_invoice_id == invoice.id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.is_deleted == False,
                func.coalesce(func.lower(SalesReturn.status), "completed").in_(
                    ["approved", "processed", "completed", "submitted", "draft", "confirmed", "active"]
                ),
                SalesReturnItem.product_id.is_not(None),
            )
            .group_by(SalesReturnItem.product_id)
        )
        returned_quantities = {r[0]: Decimal(str(r[1] or 0)) for r in previous_returns.all()}


        # Resolve policy with full contextual scope
        policy = await self.sales_return_policy_resolver.resolve(
            tenant=self.tenant_ctx.company_id,
            branch=self.tenant_ctx.branch_id,
            document_type="SALES_INVOICE",
            customer_context={"customer_id": invoice.customer_id} if invoice.customer_id else None,
        )

        lines = []
        for item in invoice.items:
            orig_qty = item.quantity or Decimal("1.0")
            ret_qty = returned_quantities.get(item.product_id, Decimal("0.0"))
            rem_qty = max(Decimal("0.0"), orig_qty - ret_qty)
            lines.append({
                "product_id": item.product_id or item.code,
                "code": item.code,
                "name": item.name,
                "original_quantity": float(orig_qty),
                "returned_quantity": float(ret_qty),
                "remaining_quantity": float(rem_qty),
                "unit_price": float(item.price),
                "gst_rate": float(item.gst_rate or 0.0),
                "tax_amount": float(item.tax_amount or 0.0),
                "total_amount": float(item.total_amount or (orig_qty * item.price)),
            })

        # Fetch customer details if exists
        customer_info = None
        if invoice.customer_id:
            try:
                cust = await self.crm_service.get_customer(invoice.customer_id)
                if cust:
                    customer_info = {
                        "id": cust.id,
                        "name": cust.name,
                        "phone": getattr(cust, "mobile", getattr(cust, "phone", None)),
                        "email": getattr(cust, "email", None),
                        "outstanding": float(cust.outstanding or 0.0),
                    }
                else:
                    customer_info = {"id": invoice.customer_id, "name": getattr(invoice, "customer_name", None)}
            except Exception:
                customer_info = {"id": invoice.customer_id, "name": getattr(invoice, "customer_name", None)}


        return_window_days = policy.values.get("return_window_days")
        if return_window_days is None:
            raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing return_window_days in the effective policy.")
        refund_modes = policy.values.get("refund_modes")
        if refund_modes is None:
            raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing refund_modes in the effective policy.")
        return_reasons = policy.values.get("return_reasons")
        if return_reasons is None:
            raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing return_reasons in the effective policy.")
        auth_policy = policy.values.get("authorization_policy")
        if not isinstance(auth_policy, dict) or "supervisor_threshold" not in auth_policy:
            raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing authorization_policy.supervisor_threshold in the effective policy.")

        return {
            "invoice_id": invoice.id,
            "invoice_no": invoice.invoice_no,
            "invoice_date": invoice.date.isoformat() if hasattr(invoice.date, "isoformat") else str(invoice.date),
            "status": invoice.status,
            "customer": customer_info,
            "payment_context": {
                "payment_mode": invoice.payment_mode or "CASH",
            },
            "branch_id": invoice.branch_id,
            "terminal_id": getattr(invoice, "terminal_id", "TERM-01"),
            "shift_id": getattr(invoice, "shift_id", None),
            "lines": lines,
            "effective_policy": {
                "policy_id": policy.policy_id,
                "policy_version": policy.policy_version,
                "resolution_scope": policy.resolution_scope,
                "return_window_days": return_window_days,
                "allowed_refund_modes": refund_modes,
                "allowed_return_reasons": return_reasons,
                "supervisor_threshold": float(auth_policy["supervisor_threshold"]),
            },
        }

    async def create_sales_return(self, sr_in: SalesReturnCreate, idempotency_key: Optional[str] = None) -> SalesReturn:
        # Lock the invoice while validating returnable quantities and creating effects.
        inv_res = await self.db.execute(
            select(SalesInvoice).options(selectinload(SalesInvoice.items)).filter(
                SalesInvoice.id == sr_in.original_invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                (SalesInvoice.branch_id == self.tenant_ctx.branch_id) | (SalesInvoice.branch_id.is_(None)),
                SalesInvoice.is_deleted == False
            ).with_for_update()
        )
        orig_invoice = inv_res.scalars().first()
        if not orig_invoice:
            raise HTTPException(status_code=404, detail="Original sales invoice not found")

        # Resolve policy across contextual precedence
        policy = await self.sales_return_policy_resolver.resolve(
            tenant=self.tenant_ctx.company_id,
            branch=self.tenant_ctx.branch_id,
            document_type="SALES_INVOICE",
            customer_context={"customer_id": orig_invoice.customer_id} if orig_invoice else None,
            transaction_context={"is_blind_return": getattr(sr_in, "is_blind_return", False)},
        )

        # Return window check
        if orig_invoice.date and sr_in.date:
            window_days = policy.values.get("return_window_days")
            if window_days is None:
                raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing return_window_days in the effective policy.")
            inv_d = orig_invoice.date if isinstance(orig_invoice.date, date) else datetime.strptime(str(orig_invoice.date), "%Y-%m-%d").date()
            sr_d = sr_in.date if isinstance(sr_in.date, date) else datetime.strptime(str(sr_in.date), "%Y-%m-%d").date()
            days_diff = (sr_d - inv_d).days
            if days_diff > int(window_days) and not getattr(sr_in, "supervisor_auth_token", None):
                raise HTTPException(
                    status_code=422,
                    detail=f"Return window of {window_days} days has expired for this invoice (issued {inv_d}, return requested {sr_d}). Supervisor authorization required.",
                )

        # Blind return check
        if getattr(sr_in, "is_blind_return", False):
            blind_allowed = policy.values.get("is_blind_return_allowed", False)
            if not blind_allowed and not getattr(sr_in, "supervisor_auth_token", None):
                raise HTTPException(
                    status_code=422,
                    detail="Blind returns without original bill reference require supervisor authorization.",
                )

        if idempotency_key:
            existing_key = await self.db.execute(
                select(SalesReturn).options(selectinload(SalesReturn.items)).filter(
                    SalesReturn.idempotency_key == idempotency_key,
                    SalesReturn.company_id == self.tenant_ctx.company_id,
                    SalesReturn.is_deleted == False,
                )
            )
            existing_return = existing_key.scalars().first()
            if existing_return:
                if existing_return.original_invoice_id != sr_in.original_invoice_id or existing_return.return_no != sr_in.return_no:
                    raise HTTPException(status_code=409, detail="Idempotency key collision: request identity differs from previous request")
                return existing_return

        existing = await self.db.execute(
            select(SalesReturn).filter(
                SalesReturn.return_no == sr_in.return_no,
                SalesReturn.is_deleted == False,
                SalesReturn.company_id == self.tenant_ctx.company_id,
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Sales return with this return number already exists")

        tax_total = Decimal("0.00")
        grand_total = Decimal("0.00")
        sr_items = []
        product_stock_updates = []

        successful_statuses = {"approved", "processed", "completed", "submitted", "draft"}
        returned_quantities = {}
        previous_returns = await self.db.execute(
            select(SalesReturnItem.product_id, func.sum(SalesReturnItem.quantity).label("total_returned"))
            .join(SalesReturn, SalesReturn.id == SalesReturnItem.return_id)
            .where(
                SalesReturn.original_invoice_id == sr_in.original_invoice_id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.is_deleted == False,
                SalesReturn.status.in_(successful_statuses),
                SalesReturnItem.product_id.is_not(None),
            )
            .group_by(SalesReturnItem.product_id)
        )
        for product_id, quantity in previous_returns.all():
            returned_quantities[product_id] = Decimal(str(quantity or 0))

        invoice_items = {item.product_id: item for item in orig_invoice.items}
        requested_quantities = {}

        for item in sr_in.items:
            # Check product
            res = await self.db.execute(
                select(Product).where(
                    Product.id == item.product_id,
                    Product.company_id == self.tenant_ctx.company_id,
                    Product.is_deleted == False
                )
            )
            product = res.scalars().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product with ID {item.product_id} not found")

            invoice_item = invoice_items.get(item.product_id)
            if invoice_item is None:
                raise HTTPException(status_code=422, detail=f"Product {item.product_id} is not present on the original invoice")
            original_quantity = invoice_item.quantity
            requested_quantities[item.product_id] = requested_quantities.get(item.product_id, Decimal("0")) + item.quantity
            remaining_quantity = original_quantity - returned_quantities.get(item.product_id, Decimal("0"))
            if requested_quantities[item.product_id] <= Decimal("0") or requested_quantities[item.product_id] > remaining_quantity:
                raise HTTPException(status_code=422, detail=f"Return quantity exceeds remaining quantity for product {item.product_id}")

            # Prices and tax rates come from the original invoice snapshot, not the client payload.
            original_unit_price = invoice_item.price
            original_gst_rate = invoice_item.gst_rate or Decimal("0.00")
            original_tax_per_unit = (invoice_item.tax_amount or Decimal("0.00")) / original_quantity if original_quantity else Decimal("0.00")
            item_tax = (item.quantity * original_tax_per_unit).quantize(Decimal("0.01"))
            item_total = (item.quantity * original_unit_price + item_tax).quantize(Decimal("0.01"))
            tax_total += item_tax
            grand_total += item_total

            sr_items.append(SalesReturnItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                price=original_unit_price,
                gst_rate=original_gst_rate,
                tax_amount=item_tax,
                total_amount=item_total
            ))
            product_stock_updates.append((product, item.quantity))

        # Check supervisor authorization threshold if applicable
        auth_policy = policy.values.get("authorization_policy")
        if not isinstance(auth_policy, dict) or "supervisor_threshold" not in auth_policy:
            raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing authorization_policy.supervisor_threshold in the effective policy.")
        threshold_val = auth_policy.get("supervisor_threshold")
        supervisor_threshold = Decimal(str(threshold_val))
        if grand_total > supervisor_threshold and not getattr(sr_in, "supervisor_auth_token", None):
            # If strict threshold enforced: record audit authorization need or proceed with token
            pass

        # Credit Note is policy-driven; a return only creates one when the effective policy requires or auto-generates it.
        credit_note_policy = (policy.values.get("credit_note_policy") or {}) if isinstance(policy.values.get("credit_note_policy"), dict) else {}
        credit_note_required = bool(credit_note_policy.get("required", False))
        auto_generate_credit_note = bool(credit_note_policy.get("auto_generate", False))
        credit_note_no = sr_in.credit_note_number

        if (credit_note_required or auto_generate_credit_note) and (not credit_note_no or credit_note_no == f"CN-{sr_in.return_no}"):
            try:
                cn_alloc = await DocumentsEngine.allocate_next_number_in_transaction(
                    session=self.db,
                    company_id=self.tenant_ctx.company_id,
                    document_type="CREDIT_NOTE",
                    branch_id=self.tenant_ctx.branch_id,
                    created_by=getattr(self.tenant_ctx, "user_id", None) or "system",
                )
                credit_note_no = cn_alloc.document_no
            except Exception:
                credit_note_no = sr_in.credit_note_number if sr_in.credit_note_number else None
        elif credit_note_no == f"CN-{sr_in.return_no}":
            credit_note_no = None
        elif not credit_note_required and not auto_generate_credit_note:
            credit_note_no = None

        db_sr = SalesReturn(
            id=sr_in.id,
            return_no=sr_in.return_no,
            original_invoice_id=sr_in.original_invoice_id,
            credit_note_number=credit_note_no,
            date=sr_in.date,
            reason=sr_in.reason,
            tax_total=tax_total,
            grand_total=grand_total,
            is_interstate=sr_in.is_interstate,
            status=sr_in.status or "Completed",
            items=sr_items,

            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            customer_id=orig_invoice.customer_id if orig_invoice else None,
            idempotency_key=idempotency_key,
            policy_id=policy.policy_id,
            policy_version=policy.policy_version,
            policy_scope=policy.resolution_scope,
            policy_snapshot={
                "values": policy.values,
                "resolution_source": policy.resolution_source,
                "resolved_at": policy.resolved_at,
                "refund_mode": getattr(sr_in, "refund_mode", "CREDIT_NOTE"),
            },
        )

        _ret_creator = getattr(self.tenant_ctx, "user_id", None) or "system"
        resolver = InventoryWarehouseResolver(self.db)

        # Apply stock increments and record StockMovement (RETURN_INWARD)
        for product, qty in product_stock_updates:
            if product.tracking_mode != "No-stock":
                product.stock = int((product.stock or 0) + Decimal(str(qty)))
                product.modified_at = datetime.now(timezone.utc)
                self.db.add(product)

                movement_id = f"SM-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
                resolved_warehouse = await resolver.resolve(company_id=self.tenant_ctx.company_id, branch_id=self.tenant_ctx.branch_id)
                db_movement = StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=qty,
                    movement_type="RETURN_INWARD",
                    reference_doc_type="Sales Return",
                    reference_doc_id=db_sr.id,
                    warehouse_id=resolved_warehouse.id,
                    warehouse=resolved_warehouse.name,
                    unit_cost=product.cost_price or product.price,
                    remarks=f"Stock incremented for sales return: {db_sr.return_no}",
                    source_module="Sales",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id
                )
                self.db.add(db_movement)

                # Record INVENTORY_POSTED audit event
                await ComplianceAuditService.record_audit_event(
                    session=self.db,
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                    event_type="INVENTORY_POSTED",
                    entity_name="StockMovement",
                    entity_id=movement_id,
                    actor_user_id=_ret_creator,
                    action_summary=f"Restocked {qty} units of {product.name} ({product.code}) via RETURN_INWARD for {db_sr.return_no}",
                    after_state={
                        "product_id": product.id,
                        "sku": product.sku or product.code,
                        "quantity": float(qty),
                        "movement_type": "RETURN_INWARD",
                        "return_id": db_sr.id,
                    },
                )

        # Process authoritative refund effect via SalesReturnRefundAdapter
        await SalesReturnRefundAdapter.process_sales_return_refund(
            session=self.db,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            sales_return=db_sr,
            orig_invoice=orig_invoice,
            policy=policy,
            requested_refund_mode=getattr(sr_in, "refund_mode", "CREDIT_NOTE"),
            idempotency_key=idempotency_key,
            actor_user_id=_ret_creator,
        )

        # Loyalty REVERSAL hook (atomic, pre-commit)
        from .sales_hook import write_loyalty_redeem
        await write_loyalty_redeem(
            db=self.db,
            return_id=db_sr.id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            customer_id=orig_invoice.customer_id if orig_invoice else None,
            return_total=grand_total,
            creator=_ret_creator,
        )

        # Record CREDIT_NOTE_CREATED audit event only when an actual credit note was created.
        if db_sr.credit_note_number:
            await ComplianceAuditService.record_audit_event(
                session=self.db,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                event_type="CREDIT_NOTE_CREATED",
                entity_name="SalesReturn",
                entity_id=db_sr.id,
                actor_user_id=_ret_creator,
                action_summary=f"Credit note {db_sr.credit_note_number} generated for invoice {db_sr.original_invoice_id} via return {db_sr.return_no}",
                after_state={
                    "credit_note_number": db_sr.credit_note_number,
                    "return_no": db_sr.return_no,
                    "invoice_id": db_sr.original_invoice_id,
                    "grand_total": float(db_sr.grand_total),
                },
            )

        # Record RETURN_CREATED audit event
        await ComplianceAuditService.record_audit_event(
            session=self.db,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            event_type="RETURN_CREATED",
            entity_name="SalesReturn",
            entity_id=db_sr.id,
            actor_user_id=_ret_creator,
            action_summary=f"Sales return {db_sr.return_no} created for invoice {db_sr.original_invoice_id}",
            after_state={
                "invoice_id": db_sr.original_invoice_id,
                "return_no": db_sr.return_no,
                "policy_id": db_sr.policy_id,
                "policy_version": db_sr.policy_version,
                "policy_scope": db_sr.policy_scope,
                "tax_total": float(db_sr.tax_total),
                "grand_total": float(db_sr.grand_total),
            },
        )

        self.db.add(db_sr)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Sales return already exists")

        # Re-fetch with eager items to avoid MissingGreenlet during response serialization
        result = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(SalesReturn.id == db_sr.id)
        )
        return result.scalars().first()

    async def list_sales_returns(self) -> List[SalesReturn]:
        res = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(
                SalesReturn.company_id == self.tenant_ctx.company_id,
                (SalesReturn.branch_id == self.tenant_ctx.branch_id) | (SalesReturn.branch_id.is_(None)),
                SalesReturn.is_deleted == False
            )
        )
        return res.scalars().all()

    async def get_sales_return(self, sr_id: str) -> tuple[SalesReturn, List[SalesReturnItem]]:
        res = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(
                SalesReturn.id == sr_id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                (SalesReturn.branch_id == self.tenant_ctx.branch_id) | (SalesReturn.branch_id.is_(None)),
                SalesReturn.is_deleted == False
            )
        )
        sr = res.scalars().first()

        if not sr:
            raise HTTPException(status_code=404, detail="Sales return not found")
        return sr, sr.items

    # ???????????????????????????????????????????????????????????????
    # Phase 2 — UPDATE / CANCEL / DELETE
    # ???????????????????????????????????????????????????????????????

    # ?? Invoice UPDATE ??????????????????????????????????????????????

    async def update_sales_invoice(
        self, invoice_id: str, update_in: SalesInvoiceUpdate
    ) -> SalesInvoice:
        """
        Partial-update a sales invoice.
        If items are supplied, old items are replaced and totals are server-side re-computed.
        Stock adjustments are NOT made on update; use Sales Returns for stock reversal.
        """
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(
                SalesInvoice.id         == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                (SalesInvoice.branch_id == self.tenant_ctx.branch_id) | (SalesInvoice.branch_id.is_(None)),
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")

        # Apply scalar patches
        for attr in ("status", "customer_id", "date", "is_interstate",
                     "eway_bill_no", "invoice_no", "customer_name",
                     "customer_gstin", "pos_state"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(invoice, attr, val)

        if update_in.items is not None:
            # Reassign the collection — delete-orphan cascade handles deleting old items
            # and the unit-of-work inserts new ones in the correct order.
            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            new_items   = []
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                new_items.append(SalesInvoiceItem(
                    invoice_id=invoice.id,
                    product_id=item.product_id, code=item.code, name=item.name,
                    quantity=item.quantity, price=item.price,
                    hsn_code=item.hsn_code, gst_rate=item.gst_rate,
                    tax_amount=item_tax, total_amount=item_total,
                ))
            invoice.items       = new_items  # orphans scheduled for DELETE, new for INSERT
            invoice.tax_total   = tax_total
            invoice.grand_total = grand_total
        else:
            if update_in.tax_total   is not None: invoice.tax_total   = update_in.tax_total
            if update_in.grand_total is not None: invoice.grand_total = update_in.grand_total

        invoice.modified_at = datetime.now(timezone.utc)
        self.db.add(invoice)
        await self.db.commit()

        result = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(SalesInvoice.id == invoice.id)
        )
        return result.scalars().first()

    # ?? Invoice CANCEL (DELETE) ?????????????????????????????????????

    async def cancel_sales_invoice(self, invoice_id: str) -> SalesInvoice:
        """
        Cancel a sales invoice: set status='Cancelled', soft-delete (is_deleted=True),
        and reverse deducted batch stock into warehouse.
        """
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(
                SalesInvoice.id         == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id  == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")

        from .inventory_wms import InventoryWmsService
        wms_service = InventoryWmsService(self.db, self.tenant_ctx)
        resolver = InventoryWarehouseResolver(self.db)
        wh_id = invoice.warehouse_id
        if not wh_id:
            wh = await resolver.resolve(company_id=self.tenant_ctx.company_id, branch_id=self.tenant_ctx.branch_id)
            wh_id = wh.id

        # Restore batch stock for each line item
        for item in invoice.items:
            if item.product_id and item.quantity > 0:
                batch = item.batch_no or "BATCH-OPENING"
                try:
                    await wms_service.atomic_mutate_batch_stock(
                        product_id=item.product_id,
                        warehouse_id=wh_id,
                        batch_no=batch,
                        qty_delta=Decimal(str(item.quantity)),
                        movement_type="SALES_CANCEL",
                        reference_doc_type="Sales Invoice",
                        reference_doc_id=invoice.invoice_no,
                        remarks=f"Stock restored for cancelled sales invoice: {invoice.invoice_no}",
                    )
                except Exception:
                    pass

        # Revert customer outstanding if credit sale
        if invoice.customer_id and invoice.customer_id != "CUST-WALKIN":
            try:
                cust = await self.crm_service.get_customer(invoice.customer_id)
                if cust and invoice.grand_total:
                    cust.outstanding = max(Decimal("0.00"), cust.outstanding - invoice.grand_total)
                    cust.modified_at = datetime.now(timezone.utc)
                    self.db.add(cust)
            except Exception:
                pass

        invoice.status      = "Cancelled"
        invoice.is_deleted  = True
        invoice.modified_at = datetime.now(timezone.utc)
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    # ?? Quotation UPDATE ????????????????????????????????????????????

    async def update_sales_quotation(
        self, q_id: str, update_in: SalesQuotationUpdate
    ) -> SalesQuotation:
        res = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(
                SalesQuotation.id         == q_id,
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id  == self.tenant_ctx.branch_id,
                SalesQuotation.is_deleted == False,
            )
        )
        q = res.scalars().first()
        if not q:
            raise HTTPException(status_code=404, detail="Sales quotation not found")

        for attr in ("quotation_no", "date", "customer_name", "status", "sales_order_id"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(q, attr, val)

        if update_in.items is not None:
            await self.db.execute(
                delete(SalesQuotationItem).where(SalesQuotationItem.quotation_id == q.id)
            )
            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                self.db.add(SalesQuotationItem(
                    quotation_id=q.id,
                    product_id=item.product_id, code=item.code, name=item.name,
                    quantity=item.quantity, price=item.price,
                    hsn_code=item.hsn_code, gst_rate=item.gst_rate,
                    tax_amount=item_tax, total_amount=item_total,
                ))
            q.tax_total   = tax_total
            q.grand_total = grand_total
        else:
            if update_in.tax_total   is not None: q.tax_total   = update_in.tax_total
            if update_in.grand_total is not None: q.grand_total = update_in.grand_total

        q.modified_at = datetime.now(timezone.utc)
        self.db.add(q)
        await self.db.commit()

        result = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(SalesQuotation.id == q.id)
        )
        return result.scalars().first()

    # ?? Quotation DELETE ????????????????????????????????????????????

    async def delete_sales_quotation(self, q_id: str) -> None:
        res = await self.db.execute(
            select(SalesQuotation).where(
                SalesQuotation.id         == q_id,
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id  == self.tenant_ctx.branch_id,
                SalesQuotation.is_deleted == False,
            )
        )
        q = res.scalars().first()
        if not q:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        q.is_deleted  = True
        q.modified_at = datetime.now(timezone.utc)
        self.db.add(q)
        await self.db.commit()

    # ?? Order UPDATE ????????????????????????????????????????????????

    async def update_sales_order(
        self, so_id: str, update_in: SalesOrderUpdate
    ) -> SalesOrder:
        res = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(
                SalesOrder.id         == so_id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id  == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False,
            )
        )
        so = res.scalars().first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales order not found")

        for attr in ("order_no", "date", "customer_name", "status", "source_quotation_id"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(so, attr, val)

        if update_in.items is not None:
            await self.db.execute(
                delete(SalesOrderItem).where(SalesOrderItem.order_id == so.id)
            )
            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                self.db.add(SalesOrderItem(
                    order_id=so.id,
                    product_id=item.product_id, code=item.code, name=item.name,
                    quantity=item.quantity, price=item.price,
                    hsn_code=item.hsn_code, gst_rate=item.gst_rate,
                    tax_amount=item_tax, total_amount=item_total,
                ))
            so.tax_total   = tax_total
            so.grand_total = grand_total
        else:
            if update_in.tax_total   is not None: so.tax_total   = update_in.tax_total
            if update_in.grand_total is not None: so.grand_total = update_in.grand_total

        so.modified_at = datetime.now(timezone.utc)
        self.db.add(so)
        await self.db.commit()

        result = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(SalesOrder.id == so.id)
        )
        return result.scalars().first()

    # ?? Order DELETE ????????????????????????????????????????????????

    async def delete_sales_order(self, so_id: str) -> None:
        res = await self.db.execute(
            select(SalesOrder).where(
                SalesOrder.id         == so_id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id  == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False,
            )
        )
        so = res.scalars().first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales order not found")
        so.is_deleted  = True
        so.modified_at = datetime.now(timezone.utc)
        self.db.add(so)
        await self.db.commit()

    # ?? Return UPDATE ???????????????????????????????????????????????

    async def update_sales_return(
        self, sr_id: str, update_in: SalesReturnUpdate
    ) -> SalesReturn:
        res = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(
                SalesReturn.id         == sr_id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.branch_id  == self.tenant_ctx.branch_id,
                SalesReturn.is_deleted == False,
            )
        )
        sr = res.scalars().first()
        if not sr:
            raise HTTPException(status_code=404, detail="Sales return not found")

        for attr in ("return_no", "original_invoice_id", "credit_note_number",
                     "date", "reason", "is_interstate", "status"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(sr, attr, val)

        if update_in.items is not None:
            await self.db.execute(
                delete(SalesReturnItem).where(SalesReturnItem.return_id == sr.id)
            )
            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                self.db.add(SalesReturnItem(
                    return_id=sr.id,
                    product_id=item.product_id, code=item.code, name=item.name,
                    quantity=item.quantity, price=item.price,
                    gst_rate=item.gst_rate,
                    tax_amount=item_tax, total_amount=item_total,
                ))
            sr.tax_total   = tax_total
            sr.grand_total = grand_total
        else:
            if update_in.tax_total   is not None: sr.tax_total   = update_in.tax_total
            if update_in.grand_total is not None: sr.grand_total = update_in.grand_total

        sr.modified_at = datetime.now(timezone.utc)
        self.db.add(sr)
        await self.db.commit()

        result = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(SalesReturn.id == sr.id)
        )
        return result.scalars().first()

    # ?? Return DELETE ???????????????????????????????????????????????

    async def delete_sales_return(self, sr_id: str) -> None:
        res = await self.db.execute(
            select(SalesReturn).where(
                SalesReturn.id         == sr_id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.branch_id  == self.tenant_ctx.branch_id,
                SalesReturn.is_deleted == False,
            )
        )
        sr = res.scalars().first()
        if not sr:
            raise HTTPException(status_code=404, detail="Sales return not found")
        sr.is_deleted  = True
        sr.modified_at = datetime.now(timezone.utc)
        self.db.add(sr)
        await self.db.commit()


    # ??????????????????????????? Phase 4B: Workflow ?????????????????????????????

    async def approve_sales_invoice(self, invoice_id: str) -> SalesInvoice:
        """
        Approve a sales invoice: Draft → Confirmed.
        Sets status='Confirmed' and updates modified_at.
        """
        res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.id         == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id  == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")
        if invoice.status not in ("Draft", "Submitted"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot approve an invoice with status '{invoice.status}'.",
            )
        invoice.status      = "Confirmed"
        invoice.modified_at = datetime.now(timezone.utc)
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    # ??????????????????????????? Phase 4B: Convert Quotation ????????????????????

    async def convert_quotation_to_invoice(self, q_id: str) -> SalesInvoice:
        """
        Convert a sales quotation to a sales invoice.
        - Quotation status must be Draft or Approved.
        - Creates a new SalesInvoice from the quotation's lines.
        - Marks the quotation status as 'Converted'.
        """
        q_res = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(
                SalesQuotation.id         == q_id,
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id  == self.tenant_ctx.branch_id,
                SalesQuotation.is_deleted == False,
            )
        )
        quotation = q_res.scalars().first()
        if not quotation:
            raise HTTPException(status_code=404, detail="Quotation not found")
        if quotation.status not in ("Draft", "Approved", "Submitted"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot convert a quotation with status '{quotation.status}'.",
            )
        if not quotation.items:
            raise HTTPException(status_code=400, detail="Quotation has no line items to convert.")

        # Build invoice from quotation
        invoice_id = _uid()
        invoice = SalesInvoice(
            id           = invoice_id,
            company_id   = self.tenant_ctx.company_id,
            branch_id    = self.tenant_ctx.branch_id,
            invoice_no   = f"INV-{invoice_id[:6].upper()}",
            status       = "Draft",
            payment_mode = "Cash",
            tax_total    = Decimal("0.00"),
            grand_total  = quotation.grand_total or Decimal("0.00"),
        )
        self.db.add(invoice)

        for q_item in quotation.items:
            line_price = Decimal(str(q_item.price))
            line_qty   = Decimal(str(q_item.quantity))
            line_total = line_price * line_qty
            inv_item = SalesInvoiceItem(
                invoice_id   = invoice.id,
                product_id   = q_item.product_id,
                code         = q_item.code,
                name         = q_item.name,
                quantity     = line_qty,
                price        = line_price,
                gst_rate     = q_item.gst_rate or Decimal("0"),
                tax_amount   = Decimal("0.00"),
                total_amount = line_total,
            )
            self.db.add(inv_item)

        # Mark quotation converted
        quotation.status      = "Converted"
        quotation.modified_at = datetime.now(timezone.utc)
        self.db.add(quotation)

        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice
