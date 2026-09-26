"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.20.0
Created      : 2026-09-14
Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical E-Way Bill 2026 Statutory Schema
"""

"""Canonical E-Way Bill 2026 Upgrade and Multi-Tenant Parity Schema.

Revision ID: v1452_canonical_eway_bills_2026
Revises: v1451_add_item_governed_dimension_columns
Create Date: 2026-09-14
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "v1452_canonical_eway_bills_2026"
down_revision: Union[str, Sequence[str], None] = "v1451_add_item_governed_dimension_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "eway_bills" not in existing_tables:
        op.create_table(
            "eway_bills",
            sa.Column("id", sa.String(50), primary_key=True, nullable=False),
            sa.Column("uuid", sa.String(36), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("eway_bill_no", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=True),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=True),
        )
        inspector = sa.inspect(bind)

    existing_cols = {col["name"] for col in inspector.get_columns("eway_bills")}

    # Define all canonical statutory columns required for 2026 NIC E-Way Bill compliance
    columns_definitions = [
        # Document Linkage & Aliases
        ("document_type", sa.Column("document_type", sa.String(50), server_default="INVOICE", nullable=True)),
        ("document_id", sa.Column("document_id", sa.String(50), nullable=True)),
        ("document_no", sa.Column("document_no", sa.String(50), nullable=True)),
        ("document_date", sa.Column("document_date", sa.Date(), nullable=True)),
        ("invoice_id", sa.Column("invoice_id", sa.String(50), nullable=True)),
        
        # Transaction & Supply Classification
        ("supply_type", sa.Column("supply_type", sa.String(10), server_default="O", nullable=True)),
        ("sub_supply_type", sa.Column("sub_supply_type", sa.Integer(), server_default="1", nullable=True)),
        ("sub_supply_desc", sa.Column("sub_supply_desc", sa.String(100), nullable=True)),
        ("trans_type", sa.Column("trans_type", sa.Integer(), server_default="1", nullable=True)),
        
        # Bill From / Consignor
        ("gstin_from", sa.Column("gstin_from", sa.String(15), nullable=True)),
        ("trade_name_from", sa.Column("trade_name_from", sa.String(200), nullable=True)),
        ("state_code_from", sa.Column("state_code_from", sa.Integer(), nullable=True)),
        
        # Bill To / Consignee
        ("gstin_to", sa.Column("gstin_to", sa.String(15), nullable=True)),
        ("trade_name_to", sa.Column("trade_name_to", sa.String(200), nullable=True)),
        ("state_code_to", sa.Column("state_code_to", sa.Integer(), nullable=True)),
        
        # Dispatch From / Physical Origin Snapshot
        ("dispatch_from_gstin", sa.Column("dispatch_from_gstin", sa.String(15), nullable=True)),
        ("dispatch_from_trade_name", sa.Column("dispatch_from_trade_name", sa.String(200), nullable=True)),
        ("dispatch_from_place", sa.Column("dispatch_from_place", sa.String(100), nullable=True)),
        ("dispatch_from_pincode", sa.Column("dispatch_from_pincode", sa.String(10), nullable=True)),
        ("dispatch_from_state_code", sa.Column("dispatch_from_state_code", sa.Integer(), nullable=True)),
        ("dispatch_from_addr1", sa.Column("dispatch_from_addr1", sa.Text(), nullable=True)),
        ("dispatch_from_addr2", sa.Column("dispatch_from_addr2", sa.Text(), nullable=True)),
        
        # Ship To / Physical Delivery Site Snapshot
        ("ship_to_gstin", sa.Column("ship_to_gstin", sa.String(15), nullable=True)),
        ("ship_to_trade_name", sa.Column("ship_to_trade_name", sa.String(200), nullable=True)),
        ("ship_to_place", sa.Column("ship_to_place", sa.String(100), nullable=True)),
        ("ship_to_pincode", sa.Column("ship_to_pincode", sa.String(10), nullable=True)),
        ("ship_to_state_code", sa.Column("ship_to_state_code", sa.Integer(), nullable=True)),
        ("ship_to_addr1", sa.Column("ship_to_addr1", sa.Text(), nullable=True)),
        ("ship_to_addr2", sa.Column("ship_to_addr2", sa.Text(), nullable=True)),
        
        # Consignment Commercials & Tax Breakdown
        ("total_taxable_amount", sa.Column("total_taxable_amount", sa.Numeric(15, 2), server_default="0.00", nullable=True)),
        ("cgst_amount", sa.Column("cgst_amount", sa.Numeric(15, 2), server_default="0.00", nullable=True)),
        ("sgst_amount", sa.Column("sgst_amount", sa.Numeric(15, 2), server_default="0.00", nullable=True)),
        ("igst_amount", sa.Column("igst_amount", sa.Numeric(15, 2), server_default="0.00", nullable=True)),
        ("cess_amount", sa.Column("cess_amount", sa.Numeric(15, 2), server_default="0.00", nullable=True)),
        ("other_amount", sa.Column("other_amount", sa.Numeric(15, 2), server_default="0.00", nullable=True)),
        ("consignment_value", sa.Column("consignment_value", sa.Numeric(15, 2), server_default="0.00", nullable=True)),
        ("document_value", sa.Column("document_value", sa.Numeric(15, 2), server_default="0.00", nullable=True)),
        ("main_hsn_code", sa.Column("main_hsn_code", sa.String(20), nullable=True)),
        
        # Transport Logistics (Part-B)
        ("transporter_id", sa.Column("transporter_id", sa.String(50), nullable=True)),
        ("transporter_name", sa.Column("transporter_name", sa.String(200), nullable=True)),
        ("transport_mode", sa.Column("transport_mode", sa.String(10), server_default="1", nullable=True)),
        ("trans_doc_no", sa.Column("trans_doc_no", sa.String(50), nullable=True)),
        ("trans_doc_date", sa.Column("trans_doc_date", sa.Date(), nullable=True)),
        ("vehicle_no", sa.Column("vehicle_no", sa.String(30), nullable=True)),
        ("vehicle_number", sa.Column("vehicle_number", sa.String(30), nullable=True)),
        ("vehicle_type", sa.Column("vehicle_type", sa.String(10), server_default="R", nullable=True)),
        ("distance_km", sa.Column("distance_km", sa.Numeric(10, 2), server_default="0.00", nullable=True)),
        ("part_b_status", sa.Column("part_b_status", sa.String(20), server_default="PENDING", nullable=True)),
        
        # Statutory Lifecycle, Validity & Verification
        ("irn", sa.Column("irn", sa.String(64), nullable=True)),
        ("ewb_date", sa.Column("ewb_date", sa.DateTime(timezone=True), nullable=True)),
        ("valid_from", sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True)),
        ("valid_until", sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True)),
        ("status", sa.Column("status", sa.String(30), server_default="GENERATED", nullable=True)),
        ("signed_qr_code", sa.Column("signed_qr_code", sa.Text(), nullable=True)),
        ("cancel_date", sa.Column("cancel_date", sa.DateTime(timezone=True), nullable=True)),
        ("cancel_reason_code", sa.Column("cancel_reason_code", sa.String(20), nullable=True)),
        ("cancel_remarks", sa.Column("cancel_remarks", sa.Text(), nullable=True)),
        ("nic_payload_snapshot", sa.Column("nic_payload_snapshot", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=True)),
        ("nic_response_snapshot", sa.Column("nic_response_snapshot", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=True)),
    ]

    for col_name, col_obj in columns_definitions:
        if col_name not in existing_cols:
            op.add_column("eway_bills", col_obj)

    # Ensure 100% nullability parity across smritisys and tenant databases
    legacy_not_null_cols = ["document_type", "document_id", "gstin_from", "gstin_to", "document_value", "status", "eway_bill_no"]
    for col in legacy_not_null_cols:
        if col in existing_cols:
            try:
                op.alter_column("eway_bills", col, nullable=True)
            except Exception:
                pass

    # Cross-sync aliases for 100% interoperability across old & new code
    op.execute("UPDATE eway_bills SET document_id = invoice_id WHERE document_id IS NULL AND invoice_id IS NOT NULL")
    op.execute("UPDATE eway_bills SET invoice_id = document_id WHERE invoice_id IS NULL AND document_id IS NOT NULL")
    op.execute("UPDATE eway_bills SET document_value = consignment_value WHERE document_value IS NULL AND consignment_value IS NOT NULL")
    op.execute("UPDATE eway_bills SET consignment_value = document_value WHERE consignment_value IS NULL AND document_value IS NOT NULL")
    op.execute("UPDATE eway_bills SET vehicle_number = vehicle_no WHERE vehicle_number IS NULL AND vehicle_no IS NOT NULL")
    op.execute("UPDATE eway_bills SET vehicle_no = vehicle_number WHERE vehicle_no IS NULL AND vehicle_number IS NOT NULL")

    # Indexes
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("eway_bills")}
    if "ix_eway_bills_no" not in existing_indexes:
        op.create_index("ix_eway_bills_no", "eway_bills", ["eway_bill_no"])
    if "ix_eway_bills_document_id" not in existing_indexes:
        op.create_index("ix_eway_bills_document_id", "eway_bills", ["document_id"])
    if "ix_eway_bills_invoice_id" not in existing_indexes:
        op.create_index("ix_eway_bills_invoice_id", "eway_bills", ["invoice_id"])
    if "ix_eway_bills_irn" not in existing_indexes:
        op.create_index("ix_eway_bills_irn", "eway_bills", ["irn"])


def downgrade() -> None:
    pass
