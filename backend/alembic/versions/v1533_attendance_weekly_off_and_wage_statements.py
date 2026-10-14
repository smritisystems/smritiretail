"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect

Websites: aitdl.com | erpnbook.com | smritibooks.com

Revision ID: v1533_attendance_weekly_off_and_wage_statements
Revises: v1532_cost_management_engine_foundations
Create Date: 2026-10-14
Classification: HR, Muster Roll & Payroll Lineage
"""

from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "v1533_attendance_weekly_off_and_wage_statements"
down_revision: str | Sequence[str] | None = "v1532_cost_management_engine_foundations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    # 1. Update chk_attendance_status_valid to include 'WEEKLY_OFF'
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'attendance_records'
            ) THEN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'chk_attendance_status_valid'
                      AND conrelid = 'attendance_records'::regclass
                ) THEN
                    ALTER TABLE attendance_records DROP CONSTRAINT chk_attendance_status_valid;
                END IF;

                ALTER TABLE attendance_records
                    ADD CONSTRAINT chk_attendance_status_valid
                    CHECK (status IN ('PRESENT','ABSENT','LATE','HALF_DAY','LEAVE','HOLIDAY','WEEKLY_OFF'));
            END IF;
        END $$;
    """)

    # 2. Create wage_statements table if not exists
    def common_columns():
        return [
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True),
            sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
            sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer, server_default="1", nullable=False),
        ]

    if "wage_statements" not in tables:
        op.create_table(
            "wage_statements",
            *common_columns(),
            sa.Column("user_id", sa.String(50), nullable=False, index=True),
            sa.Column("period", sa.String(7), nullable=False, index=True),
            sa.Column("wage_type", sa.String(20), server_default="'MONTHLY'", nullable=False),
            sa.Column("base_rate", sa.Numeric(12, 2), server_default="0.00", nullable=False),
            sa.Column("working_days", sa.Numeric(5, 2), server_default="0.00", nullable=False),
            sa.Column("present_days", sa.Numeric(5, 2), server_default="0.00", nullable=False),
            sa.Column("half_days", sa.Numeric(5, 2), server_default="0.00", nullable=False),
            sa.Column("absent_days", sa.Numeric(5, 2), server_default="0.00", nullable=False),
            sa.Column("paid_leave_days", sa.Numeric(5, 2), server_default="0.00", nullable=False),
            sa.Column("weekly_off_days", sa.Numeric(5, 2), server_default="0.00", nullable=False),
            sa.Column("lop_days", sa.Numeric(5, 2), server_default="0.00", nullable=False),
            sa.Column("overtime_hours", sa.Numeric(6, 2), server_default="0.00", nullable=False),
            sa.Column("overtime_rate", sa.Numeric(10, 2), server_default="0.00", nullable=False),
            sa.Column("base_earnings", sa.Numeric(12, 2), server_default="0.00", nullable=False),
            sa.Column("overtime_earnings", sa.Numeric(12, 2), server_default="0.00", nullable=False),
            sa.Column("commission_amount", sa.Numeric(12, 2), server_default="0.00", nullable=False),
            sa.Column("allowances_amount", sa.Numeric(12, 2), server_default="0.00", nullable=False),
            sa.Column("lop_deduction", sa.Numeric(12, 2), server_default="0.00", nullable=False),
            sa.Column("gross_wages", sa.Numeric(12, 2), server_default="0.00", nullable=False),
            sa.Column("net_wages", sa.Numeric(12, 2), server_default="0.00", nullable=False),
            sa.Column("status", sa.String(20), server_default="'DRAFT'", nullable=False),
            sa.Column("finalized_by", sa.String(50), nullable=True),
            sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.UniqueConstraint("company_id", "user_id", "period", name="uq_wage_statement_company_user_period"),
        )
        op.create_index("ix_wage_statements_company_period", "wage_statements", ["company_id", "period"])


def downgrade() -> None:
    bind = op.get_bind()
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "wage_statements" in tables:
        op.drop_table("wage_statements")

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'attendance_records'
            ) THEN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'chk_attendance_status_valid'
                      AND conrelid = 'attendance_records'::regclass
                ) THEN
                    ALTER TABLE attendance_records DROP CONSTRAINT chk_attendance_status_valid;
                END IF;

                ALTER TABLE attendance_records
                    ADD CONSTRAINT chk_attendance_status_valid
                    CHECK (status IN ('PRESENT','ABSENT','LATE','HALF_DAY','LEAVE','HOLIDAY'));
            END IF;
        END $$;
    """)
