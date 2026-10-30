"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-14
Modified     : 2026-10-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from fastapi import HTTPException
from sqlalchemy import select, or_, func, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.psv import (
    PSVParty,
    PSVStockEvent,
    PSVStockBalance,
    PSVVisibilityPolicy,
    PSVPartyScope,
)
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.crm import Customer, CustomerDeliveryLocation
from ..models.tenant import Company
from ..models.inventory import Product
from ..models.item_master import Item, ItemBarcode, ItemVariant
from ..models.control.control_models import ControlPSVConfig
from .partner_resolver import PartnerIdentifierResolver
from .product_code_parser import ProductCodeParser
from ..schemas.psv import (
    PSVScopedVisibilityResponse,
    PSVScopedBalanceItem,
    PSVVisibilityPolicyCreateReq,
    PSVPartyScopeCreateReq,
    PSVQuantityReconciliationItem,
    PSVQuantityReconciliationSummary,
    PSVQuantityReconciliationResponse,
    PSVReceiveInvoiceReq,
    PSVReceiveInvoiceResp,
)


class PSVProjectionService:
    """
    PSV Optional Visibility Projection Engine in SMRITI Retail OS.
    Processes stock movements into immutable psv_stock_events ledger and psv_stock_balances projection.
    Operates strictly as a non-authoritative shadow visibility layer.
    """

    @classmethod
    async def resolve_or_create_store_psv_party(
        cls,
        session: AsyncSession,
        company_id: str,
        delivery_location_id: str,
        customer_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Idempotently resolve or create a PSV account from a validated delivery_location_id.
        Guarantees:
        1. Validates canonical store (must exist, belong to company_id, status == 'ACTIVE', not deleted).
        2. Validates customer ownership (if customer_id provided, must match location.customer_id).
        3. Looks up existing PSVParty by (company_id, delivery_location_id).
        4. If not found, looks up by (company_id, host_customer_id, store_code).
           If found by (company_id, host_customer_id, store_code), links delivery_location_id.
        5. If still not found, creates a new PSVParty.
        6. Race-condition protection: handles concurrent attempts gracefully without duplicate records.
        7. BOUNDARY: Absolutely zero stock ledger entries are created.
        """
        if not delivery_location_id:
            raise HTTPException(status_code=400, detail="SMRITI-VAL-001: delivery_location_id is required.")

        location = (await session.execute(
            select(CustomerDeliveryLocation).where(
                CustomerDeliveryLocation.id == delivery_location_id
            )
        )).scalar_one_or_none()

        if not location:
            raise HTTPException(status_code=404, detail="SMRITI-VAL-404: Delivery location not found or has been removed.")

        if location.company_id and location.company_id != company_id:
            raise HTTPException(status_code=403, detail="SMRITI-PERM-001: Access denied for delivery location across company tenant boundary.")

        if location.is_deleted or (location.status and location.status.upper() != "ACTIVE"):
            raise HTTPException(status_code=400, detail="SMRITI-VAL-002: Selected delivery location / store is currently inactive or deleted.")

        if customer_id and location.customer_id != customer_id:
            raise HTTPException(status_code=400, detail="SMRITI-PERM-003: Delivery location does not belong to the selected customer.")

        # 1. Direct match on (company_id, delivery_location_id)
        party = (await session.execute(
            select(PSVParty).where(
                PSVParty.company_id == company_id,
                PSVParty.delivery_location_id == location.id,
            )
        )).scalar_one_or_none()

        if party:
            return {
                "psv_party_id": party.id,
                "store_code": party.store_code or location.store_code,
                "delivery_location_id": location.id,
                "host_customer_id": party.host_customer_id or location.customer_id,
                "company_id": company_id,
                "name": party.name,
                "location": party.location,
                "stock_model": party.stock_model,
                "is_newly_created": False,
                "status": party.status,
            }

        # 2. Check match on (company_id, host_customer_id, store_code)
        party = (await session.execute(
            select(PSVParty).where(
                PSVParty.company_id == company_id,
                PSVParty.host_customer_id == location.customer_id,
                PSVParty.store_code == location.store_code,
            )
        )).scalar_one_or_none()

        if party:
            # Link missing delivery_location_id if unlinked
            if not party.delivery_location_id:
                party.delivery_location_id = location.id
            if not party.store_name_snapshot:
                party.store_name_snapshot = location.location_name
            await session.flush()
            return {
                "psv_party_id": party.id,
                "store_code": party.store_code,
                "delivery_location_id": location.id,
                "host_customer_id": party.host_customer_id,
                "company_id": company_id,
                "name": party.name,
                "location": party.location,
                "stock_model": party.stock_model,
                "is_newly_created": False,
                "status": party.status,
            }

        # 3. Create missing account with race-condition protection
        customer = (await session.execute(
            select(Customer).where(Customer.id == location.customer_id)
        )).scalar_one_or_none()

        party_name = customer.name if customer else location.location_name
        loc_desc = f"{location.location_name} — {location.city or ''}, {location.state or ''}".strip(" —,")
        if not loc_desc:
            loc_desc = location.location_name

        is_newly_created = False
        new_party_id = f"psv-{company_id}-{location.id}"[:50]

        try:
            async with session.begin_nested():
                party = PSVParty(
                    id=new_party_id,
                    company_id=company_id,
                    branch_id=branch_id,
                    host_customer_id=location.customer_id,
                    delivery_location_id=location.id,
                    store_code=location.store_code,
                    store_name_snapshot=location.location_name,
                    stock_model="OUTRIGHT_SALE",
                    name=party_name,
                    location=loc_desc,
                    status="Healthy",
                )
                session.add(party)
                await session.flush()
                is_newly_created = True
        except IntegrityError:
            # Another concurrent transaction inserted the party concurrently; query it cleanly
            party = (await session.execute(
                select(PSVParty).where(
                    PSVParty.company_id == company_id,
                    or_(
                        PSVParty.delivery_location_id == location.id,
                        and_(
                            PSVParty.host_customer_id == location.customer_id,
                            PSVParty.store_code == location.store_code,
                        )
                    )
                )
            )).scalar_one()
            is_newly_created = False

        return {
            "psv_party_id": party.id,
            "store_code": party.store_code or location.store_code,
            "delivery_location_id": location.id,
            "host_customer_id": party.host_customer_id or location.customer_id,
            "company_id": company_id,
            "name": party.name,
            "location": party.location,
            "stock_model": party.stock_model,
            "is_newly_created": is_newly_created,
            "status": party.status,
        }

    @classmethod
    async def project_posted_invoice(
        cls,
        session: AsyncSession,
        invoice_id: str,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Project partner-delivery invoice lines into PSV idempotently.

        Invoices without a registered customer delivery location are ordinary
        internal sales and are intentionally ignored by PSV.
        """
        invoice = (await session.execute(
            select(SalesInvoice).where(
                SalesInvoice.id == invoice_id,
                SalesInvoice.company_id == company_id,
            ).options(selectinload(SalesInvoice.items))
        )).scalar_one_or_none()
        if not invoice:
            return {"status": "NOT_FOUND", "invoice_id": invoice_id, "projected": 0}

        party = None
        location = None
        if invoice.delivery_location_id:
            try:
                resolved_party = await cls.resolve_or_create_store_psv_party(
                    session=session,
                    company_id=company_id,
                    delivery_location_id=invoice.delivery_location_id,
                    customer_id=invoice.customer_id,
                    branch_id=branch_id,
                )
                party = (await session.execute(
                    select(PSVParty).where(PSVParty.id == resolved_party["psv_party_id"])
                )).scalar_one_or_none()
            except HTTPException:
                party = None

            location = (await session.execute(select(CustomerDeliveryLocation).where(
                CustomerDeliveryLocation.id == invoice.delivery_location_id,
            ))).scalar_one_or_none()

        if not party and invoice.party_id:
            party = (await session.execute(
                select(PSVParty).where(PSVParty.id == invoice.party_id, PSVParty.company_id == company_id)
            )).scalar_one_or_none()

        if not party and invoice.customer_id:
            p_stmt = select(PSVParty).where(
                PSVParty.company_id == company_id,
                PSVParty.host_customer_id == invoice.customer_id,
            )
            if invoice.delivery_store_code:
                p_stmt = p_stmt.where(PSVParty.store_code == invoice.delivery_store_code)
            party = (await session.execute(p_stmt.limit(1))).scalar_one_or_none()

            if not party:
                customer = (await session.execute(
                    select(Customer).where(Customer.id == invoice.customer_id)
                )).scalar_one_or_none()
                if customer:
                    store_cd = invoice.delivery_store_code or getattr(customer, "code", None) or "STORE"
                    new_party_id = f"psv-{company_id}-{customer.id}-{store_cd}"[:50]
                    party = (await session.execute(
                        select(PSVParty).where(PSVParty.id == new_party_id)
                    )).scalar_one_or_none()
                    if not party:
                        party = PSVParty(
                            id=new_party_id,
                            company_id=company_id,
                            branch_id=branch_id,
                            host_customer_id=customer.id,
                            delivery_location_id=invoice.delivery_location_id,
                            store_code=store_cd,
                            store_name_snapshot=invoice.customer_name or customer.name,
                            stock_model="OUTRIGHT_SALE",
                            name=invoice.customer_name or customer.name,
                            location=getattr(customer, "city", None) or (getattr(customer, "address", None) or "Default")[:255],
                            status="Healthy",
                        )
                        session.add(party)
                        await session.flush()

        if not party:
            return {"status": "SKIPPED_NO_PARTNER_LOCATION", "invoice_id": invoice_id, "projected": 0}

        host_cust_id = location.customer_id if location else (party.host_customer_id or invoice.customer_id)
        loc_id = location.id if location else party.delivery_location_id
        store_code = location.store_code if location else (party.store_code or invoice.delivery_store_code)

        projected = 0
        for line in invoice.items:
            result = await cls.project_psv_stock_event(
                psv_session=session,
                event_payload={
                    "source_event_id": f"PSV-INVOICE-{invoice.id}-{line.id}",
                    "correlation_id": f"SALES-INVOICE-{invoice.id}",
                    "company_id": company_id,
                    "company_code": company_id,
                    "product_id": getattr(line, "product_id", None),
                    "source_document_type": "SALES_INVOICE",
                    "source_document_id": invoice.id,
                    "source_document_line_id": str(line.id),
                    "psv_party_id": party.id,
                    "host_customer_id": host_cust_id,
                    "delivery_location_id": loc_id,
                    "store_code_snapshot": store_code,
                    "invoice_id": invoice.id,
                    "invoice_line_id": str(line.id),
                    "sku": line.code,
                    "movement_type": "BILLED_TO_PARTNER",
                    "quantity": line.quantity,
                    "source_event_created_at": invoice.created_at or datetime.now(timezone.utc),
                    "event_date": invoice.created_at or datetime.now(timezone.utc),
                    "approval_status": "APPROVED",
                },
                commit=False,
            )
            if result.get("status") == "PROJECTED_SUCCESSFULLY":
                projected += 1

        await session.flush()
        return {"status": "PROJECTED", "invoice_id": invoice_id, "party_id": party.id, "projected": projected}

    @classmethod
    async def sync_updated_invoice(
        cls,
        session: AsyncSession,
        invoice_id: str,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Synchronizes PSV projection when a draft or submitted sales invoice is updated.
        Reverses obsolete line items and re-projects current items.
        """
        invoice = (await session.execute(
            select(SalesInvoice).where(
                SalesInvoice.id == invoice_id,
                SalesInvoice.company_id == company_id,
            ).options(selectinload(SalesInvoice.items))
        )).scalar_one_or_none()
        if not invoice:
            return {"status": "NOT_FOUND", "invoice_id": invoice_id}

        existing_evts = (await session.execute(
            select(PSVStockEvent).where(
                PSVStockEvent.company_id == company_id,
                PSVStockEvent.invoice_id == invoice_id,
                PSVStockEvent.movement_type == "BILLED_TO_PARTNER",
            )
        )).scalars().all()

        current_line_ids = {str(item.id) for item in invoice.items}

        for ev in existing_evts:
            if ev.invoice_line_id and str(ev.invoice_line_id) not in current_line_ids:
                bal_stmt = select(PSVStockBalance).where(
                    PSVStockBalance.psv_party_id == ev.psv_party_id,
                    PSVStockBalance.sku == ev.sku,
                    PSVStockBalance.company_id == company_id,
                )
                bal = (await session.execute(bal_stmt)).scalar_one_or_none()
                if bal:
                    bal.billed_qty = max(Decimal("0.0000"), bal.billed_qty - ev.quantity)
                    bal.current_balance = max(Decimal("0.0000"), bal.current_balance - ev.quantity)
                ev.approval_status = "CANCELLED"
                ev.sync_status = "CANCELLED"

        return await cls.project_posted_invoice(
            session=session,
            invoice_id=invoice_id,
            company_id=company_id,
            branch_id=branch_id,
        )

    @classmethod
    async def cancel_posted_invoice(
        cls,
        session: AsyncSession,
        invoice_id: str,
        company_id: str,
    ) -> Dict[str, Any]:
        """
        Reverses PSV projection when a Sales Tax Invoice is cancelled or deleted.
        Deducts billed quantities from PSVStockBalance and marks events as CANCELLED.
        """
        events = (await session.execute(
            select(PSVStockEvent).where(
                PSVStockEvent.company_id == company_id,
                PSVStockEvent.invoice_id == invoice_id,
            )
        )).scalars().all()

        if not events:
            return {"status": "NO_EVENTS_FOUND", "invoice_id": invoice_id}

        affected_parties = set()
        for ev in events:
            if ev.movement_type in ["GST_BILLED", "INVOICE", "INWARD", "BILLED_TO_PARTNER"]:
                bal_stmt = select(PSVStockBalance).where(
                    PSVStockBalance.psv_party_id == ev.psv_party_id,
                    PSVStockBalance.sku == ev.sku,
                    PSVStockBalance.company_id == company_id,
                )
                bal = (await session.execute(bal_stmt)).scalar_one_or_none()
                if bal:
                    bal.billed_qty = max(Decimal("0.0000"), bal.billed_qty - ev.quantity)
                    bal.current_balance = max(Decimal("0.0000"), bal.current_balance - ev.quantity)
                ev.approval_status = "CANCELLED"
                ev.sync_status = "CANCELLED"
                affected_parties.add(ev.psv_party_id)

        for p_id in affected_parties:
            await cls._recompute_party_metrics(session=session, party_id=p_id, company_id=company_id)

        await session.flush()
        return {"status": "CANCELLED_IN_PSV", "invoice_id": invoice_id, "reversed_events": len(events)}

    @classmethod
    async def is_psv_enabled_for_company(
        cls,
        control_session: AsyncSession,
        company_code: str
    ) -> bool:
        """Checks PSV enablement status in SmritiSys Control Database."""
        clean_code = company_code.strip().upper()
        stmt = select(ControlPSVConfig).where(
            ControlPSVConfig.company_code == clean_code
        )
        result = await control_session.execute(stmt)
        config = result.scalar_one_or_none()
        return bool(config and config.psv_enabled)

    @classmethod
    async def create_visibility_policy(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PSVVisibilityPolicyCreateReq,
    ) -> PSVVisibilityPolicy:
        """Creates or updates a PSV visibility policy."""
        stmt = select(PSVVisibilityPolicy).where(
            PSVVisibilityPolicy.company_id == company_id,
            PSVVisibilityPolicy.policy_code == req.policy_code,
            PSVVisibilityPolicy.is_deleted == False,
        )
        pol = (await session.execute(stmt)).scalars().first()
        if not pol:
            pol = PSVVisibilityPolicy(
                id=f"psv_pol_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                policy_code=req.policy_code,
                name=req.name,
                allowed_sku_patterns=req.allowed_sku_patterns,
                max_lookback_days=req.max_lookback_days,
                is_active=True,
                is_deleted=False,
            )
            session.add(pol)
        else:
            pol.name = req.name
            pol.allowed_sku_patterns = req.allowed_sku_patterns
            pol.max_lookback_days = req.max_lookback_days

        await session.commit()
        await session.refresh(pol)
        return pol

    @classmethod
    async def assign_party_scope(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PSVPartyScopeCreateReq,
    ) -> PSVPartyScope:
        """Binds a party to a visibility scope."""
        stmt = select(PSVPartyScope).where(
            PSVPartyScope.company_id == company_id,
            PSVPartyScope.party_id == req.party_id,
            PSVPartyScope.is_deleted == False,
        )
        scope = (await session.execute(stmt)).scalars().first()
        if not scope:
            scope = PSVPartyScope(
                id=f"psv_scp_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                party_id=req.party_id,
                policy_code=req.policy_code,
                allowed_branch_ids=req.allowed_branch_ids,
                allowed_categories=req.allowed_categories,
                is_active=True,
                is_deleted=False,
            )
            session.add(scope)
        else:
            scope.policy_code = req.policy_code
            scope.allowed_branch_ids = req.allowed_branch_ids
            scope.allowed_categories = req.allowed_categories

        await session.commit()
        await session.refresh(scope)
        return scope

    @classmethod
    async def project_psv_stock_event(
        cls,
        psv_session: AsyncSession,
        event_payload: Dict[str, Any],
        commit: bool = True,
    ) -> Dict[str, Any]:
        """
        Idempotently projects stock event into SmritiPSV.
        Enforces strict uniqueness on source_event_id.
        """
        source_event_id = event_payload["source_event_id"]

        # Check idempotency
        existing_stmt = select(PSVStockEvent).where(PSVStockEvent.source_event_id == source_event_id)
        existing = (await psv_session.execute(existing_stmt)).scalar_one_or_none()

        if existing:
            return {
                "status": "SKIPPED_ALREADY_PROJECTED",
                "source_event_id": source_event_id,
                "message": f"Event '{source_event_id}' was already projected into SmritiPSV."
            }

        # 1. Create PSVStockEvent record
        sec_at = event_payload["source_event_created_at"]
        if isinstance(sec_at, str):
            sec_at = datetime.fromisoformat(sec_at)
        
        evt_dt = event_payload.get("event_date", sec_at)
        if isinstance(evt_dt, str):
            evt_dt = datetime.fromisoformat(evt_dt)

        # Extract authoritative company_id and resolve product_id
        company_id = event_payload.get("company_id")
        comp_code = event_payload["company_code"].strip().upper()
        if not company_id:
            c_stmt = select(Company.id).where(or_(Company.id == comp_code, Company.name.ilike(f"%{comp_code}%"))).limit(1)
            company_id = (await psv_session.execute(c_stmt)).scalar_one_or_none() or comp_code

        product_id = event_payload.get("product_id")
        if not product_id and company_id:
            res = await PartnerIdentifierResolver.resolve(
                session=psv_session,
                company_id=company_id,
                external_sku=event_payload["sku"],
                party_id=event_payload.get("psv_party_id"),
            )
            if res.found and res.product_id:
                product_id = res.product_id

        psv_event = PSVStockEvent(
            event_id=f"psve_{uuid.uuid4().hex[:16]}",
            source_event_id=source_event_id,
            correlation_id=event_payload.get("correlation_id", f"corr_{uuid.uuid4().hex[:16]}"),
            causation_id=event_payload.get("causation_id"),
            event_schema_version=event_payload.get("event_schema_version", "1.0"),
            company_id=company_id,
            company_code=comp_code,
            product_id=product_id,
            source_database=event_payload.get("source_database", "smriti001"),
            source_document_type=event_payload["source_document_type"],
            source_document_id=event_payload["source_document_id"],
            source_document_line_id=event_payload.get("source_document_line_id"),
            psv_party_id=event_payload["psv_party_id"],
            host_customer_id=event_payload.get("host_customer_id"),
            delivery_location_id=event_payload.get("delivery_location_id"),
            store_code_snapshot=event_payload.get("store_code_snapshot"),
            invoice_id=event_payload.get("invoice_id"),
            invoice_line_id=event_payload.get("invoice_line_id"),
            staff_placement_id=event_payload.get("staff_placement_id"),
            approval_status=event_payload.get("approval_status", "APPROVED"),
            reported_by=event_payload.get("reported_by"),
            approval_reason=event_payload.get("approval_reason"),
            destination_type=event_payload.get("destination_type", "RETAIL_STORE"),
            destination_id=event_payload.get("destination_id"),
            psv_store_id=event_payload.get("psv_store_id"),
            sku=event_payload["sku"],
            movement_type=event_payload["movement_type"],
            quantity=Decimal(str(event_payload["quantity"])),
            source_event_created_at=sec_at,
            event_date=evt_dt,
            sync_status="PROJECTED"
        )
        psv_session.add(psv_event)

        # 2. Update or Create PSVStockBalance
        bal_stmt = select(PSVStockBalance).where(
            PSVStockBalance.psv_party_id == psv_event.psv_party_id,
            PSVStockBalance.sku == psv_event.sku,
        )
        if company_id:
            bal_stmt = bal_stmt.where(PSVStockBalance.company_id == company_id)
        else:
            bal_stmt = bal_stmt.where(PSVStockBalance.company_code == psv_event.company_code)

        bal = (await psv_session.execute(bal_stmt)).scalar_one_or_none()

        if not bal:
            bal = PSVStockBalance(
                id=f"psvb_{uuid.uuid4().hex[:16]}",
                company_id=company_id,
                company_code=psv_event.company_code,
                product_id=product_id,
                psv_party_id=psv_event.psv_party_id,
                psv_store_id=psv_event.psv_store_id,
                delivery_location_id=psv_event.delivery_location_id,
                store_code_snapshot=psv_event.store_code_snapshot,
                sku=psv_event.sku,
                billed_qty=Decimal("0.0000"),
                received_qty=Decimal("0.0000"),
                sold_qty=Decimal("0.0000"),
                returned_qty=Decimal("0.0000"),
                transferred_qty=Decimal("0.0000"),
                current_balance=Decimal("0.0000"),
                reconciliation_status="AUTO_MATCHED" if product_id else "PENDING_CATALOG_MAPPING",
            )
            psv_session.add(bal)
        else:
            if bal.company_id is None and company_id:
                bal.company_id = company_id
            if bal.product_id is None and product_id:
                bal.product_id = product_id
                bal.reconciliation_status = "AUTO_MATCHED"

        mtype = psv_event.movement_type.upper()
        qty = psv_event.quantity

        # Pending partner reports remain in the immutable event ledger but do
        # not alter the approved projection until reviewed.
        if psv_event.approval_status != "APPROVED":
            if commit:
                await psv_session.commit()
            else:
                await psv_session.flush()
            return {
                "status": "RECORDED_PENDING_APPROVAL",
                "source_event_id": source_event_id,
                "event_id": psv_event.event_id,
                "current_balance": float(bal.current_balance),
            }

        if mtype in ["GST_BILLED", "INVOICE", "INWARD", "BILLED_TO_PARTNER"]:
            bal.billed_qty += qty
            bal.current_balance += qty
        elif mtype in ["STORE_RECEIVED", "RECEIVED", "RECEIVED_AT_STORE"]:
            bal.received_qty += qty
        elif mtype in ["SOLD", "SOLD_THROUGH", "OUTWARD_SALE", "POS_SALE"]:
            bal.sold_qty += qty
            bal.current_balance -= qty
        elif mtype in ["RETURNED", "SALES_RETURN"]:
            # F-02 fix: stock returned to the partner RESTORES their on-hand balance
            # (the partner received the goods back, so current_balance increases)
            bal.returned_qty += qty
            bal.current_balance += qty
        elif mtype in ["TRANSFERRED"]:
            bal.transferred_qty += qty
            bal.current_balance -= qty

        bal.last_reported_at = psv_event.event_date
        if bal.product_id:
            bal.reconciliation_status = "AUTO_MATCHED"
        else:
            bal.reconciliation_status = "PENDING_CATALOG_MAPPING"

        # F-04 + F-07: Recompute live party-level aggregate metrics after every approved event
        await cls._recompute_party_metrics(
            session=psv_session,
            party_id=psv_event.psv_party_id,
            company_id=company_id,
        )

        if commit:
            await psv_session.commit()
        else:
            await psv_session.flush()

        return {
            "status": "PROJECTED_SUCCESSFULLY",
            "source_event_id": source_event_id,
            "event_id": psv_event.event_id,
            "current_balance": float(bal.current_balance)
        }

    @classmethod
    async def _recompute_party_metrics(
        cls,
        session: AsyncSession,
        party_id: str,
        company_id: Optional[str],
    ) -> None:
        """
        F-04 + F-07: Recomputes and persists live aggregate metrics on PSVParty:
          - stock_count   : sum of current_balance across all SKU balances
          - sell_through  : totalSold / totalBilled * 100 (clamped 0-100)
          - weeks_of_cover: current_balance / (avg_daily_sold * 7), 0 if no sales
          - capital_locked: sum(current_balance_sku * product.mrp) joined via Product.sku

        Called after every APPROVED stock event projection. Skipped gracefully on
        errors so that a metric recompute failure never blocks the core projection path.
        """
        try:
            # 1. Aggregate balance totals for this party
            bal_agg_stmt = select(
                func.coalesce(func.sum(PSVStockBalance.current_balance), Decimal("0")).label("total_balance"),
                func.coalesce(func.sum(PSVStockBalance.billed_qty), Decimal("0")).label("total_billed"),
                func.coalesce(func.sum(PSVStockBalance.sold_qty), Decimal("0")).label("total_sold"),
            ).where(PSVStockBalance.psv_party_id == party_id)
            if company_id:
                bal_agg_stmt = bal_agg_stmt.where(PSVStockBalance.company_id == company_id)
            agg = (await session.execute(bal_agg_stmt)).one_or_none()
            if not agg:
                return

            total_balance = agg.total_balance or Decimal("0")
            total_billed  = agg.total_billed  or Decimal("0")
            total_sold    = agg.total_sold    or Decimal("0")

            # sell_through % (F-04)
            if total_billed > 0:
                sell_through = min(
                    Decimal("100.00"),
                    (total_sold / total_billed * 100).quantize(Decimal("0.01")),
                )
            else:
                sell_through = Decimal("0.00")

            # 2. weeks_of_cover (F-04)
            # avg daily sold = total_sold / max(1, distinct event days with sales)
            day_count_stmt = select(
                func.count(
                    func.distinct(func.date_trunc("day", PSVStockEvent.event_date))
                ).label("day_count"),
            ).where(
                PSVStockEvent.psv_party_id == party_id,
                PSVStockEvent.movement_type.in_(
                    ["SOLD", "SOLD_THROUGH", "OUTWARD_SALE", "POS_SALE"]
                ),
                PSVStockEvent.approval_status == "APPROVED",
            )
            day_row = (await session.execute(day_count_stmt)).one_or_none()
            day_count = int(day_row.day_count) if day_row and day_row.day_count else 1
            avg_daily_sold = total_sold / max(1, day_count)
            if avg_daily_sold > 0 and total_balance > 0:
                weeks_of_cover = (total_balance / avg_daily_sold / 7).quantize(Decimal("0.01"))
            else:
                weeks_of_cover = Decimal("0.00")

            # 3. capital_locked via Product.mrp join (F-07)
            sku_bal_stmt = select(
                PSVStockBalance.sku,
                PSVStockBalance.current_balance,
            ).where(
                PSVStockBalance.psv_party_id == party_id,
                PSVStockBalance.current_balance > 0,
            )
            if company_id:
                sku_bal_stmt = sku_bal_stmt.where(PSVStockBalance.company_id == company_id)
            sku_rows = (await session.execute(sku_bal_stmt)).all()

            capital_locked = Decimal("0.00")
            if sku_rows:
                skus = [row.sku for row in sku_rows]
                prod_stmt = select(Product.sku, Product.mrp).where(
                    Product.sku.in_(skus),
                    Product.is_deleted == False,
                )
                prod_rows = (await session.execute(prod_stmt)).all()
                mrp_map: Dict[str, Decimal] = {
                    row.sku: (Decimal(str(row.mrp)) if row.mrp else Decimal("0"))
                    for row in prod_rows
                }
                for row in sku_rows:
                    mrp = mrp_map.get(row.sku, Decimal("0"))
                    capital_locked += Decimal(str(row.current_balance)) * mrp

            # 4. Write all three metrics back to PSVParty
            party_stmt = select(PSVParty).where(PSVParty.id == party_id)
            party = (await session.execute(party_stmt)).scalar_one_or_none()
            if party:
                party.stock_count = int(max(0, float(total_balance)))
                party.sell_through = sell_through
                party.weeks_of_cover = weeks_of_cover
                party.capital_locked = capital_locked.quantize(Decimal("0.01"))

        except Exception as exc:  # noqa: BLE001
            # Metric recompute must never break the core projection path
            import logging
            logging.getLogger(__name__).warning(
                "PSV metric recompute failed for party %s: %s", party_id, exc
            )

    @classmethod
    async def approve_pending_event(
        cls,
        session: AsyncSession,
        event_id: str,
        company_id: str,
        approved_by: str,
    ) -> Dict[str, Any]:
        """
        F-08: Promotes a PENDING PSV stock event to APPROVED and applies its
        deferred balance delta into psv_stock_balances.

        Accepts either event_id (internal PK) or source_event_id (idempotency key).
        Returns a structured status dict consumed by the PATCH router endpoint.
        """
        # Resolve event by internal id or source_event_id
        evt_stmt = select(PSVStockEvent).where(
            (PSVStockEvent.event_id == event_id) | (PSVStockEvent.source_event_id == event_id)
        )
        event = (await session.execute(evt_stmt)).scalar_one_or_none()

        if not event:
            return {"status": "NOT_FOUND", "event_id": event_id}

        if event.approval_status == "APPROVED":
            return {
                "status": "ALREADY_APPROVED",
                "event_id": event.event_id,
                "source_event_id": event.source_event_id,
            }

        # Promote to APPROVED
        event.approval_status = "APPROVED"
        event.reported_by = approved_by
        event.sync_status = "PROJECTED"

        # Apply deferred balance delta (same logic as project_psv_stock_event)
        bal_stmt = select(PSVStockBalance).where(
            PSVStockBalance.psv_party_id == event.psv_party_id,
            PSVStockBalance.sku == event.sku,
        )
        if company_id:
            bal_stmt = bal_stmt.where(PSVStockBalance.company_id == company_id)
        bal = (await session.execute(bal_stmt)).scalar_one_or_none()

        if not bal:
            bal = PSVStockBalance(
                id=f"psvb_{__import__('uuid').uuid4().hex[:16]}",
                company_id=company_id,
                company_code=event.company_code,
                product_id=event.product_id,
                psv_party_id=event.psv_party_id,
                psv_store_id=event.psv_store_id,
                delivery_location_id=event.delivery_location_id,
                store_code_snapshot=event.store_code_snapshot,
                sku=event.sku,
                billed_qty=Decimal("0.0000"),
                received_qty=Decimal("0.0000"),
                sold_qty=Decimal("0.0000"),
                returned_qty=Decimal("0.0000"),
                transferred_qty=Decimal("0.0000"),
                current_balance=Decimal("0.0000"),
                reconciliation_status="PENDING_CATALOG_MAPPING",
            )
            session.add(bal)

        mtype = event.movement_type.upper()
        qty = event.quantity

        if mtype in ["GST_BILLED", "INVOICE", "INWARD", "BILLED_TO_PARTNER"]:
            bal.billed_qty += qty
            bal.current_balance += qty
        elif mtype in ["STORE_RECEIVED", "RECEIVED", "RECEIVED_AT_STORE"]:
            bal.received_qty += qty
        elif mtype in ["SOLD", "SOLD_THROUGH", "OUTWARD_SALE", "POS_SALE"]:
            bal.sold_qty += qty
            bal.current_balance -= qty
        elif mtype in ["RETURNED", "SALES_RETURN"]:
            bal.returned_qty += qty
            bal.current_balance += qty  # F-02 fix: returns restore balance
        elif mtype in ["TRANSFERRED"]:
            bal.transferred_qty += qty
            bal.current_balance -= qty

        bal.last_reported_at = event.event_date
        bal.reconciliation_status = "AUTO_MATCHED" if bal.product_id else "PENDING_CATALOG_MAPPING"

        await cls._recompute_party_metrics(
            session=session,
            party_id=event.psv_party_id,
            company_id=company_id,
        )

        await session.commit()
        return {
            "status": "APPROVED_AND_PROJECTED",
            "event_id": event.event_id,
            "source_event_id": event.source_event_id,
            "psv_party_id": event.psv_party_id,
            "sku": event.sku,
            "movement_type": event.movement_type,
            "quantity": float(qty),
            "current_balance": float(bal.current_balance),
        }

    @classmethod
    async def get_scoped_party_visibility(
        cls,
        session: AsyncSession,
        company_code: str,
        party_id: str,
    ) -> PSVScopedVisibilityResponse:
        """
        Retrieves projected stock visibility strictly scoped to the requesting party.
        Prevents Party A from seeing Party B's balances.
        """
        clean_code = company_code.strip().upper()

        # Check party scope definition
        scope_stmt = select(PSVPartyScope).where(
            PSVPartyScope.party_id == party_id,
            PSVPartyScope.is_active == True,
            PSVPartyScope.is_deleted == False,
        )
        scope = (await session.execute(scope_stmt)).scalars().first()

        # Query PSV balances for this party
        bal_stmt = select(PSVStockBalance).where(
            PSVStockBalance.company_code == clean_code,
            PSVStockBalance.psv_party_id == party_id,
        )
        balances = (await session.execute(bal_stmt)).scalars().all()

        # F-09: Load the visibility policy to get allowed_sku_patterns for this scope
        allowed_patterns: List[str] = []
        if scope and scope.policy_code:
            pol_stmt = select(PSVVisibilityPolicy).where(
                PSVVisibilityPolicy.policy_code == scope.policy_code,
                PSVVisibilityPolicy.is_active == True,
                PSVVisibilityPolicy.is_deleted == False,
            )
            policy = (await session.execute(pol_stmt)).scalars().first()
            if policy and policy.allowed_sku_patterns:
                allowed_patterns = list(policy.allowed_sku_patterns)

        from fnmatch import fnmatch

        def _sku_passes(sku: str) -> bool:
            """Returns True if sku matches any allowed pattern, or if no patterns are defined."""
            if not allowed_patterns:
                return True  # no restriction — all SKUs pass
            return any(fnmatch(sku, pat) for pat in allowed_patterns)

        items: List[PSVScopedBalanceItem] = []
        tot_units = Decimal("0.0000")

        for b in balances:
            # F-09: apply policy-scoped SKU pattern filter
            if not _sku_passes(b.sku):
                continue
            items.append(
                PSVScopedBalanceItem(
                    sku=b.sku,
                    billed_qty=b.billed_qty,
                    received_qty=b.received_qty,
                    sold_qty=b.sold_qty,
                    returned_qty=b.returned_qty,
                    current_balance=b.current_balance,
                    store_code=b.store_code_snapshot,
                    reconciliation_status=b.reconciliation_status,
                    stock_status=("SOLD_OUT" if b.current_balance <= 0 and b.sold_qty > 0 else "IN_STOCK"),
                )
            )
            tot_units += b.current_balance

        return PSVScopedVisibilityResponse(
            party_id=party_id,
            company_code=clean_code,
            is_scoped=True,
            policy_applied=scope.policy_code if scope else "DEFAULT_PARTY_ISOLATED",
            balances=items,
            total_projected_units=tot_units,
            total_skus_tracked=len(items),
        )

    @classmethod
    async def record_invoice_receipt(
        cls,
        session: AsyncSession,
        company_id: str,
        user_id: str,
        user_role: str,
        req: PSVReceiveInvoiceReq,
        commit: bool = True,
    ) -> PSVReceiveInvoiceResp:
        """
        Records physical goods receipt (and optional rejections) against a Sales Tax Invoice.
        
        Guarantees:
        1. Validates invoice exists and belongs to company_id tenant.
        2. Ensures invoice line items are projected into PSV (Document Qty).
        3. Identifies and matches items by invoice_line_id, SKU, or canonical (style, color, size) attributes.
        4. Supports partial receipts, excess receipts, and multiple receiving deliveries.
        5. Managerial approval rule: PENDING by default unless auto_approve requested by MANAGER/ADMIN.
        6. Pending receipts do NOT inflate available stock ledger until approved.
        7. Rejections are tracked with audit reason.
        """
        # 1. Fetch invoice
        inv_stmt = (
            select(SalesInvoice)
            .where(
                SalesInvoice.id == req.invoice_id,
                SalesInvoice.company_id == company_id,
            )
            .options(selectinload(SalesInvoice.items))
        )
        invoice = (await session.execute(inv_stmt)).scalar_one_or_none()
        if not invoice:
            raise HTTPException(status_code=404, detail="SMRITI-VAL-404: Sales Tax Invoice not found.")

        # 2. Ensure invoice is projected into PSV
        await cls.project_posted_invoice(
            session=session,
            invoice_id=invoice.id,
            company_id=company_id,
        )

        # 3. Resolve party
        party_id = req.party_id
        if not party_id:
            # Look for party via delivery location or customer
            if invoice.delivery_location_id:
                party_res = await cls.resolve_or_create_store_psv_party(
                    session=session,
                    company_id=company_id,
                    delivery_location_id=invoice.delivery_location_id,
                    customer_id=invoice.customer_id,
                )
                party_id = party_res.get("psv_party_id")
            elif invoice.party_id:
                party_id = invoice.party_id
            elif invoice.customer_id:
                p = (await session.execute(
                    select(PSVParty.id)
                    .where(
                        PSVParty.company_id == company_id,
                        PSVParty.host_customer_id == invoice.customer_id,
                    )
                    .limit(1)
                )).scalar_one_or_none()
                party_id = p

        if not party_id:
            # Fallback to party from existing stock event for this invoice
            party_id = (await session.execute(
                select(PSVStockEvent.psv_party_id)
                .where(
                    PSVStockEvent.company_id == company_id,
                    PSVStockEvent.invoice_id == invoice.id,
                )
                .limit(1)
            )).scalar_one_or_none()

        if not party_id:
            raise HTTPException(
                status_code=400,
                detail="SMRITI-VAL-002: Unable to resolve PSV party for invoice. Please provide party_id.",
            )

        # 4. Determine approval permission
        clean_role = (user_role or "").strip().upper()
        is_manager = clean_role in ("MANAGER", "ADMIN", "SYSADMIN")
        effective_approval_status = "APPROVED" if (req.auto_approve and is_manager) else "PENDING"

        # 5. Build lookup maps for canonical variant matching on invoice items
        invoice_lines_by_id = {str(item.id): item for item in invoice.items}
        invoice_lines_by_sku = {(item.code or "").strip().upper(): item for item in invoice.items}

        # Load product attributes for invoice items
        prod_ids = [item.product_id for item in invoice.items if item.product_id]
        products_map = {}
        if prod_ids:
            p_rows = (await session.execute(
                select(Product).where(
                    Product.id.in_(prod_ids),
                    Product.company_id == company_id,
                    Product.is_deleted == False,
                )
            )).scalars().all()
            products_map = {p.id: p for p in p_rows}

        item_ids = {line.item_id for line in invoice.items if line.item_id}
        item_ids.update(product.item_id for product in products_map.values() if product.item_id)
        variant_ids = {line.variant_id for line in invoice.items if line.variant_id}
        variant_ids.update(product.item_variant_id for product in products_map.values() if product.item_variant_id)
        barcode_rows = []
        if item_ids or variant_ids:
            barcode_match = []
            if item_ids:
                barcode_match.append(ItemBarcode.item_id.in_(item_ids))
            if variant_ids:
                barcode_match.append(ItemBarcode.variant_id.in_(variant_ids))
            barcode_rows = (await session.execute(
                select(ItemBarcode).where(
                    ItemBarcode.company_id == company_id,
                    ItemBarcode.is_deleted == False,
                    ItemBarcode.retired_at.is_(None),
                    or_(*barcode_match),
                )
            )).scalars().all()
        barcodes_by_item: Dict[str, List[str]] = {}
        barcodes_by_variant: Dict[str, List[str]] = {}
        for barcode_row in barcode_rows:
            if barcode_row.item_id:
                barcodes_by_item.setdefault(barcode_row.item_id, []).append(barcode_row.barcode)
            if barcode_row.variant_id:
                barcodes_by_variant.setdefault(barcode_row.variant_id, []).append(barcode_row.barcode)

        event_ids_created: List[str] = []
        approved_count = 0
        pending_count = 0

        receipt_dt = req.receipt_date or datetime.now(timezone.utc)
        receipt_ref = req.receipt_reference or f"RECEIPT-{invoice.invoice_no}"

        for r_line in req.items:
            matched_item: Optional[SalesInvoiceItem] = None

            # a) Match by line ID
            if r_line.invoice_line_id and str(r_line.invoice_line_id) in invoice_lines_by_id:
                matched_item = invoice_lines_by_id[str(r_line.invoice_line_id)]

            # b) Match by SKU
            if not matched_item and r_line.sku:
                matched_item = invoice_lines_by_sku.get(r_line.sku.strip().upper())

            # c) Match by Article / Style + Color + Size
            if not matched_item and (r_line.style_code or r_line.color or r_line.size):
                req_style = (r_line.style_code or "").strip().upper()
                req_color = (r_line.color or "").strip().upper()
                req_size = (r_line.size or "").strip().upper()
                for item in invoice.items:
                    prod = products_map.get(item.product_id)
                    p_style = ((prod.style_code if prod else None) or "").strip().upper()
                    p_color = ((prod.color if prod else None) or "").strip().upper()
                    p_size = ((prod.size if prod else None) or "").strip().upper()
                    if (not req_style or req_style == p_style) and \
                       (not req_color or req_color == p_color) and \
                       (not req_size or req_size == p_size):
                        matched_item = item
                        break

            line_id_str = str(matched_item.id) if matched_item else (r_line.invoice_line_id or "LINE-GEN")
            line_sku = matched_item.code if matched_item else (r_line.sku or "SKU-UNKNOWN")
            prod_id = matched_item.product_id if matched_item else None
            matched_product = products_map.get(prod_id)

            if r_line.scanned_barcode_counts:
                allowed_barcodes = set()
                if matched_product:
                    allowed_barcodes.add((matched_product.barcode or "").strip().upper())
                    allowed_barcodes.update(
                        str(value).strip().upper()
                        for value in (matched_product.secondary_barcodes or [])
                        if value
                    )
                    if matched_product.item_id:
                        allowed_barcodes.update(
                            value.strip().upper()
                            for value in barcodes_by_item.get(matched_product.item_id, [])
                        )
                    if matched_product.item_variant_id:
                        allowed_barcodes.update(
                            value.strip().upper()
                            for value in barcodes_by_variant.get(matched_product.item_variant_id, [])
                        )
                if matched_item and matched_item.item_id:
                    allowed_barcodes.update(
                        value.strip().upper()
                        for value in barcodes_by_item.get(matched_item.item_id, [])
                    )
                if matched_item and matched_item.variant_id:
                    allowed_barcodes.update(
                        value.strip().upper()
                        for value in barcodes_by_variant.get(matched_item.variant_id, [])
                    )
                allowed_barcodes.discard("")
                supplied_barcodes: Dict[str, int] = {}
                for barcode, count in r_line.scanned_barcode_counts.items():
                    normalized = barcode.strip().upper()
                    supplied_barcodes[normalized] = supplied_barcodes.get(normalized, 0) + count
                unknown_barcodes = sorted(set(supplied_barcodes) - allowed_barcodes)
                if unknown_barcodes:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Scanned barcode does not match invoice item '{line_sku}'.",
                    )
                scanned_qty = Decimal(sum(supplied_barcodes.values()))
                entered_qty = r_line.received_qty + r_line.rejected_qty
                if scanned_qty != entered_qty:
                    raise HTTPException(
                        status_code=400,
                        detail="Scanned barcode count must equal accepted quantity plus rejected quantity.",
                    )

            scan_summary = ""
            if r_line.scanned_barcode_counts:
                scan_summary = "; barcode scans: " + ", ".join(
                    f"{barcode} x {count}"
                    for barcode, count in sorted(supplied_barcodes.items())
                )
            receipt_note = f"Receipt {receipt_ref}"
            if req.remarks:
                receipt_note += f"; remarks: {req.remarks.strip()}"
            receipt_note += scan_summary

            # Handle Received Qty
            if r_line.received_qty > Decimal("0"):
                sec_id = f"RCV-{invoice.id}-{line_id_str}-{uuid.uuid4().hex[:8]}"
                res = await cls.project_psv_stock_event(
                    psv_session=session,
                    event_payload={
                        "source_event_id": sec_id,
                        "correlation_id": f"SALES-INVOICE-{invoice.id}",
                        "company_id": company_id,
                        "company_code": company_id,
                        "product_id": prod_id,
                        "source_document_type": "STORE_RECEIPT",
                        "source_document_id": receipt_ref,
                        "source_document_line_id": line_id_str,
                        "psv_party_id": party_id,
                        "host_customer_id": invoice.customer_id,
                        "delivery_location_id": invoice.delivery_location_id,
                        "store_code_snapshot": invoice.delivery_store_code,
                        "invoice_id": invoice.id,
                        "invoice_line_id": line_id_str,
                        "sku": line_sku,
                        "movement_type": "STORE_RECEIVED",
                        "quantity": r_line.received_qty,
                        "source_event_created_at": receipt_dt,
                        "event_date": receipt_dt,
                        "approval_status": effective_approval_status,
                        "reported_by": user_id,
                        "approval_reason": receipt_note,
                    },
                    commit=False,
                )
                if "event_id" in res:
                    event_ids_created.append(res["event_id"])
                    if effective_approval_status == "APPROVED":
                        approved_count += 1
                    else:
                        pending_count += 1

            # Handle Rejected Qty
            if r_line.rejected_qty > Decimal("0"):
                rej_sec_id = f"REJ-{invoice.id}-{line_id_str}-{uuid.uuid4().hex[:8]}"
                rejection_note = r_line.rejection_reason or "Rejected during receiving inspection"
                if req.receipt_reference:
                    rejection_note = f"{rejection_note}; receipt: {req.receipt_reference.strip()}"
                if req.remarks:
                    rejection_note = f"{rejection_note}; remarks: {req.remarks.strip()}"
                res_rej = await cls.project_psv_stock_event(
                    psv_session=session,
                    event_payload={
                        "source_event_id": rej_sec_id,
                        "correlation_id": f"SALES-INVOICE-{invoice.id}",
                        "company_id": company_id,
                        "company_code": company_id,
                        "product_id": prod_id,
                        "source_document_type": "STORE_RECEIPT_REJECTION",
                        "source_document_id": receipt_ref,
                        "source_document_line_id": line_id_str,
                        "psv_party_id": party_id,
                        "host_customer_id": invoice.customer_id,
                        "delivery_location_id": invoice.delivery_location_id,
                        "store_code_snapshot": invoice.delivery_store_code,
                        "invoice_id": invoice.id,
                        "invoice_line_id": line_id_str,
                        "sku": line_sku,
                        "movement_type": "REJECTED",
                        "quantity": r_line.rejected_qty,
                        "source_event_created_at": receipt_dt,
                        "event_date": receipt_dt,
                        "approval_status": "APPROVED",
                        "reported_by": user_id,
                        "approval_reason": f"{rejection_note}{scan_summary}",
                    },
                    commit=False,
                )
                if "event_id" in res_rej:
                    event_ids_created.append(res_rej["event_id"])

        if commit:
            await session.commit()
        else:
            await session.flush()

        return PSVReceiveInvoiceResp(
            status="RECORDED",
            invoice_id=invoice.id,
            party_id=party_id,
            events_created=len(event_ids_created),
            approved_count=approved_count,
            pending_count=pending_count,
            event_ids=event_ids_created,
        )

    @classmethod
    async def get_quantity_reconciliation(
        cls,
        session: AsyncSession,
        company_id: str,
        party_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        store_code: Optional[str] = None,
        start_date: Optional[Any] = None,
        end_date: Optional[Any] = None,
        invoice_id: Optional[str] = None,
        invoice_no: Optional[str] = None,
        style_code: Optional[str] = None,
        color: Optional[str] = None,
        size: Optional[str] = None,
        approval_status: Optional[str] = None,
        reconciliation_status: Optional[str] = None,
        has_discrepancy: Optional[bool] = None,
        limit: int = 200,
        offset: int = 0,
    ) -> PSVQuantityReconciliationResponse:
        """
        Authoritative Quantity Reconciliation between Sales Tax Invoices, physical receiving records,
        pending approvals, and stock ledger.
        
        Calculates for each item:
          - Document Qty: Quantity recorded on the Sales Tax Invoice.
          - Received Qty: Physically received quantity (Approved + Pending).
          - Pending Approval Qty: Received quantity awaiting managerial review.
          - Approved Qty: Accepted and approved quantity.
          - Short Qty: max(0, Document Qty - Received Qty).
          - Excess Qty: max(0, Received Qty - Document Qty).
          - Rejected Qty: Quantity rejected during physical receiving inspection.
        
        Item identification prioritizes canonical Article/Style Code, Color, and Size
        in addition to SKU/barcode matching.
        """
        # 1. Base query for active sales invoices for this company
        inv_stmt = select(SalesInvoice).where(
            SalesInvoice.company_id == company_id,
            SalesInvoice.status != "Cancelled",
        )

        if customer_id and customer_id.lower() not in {"all", "all customers", "null", ""}:
            clean_cid = customer_id.strip()
            inv_stmt = inv_stmt.where(
                or_(
                    SalesInvoice.customer_id == clean_cid,
                    SalesInvoice.customer_id.in_(
                        select(Customer.id).where(
                            Customer.company_id == company_id,
                            or_(Customer.id == clean_cid, Customer.code == clean_cid)
                        )
                    )
                )
            )

        if store_code and store_code.lower() not in {"all", "all stores", "all locations", "null", ""}:
            clean_store = store_code.strip()
            inv_stmt = inv_stmt.where(
                or_(
                    SalesInvoice.delivery_store_code == clean_store,
                    SalesInvoice.delivery_location_id.in_(
                        select(CustomerDeliveryLocation.id).where(
                            CustomerDeliveryLocation.company_id == company_id,
                            CustomerDeliveryLocation.store_code == clean_store,
                        )
                    )
                )
            )

        if start_date:
            try:
                s_dt = datetime.fromisoformat(str(start_date).split("T")[0]).date() if isinstance(start_date, str) else start_date
                inv_stmt = inv_stmt.where(SalesInvoice.date >= s_dt)
            except Exception:
                pass

        if end_date:
            try:
                e_dt = datetime.fromisoformat(str(end_date).split("T")[0]).date() if isinstance(end_date, str) else end_date
                inv_stmt = inv_stmt.where(SalesInvoice.date <= e_dt)
            except Exception:
                pass

        if invoice_id:
            inv_stmt = inv_stmt.where(SalesInvoice.id == invoice_id)

        if invoice_no:
            inv_stmt = inv_stmt.where(SalesInvoice.invoice_no.ilike(f"%{invoice_no.strip()}%"))

        if party_id:
            party = (await session.execute(
                select(PSVParty).where(PSVParty.id == party_id, PSVParty.company_id == company_id)
            )).scalar_one_or_none()
            if party:
                conds = [SalesInvoice.party_id == party_id]
                if party.delivery_location_id:
                    conds.append(SalesInvoice.delivery_location_id == party.delivery_location_id)
                if party.host_customer_id and party.store_code:
                    conds.append(and_(
                        SalesInvoice.customer_id == party.host_customer_id,
                        SalesInvoice.delivery_store_code == party.store_code,
                    ))
                elif party.host_customer_id:
                    conds.append(SalesInvoice.customer_id == party.host_customer_id)
                # Invoices linked via stock events
                evt_subq = select(PSVStockEvent.invoice_id).where(
                    PSVStockEvent.company_id == company_id,
                    PSVStockEvent.psv_party_id == party_id,
                    PSVStockEvent.invoice_id.isnot(None),
                )
                conds.append(SalesInvoice.id.in_(evt_subq))
                inv_stmt = inv_stmt.where(or_(*conds))
            else:
                inv_stmt = inv_stmt.where(SalesInvoice.party_id == party_id)

        inv_stmt = inv_stmt.options(selectinload(SalesInvoice.items)).order_by(
            SalesInvoice.date.desc(),
            SalesInvoice.id.desc(),
        )
        invoices = (await session.execute(inv_stmt)).scalars().all()

        if not invoices:
            return PSVQuantityReconciliationResponse(
                summary=PSVQuantityReconciliationSummary(),
                items=[],
            )

        inv_ids = [inv.id for inv in invoices]

        # 2. Load all PSV Parties for party name / store code resolution
        parties = (await session.execute(
            select(PSVParty).where(PSVParty.company_id == company_id)
        )).scalars().all()
        party_by_loc = {p.delivery_location_id: p for p in parties if p.delivery_location_id}
        party_by_cust_store = {(p.host_customer_id, p.store_code): p for p in parties if p.host_customer_id and p.store_code}
        party_by_id = {p.id: p for p in parties}
        party_by_cust = {p.host_customer_id: p for p in parties if p.host_customer_id}

        # 3. Load all PSVStockEvent records linked to these invoices
        events = (await session.execute(
            select(PSVStockEvent).where(
                PSVStockEvent.company_id == company_id,
                PSVStockEvent.invoice_id.in_(inv_ids),
            )
        )).scalars().all()

        from collections import defaultdict
        events_by_inv_line = defaultdict(list)
        events_by_inv_sku = defaultdict(list)
        events_by_inv_prod = defaultdict(list)

        for ev in events:
            if ev.invoice_line_id:
                events_by_inv_line[(ev.invoice_id, str(ev.invoice_line_id))].append(ev)
            if ev.sku:
                events_by_inv_sku[(ev.invoice_id, ev.sku.strip().upper())].append(ev)
            if ev.product_id:
                events_by_inv_prod[(ev.invoice_id, ev.product_id)].append(ev)

        # 4. Batch load Products, Items, and ItemVariants for catalog attribute resolution
        all_items = [line for inv in invoices for line in inv.items]
        prod_ids = list({line.product_id for line in all_items if line.product_id})
        item_ids = list({line.item_id for line in all_items if line.item_id})
        var_ids = list({line.variant_id for line in all_items if line.variant_id})

        products_map: Dict[str, Product] = {}
        if prod_ids:
            p_rows = (await session.execute(
                select(Product).where(
                    Product.id.in_(prod_ids),
                    Product.company_id == company_id,
                    Product.is_deleted == False,
                )
            )).scalars().all()
            products_map = {p.id: p for p in p_rows}

        items_map: Dict[str, Item] = {}
        if item_ids:
            i_rows = (await session.execute(select(Item).where(Item.id.in_(item_ids)))).scalars().all()
            items_map = {i.id: i for i in i_rows}

        variants_map: Dict[str, ItemVariant] = {}
        if var_ids:
            v_rows = (await session.execute(select(ItemVariant).where(ItemVariant.id.in_(var_ids)))).scalars().all()
            variants_map = {v.id: v for v in v_rows}

        catalog_item_ids = {line.item_id for line in all_items if line.item_id}
        catalog_item_ids.update(product.item_id for product in products_map.values() if product.item_id)
        catalog_variant_ids = {line.variant_id for line in all_items if line.variant_id}
        catalog_variant_ids.update(product.item_variant_id for product in products_map.values() if product.item_variant_id)
        barcode_rows = []
        if catalog_item_ids or catalog_variant_ids:
            barcode_match = []
            if catalog_item_ids:
                barcode_match.append(ItemBarcode.item_id.in_(catalog_item_ids))
            if catalog_variant_ids:
                barcode_match.append(ItemBarcode.variant_id.in_(catalog_variant_ids))
            barcode_rows = (await session.execute(
                select(ItemBarcode).where(
                    ItemBarcode.company_id == company_id,
                    ItemBarcode.is_deleted == False,
                    ItemBarcode.retired_at.is_(None),
                    or_(*barcode_match),
                )
            )).scalars().all()
        barcodes_by_item: Dict[str, List[str]] = {}
        barcodes_by_variant: Dict[str, List[str]] = {}
        for barcode_row in barcode_rows:
            if barcode_row.item_id:
                barcodes_by_item.setdefault(barcode_row.item_id, []).append(barcode_row.barcode)
            if barcode_row.variant_id:
                barcodes_by_variant.setdefault(barcode_row.variant_id, []).append(barcode_row.barcode)

        # 5. Process each invoice item and compute quantity reconciliation
        all_reconciled_items: List[PSVQuantityReconciliationItem] = []

        total_doc_qty = Decimal("0.0000")
        total_rec_qty = Decimal("0.0000")
        total_pen_qty = Decimal("0.0000")
        total_app_qty = Decimal("0.0000")
        total_short_qty = Decimal("0.0000")
        total_excess_qty = Decimal("0.0000")
        total_rej_qty = Decimal("0.0000")
        reconciled_cnt = 0
        discrepancy_cnt = 0
        pending_cnt = 0

        clean_filter_style = style_code.strip().upper() if style_code else None
        clean_filter_color = color.strip().upper() if color else None
        clean_filter_size = size.strip().upper() if size else None
        clean_filter_app_status = approval_status.strip().upper() if approval_status else None
        clean_filter_rec_status = reconciliation_status.strip().upper() if reconciliation_status else None
        product_parser = ProductCodeParser()

        for inv in invoices:
            party = (
                party_by_id.get(inv.party_id)
                or party_by_loc.get(inv.delivery_location_id)
                or party_by_cust_store.get((inv.customer_id, inv.delivery_store_code))
                or party_by_cust.get(inv.customer_id)
            )
            p_id = party.id if party else (inv.party_id or f"unassigned-{inv.customer_id or 'unknown'}")
            p_name = party.name if party else (inv.customer_name or "Unknown Party")
            s_code = party.store_code if party else (inv.delivery_store_code or None)
            d_loc_id = party.delivery_location_id if party else inv.delivery_location_id

            for line in inv.items:
                doc_qty = Decimal(str(line.quantity or 0))

                # Resolve catalog attributes
                prod = products_map.get(line.product_id)
                itm = items_map.get(line.item_id) or (items_map.get(prod.item_id) if prod and prod.item_id else None)
                var = variants_map.get(line.variant_id) or (variants_map.get(prod.item_variant_id) if prod and prod.item_variant_id else None)

                # Attribute-Based Product Code Parsing (e.g. SND-06-G-BLUE-41)
                parsed_code = product_parser.parse(line.code) if line.code else None

                i_style = prod.style_code if prod and prod.style_code else (itm.style_code if itm and itm.style_code else (parsed_code.article_code if parsed_code else None))
                i_vendor = getattr(prod, "vendor_code", None) or (parsed_code.vendor_code if parsed_code else None)
                i_color = prod.color if prod and prod.color else (var.color if var and var.color else (parsed_code.color_normalized or parsed_code.color if parsed_code else None))
                i_size = prod.size if prod and prod.size else (var.size if var and var.size else (parsed_code.size_normalized or parsed_code.size if parsed_code else None))
                i_mrp = prod.mrp if prod and prod.mrp is not None else getattr(line, "mrp", None)
                i_price = Decimal(str(line.price or 0)) if line.price is not None else None
                item_id = line.item_id or (prod.item_id if prod else None)
                variant_id = line.variant_id or (prod.item_variant_id if prod else None)
                line_barcodes = set()
                if prod:
                    if prod.barcode:
                        line_barcodes.add(prod.barcode.strip())
                    line_barcodes.update(
                        str(value).strip()
                        for value in (prod.secondary_barcodes or [])
                        if value
                    )
                if item_id:
                    line_barcodes.update(
                        value.strip() for value in barcodes_by_item.get(item_id, []) if value
                    )
                if variant_id:
                    line_barcodes.update(
                        value.strip() for value in barcodes_by_variant.get(variant_id, []) if value
                    )

                # Match receiving and rejection events
                matched_events: List[PSVStockEvent] = []
                line_str_id = str(line.id)

                # 1. Direct line match
                if (inv.id, line_str_id) in events_by_inv_line:
                    matched_events.extend(events_by_inv_line[(inv.id, line_str_id)])

                # 2. SKU match (fallback if line id not stamped on event)
                line_sku_clean = (line.code or "").strip().upper()
                if (inv.id, line_sku_clean) in events_by_inv_sku:
                    for ev in events_by_inv_sku[(inv.id, line_sku_clean)]:
                        if ev not in matched_events and not ev.invoice_line_id:
                            matched_events.append(ev)

                # 3. Product ID match (fallback)
                if line.product_id and (inv.id, line.product_id) in events_by_inv_prod:
                    for ev in events_by_inv_prod[(inv.id, line.product_id)]:
                        if ev not in matched_events and not ev.invoice_line_id:
                            matched_events.append(ev)

                # 4. Attribute-based match fallback (Article + Vendor + Color + Size)
                if not matched_events:
                    line_dict = {
                        "code": line.code,
                        "style_code": i_style,
                        "color": i_color,
                        "size": i_size,
                    }
                    for ev in events:
                        if ev.invoice_id == inv.id and not ev.invoice_line_id and ev not in matched_events:
                            ev_dict = {"code": ev.sku}
                            if product_parser.match_attributes(line_dict, ev_dict):
                                matched_events.append(ev)

                # Aggregate quantities
                app_qty = Decimal("0.0000")
                pen_qty = Decimal("0.0000")
                rej_qty = Decimal("0.0000")
                pen_ids: List[str] = []

                for ev in matched_events:
                    mtype = ev.movement_type.upper()
                    eqty = Decimal(str(ev.quantity or 0))
                    if mtype in ("STORE_RECEIVED", "RECEIVED", "RECEIVED_AT_STORE"):
                        if ev.approval_status == "APPROVED":
                            app_qty += eqty
                        else:
                            pen_qty += eqty
                            pen_ids.append(ev.event_id)
                    elif mtype in ("REJECTED", "STORE_REJECTED"):
                        rej_qty += eqty

                rec_qty = app_qty + pen_qty
                s_qty = max(Decimal("0.0000"), doc_qty - rec_qty)
                e_qty = max(Decimal("0.0000"), rec_qty - doc_qty)

                # Determine reconciliation and workflow status
                if rec_qty == Decimal("0.0000"):
                    r_status = "READY_FOR_RECEIVING"
                    w_status = "Ready for Receiving"
                elif pen_qty > Decimal("0.0000"):
                    r_status = "PENDING_APPROVAL"
                    w_status = "Pending Approval"
                elif s_qty > Decimal("0.0000"):
                    r_status = "SHORTAGE"
                    w_status = "Discrepancy: Shortage"
                elif e_qty > Decimal("0.0000"):
                    r_status = "EXCESS"
                    w_status = "Discrepancy: Excess"
                elif rej_qty > Decimal("0.0000"):
                    r_status = "HAS_REJECTIONS"
                    w_status = "Has Rejections"
                else:
                    r_status = "RECONCILED"
                    w_status = "Reconciled"

                # Filters evaluation
                if clean_filter_style and (i_style or "").strip().upper() != clean_filter_style:
                    continue
                if clean_filter_color and (i_color or "").strip().upper() != clean_filter_color:
                    continue
                if clean_filter_size and (i_size or "").strip().upper() != clean_filter_size:
                    continue
                if clean_filter_rec_status:
                    if clean_filter_rec_status in ("UNRECEIVED", "READY_FOR_RECEIVING"):
                        if r_status not in ("UNRECEIVED", "READY_FOR_RECEIVING"):
                            continue
                    elif r_status.upper() != clean_filter_rec_status:
                        continue
                if clean_filter_app_status == "PENDING" and pen_qty <= Decimal("0.0000"):
                    continue
                if clean_filter_app_status == "APPROVED" and (app_qty <= Decimal("0.0000") or pen_qty > Decimal("0.0000")):
                    continue
                if has_discrepancy is True and not (s_qty > Decimal("0") or e_qty > Decimal("0") or rej_qty > Decimal("0") or pen_qty > Decimal("0")):
                    continue
                if has_discrepancy is False and (s_qty > Decimal("0") or e_qty > Decimal("0") or rej_qty > Decimal("0") or pen_qty > Decimal("0")):
                    continue

                # Accumulate summary stats
                total_doc_qty += doc_qty
                total_rec_qty += rec_qty
                total_pen_qty += pen_qty
                total_app_qty += app_qty
                total_short_qty += s_qty
                total_excess_qty += e_qty
                total_rej_qty += rej_qty

                if r_status == "RECONCILED":
                    reconciled_cnt += 1
                if s_qty > Decimal("0") or e_qty > Decimal("0") or rej_qty > Decimal("0"):
                    discrepancy_cnt += 1
                if pen_qty > Decimal("0"):
                    pending_cnt += 1

                inv_date_str = inv.date.isoformat() if inv.date else None
                recon_item = PSVQuantityReconciliationItem(
                    invoice_id=inv.id,
                    invoice_no=inv.invoice_no,
                    invoice_date=inv_date_str,
                    party_id=p_id,
                    party_name=p_name,
                    store_code=s_code,
                    delivery_location_id=d_loc_id,
                    invoice_line_id=line_str_id,
                    sku=line.code,
                    barcodes=sorted(line_barcodes),
                    product_name=line.name or (prod.name if prod else line.code),
                    style_code=i_style,
                    vendor_code=i_vendor,
                    color=i_color,
                    size=i_size,
                    mrp=Decimal(str(i_mrp)) if i_mrp is not None else None,
                    unit_price=i_price,
                    document_qty=doc_qty,
                    received_qty=rec_qty,
                    pending_approval_qty=pen_qty,
                    approved_qty=app_qty,
                    short_qty=s_qty,
                    excess_qty=e_qty,
                    rejected_qty=rej_qty,
                    reconciliation_status=r_status,
                    workflow_status=w_status,
                    events_count=len([e for e in matched_events if e.movement_type.upper() not in ("BILLED_TO_PARTNER", "INVOICE", "GST_BILLED")]),
                    pending_event_ids=pen_ids,
                )
                all_reconciled_items.append(recon_item)

        summary = PSVQuantityReconciliationSummary(
            total_items=len(all_reconciled_items),
            total_document_qty=total_doc_qty,
            total_received_qty=total_rec_qty,
            total_pending_approval_qty=total_pen_qty,
            total_approved_qty=total_app_qty,
            total_short_qty=total_short_qty,
            total_excess_qty=total_excess_qty,
            total_rejected_qty=total_rej_qty,
            reconciled_count=reconciled_cnt,
            discrepancy_count=discrepancy_cnt,
            pending_approval_count=pending_cnt,
        )

        paged_items = all_reconciled_items[offset : offset + limit]

        return PSVQuantityReconciliationResponse(
            summary=summary,
            items=paged_items,
        )
