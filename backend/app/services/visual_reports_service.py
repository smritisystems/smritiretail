"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.94.0
Created      : 2026-10-17
Modified     : 2026-10-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Visual Reports Dashboard Service
Capability    : @SmritiCapability("REPORTS", "VISUAL_REPORTS_SERVICE")
"""

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, text, cast, Date, case

from ..models.fulfillment import PackingSlip, PackingSlipItem, Dispatch, DispatchItem
from ..models.inventory import Product, StockMovement
from ..models.sales import SalesInvoice, SalesInvoiceItem, SalesOrder, SalesOrderItem, SalesOrderReservation
from ..models.reporting import Dashboard
from ..schemas.visual_reports import (
    VisualKpiCard,
    StockFlowDataPoint,
    WorkflowStageProgress,
    CategoryStockPosition,
    TopReservedSku,
    PackingSlipStatusSlice,
    DispatchInvoiceSummaryRow,
    FulfillmentStreamItem,
    DashboardConfigPayload,
    VisualReportsSummaryResponse,
)
from .stock_movement_types import (
    INFLOW_MOVEMENT_TYPES,
    OUTFLOW_MOVEMENT_TYPES,
    SIGNED_MOVEMENT_TYPES,
)
from .stock_ledger_query import (
    get_signed_movement_quantity_expr,
    audit_unclassified_movements,
    get_authoritative_stock_by_product,
)
from .stock_synchronizer import StockSynchronizer

logger = logging.getLogger("smriti.visual_reports")


class VisualReportsService:
    """
    Authoritative computation service for the Visual Reports Dashboard.
    Reconciles on-hand, reserved, available, sales orders, packing slips,
    dispatches, and invoices across PostgreSQL ledgers.
    """

    DEFAULT_CONFIG = DashboardConfigPayload(
        layout_mode="focused",
        kpi_cards_visible={
            "on_hand": True,
            "reserved": True,
            "available": True,
            "sales_orders": True,
            "packing_slips": True,
            "dispatches": True,
        },
        charts_visible={
            "stock_flow": True,
            "order_to_invoice": True,
            "category_stock": True,
            "top_skus": True,
            "packing_status": True,
        },
        stock_flow_chart_type="line",
        table_view="active_stream",
        default_tab="all",
        rows_per_page=10,
        color_theme_mode="system",
        custom_accent_color="#2563eb",
    )

    @staticmethod
    def get_signed_movement_quantity_expr(
        quantity_col=StockMovement.quantity,
        type_col=StockMovement.movement_type,
    ):
        return get_signed_movement_quantity_expr(quantity_col, type_col)

    @classmethod
    async def get_dashboard_summary(
        cls,
        session: AsyncSession,
        company_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        store_location_id: Optional[str] = None,
    ) -> VisualReportsSummaryResponse:
        today = datetime.now(timezone.utc).date()
        e_date = end_date or today
        s_date = start_date or (e_date - timedelta(days=29))

        # Audit unclassified movement types (logs ERROR and surfaces counts)
        await audit_unclassified_movements(session, company_id, store_location_id)

        # 1. Authoritative Company Name from database
        comp_name_res = (await session.execute(text("SELECT name FROM companies WHERE id = :cid"), {"cid": company_id})).scalar()
        company_name = comp_name_res or company_id
        location_name = store_location_id if store_location_id and store_location_id != "All Locations" else "All Locations"
        date_range_label = f"{s_date.strftime('%d %b %Y')} - {e_date.strftime('%d %b %Y')}"

        # 2. Authoritative on-hand from the canonical batch/movement ledgers
        signed_qty_expr = get_signed_movement_quantity_expr()
        stock_balances = await get_authoritative_stock_by_product(
            session,
            company_id,
            warehouse=(
                store_location_id
                if store_location_id and store_location_id != "All Locations"
                else None
            ),
        )
        total_on_hand = float(sum(stock_balances.values(), Decimal(0)))

        # 3. Reserved Stock from SalesOrderReservation Ledger, falling back to open SalesOrderItem pending_quantity
        stmt_reserved = (
            select(func.coalesce(func.sum(
                SalesOrderReservation.reserved_quantity
                - SalesOrderReservation.released_quantity
                - SalesOrderReservation.consumed_quantity
            ), 0))
            .where(
                SalesOrderReservation.company_id == company_id,
                SalesOrderReservation.is_deleted == False,
                SalesOrderReservation.status.in_(("ACTIVE", "PARTIAL")),
            )
        )
        if store_location_id and store_location_id != "All Locations":
            stmt_reserved = stmt_reserved.where(
                or_(
                    SalesOrderReservation.warehouse_id == store_location_id,
                    SalesOrderReservation.branch_id == store_location_id,
                )
            )
        total_reserved = float((await session.execute(stmt_reserved)).scalar() or 0)
        if total_reserved == 0.0:
            stmt_so_pending = (
                select(func.coalesce(func.sum(SalesOrderItem.pending_quantity), 0))
                .where(
                    SalesOrderItem.company_id == company_id,
                    SalesOrderItem.is_deleted == False,
                    SalesOrderItem.pending_quantity > 0,
                )
            )
            total_reserved = float((await session.execute(stmt_so_pending)).scalar() or 0)

        # 4. Available Stock
        total_available = max(0.0, total_on_hand - total_reserved)

        # 5. Live Document Counts filtered by Selected Date Range & Excluding Invalid Invoices (Null-safe + Business Date)
        stmt_so = select(func.count(SalesOrder.id)).where(
            SalesOrder.company_id == company_id,
            SalesOrder.is_deleted == False,
            SalesOrder.date >= s_date,
            SalesOrder.date <= e_date,
        )
        so_count = (await session.execute(stmt_so)).scalar() or 0

        ps_date_expr = cast(func.timezone("Asia/Kolkata", PackingSlip.created_at), Date)
        stmt_slips = select(func.count(PackingSlip.id)).where(
            PackingSlip.company_id == company_id,
            PackingSlip.is_deleted == False,
            or_(PackingSlip.status.is_(None), func.upper(PackingSlip.status).notin_(("CANCELLED",))),
            ps_date_expr >= s_date,
            ps_date_expr <= e_date,
        )
        ps_count = (await session.execute(stmt_slips)).scalar() or 0

        ds_date_expr = cast(func.timezone("Asia/Kolkata", Dispatch.created_at), Date)
        stmt_dispatches = select(func.count(Dispatch.id)).where(
            Dispatch.company_id == company_id,
            Dispatch.is_deleted == False,
            ds_date_expr >= s_date,
            ds_date_expr <= e_date,
        )
        ds_count = (await session.execute(stmt_dispatches)).scalar() or 0

        stmt_invoices = select(func.count(SalesInvoice.id)).where(
            SalesInvoice.company_id == company_id,
            SalesInvoice.is_deleted == False,
            or_(SalesInvoice.status.is_(None), func.upper(SalesInvoice.status).notin_(("CANCELLED", "DRAFT"))),
            SalesInvoice.date >= s_date,
            SalesInvoice.date <= e_date,
        )
        inv_count = (await session.execute(stmt_invoices)).scalar() or 0

        kpis = [
            VisualKpiCard(
                id="on_hand",
                title="On-Hand Stock",
                value=f"{int(total_on_hand):,}",
                numeric_value=total_on_hand,
                unit="pairs",
                subtext=None,
                trend_direction="up",
                trend_percentage=None,
                color="blue",
            ),
            VisualKpiCard(
                id="reserved",
                title="Reserved Stock",
                value=f"{int(total_reserved):,}",
                numeric_value=total_reserved,
                unit="pairs",
                subtext=None,
                trend_direction="up",
                trend_percentage=None,
                color="amber",
            ),
            VisualKpiCard(
                id="available",
                title="Available Stock",
                value=f"{int(total_available):,}",
                numeric_value=total_available,
                unit="pairs",
                subtext=None,
                trend_direction="up",
                trend_percentage=None,
                color="green",
            ),
            VisualKpiCard(
                id="sales_orders",
                title="Sales Orders",
                value=str(so_count),
                numeric_value=float(so_count),
                unit=None,
                subtext=f"Total: {so_count} recorded",
                trend_direction="up",
                trend_percentage=None,
                color="purple",
            ),
            VisualKpiCard(
                id="packing_slips",
                title="Packing Slips",
                value=str(ps_count),
                numeric_value=float(ps_count),
                unit=None,
                subtext=f"Total: {ps_count} recorded",
                trend_direction="up",
                trend_percentage=None,
                color="cyan",
            ),
            VisualKpiCard(
                id="dispatches",
                title="Dispatches",
                value=str(ds_count),
                numeric_value=float(ds_count),
                unit=None,
                subtext=f"Total: {ds_count} recorded",
                trend_direction="up",
                trend_percentage=None,
                color="orange",
            ),
        ]

        # 6. Stock Flow Timeline (Running On-Hand Balance + Dispatched + Invoiced + Outstanding Reservations)
        sm_date_expr = cast(func.timezone("Asia/Kolkata", StockMovement.created_at), Date)

        # Opening on-hand balance before s_date
        stmt_opening = (
            select(func.coalesce(func.sum(signed_qty_expr), 0))
            .where(
                StockMovement.company_id == company_id,
                StockMovement.is_deleted == False,
                sm_date_expr < s_date,
            )
        )
        if store_location_id and store_location_id != "All Locations":
            stmt_opening = stmt_opening.where(
                or_(
                    StockMovement.warehouse_id == store_location_id,
                    StockMovement.location_id == store_location_id,
                    StockMovement.branch_id == store_location_id,
                )
            )
        opening_balance = float((await session.execute(stmt_opening)).scalar() or 0)

        # Daily movements within requested window
        stmt_daily_moves = (
            select(
                sm_date_expr.label("m_date"),
                func.coalesce(func.sum(signed_qty_expr), 0).label("daily_net"),
                func.coalesce(
                    func.sum(
                        case(
                            (func.upper(StockMovement.movement_type).in_(("OUTWARD_SALE", "OUTWARD_DISPATCH", "DISPATCH")), func.abs(StockMovement.quantity)),
                            else_=Decimal("0"),
                        )
                    ),
                    0,
                ).label("daily_dispatched"),
            )
            .where(
                StockMovement.company_id == company_id,
                StockMovement.is_deleted == False,
                sm_date_expr >= s_date,
                sm_date_expr <= e_date,
            )
        )
        if store_location_id and store_location_id != "All Locations":
            stmt_daily_moves = stmt_daily_moves.where(
                or_(
                    StockMovement.warehouse_id == store_location_id,
                    StockMovement.location_id == store_location_id,
                    StockMovement.branch_id == store_location_id,
                )
            )
        stmt_daily_moves = stmt_daily_moves.group_by(sm_date_expr).order_by(sm_date_expr)
        daily_moves_res = (await session.execute(stmt_daily_moves)).all()
        daily_moves_map = {row[0]: (float(row[1]), int(row[2])) for row in daily_moves_res}

        # Daily invoices bucketed by business date (SalesInvoice.date)
        stmt_daily_invoices = (
            select(
                SalesInvoice.date.label("inv_date"),
                func.count(SalesInvoice.id).label("inv_count"),
            )
            .where(
                SalesInvoice.company_id == company_id,
                SalesInvoice.is_deleted == False,
                or_(SalesInvoice.status.is_(None), func.upper(SalesInvoice.status).notin_(("CANCELLED", "DRAFT"))),
                SalesInvoice.date >= s_date,
                SalesInvoice.date <= e_date,
            )
            .group_by(SalesInvoice.date)
            .order_by(SalesInvoice.date)
        )
        daily_inv_res = (await session.execute(stmt_daily_invoices)).all()
        daily_inv_map = {row[0]: int(row[1]) for row in daily_inv_res}

        # Outstanding active reservations balance as of each date
        res_date_expr = cast(func.timezone("Asia/Kolkata", SalesOrderReservation.created_at), Date)
        stmt_res_opening = (
            select(
                func.coalesce(
                    func.sum(
                        SalesOrderReservation.reserved_quantity
                        - SalesOrderReservation.released_quantity
                        - SalesOrderReservation.consumed_quantity
                    ),
                    0,
                )
            )
            .where(
                SalesOrderReservation.company_id == company_id,
                SalesOrderReservation.is_deleted == False,
                SalesOrderReservation.status.in_(("ACTIVE", "PARTIAL")),
                res_date_expr < s_date,
            )
        )
        if store_location_id and store_location_id != "All Locations":
            stmt_res_opening = stmt_res_opening.where(
                or_(
                    SalesOrderReservation.warehouse_id == store_location_id,
                    SalesOrderReservation.branch_id == store_location_id,
                )
            )
        opening_res = float((await session.execute(stmt_res_opening)).scalar() or 0)

        stmt_daily_res = (
            select(
                res_date_expr.label("r_date"),
                func.coalesce(
                    func.sum(
                        SalesOrderReservation.reserved_quantity
                        - SalesOrderReservation.released_quantity
                        - SalesOrderReservation.consumed_quantity
                    ),
                    0,
                ).label("res_qty"),
            )
            .where(
                SalesOrderReservation.company_id == company_id,
                SalesOrderReservation.is_deleted == False,
                SalesOrderReservation.status.in_(("ACTIVE", "PARTIAL")),
                res_date_expr >= s_date,
                res_date_expr <= e_date,
            )
            .group_by(res_date_expr)
            .order_by(res_date_expr)
        )
        if store_location_id and store_location_id != "All Locations":
            stmt_daily_res = stmt_daily_res.where(
                or_(
                    SalesOrderReservation.warehouse_id == store_location_id,
                    SalesOrderReservation.branch_id == store_location_id,
                )
            )
        daily_res_res = (await session.execute(stmt_daily_res)).all()
        daily_res_map = {row[0]: float(row[1]) for row in daily_res_res}

        # Construct running on-hand and outstanding reservation timeline
        stock_flow: List[StockFlowDataPoint] = []
        running_on_hand = opening_balance
        running_reserved = opening_res
        total_days = (e_date - s_date).days

        if total_days <= 90:
            curr_date = s_date
            while curr_date <= e_date:
                d_net, d_disp = daily_moves_map.get(curr_date, (0.0, 0))
                d_inv = daily_inv_map.get(curr_date, 0)
                running_reserved += daily_res_map.get(curr_date, 0.0)
                running_on_hand += d_net
                curr_res = int(round(running_reserved))
                avail = max(0, int(round(running_on_hand - curr_res)))
                stock_flow.append(
                    StockFlowDataPoint(
                        date=curr_date.isoformat(),
                        day_label=curr_date.strftime("%d %b"),
                        on_hand=int(round(running_on_hand)),
                        reserved=curr_res,
                        available=avail,
                        dispatched=int(d_disp),
                        invoiced=int(d_inv),
                    )
                )
                curr_date += timedelta(days=1)
        else:
            all_dates = sorted(set(list(daily_moves_map.keys()) + list(daily_inv_map.keys()) + list(daily_res_map.keys()) + [s_date, e_date]))
            for d in all_dates:
                d_net, d_disp = daily_moves_map.get(d, (0.0, 0))
                d_inv = daily_inv_map.get(d, 0)
                running_reserved += daily_res_map.get(d, 0.0)
                running_on_hand += d_net
                curr_res = int(round(running_reserved))
                avail = max(0, int(round(running_on_hand - curr_res)))
                stock_flow.append(
                    StockFlowDataPoint(
                        date=d.isoformat() if hasattr(d, "isoformat") else str(d),
                        day_label=d.strftime("%d %b") if hasattr(d, "strftime") else str(d),
                        on_hand=int(round(running_on_hand)),
                        reserved=curr_res,
                        available=avail,
                        dispatched=int(d_disp),
                        invoiced=int(d_inv),
                    )
                )

        # 7. Workflow Stage Progress
        if so_count > 0:
            base = so_count
            so_pct = 100
            ps_pct = min(100, round((ps_count / base) * 100))
            ds_pct = min(100, round((ds_count / base) * 100))
            inv_pct = min(100, round((inv_count / base) * 100))
            so_subtext = f"Total: {so_count} recorded"
            ps_subtext = f"{ps_pct}% of sales orders"
            ds_subtext = f"{ds_pct}% of sales orders"
            inv_subtext = f"{inv_count} invoices recorded" if inv_count >= so_count else f"{inv_pct}% of sales orders"
        elif inv_count > 0:
            base = inv_count
            so_pct = 0
            ps_pct = round((ps_count / base) * 100) if ps_count > 0 else 0
            ds_pct = round((ds_count / base) * 100) if ds_count > 0 else 0
            inv_pct = 100
            so_subtext = "n/a (Direct POS Flow)"
            ps_subtext = "n/a (Counter Pickup)" if ps_count == 0 else f"{ps_pct}% of invoices"
            ds_subtext = "n/a (Counter Handover)" if ds_count == 0 else f"{ds_pct}% of invoices"
            inv_subtext = f"Total: {inv_count} recorded (POS Base)"
        else:
            so_pct = ps_pct = ds_pct = inv_pct = 0
            so_subtext = ps_subtext = ds_subtext = inv_subtext = "0 recorded"

        workflow_stages = [
            WorkflowStageProgress(
                id="stage_so",
                title="Sales Orders",
                icon="document",
                count=so_count,
                percentage=so_pct,
                color="purple",
                subtext=so_subtext,
                progress_bar_percentage=min(so_pct, 100),
            ),
            WorkflowStageProgress(
                id="stage_ps",
                title="Packing Slips",
                icon="box",
                count=ps_count,
                percentage=ps_pct,
                color="blue",
                subtext=ps_subtext,
                progress_bar_percentage=min(ps_pct, 100),
            ),
            WorkflowStageProgress(
                id="stage_ds",
                title="Dispatched",
                icon="truck",
                count=ds_count,
                percentage=ds_pct,
                color="orange",
                subtext=ds_subtext,
                progress_bar_percentage=min(ds_pct, 100),
            ),
            WorkflowStageProgress(
                id="stage_inv",
                title="Invoices",
                icon="receipt",
                count=inv_count,
                percentage=inv_pct,
                color="green",
                subtext=inv_subtext,
                progress_bar_percentage=min(inv_pct, 100),
            ),
        ]

        # 8. Category Stock Position with Dual-Ledger Invariant
        product_category_rows = (
            await session.execute(
                select(Product.id, Product.category).where(
                    Product.company_id == company_id,
                    Product.is_deleted.is_(False),
                )
            )
        ).all()
        category_totals: Dict[str, Decimal] = {}
        for product_id, category in product_category_rows:
            if category and product_id in stock_balances:
                category_totals[category] = (
                    category_totals.get(category, Decimal(0)) + stock_balances[product_id]
                )
        cat_totals = [
            (category, int(round(float(quantity))))
            for category, quantity in category_totals.items()
            if quantity != 0
        ]
        cat_totals.sort(key=lambda x: x[1], reverse=True)

        category_positions = [
            CategoryStockPosition(
                category=cat,
                on_hand=tot,
                reserved=0,
                available=tot,
                reserved_pct=0.0,
            )
            for cat, tot in cat_totals
        ]

        # 9. Top Reserved SKUs (SalesOrderReservation ledger with fallback to open SO pending items)
        res_sub = (
            select(
                SalesOrderReservation.product_id,
                func.coalesce(
                    func.sum(
                        SalesOrderReservation.reserved_quantity
                        - SalesOrderReservation.released_quantity
                        - SalesOrderReservation.consumed_quantity
                    ),
                    0,
                ).label("reserved"),
            )
            .where(
                SalesOrderReservation.company_id == company_id,
                SalesOrderReservation.status == "ACTIVE",
            )
            .group_by(SalesOrderReservation.product_id)
            .subquery()
        )

        stmt_top_res = (
            select(
                Product.id,
                Product.sku,
                Product.name,
                res_sub.c.reserved.label("reserved"),
            )
            .join(res_sub, res_sub.c.product_id == Product.id)
            .where(Product.company_id == company_id, Product.is_deleted == False)
            .order_by(res_sub.c.reserved.desc())
            .limit(10)
        )
        top_res_rows = (await session.execute(stmt_top_res)).all()

        if not top_res_rows:
            stmt_top_so = (
                select(
                    Product.id,
                    SalesOrderItem.code,
                    SalesOrderItem.name,
                    func.coalesce(func.sum(SalesOrderItem.pending_quantity), 0).label("reserved"),
                )
                .outerjoin(Product, SalesOrderItem.product_id == Product.id)
                .where(
                    SalesOrderItem.company_id == company_id,
                    SalesOrderItem.is_deleted == False,
                    SalesOrderItem.pending_quantity > 0,
                )
                .group_by(Product.id, SalesOrderItem.code, SalesOrderItem.name)
                .order_by(func.coalesce(func.sum(SalesOrderItem.pending_quantity), 0).desc())
                .limit(10)
            )
            top_res_rows = (await session.execute(stmt_top_so)).all()

        top_skus = [
            TopReservedSku(
                rank=i + 1,
                sku=r[1] or f"SKU-{i+1}",
                product_name=r[2] or "Product",
                on_hand=int(stock_balances.get(r[0], Decimal(0))),
                reserved=int(r[3]),
                reserved_pct=round(
                    (float(r[3]) / max(float(stock_balances.get(r[0], Decimal(0))), float(r[3]), 1.0)) * 100,
                    1,
                ),
            )
            for i, r in enumerate(top_res_rows)
        ]

        # 10. Packing Slip Donut Slices (Synchronized with Date Range & Location)
        stmt_donut = (
            select(PackingSlip.status, func.count(PackingSlip.id))
            .where(
                PackingSlip.company_id == company_id,
                PackingSlip.is_deleted == False,
                ps_date_expr >= s_date,
                ps_date_expr <= e_date,
            )
            .group_by(PackingSlip.status)
        )
        donut_rows = (await session.execute(stmt_donut)).all()
        donut_total = sum(r[1] for r in donut_rows)
        if donut_total == 0:
            stmt_donut_all = (
                select(PackingSlip.status, func.count(PackingSlip.id))
                .where(
                    PackingSlip.company_id == company_id,
                    PackingSlip.is_deleted == False,
                )
                .group_by(PackingSlip.status)
            )
            donut_rows = (await session.execute(stmt_donut_all)).all()
            donut_total = sum(r[1] for r in donut_rows)

        color_map = {
            "PENDING": "#06b6d4",
            "PACKED": "#2563eb",
            "READY_TO_DISPATCH": "#f59e0b",
            "DISPATCHED": "#10b981",
        }
        packing_slip_donut = [
            PackingSlipStatusSlice(
                status=r[0] or "Unknown",
                count=r[1],
                percentage=round((r[1] / max(donut_total, 1)) * 100, 1),
                color=color_map.get(str(r[0]).upper(), "#2563eb"),
            )
            for r in donut_rows
        ]
        total_ps_count = donut_total

        # 11. Dispatch & Invoice Summary
        ds_date_col = cast(func.timezone("Asia/Kolkata", Dispatch.created_at), Date)
        week_start_date = today - timedelta(days=today.weekday())
        month_start_date = today.replace(day=1)

        stmt_ds_today = select(func.count(Dispatch.id)).where(Dispatch.company_id == company_id, Dispatch.is_deleted == False, ds_date_col == today)
        ds_today = (await session.execute(stmt_ds_today)).scalar() or 0

        stmt_ds_week = select(func.count(Dispatch.id)).where(Dispatch.company_id == company_id, Dispatch.is_deleted == False, ds_date_col >= week_start_date)
        ds_week = (await session.execute(stmt_ds_week)).scalar() or 0

        stmt_ds_month = select(func.count(Dispatch.id)).where(Dispatch.company_id == company_id, Dispatch.is_deleted == False, ds_date_col >= month_start_date)
        ds_month = (await session.execute(stmt_ds_month)).scalar() or 0

        inv_valid_conds = [
            SalesInvoice.company_id == company_id,
            SalesInvoice.is_deleted == False,
            or_(SalesInvoice.status.is_(None), func.upper(SalesInvoice.status).notin_(("CANCELLED", "DRAFT"))),
        ]
        stmt_inv_today = select(func.count(SalesInvoice.id)).where(*inv_valid_conds, SalesInvoice.date == today)
        inv_today = (await session.execute(stmt_inv_today)).scalar() or 0

        stmt_inv_week = select(func.count(SalesInvoice.id)).where(*inv_valid_conds, SalesInvoice.date >= week_start_date)
        inv_week = (await session.execute(stmt_inv_week)).scalar() or 0

        stmt_inv_month = select(func.count(SalesInvoice.id), func.coalesce(func.sum(SalesInvoice.grand_total), 0)).where(*inv_valid_conds, SalesInvoice.date >= month_start_date)
        inv_month_row = (await session.execute(stmt_inv_month)).one()
        inv_month_cnt = inv_month_row[0] or 0
        inv_month_val = float(inv_month_row[1] or 0)

        dispatch_invoice_summary = [
            DispatchInvoiceSummaryRow(
                document_type="Dispatches",
                today=ds_today,
                this_week=ds_week,
                this_month=ds_month,
                value_inr=0.0,
                formatted_value="0.00",
            ),
            DispatchInvoiceSummaryRow(
                document_type="B2B Invoices",
                today=inv_today,
                this_week=inv_week,
                this_month=inv_month_cnt,
                value_inr=inv_month_val,
                formatted_value=f"{inv_month_val:,.2f}",
            ),
        ]

        # 12. Drift Calculation via StockSynchronizer.detect_stock_drift
        try:
            drift_records = await StockSynchronizer.detect_stock_drift(
                session=session,
                company_id=company_id,
                store_location_id=store_location_id if store_location_id and store_location_id != "All Locations" else None,
            )
            drifting_count = len(drift_records)
            is_reconciled = (drifting_count == 0)
            if is_reconciled:
                reconciliation_status = "All clear"
            elif drifting_count == 1:
                reconciliation_status = "1 product drifting"
            else:
                reconciliation_status = f"{drifting_count} products drifting"
            drift_val = float(sum(abs(r.drift) for r in drift_records))
        except Exception as ex:
            logger.error(f"Failed to detect stock drift: {ex}")
            is_reconciled = False
            reconciliation_status = "Never run"
            drift_val = 0.0

        # 13. Active Fulfillment Stream (Real Open Documents from SO, PS, DS, INV)
        stream_items: List[FulfillmentStreamItem] = []

        # 13.1 Sales Orders
        stmt_stream_so = (
            select(
                SalesOrder.id,
                SalesOrder.order_no,
                SalesOrder.date,
                SalesOrder.customer_name,
                SalesOrder.total_qty,
                SalesOrder.grand_total,
                SalesOrder.status,
                SalesOrder.updated_by,
                SalesOrder.modified_at,
                SalesOrder.created_at,
            )
            .where(
                SalesOrder.company_id == company_id,
                SalesOrder.is_deleted == False,
            )
            .order_by(SalesOrder.created_at.desc())
            .limit(25)
        )
        so_rows = (await session.execute(stmt_stream_so)).all()
        for r in so_rows:
            status_str = r[6] or "Draft"
            upper_status = status_str.upper()
            status_color = "emerald" if upper_status in ("CONFIRMED", "APPROVED") else "amber" if upper_status == "DRAFT" else "slate"
            next_act = "Create Packing Slip" if upper_status in ("CONFIRMED", "APPROVED") else "Review & Confirm"
            next_icon = "box" if upper_status in ("CONFIRMED", "APPROVED") else "edit"
            stream_items.append(
                FulfillmentStreamItem(
                    id=f"so_{r[0]}",
                    doc_type="SO",
                    doc_number=r[1] or f"SO-{r[0][:6]}",
                    doc_date=r[2].strftime("%d %b %Y") if r[2] else "",
                    customer_name=r[3] or "Retail Buyer",
                    item_summary=f"{int(r[4] or 0)} Pairs",
                    quantity=int(r[4] or 0),
                    value_inr=float(r[5] or 0),
                    formatted_value=f"{float(r[5] or 0):,.2f}",
                    status=status_str,
                    status_color=status_color,
                    next_action=next_act,
                    next_action_icon=next_icon,
                    updated_by=r[7] or "Sales Operator",
                    updated_on=(r[8] or r[9] or datetime.now(timezone.utc)).strftime("%d %b %Y, %H:%M"),
                )
            )

        # 13.2 Packing Slips
        stmt_stream_ps = (
            select(
                PackingSlip.id,
                PackingSlip.packing_slip_number,
                PackingSlip.created_at,
                PackingSlip.status,
                PackingSlip.total_packages,
                PackingSlip.updated_by,
                PackingSlip.modified_at,
                SalesInvoice.customer_name,
                SalesInvoice.grand_total,
            )
            .outerjoin(SalesInvoice, PackingSlip.sales_invoice_id == SalesInvoice.id)
            .where(
                PackingSlip.company_id == company_id,
                PackingSlip.is_deleted == False,
            )
            .order_by(PackingSlip.created_at.desc())
            .limit(25)
        )
        ps_rows = (await session.execute(stmt_stream_ps)).all()
        for r in ps_rows:
            status_str = r[3] or "PACKED"
            upper_status = status_str.upper()
            status_color = "emerald" if upper_status == "DISPATCHED" else "blue" if upper_status == "PACKED" else "amber"
            next_act = "Create Dispatch" if upper_status == "PACKED" else "Track Dispatch"
            next_icon = "truck" if upper_status == "PACKED" else "check"
            doc_dt = r[2] or datetime.now(timezone.utc)
            stream_items.append(
                FulfillmentStreamItem(
                    id=f"ps_{r[0]}",
                    doc_type="PS",
                    doc_number=r[1] or f"PS-{r[0][:6]}",
                    doc_date=doc_dt.strftime("%d %b %Y"),
                    customer_name=r[7] or "Direct Wholesale Customer",
                    item_summary=f"{r[4] or 1} Package(s)",
                    quantity=int(r[4] or 1),
                    value_inr=float(r[8] or 0),
                    formatted_value=f"{float(r[8] or 0):,.2f}",
                    status=status_str,
                    status_color=status_color,
                    next_action=next_act,
                    next_action_icon=next_icon,
                    updated_by=r[5] or "Packing Desk",
                    updated_on=(r[6] or doc_dt).strftime("%d %b %Y, %H:%M"),
                )
            )

        # 13.3 Dispatches
        stmt_stream_ds = (
            select(
                Dispatch.id,
                Dispatch.dispatch_number,
                Dispatch.created_at,
                Dispatch.status,
                Dispatch.courier_partner,
                Dispatch.tracking_number,
                Dispatch.updated_by,
                Dispatch.modified_at,
                SalesInvoice.customer_name,
                SalesInvoice.grand_total,
            )
            .outerjoin(PackingSlip, Dispatch.packing_slip_id == PackingSlip.id)
            .outerjoin(SalesInvoice, PackingSlip.sales_invoice_id == SalesInvoice.id)
            .where(
                Dispatch.company_id == company_id,
                Dispatch.is_deleted == False,
            )
            .order_by(Dispatch.created_at.desc())
            .limit(25)
        )
        ds_rows = (await session.execute(stmt_stream_ds)).all()
        for r in ds_rows:
            status_str = r[3] or "DISPATCHED"
            upper_status = status_str.upper()
            status_color = "emerald" if upper_status == "DELIVERED" else "orange" if upper_status in ("IN_TRANSIT", "DISPATCHED") else "slate"
            next_act = "Confirm Delivery" if upper_status in ("IN_TRANSIT", "DISPATCHED") else "Delivered"
            next_icon = "check-circle" if upper_status in ("IN_TRANSIT", "DISPATCHED") else "check"
            doc_dt = r[2] or datetime.now(timezone.utc)
            tracking_info = f"{r[4] or 'Logistics'} ({r[5] or 'In-Transit'})"
            stream_items.append(
                FulfillmentStreamItem(
                    id=f"ds_{r[0]}",
                    doc_type="DS",
                    doc_number=r[1] or f"DSP-{r[0][:6]}",
                    doc_date=doc_dt.strftime("%d %b %Y"),
                    customer_name=r[8] or "Direct Wholesale Customer",
                    item_summary=tracking_info,
                    quantity=1,
                    value_inr=float(r[9] or 0),
                    formatted_value=f"{float(r[9] or 0):,.2f}",
                    status=status_str,
                    status_color=status_color,
                    next_action=next_act,
                    next_action_icon=next_icon,
                    updated_by=r[6] or "Logistics Team",
                    updated_on=(r[7] or doc_dt).strftime("%d %b %Y, %H:%M"),
                )
            )

        # 13.4 Sales Invoices
        stmt_stream_inv = (
            select(
                SalesInvoice.id,
                SalesInvoice.invoice_no,
                SalesInvoice.date,
                SalesInvoice.customer_name,
                SalesInvoice.grand_total,
                SalesInvoice.status,
                SalesInvoice.updated_by,
                SalesInvoice.modified_at,
                SalesInvoice.created_at,
                SalesInvoice.payment_mode,
            )
            .where(
                SalesInvoice.company_id == company_id,
                SalesInvoice.is_deleted == False,
                or_(SalesInvoice.status.is_(None), func.upper(SalesInvoice.status).notin_(("CANCELLED", "DRAFT"))),
            )
            .order_by(SalesInvoice.created_at.desc())
            .limit(25)
        )
        inv_rows = (await session.execute(stmt_stream_inv)).all()
        for r in inv_rows:
            status_str = r[5] or "Confirmed"
            upper_status = status_str.upper()
            status_color = "emerald" if upper_status in ("CONFIRMED", "POSTED", "SUBMITTED", "COMPLETED") else "slate"
            next_act = "Generate E-Way Bill" if float(r[4] or 0) >= 50000 else "Print Tax Invoice"
            next_icon = "file-text"
            stream_items.append(
                FulfillmentStreamItem(
                    id=f"inv_{r[0]}",
                    doc_type="INV",
                    doc_number=r[1] or f"INV-{r[0][:6]}",
                    doc_date=r[2].strftime("%d %b %Y") if r[2] else "",
                    customer_name=r[3] or "Walk-in Customer",
                    item_summary=f"{r[9] or 'Tax Invoice'}",
                    quantity=1,
                    value_inr=float(r[4] or 0),
                    formatted_value=f"{float(r[4] or 0):,.2f}",
                    status=status_str,
                    status_color=status_color,
                    next_action=next_act,
                    next_action_icon=next_icon,
                    updated_by=r[6] or "Billing Desk",
                    updated_on=(r[7] or r[8] or datetime.now(timezone.utc)).strftime("%d %b %Y, %H:%M"),
                )
            )

        fulfillment_stream = stream_items

        # 14. Load Saved Config
        saved_config = await cls.get_saved_config(session, company_id)

        return VisualReportsSummaryResponse(
            company_name=company_name,
            location_name=location_name,
            date_range_label=date_range_label,
            kpis=kpis,
            stock_flow_timeline=stock_flow,
            workflow_stages=workflow_stages,
            category_positions=category_positions,
            top_reserved_skus=top_skus,
            packing_slip_donut=packing_slip_donut,
            total_packing_slips_count=total_ps_count,
            dispatch_invoice_summary=dispatch_invoice_summary,
            fulfillment_stream=fulfillment_stream,
            config=saved_config,
            is_reconciled=is_reconciled,
            reconciliation_status=reconciliation_status,
            drift_quantity=drift_val,
        )


    @classmethod
    async def get_saved_config(cls, session: AsyncSession, company_id: str) -> DashboardConfigPayload:
        try:
            stmt = select(Dashboard).where(
                Dashboard.code == f"VISUAL_DASH_{company_id}",
                Dashboard.is_deleted == False,
            )
            dash = (await session.execute(stmt)).scalars().first()
            if dash and dash.layout_config:
                return DashboardConfigPayload(**dash.layout_config)
        except Exception:
            pass
        return cls.DEFAULT_CONFIG

    @classmethod
    async def save_config(
        cls,
        session: AsyncSession,
        company_id: str,
        user_id: Optional[str],
        config: DashboardConfigPayload,
    ) -> DashboardConfigPayload:
        code = f"VISUAL_DASH_{company_id}"
        stmt = select(Dashboard).where(Dashboard.code == code, Dashboard.is_deleted == False)
        dash = (await session.execute(stmt)).scalars().first()
        if not dash:
            dash = Dashboard(
                id=f"dsh_{uuid.uuid4().hex[:12]}",
                code=code,
                name="Visual Reports Dashboard",
                category="Operations",
                owner_user_id=user_id or "usr-system",
                is_system_dashboard=True,
                is_shared=True,
                layout_config=config.model_dump(),
            )
            session.add(dash)
        else:
            dash.layout_config = config.model_dump()
        await session.commit()
        return config
