import psycopg2
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 40 canonical tables across 4 migrations:
canonical_40 = {
    "v1385_crm": [
        "crm_leads", "crm_opportunities", "crm_campaigns", "crm_customer_activities",
        "approval_policies", "approval_requests", "approval_actions"
    ],
    "v1386_dist": [
        "distribution_routes", "distribution_route_stops", "distribution_claims",
        "loading_sheets", "distribution_settlements", "loading_sheet_items",
        "item_batches", "item_serials", "item_warehouse_locations", "eway_bills"
    ],
    "v1387_ecom": [
        "ecom_channels", "ecom_sku_mappings", "ecom_order_imports",
        "ecom_stock_sync_logs", "ecom_reconciliations",
        "party_addresses", "party_contacts", "party_relationships",
        "psv_party_scopes", "psv_visibility_policies"
    ],
    "v1388_plat": [
        "platform_capabilities", "workspace_templates", "tenant_capability_bindings",
        "user_workspace_configs", "pdt_model_registry", "pdt_sku_twin_cache",
        "pdt_demand_signals", "pdt_distribution_predictions",
        "module_states", "module_audit_logs", "tally_configs",
        "report_dispatch_logs", "cge_unified_policies"
    ]
}

all_40 = []
for mod, t_list in canonical_40.items():
    all_40.extend(t_list)

print(f"Total Canonical Tables to check: {len(all_40)}")

for db in ['smritisys', 'smriti001']:
    conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{db}')
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
    existing = set(r[0] for r in cur.fetchall())
    
    present = [t for t in all_40 if t in existing]
    missing = [t for t in all_40 if t not in existing]
    
    print(f"\n========================================================")
    print(f" DATABASE: {db} (Total Base Tables: {len(existing)})")
    print(f"========================================================")
    print(f"Canonical Present: {len(present)}/40")
    print(f"Canonical Missing: {len(missing)}/40")
    print(f"\nMissing Tables List ({len(missing)}):")
    for m in missing:
        # find which migration it belongs to
        mod_name = [k for k, v in canonical_40.items() if m in v][0]
        print(f"  ❌ {m:<30} (from {mod_name})")
        
    print(f"\nPresent Tables List ({len(present)}):")
    for p in present:
        mod_name = [k for k, v in canonical_40.items() if p in v][0]
        print(f"  ✅ {p:<30} (from {mod_name})")
    
    conn.close()
