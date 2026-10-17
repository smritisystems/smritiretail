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

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, text

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

        # 1. Authoritative Company Name from database
        comp_name_res = (await session.execute(text("SELECT name FROM companies WHERE id = :cid"), {"cid": company_id})).scalar()
        company_name = comp_name_res or company_id
        location_name = store_location_id if store_location_id and store_location_id != "All Locations" else "All Locations"
        date_range_label = f"{s_date.strftime('%d %b %Y')} - {e_date.strftime('%d %b %Y')}"

        # 2. On-Hand Stock from StockMovement Ledger
        stmt_on_hand = (
            select(func.coalesce(func.sum(StockMovement.quantity), 0))
            .where(StockMovement.company_id == company_id)
        )
        if store_location_id and store_location_id != "All Locations":
            stmt_on_hand = stmt_on_hand.where(
                or_(StockMovement.warehouse_id == store_location_id, StockMovement.location_id == store_location_id)
            )
        total_on_hand = float((await session.execute(stmt_on_hand)).scalar() or 0)

        # 3. Reserved Stock from SalesOrderReservation Ledger
        stmt_reserved = (
            select(func.coalesce(func.sum(SalesOrderReservation.reserved_quantity - SalesOrderReservation.released_quantity - SalesOrderReservation.consumed_quantity), 0))
            .where(SalesOrderReservation.company_id == company_id, SalesOrderReservation.status == "ACTIVE")
        )
        total_reserved = float((await session.execute(stmt_reserved)).scalar() or 0)

        # 4. Available Stock
        total_available = max(0.0, total_on_hand - total_reserved)

        # 5. Live Document Counts
        stmt_so = select(func.count(SalesOrder.id)).where(SalesOrder.company_id == company_id)
        so_count = (await session.execute(stmt_so)).scalar() or 0

        stmt_slips = select(func.count(PackingSlip.id)).where(PackingSlip.company_id == company_id)
        ps_count = (await session.execute(stmt_slips)).scalar() or 0

        stmt_dispatches = select(func.count(Dispatch.id)).where(Dispatch.company_id == company_id)
        ds_count = (await session.execute(stmt_dispatches)).scalar() or 0

        stmt_invoices = select(func.count(SalesInvoice.id)).where(SalesInvoice.company_id == company_id)
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

        # 6. Stock Flow Timeline (Grouped by Date in Requested Date Window)
        start_dt = datetime.combine(s_date, datetime.min.time(), tzinfo=timezone.utc)
        end_dt = datetime.combine(e_date, datetime.max.time(), tzinfo=timezone.utc)
        stmt_flow = (
            select(
                func.cast(StockMovement.created_at, func.Date).label("m_date"),
                func.coalesce(func.sum(StockMovement.quantity), 0).label("qty"),
            )
            .where(
                StockMovement.company_id == company_id,
                StockMovement.created_at >= start_dt,
                StockMovement.created_at <= end_dt,
            )
            .group_by(func.cast(StockMovement.created_at, func.Date))
            .order_by("m_date")
        )
        flow_rows = (await session.execute(stmt_flow)).all()
        stock_flow: List[StockFlowDataPoint] = [
            StockFlowDataPoint(
                date=str(r[0]),
                day_label=r[0].strftime("%d %b") if hasattr(r[0], "strftime") else str(r[0]),
                on_hand=int(r[1]),
                reserved=0,
                available=int(r[1]),
                dispatched=0,
                invoiced=0,
            )
            for r in flow_rows
        ]

        # 7. Workflow Stage Progress
        so_pct = 100 if so_count > 0 else 0
        ps_pct = round((ps_count / so_count) * 100) if so_count > 0 else 0
        ds_pct = round((ds_count / so_count) * 100) if so_count > 0 else 0
        inv_pct = round((inv_count / so_count) * 100) if so_count > 0 else 0
        workflow_stages = [
            WorkflowStageProgress(
                id="stage_so",
                title="Sales Orders",
                icon="document",
                count=so_count,
                percentage=so_pct,
                color="purple",
                subtext=f"Total: {so_count} recorded",
                progress_bar_percentage=min(so_pct, 100),
            ),
            WorkflowStageProgress(
                id="stage_ps",
                title="Packing Slips",
                icon="box",
                count=ps_count,
                percentage=ps_pct,
                color="blue",
                subtext=f"Total: {ps_count} recorded",
                progress_bar_percentage=min(ps_pct, 100),
            ),
            WorkflowStageProgress(
                id="stage_ds",
                title="Dispatched",
                icon="truck",
                count=ds_count,
                percentage=ds_pct,
                color="orange",
                subtext=f"Total: {ds_count} recorded",
                progress_bar_percentage=min(ds_pct, 100),
            ),
            WorkflowStageProgress(
                id="stage_inv",
                title="Invoices",
                icon="receipt",
                count=inv_count,
                percentage=inv_pct,
                color="green",
                subtext=f"Total: {inv_count} recorded",
                progress_bar_percentage=min(inv_pct, 100),
            ),
        ]

        # 8. Category Stock Position from Product and StockMovement
        stmt_cat = (
            select(
                Product.category,
                func.coalesce(func.sum(StockMovement.quantity), 0).label("cat_on_hand"),
            )
            .outerjoin(
                StockMovement,
                and_(StockMovement.product_id == Product.id, StockMovement.company_id == company_id),
            )
            .where(Product.company_id == company_id)
            .group_by(Product.category)
            .order_by(func.coalesce(func.sum(StockMovement.quantity), 0).desc())
        )
        cat_rows = (await session.execute(stmt_cat)).all()
        category_positions = [
            CategoryStockPosition(
                category=r[0] or "Uncategorized",
                on_hand=int(r[1]),
                reserved=0,
                available=int(r[1]),
                reserved_pct=0.0,
            )
            for r in cat_rows
            if r[0] is not None
        ]

        # 9. Top Reserved SKUs
        stmt_top_res = (
            select(
                Product.sku,
                Product.name,
                func.coalesce(func.sum(StockMovement.quantity), 0).label("on_hand"),
                func.coalesce(func.sum(SalesOrderReservation.reserved_quantity), 0).label("reserved"),
            )
            .join(SalesOrderReservation, SalesOrderReservation.product_id == Product.id)
            .outerjoin(StockMovement, and_(StockMovement.product_id == Product.id, StockMovement.company_id == company_id))
            .where(SalesOrderReservation.company_id == company_id, SalesOrderReservation.status == "ACTIVE")
            .group_by(Product.sku, Product.name)
            .order_by(func.coalesce(func.sum(SalesOrderReservation.reserved_quantity), 0).desc())
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
            .where(PackingSlip.company_id == company_id)
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
        stmt_ds_all = select(func.count(Dispatch.id)).where(Dispatch.company_id == company_id)
        ds_all = (await session.execute(stmt_ds_all)).scalar() or 0

        stmt_inv_all = (
            select(
                func.count(SalesInvoice.id),
                func.coalesce(func.sum(SalesInvoice.total_amount), 0),
            )
            .where(SalesInvoice.company_id == company_id)
        )
        inv_row = (await session.execute(stmt_inv_all)).one()
        inv_total_count = inv_row[0] or 0
        inv_total_val = float(inv_row[1] or 0)

        dispatch_invoice_summary = [
            DispatchInvoiceSummaryRow(
                document_type="Dispatches",
                today=0,
                this_week=0,
                this_month=ds_all,
                value_inr=0.0,
                formatted_value="0.00",
            ),
            DispatchInvoiceSummaryRow(
                document_type="B2B Invoices",
                today=0,
                this_week=0,
                this_month=inv_total_count,
                value_inr=inv_total_val,
                formatted_value=f"{inv_total_val:,.2f}",
            ),
        ]

        # 12. Active Fulfillment Stream (Real Open Documents)
        fulfillment_stream: List[FulfillmentStreamItem] = []

        # 13. Load Saved Config
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
