# SMRITI CONTROL-PLANE REGRESSION DIAGNOSIS
# Phase 1–3 Findings (DIAGNOSIS ONLY — NO CODE CHANGES)

Date: 2026-08-30
Status: BLOCKING ISSUES IDENTIFIED

---

## PHASE 1: COMPANY-CODE CONTRACT DIAGNOSIS

### Finding: CONTRADICTORY BUSINESS RULE

**Source 1: backend/app/api/v1/company_center.py**
- Line 43: Pydantic Field Description
- Expected Format: "4-character alphanumeric code [A-Z0-9]"
- **STATUS: MISMATCH**

**Source 2: backend/app/api/v1/company_center.py**
- Line 51: validate_company_code() Function Docstring
- Expected Format: "3-character alphanumeric company code [A-Z0-9]"
- Implementation: Enforces exactly 3 characters
- Reserved Codes: "000", "SYS"
- **STATUS: MATCHES IMPLEMENTATION**

**Source 3: backend/app/services/db_provisioner.py**
- Line 52: allocate_company_code() Docstring
- Expected Format: "3-character alphanumeric company code [A-Z0-9]"
- Implementation: Enforces exactly 3 characters
- Reserved Codes: "000", "SYS"
- **STATUS: MATCHES IMPLEMENTATION**

**Source 4: backend/app/services/db_provisioner.py**
- Line 60: generate_database_name() Docstring
- Expected Format: "Step 3: Server-side database name generation: smriti<4-character-code>."
- **STATUS: MISMATCH (says 4 in docstring, but code generates smriti<3-char>)**

**Source 5: EXISTING TEST backend/tests/t_comp_db_name.py**
- Line 25: test_generate_company_database_name_valid_alphanumeric()
- Expected Format: "smriti<4-character-alphanumeric>"
- Test Assertions: 
  - "001" -> "smriti0001"
  - "007" -> "smriti0007"
  - "ABC1" -> "smritiABC1"
  - Reserved Codes: "0000", "SYS0"
- **STATUS: EXPECTS 4-CHARACTER FORMAT WITH ZERO-PADDING**

**Source 6: EXISTING TEST backend/tests/t_comp_db_prov.py**
- Line 26: test_provisioning_dry_run_alphanumeric_abc()
- Expected Format: "ABC" -> "smritiABC"
- **STATUS: INCONSISTENT (expects 3-character format)**

### Verdict

**COMPANY_CODE_POLICY = CONFLICTING**

The repository contains two incompatible business rules:
1. **NEW CODE** (backend/app/*): Enforces 3-character codes with reserved "000" and "SYS"
2. **EXISTING TESTS** (backend/tests/t_comp_db_name.py): Expects 4-character codes with zero-padding and reserved "0000" and "SYS0"

**NEW TESTS (backend/tests/t_comp_center_e2e.py)**: Pass with 3-character rule because they were written to validate the new rule.

**EXISTING TESTS (backend/tests/t_comp_db_name.py, t_comp_db_prov.py)**: Fail under the new 3-character rule.

### Required Action

**BUSINESS APPROVAL REQUIRED**

Choose ONE:

1. **Option A: Keep 3-character rule** 
   - Modify EXISTING tests t_comp_db_name.py to expect 3-character format
   - Update reserved codes to "000" and "SYS"
   - Reject the stored 4-character database names (smriti0001, smriti0124, etc.)

2. **Option B: Revert to 4-character rule**
   - Revert backend/app/api/v1/company_center.py to enforce 4-character
   - Revert backend/app/services/db_provisioner.py to enforce 4-character
   - Revert backend/app/services/db_resolver.py to enforce 4-character
   - Keep EXISTING tests unchanged

---

## PHASE 2: INVENTORY SCHEMA DIAGNOSIS

### Finding: MIGRATION_NOT_APPLIED

**Model Definition: backend/app/models/tenant.py**
```
class Company(Base):
    __tablename__ = "companies"
    company_code = Column(String(50), nullable=True, unique=True, index=True)
    logo_url = Column(String(500), nullable=True)
```
**STATUS: Model INCLUDES company_code ✓**

**Migration: backend/alembic/versions/v1381_company_policy_and_compliance_tables.py**
```python
if "company_code" not in company_columns:
    op.add_column("companies", sa.Column("company_code", sa.String(50), nullable=True, unique=True))
if "logo_url" not in company_columns:
    op.add_column("companies", sa.Column("logo_url", sa.String(500), nullable=True))
```
**STATUS: Migration DEFINES company_code ✓**

**Live Database: smritisys (Control Plane)**
- companies.company_code: **EXISTS** ✓
- Alembic HEAD: v1382_menu_registry ✓
- **STATUS: APPLIED**

**Live Database: smriti001 (Operational Company DB)**
- companies.company_code: **MISSING** ✗
- Alembic HEAD: v1375_backfill_sales_return_cust ✗
- Missing Migrations: v1376, v1377, v1378, v1379, v1380, v1381, v1382
- **STATUS: NOT APPLIED**

### Root Cause

The migration v1381 and v1382 were only applied to `smritisys` (control plane) but NOT to `smriti001` (operational database). The inventory tests run against `smriti001`, which lacks the schema changes.

### Classification

**CLASSIFICATION: MIGRATION_NOT_APPLIED**

The schema exists in code and migrations, but was only deployed to the control plane, not to company operational databases.

### Evidence

Test Failure Output:
```
sqlalchemy.dialects.postgresql.asyncpg.AsyncAdapt_asyncpg_dbapi.ProgrammingError:
<class 'asyncpg.exceptions.UndefinedColumnError'>: column companies.company_code does not exist
```

This occurs in test_stock_movement_ledger.py which queries the `companies` table in smriti001.

---

## PHASE 3: GIT SCOPE CLASSIFICATION

### Modified Files by Category

**CONTROL_PLANE** (6 files)
- backend/app/api/v1/company_center.py (+8 lines) — company code validation
- backend/app/models/__init__.py (+2 lines) — imports
- backend/app/models/tenant.py (+2 lines) — company_code column
- backend/app/services/db_provisioner.py (+16 lines) — company code provisioning
- backend/app/services/db_resolver.py (+45 lines) — company code resolution
- backend/tests/conftest.py (+258 lines, -225 lines) — control plane seeding

**SALES_RETURN** (2 files)
- backend/app/services/distribution_svc.py (+2 lines)
- backend/app/services/eway_bill_service.py (+17 lines)

**INVENTORY** (2 files)
- backend/app/services/invoice_pdf_service.py (+10 lines)
- backend/app/services/sales_order_pdf_service.py (+2 lines)

**TEST_BOOTSTRAP** (1 file)
- backend/tests/conftest.py (+73 lines, -0 lines) — control plane test bootstrap

**UNRELATED** (19 files)
- backend/generate_tt_tax_in.py (+5 lines)
- scripts/create_invs_104.py (+5 lines)
- scripts/export_bill_106.py (+5 lines)
- scripts/export_canonical.py (+5 lines)
- scripts/gen_batch2_inv.py (+5 lines)
- scripts/run_axe_scan.py (+5 lines)
- scripts/run_hardened_e2e.py (+5 lines)
- scripts/run_headless_e2e.py (+5 lines)
- scripts/run_perf_audit.py (+5 lines)
- scripts/run_touch_audit.py (+5 lines)
- scripts/run_true_dom_e2e.py (+5 lines)
- scripts/run_true_ui_e2e.py (+5 lines)
- scripts/run_wcag_audit.py (+5 lines)
- scripts/test_playwright_73.py (+8 lines)
- scripts/update_bill_136_sis_8319.py (+5 lines)
- scripts/update_bill_136_sis_tw07.py (+5 lines)
- scripts/update_inv_73_addr.py (+5 lines)

### Verdict

**Unrelated Changes: FOUND**

**REQUIREMENT VIOLATED: UNRELATED = 0**

19 files have changes unrelated to the control-plane regression fix. These appear to be development/test environment setup changes (PYTHONPATH, sys.path.insert) left in the working tree.

---

## PHASE 4–6: GATE STATUS (WITHOUT NEW CODE CHANGES)

### Inventory Schema Status

**BLOCKED**: Cannot proceed to regression testing until smriti001 migrations are applied.

### Company-Code Contract Status

**BLOCKED_PENDING_BUSINESS_APPROVAL**: Cannot choose between 3-character and 4-character rule without explicit business decision.

### Unrelated Changes Status

**BLOCKED**: 19 unrelated files must be cleaned before acceptance.

---

## SUMMARY TABLE

| Blocker | Category | Classification | Business Impact | Resolution Path |
|---------|----------|-----------------|-----------------|-----------------|
| Company-Code Contract | Business Logic | CONFLICTING | Contradictory between API, tests, and code | Requires explicit business approval (Option A or B) |
| Inventory Schema | Database | MIGRATION_NOT_APPLIED | smriti001 lacks v1376–v1382 migrations | Apply alembic upgrade head to smriti001 |
| Unrelated Changes | Git Scope | VIOLATION | 19 files dirty | Clean working tree (git restore or discard) |

---

## STOP CONDITIONS MET

- ✓ Another schema blocker appears (companies.company_code)
- ✓ Company-code ambiguity remains (3 vs 4 character unresolved)
- ✗ Migration history needs rewriting (no, just needs application)
- ✓ Unrelated files are modified (19 files)
- ✗ Sales Return tests regress (not yet tested due to schema blocker)
- ✗ Inventory tests regress (blocked by schema, not by regression)

---

End of Diagnosis
