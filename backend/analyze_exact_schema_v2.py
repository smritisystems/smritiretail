#!/usr/bin/env python
"""
SMRITI Staging Analysis - Phase 2: Exact Schema Difference Analysis (v2)
==========================================================================

Compare staging databases against canonical v1385-v1388 definitions.
Analyze row counts and data present/risk.

No changes made - analysis only.
"""

import psycopg2
import json
from pathlib import Path
from datetime import datetime

POSTGRES_CREDS = {
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost',
    'port': 5432
}

# Canonical tables from v1385-v1388
CANONICAL_TABLES_V1388 = {
    # v1385 CRM and Approvals
    'crm_leads', 'crm_opportunities', 'crm_campaigns', 'crm_customer_activities',
    'approval_policies', 'approval_requests', 'approval_actions',
    # v1386 Distribution
    'distribution_routes', 'distribution_route_stops', 'distribution_claims',
    'loading_sheets', 'loading_sheet_items', 'distribution_settlements',
    'item_batches', 'item_serials', 'item_warehouse_locations', 'eway_bills',
    # v1387 eCommerce & Party
    'ecom_channels', 'ecom_sku_mappings', 'ecom_order_imports', 
    'ecom_stock_sync_logs', 'ecom_reconciliations',
    'party_addresses', 'party_contacts', 'party_relationships',
    'psv_party_scopes', 'psv_visibility_policies',
    # v1388 Platform & Analytics
    'platform_capabilities', 'workspace_templates', 'tenant_capability_bindings',
    'user_workspace_configs', 'pdt_model_registry', 'pdt_sku_twin_cache',
    'pdt_demand_signals', 'pdt_distribution_predictions',
    'module_states', 'module_audit_logs', 'tally_configs', 'report_dispatch_logs',
    'cge_unified_policies'
}

# Critical tables needed by tests
CRITICAL_TABLES = {
    'smriti_permissions': 'All permission checks and auth tests',
    'company_database_registries': 'Bootstrap and company registration'
}

class SchemaAnalyzer:
    def __init__(self, staging_db):
        self.staging_db = staging_db
        self.backend_dir = Path(__file__).parent
        self.report_file = self.backend_dir / 'EXACT_SCHEMA_ANALYSIS.txt'
        self.analysis = {
            'timestamp': datetime.now().isoformat(),
            'database': staging_db,
            'total_tables': 0,
            'missing_canonical': [],
            'missing_critical': [],
            'existing_canonical': [],
            'existing_non_canonical': [],
            'data_summary': {}
        }

    def log(self, msg):
        ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f'[{ts}] {msg}')

    def connect(self, dbname):
        try:
            conn = psycopg2.connect(
                dbname=dbname,
                user=POSTGRES_CREDS['user'],
                password=POSTGRES_CREDS['password'],
                host=POSTGRES_CREDS['host'],
                port=POSTGRES_CREDS['port']
            )
            return conn
        except Exception as e:
            self.log(f'Connection failed: {e}')
            raise

    def get_all_tables(self, conn):
        """Get all tables in public schema."""
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema='public' AND table_type='BASE TABLE'
            ORDER BY table_name
        """)
        tables = {row[0] for row in cur.fetchall()}
        cur.close()
        return tables

    def get_table_info(self, conn, table_name):
        """Get basic table info (columns, row count)."""
        cur = conn.cursor()
        
        try:
            # Column count
            cur.execute("""
                SELECT COUNT(*) 
                FROM information_schema.columns 
                WHERE table_schema='public' AND table_name=%s
            """, (table_name,))
            col_count = cur.fetchone()[0]

            # Row count
            cur.execute(f"SELECT COUNT(*) FROM public.{table_name}")
            row_count = cur.fetchone()[0]

            cur.close()
            return {'columns': col_count, 'rows': row_count}
        except Exception as e:
            cur.close()
            return {'columns': 0, 'rows': 0, 'error': str(e)}

    def execute(self):
        """Execute analysis."""
        self.log(f'Starting schema analysis for {self.staging_db}...')
        
        conn = self.connect(self.staging_db)
        live_tables = self.get_all_tables(conn)
        self.analysis['total_tables'] = len(live_tables)
        
        self.log(f'Total tables in database: {len(live_tables)}')

        # Missing canonical tables
        missing_canonical = CANONICAL_TABLES_V1388 - live_tables
        self.analysis['missing_canonical'] = sorted(missing_canonical)
        self.log(f'Missing canonical tables (v1385-v1388): {len(missing_canonical)}')

        # Missing critical tables
        for table in CRITICAL_TABLES:
            if table not in live_tables:
                self.analysis['missing_critical'].append({
                    'table': table,
                    'reason': CRITICAL_TABLES[table]
                })
        self.log(f'Missing critical tables (blocking tests): {len(self.analysis["missing_critical"])}')

        # Existing canonical
        existing_canonical = CANONICAL_TABLES_V1388 & live_tables
        self.log(f'Existing canonical tables: {len(existing_canonical)}')
        
        for table in sorted(existing_canonical):
            info = self.get_table_info(conn, table)
            self.analysis['existing_canonical'].append({
                'table': table,
                'columns': info.get('columns', 0),
                'rows': info.get('rows', 0)
            })
            self.analysis['data_summary'][table] = info.get('rows', 0)

        # Non-canonical
        non_canonical = live_tables - CANONICAL_TABLES_V1388
        self.analysis['existing_non_canonical'] = sorted(non_canonical)
        self.log(f'Non-canonical existing tables: {len(non_canonical)}')

        conn.close()
        
        self.log('Generating report...')
        self.generate_report()
        self.log(f'Report: {self.report_file}')

    def generate_report(self):
        """Generate comprehensive analysis report."""
        with open(self.report_file, 'w', encoding='utf-8') as f:
            f.write('=' * 80 + '\n')
            f.write('EXACT SCHEMA DIFFERENCE ANALYSIS\n')
            f.write(f'Database: {self.staging_db}\n')
            f.write(f'Generated: {self.analysis["timestamp"]}\n')
            f.write('=' * 80 + '\n\n')

            # SUMMARY
            f.write('SUMMARY\n')
            f.write('-' * 80 + '\n')
            f.write(f'Total tables in database: {self.analysis["total_tables"]}\n')
            f.write(f'Canonical tables present: {len(self.analysis["existing_canonical"])}/40\n')
            f.write(f'Missing canonical tables: {len(self.analysis["missing_canonical"])}\n')
            f.write(f'Missing CRITICAL tables: {len(self.analysis["missing_critical"])}\n\n')

            # CRITICAL MISSING TABLES (causing test failures)
            if self.analysis['missing_critical']:
                f.write('CRITICAL MISSING TABLES (Blocking Regression Tests)\n')
                f.write('-' * 80 + '\n')
                for item in self.analysis['missing_critical']:
                    f.write(f'\nTable: {item["table"]}\n')
                    f.write(f'Purpose: {item["reason"]}\n')
                f.write('\n')

            # MISSING CANONICAL TABLES
            f.write('MISSING CANONICAL TABLES (v1385-v1388)\n')
            f.write('-' * 80 + '\n')
            if self.analysis['missing_canonical']:
                for table in self.analysis['missing_canonical']:
                    f.write(f'  {table}\n')
            else:
                f.write('  (none)\n')
            f.write('\n')

            # EXISTING CANONICAL TABLES
            f.write('EXISTING CANONICAL TABLES (v1385-v1388)\n')
            f.write('-' * 80 + '\n')
            f.write('Table Name                          Columns   Rows\n')
            f.write('-' * 80 + '\n')
            for item in self.analysis['existing_canonical']:
                f.write(f'{item["table"]:<35} {item["columns"]:>7}  {item["rows"]:>10}\n')
            f.write('\n')

            # DATA PRESENCE
            f.write('DATA PRESENT IN EXISTING CANONICAL TABLES\n')
            f.write('-' * 80 + '\n')
            tables_with_data = [t for t in self.analysis['existing_canonical'] if t['rows'] > 0]
            tables_empty = [t for t in self.analysis['existing_canonical'] if t['rows'] == 0]
            
            f.write(f'Tables with data: {len(tables_with_data)}\n')
            f.write(f'Tables empty: {len(tables_empty)}\n\n')
            
            f.write('Tables with data:\n')
            for item in tables_with_data:
                f.write(f'  {item["table"]}: {item["rows"]} rows\n')
            
            if tables_empty:
                f.write('\nTables empty:\n')
                for item in tables_empty:
                    f.write(f'  {item["table"]}\n')
            f.write('\n')

            # NON-CANONICAL TABLES
            f.write('NON-CANONICAL EXISTING TABLES\n')
            f.write('-' * 80 + '\n')
            f.write(f'Total: {len(self.analysis["existing_non_canonical"])}\n\n')
            f.write('First 30:\n')
            for table in self.analysis['existing_non_canonical'][:30]:
                f.write(f'  {table}\n')
            if len(self.analysis['existing_non_canonical']) > 30:
                f.write(f'  ... and {len(self.analysis["existing_non_canonical"]) - 30} more\n')

if __name__ == '__main__':
    analyzer = SchemaAnalyzer('smriti001_stage')
    analyzer.execute()
