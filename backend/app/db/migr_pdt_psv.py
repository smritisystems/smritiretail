"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
from sqlalchemy import text
from app.db.session import get_company_sessionmaker

TABLES_DDL = [
    # PSV Tables
    """
    CREATE TABLE IF NOT EXISTS psv_parties (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        stock_count INTEGER DEFAULT 0,
        sell_through NUMERIC(5, 2) DEFAULT 0.00,
        weeks_of_cover NUMERIC(5, 2) DEFAULT 0.00,
        capital_locked NUMERIC(15, 2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'Healthy',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS psv_sku_tracking (
        id SERIAL PRIMARY KEY,
        party_id VARCHAR(50) NOT NULL REFERENCES psv_parties(id) ON DELETE CASCADE,
        product_id VARCHAR(50),
        sku VARCHAR(100) NOT NULL,
        invoiced_qty INTEGER DEFAULT 0,
        confirmed_sold_qty INTEGER DEFAULT 0,
        returned_qty INTEGER DEFAULT 0
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS psv_stock_events (
        event_id VARCHAR(50) PRIMARY KEY,
        source_event_id VARCHAR(100) NOT NULL UNIQUE,
        correlation_id VARCHAR(100) NOT NULL,
        causation_id VARCHAR(100),
        event_schema_version VARCHAR(20) NOT NULL DEFAULT '1.0',
        company_code VARCHAR(50) NOT NULL,
        source_database VARCHAR(100) NOT NULL,
        source_document_type VARCHAR(50) NOT NULL,
        source_document_id VARCHAR(50) NOT NULL,
        source_document_line_id VARCHAR(50),
        psv_party_id VARCHAR(50) NOT NULL,
        destination_type VARCHAR(30) DEFAULT 'RETAIL_STORE',
        destination_id VARCHAR(50),
        psv_store_id VARCHAR(50),
        sku VARCHAR(100) NOT NULL,
        movement_type VARCHAR(30) NOT NULL,
        quantity NUMERIC(12, 4) NOT NULL,
        source_event_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        event_date TIMESTAMP WITH TIME ZONE NOT NULL,
        sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS psv_stock_balances (
        id VARCHAR(50) PRIMARY KEY,
        company_code VARCHAR(50) NOT NULL,
        psv_party_id VARCHAR(50) NOT NULL,
        psv_store_id VARCHAR(50),
        sku VARCHAR(100) NOT NULL,
        billed_qty NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        received_qty NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        sold_qty NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        returned_qty NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        transferred_qty NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        current_balance NUMERIC(12, 4) NOT NULL DEFAULT 0.0000
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS psv_visibility_policies (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL,
        company_id VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50),
        policy_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        allowed_sku_patterns TEXT[] DEFAULT '{}',
        max_lookback_days INTEGER DEFAULT 90,
        is_active BOOLEAN DEFAULT TRUE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(50),
        updated_by VARCHAR(50),
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR(50),
        version INTEGER DEFAULT 1
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS psv_party_scopes (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL,
        company_id VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50),
        party_id VARCHAR(50) NOT NULL,
        policy_code VARCHAR(50) NOT NULL,
        allowed_branch_ids TEXT[] DEFAULT '{}',
        allowed_categories TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(50),
        updated_by VARCHAR(50),
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR(50),
        version INTEGER DEFAULT 1
    );
    """,

    # PDT Tables
    """
    CREATE TABLE IF NOT EXISTS pdt_model_registry (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL,
        company_id VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50),
        model_code VARCHAR(50) NOT NULL UNIQUE,
        model_name VARCHAR(255) NOT NULL,
        model_type VARCHAR(50) NOT NULL,
        algorithm VARCHAR(100) NOT NULL,
        version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
        hyperparameters JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        trained_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(50),
        updated_by VARCHAR(50),
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR(50),
        version_num INTEGER DEFAULT 1
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS pdt_sku_twin_cache (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL,
        company_id VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50),
        sku VARCHAR(100) NOT NULL,
        lead_time_days INTEGER DEFAULT 7,
        safety_buffer_qty NUMERIC(12, 4) DEFAULT 10.0000,
        daily_velocity NUMERIC(12, 4) DEFAULT 0.0000,
        current_days_of_cover NUMERIC(8, 2) DEFAULT 0.00,
        recommended_safety_stock NUMERIC(12, 4) DEFAULT 0.0000,
        last_evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(50),
        updated_by VARCHAR(50),
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR(50),
        version INTEGER DEFAULT 1
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS pdt_demand_signals (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL,
        company_id VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50),
        signal_code VARCHAR(50) NOT NULL,
        signal_type VARCHAR(50) NOT NULL,
        impact_factor NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,
        affected_categories TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(50),
        updated_by VARCHAR(50),
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR(50),
        version INTEGER DEFAULT 1
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS pdt_distribution_predictions (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL,
        company_id VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50),
        prediction_no VARCHAR(50) NOT NULL UNIQUE,
        sku VARCHAR(100) NOT NULL,
        model_code VARCHAR(50) NOT NULL,
        model_version VARCHAR(20) NOT NULL,
        forecast_horizon_days INTEGER DEFAULT 30,
        forecasted_demand NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        recommended_replenishment NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        confidence_score NUMERIC(5, 4) NOT NULL DEFAULT 0.9500,
        risk_level VARCHAR(30) DEFAULT 'LOW',
        explainability_factors JSONB DEFAULT '{}',
        generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(50),
        updated_by VARCHAR(50),
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR(50),
        version INTEGER DEFAULT 1
    );
    """,

    # CGE Unified Policy Table
    """
    CREATE TABLE IF NOT EXISTS cge_unified_policies (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL,
        company_id VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50),
        policy_code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        max_daily_points_accrual NUMERIC(12, 2) DEFAULT 10000.00,
        min_order_value_for_referral NUMERIC(15, 2) DEFAULT 500.00,
        allow_self_referral BOOLEAN DEFAULT FALSE,
        commission_reversal_on_refund BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(50),
        updated_by VARCHAR(50),
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR(50),
        version INTEGER DEFAULT 1
    );
    """
]


async def migrate_pdt_psv():
    tenants = ["smriti001", "smriti002"]
    for t in tenants:
        print(f"Migrating PDT/PSV/CGE schema on {t}...")
        sm = get_company_sessionmaker(t)
        async with sm() as session:
            for sql in TABLES_DDL:
                await session.execute(text(sql))
            await session.commit()
        print(f"Migration completed on {t}.")


if __name__ == "__main__":
    asyncio.run(migrate_pdt_psv())
