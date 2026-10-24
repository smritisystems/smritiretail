<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.32.0
  Created      : 2026-09-17
  Modified     : 2026-09-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Billing Numbering Duplicate Prevention — Walkthrough v6.32.0

**Date:** 2026-09-17
**Author:** Jawahar Ramkripal Mallah
**Commit:** `a68d1161`
**Branch:** `smritiNX`

---

## 1. Purpose

Prevent silent data corruption caused by duplicate document series rows in the
`document_series` table. Before this implementation, saving the Bill Prefix
Studio multiple times created hundreds of identical rows (864 duplicates observed
in production), causing non-deterministic number allocation and React duplicate
key warnings in the UI.

This walkthrough documents the 4-phase implementation that enforces uniqueness at
every layer of the stack: database constraints, ORM model, service pre-flight
checks, and Pydantic schema validation.

---

## 2. Scope

| Layer | File | Change Type |
|---|---|---|
| Database | `backend/alembic/versions/v1460_numbering_unique_constraints.py` | NEW — migration |
| ORM Model | `backend/app/models/numbering.py` | MODIFY — UniqueConstraint |
| Service | `backend/app/services/numbering.py` | MODIFY — pre-flight checks |
| Schema | `backend/app/schemas/numbering.py` | MODIFY — validators |
| Tests | `backend/tests/test_numbering_duplicate_prevention.py` | NEW — 5 tests |
| Documentation | `CHANGELOG.md` | MODIFY — v6.32.0 entry |
| Documentation | `docs/walkthrough/README.md` | MODIFY — index row |
| Documentation | `docs/walkthrough/billing/Billing_Numbering_Duplicate_Prevention_v6.32.0.md` | NEW — this file |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/alembic/versions/v1460_numbering_unique_constraints.py` | Alembic migration adding DB-level constraints |
| `backend/tests/test_numbering_duplicate_prevention.py` | 5-test pytest suite for pre-flight validation |
| `docs/walkthrough/billing/Billing_Numbering_Duplicate_Prevention_v6.32.0.md` | This walkthrough |

---

## 4. Files Modified

| File | What Changed |
|---|---|
| `backend/app/models/numbering.py` | Added `__table_args__` with 2 `UniqueConstraint` entries; imported `UniqueConstraint`; bumped version `3.16.0 → 3.17.0` |
| `backend/app/services/numbering.py` | Added `IntegrityError` import; replaced `save_bill_prefixes_batch` body with pre-flight checks + restructured exception handling; bumped version `3.16.0 → 3.17.0` |
| `backend/app/schemas/numbering.py` | Replaced `BillPrefixBatchSaveItem` validators with hardened version; bumped version `3.16.0 → 3.17.0` |
| `CHANGELOG.md` | Added `[6.32.0]` entry; bumped header version `6.31.0 → 6.32.0` |
| `docs/walkthrough/README.md` | Prepended v6.32.0 index row; bumped version `3.19.0 → 3.20.0` |

---

## 5. Architecture Decisions

### 5.1 Partial Unique Index Over Full Unique Constraint

Full `UNIQUE` constraints (e.g. `UNIQUE(company_id, branch_id, prefix, suffix, document_type, terminal_id)`) would prevent soft-deleted records from being re-created with the same configuration — breaking the existing soft-delete-and-restore pattern.

**Decision:** Use `CREATE UNIQUE INDEX ... WHERE is_deleted = FALSE AND is_active = TRUE` so that deleted records are transparent to the constraint, and inactive (draft) series do not compete with active ones.

### 5.2 Pre-flight Checks Before Constraint Enforcement

Database `IntegrityError` exceptions produce opaque error messages (`duplicate key value violates unique constraint`). Raising a descriptive `HTTPException` at the service layer before the DB write gives the API consumer a structured error with:
- A stable error code (`SMRITI-NUM-001`, `SMRITI-NUM-002`)
- A specific `field` name for UI highlighting
- A human-readable `message` per HREP policy

The DB constraint (`SMRITI-NUM-003`) remains as a final safety net against race conditions.

### 5.3 Self-Exclusion on Update

Both pre-flight queries add `DocumentSeries.id != item.id` when `item.id` is present. Without this, updating an existing series would always fail with "name already exists" against itself.

### 5.4 Inactive Series Excluded from Prefix Collision Check

Pre-flight 2 only queries `is_active = TRUE`. A draft or inactive series with the same prefix should not block the user from creating a new active one. The DB partial index mirrors this logic.

### 5.5 Empty Prefix Allowed

GST Rule 46(b) requires the *combined* bill number (prefix + number + suffix) to not exceed 16 characters. It does not require a prefix. Some series (e.g. VOID_SALES) carry no prefix. The regex `^[A-Z0-9\-\/]{1,10}$` is therefore only enforced when `prefix != ""`.

---

## 6. Design Rationale

- **Defence in depth:** Four independent layers each prevent the same class of error. If the schema validator is bypassed (e.g. direct API call), the service catches it. If the service has a bug, the DB constraint fires. Each layer adds observability.
- **HREP compliance:** No raw `IntegrityError` strings are exposed to users. The `except IntegrityError` block logs `str(e.orig)` internally and returns a structured JSON error body.
- **No breaking changes:** The partial index design means existing soft-deleted duplicate rows (the 864 cleaned up in commit `c775a81f`) do not violate the new constraints.

---

## 7. Implementation Summary

### Phase 1 — Migration (`v1460_numbering_unique_constraints.py`)

```sql
-- Active prefix uniqueness (partial)
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_series_active_prefix_unique
ON document_series (company_id, branch_id, prefix, suffix,
                    document_type, transaction_group, terminal_id)
WHERE is_deleted = FALSE AND is_active = TRUE;

-- Active name uniqueness (partial)
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_series_active_name_unique
ON document_series (company_id, branch_id, name)
WHERE is_deleted = FALSE;

-- GST Rule 46(b) prefix format
ALTER TABLE document_series ADD CONSTRAINT chk_document_series_prefix_format
  CHECK (prefix = '' OR (char_length(prefix) BETWEEN 1 AND 10
         AND prefix ~ '^[A-Z0-9\-\/]+$'));

-- Running length bounds
ALTER TABLE document_series ADD CONSTRAINT chk_document_series_running_length
  CHECK (running_length BETWEEN 1 AND 10);

-- Start number minimum
ALTER TABLE document_series ADD CONSTRAINT chk_document_series_start_number
  CHECK (start_number >= 1);
```

### Phase 2 — ORM (`models/numbering.py`)

```python
__table_args__ = (
    UniqueConstraint("company_id", "branch_id", "name",
                     name="uq_document_series_name_per_company"),
    UniqueConstraint("company_id", "branch_id", "prefix", "suffix",
                     "document_type", "transaction_group", "terminal_id",
                     name="uq_document_series_prefix_config"),
)
```

### Phase 3 — Service (`services/numbering.py`)

```
Pre-flight 1: name_chk query → 409 SMRITI-NUM-001 (field: "name")
Pre-flight 2: cfg_chk query  → 409 SMRITI-NUM-002 (field: "prefix")
Upsert logic: unchanged from c775a81f
Safety net:   IntegrityError → 409 SMRITI-NUM-003
```

### Phase 4 — Schema (`schemas/numbering.py`)

```python
@field_validator("prefix", mode="before")
@classmethod
def validate_prefix(cls, v):
    import re
    v = str(v).strip().upper()
    if v and not re.match(r'^[A-Z0-9\-\/]{1,10}$', v):
        raise ValueError("Prefix must be 1–10 uppercase alphanumeric (A-Z, 0-9, -, /)")
    return v
```

---

## 8. Tests Executed

**Command:**
```
python -m pytest backend/tests/test_numbering_duplicate_prevention.py -v --tb=short
```

**Literal output:**
```
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO
collecting ... collected 5 items

test_duplicate_name_raises_409            PASSED [ 20%]
test_duplicate_prefix_suffix_combo_raises_409  PASSED [ 40%]
test_same_prefix_different_suffix_allowed PASSED [ 60%]
test_same_prefix_different_terminal_allowed    PASSED [ 80%]
test_soft_deleted_duplicate_allowed       PASSED [100%]

============================== 5 passed in 4.56s ==============================
```

**py_compile:**
```
python -m py_compile backend/alembic/versions/v1460_numbering_unique_constraints.py \
    backend/app/models/numbering.py \
    backend/app/services/numbering.py \
    backend/app/schemas/numbering.py
py_compile: ALL OK
```

**TypeScript:**
```
npx tsc --noEmit
exit code: 0  (no errors)
```

---

## 9. Verification Results

| Check | Command | Result | Status |
|---|---|---|---|
| Python syntax | `py_compile` (4 files) | `ALL OK` | Done |
| TypeScript | `tsc --noEmit` | exit 0, 0 errors | Done |
| Duplicate name → 409 | pytest test 1 | PASSED | Done |
| Duplicate prefix → 409 | pytest test 2 | PASSED | Done |
| Different suffix allowed | pytest test 3 | PASSED | Done |
| Different terminal allowed | pytest test 4 | PASSED | Done |
| Soft-deleted transparent | pytest test 5 | PASSED | Done |
| DB cleanup (pre-condition) | SQL soft-delete | 864 rows → 14 canonical | Done (commit `c775a81f`) |
| Migration chain | `down_revision` | `v1459_line_level_salesperson_attribution` | Partially Verified (not applied to prod yet) |

---

## 10. Known Limitations

- **Migration not yet applied to live DB.** The `v1460` migration must be applied via `alembic upgrade head` in the production environment. Until then, the DB constraints do not exist; only the service-layer pre-flight checks protect against duplicates.
- **Pre-flight checks are not race-condition-proof.** Two concurrent saves within the same millisecond window could both pass the pre-flight and then fail at the DB constraint level. The `IntegrityError` SMRITI-NUM-003 safety net handles this.
- **ORM `UniqueConstraint` entries are informational.** The partial-index constraints created by the migration cannot be directly represented as full `UniqueConstraint` in SQLAlchemy `__table_args__` (which creates unconditional constraints). The ORM constraints will attempt to create full unconditional constraints if `alembic autogenerate` or `create_all` is run. These should be managed via migration only, not autogenerate.
- **Prefix regex allows up to 10 characters.** If a business needs prefixes longer than 10 characters, the CHECK constraint and Pydantic validator both must be updated in tandem.

---

## 11. Future Work

- Apply `v1460` migration to production via `alembic upgrade head`.
- Add frontend toast/field error handling in `SmritiDefineBillPrefixModal.tsx` to surface `SMRITI-NUM-001` on the `name` field and `SMRITI-NUM-002` on the `prefix` field as inline validation messages.
- Consider replacing ORM `UniqueConstraint` entries with `Index(..., unique=True, postgresql_where=...)` to accurately represent the partial index semantics.
- Add database-level unit tests (using a real test DB with `pytest-asyncio` + `asyncpg`) to verify the migration constraints fire correctly.

---

## 12. Related ADRs

- ADR-005: One-Way Projections & Statutory Snapshot Rule (soft-delete pattern governs why partial indexes are used)
- SMRITI-HREP: Human-Readable Error Policy (governs SMRITI-NUM-001/002/003 error code structure)

---

## 13. Related RFCs

- RFC-NUMBERING-001: Shoper 9 Bill Prefix Resolution & Batch Definition API (established `save_bill_prefixes_batch` contract)
- SMRITI-VAL-BILLING-DUP-KEY: Duplicate React key incident (root-cause investigation that preceded this implementation)
