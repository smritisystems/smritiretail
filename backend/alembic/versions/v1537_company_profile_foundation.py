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

Revision ID: v1537_company_profile_foundation
Revises: v1536_sales_invoice_sales_channel
Create Date: 2026-10-18
Classification: Company Profile & Multi-Tenant Core Architecture
"""

from collections.abc import Sequence

from alembic import op

revision: str = "v1537_company_profile_foundation"
down_revision: str | Sequence[str] | None = "v1536_sales_invoice_sales_channel"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add canonical Company Profile columns to companies table
    op.execute(
        """
        ALTER TABLE companies
        ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) NULL DEFAULT 'PRIVATE_LIMITED',
        ADD COLUMN IF NOT EXISTS pan VARCHAR(10) NULL,
        ADD COLUMN IF NOT EXISTS cin VARCHAR(25) NULL,
        ADD COLUMN IF NOT EXISTS address_line1 TEXT NULL,
        ADD COLUMN IF NOT EXISTS address_line2 TEXT NULL,
        ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS state VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS state_code VARCHAR(5) NULL,
        ADD COLUMN IF NOT EXISTS pincode VARCHAR(10) NULL,
        ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL DEFAULT 'India',
        ADD COLUMN IF NOT EXISTS phone VARCHAR(25) NULL,
        ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS website VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS dispatch_email VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS accounts_email VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150) NULL,
        ADD COLUMN IF NOT EXISTS print_logo_url VARCHAR(500) NULL,
        ADD COLUMN IF NOT EXISTS signature_url VARCHAR(500) NULL,
        ADD COLUMN IF NOT EXISTS stamp_url VARCHAR(500) NULL,
        ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) NULL DEFAULT 'INR',
        ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) NULL DEFAULT 'Asia/Kolkata',
        ADD COLUMN IF NOT EXISTS date_format VARCHAR(30) NULL DEFAULT 'DD/MM/YYYY',
        ADD COLUMN IF NOT EXISTS number_format VARCHAR(30) NULL DEFAULT 'INDIAN_LAKH_CRORE';
        """
    )

    # 2. Add Branch location columns to branches table
    op.execute(
        """
        ALTER TABLE branches
        ADD COLUMN IF NOT EXISTS address TEXT NULL,
        ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS state VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS state_code VARCHAR(5) NULL,
        ADD COLUMN IF NOT EXISTS pincode VARCHAR(10) NULL,
        ADD COLUMN IF NOT EXISTS gstin VARCHAR(15) NULL,
        ADD COLUMN IF NOT EXISTS phone VARCHAR(25) NULL,
        ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL;
        """
    )

    # 3. Safe Backfill for existing company records
    # Backfill legal_name and trade_name from existing name if not set
    op.execute(
        """
        UPDATE companies
        SET legal_name = name
        WHERE legal_name IS NULL AND name IS NOT NULL;
        """
    )
    op.execute(
        """
        UPDATE companies
        SET trade_name = name
        WHERE trade_name IS NULL AND name IS NOT NULL;
        """
    )

    # Backfill PAN from GST number (chars 3 to 12) if GSTIN is present
    op.execute(
        """
        UPDATE companies
        SET pan = SUBSTRING(gst_number FROM 3 FOR 10)
        WHERE pan IS NULL AND gst_number IS NOT NULL AND length(gst_number) >= 12;
        """
    )

    # Performance Index on company pan and legal_name
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_companies_pan ON companies (pan);
        CREATE INDEX IF NOT EXISTS ix_companies_legal_name ON companies (legal_name);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_companies_legal_name;")
    op.execute("DROP INDEX IF EXISTS ix_companies_pan;")

    op.execute(
        """
        ALTER TABLE branches
        DROP COLUMN IF EXISTS email,
        DROP COLUMN IF EXISTS phone,
        DROP COLUMN IF EXISTS gstin,
        DROP COLUMN IF EXISTS pincode,
        DROP COLUMN IF EXISTS state_code,
        DROP COLUMN IF EXISTS state,
        DROP COLUMN IF EXISTS city,
        DROP COLUMN IF EXISTS address;
        """
    )

    op.execute(
        """
        ALTER TABLE companies
        DROP COLUMN IF EXISTS number_format,
        DROP COLUMN IF EXISTS date_format,
        DROP COLUMN IF EXISTS timezone,
        DROP COLUMN IF EXISTS currency_code,
        DROP COLUMN IF EXISTS stamp_url,
        DROP COLUMN IF EXISTS signature_url,
        DROP COLUMN IF EXISTS print_logo_url,
        DROP COLUMN IF EXISTS contact_person,
        DROP COLUMN IF EXISTS accounts_email,
        DROP COLUMN IF EXISTS dispatch_email,
        DROP COLUMN IF EXISTS website,
        DROP COLUMN IF EXISTS email,
        DROP COLUMN IF EXISTS phone,
        DROP COLUMN IF EXISTS country,
        DROP COLUMN IF EXISTS pincode,
        DROP COLUMN IF EXISTS state_code,
        DROP COLUMN IF EXISTS state,
        DROP COLUMN IF EXISTS city,
        DROP COLUMN IF EXISTS address_line2,
        DROP COLUMN IF EXISTS address_line1,
        DROP COLUMN IF EXISTS cin,
        DROP COLUMN IF EXISTS pan,
        DROP COLUMN IF EXISTS business_type,
        DROP COLUMN IF EXISTS trade_name,
        DROP COLUMN IF EXISTS legal_name;
        """
    )
