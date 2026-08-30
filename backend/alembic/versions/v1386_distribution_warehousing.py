"""v1386 -- Distribution, Warehousing, and Item Tracking tables.

Revision ID: v1386_distribution_warehousing
Revises: v1385_crm_and_approvals
Create Date: 2026-08-30 00:00:01.000000

Project      : SMRITI Retail OS
Author       : Migration Integrity Protocol
Description  : Add Distribution routes, settlements, claims, Loading sheets, Item batch/serial tracking, and eWay bills for v3.25.0 canonical schema.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'v1386_dist'
down_revision = 'v1385_crm'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # distribution_routes - Delivery routes for van sales
    op.create_table(
        'distribution_routes',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('route_code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('territory_code', sa.String(50), nullable=False),
        sa.Column('assigned_salesman_id', sa.String(50), nullable=True),
        sa.Column('assigned_driver_id', sa.String(50), nullable=True),
        sa.Column('vehicle_number', sa.String(30), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='ACTIVE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('route_code', name='uq_dist_route_code'),
        schema='public'
    )
    op.create_index(op.f('ix_distribution_routes_territory_code'), 'distribution_routes', ['territory_code'], unique=False, schema='public')

    # distribution_route_stops - Retailer stops on routes
    op.create_table(
        'distribution_route_stops',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('route_id', sa.String(50), nullable=False),
        sa.Column('party_id', sa.String(50), nullable=False),
        sa.Column('stop_sequence', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('planned_time', sa.String(10), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['route_id'], ['distribution_routes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['party_id'], ['parties.id'], ondelete='RESTRICT'),
        schema='public'
    )
    op.create_index(op.f('ix_distribution_route_stops_route_id'), 'distribution_route_stops', ['route_id'], unique=False, schema='public')
    op.create_index(op.f('ix_distribution_route_stops_party_id'), 'distribution_route_stops', ['party_id'], unique=False, schema='public')

    # distribution_claims - Dealer claims for damage, expiry, etc.
    op.create_table(
        'distribution_claims',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('claim_no', sa.String(50), nullable=False),
        sa.Column('party_id', sa.String(50), nullable=False),
        sa.Column('claim_type', sa.String(50), nullable=False),
        sa.Column('reference_order_no', sa.String(100), nullable=True),
        sa.Column('claim_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('approved_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='SUBMITTED'),
        sa.Column('reviewed_by', sa.String(50), nullable=True),
        sa.Column('settlement_credit_note_id', sa.String(50), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('claim_no', name='uq_dist_claim_no'),
        sa.ForeignKeyConstraint(['party_id'], ['parties.id'], ondelete='RESTRICT'),
        schema='public'
    )
    op.create_index(op.f('ix_distribution_claims_reference_order'), 'distribution_claims', ['reference_order_no'], unique=False, schema='public')

    # loading_sheets - Vehicle loading consolidation (must come BEFORE distribution_settlements)
    op.create_table(
        'loading_sheets',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('sheet_no', sa.String(50), nullable=False),
        sa.Column('route_id', sa.String(50), nullable=True),
        sa.Column('vehicle_number', sa.String(30), nullable=True),
        sa.Column('driver_name', sa.String(100), nullable=True),
        sa.Column('dispatch_date', sa.Date(), server_default=sa.text('CURRENT_DATE'), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='PLANNED'),
        sa.Column('total_orders_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_boxes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_value', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sheet_no', name='uq_loading_sheet_no'),
        sa.ForeignKeyConstraint(['route_id'], ['distribution_routes.id'], ondelete='SET NULL'),
        schema='public'
    )

    # distribution_settlements - Route settlement with cash/credit (after loading_sheets is created)
    op.create_table(
        'distribution_settlements',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('settlement_no', sa.String(50), nullable=False),
        sa.Column('loading_sheet_id', sa.String(50), nullable=True),
        sa.Column('route_id', sa.String(50), nullable=True),
        sa.Column('driver_id', sa.String(50), nullable=True),
        sa.Column('salesman_id', sa.String(50), nullable=True),
        sa.Column('total_sales_value', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('cash_collected', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('cheques_collected', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('upi_collected', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('credit_extended', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('returned_stock_value', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('shortage_excess_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('status', sa.String(30), nullable=False, server_default='DRAFT'),
        sa.Column('settled_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('settlement_no', name='uq_dist_settlement_no'),
        sa.ForeignKeyConstraint(['loading_sheet_id'], ['loading_sheets.id'], ondelete='RESTRICT'),
        schema='public'
    )

    # loading_sheet_items - Consolidated items on loading sheet
    op.create_table(
        'loading_sheet_items',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('loading_sheet_id', sa.String(50), nullable=False),
        sa.Column('order_id', sa.String(50), nullable=False),
        sa.Column('item_id', sa.String(50), nullable=False),
        sa.Column('loaded_quantity', sa.Numeric(12, 4), nullable=False, server_default='0.0000'),
        sa.Column('returned_quantity', sa.Numeric(12, 4), nullable=False, server_default='0.0000'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['loading_sheet_id'], ['loading_sheets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_id'], ['distribution_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='RESTRICT'),
        schema='public'
    )
    op.create_index(op.f('ix_loading_sheet_items_loading_sheet'), 'loading_sheet_items', ['loading_sheet_id'], unique=False, schema='public')
    op.create_index(op.f('ix_loading_sheet_items_order'), 'loading_sheet_items', ['order_id'], unique=False, schema='public')
    op.create_index(op.f('ix_loading_sheet_items_item'), 'loading_sheet_items', ['item_id'], unique=False, schema='public')

    # item_batches - Batch & lot tracking for perishables
    op.create_table(
        'item_batches',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('item_id', sa.String(50), nullable=False),
        sa.Column('variant_id', sa.String(50), nullable=True),
        sa.Column('batch_number', sa.String(100), nullable=False),
        sa.Column('mfg_date', sa.Date(), nullable=True),
        sa.Column('exp_date', sa.Date(), nullable=True),
        sa.Column('mrp', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('cost_price', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('item_id', 'batch_number', name='uq_item_batch_no'),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'], ['item_variants.id'], ondelete='CASCADE'),
        schema='public'
    )
    op.create_index(op.f('ix_item_batches_item_id'), 'item_batches', ['item_id'], unique=False, schema='public')
    op.create_index(op.f('ix_item_batches_batch_number'), 'item_batches', ['batch_number'], unique=False, schema='public')

    # item_serials - Unique serial number tracking
    op.create_table(
        'item_serials',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('item_id', sa.String(50), nullable=False),
        sa.Column('variant_id', sa.String(50), nullable=True),
        sa.Column('serial_number', sa.String(100), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='AVAILABLE'),
        sa.Column('warehouse_id', sa.String(50), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('item_id', 'serial_number', name='uq_item_serial_no'),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'], ['item_variants.id'], ondelete='CASCADE'),
        schema='public'
    )
    op.create_index(op.f('ix_item_serials_item_id'), 'item_serials', ['item_id'], unique=False, schema='public')
    op.create_index(op.f('ix_item_serials_serial_number'), 'item_serials', ['serial_number'], unique=False, schema='public')

    # item_warehouse_locations - Multi-warehouse bin configuration
    op.create_table(
        'item_warehouse_locations',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('item_id', sa.String(50), nullable=False),
        sa.Column('warehouse_id', sa.String(50), nullable=False),
        sa.Column('location_bin', sa.String(50), nullable=True),
        sa.Column('min_reorder_level', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('max_capacity', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('reorder_quantity', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('item_id', 'warehouse_id', name='uq_item_warehouse'),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='CASCADE'),
        schema='public'
    )

    # eway_bills - E-way bill tracking for GST compliance
    op.create_table(
        'eway_bills',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('eway_bill_no', sa.String(50), nullable=False),
        sa.Column('document_type', sa.String(50), nullable=False),
        sa.Column('document_id', sa.String(50), nullable=False),
        sa.Column('gstin_from', sa.String(15), nullable=False),
        sa.Column('gstin_to', sa.String(15), nullable=False),
        sa.Column('transporter_id', sa.String(50), nullable=True),
        sa.Column('vehicle_number', sa.String(30), nullable=True),
        sa.Column('document_value', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('status', sa.String(30), nullable=False, server_default='GENERATED'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('eway_bill_no', name='uq_eway_bill_no'),
        schema='public'
    )


def downgrade() -> None:
    op.drop_table('eway_bills', schema='public')
    op.drop_table('item_warehouse_locations', schema='public')
    op.drop_table('item_serials', schema='public')
    op.drop_table('item_batches', schema='public')
    op.drop_table('loading_sheet_items', schema='public')
    op.drop_table('distribution_settlements', schema='public')  # Must come BEFORE loading_sheets
    op.drop_table('loading_sheets', schema='public')
    op.drop_table('distribution_claims', schema='public')
    op.drop_table('distribution_route_stops', schema='public')
    op.drop_table('distribution_routes', schema='public')
