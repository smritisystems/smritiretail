"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.psv import PSVStockEvent, PSVStockBalance
from ..models.control.control_models import ControlPSVConfig


class PSVProjectionService:
    """
    PSV Optional Visibility Projection Engine in SmritiPSV.
    Processes stock movements into immutable psv_stock_events ledger and psv_stock_balances projection.
    Zero activity occurs when PSV is disabled for a company.
    """

    @classmethod
    async def is_psv_enabled_for_company(
        cls,
        control_session: AsyncSession,
        company_code: str
    ) -> bool:
        """
        Checks PSV enablement status in SmritiSys Control Database.
        If PSV Enabled: NO, returns False.
        """
        clean_code = company_code.strip().upper()
        stmt = select(ControlPSVConfig).where(
            ControlPSVConfig.company_code == clean_code
        )
        result = await control_session.execute(stmt)
        config = result.scalar_one_or_none()
        return bool(config and config.psv_enabled)

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
        psv_event = PSVStockEvent(
            event_id=f"psve_{uuid.uuid4().hex[:16]}",
            source_event_id=source_event_id,
            correlation_id=event_payload.get("correlation_id", f"corr_{uuid.uuid4().hex[:16]}"),
            causation_id=event_payload.get("causation_id"),
            event_schema_version=event_payload.get("event_schema_version", "1.0"),
            company_code=event_payload["company_code"].strip().upper(),
            source_database=event_payload.get("source_database", "Smritibus"),
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
            source_event_created_at=datetime.fromisoformat(event_payload["source_event_created_at"]),
            event_date=datetime.fromisoformat(event_payload.get("event_date", event_payload["source_event_created_at"])),
            sync_status="PROJECTED",
            created_at=datetime.now(timezone.utc)
        )
        psv_session.add(psv_event)

        # 2. Update PSVStockBalance projection
        company_code = event_payload["company_code"].strip().upper()
        psv_party_id = event_payload["psv_party_id"]
        sku = event_payload["sku"]
        qty = Decimal(str(event_payload["quantity"]))
        mv_type = event_payload["movement_type"]

        bal_stmt = select(PSVStockBalance).where(
            PSVStockBalance.company_code == company_code,
            PSVStockBalance.psv_party_id == psv_party_id,
            PSVStockBalance.sku == sku
        )
        balance = (await psv_session.execute(bal_stmt)).scalar_one_or_none()

        if not balance:
            balance = PSVStockBalance(
                id=f"psvb_{uuid.uuid4().hex[:16]}",
                company_code=company_code,
                psv_party_id=psv_party_id,
                psv_store_id=event_payload.get("psv_store_id"),
                sku=sku,
                billed_qty=Decimal("0.0000"),
                received_qty=Decimal("0.0000"),
                sold_qty=Decimal("0.0000"),
                returned_qty=Decimal("0.0000"),
                transferred_qty=Decimal("0.0000"),
                current_balance=Decimal("0.0000"),
                last_event_id=psv_event.event_id,
                last_updated_at=datetime.now(timezone.utc)
            )
            psv_session.add(balance)

        if mv_type == "GST_BILLED":
            balance.billed_qty += qty
            balance.current_balance += qty
        elif mv_type in ["STORE_RECEIVED", "RECEIVED"]:
            balance.received_qty += qty
        elif mv_type == "SOLD":
            balance.sold_qty += qty
            balance.current_balance -= qty
        elif mv_type == "RETURNED":
            balance.returned_qty += qty
            balance.current_balance += qty

        balance.last_event_id = psv_event.event_id
        balance.last_updated_at = datetime.now(timezone.utc)

        await psv_session.commit()
        return {
            "status": "PROJECTED",
            "event_id": psv_event.event_id,
            "source_event_id": source_event_id,
            "current_balance": str(balance.current_balance)
        }
