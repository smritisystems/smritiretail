#!/usr/bin/env python
"""
SMRITI Staging Analysis - Phase 1: Detailed Regression Test Failure Diagnosis
==============================================================================

Re-run 8 regression suites with complete failure capture.
No changes made - analysis only.
"""

import subprocess
import json
import os
import sys
from pathlib import Path
from datetime import datetime

# Configuration
COMPANY_001_DB = 'smriti001_stage'
BACKEND_DIR = Path(__file__).parent
WORKSPACE_ROOT = BACKEND_DIR.parent

REGRESSION_TESTS = [
    ('backend/app/tests/test_sales_return_contracts.py', 'Sales Return Contracts'),
    ('backend/app/tests/test_sales.py::test_sales_return', 'Sales Return (filtered)'),
    ('backend/app/tests/test_inventory.py', 'Inventory Management'),
    ('backend/tests/test_stock_movement_ledger.py', 'Stock Movement Ledger'),
    ('backend/tests/test_wms_phase1.py', 'WMS Phase 1'),
    ('backend/tests/t_comp_center_e2e.py', 'Distribution Center E2E'),
    ('backend/app/tests/test_permission_schema.py', 'Permission Schema'),
    ('backend/app/tests/test_bootstrap_company_registration.py', 'Bootstrap Company'),
]

class RegressionAnalyzer:
    def __init__(self):
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'database': COMPANY_001_DB,
            'tests': {}
        }
        self.report_file = BACKEND_DIR / 'REGRESSION_FAILURE_ANALYSIS.txt'

    def log(self, msg):
        ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f'[{ts}] {msg}')

    def run_test(self, test_path, test_name):
        """Run single test and capture full output."""
        self.log(f'Running: {test_name}...')
        
        result = {
            'name': test_name,
            'path': test_path,
            'status': 'UNKNOWN',
            'exit_code': -1,
            'stdout': '',
            'stderr': '',
            'parsed_error': None
        }

        try:
            proc = subprocess.run(
                ['pytest', test_path, '-vv', '--tb=long', '--capture=no'],
                cwd=WORKSPACE_ROOT,
                capture_output=True,
                text=True,
                timeout=300
            )

            result['exit_code'] = proc.returncode
            result['stdout'] = proc.stdout
            result['stderr'] = proc.stderr
            result['status'] = 'PASS' if proc.returncode == 0 else 'FAIL'

            # Parse error details
            if proc.returncode != 0:
                result['parsed_error'] = self._parse_error(proc.stdout, proc.stderr, test_name)

        except subprocess.TimeoutExpired:
            result['status'] = 'TIMEOUT'
            result['parsed_error'] = {'error_type': 'TIMEOUT', 'message': 'Test timed out after 300s'}
        except Exception as e:
            result['status'] = 'ERROR'
            result['parsed_error'] = {'error_type': 'EXCEPTION', 'message': str(e)}

        self.results['tests'][test_name] = result
        self.log(f'  Result: {result["status"]}')
        
        return result

    def _parse_error(self, stdout, stderr, test_name):
        """Extract error details from test output."""
        error_info = {
            'test_name': test_name,
            'error_type': None,
            'message': None,
            'table_involved': None,
            'root_cause': None,
            'missing_table': None,
            'column_mismatch': None,
            'fk_mismatch': None,
            'constraint_mismatch': None,
            'application_bug': None,
            'test_bug': None,
            'output_excerpt': ''
        }

        # Combine output
        full_output = stdout + '\n' + stderr

        # Extract error types
        if 'no such table' in full_output.lower() or 'does not exist' in full_output.lower():
            error_info['error_type'] = 'MISSING_TABLE'
            # Extract table name
            for line in full_output.split('\n'):
                if 'table' in line.lower() and ('not exist' in line.lower() or 'no such' in line.lower()):
                    error_info['missing_table'] = line.strip()
                    break

        elif 'foreign key' in full_output.lower() or 'fk constraint' in full_output.lower():
            error_info['error_type'] = 'FK_MISMATCH'
            error_info['fk_mismatch'] = self._extract_constraint_error(full_output)

        elif 'column' in full_output.lower() and ('not exist' in full_output.lower() or 'missing' in full_output.lower()):
            error_info['error_type'] = 'COLUMN_MISMATCH'
            error_info['column_mismatch'] = self._extract_column_error(full_output)

        elif 'constraint' in full_output.lower() or 'unique' in full_output.lower():
            error_info['error_type'] = 'CONSTRAINT_MISMATCH'
            error_info['constraint_mismatch'] = self._extract_constraint_error(full_output)

        elif 'assertion' in full_output.lower() or 'assert' in full_output.lower():
            error_info['error_type'] = 'TEST_BUG'
            error_info['test_bug'] = self._extract_assertion_error(full_output)

        elif 'exception' in full_output.lower() or 'error' in full_output.lower():
            error_info['error_type'] = 'APPLICATION_ERROR'
            error_info['application_bug'] = self._extract_exception(full_output)

        else:
            error_info['error_type'] = 'OTHER'
            error_info['message'] = 'Unknown error type'

        # Extract last N lines for context
        lines = full_output.split('\n')
        error_info['output_excerpt'] = '\n'.join(lines[-30:])

        return error_info

    def _extract_column_error(self, output):
        """Extract column-related error details."""
        for line in output.split('\n'):
            if 'column' in line.lower():
                return line.strip()
        return 'Column error detected'

    def _extract_constraint_error(self, output):
        """Extract constraint-related error details."""
        for line in output.split('\n'):
            if 'constraint' in line.lower() or 'foreign' in line.lower():
                return line.strip()
        return 'Constraint error detected'

    def _extract_assertion_error(self, output):
        """Extract assertion error details."""
        for line in output.split('\n'):
            if 'assert' in line.lower() or 'AssertionError' in line:
                return line.strip()
        return 'Assertion error detected'

    def _extract_exception(self, output):
        """Extract exception details."""
        lines = output.split('\n')
        for i, line in enumerate(lines):
            if 'Traceback' in line or 'Error:' in line:
                return '\n'.join(lines[max(0, i-2):min(len(lines), i+10)])
        return 'Exception detected'

    def generate_report(self):
        """Generate detailed analysis report."""
        with open(self.report_file, 'w', encoding='utf-8') as f:
            f.write('=' * 80 + '\n')
            f.write('SMRITI REGRESSION TEST FAILURE ANALYSIS\n')
            f.write(f'Generated: {self.results["timestamp"]}\n')
            f.write(f'Database: {self.results["database"]}\n')
            f.write('=' * 80 + '\n\n')

            # Summary
            total = len(self.results['tests'])
            passed = sum(1 for t in self.results['tests'].values() if t['status'] == 'PASS')
            failed = total - passed

            f.write('SUMMARY\n')
            f.write('-' * 80 + '\n')
            f.write(f'Total Tests: {total}\n')
            f.write(f'Passed: {passed}\n')
            f.write(f'Failed: {failed}\n')
            f.write(f'Pass Rate: {100.0 * passed / total:.1f}%\n\n')

            # Detailed results
            f.write('DETAILED RESULTS\n')
            f.write('-' * 80 + '\n')

            for test_name, result in self.results['tests'].items():
                f.write(f'\n{test_name}\n')
                f.write('=' * 80 + '\n')
                f.write(f'Path: {result["path"]}\n')
                f.write(f'Status: {result["status"]}\n')
                f.write(f'Exit Code: {result["exit_code"]}\n')

                if result['parsed_error']:
                    error = result['parsed_error']
                    f.write(f'\nERROR ANALYSIS\n')
                    f.write('-' * 40 + '\n')
                    f.write(f'Error Type: {error.get("error_type", "UNKNOWN")}\n')
                    if error.get('missing_table'):
                        f.write(f'Missing Table: {error["missing_table"]}\n')
                    if error.get('column_mismatch'):
                        f.write(f'Column Issue: {error["column_mismatch"]}\n')
                    if error.get('fk_mismatch'):
                        f.write(f'FK Issue: {error["fk_mismatch"]}\n')
                    if error.get('constraint_mismatch'):
                        f.write(f'Constraint Issue: {error["constraint_mismatch"]}\n')
                    if error.get('application_bug'):
                        f.write(f'Application Error:\n{error["application_bug"]}\n')
                    if error.get('test_bug'):
                        f.write(f'Test Error:\n{error["test_bug"]}\n')

                    f.write(f'\nOUTPUT EXCERPT (Last 30 Lines)\n')
                    f.write('-' * 40 + '\n')
                    f.write(error.get('output_excerpt', 'N/A') + '\n')

                if result['stdout']:
                    f.write(f'\nSTDOUT\n')
                    f.write('-' * 40 + '\n')
                    f.write(result['stdout'][-2000:] + '\n')  # Last 2000 chars

                if result['stderr']:
                    f.write(f'\nSTDERR\n')
                    f.write('-' * 40 + '\n')
                    f.write(result['stderr'][-2000:] + '\n')  # Last 2000 chars

                f.write('\n')

    def execute(self):
        """Execute all tests and generate report."""
        os.environ['DATABASE_URL'] = f"postgresql+asyncpg://postgres:postgres@localhost:5432/{COMPANY_001_DB}"
        
        self.log(f'Starting regression analysis against {COMPANY_001_DB}...')
        self.log(f'DATABASE_URL set to {COMPANY_001_DB}')
        self.log('')

        for test_path, test_name in REGRESSION_TESTS:
            self.run_test(test_path, test_name)

        self.log('')
        self.log('Generating detailed analysis report...')
        self.generate_report()
        self.log(f'Report: {self.report_file}')

        # Print summary
        total = len(self.results['tests'])
        passed = sum(1 for t in self.results['tests'].values() if t['status'] == 'PASS')
        failed = total - passed

        print('\n' + '=' * 80)
        print('REGRESSION TEST SUMMARY')
        print('=' * 80)
        print(f'Passed: {passed}/{total}')
        print(f'Failed: {failed}/{total}')
        print(f'Pass Rate: {100.0 * passed / total:.1f}%')
        print(f'\nDetailed report: {self.report_file}')
        print('=' * 80)

if __name__ == '__main__':
    analyzer = RegressionAnalyzer()
    analyzer.execute()
