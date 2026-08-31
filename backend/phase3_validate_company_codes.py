"""
PHASE 3: Company Code Constraint Validation
Check for violations of company_code standard: 3 alphanumeric [A-Z0-9], range 001-999, reserved: 000, SYS
"""
import psycopg2

def check_company_codes(db_name, conn_str):
    """Check company_code constraint violations"""
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    # Query for violations: NOT matching pattern ^[A-Z0-9]{3}$ AND NOT NULL
    cur.execute("""
        SELECT id, company_code, LENGTH(company_code) as code_len
        FROM companies
        WHERE company_code IS NOT NULL 
        AND (
            company_code !~ '^[A-Z0-9]{3}$' 
            OR company_code IN ('000', 'SYS')
        )
        ORDER BY id
    """)
    
    violations = cur.fetchall()
    
    # Count valid codes
    cur.execute("""
        SELECT COUNT(*) FROM companies
        WHERE company_code IS NOT NULL 
        AND company_code ~ '^[A-Z0-9]{3}$'
        AND company_code NOT IN ('000', 'SYS')
    """)
    
    valid_count = cur.fetchone()[0]
    
    # Count NULL codes
    cur.execute("""
        SELECT COUNT(*) FROM companies WHERE company_code IS NULL
    """)
    
    null_count = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    return {
        'db': db_name,
        'violations': violations,
        'valid_count': valid_count,
        'null_count': null_count
    }

print("[PHASE 3] Validating company_code constraint...")
print("="*70)
print("Standard: 3 alphanumeric [A-Z0-9], range 001-999")
print("Reserved: 000, SYS")
print("="*70)

smritisys_result = check_company_codes(
    'smritisys',
    'postgresql://postgres:postgres@localhost:5432/smritisys'
)

smriti001_result = check_company_codes(
    'smriti001',
    'postgresql://postgres:postgres@localhost:5432/smriti001'
)

# Display results
for result in [smritisys_result, smriti001_result]:
    print(f"\n{result['db'].upper()}:")
    print(f"  Valid codes: {result['valid_count']}")
    print(f"  NULL codes: {result['null_count']}")
    
    if result['violations']:
        print(f"  VIOLATIONS FOUND: {len(result['violations'])}")
        for company_id, company_code, code_len in result['violations']:
            print(f"    - {company_id}: '{company_code}' (len={code_len})")
    else:
        print(f"  ✓ No violations")

print("\n" + "="*70)
print("PHASE 3 VERDICT:")
print("="*70)

total_violations = len(smritisys_result['violations']) + len(smriti001_result['violations'])

if total_violations == 0:
    print("\n✓ CONSTRAINT VALIDATION PASSED")
    print("  - No company_code violations found in either database")
    print("  - Safe to create CHECK constraint in alembic migration")
    print("\nRECOMMENDATION: Create v1384_company_code_constraint migration")
else:
    print(f"\n✗ CONSTRAINT VALIDATION FAILED")
    print(f"  - Total violations found: {total_violations}")
    print(f"  - Must be repaired before applying CHECK constraint")
    print("\nBLOCKER: Review violations and repair data before proceeding")
