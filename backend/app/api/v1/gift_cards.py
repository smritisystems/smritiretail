"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.3
Created      : 2026-10-04
Modified     : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

GC-001 Sprint (2026-10-27): Migrated all endpoints from sync SQLAlchemy
Session / get_db to async AsyncSession / get_company_db.
This removes the last synchronous execution path in the Gift Cards module
and aligns it with the FastAPI + Postgres sole backend architecture policy.

Endpoints:
  Gift Cards:
    GET  /gift-cards              - List all gift cards (filterable by status)
    POST /gift-cards              - Issue a new gift card
    GET  /gift-cards/{id}         - Get gift card detail
    POST /gift-cards/{id}/topup   - Top up balance
    POST /gift-cards/{id}/redeem  - Redeem amount
    POST /gift-cards/{id}/block   - Block card
    GET  /gift-cards/{id}/transactions - Transaction ledger

  Gift Vouchers:
    GET  /gift-vouchers           - List vouchers
    POST /gift-vouchers           - Issue voucher
    GET  /gift-vouchers/{id}      - Get voucher detail
    POST /gift-vouchers/{id}/redeem - Redeem voucher against invoice
    POST /gift-vouchers/{id}/cancel - Cancel voucher
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
import secrets
import string
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db
from ...models.gift_cards import GiftCard, GiftCardTransaction, GiftVoucher
from ...schemas.gift_cards import (
    GiftCardCreate, GiftCardRead, GiftCardTopup, GiftCardRedeem,
    GiftCardTransactionRead, GiftVoucherCreate, GiftVoucherRead, GiftVoucherRedeem,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _gen_code(prefix: str, length: int = 12) -> str:
    chars = string.ascii_uppercase + string.digits
    return prefix + "-" + "".join(secrets.choice(chars) for _ in range(length))


def _new_id() -> str:
    return str(uuid.uuid4())


async def _get_card(db: AsyncSession, card_id: str) -> GiftCard:
    result = await db.execute(
        select(GiftCard).where(GiftCard.id == card_id, GiftCard.is_deleted == False)
    )
    card = result.scalars().first()
    if not card:
        raise HTTPException(status_code=404, detail="Gift card not found.")
    return card


async def _get_voucher(db: AsyncSession, voucher_id: str) -> GiftVoucher:
    result = await db.execute(
        select(GiftVoucher).where(GiftVoucher.id == voucher_id, GiftVoucher.is_deleted == False)
    )
    voucher = result.scalars().first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Gift voucher not found.")
    return voucher


# ---------------------------------------------------------------------------
# Gift Cards
# ---------------------------------------------------------------------------

@router.get("/gift-cards", response_model=List[GiftCardRead], tags=["Gift Cards"])
async def list_gift_cards(
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_company_db),
):
    stmt = select(GiftCard).where(GiftCard.is_deleted == False)
    if status:
        stmt = stmt.where(GiftCard.status == status.upper())
    stmt = stmt.order_by(GiftCard.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/gift-cards", response_model=GiftCardRead, status_code=status.HTTP_201_CREATED, tags=["Gift Cards"])
async def issue_gift_card(
    payload: GiftCardCreate,
    db: AsyncSession = Depends(get_company_db),
):
    card_no = payload.card_no or _gen_code("GC")

    existing = await db.execute(
        select(GiftCard).where(GiftCard.card_no == card_no)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail=f"Gift card {card_no} already exists.")

    card = GiftCard(
        id=_new_id(),
        card_no=card_no,
        card_type=payload.card_type,
        face_value=payload.face_value,
        balance=payload.face_value,
        currency=payload.currency,
        issued_to=payload.issued_to,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        notes=payload.notes,
        status="ACTIVE",
        issued_at=_now(),
    )
    db.add(card)
    await db.flush()

    db.add(GiftCardTransaction(
        id=_new_id(),
        gift_card_id=card.id,
        txn_type="ISSUE",
        amount=payload.face_value,
        balance_after=payload.face_value,
    ))
    await db.commit()
    await db.refresh(card)
    return card


@router.get("/gift-cards/{card_id}", response_model=GiftCardRead, tags=["Gift Cards"])
async def get_gift_card(
    card_id: str,
    db: AsyncSession = Depends(get_company_db),
):
    return await _get_card(db, card_id)


@router.post("/gift-cards/{card_id}/topup", response_model=GiftCardRead, tags=["Gift Cards"])
async def topup_gift_card(
    card_id: str,
    payload: GiftCardTopup,
    db: AsyncSession = Depends(get_company_db),
):
    card = await _get_card(db, card_id)
    if card.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=f"Card is {card.status}. Only ACTIVE cards can be topped up."
        )
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Top-up amount must be positive.")

    card.balance = (card.balance or Decimal("0")) + payload.amount
    db.add(GiftCardTransaction(
        id=_new_id(),
        gift_card_id=card.id,
        txn_type="TOPUP",
        amount=payload.amount,
        balance_after=card.balance,
        reference_no=payload.reference_no,
        notes=payload.notes,
    ))
    await db.commit()
    await db.refresh(card)
    return card


@router.post("/gift-cards/{card_id}/redeem", response_model=GiftCardRead, tags=["Gift Cards"])
async def redeem_gift_card(
    card_id: str,
    payload: GiftCardRedeem,
    db: AsyncSession = Depends(get_company_db),
):
    card = await _get_card(db, card_id)
    if card.status != "ACTIVE":
        raise HTTPException(status_code=400, detail=f"Card is {card.status}.")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Redemption amount must be positive.")

    current_balance = card.balance or Decimal("0")
    if current_balance < payload.amount:
        raise HTTPException(status_code=400, detail="Insufficient gift card balance.")

    card.balance = current_balance - payload.amount
    if card.balance == 0:
        card.status = "REDEEMED"

    db.add(GiftCardTransaction(
        id=_new_id(),
        gift_card_id=card.id,
        txn_type="REDEEM",
        amount=-payload.amount,
        balance_after=card.balance,
        reference_no=payload.reference_no,
    ))
    await db.commit()
    await db.refresh(card)
    return card


@router.post("/gift-cards/{card_id}/block", response_model=GiftCardRead, tags=["Gift Cards"])
async def block_gift_card(
    card_id: str,
    db: AsyncSession = Depends(get_company_db),
):
    card = await _get_card(db, card_id)
    if card.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot block a card with status {card.status}."
        )
    card.status = "BLOCKED"
    db.add(GiftCardTransaction(
        id=_new_id(),
        gift_card_id=card.id,
        txn_type="BLOCK",
        amount=Decimal("0"),
        balance_after=card.balance,
    ))
    await db.commit()
    await db.refresh(card)
    return card


@router.get(
    "/gift-cards/{card_id}/transactions",
    response_model=List[GiftCardTransactionRead],
    tags=["Gift Cards"],
)
async def get_gift_card_transactions(
    card_id: str,
    db: AsyncSession = Depends(get_company_db),
):
    await _get_card(db, card_id)   # 404 guard
    result = await db.execute(
        select(GiftCardTransaction)
        .where(GiftCardTransaction.gift_card_id == card_id)
        .order_by(GiftCardTransaction.created_at.desc())
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Gift Vouchers
# ---------------------------------------------------------------------------

@router.get("/gift-vouchers", response_model=List[GiftVoucherRead], tags=["Gift Vouchers"])
async def list_gift_vouchers(
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_company_db),
):
    stmt = select(GiftVoucher).where(GiftVoucher.is_deleted == False)
    if status:
        stmt = stmt.where(GiftVoucher.status == status.upper())
    stmt = stmt.order_by(GiftVoucher.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/gift-vouchers",
    response_model=GiftVoucherRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Gift Vouchers"],
)
async def issue_gift_voucher(
    payload: GiftVoucherCreate,
    db: AsyncSession = Depends(get_company_db),
):
    voucher_no = payload.voucher_no or _gen_code("GV")

    existing = await db.execute(
        select(GiftVoucher).where(GiftVoucher.voucher_no == voucher_no)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail=f"Voucher {voucher_no} already exists.")

    v = GiftVoucher(
        id=_new_id(),
        voucher_no=voucher_no,
        voucher_type=payload.voucher_type,
        status="ACTIVE",
        face_value=payload.face_value,
        pct_discount=payload.pct_discount,
        min_order_value=payload.min_order_value,
        max_discount=payload.max_discount,
        issued_to=payload.issued_to,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        notes=payload.notes,
        issued_at=_now(),
    )
    db.add(v)
    await db.commit()
    await db.refresh(v)
    return v


@router.get("/gift-vouchers/{voucher_id}", response_model=GiftVoucherRead, tags=["Gift Vouchers"])
async def get_gift_voucher(
    voucher_id: str,
    db: AsyncSession = Depends(get_company_db),
):
    return await _get_voucher(db, voucher_id)


@router.post("/gift-vouchers/{voucher_id}/redeem", response_model=GiftVoucherRead, tags=["Gift Vouchers"])
async def redeem_gift_voucher(
    voucher_id: str,
    payload: GiftVoucherRedeem,
    db: AsyncSession = Depends(get_company_db),
):
    v = await _get_voucher(db, voucher_id)
    if v.status != "ACTIVE":
        raise HTTPException(status_code=400, detail=f"Voucher is {v.status}.")

    now = _now()
    if v.valid_to and now > v.valid_to:
        v.status = "EXPIRED"
        await db.commit()
        raise HTTPException(status_code=400, detail="Voucher has expired.")

    if v.min_order_value and payload.order_value < v.min_order_value:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order value is {v.min_order_value}."
        )

    v.status = "USED"
    v.used_at = now
    v.redeemed_invoice_no = payload.invoice_no
    await db.commit()
    await db.refresh(v)
    return v


@router.post("/gift-vouchers/{voucher_id}/cancel", response_model=GiftVoucherRead, tags=["Gift Vouchers"])
async def cancel_gift_voucher(
    voucher_id: str,
    db: AsyncSession = Depends(get_company_db),
):
    v = await _get_voucher(db, voucher_id)
    if v.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a voucher with status {v.status}."
        )
    v.status = "CANCELLED"
    await db.commit()
    await db.refresh(v)
    return v
