"""
PHASE 2B: Check if extra tables in smriti001 contain data
Critical for deciding: can we drop them or do they have business records?
"""
import psycopg2

extra_tables = [
    'approval_actions', 'approval_policies', 'approval_requests',
    'cge_unified_policies', 'communicator_logs', 'communicator_templates',
    'control_companies', 'control_company_databases', 'control_users',
    'crm_campaigns', 'crm_customer_activities', 'crm_leads', 'crm_opportunities',
    'distribution_claims', 'distribution_route_stops', 'distribution_routes', 'distribution_settlements',
    'ecom_channels', 'ecom_order_imports', 'ecom_reconciliations', 'ecom_sku_mappings', 'ecom_stock_sync_logs',
    'eway_bills', 'invoice_document_artifacts',
    'item_batches', 'item_serials', 'item_warehouse_locations',
    'loading_sheet_items', 'loading_sheets',
    'party_addresses', 'party_contacts', 'party_relationships',
    'pdt_demand_signals', 'pdt_distribution_predictions', 'pdt_model_registry', 'pdt_sku_twin_cache',
    'psv_party_scopes', 'psv_stock_balances', 'psv_stock_events', 'psv_visibility_policies',
    'sales_order_invoice_allocations',
    'tax_invoice_template_versions', 'tax_invoice_templates',
    'tenant_capability_bindings', 'user_workspace_configs'
]

print("[PHASE 2B] Checking row counts in extra tables (smriti001)")
print("="*70)

conn = psycopg2.connect(
    host='localhost', port=5432, user='postgres', password='postgres', database='smriti001'
)
cur = conn.cursor()

tables_with_data = []
tables_empty = []

for table in sorted(extra_tables):
    try:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        if count > 0:
            tables_with_data.append((table, count))
            print(f"  ✗ {table:40s}: {count:8d} rows")
        else:
            tables_empty.append(table)
            print(f"  ✓ {table:40s}: EMPTY")
    except Exception as e:
        print(f"  ? {table:40s}: ERROR - {str(e)[:30]}")

cur.close()
conn.close()

print("\n" + "="*70)
print("SUMMARY:")
print("="*70)
print(f"Tables with DATA: {len(tables_with_data)}")
for table, count in tables_with_data:
    print(f"  - {table}: {count} rows")

print(f"\nTables EMPTY: {len(tables_empty)}")

print("\n" + "="*70)
print("VERDICT:")
print("="*70)

if len(tables_with_data) > 0:
    print(f"⚠ CANNOT SAFELY DROP THESE TABLES - They contain {sum(c for _, c in tables_with_data)} total rows")
    print("  Need schema recovery strategy or migration path")
else:
    print("✓ All extra tables are EMPTY - Safe to drop")
    print("  Can remediate smriti001 by dropping orphaned tables")
