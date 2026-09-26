"""
PHASE 1 TRIAGE: Schema-Only Migration Analysis
For each of 70 missing tables:
- Model existence
- Production row count  
- ORM model location
- Code reference check
- Classification
"""

import os
from sqlalchemy import text, create_engine, inspect
from sqlalchemy.pool import NullPool
import json

# The 70 missing tables
MISSING_TABLES = {
    'control_plane': [
        'approval_actions', 'approval_policies', 'approval_requests',
        'crm_campaigns', 'crm_customer_activities', 'crm_leads', 'crm_opportunities',
        'distribution_claims', 'distribution_route_stops', 'distribution_routes', 'distribution_settlements',
        'item_batches', 'item_serials', 'item_warehouse_locations',
        'loading_sheet_items', 'loading_sheets',
        'module_audit_logs', 'module_states',
        'party_addresses', 'party_contacts', 'party_relationships',
        'platform_capabilities',
        'psv_party_scopes', 'psv_stock_balances', 'psv_stock_events', 'psv_visibility_policies',
        'report_dispatch_logs', 'tally_configs',
        'tenant_capability_bindings',
        'user_workspace_configs', 'workspace_templates'
    ],
    'tenant': [
        'approval_actions', 'approval_policies', 'approval_requests',
        'cge_unified_policies',
        'control_companies', 'control_company_databases', 'control_users',
        'crm_campaigns', 'crm_customer_activities', 'crm_leads', 'crm_opportunities',
        'distribution_claims', 'distribution_route_stops', 'distribution_routes', 'distribution_settlements',
        'ecom_channels', 'ecom_order_imports', 'ecom_reconciliations', 'ecom_sku_mappings', 'ecom_stock_sync_logs',
        'eway_bills',
        'item_batches', 'item_serials', 'item_warehouse_locations',
        'loading_sheet_items', 'loading_sheets',
        'party_addresses', 'party_contacts', 'party_relationships',
        'pdt_demand_signals', 'pdt_distribution_predictions', 'pdt_model_registry', 'pdt_sku_twin_cache',
        'psv_party_scopes', 'psv_stock_balances', 'psv_stock_events', 'psv_visibility_policies',
        'tenant_capability_bindings',
        'user_workspace_configs'
    ]
}

# Get unique tables across both scopes
unique_tables = set(MISSING_TABLES['control_plane'] + MISSING_TABLES['tenant'])

print("=" * 80)
print("PHASE 1 - TRIAGE: Missing Table Analysis")
print("=" * 80)
print()

# Connect to production DB
prod_url = 'postgresql://postgres:postgres@localhost:5432/smritisys'
prod_engine = create_engine(prod_url, poolclass=NullPool)

# Scan app/models for ORM definitions
models_dir = 'app/models'
orm_models = {}

if os.path.isdir(models_dir):
    for filename in os.listdir(models_dir):
        if filename.endswith('.py'):
            filepath = os.path.join(models_dir, filename)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read().lower()
                for table in unique_tables:
                    # Look for table name in file (case-insensitive)
                    if f"'{table}'" in content or f'"{table}"' in content or f'__tablename__ = ' in content:
                        if table not in orm_models:
                            orm_models[table] = []
                        orm_models[table].append(filename)

# Get row counts from production
row_counts = {}
with prod_engine.connect() as conn:
    for table in unique_tables:
        try:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table};"))
            count = result.scalar()
            row_counts[table] = count
        except Exception as e:
            row_counts[table] = f"ERROR: {str(e)[:50]}"

print(f"Total missing tables: {len(unique_tables)}")
print(f"With ORM models: {len([t for t in unique_tables if t in orm_models])}")
print()

# Triage each table
triage_results = []

for table in sorted(unique_tables):
    has_model = table in orm_models
    row_count = row_counts.get(table, "UNKNOWN")
    row_count_val = row_count if isinstance(row_count, str) else row_count
    
    # Determine initial classification
    if has_model and isinstance(row_count_val, int) and row_count_val > 0:
        classification = "LIVE_AND_CODED"
    elif has_model and (not isinstance(row_count_val, int) or row_count_val == 0):
        classification = "CODED_NOT_YET_DATA"
    elif not has_model and isinstance(row_count_val, int) and row_count_val > 0:
        classification = "DATA_NO_CODE"
    elif not has_model and (not isinstance(row_count_val, int) or row_count_val == 0):
        classification = "NEITHER"
    else:
        classification = "UNCLEAR"
    
    # Special case: control_* tables
    if table.startswith('control_'):
        classification = "SPECIAL_CONTROL_*"
    
    # Special case: cge_unified_policies
    if table == 'cge_unified_policies':
        classification = "POSSIBLY_PARKED"
    
    triage_results.append({
        'table': table,
        'has_model': has_model,
        'model_files': orm_models.get(table, []),
        'row_count': row_count_val,
        'classification': classification
    })
    
    print(f"{table:40} | Model: {str(has_model):5} | Rows: {str(row_count_val):6} | Class: {classification}")

print()
print("=" * 80)
print("SUMMARY")
print("=" * 80)

# Count by classification
by_classification = {}
for result in triage_results:
    cls = result['classification']
    by_classification[cls] = by_classification.get(cls, 0) + 1

for cls in sorted(by_classification.keys()):
    count = by_classification[cls]
    print(f"{cls:30} {count:3}")

print()
print("Next: Verify model locations and code references for each table")

prod_engine.dispose()
