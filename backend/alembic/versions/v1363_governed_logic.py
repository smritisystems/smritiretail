"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

FORWARD-ONLY MIGRATION -- Governed Logic, Versioned Formulas, Rules, Policies & Workflows (P1.4 / P1.5)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "v1363_governed_logic"
down_revision: Union[str, None] = "v1362_platform_capabilities"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. formula_definitions
    if "formula_definitions" not in tables:
        op.create_table(
            "formula_definitions",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("code", sa.String(100), nullable=False, index=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("category", sa.String(50), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("expression_ast", JSONB, nullable=False),
            sa.Column("parameters_schema", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
            sa.UniqueConstraint("code", "version", name="uq_formula_code_version")
        )
        op.create_index("ix_formula_cat_status", "formula_definitions", ["category", "status"])

    # 2. business_rule_definitions
    if "business_rule_definitions" not in tables:
        op.create_table(
            "business_rule_definitions",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("code", sa.String(100), nullable=False, index=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("rule_type", sa.String(50), nullable=False),
            sa.Column("priority", sa.Integer(), server_default="100", nullable=False),
            sa.Column("conditions", JSONB, nullable=False),
            sa.Column("actions", JSONB, nullable=False),
            sa.Column("scopes", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
            sa.UniqueConstraint("code", "version", name="uq_business_rule_code_version")
        )
        op.create_index("ix_brule_type_status", "business_rule_definitions", ["rule_type", "status"])

    # 3. policy_definitions
    if "policy_definitions" not in tables:
        op.create_table(
            "policy_definitions",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("code", sa.String(100), nullable=False, index=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("policy_type", sa.String(50), nullable=False),
            sa.Column("parameters", JSONB, nullable=False),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
            sa.UniqueConstraint("code", "version", name="uq_policy_code_version")
        )
        op.create_index("ix_policy_type_status", "policy_definitions", ["policy_type", "status"])

    # 4. workflow_definitions
    if "workflow_definitions" not in tables:
        op.create_table(
            "workflow_definitions",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("code", sa.String(100), nullable=False, index=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("doc_type", sa.String(50), nullable=False, index=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("initial_state", sa.String(50), server_default="DRAFT", nullable=False),
            sa.Column("states", JSONB, nullable=False),
            sa.Column("transitions", JSONB, nullable=False),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
            sa.UniqueConstraint("code", "version", name="uq_workflow_code_version")
        )
        op.create_index("ix_workflow_doc_status", "workflow_definitions", ["doc_type", "status"])


def downgrade():
    raise NotImplementedError(
        "v1363_governed_logic is a FORWARD-ONLY migration. "
        "Downgrade is blocked by SMRITI Data Governance Policy."
    )
