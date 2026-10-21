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

from ..models.fulfillment import PackingSlip, Dispatch
from ..models.inventory import Product, StockMovement
from ..models.sales import SalesInvoice, SalesOrder, SalesOrderReservation
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

        # 2. On-Hand Stock from StockMovement Ledger with Signed Quantity CASE
        signed_qty_expr = get_signed_movement_quantity_expr()
        stmt_on_hand = (
            select(func.coalesce(func.sum(signed_qty_expr), 0))
            .where(
                StockMovement.company_id == company_id,
                StockMovement.is_deleted == False,
            )
        )
        if store_location_id and store_location_id != "All Locations":
            stmt_on_hand = stmt_on_hand.where(
                or_(StockMovement.warehouse_id == store_location_id, StockMovement.location_id == store_location_id)
            )
        total_on_hand = float((await session.execute(stmt_on_hand)).scalar() or 0)

        # 3. Reserved Stock from SalesOrderReservation Ledger
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

        # 7. Workflow Stage Progress (POS flows do not divide by 0 sales orders)
        if so_count > 0:
            base = so_count
            so_pct = 100
            ps_pct = round((ps_count / base) * 100)
            ds_pct = round((ds_count / base) * 100)
            inv_pct = round((inv_count / base) * 100)
            so_subtext = f"Total: {so_count} recorded"
            ps_subtext = f"{ps_pct}% of sales orders"
            ds_subtext = f"{ds_pct}% of sales orders"
            inv_subtext = f"{inv_pct}% of sales orders"
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

        # 8. Category Stock Position with Signed Quantity
        stmt_cat = (
            select(
                Product.category,
                func.coalesce(func.sum(signed_qty_expr), 0).label("cat_on_hand"),
            )
            .outerjoin(
                StockMovement,
                and_(
                    StockMovement.product_id == Product.id,
                    StockMovement.company_id == company_id,
                    StockMovement.is_deleted == False,
                ),
            )
            .where(Product.company_id == company_id, Product.is_deleted == False)
            .group_by(Product.category)
            .order_by(func.coalesce(func.sum(signed_qty_expr), 0).desc())
        )
        cat_rows = (await session.execute(stmt_cat)).all()
        category_positions = [
            CategoryStockPosition(
                category=r[0] or "Uncategorized",
                on_hand=int(r[1]),
                reserved=0,
                available=max(0, int(r[1])),
                reserved_pct=0.0,
            )
            for r in cat_rows
            if r[0] is not None
        ]

        # 9. Top Reserved SKUs with Subqueries to Prevent Cartesian Row Multiplication
        mv_sub = (
            select(
                StockMovement.product_id,
                func.coalesce(func.sum(signed_qty_expr), 0).label("on_hand"),
            )
            .where(
                StockMovement.company_id == company_id,
                StockMovement.is_deleted == False,
            )
            .group_by(StockMovement.product_id)
            .subquery()
        )

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
                Product.sku,
                Product.name,
                func.coalesce(mv_sub.c.on_hand, 0).label("on_hand"),
                res_sub.c.reserved.label("reserved"),
            )
            .join(res_sub, res_sub.c.product_id == Product.id)
            .outerjoin(mv_sub, mv_sub.c.product_id == Product.id)
            .where(Product.company_id == company_id, Product.is_deleted == False)
            .order_by(res_sub.c.reserved.desc())
            .limit(10)
        )
        top_res_rows = (await session.execute(stmt_top_res)).all()
        top_skus = [
            TopReservedSku(
                rank=i + 1,
                sku=r[0] or f"SKU-{i+1}",
                product_name=r[1] or "Product",
                on_hand=int(r[2]),
                reserved=int(r[3]),
                reserved_pct=round((float(r[3]) / max(float(r[2]), 1.0)) * 100, 1),
            )
            for i, r in enumerate(top_res_rows)
        ]

        # 10. Packing Slip Donut Slices
        stmt_donut = (
            select(PackingSlip.status, func.count(PackingSlip.id))
            .where(
                PackingSlip.company_id == company_id,
                PackingSlip.is_deleted == False,
            )
            .group_by(PackingSlip.status)
        )
        donut_rows = (await session.execute(stmt_donut)).all()
        total_ps = sum(r[1] for r in donut_rows)
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
                percentage=round((r[1] / max(total_ps, 1)) * 100, 1),
                color=color_map.get(str(r[0]).upper(), "#2563eb"),
            )
            for r in donut_rows
        ]

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

        # 13. Active Fulfillment Stream (Real Open Documents)
        fulfillment_stream: List[FulfillmentStreamItem] = []

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
            total_packing_slips_count=ps_count,
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
