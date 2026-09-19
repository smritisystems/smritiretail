"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.33.0
* Created    : 2026-09-19
* Modified   : 2026-09-19
* Copyright  : © SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
* Classification: Inward Landed Cost Architecture
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

revision: str = "v1478_inward_cost_components_and_allocation_ledger"
down_revision: Union[str, Sequence[str], None] = "v1477_po_cross_vendor_reason_master"
branch_labels = None
depends_on = None

_DEFAULT_COMPONENT_TYPES = [
    ("FREIGHT",            "Inward Freight / Transportation",   "CAPITALIZABLE",   True,  "VALUE",    True,  True),
    ("CARTAGE",            "Local Cartage",                     "CAPITALIZABLE",   True,  "QUANTITY", True,  True),
    ("TRANSPORTATION",     "Linehaul Transportation",           "CAPITALIZABLE",   True,  "VALUE",    True,  True),
    ("LOADING",            "Loading Charges",                   "CAPITALIZABLE",   True,  "QUANTITY", False, False),
    ("UNLOADING",          "Unloading / Hamali Charges",        "CAPITALIZABLE",   True,  "QUANTITY", False, False),
    ("HAMALI",             "Dock Hamali Labor",                 "CAPITALIZABLE",   True,  "QUANTITY", False, False),
    ("INSURANCE",          "Marine / Transit Insurance",        "CAPITALIZABLE",   True,  "VALUE",    True,  False),
    ("PACKING",            "Specialized Protective Packaging",  "CAPITALIZABLE",   True,  "QUANTITY", False, False),
    ("FORWARDING",         "Logistics Forwarding Fee",          "CAPITALIZABLE",   True,  "VALUE",    True,  True),
    ("PACKING_FORWARDING", "Packing & Forwarding (P&F)",        "CAPITALIZABLE",   True,  "VALUE",    False, False),
    ("CUSTOMS_DUTY",       "Basic Customs Duty (Non-Creditable)","NON_CREDITABLE", True,  "VALUE",    True,  False),
    ("ENTRY_DUTY",         "Entry Tax / Toll / Octroi",         "NON_CREDITABLE",  True,  "VALUE",    True,  False),
    ("ENTRY_TOLL",         "Highway / Green Toll",              "NON_CREDITABLE",  True,  "VALUE",    True,  False),
    ("OCTROI",             "Municipal Octroi / Local Cess",     "NON_CREDITABLE",  True,  "VALUE",    True,  False),
    ("PORT_CHARGES",       "Port / Terminal Handling",          "CAPITALIZABLE",   True,  "WEIGHT",   True,  False),
    ("CLEARING_CHARGES",   "CHA Customs Clearing Fee",          "CAPITALIZABLE",   True,  "VALUE",    True,  False),
    ("HANDLING",           "Material Handling Charges",         "CAPITALIZABLE",   True,  "QUANTITY", False, False),
    ("WAREHOUSE_HANDLING", "Warehouse Staging & Stacking",      "CAPITALIZABLE",   True,  "QUANTITY", False, False),
    ("OTHER",              "Other Incidental Acquisition Cost", "CAPITALIZABLE",   True,  "VALUE",    False, False),
]


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. inward_cost_component_types
    if "inward_cost_component_types" not in existing_tables:
        op.create_table(
            "inward_cost_component_types",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("code", sa.String(50), nullable=False, unique=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("category", sa.String(30), nullable=False, server_default=text("'CAPITALIZABLE'")),
            sa.Column("is_capitalizable", sa.Boolean, nullable=False, server_default=text("TRUE")),
            sa.Column("default_allocation_method", sa.String(20), nullable=False, server_default=text("'VALUE'")),
            sa.Column("requires_document", sa.Boolean, nullable=False, server_default=text("FALSE")),
            sa.Column("requires_transporter", sa.Boolean, nullable=False, server_default=text("FALSE")),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=text("TRUE")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
        )

        # Seed initial types
        for code, name, category, is_cap, def_alloc, req_doc, req_trans in _DEFAULT_COMPONENT_TYPES:
            conn.execute(
                text("""
                    INSERT INTO inward_cost_component_types (
                        id, code, name, category, is_capitalizable, default_allocation_method, requires_document, requires_transporter
                    ) VALUES (
                        :id, :code, :name, :category, :is_cap, :def_alloc, :req_doc, :req_trans
                    ) ON CONFLICT (code) DO NOTHING
                """),
                {
                    "id": f"cct_{code.lower()}",
                    "code": code,
                    "name": name,
                    "category": category,
                    "is_cap": is_cap,
                    "def_alloc": def_alloc,
                    "req_doc": req_doc,
                    "req_trans": req_trans,
                }
            )

    # 2. inward_cost_components
    if "inward_cost_components" not in existing_tables:
        op.create_table(
            "inward_cost_components",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("company_id", sa.String(50), nullable=True, index=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("grn_id", sa.String(50), sa.ForeignKey("purchase_receipts.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("component_type", sa.String(50), nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("amount", sa.Numeric(15, 2), nullable=False),
            sa.Column("taxable_amount", sa.Numeric(15, 2), nullable=False),
            sa.Column("tax_amount", sa.Numeric(15, 2), nullable=False, server_default=text("0.00")),
            sa.Column("total_amount", sa.Numeric(15, 2), nullable=False),
            sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default=text("0.00")),
            sa.Column("itc_eligible", sa.Boolean, nullable=False, server_default=text("TRUE")),
            sa.Column("is_capitalizable", sa.Boolean, nullable=False, server_default=text("TRUE")),
            sa.Column("allocation_method", sa.String(20), nullable=False, server_default=text("'VALUE'")),
            sa.Column("allocation_scope", sa.String(20), nullable=False, server_default=text("'DOCUMENT'")),
            sa.Column("scope_reference_id", sa.String(50), nullable=True),
            sa.Column("transporter_name", sa.String(150), nullable=True),
            sa.Column("document_type", sa.String(30), nullable=True),
            sa.Column("document_no", sa.String(100), nullable=True),
            sa.Column("document_date", sa.Date, nullable=True),
            sa.Column("vehicle_no", sa.String(50), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default=text("'ALLOCATED'")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
            sa.Column("created_by", sa.String(50), nullable=True),
        )

    # 3. inward_cost_allocations
    if "inward_cost_allocations" not in existing_tables:
        op.create_table(
            "inward_cost_allocations",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("company_id", sa.String(50), nullable=True, index=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("grn_id", sa.String(50), nullable=False, index=True),
            sa.Column("grn_item_id", sa.String(50), sa.ForeignKey("purchase_receipt_items.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("cost_component_id", sa.String(50), sa.ForeignKey("inward_cost_components.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("product_id", sa.String(50), nullable=False, index=True),
            sa.Column("allocation_method", sa.String(20), nullable=False),
            sa.Column("basis_value", sa.Numeric(15, 4), nullable=False),
            sa.Column("allocated_amount", sa.Numeric(15, 2), nullable=False),
            sa.Column("allocated_per_unit", sa.Numeric(15, 4), nullable=False),
            sa.Column("rounding_adjustment", sa.Numeric(15, 4), nullable=False, server_default=text("0.0000")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
        )

    # 4. inward_cost_adjustments
    if "inward_cost_adjustments" not in existing_tables:
        op.create_table(
            "inward_cost_adjustments",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("company_id", sa.String(50), nullable=True, index=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("adjustment_no", sa.String(50), nullable=False, unique=True),
            sa.Column("grn_id", sa.String(50), sa.ForeignKey("purchase_receipts.id", ondelete="RESTRICT"), nullable=False, index=True),
            sa.Column("total_adjustment_amount", sa.Numeric(15, 2), nullable=False),
            sa.Column("reason", sa.Text, nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default=text("'POSTED'")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
            sa.Column("created_by", sa.String(50), nullable=True),
        )


def downgrade() -> None:
    op.drop_table("inward_cost_adjustments")
    op.drop_table("inward_cost_allocations")
    op.drop_table("inward_cost_components")
    op.drop_table("inward_cost_component_types")
