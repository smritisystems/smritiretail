"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.29.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Schema Lifecycle & Compliance — SMRITI Canonical Enterprise Promotion Engine
"""

"""Create SMRITI Canonical Enterprise Promotion Engine schema (11 enums, 18 tables, triggers, indexes).

Revision ID: v1457_canonical_smriti_promotions_engine
Revises: v1456_tax_inclusive_barcode_group_customer_snapshot
Create Date: 2026-09-17
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "v1457_canonical_smriti_promotions_engine"
down_revision: Union[str, Sequence[str], None] = "v1456_tax_inclusive_barcode_group_customer_snapshot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # -------------------------------------------------------------------------
    # 1. Custom PostgreSQL ENUMs
    # -------------------------------------------------------------------------
    bind.execute(sa.text("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_status_enum') THEN
                CREATE TYPE smriti_promo_status_enum AS ENUM (
                    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'PAUSED', 'EXPIRED', 'ARCHIVED'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_level_enum') THEN
                CREATE TYPE smriti_promo_level_enum AS ENUM (
                    'ITEM_LEVEL', 'BILL_LEVEL'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_rule_type_enum') THEN
                CREATE TYPE smriti_promo_rule_type_enum AS ENUM (
                    'BUY_QUANTITY', 'BUY_VALUE', 'BASKET_VALUE', 'QUANTITY_SLAB', 'VALUE_SLAB',
                    'ITEM_MATCH', 'CATEGORY_MATCH', 'BRAND_MATCH', 'CUSTOMER_MATCH',
                    'CUSTOMER_TIER_MATCH', 'HAPPY_HOURS', 'STORE_MATCH'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_condition_operator_enum') THEN
                CREATE TYPE smriti_promo_condition_operator_enum AS ENUM (
                    'EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN_OR_EQUAL', 'BETWEEN'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_reward_type_enum') THEN
                CREATE TYPE smriti_promo_reward_type_enum AS ENUM (
                    'PERCENT_DISCOUNT', 'FIXED_AMOUNT_DISCOUNT', 'FIXED_COMBO_PRICE',
                    'FREE_SAME_ITEM', 'FREE_DIFFERENT_ITEM', 'DISCOUNTED_RATE', 'WALLET_CASHBACK'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_scope_type_enum') THEN
                CREATE TYPE smriti_promo_scope_type_enum AS ENUM (
                    'ITEM_SKU', 'ITEM_BARCODE', 'CATEGORY', 'SUB_CATEGORY', 'BRAND',
                    'DEPARTMENT', 'SECTION', 'STORE_BRANCH', 'WAREHOUSE', 'CUSTOMER_GROUP'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_qual_status_enum') THEN
                CREATE TYPE smriti_promo_qual_status_enum AS ENUM (
                    'QUALIFIED', 'REDEEMED', 'DECLINED', 'EXPIRED'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_redemption_role_enum') THEN
                CREATE TYPE smriti_promo_redemption_role_enum AS ENUM (
                    'TRIGGER', 'REWARD'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_override_auth_enum') THEN
                CREATE TYPE smriti_promo_override_auth_enum AS ENUM (
                    'SUPERVISOR_PIN', 'BIOMETRIC_OR_LOGIN', 'ROLE_OVERRIDE', 'REMOTE_MANAGER_TOKEN'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_conflict_strategy_enum') THEN
                CREATE TYPE smriti_promo_conflict_strategy_enum AS ENUM (
                    'BEST_BENEFIT', 'HIGHEST_PRIORITY', 'EXCLUSIVE_OVERRIDE', 'STACKABLE_COMBINED'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_audit_action_enum') THEN
                CREATE TYPE smriti_promo_audit_action_enum AS ENUM (
                    'CREATE', 'UPDATE', 'SUBMIT_APPROVAL', 'APPROVE', 'REJECT',
                    'PUBLISH', 'PAUSE', 'RESUME', 'CLONE', 'IMPORT_SKUS', 'ARCHIVE'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smriti_promo_import_status_enum') THEN
                CREATE TYPE smriti_promo_import_status_enum AS ENUM (
                    'PENDING', 'PROCESSING', 'VALIDATED', 'FAILED', 'COMMITTED'
                );
            END IF;
        END $$;
    """))

    # -------------------------------------------------------------------------
    # 2. Phase 1: Core Promotion Definition & Scopes
    # -------------------------------------------------------------------------
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS smriti_promotions (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_code          VARCHAR(50) NOT NULL,
            promotion_name          VARCHAR(255) NOT NULL,
            description             TEXT,
            level                   smriti_promo_level_enum NOT NULL DEFAULT 'ITEM_LEVEL',
            status                  smriti_promo_status_enum NOT NULL DEFAULT 'DRAFT',
            priority                INTEGER NOT NULL DEFAULT 10,
            is_exclusive            BOOLEAN NOT NULL DEFAULT FALSE,
            allow_stacking          BOOLEAN NOT NULL DEFAULT FALSE,
            max_stacked_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
            start_at                TIMESTAMPTZ NOT NULL,
            end_at                  TIMESTAMPTZ NOT NULL,
            is_active               BOOLEAN NOT NULL DEFAULT TRUE,
            is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at              TIMESTAMPTZ,
            created_by              VARCHAR(100),
            updated_by              VARCHAR(100),
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            modified_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT uq_smriti_promotions_tenant_code UNIQUE (tenant_id, promotion_code),
            CONSTRAINT chk_smriti_promotions_date_range CHECK (end_at >= start_at),
            CONSTRAINT chk_smriti_promotions_priority CHECK (priority >= 1)
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_promotions_active_lookup 
            ON smriti_promotions (tenant_id, status, is_active, start_at, end_at) 
            WHERE is_deleted = FALSE;

        CREATE TABLE IF NOT EXISTS smriti_promotion_versions (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_id            VARCHAR(50) NOT NULL REFERENCES smriti_promotions(id) ON DELETE CASCADE,
            version_no              INTEGER NOT NULL DEFAULT 1,
            status                  smriti_promo_status_enum NOT NULL DEFAULT 'DRAFT',
            effective_from          TIMESTAMPTZ NOT NULL,
            effective_to            TIMESTAMPTZ NOT NULL,
            definition_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
            definition_hash         VARCHAR(64) NOT NULL,
            change_summary          TEXT,
            approved_by             VARCHAR(100),
            approved_at             TIMESTAMPTZ,
            created_by              VARCHAR(100),
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            modified_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT uq_smriti_promo_versions_tenant_ver UNIQUE (tenant_id, promotion_id, version_no),
            CONSTRAINT chk_smriti_promo_versions_date CHECK (effective_to >= effective_from)
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_promo_versions_lookup 
            ON smriti_promotion_versions (tenant_id, promotion_id, status, effective_from, effective_to);

        CREATE TABLE IF NOT EXISTS smriti_promotion_rules (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_version_id    VARCHAR(50) NOT NULL REFERENCES smriti_promotion_versions(id) ON DELETE CASCADE,
            rule_no                 INTEGER NOT NULL DEFAULT 1,
            rule_type               smriti_promo_rule_type_enum NOT NULL,
            operator                VARCHAR(20) NOT NULL DEFAULT 'AND',
            threshold_quantity      NUMERIC(12, 3) DEFAULT 1.000,
            threshold_value         NUMERIC(15, 2) DEFAULT 0.00,
            configuration_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
            is_active               BOOLEAN NOT NULL DEFAULT TRUE,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT uq_smriti_promo_rules_seq UNIQUE (tenant_id, promotion_version_id, rule_no)
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_promo_rules_version 
            ON smriti_promotion_rules (tenant_id, promotion_version_id, is_active);

        CREATE TABLE IF NOT EXISTS smriti_promotion_conditions (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_rule_id       VARCHAR(50) NOT NULL REFERENCES smriti_promotion_rules(id) ON DELETE CASCADE,
            sequence_no             INTEGER NOT NULL DEFAULT 1,
            field_name              VARCHAR(100) NOT NULL,
            operator                smriti_promo_condition_operator_enum NOT NULL DEFAULT 'EQUALS',
            value_text              VARCHAR(255),
            value_numeric           NUMERIC(15, 4),
            value_json              JSONB,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT uq_smriti_promo_conditions_seq UNIQUE (tenant_id, promotion_rule_id, sequence_no)
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_promo_conditions_rule 
            ON smriti_promotion_conditions (tenant_id, promotion_rule_id);

        CREATE TABLE IF NOT EXISTS smriti_promotion_rewards (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_rule_id       VARCHAR(50) NOT NULL REFERENCES smriti_promotion_rules(id) ON DELETE CASCADE,
            reward_type             smriti_promo_reward_type_enum NOT NULL,
            reward_quantity         NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
            discount_percent        NUMERIC(5, 2) DEFAULT 0.00,
            discount_amount         NUMERIC(15, 2) DEFAULT 0.00,
            fixed_price             NUMERIC(15, 2),
            max_discount_cap        NUMERIC(15, 2),
            max_reward_quantity     NUMERIC(12, 3),
            applied_on              VARCHAR(30) NOT NULL DEFAULT 'LOWEST_PRICE',
            reward_scope_id         VARCHAR(50),
            tax_treatment           VARCHAR(50) NOT NULL DEFAULT 'PRE_TAX_TRADE_DISCOUNT',
            configuration_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_promo_rewards_rule 
            ON smriti_promotion_rewards (tenant_id, promotion_rule_id);

        CREATE TABLE IF NOT EXISTS smriti_promotion_scopes (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_version_id    VARCHAR(50) NOT NULL REFERENCES smriti_promotion_versions(id) ON DELETE CASCADE,
            scope_type              smriti_promo_scope_type_enum NOT NULL,
            scope_name              VARCHAR(100) NOT NULL,
            is_inclusive            BOOLEAN NOT NULL DEFAULT TRUE,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_promo_scopes_ver 
            ON smriti_promotion_scopes (tenant_id, promotion_version_id, scope_type);

        CREATE TABLE IF NOT EXISTS smriti_promotion_scope_items (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_scope_id      VARCHAR(50) NOT NULL REFERENCES smriti_promotion_scopes(id) ON DELETE CASCADE,
            item_id                 VARCHAR(50) REFERENCES items(id) ON DELETE CASCADE,
            barcode_id              VARCHAR(50) REFERENCES item_barcodes(id) ON DELETE CASCADE,
            barcode                 VARCHAR(100) NOT NULL,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT uq_smriti_scope_items_barcode UNIQUE (tenant_id, promotion_scope_id, barcode)
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_scope_items_pos_lookup 
            ON smriti_promotion_scope_items (tenant_id, barcode, promotion_scope_id);
    """))

    # -------------------------------------------------------------------------
    # 3. Phase 2: Transactional Lifecycle, Qualifications & Redemptions
    # -------------------------------------------------------------------------
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS smriti_promotion_qualifications (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_id            VARCHAR(50) NOT NULL REFERENCES smriti_promotions(id) ON DELETE RESTRICT,
            promotion_version_id    VARCHAR(50) NOT NULL REFERENCES smriti_promotion_versions(id) ON DELETE RESTRICT,
            sales_session_id        VARCHAR(100) NOT NULL,
            sales_invoice_id        VARCHAR(50) REFERENCES sales_invoices(id) ON DELETE SET NULL,
            customer_id             VARCHAR(50) REFERENCES customers(id) ON DELETE SET NULL,
            qualification_status    smriti_promo_qual_status_enum NOT NULL DEFAULT 'QUALIFIED',
            potential_discount      NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            qualified_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            resolved_at             TIMESTAMPTZ,
            trigger_snapshot_json   JSONB NOT NULL DEFAULT '{}'::jsonb
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_qualifications_session 
            ON smriti_promotion_qualifications (tenant_id, sales_session_id, qualification_status);

        CREATE TABLE IF NOT EXISTS smriti_promotion_redemptions (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_id            VARCHAR(50) NOT NULL REFERENCES smriti_promotions(id) ON DELETE RESTRICT,
            promotion_version_id    VARCHAR(50) NOT NULL REFERENCES smriti_promotion_versions(id) ON DELETE RESTRICT,
            sales_invoice_id        VARCHAR(50) NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
            customer_id             VARCHAR(50) REFERENCES customers(id) ON DELETE SET NULL,
            reward_type             smriti_promo_reward_type_enum NOT NULL,
            discount_amount         NUMERIC(15, 2) NOT NULL,
            reward_quantity         NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
            tax_treatment           VARCHAR(50) NOT NULL DEFAULT 'PRE_TAX_TRADE_DISCOUNT',
            conflict_strategy       smriti_promo_conflict_strategy_enum NOT NULL DEFAULT 'BEST_BENEFIT',
            calculation_snapshot    JSONB NOT NULL,
            redeemed_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT chk_smriti_redemptions_amount CHECK (discount_amount >= 0)
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_redemptions_invoice 
            ON smriti_promotion_redemptions (tenant_id, sales_invoice_id, promotion_id);
        CREATE INDEX IF NOT EXISTS idx_smriti_redemptions_analytics 
            ON smriti_promotion_redemptions (tenant_id, promotion_id, redeemed_at);

        CREATE TABLE IF NOT EXISTS smriti_promotion_redemption_items (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            redemption_id           VARCHAR(50) NOT NULL REFERENCES smriti_promotion_redemptions(id) ON DELETE CASCADE,
            sales_invoice_item_id   VARCHAR(50) NOT NULL REFERENCES sales_invoice_items(id) ON DELETE CASCADE,
            item_id                 VARCHAR(50) REFERENCES items(id) ON DELETE RESTRICT,
            barcode                 VARCHAR(100) NOT NULL,
            role                    smriti_promo_redemption_role_enum NOT NULL,
            allocated_quantity      NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
            unit_price              NUMERIC(15, 2) NOT NULL,
            discount_allocated      NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_redemption_items_line 
            ON smriti_promotion_redemption_items (tenant_id, sales_invoice_item_id, role);

        CREATE TABLE IF NOT EXISTS smriti_promotion_declines (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_id            VARCHAR(50) NOT NULL REFERENCES smriti_promotions(id) ON DELETE RESTRICT,
            promotion_version_id    VARCHAR(50) NOT NULL REFERENCES smriti_promotion_versions(id) ON DELETE RESTRICT,
            sales_session_id        VARCHAR(100) NOT NULL,
            sales_invoice_id        VARCHAR(50) REFERENCES sales_invoices(id) ON DELETE SET NULL,
            cashier_id              VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
            customer_id             VARCHAR(50) REFERENCES customers(id) ON DELETE SET NULL,
            decline_reason_code     VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER_DECLINED',
            decline_reason_text     VARCHAR(255),
            unclaimed_potential_savings NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            declined_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_declines_promo 
            ON smriti_promotion_declines (tenant_id, promotion_id, declined_at);
    """))

    # -------------------------------------------------------------------------
    # 4. Phase 3: Merchandising Operations, Overrides & Audit
    # -------------------------------------------------------------------------
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS smriti_promotion_overrides (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            sales_invoice_id        VARCHAR(50) NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
            sales_invoice_item_id   VARCHAR(50) REFERENCES sales_invoice_items(id) ON DELETE SET NULL,
            requested_by            VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            approved_by             VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            original_discount       NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            requested_discount      NUMERIC(15, 2) NOT NULL,
            approved_discount       NUMERIC(15, 2) NOT NULL,
            reason_code             VARCHAR(50) NOT NULL,
            reason_text             VARCHAR(255),
            authorization_method    smriti_promo_override_auth_enum NOT NULL DEFAULT 'SUPERVISOR_PIN',
            auth_token_digest       VARCHAR(64),
            approved_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_overrides_invoice 
            ON smriti_promotion_overrides (tenant_id, sales_invoice_id);

        CREATE TABLE IF NOT EXISTS smriti_promotion_audit (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_id            VARCHAR(50) NOT NULL REFERENCES smriti_promotions(id) ON DELETE CASCADE,
            promotion_version_id    VARCHAR(50) REFERENCES smriti_promotion_versions(id) ON DELETE SET NULL,
            action                  smriti_promo_audit_action_enum NOT NULL,
            actor_id                VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
            actor_name              VARCHAR(100),
            before_snapshot         JSONB,
            after_snapshot          JSONB,
            reason                  TEXT,
            ip_address              VARCHAR(45),
            client_terminal         VARCHAR(100),
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_promo_audit_promo 
            ON smriti_promotion_audit (tenant_id, promotion_id, created_at);

        CREATE TABLE IF NOT EXISTS smriti_promotion_imports (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_id            VARCHAR(50) NOT NULL REFERENCES smriti_promotions(id) ON DELETE CASCADE,
            promotion_version_id    VARCHAR(50) NOT NULL REFERENCES smriti_promotion_versions(id) ON DELETE CASCADE,
            file_name               VARCHAR(255) NOT NULL,
            file_hash               VARCHAR(64) NOT NULL,
            total_rows              INTEGER NOT NULL DEFAULT 0,
            valid_rows              INTEGER NOT NULL DEFAULT 0,
            invalid_rows            INTEGER NOT NULL DEFAULT 0,
            duplicate_rows          INTEGER NOT NULL DEFAULT 0,
            status                  smriti_promo_import_status_enum NOT NULL DEFAULT 'PENDING',
            error_summary           JSONB,
            uploaded_by             VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
            uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at            TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_promo_imports_promo 
            ON smriti_promotion_imports (tenant_id, promotion_id, status);

        CREATE TABLE IF NOT EXISTS smriti_promotion_import_rows (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            import_id               VARCHAR(50) NOT NULL REFERENCES smriti_promotion_imports(id) ON DELETE CASCADE,
            row_number              INTEGER NOT NULL,
            raw_barcode             VARCHAR(100) NOT NULL,
            resolved_item_id        VARCHAR(50) REFERENCES items(id) ON DELETE SET NULL,
            resolved_barcode_id     VARCHAR(50) REFERENCES item_barcodes(id) ON DELETE SET NULL,
            is_valid                BOOLEAN NOT NULL DEFAULT FALSE,
            error_code              VARCHAR(50),
            error_message           VARCHAR(255),
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT uq_smriti_import_rows_seq UNIQUE (tenant_id, import_id, row_number)
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_import_rows_lookup 
            ON smriti_promotion_import_rows (tenant_id, import_id, is_valid);
    """))

    # -------------------------------------------------------------------------
    # 5. Phase 4: Headless Simulation & Arbitration
    # -------------------------------------------------------------------------
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS smriti_promotion_simulations (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            promotion_id            VARCHAR(50) REFERENCES smriti_promotions(id) ON DELETE SET NULL,
            promotion_version_id    VARCHAR(50) REFERENCES smriti_promotion_versions(id) ON DELETE SET NULL,
            scenario_name           VARCHAR(255) NOT NULL,
            input_cart_snapshot     JSONB NOT NULL,
            total_gross_amount      NUMERIC(15, 2) NOT NULL,
            total_discount_computed NUMERIC(15, 2) NOT NULL,
            total_net_amount        NUMERIC(15, 2) NOT NULL,
            explainability_log      JSONB NOT NULL DEFAULT '[]'::jsonb,
            is_passed               BOOLEAN NOT NULL DEFAULT TRUE,
            created_by              VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS smriti_promotion_simulation_items (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            simulation_id           VARCHAR(50) NOT NULL REFERENCES smriti_promotion_simulations(id) ON DELETE CASCADE,
            line_number             INTEGER NOT NULL,
            barcode                 VARCHAR(100) NOT NULL,
            qty                     NUMERIC(12, 3) NOT NULL,
            unit_price              NUMERIC(15, 2) NOT NULL,
            line_gross              NUMERIC(15, 2) NOT NULL,
            line_discount           NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            line_net                NUMERIC(15, 2) NOT NULL,
            applied_rule_code       VARCHAR(50),
            is_free_item            BOOLEAN NOT NULL DEFAULT FALSE
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_sim_items_parent 
            ON smriti_promotion_simulation_items (tenant_id, simulation_id, line_number);

        CREATE TABLE IF NOT EXISTS smriti_promotion_conflicts (
            id                      VARCHAR(50) PRIMARY KEY,
            uuid                    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
            tenant_id               VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            sales_invoice_id        VARCHAR(50) NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
            competing_promotions    JSONB NOT NULL,
            arbitration_strategy    smriti_promo_conflict_strategy_enum NOT NULL DEFAULT 'BEST_BENEFIT',
            winning_promotion_id    VARCHAR(50) NOT NULL REFERENCES smriti_promotions(id) ON DELETE RESTRICT,
            winning_discount_amount NUMERIC(15, 2) NOT NULL,
            forgone_discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            explainability_rationale TEXT NOT NULL,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_smriti_conflicts_invoice 
            ON smriti_promotion_conflicts (tenant_id, sales_invoice_id);
    """))

    # -------------------------------------------------------------------------
    # 6. Triggers: Timestamp Touch & Version Immutability Guards
    # -------------------------------------------------------------------------
    bind.execute(sa.text("""
        CREATE OR REPLACE FUNCTION fn_smriti_promotions_touch_modified_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.modified_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_smriti_promotions_touch ON smriti_promotions;
        CREATE TRIGGER trg_smriti_promotions_touch
            BEFORE UPDATE ON smriti_promotions
            FOR EACH ROW
            EXECUTE FUNCTION fn_smriti_promotions_touch_modified_at();

        DROP TRIGGER IF EXISTS trg_smriti_promo_versions_touch ON smriti_promotion_versions;
        CREATE TRIGGER trg_smriti_promo_versions_touch
            BEFORE UPDATE ON smriti_promotion_versions
            FOR EACH ROW
            EXECUTE FUNCTION fn_smriti_promotions_touch_modified_at();

        CREATE OR REPLACE FUNCTION fn_smriti_promo_version_immutability_guard()
        RETURNS TRIGGER AS $$
        DECLARE
            v_redemption_count INTEGER;
        BEGIN
            IF OLD.status IN ('PUBLISHED', 'ARCHIVED') THEN
                IF NEW.definition_hash <> OLD.definition_hash OR NEW.definition_json <> OLD.definition_json THEN
                    RAISE EXCEPTION 'SMRITI Governance Error: Published promotion version % (%) is immutable and cannot be updated. Create a new version instead.',
                        OLD.id, OLD.version_no;
                END IF;
            END IF;

            IF TG_OP = 'DELETE' THEN
                SELECT COUNT(1) INTO v_redemption_count 
                FROM smriti_promotion_redemptions 
                WHERE promotion_version_id = OLD.id;

                IF v_redemption_count > 0 THEN
                    RAISE EXCEPTION 'SMRITI Compliance Error: Cannot delete promotion version % because % historical invoice redemptions are linked to it.',
                        OLD.id, v_redemption_count;
                END IF;
                RETURN OLD;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_smriti_promo_version_freeze ON smriti_promotion_versions;
        CREATE TRIGGER trg_smriti_promo_version_freeze
            BEFORE UPDATE OR DELETE ON smriti_promotion_versions
            FOR EACH ROW
            EXECUTE FUNCTION fn_smriti_promo_version_immutability_guard();
    """))


def downgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("""
        DROP TRIGGER IF EXISTS trg_smriti_promo_version_freeze ON smriti_promotion_versions;
        DROP FUNCTION IF EXISTS fn_smriti_promo_version_immutability_guard();
        DROP TRIGGER IF EXISTS trg_smriti_promo_versions_touch ON smriti_promotion_versions;
        DROP TRIGGER IF EXISTS trg_smriti_promotions_touch ON smriti_promotions;
        DROP FUNCTION IF EXISTS fn_smriti_promotions_touch_modified_at();
    """))

    tables = [
        "smriti_promotion_conflicts",
        "smriti_promotion_simulation_items",
        "smriti_promotion_simulations",
        "smriti_promotion_import_rows",
        "smriti_promotion_imports",
        "smriti_promotion_audit",
        "smriti_promotion_overrides",
        "smriti_promotion_declines",
        "smriti_promotion_redemption_items",
        "smriti_promotion_redemptions",
        "smriti_promotion_qualifications",
        "smriti_promotion_scope_items",
        "smriti_promotion_scopes",
        "smriti_promotion_rewards",
        "smriti_promotion_conditions",
        "smriti_promotion_rules",
        "smriti_promotion_versions",
        "smriti_promotions"
    ]
    for tbl in tables:
        bind.execute(sa.text(f"DROP TABLE IF EXISTS {tbl} CASCADE;"))

    enums = [
        "smriti_promo_import_status_enum",
        "smriti_promo_audit_action_enum",
        "smriti_promo_conflict_strategy_enum",
        "smriti_promo_override_auth_enum",
        "smriti_promo_redemption_role_enum",
        "smriti_promo_qual_status_enum",
        "smriti_promo_scope_type_enum",
        "smriti_promo_reward_type_enum",
        "smriti_promo_condition_operator_enum",
        "smriti_promo_rule_type_enum",
        "smriti_promo_level_enum",
        "smriti_promo_status_enum"
    ]
    for en in enums:
        bind.execute(sa.text(f"DROP TYPE IF EXISTS {en} CASCADE;"))
