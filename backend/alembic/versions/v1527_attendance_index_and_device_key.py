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
    # 1. Composite index: company_id + attendance_date (P0 — sequential scan fix)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_attendance_records_company_date
        ON attendance_records (company_id, attendance_date DESC)
    """)

    # 2. CHECK constraint on status column (P0 — data integrity enforcement)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'chk_attendance_status_valid'
                  AND conrelid = 'attendance_records'::regclass
            ) THEN
                ALTER TABLE attendance_records
                    ADD CONSTRAINT chk_attendance_status_valid
                    CHECK (status IN ('PRESENT','ABSENT','LATE','HALF_DAY','LEAVE','HOLIDAY'));
            END IF;
        END $$;
    """)

    # 3. Seed HR shift configuration system parameters (safe upsert)
    op.execute("""
        INSERT INTO system_parameters (
            id, company_id, param_code, canonical_code, category, category_name,
            description, data_type, mutability, profile_type,
            scope_level, terminal_id,
            val_text,
            is_active, is_deleted, is_locked, created_at, modified_at
        )
        VALUES
            ('sp-hr-shift-start',
             NULL, 'SMRITI.HR.SHIFT_START_TIME', 'SMRITI.HR.SHIFT_START_TIME',
             'HR', 'Human Resources',
             'Standard shift start time (HH:MM, 24-hour). Used for late detection.',
             'Text', 'Variable', 'COMMON', 'GLOBAL', 'COMMON',
             '09:00',
             TRUE, FALSE, FALSE, NOW(), NOW()),
            ('sp-hr-late-mins',
             NULL, 'SMRITI.HR.LATE_THRESHOLD_MINUTES', 'SMRITI.HR.LATE_THRESHOLD_MINUTES',
             'HR', 'Human Resources',
             'Grace period (minutes) after shift start before a punch is recorded LATE.',
             'Text', 'Variable', 'COMMON', 'GLOBAL', 'COMMON',
             '15',
             TRUE, FALSE, FALSE, NOW(), NOW()),
            ('sp-hr-halfday-hrs',
             NULL, 'SMRITI.HR.HALF_DAY_HOURS_THRESHOLD', 'SMRITI.HR.HALF_DAY_HOURS_THRESHOLD',
             'HR', 'Human Resources',
             'Minimum hours worked for a full day. Below this threshold on clock-out status becomes HALF_DAY.',
             'Text', 'Variable', 'COMMON', 'GLOBAL', 'COMMON',
             '4',
             TRUE, FALSE, FALSE, NOW(), NOW())
        ON CONFLICT (param_code) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_attendance_records_company_date")
    op.execute("""
        ALTER TABLE attendance_records
            DROP CONSTRAINT IF EXISTS chk_attendance_status_valid
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
