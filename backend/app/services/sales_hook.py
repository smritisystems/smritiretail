"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Sprint 14 -- Sales creation hooks.

Provides two async helper functions called INSIDE the sales transaction
(before commit) to atomically write:
  1. sales_invoice_lines  -- one row per invoice item (from SalesInvoiceItemCreate)
  2. loyalty_transactions -- one EARN row per invoice (if customer has loyalty_member)

Both helpers accept the raw SQLAlchemy session and MUST NOT commit --
commit is owned by the caller (SalesService.create_sales_invoice).

Called via:
    from ...services.sales_hook import write_invoice_lines, write_loyalty_earn
"""

import uuid as _uuid
from decimal import Decimal
from typing import Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


def _sid() -> str:
    return str(_uuid.uuid4())[:20]


async def write_invoice_lines(
    db: AsyncSession,
    invoice_id: str,
    company_id: Optional[str],
    branch_id: Optional[str],
    creator: str,
    items: List[Any],  # List[SalesInvoiceItemCreate]
    warehouse_id: Optional[str] = None,
) -> int:
    """
    Write one sales_invoice_items row per item in the invoice payload.
    Called atomically BEFORE commit in SalesService.create_sales_invoice.
    Returns count of rows inserted.

    MIGRATION NOTE (v4.17.0, 2026-09-10):
    This function previously inserted into `sales_invoice_lines` (0 rows, Phase B deprecated).
    It now inserts into `sales_invoice_items` — the canonical live ledger (11,461 rows).
    `sales_invoice_lines` is preserved in schema but no longer written to (Phase B).
    Column mapping from SalesInvoiceItemCreate:
      product_id     <- item.product_id
      name           <- item.name
      code           <- item.code
      hsn_code       <- item.hsn_code
      quantity       <- item.quantity
      price          <- item.price
      mrp            <- item.mrp
      disc_pct       <- item.disc_pct
      taxable_value  <- item.taxable_value or (qty * price - discount)
      gst_rate       <- item.gst_rate
      tax_amount     <- item.tax_amount
      total_amount   <- item.total_amount
      line_no        <- item.line_no or idx
    """
    import logging as _log
    _logger = _log.getLogger(__name__)
    inserted = 0
    try:
        async with db.begin_nested():
            for idx, item in enumerate(items, start=1):
                qty        = Decimal(str(getattr(item, "quantity", 1) or 1))
                price      = Decimal(str(getattr(item, "price", 0) or 0))
                disc_pct   = Decimal(str(getattr(item, "disc_pct", 0) or 0))
                disc_amt   = (qty * price * disc_pct / 100).quantize(Decimal("0.01"))
                taxable_val = getattr(item, "taxable_value", None)
                taxable    = taxable_val if taxable_val is not None else (qty * price - disc_amt)
                tax_rate   = Decimal(str(getattr(item, "gst_rate", 0) or 0))
                tax_amt    = Decimal(str(getattr(item, "tax_amount", 0) or 0))
                net_amt_val = getattr(item, "total_amount", None)
                net_amt    = Decimal(str(net_amt_val)) if net_amt_val is not None else Decimal(str(taxable + tax_amt))
                line_no_val = getattr(item, "line_no", None)
                line_no    = line_no_val if line_no_val is not None else idx
                igst   = Decimal(str(getattr(item, "igst_amount", 0) or 0))
                cgst   = Decimal(str(getattr(item, "cgst_amount", 0) or 0))
                sgst   = Decimal(str(getattr(item, "sgst_amount", 0) or 0))

                await db.execute(text("""
                    INSERT INTO sales_invoice_items (
                        invoice_id,
                        product_id, item_id, variant_id,
                        name, code, hsn_code,
                        quantity, price, mrp,
                        disc_pct, taxable_value,
                        gst_rate, tax_amount, total_amount,
                        igst_amount, cgst_amount, sgst_amount,
                        line_no, batch_no
                    ) VALUES (
                        :invoice_id,
                        :product_id, :item_id, :variant_id,
                        :name, :code, :hsn_code,
                        :qty, :price, :mrp,
                        :disc_pct, :taxable,
                        :tax_rate, :tax_amt, :net_amt,
                        :igst, :cgst, :sgst,
                        :line_no, :batch_no
                    )
                    ON CONFLICT DO NOTHING
                """), {
                    "invoice_id": invoice_id,
                    "product_id": getattr(item, "product_id", None) or getattr(item, "code", ""),
                    "item_id": getattr(item, "item_id", None),
                    "variant_id": getattr(item, "variant_id", None),
                    "name": getattr(item, "name", "") or "",
                    "code": getattr(item, "code", "") or "",
                    "hsn_code": getattr(item, "hsn_code", None) or None,
                    "qty": float(qty), "price": float(price),
                    "mrp": float(getattr(item, "mrp", 0)) if getattr(item, "mrp", None) else None,
                    "disc_pct": float(disc_pct),
                    "taxable": float(taxable),
                    "tax_rate": float(tax_rate), "tax_amt": float(tax_amt),
                    "net_amt": float(net_amt),
                    "igst": float(igst), "cgst": float(cgst), "sgst": float(sgst),
                    "line_no": line_no,
                    "batch_no": getattr(item, "batch_no", None),
                })
                inserted += 1
    except Exception as e:
        # Log but never fail the invoice commit due to line-item hook
        _logger.warning("[sales_hook.write_invoice_lines] Failed to write %d items for invoice %s: %s",
                        len(items), invoice_id, e)

    return inserted


async def write_loyalty_earn(
    db: AsyncSession,
    invoice_id: str,
    company_id: Optional[str],
    branch_id: Optional[str],
    customer_id: Optional[str],
    grand_total: Decimal,
    creator: str,
) -> bool:
    """
    Write a EARN row to loyalty_transactions if the customer has a loyalty_member.
    Points = floor(grand_total / earn_unit) where earn_unit comes from loyalty_rules.
    Called atomically BEFORE commit in SalesService.create_sales_invoice.
    Returns True if a loyalty row was written, False otherwise.

    Graceful: any exception is silently swallowed so it never fails the invoice.
    """
    if not customer_id or customer_id == "CUST-WALKIN":
        return False

    try:
        async with db.begin_nested():
            # Fetch member + tier earn_multiplier
            row = (await db.execute(text("""
                SELECT lm.id, lm.current_points_balance,
                       COALESCE(lt.earn_multiplier, 1.0) AS earn_mult,
                       COALESCE(lt.points_per_unit_spend, 1.0) AS points_per_unit
                FROM loyalty_members lm
                LEFT JOIN loyalty_tiers lt ON lt.id = lm.loyalty_tier_id
                WHERE lm.customer_id = :customer_id
                  AND lm.is_deleted = false
                  AND lm.is_active = true
                LIMIT 1
            """), {"customer_id": customer_id})).fetchone()

            if not row:
                return False

            member_id     = row[0]
            cur_balance   = Decimal(str(row[1] or 0))
            earn_mult     = Decimal(str(row[2] or 1))
            points_per_unit = Decimal(str(row[3] or 1))

            # Points = floor(grand_total * points_per_unit * earn_multiplier)
            points_earned = (grand_total * points_per_unit * earn_mult).quantize(
                Decimal("0.01")
            )
            new_balance = cur_balance + points_earned

            tx_id = _sid()
            await db.execute(text("""
                INSERT INTO loyalty_transactions (
                    id, company_id, branch_id,
                    member_id, customer_id, transaction_type,
                    points, balance_after,
                    reference_type, reference_id, invoice_amount,
                    narration,
                    created_by, updated_by,
                    created_at, modified_at,
                    is_active, is_deleted, version
                ) VALUES (
                    :id, :company_id, :branch_id,
                    :member_id, :customer_id, 'EARN',
                    :points, :balance_after,
                    'SALES_INVOICE', :invoice_id, :invoice_amount,
                    :narration,
                    :creator, :creator,
                    NOW(), NOW(),
                    true, false, 1
                )
            """), {
                "id": tx_id, "company_id": company_id, "branch_id": branch_id,
                "member_id": member_id, "customer_id": customer_id,
                "points": float(points_earned), "balance_after": float(new_balance),
                "invoice_id": invoice_id, "invoice_amount": float(grand_total),
                "narration": f"Points earned on invoice {invoice_id}",
                "creator": creator,
            })

            # Update loyalty_members balance atomically
            await db.execute(text("""
                UPDATE loyalty_members
                SET current_points_balance = :new_balance,
                    total_points_earned    = total_points_earned + :points,
                    total_lifetime_spend   = total_lifetime_spend + :spend,
                    modified_at            = NOW()
                WHERE id = :member_id
            """), {
                "new_balance": float(new_balance),
                "points": float(points_earned),
                "spend": float(grand_total),
                "member_id": member_id,
            })

            return True

    except Exception:
        # Never fail the invoice commit due to loyalty hook
        return False

async def write_loyalty_redeem(
    db,
    return_id: str,
    company_id,
    branch_id,
    customer_id,
    return_total,
    creator: str,
) -> bool:
    """
    Write a REVERSAL row to loyalty_transactions for a sales return.
    Points reversed = same calculation as earn (grand_total * points_per_unit * earn_mult).
    Deducts from current_points_balance, but never below zero.
    Silently swallowed on exception -- never fails the return commit.
    """
    from sqlalchemy import text
    from decimal import Decimal

    if not customer_id or customer_id == "CUST-WALKIN":
        return False
    try:
        async with db.begin_nested():
            row = (await db.execute(text("""
                SELECT lm.id, lm.current_points_balance,
                       COALESCE(lt.earn_multiplier, 1.0)      AS earn_mult,
                       COALESCE(lt.points_per_unit_spend, 1.0) AS points_per_unit
                FROM loyalty_members lm
                LEFT JOIN loyalty_tiers lt ON lt.id = lm.loyalty_tier_id
                WHERE lm.customer_id = :customer_id
                  AND lm.is_deleted = false AND lm.is_active = true
                LIMIT 1
            """), {"customer_id": customer_id})).fetchone()

            if not row:
                return False

            member_id       = row[0]
            cur_balance     = Decimal(str(row[1] or 0))
            earn_mult       = Decimal(str(row[2] or 1))
            points_per_unit = Decimal(str(row[3] or 1))

            return_total_d  = Decimal(str(return_total))
            points_reversed = (return_total_d * points_per_unit * earn_mult).quantize(Decimal("0.01"))
            # Never deduct below zero
            points_reversed = min(points_reversed, cur_balance)
            new_balance     = cur_balance - points_reversed

            from app.services.sales_hook import _sid
            tx_id = _sid()
            await db.execute(text("""
                INSERT INTO loyalty_transactions (
                    id, company_id, branch_id,
                    member_id, customer_id, transaction_type,
                    points, balance_after,
                    reference_type, reference_id, invoice_amount,
                    narration,
                    created_by, updated_by,
                    created_at, modified_at,
                    is_active, is_deleted, version
                ) VALUES (
                    :id, :company_id, :branch_id,
                    :member_id, :customer_id, 'REVERSAL',
                    :points, :balance_after,
                    'SALES_RETURN', :return_id, :return_amount,
                    :narration,
                    :creator, :creator,
                    NOW(), NOW(),
                    true, false, 1
                )
            """), {
                "id": tx_id, "company_id": company_id, "branch_id": branch_id,
                "member_id": member_id, "customer_id": customer_id,
                "points": float(points_reversed), "balance_after": float(new_balance),
                "return_id": return_id, "return_amount": float(return_total_d),
                "narration": f"Points reversed on return {return_id}",
                "creator": creator,
            })

            await db.execute(text("""
                UPDATE loyalty_members
                SET current_points_balance = :new_balance,
                    total_points_redeemed  = total_points_redeemed + :points,
                    modified_at            = NOW()
                WHERE id = :member_id
            """), {
                "new_balance": float(new_balance),
                "points": float(points_reversed),
                "member_id": member_id,
            })
            return True
    except Exception:
        return False

async def write_loyalty_bonus(
    db,
    member_id: str,
    company_id,
    branch_id,
    points: float,
    reason: str,
    reference_id: str,
    creator: str,
) -> bool:
    """
    Sprint 19 -- Write a BONUS row to loyalty_transactions.
    Manual point grant (e.g. birthday bonus, promotion, correction).
    Adds to current_points_balance + total_points_earned.
    Silently swallowed on exception.
    """
    from sqlalchemy import text
    from decimal import Decimal

    if not member_id or points <= 0:
        return False
    try:
        async with db.begin_nested():
            row = (await db.execute(text("""
                SELECT id, current_points_balance
                FROM loyalty_members
                WHERE id = :member_id AND is_deleted = false AND is_active = true
                LIMIT 1
            """), {"member_id": member_id})).fetchone()

            if not row:
                return False

            cur_balance = Decimal(str(row[1] or 0))
            bonus_pts   = Decimal(str(points))
            new_balance = cur_balance + bonus_pts

            tx_id = _sid()
            await db.execute(text("""
                INSERT INTO loyalty_transactions (
                    id, company_id, branch_id,
                    member_id, transaction_type,
                    points, balance_after,
                    reference_type, reference_id,
                    narration,
                    created_by, updated_by,
                    created_at, modified_at,
                    is_active, is_deleted, version
                ) VALUES (
                    :id, :company_id, :branch_id,
                    :member_id, 'BONUS',
                    :points, :balance_after,
                    'MANUAL', :ref_id,
                    :narration,
                    :creator, :creator,
                    NOW(), NOW(),
                    true, false, 1
                )
            """), {
                "id": tx_id, "company_id": company_id, "branch_id": branch_id,
                "member_id": member_id,
                "points": float(bonus_pts), "balance_after": float(new_balance),
                "ref_id": reference_id,
                "narration": reason or f"Bonus points grant {tx_id}",
                "creator": creator,
            })

            await db.execute(text("""
                UPDATE loyalty_members
                SET current_points_balance = :new_balance,
                    total_points_earned    = total_points_earned + :points,
                    modified_at            = NOW()
                WHERE id = :member_id
            """), {
                "new_balance": float(new_balance),
                "points": float(bonus_pts),
                "member_id": member_id,
            })
            return True
    except Exception:
        return False


async def write_loyalty_expiry(
    db,
    member_id: str,
    company_id,
    branch_id,
    points: float,
    reason: str,
    reference_id: str,
    creator: str,
) -> bool:
    """
    Sprint 19 -- Write an EXPIRY row to loyalty_transactions.
    Deducts expired points from current_points_balance.
    Clamps: never goes below zero.
    Silently swallowed on exception.
    """
    from sqlalchemy import text
    from decimal import Decimal

    if not member_id or points <= 0:
        return False
    try:
        async with db.begin_nested():
            row = (await db.execute(text("""
                SELECT id, current_points_balance
                FROM loyalty_members
                WHERE id = :member_id AND is_deleted = false AND is_active = true
                LIMIT 1
            """), {"member_id": member_id})).fetchone()

            if not row:
                return False

            cur_balance  = Decimal(str(row[1] or 0))
            expiry_pts   = Decimal(str(points))
            expiry_pts   = min(expiry_pts, cur_balance)   # never below zero
            new_balance  = cur_balance - expiry_pts

            tx_id = _sid()
            await db.execute(text("""
                INSERT INTO loyalty_transactions (
                    id, company_id, branch_id,
                    member_id, transaction_type,
                    points, balance_after,
                    reference_type, reference_id,
                    narration,
                    created_by, updated_by,
                    created_at, modified_at,
                    is_active, is_deleted, version
                ) VALUES (
                    :id, :company_id, :branch_id,
                    :member_id, 'EXPIRY',
                    :points, :balance_after,
                    'SYSTEM', :ref_id,
                    :narration,
                    :creator, :creator,
                    NOW(), NOW(),
                    true, false, 1
                )
            """), {
                "id": tx_id, "company_id": company_id, "branch_id": branch_id,
                "member_id": member_id,
                "points": float(expiry_pts), "balance_after": float(new_balance),
                "ref_id": reference_id,
                "narration": reason or f"Points expired {tx_id}",
                "creator": creator,
            })

            await db.execute(text("""
                UPDATE loyalty_members
                SET current_points_balance  = :new_balance,
                    total_points_redeemed   = total_points_redeemed + :points,
                    modified_at             = NOW()
                WHERE id = :member_id
            """), {
                "new_balance": float(new_balance),
                "points": float(expiry_pts),
                "member_id": member_id,
            })
            return True
    except Exception:
        return False