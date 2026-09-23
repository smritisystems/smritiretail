"""Add cryptographic hash chain and forensic fields to compliance_immutable_audit_logs.

Enhances the compliance audit trail with cryptographic SHA-256 block chaining,
forensic request correlation IDs, client user agent tracking, and statutory
WORM immutable retention policy flags per SMRITI Section 12 requirements.

Revision ID  : v1485_audit_log_hash_chain
Revises      : v1484_kpi_definitions_table
Create Date  : 2026-09-24
"""
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 1.0.0
# Created      : 2026-09-24
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software

from alembic import op
import sqlalchemy as sa

revision = "v1485_audit_log_hash_chain"
down_revision = "v1484_kpi_definitions_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "compliance_immutable_audit_logs",
        sa.Column("previous_hash", sa.String(64), nullable=True),
    )
    op.add_column(
        "compliance_immutable_audit_logs",
        sa.Column("hash_chain_verified", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "compliance_immutable_audit_logs",
        sa.Column("request_id", sa.String(100), nullable=True),
    )
    op.add_column(
        "compliance_immutable_audit_logs",
        sa.Column("client_user_agent", sa.String(255), nullable=True),
    )
    op.add_column(
        "compliance_immutable_audit_logs",
        sa.Column("retention_policy", sa.String(50), nullable=False, server_default="STATUTORY_7_YEARS"),
    )
    op.add_column(
        "compliance_immutable_audit_logs",
        sa.Column("worm_locked", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_index(
        "ix_compliance_audit_prev_hash",
        "compliance_immutable_audit_logs",
        ["previous_hash"],
        unique=False,
    )
    op.create_index(
        "ix_compliance_audit_req_id",
        "compliance_immutable_audit_logs",
        ["request_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_compliance_audit_req_id", table_name="compliance_immutable_audit_logs")
    op.drop_index("ix_compliance_audit_prev_hash", table_name="compliance_immutable_audit_logs")
    op.drop_column("compliance_immutable_audit_logs", "worm_locked")
    op.drop_column("compliance_immutable_audit_logs", "retention_policy")
    op.drop_column("compliance_immutable_audit_logs", "client_user_agent")
    op.drop_column("compliance_immutable_audit_logs", "request_id")
    op.drop_column("compliance_immutable_audit_logs", "hash_chain_verified")
    op.drop_column("compliance_immutable_audit_logs", "previous_hash")
