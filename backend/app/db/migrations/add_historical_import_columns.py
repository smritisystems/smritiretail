"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.1
Created      : 2026-08-17
Modified     : 2026-08-17
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Migration: Add historical import audit columns to sales_invoices,
           sales_invoice_items, and ensure invoice_document_artifacts table.
ADDITIVE ONLY. Idempotent. No DROP/TRUNCATE/DELETE.
"""
MIGRATION_SQL = """
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    source_type VARCHAR(50) DEFAULT 'LIVE';
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    source_system VARCHAR(100);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    source_file VARCHAR(500);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    import_batch_id VARCHAR(100);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    imported_at TIMESTAMPTZ;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    import_validation_status VARCHAR(50) DEFAULT 'NOT_APPLICABLE';
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    import_validation_notes TEXT;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    sis_code VARCHAR(20);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    pos_state VARCHAR(100);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    po_reference VARCHAR(100);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    customer_name VARCHAR(255);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    customer_gstin VARCHAR(20);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    billing_address TEXT;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    shipping_address TEXT;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    site_name VARCHAR(255);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    taxable_value NUMERIC(15,2) DEFAULT 0.00;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    rounding_amount NUMERIC(10,4) DEFAULT 0.0000;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    amount_in_words TEXT;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    bank_name VARCHAR(255);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    account_no VARCHAR(50);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    ifsc_code VARCHAR(20);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    original_pdf_sha256 VARCHAR(64);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    original_pdf_path VARCHAR(500);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    original_pdf_size INTEGER;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS
    original_pdf_pages INTEGER;

ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS
    mrp NUMERIC(15,2);
ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS
    disc_pct NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS
    taxable_value NUMERIC(15,2);
ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS
    igst_amount NUMERIC(15,2) DEFAULT 0.00;
ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS
    cgst_amount NUMERIC(15,2) DEFAULT 0.00;
ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS
    sgst_amount NUMERIC(15,2) DEFAULT 0.00;
ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS
    line_no INTEGER;

CREATE TABLE IF NOT EXISTS invoice_document_artifacts (
    id VARCHAR(50) PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    company_id VARCHAR(50),
    branch_id VARCHAR(50),
    invoice_id VARCHAR(50),
    invoice_no VARCHAR(100) NOT NULL,
    document_type VARCHAR(50) NOT NULL DEFAULT 'TAX_INVOICE',
    template_code VARCHAR(100) NOT NULL DEFAULT 'TAX_INVOICE_TATTLY_THREADS',
    template_version VARCHAR(50) NOT NULL DEFAULT 'V1',
    template_status VARCHAR(50) NOT NULL DEFAULT 'FROZEN',
    artifact_subtype VARCHAR(50) DEFAULT 'CANONICAL',
    source_type VARCHAR(50) DEFAULT 'LIVE',
    source_file VARCHAR(500),
    storage_path VARCHAR(500),
    sha256_hash VARCHAR(64) NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by VARCHAR(50),
    is_valid BOOLEAN DEFAULT TRUE,
    reprint_count INTEGER DEFAULT 0,
    last_reprinted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1,
    import_batch_id VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_ida_invoice_id ON invoice_document_artifacts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ida_invoice_no ON invoice_document_artifacts(invoice_no);
CREATE INDEX IF NOT EXISTS idx_ida_template_code ON invoice_document_artifacts(template_code);
"""

if __name__ == "__main__":
    import psycopg2, sys
    target_dbs = ['smriti001']
    for dbname in target_dbs:
        print(f"Applying to {dbname}...")
        try:
            conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{dbname}')
            conn.autocommit = False
            cur = conn.cursor()
            cur.execute(MIGRATION_SQL)
            conn.commit()
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='sales_invoices' AND column_name IN ('source_type','import_batch_id','sis_code','taxable_value','original_pdf_sha256') ORDER BY column_name")
            print(f"  sales_invoices new cols: {[r[0] for r in cur.fetchall()]}")
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='sales_invoice_items' AND column_name IN ('mrp','disc_pct','taxable_value','igst_amount','line_no') ORDER BY column_name")
            print(f"  sales_invoice_items new cols: {[r[0] for r in cur.fetchall()]}")
            cur.execute("SELECT COUNT(*) FROM invoice_document_artifacts")
            print(f"  invoice_document_artifacts ready, {cur.fetchone()[0]} rows")
            conn.close()
            print(f"  OK: {dbname}")
        except Exception as e:
            print(f"  FAIL: {dbname}: {e}")
            sys.exit(1)
    print("Migration complete.")
