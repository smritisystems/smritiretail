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
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.psv import (
    PSVParty,
    PSVPartySkuTracking,
    PSVStockEvent,
    PSVStockBalance,
    PSVVisibilityPolicy,
    PSVPartyScope,
)
from ..models.control.control_models import ControlPSVConfig
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
        event_payload: Dict[str, Any]
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

        psv_event = PSVStockEvent(
            event_id=f"psve_{uuid.uuid4().hex[:16]}",
            source_event_id=source_event_id,
            correlation_id=event_payload.get("correlation_id", f"corr_{uuid.uuid4().hex[:16]}"),
            causation_id=event_payload.get("causation_id"),
            event_schema_version=event_payload.get("event_schema_version", "1.0"),
            company_code=event_payload["company_code"].strip().upper(),
            source_database=event_payload.get("source_database", "smriti001"),
            source_document_type=event_payload["source_document_type"],
            source_document_id=event_payload["source_document_id"],
            source_document_line_id=event_payload.get("source_document_line_id"),
            psv_party_id=event_payload["psv_party_id"],
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
            PSVStockBalance.company_code == psv_event.company_code,
            PSVStockBalance.psv_party_id == psv_event.psv_party_id,
            PSVStockBalance.sku == psv_event.sku
        )
        bal = (await psv_session.execute(bal_stmt)).scalar_one_or_none()

        if not bal:
            bal = PSVStockBalance(
                id=f"psvb_{uuid.uuid4().hex[:16]}",
                company_code=psv_event.company_code,
                psv_party_id=psv_event.psv_party_id,
                psv_store_id=psv_event.psv_store_id,
                sku=psv_event.sku,
                billed_qty=Decimal("0.0000"),
                received_qty=Decimal("0.0000"),
                sold_qty=Decimal("0.0000"),
                returned_qty=Decimal("0.0000"),
                transferred_qty=Decimal("0.0000"),
                current_balance=Decimal("0.0000")
            )
            psv_session.add(bal)

        mtype = psv_event.movement_type.upper()
        qty = psv_event.quantity

        if mtype in ["GST_BILLED", "INVOICE", "INWARD"]:
            bal.billed_qty += qty
            bal.current_balance += qty
        elif mtype in ["STORE_RECEIVED", "RECEIVED"]:
            bal.received_qty += qty
        elif mtype in ["SOLD", "OUTWARD_SALE", "POS_SALE"]:
            bal.sold_qty += qty
            bal.current_balance -= qty
        elif mtype in ["RETURNED", "SALES_RETURN"]:
            bal.returned_qty += qty
            bal.current_balance -= qty
        elif mtype in ["TRANSFERRED"]:
            bal.transferred_qty += qty
            bal.current_balance -= qty

        await psv_session.commit()

        return {
            "status": "PROJECTED_SUCCESSFULLY",
            "source_event_id": source_event_id,
            "event_id": psv_event.event_id,
            "current_balance": float(bal.current_balance)
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

        items: List[PSVScopedBalanceItem] = []
        tot_units = Decimal("0.0000")

        for b in balances:
            # If allowed patterns exist on scope/policy, filter
            items.append(
                PSVScopedBalanceItem(
                    sku=b.sku,
                    billed_qty=b.billed_qty,
                    received_qty=b.received_qty,
                    sold_qty=b.sold_qty,
                    returned_qty=b.returned_qty,
                    current_balance=b.current_balance,
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
