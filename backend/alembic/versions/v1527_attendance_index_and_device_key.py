"""SMRITI Retail OS — Attendance Integrity: composite index + device-push auth

Revision ID: v1527_attendance_index_and_device_key
Revises: v1526_add_barcode_print_jobs_table
Create Date: 2026-10-11

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.51
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Architecture Invariants Enforced:
1. Adds composite index (company_id, attendance_date) on attendance_records
   for multi-tenant query performance (F-04 / R-08 from Attendance Audit).
2. Adds CHECK constraint enforcing only valid attendance status values
   (F-01 — prevents arbitrary strings bypassing the Python-layer whitelist).
3. Adds system_parameter seed for shift configuration keys used by the
   late-detection and half-day auto-detection logic introduced in staff.py:
   SMRITI.HR.SHIFT_START_TIME, SMRITI.HR.LATE_THRESHOLD_MINUTES,
   SMRITI.HR.HALF_DAY_HOURS_THRESHOLD.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1527_attendance_index_and_device_key"
down_revision = "v1526_add_barcode_print_jobs_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Composite index & CHECK constraint on attendance_records (guarded by table existence)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'attendance_records'
            ) THEN
                CREATE INDEX IF NOT EXISTS ix_attendance_records_company_date
                ON attendance_records (company_id, attendance_date DESC);

                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'chk_attendance_status_valid'
                      AND conrelid = 'attendance_records'::regclass
                ) THEN
                    ALTER TABLE attendance_records
                        ADD CONSTRAINT chk_attendance_status_valid
                        CHECK (status IN ('PRESENT','ABSENT','LATE','HALF_DAY','LEAVE','HOLIDAY'));
                END IF;
            END IF;
        END $$;
    """)

    # 3. Seed HR shift configuration system parameters (safe idempotent insert)
    # system_parameters has no unique constraint on param_code; use WHERE NOT EXISTS.
    op.execute("""
        INSERT INTO system_parameters (
            id, uuid, company_id, param_code, canonical_code, category, category_name,
            description, data_type, mutability, profile_type,
            scope_level, terminal_id, val_text,
            is_active, is_deleted, is_locked, created_at, modified_at
        )
        SELECT 'sp-hr-shift-start',
               'a1100001-0001-4000-8000-000000000001',
               NULL, 'SMRITI.HR.SHIFT_START_TIME', 'SMRITI.HR.SHIFT_START_TIME',
               'HR', 'Human Resources',
               'Standard shift start time (HH:MM 24h). Used for late detection.',
               'Text', 'Variable', 'COMMON', 'GLOBAL', 'COMMON', '09:00',
               TRUE, FALSE, FALSE, NOW(), NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM system_parameters
            WHERE canonical_code = 'SMRITI.HR.SHIFT_START_TIME' AND company_id IS NULL
        )
    """)
    op.execute("""
        INSERT INTO system_parameters (
            id, uuid, company_id, param_code, canonical_code, category, category_name,
            description, data_type, mutability, profile_type,
            scope_level, terminal_id, val_text,
            is_active, is_deleted, is_locked, created_at, modified_at
        )
        SELECT 'sp-hr-late-mins',
               'a1100001-0001-4000-8000-000000000002',
               NULL, 'SMRITI.HR.LATE_THRESHOLD_MINUTES', 'SMRITI.HR.LATE_THRESHOLD_MINUTES',
               'HR', 'Human Resources',
               'Grace period (minutes) after shift start before a punch is LATE.',
               'Text', 'Variable', 'COMMON', 'GLOBAL', 'COMMON', '15',
               TRUE, FALSE, FALSE, NOW(), NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM system_parameters
            WHERE canonical_code = 'SMRITI.HR.LATE_THRESHOLD_MINUTES' AND company_id IS NULL
        )
    """)
    op.execute("""
        INSERT INTO system_parameters (
            id, uuid, company_id, param_code, canonical_code, category, category_name,
            description, data_type, mutability, profile_type,
            scope_level, terminal_id, val_text,
            is_active, is_deleted, is_locked, created_at, modified_at
        )
        SELECT 'sp-hr-halfday-hrs',
               'a1100001-0001-4000-8000-000000000003',
               NULL, 'SMRITI.HR.HALF_DAY_HOURS_THRESHOLD', 'SMRITI.HR.HALF_DAY_HOURS_THRESHOLD',
               'HR', 'Human Resources',
               'Minimum hours worked for full day. Below this on clock-out = HALF_DAY.',
               'Text', 'Variable', 'COMMON', 'GLOBAL', 'COMMON', '4',
               TRUE, FALSE, FALSE, NOW(), NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM system_parameters
            WHERE canonical_code = 'SMRITI.HR.HALF_DAY_HOURS_THRESHOLD' AND company_id IS NULL
        )
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'attendance_records'
            ) THEN
                DROP INDEX IF EXISTS ix_attendance_records_company_date;
                ALTER TABLE attendance_records
                    DROP CONSTRAINT IF EXISTS chk_attendance_status_valid;
            END IF;
        END $$;
    """)
    op.execute("""
        DELETE FROM system_parameters
        WHERE param_code IN (
            'SMRITI.HR.SHIFT_START_TIME',
            'SMRITI.HR.LATE_THRESHOLD_MINUTES',
            'SMRITI.HR.HALF_DAY_HOURS_THRESHOLD'
        )
        AND company_id IS NULL
    """)
