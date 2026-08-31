#!/usr/bin/env python
"""
SMRITI Staging Analysis - Phase 2: Exact Schema Difference Analysis
====================================================================

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

class SchemaAnalyzer:
    def __init__(self, staging_db):
        self.staging_db = staging_db
        self.backend_dir = Path(__file__).parent
        self.report_file = self.backend_dir / 'EXACT_SCHEMA_ANALYSIS.txt'
        self.analysis = {
            'timestamp': datetime.now().isoformat(),
            'database': staging_db,
            'missing_canonical_tables': [],
            'existing_drifted_tables': [],
            'existing_non_canonical_tables': [],
            'critical_missing_for_tests': []
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

    def get_table_schema(self, conn, table_name):
        """Get detailed schema for a table."""
        cur = conn.cursor()
        
        # Columns
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default, 
                   character_maximum_length, numeric_precision, numeric_scale
            FROM information_schema.columns 
            WHERE table_schema='public' AND table_name=%s
            ORDER BY ordinal_position
        """, (table_name,))
        columns = cur.fetchall()

        # PK
        cur.execute("""
            SELECT a.attname 
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelname = (
                SELECT indexname FROM pg_indexes 
                WHERE schemaname='public' AND tablename=%s AND indexname LIKE %s
            )
        """, (table_name, table_name + '_pkey'))
        pk_columns = [row[0] for row in cur.fetchall()]

        # UNIQUE constraints
        cur.execute("""
            SELECT constraint_name, column_name 
            FROM information_schema.constraint_column_usage 
            WHERE table_schema='public' AND table_name=%s 
            AND constraint_name NOT LIKE '%_pkey'
        """, (table_name,))
        unique_constraints = cur.fetchall()

        # Foreign keys
        cur.execute("""
            SELECT constraint_name, column_name, table_name 
            FROM information_schema.referential_constraints rc
            JOIN information_schema.constraint_column_usage ccu 
                ON rc.constraint_name = ccu.constraint_name
            WHERE ccu.table_schema='public' AND ccu.table_name=%s
        """, (table_name,))
        fks = cur.fetchall()

        # Row count
        cur.execute(f"SELECT COUNT(*) FROM {table_name}")
        row_count = cur.fetchone()[0]

        # Check for data issues
        cur.execute(f"""
            SELECT COUNT(*) FROM {table_name} 
            WHERE EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name=%s AND is_nullable='NO' AND column_default IS NULL
            )
        """, (table_name,))
        
        cur.close()
        
        return {
            'columns': columns,
            'pk': pk_columns,
            'unique': unique_constraints,
            'fks': fks,
            'row_count': row_count
        }

    def analyze_missing_tables(self, conn, live_tables):
        """Analyze missing canonical tables."""
        self.log('Analyzing missing canonical tables...')
        missing = CANONICAL_TABLES_V1388 - live_tables
        
        # Critical missing tables that cause test failures
        critical = {
            'smriti_permissions': 'Required by all permission checks (v1384 pre-canonical)',
            'company_database_registries': 'Required by bootstrap tests (v1384 pre-canonical)'
        }
        
        for table in missing:
            if table in critical:
                self.analysis['critical_missing_for_tests'].append({
                    'table': table,
                    'reason': critical[table],
                    'tests_affected': ['permission_schema', 'bootstrap', 'sales_return', 'inventory']
                })
            else:
                self.analysis['missing_canonical_tables'].append(table)
        
        self.log(f'  Missing canonical tables: {len(missing)}')
        self.log(f'  Critical missing tables: {len(self.analysis["critical_missing_for_tests"])}')

    def analyze_drifted_tables(self, conn, live_tables):
        """Analyze existing tables for schema drift."""
        self.log('Analyzing schema drift in existing tables...')
        
        canonical_in_db = CANONICAL_TABLES_V1388 & live_tables
        
        for table in sorted(canonical_in_db):
            try:
                schema = self.get_table_schema(conn, table)
                
                self.analysis['existing_drifted_tables'].append({
                    'table': table,
                    'columns': len(schema['columns']),
                    'row_count': schema['row_count'],
                    'has_data': schema['row_count'] > 0,
                    'pk': schema['pk'],
                    'schema': schema
                })
            except Exception as e:
                self.log(f'  Error analyzing {table}: {e}')
        
        self.log(f'  Analyzed {len(canonical_in_db)} existing canonical tables')

    def analyze_non_canonical(self, conn, live_tables):
        """Identify non-canonical tables."""
        non_canonical = live_tables - CANONICAL_TABLES_V1388
        self.analysis['existing_non_canonical_tables'] = sorted(non_canonical)
        self.log(f'  Non-canonical existing tables: {len(non_canonical)}')

    def generate_report(self):
        """Generate comprehensive analysis report."""
        with open(self.report_file, 'w', encoding='utf-8') as f:
            f.write('=' * 80 + '\n')
            f.write('EXACT SCHEMA DIFFERENCE ANALYSIS\n')
            f.write(f'Database: {self.staging_db}\n')
            f.write(f'Generated: {self.analysis["timestamp"]}\n')
            f.write('=' * 80 + '\n\n')

            # CRITICAL MISSING TABLES
            f.write('CRITICAL MISSING TABLES (Causing Test Failures)\n')
            f.write('-' * 80 + '\n')
            for item in self.analysis['critical_missing_for_tests']:
                f.write(f'\nTable: {item["table"]}\n')
                f.write(f'Reason: {item["reason"]}\n')
                f.write(f'Tests Affected: {", ".join(item["tests_affected"])}\n')
            f.write('\n')

            # MISSING CANONICAL TABLES
            f.write('MISSING CANONICAL TABLES (v1385-v1388)\n')
            f.write('-' * 80 + '\n')
            f.write(f'Total: {len(self.analysis["missing_canonical_tables"])}\n\n')
            for table in sorted(self.analysis['missing_canonical_tables']):
                f.write(f'  - {table}\n')
            f.write('\n')

            # EXISTING DRIFTED TABLES
            f.write('EXISTING CANONICAL TABLES IN DATABASE\n')
            f.write('-' * 80 + '\n')
            f.write(f'Total: {len(self.analysis["existing_drifted_tables"])}\n\n')
            
            for item in self.analysis['existing_drifted_tables']:
                f.write(f'Table: {item["table"]}\n')
                f.write(f'  Columns: {item["columns"]}\n')
                f.write(f'  Row Count: {item["row_count"]}\n')
                f.write(f'  Has Data: {"YES" if item["has_data"] else "NO"}\n')
                f.write(f'  PK: {", ".join(item["pk"]) if item["pk"] else "UNKNOWN"}\n')
                f.write('\n')

            # NON-CANONICAL TABLES
            f.write('EXISTING NON-CANONICAL TABLES\n')
            f.write('-' * 80 + '\n')
            f.write(f'Total: {len(self.analysis["existing_non_canonical_tables"])}\n\n')
            for table in sorted(self.analysis['existing_non_canonical_tables'][:20]):  # First 20
                f.write(f'  - {table}\n')
            if len(self.analysis['existing_non_canonical_tables']) > 20:
                f.write(f'  ... and {len(self.analysis["existing_non_canonical_tables"]) - 20} more\n')
            f.write('\n')

            # DATA RISK ANALYSIS
            f.write('DATA RISK ANALYSIS\n')
            f.write('-' * 80 + '\n')
            tables_with_data = [t for t in self.analysis['existing_drifted_tables'] if t['has_data']]
            f.write(f'Existing canonical tables with data: {len(tables_with_data)}\n\n')
            for item in tables_with_data:
                f.write(f'{item["table"]}: {item["row_count"]} rows\n')

    def execute(self):
        """Execute analysis."""
        self.log(f'Starting schema analysis for {self.staging_db}...')
        
        conn = self.connect(self.staging_db)
        live_tables = self.get_all_tables(conn)
        
        self.log(f'Total tables in database: {len(live_tables)}')
        
        self.analyze_missing_tables(conn, live_tables)
        self.analyze_drifted_tables(conn, live_tables)
        self.analyze_non_canonical(conn, live_tables)
        
        conn.close()
        
        self.log('Generating report...')
        self.generate_report()
        self.log(f'Report: {self.report_file}')

if __name__ == '__main__':
    analyzer = SchemaAnalyzer('smriti001_stage')
    analyzer.execute()
