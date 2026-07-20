"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.auth import User
from app.services.communicator_service import SMRITICommunicatorService

router = APIRouter(prefix="/communicator", tags=["SMRITI Communicator Sync Gateway"])


@router.post(
    "/tally/export",
    summary="Generate TallyPrime XML Export Payload",
    description="Generates standard TallyPrime XML VOUCHER import payload for Sales, Purchase, or Journal Vouchers."
)
async def export_tally_voucher(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    vtype = payload.get("voucher_type", "Sales")
    vnum = payload.get("voucher_number", "INV-40-001")
    vdate = payload.get("date_str", "20260720")
    party = payload.get("party_name", "Cash Customer")
    amt = float(payload.get("amount", 1000.0))

    svc = SMRITICommunicatorService()
    xml_content = await svc.generate_tally_xml_payload(
        voucher_type=vtype,
        voucher_number=vnum,
        date_str=vdate,
        party_name=party,
        amount=amt,
    )
    return {
        "success": True,
        "connector": "TALLY_PRIME",
        "voucher_number": vnum,
        "xml_payload": xml_content,
    }


@router.post(
    "/sync/submit",
    summary="Submit Bi-Directional Accounting Sync Queue",
    description="Submits multi-record sync queue for Busy, Marg, Zoho, or QuickBooks."
)
async def submit_sync_queue(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    connector = payload.get("connector", "BUSY")
    records = payload.get("records", [])
    svc = SMRITICommunicatorService()
    return await svc.process_sync_queue(connector_type=connector, records=records)
