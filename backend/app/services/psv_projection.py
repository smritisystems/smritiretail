"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-14
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.psv import (
    PSVParty,
    PSVStockEvent,
    PSVStockBalance,
    PSVVisibilityPolicy,
    PSVPartyScope,
)
from ..models.sales import SalesInvoice
from ..models.crm import Customer, CustomerDeliveryLocation
from ..models.tenant import Company
from ..models.inventory import Product
from ..models.control.control_models import ControlPSVConfig
from .partner_resolver import PartnerIdentifierResolver
from ..schemas.psv import (
    PSVScopedVisibilityResponse,
    PSVScopedBalanceItem,
    PSVVisibilityPolicyCreateReq,
    PSVPartyScopeCreateReq,
)


class PSVProjectionService:
    """
    PSV Optional Visibility Projection Engine in SMRITI Retail OS.
    Processes stock movements into immutable psv_stock_events ledger and psv_stock_balances projection.
    Operates strictly as a non-authoritative shadow visibility layer.
    """

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
        if not invoice or not invoice.delivery_location_id or not invoice.delivery_store_code:
            return {"status": "SKIPPED_NO_PARTNER_LOCATION", "invoice_id": invoice_id, "projected": 0}

        location = (await session.execute(select(CustomerDeliveryLocation).where(
            CustomerDeliveryLocation.id == invoice.delivery_location_id,
            CustomerDeliveryLocation.company_id == company_id,
            CustomerDeliveryLocation.status == "ACTIVE",
            CustomerDeliveryLocation.is_deleted == False,
        ))).scalar_one_or_none()
        if not location:
            return {"status": "SKIPPED_UNKNOWN_PARTNER_LOCATION", "invoice_id": invoice_id, "projected": 0}

        party = (await session.execute(select(PSVParty).where(
            PSVParty.company_id == company_id,
            PSVParty.delivery_location_id == location.id,
        ))).scalar_one_or_none()
        if not party:
            customer = (await session.execute(select(Customer).where(Customer.id == location.customer_id))).scalar_one_or_none()
            party = PSVParty(
                id=f"psv-{company_id}-{location.id}"[:50],
                company_id=company_id,
                branch_id=branch_id,
                host_customer_id=location.customer_id,
                delivery_location_id=location.id,
                store_code=location.store_code,
                store_name_snapshot=location.location_name,
                stock_model="OUTRIGHT_SALE",
                name=customer.name if customer else location.location_name,
                location=location.location_name,
                status="Healthy",
            )
            session.add(party)
            await session.flush()

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
                    "host_customer_id": location.customer_id,
                    "delivery_location_id": location.id,
                    "store_code_snapshot": location.store_code,
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
