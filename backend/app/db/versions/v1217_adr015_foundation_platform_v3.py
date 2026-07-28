"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Copyright    : © SMRITIBooks.com. All Rights Reserved.

ADR-015: Foundation Platform v3.0 — Sprint 1 Database Migration
Revision ID : v1217_adr015_foundation_platform_v3
Revises     : v1216_new_table_apparelvariantgrid_apparel_matrix_grid
Create Date : 2026-07-28

Migrations (13 logical groups):
  M-001 organizations
  M-002 Extend companies (additive per AOP-004)
  M-003 Extend branches  (additive per AOP-004)
  M-004 smriti_entity_registry
  M-005 smriti_addresses
  M-006 smriti_contacts
  M-007 smriti_banks (master + seed)
  M-008 smriti_bank_accounts
  M-009 smriti_comm_channels
  M-010 smriti_settings
  M-011 smriti_themes + smriti_theme_variants
  M-012 smriti_branding + smriti_report_templates + smriti_social_profiles
  M-013 company_tax_profiles + company_financial_years + smriti_audit_log
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1217_adr015_foundation_platform_v3'
down_revision = 'v1216_new_table_apparelvariantgrid_apparel_matrix_grid'
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ── M-001: organizations ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS organizations (
            id          VARCHAR(50)  PRIMARY KEY,
            tenant_id   VARCHAR(50),
            name        VARCHAR(255) NOT NULL,
            org_type    VARCHAR(30)  NOT NULL DEFAULT 'STANDALONE',
            is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_org_tenant ON organizations(tenant_id);")

    # ── M-002: Extend companies (AOP-004 — additive only) ────────────────────
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE SET NULL;")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_code VARCHAR(20) UNIQUE;")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255);")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type VARCHAR(30) DEFAULT 'PRIVATE_LTD';")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry_type VARCHAR(50) DEFAULT 'RETAIL';")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_gst_registered BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS incorporation_date DATE;")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS fiscal_year_start_month SMALLINT DEFAULT 4;")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'INR';")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'IN';")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS language_code VARCHAR(10) DEFAULT 'en-IN';")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS description VARCHAR(1000);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_companies_org_id ON companies(organization_id);")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_company
        ON companies(tenant_id) WHERE is_default = TRUE;
    """)

    # ── M-003: Extend branches (AOP-004 — additive only) ────────────────────
    op.execute("ALTER TABLE branches ADD COLUMN IF NOT EXISTS branch_type VARCHAR(30) DEFAULT 'RETAIL';")
    op.execute("ALTER TABLE branches ADD COLUMN IF NOT EXISTS gstin VARCHAR(15);")
    op.execute("ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone VARCHAR(20);")
    op.execute("ALTER TABLE branches ADD COLUMN IF NOT EXISTS email VARCHAR(255);")
    op.execute("ALTER TABLE branches ADD COLUMN IF NOT EXISTS manager_user_id VARCHAR(50);")

    # ── M-004: smriti_entity_registry ────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_entity_registry (
            id           VARCHAR(50)  PRIMARY KEY,
            tenant_id    VARCHAR(50)  NOT NULL,
            entity_type  VARCHAR(30)  NOT NULL,
            source_table VARCHAR(100) NOT NULL,
            source_id    VARCHAR(50)  NOT NULL,
            display_name VARCHAR(255) NOT NULL,
            is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            modified_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_entity_source UNIQUE (entity_type, source_id)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_entity_registry_tenant  ON smriti_entity_registry(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_entity_registry_type    ON smriti_entity_registry(entity_type);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_entity_registry_source  ON smriti_entity_registry(source_table, source_id);")

    # ── M-005: smriti_addresses ───────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_addresses (
            id                   VARCHAR(50)   PRIMARY KEY,
            tenant_id            VARCHAR(50)   NOT NULL,
            entity_id            VARCHAR(50)   NOT NULL REFERENCES smriti_entity_registry(id) ON DELETE RESTRICT,
            address_type         VARCHAR(30)   NOT NULL DEFAULT 'REGISTERED',
            is_primary           BOOLEAN       NOT NULL DEFAULT FALSE,
            address_line1        VARCHAR(255)  NOT NULL,
            address_line2        VARCHAR(255),
            landmark             VARCHAR(255),
            city                 VARCHAR(100)  NOT NULL,
            district             VARCHAR(100),
            state_code           VARCHAR(2)    NOT NULL,
            state_name           VARCHAR(100)  NOT NULL,
            pincode              VARCHAR(10)   NOT NULL,
            country_code         VARCHAR(2)    NOT NULL DEFAULT 'IN',
            latitude             NUMERIC(10,7),
            longitude            NUMERIC(10,7),
            plus_code            VARCHAR(20),
            geo_region           VARCHAR(50),
            tax_region           VARCHAR(50),
            delivery_zone        VARCHAR(50),
            route_code           VARCHAR(20),
            default_warehouse_id VARCHAR(50),
            delivery_instructions TEXT,
            is_verified          BOOLEAN       NOT NULL DEFAULT FALSE,
            verified_at          TIMESTAMPTZ,
            is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
            created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            created_by           VARCHAR(50),
            modified_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            modified_by          VARCHAR(50)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_addr_entity        ON smriti_addresses(entity_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_addr_tenant_type   ON smriti_addresses(tenant_id, address_type);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_addr_pincode       ON smriti_addresses(pincode);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_addr_delivery_zone ON smriti_addresses(delivery_zone);")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_addr_one_primary
        ON smriti_addresses(entity_id, address_type)
        WHERE is_primary = TRUE AND is_active = TRUE;
    """)

    # ── M-006: smriti_contacts ────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_contacts (
            id                     VARCHAR(50)  PRIMARY KEY,
            tenant_id              VARCHAR(50)  NOT NULL,
            entity_id              VARCHAR(50)  NOT NULL REFERENCES smriti_entity_registry(id) ON DELETE RESTRICT,
            contact_role           VARCHAR(50)  NOT NULL,
            salutation             VARCHAR(10),
            first_name             VARCHAR(100) NOT NULL,
            last_name              VARCHAR(100),
            designation            VARCHAR(100),
            department             VARCHAR(100),
            email                  VARCHAR(255),
            mobile                 VARCHAR(20),
            phone_office           VARCHAR(20),
            phone_ext              VARCHAR(10),
            whatsapp               VARCHAR(20),
            linkedin_url           VARCHAR(255),
            preferred_language     VARCHAR(10)  DEFAULT 'en-IN',
            preferred_channel      VARCHAR(20)  DEFAULT 'EMAIL',
            working_hours_json     JSONB,
            is_emergency_contact   BOOLEAN      NOT NULL DEFAULT FALSE,
            notification_pref_json JSONB,
            is_primary             BOOLEAN      NOT NULL DEFAULT FALSE,
            is_active              BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            modified_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_contact_entity ON smriti_contacts(entity_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_contact_email  ON smriti_contacts(email);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_contact_mobile ON smriti_contacts(mobile);")

    # ── M-007: smriti_banks (master + seed) ──────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_banks (
            id              VARCHAR(50)  PRIMARY KEY,
            bank_code       VARCHAR(10)  NOT NULL UNIQUE,
            bank_name       VARCHAR(255) NOT NULL,
            bank_name_short VARCHAR(50)  NOT NULL,
            ifsc_prefix     VARCHAR(4),
            swift_bic       VARCHAR(11),
            country_code    VARCHAR(2)   NOT NULL DEFAULT 'IN',
            is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_banks_code ON smriti_banks(bank_code);")
    # Seed major Indian banks
    op.execute("""
        INSERT INTO smriti_banks (id, bank_code, bank_name, bank_name_short, ifsc_prefix, swift_bic)
        VALUES
          ('BNK-SBI',     'SBI',     'State Bank of India',                   'SBI',     'SBIN', 'SBININBB'),
          ('BNK-HDFC',    'HDFC',    'HDFC Bank Ltd',                         'HDFC',    'HDFC', 'HDFCINBB'),
          ('BNK-ICICI',   'ICICI',   'ICICI Bank Ltd',                        'ICICI',   'ICIC', 'ICICINBB'),
          ('BNK-AXIS',    'AXIS',    'Axis Bank Ltd',                         'Axis',    'UTIB', 'AXISINBB'),
          ('BNK-KOTAK',   'KOTAK',   'Kotak Mahindra Bank Ltd',               'Kotak',   'KKBK', 'KKBKINBB'),
          ('BNK-PNB',     'PNB',     'Punjab National Bank',                  'PNB',     'PUNB', 'PUNBINBB'),
          ('BNK-BOB',     'BOB',     'Bank of Baroda',                        'BOB',     'BARB', 'BARBINBB'),
          ('BNK-CANARA',  'CANARA',  'Canara Bank',                           'Canara',  'CNRB', 'CNRBINBB'),
          ('BNK-UNION',   'UNION',   'Union Bank of India',                   'Union',   'UBIN', 'UBININBB'),
          ('BNK-INDUS',   'INDUS',   'IndusInd Bank Ltd',                     'IndusInd','INDB', 'INDBINBB'),
          ('BNK-YES',     'YES',     'Yes Bank Ltd',                          'Yes',     'YESB', 'YESBINBB'),
          ('BNK-IDFC',    'IDFC',    'IDFC First Bank Ltd',                   'IDFC',    'IDFB', 'IDFBINBB'),
          ('BNK-BOI',     'BOI',     'Bank of India',                         'BOI',     'BKID', 'BKIDINBB'),
          ('BNK-IOB',     'IOB',     'Indian Overseas Bank',                  'IOB',     'IOBA', 'IOBAINBB'),
          ('BNK-UCO',     'UCO',     'UCO Bank',                              'UCO',     'UCBA', 'UCBAINBB'),
          ('BNK-FEDERAL', 'FEDERAL', 'Federal Bank Ltd',                      'Federal', 'FDRL', 'FDRLINBB'),
          ('BNK-RBL',     'RBL',     'RBL Bank Ltd',                         'RBL',     'RATN', 'RATNINBB'),
          ('BNK-CENTRAL', 'CENTRAL', 'Central Bank of India',                 'Central', 'CBIN', 'CBININBB'),
          ('BNK-INDIAN',  'INDIAN',  'Indian Bank',                           'Indian',  'IDIB', 'IDIBBINB'),
          ('BNK-PAYTM',   'PAYTM',  'Paytm Payments Bank Ltd',               'Paytm',   'PYTM', NULL)
        ON CONFLICT (bank_code) DO NOTHING;
    """)

    # ── M-008: smriti_bank_accounts ───────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_bank_accounts (
            id                    VARCHAR(50)  PRIMARY KEY,
            tenant_id             VARCHAR(50)  NOT NULL,
            entity_id             VARCHAR(50)  NOT NULL REFERENCES smriti_entity_registry(id) ON DELETE RESTRICT,
            bank_id               VARCHAR(50)  REFERENCES smriti_banks(id) ON DELETE RESTRICT,
            account_nickname      VARCHAR(100) NOT NULL,
            account_number_masked VARCHAR(30)  NOT NULL,
            account_number_enc    VARCHAR(500) NOT NULL,
            account_type          VARCHAR(30)  NOT NULL DEFAULT 'CURRENT',
            ifsc_code             VARCHAR(11)  NOT NULL,
            micr_code             VARCHAR(9),
            swift_code            VARCHAR(11),
            iban                  VARCHAR(34),
            upi_id                VARCHAR(100),
            currency_code         VARCHAR(3)   NOT NULL DEFAULT 'INR',
            is_default_receipts   BOOLEAN      NOT NULL DEFAULT FALSE,
            is_default_payments   BOOLEAN      NOT NULL DEFAULT FALSE,
            is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            modified_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_bank_acct_entity ON smriti_bank_accounts(entity_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bank_acct_tenant ON smriti_bank_accounts(tenant_id);")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_receipt_bank
        ON smriti_bank_accounts(entity_id)
        WHERE is_default_receipts = TRUE AND is_active = TRUE;
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_payment_bank
        ON smriti_bank_accounts(entity_id)
        WHERE is_default_payments = TRUE AND is_active = TRUE;
    """)

    # ── M-009: smriti_comm_channels ───────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_comm_channels (
            id                   VARCHAR(50)  PRIMARY KEY,
            tenant_id            VARCHAR(50)  NOT NULL,
            company_id           VARCHAR(50)  NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            channel_type         VARCHAR(30)  NOT NULL,
            provider             VARCHAR(50)  NOT NULL,
            display_name         VARCHAR(100) NOT NULL,
            config_json_enc      TEXT         NOT NULL,
            is_active            BOOLEAN      NOT NULL DEFAULT FALSE,
            is_default           BOOLEAN      NOT NULL DEFAULT FALSE,
            last_success_at      TIMESTAMPTZ,
            last_failure_at      TIMESTAMPTZ,
            consecutive_failures SMALLINT     NOT NULL DEFAULT 0,
            health_status        VARCHAR(20)  NOT NULL DEFAULT 'UNCHECKED',
            retry_policy_json    JSONB,
            rate_limit_per_hour  INTEGER,
            sent_this_hour       INTEGER      NOT NULL DEFAULT 0,
            hour_window_start    TIMESTAMPTZ,
            last_tested_at       TIMESTAMPTZ,
            last_test_status     VARCHAR(20),
            last_test_error      TEXT,
            created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            modified_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_comm_company_type ON smriti_comm_channels(company_id, channel_type);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_comm_health       ON smriti_comm_channels(health_status);")

    # ── M-010: smriti_settings ────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_settings (
            id                  VARCHAR(50)   PRIMARY KEY,
            tenant_id           VARCHAR(50),
            owner_type          VARCHAR(20)   NOT NULL DEFAULT 'COMPANY',
            owner_id            VARCHAR(50),
            setting_key         VARCHAR(100)  NOT NULL,
            setting_value       TEXT          NOT NULL,
            data_type           VARCHAR(20)   NOT NULL DEFAULT 'STRING',
            category            VARCHAR(50)   NOT NULL DEFAULT 'General',
            display_label       VARCHAR(100),
            help_text           TEXT,
            sort_order          SMALLINT      NOT NULL DEFAULT 0,
            validation_regex    VARCHAR(500),
            minimum_value       NUMERIC(20,6),
            maximum_value       NUMERIC(20,6),
            allowed_values_json JSONB,
            is_encrypted        BOOLEAN       NOT NULL DEFAULT FALSE,
            is_readonly         BOOLEAN       NOT NULL DEFAULT FALSE,
            is_visible_in_ui    BOOLEAN       NOT NULL DEFAULT TRUE,
            created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            modified_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_setting_owner_key UNIQUE (owner_type, owner_id, setting_key)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_settings_owner    ON smriti_settings(owner_type, owner_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_settings_category ON smriti_settings(category);")

    # ── M-011: smriti_themes + smriti_theme_variants ─────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_themes (
            id               VARCHAR(50)  PRIMARY KEY,
            tenant_id        VARCHAR(50),
            company_id       VARCHAR(50)  NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            theme_name       VARCHAR(100) NOT NULL DEFAULT 'Default',
            icon_pack        VARCHAR(50)  DEFAULT 'lucide',
            illustration_set VARCHAR(50)  DEFAULT 'smriti_default',
            font_heading     VARCHAR(100) DEFAULT 'Inter',
            font_body        VARCHAR(100) DEFAULT 'Inter',
            border_radius_px SMALLINT     DEFAULT 8,
            is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            modified_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_theme_variants (
            id               VARCHAR(50)  PRIMARY KEY,
            theme_id         VARCHAR(50)  NOT NULL REFERENCES smriti_themes(id) ON DELETE CASCADE,
            variant          VARCHAR(20)  NOT NULL,
            primary_color    VARCHAR(7)   NOT NULL DEFAULT '#2563EB',
            secondary_color  VARCHAR(7)   NOT NULL DEFAULT '#64748B',
            accent_color     VARCHAR(7)   NOT NULL DEFAULT '#0EA5E9',
            background_color VARCHAR(7)   NOT NULL DEFAULT '#FFFFFF',
            surface_color    VARCHAR(7)   NOT NULL DEFAULT '#F8FAFC',
            text_primary     VARCHAR(7)   NOT NULL DEFAULT '#0F172A',
            text_secondary   VARCHAR(7)   NOT NULL DEFAULT '#475569',
            border_color     VARCHAR(7)   NOT NULL DEFAULT '#E2E8F0',
            danger_color     VARCHAR(7)   NOT NULL DEFAULT '#EF4444',
            success_color    VARCHAR(7)   NOT NULL DEFAULT '#22C55E',
            warning_color    VARCHAR(7)   NOT NULL DEFAULT '#F59E0B',
            is_default       BOOLEAN      NOT NULL DEFAULT FALSE,
            created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_theme_variant UNIQUE (theme_id, variant)
        );
    """)

    # ── M-012: smriti_branding + smriti_report_templates + smriti_social_profiles ──
    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_branding (
            id              VARCHAR(50)  PRIMARY KEY,
            tenant_id       VARCHAR(50),
            company_id      VARCHAR(50)  NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            asset_type      VARCHAR(30)  NOT NULL,
            file_url        VARCHAR(500) NOT NULL,
            file_size_bytes INTEGER,
            width_px        INTEGER,
            height_px       INTEGER,
            mime_type       VARCHAR(50),
            is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_branding_company_type ON smriti_branding(company_id, asset_type);")

    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_report_templates (
            id            VARCHAR(50)  PRIMARY KEY,
            tenant_id     VARCHAR(50),
            company_id    VARCHAR(50)  NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            template_type VARCHAR(50)  NOT NULL,
            header_html   TEXT,
            footer_html   TEXT,
            css_override  TEXT,
            is_default    BOOLEAN      NOT NULL DEFAULT FALSE,
            created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            modified_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_rpt_tpl_company_type ON smriti_report_templates(company_id, template_type);")

    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_social_profiles (
            id           VARCHAR(50)  PRIMARY KEY,
            company_id   VARCHAR(50)  NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            platform     VARCHAR(30)  NOT NULL,
            url          VARCHAR(500) NOT NULL,
            display_text VARCHAR(100),
            is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
            sort_order   SMALLINT     NOT NULL DEFAULT 0,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_social_company ON smriti_social_profiles(company_id);")

    # ── M-013: company_tax_profiles + company_financial_years + smriti_audit_log ──
    op.execute("""
        CREATE TABLE IF NOT EXISTS company_tax_profiles (
            id                     VARCHAR(50)  PRIMARY KEY,
            company_id             VARCHAR(50)  NOT NULL UNIQUE REFERENCES companies(id) ON DELETE RESTRICT,
            gstin                  VARCHAR(15),
            gstin_state_code       VARCHAR(2),
            gst_registration_type  VARCHAR(30),
            gst_registration_date  DATE,
            pan_number             VARCHAR(10),
            pan_name               VARCHAR(255),
            tan_number             VARCHAR(10),
            tds_circle             VARCHAR(50),
            cin_number             VARCHAR(21),
            llpin                  VARCHAR(10),
            msme_registration_no   VARCHAR(20),
            msme_category          VARCHAR(20),
            msme_registration_date DATE,
            import_export_code     VARCHAR(10),
            lu_number              VARCHAR(30),
            lu_expiry_date         DATE,
            created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            created_by             VARCHAR(50),
            modified_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            modified_by            VARCHAR(50)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_tax_profile_gstin ON company_tax_profiles(gstin);")

    op.execute("""
        CREATE TABLE IF NOT EXISTS company_financial_years (
            id          VARCHAR(50)  PRIMARY KEY,
            company_id  VARCHAR(50)  NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            year_label  VARCHAR(20)  NOT NULL,
            start_date  DATE         NOT NULL,
            end_date    DATE         NOT NULL,
            status      VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
            is_active   BOOLEAN      NOT NULL DEFAULT FALSE,
            closed_at   TIMESTAMPTZ,
            closed_by   VARCHAR(50),
            locked_at   TIMESTAMPTZ,
            locked_by   VARCHAR(50),
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_company_fy_label UNIQUE (company_id, year_label)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_fy_company ON company_financial_years(company_id);")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_fy
        ON company_financial_years(company_id)
        WHERE is_active = TRUE;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS smriti_audit_log (
            id                VARCHAR(50)   PRIMARY KEY,
            tenant_id         VARCHAR(50)   NOT NULL,
            entity_id         VARCHAR(50),
            changed_table     VARCHAR(100)  NOT NULL,
            changed_record_id VARCHAR(50)   NOT NULL,
            field_name        VARCHAR(100)  NOT NULL,
            old_value         TEXT,
            new_value         TEXT,
            change_type       VARCHAR(20)   NOT NULL DEFAULT 'UPDATE',
            change_reason     TEXT,
            change_source     VARCHAR(20)   NOT NULL DEFAULT 'UI',
            changed_by        VARCHAR(50)   NOT NULL,
            changed_by_name   VARCHAR(255)  NOT NULL,
            changed_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            ip_address        VARCHAR(45),
            session_id        VARCHAR(100),
            trace_id          VARCHAR(100),
            correlation_id    VARCHAR(100),
            sha256_hash       VARCHAR(64)   NOT NULL,
            prev_hash         VARCHAR(64)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_tenant    ON smriti_audit_log(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_entity    ON smriti_audit_log(entity_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_table     ON smriti_audit_log(changed_table, changed_record_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_user      ON smriti_audit_log(changed_by);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON smriti_audit_log(changed_at DESC);")


def downgrade() -> None:
    # Reverse order (FK-safe)
    op.execute("DROP TABLE IF EXISTS smriti_audit_log;")
    op.execute("DROP TABLE IF EXISTS company_financial_years;")
    op.execute("DROP TABLE IF EXISTS company_tax_profiles;")
    op.execute("DROP TABLE IF EXISTS smriti_social_profiles;")
    op.execute("DROP TABLE IF EXISTS smriti_report_templates;")
    op.execute("DROP TABLE IF EXISTS smriti_branding;")
    op.execute("DROP TABLE IF EXISTS smriti_theme_variants;")
    op.execute("DROP TABLE IF EXISTS smriti_themes;")
    op.execute("DROP TABLE IF EXISTS smriti_settings;")
    op.execute("DROP TABLE IF EXISTS smriti_comm_channels;")
    op.execute("DROP TABLE IF EXISTS smriti_bank_accounts;")
    op.execute("DROP TABLE IF EXISTS smriti_banks;")
    op.execute("DROP TABLE IF EXISTS smriti_contacts;")
    op.execute("DROP TABLE IF EXISTS smriti_addresses;")
    op.execute("DROP TABLE IF EXISTS smriti_entity_registry;")
    # Remove additive branch columns
    for col in ["branch_type", "gstin", "phone", "email", "manager_user_id"]:
        op.execute(f"ALTER TABLE branches DROP COLUMN IF EXISTS {col};")
    # Remove additive company columns
    for col in ["organization_id", "company_code", "legal_name", "short_name",
                "company_type", "industry_type", "is_default", "is_gst_registered",
                "incorporation_date", "fiscal_year_start_month", "currency_code",
                "country_code", "timezone", "language_code", "description"]:
        op.execute(f"ALTER TABLE companies DROP COLUMN IF EXISTS {col};")
    op.execute("DROP TABLE IF EXISTS organizations;")
