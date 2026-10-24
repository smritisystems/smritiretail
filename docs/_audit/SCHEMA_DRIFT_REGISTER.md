<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Version      : 1.0.0
  Created      : 2026-09-29
  Modified     : 2026-09-29
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal -- Audit Artifact
-->

# SMRITI Retail OS -- Schema & Architecture Drift Register

Surfaced during Full System FK Audit (branch: smritiNX, 2026-09-29).
Naming convention: ARCH-DRIFT-NNN (architectural model issues), SCHEMA-DRIFT-NNN (type/constraint issues).

---

## ARCH-DRIFT-001: module_states + smriti_numbering_registry tenant_id format mismatch

| Field | Value |
|---|---|
| DB | smritisys (control plane) |
| Tables | module_states, smriti_numbering_registry |
| Filed | 2026-09-29 |
| Commit | 977b1b91 (v1502) |

**module_states.tenant_id** — **CLOSED as intentional.**
Contains PostgreSQL database name (`"smriti001"`), not a `companies.id` value.
This is correct design: module_states is a per-tenant DB health table; tenant_id = DB name.
No FK to companies is appropriate or possible.

**smriti_numbering_registry.tenant_id** — **RESOLVED in v1502.**
Root cause: `tenant_id` column stored `companies.id` values while the canonical
`company_id` FK column (with FK `smriti_numbering_registry_company_id_fkey`) was never populated.
Fix: `UPDATE smriti_numbering_registry SET company_id = tenant_id WHERE tenant_id matches companies.id`
Evidence: 162 rows backfilled, 0 unexpected_empty remaining.
Status: **Done** (v1502, commit 977b1b91).

---

## ARCH-DRIFT-002: Polymorphic party_id in general_ledger_entries and payment_transactions

| Field | Value |
|---|---|
| DB | smriti001 (tenant) |
| Tables | general_ledger_entries, payment_transactions |
| Filed | 2026-09-29 |
| Status | Open -- RFC required |

**Evidence:**
```
general_ledger_entries.party_id (3587 rows, 585 populated):
  305 -> customers.id  (cust-* prefix)
   22 -> suppliers.id  (sup-* prefix)
  258 -> no match anywhere (true orphans)

payment_transactions.party_id (858 rows, 453 populated):
  346 -> customers.id
    0 -> suppliers.id
  107 -> no match anywhere (true orphans)
```

**Root cause:** Both tables use `party_id` as a discriminated union:
it can reference either `customers` or `suppliers` depending on the transaction context.
No FK to `parties.id` is possible or correct -- there is no single parent table.

**Required resolution (RFC):**
- Add discriminator column: `party_type ENUM('CUSTOMER','SUPPLIER')`
- Rename `party_id` -> `party_ref_id` to signal polymorphism
- Add partial CHECK or application-level validation per type
- OR: split into two nullable columns `customer_id -> customers.id` + `supplier_id -> suppliers.id`
- Requires data migration + ORM model change

Status: **Open -- no FK added. Must file RFC before addressing.**

---

## ARCH-DRIFT-003: psv_party_scopes.party_id -- all rows are true orphans

| Field | Value |
|---|---|
| DB | smriti001 (tenant) |
| Table | psv_party_scopes |
| Filed | 2026-09-29 |
| Status | Open -- PSV architecture review needed |

**Evidence:**
```
psv_party_scopes.party_id: 29 rows, all 29 populated
  -> parties.id:   0 matches
  -> customers.id: 0 matches
  -> suppliers.id: 0 matches
True orphans: 29/29
```

**Root cause:** The PSV (Platform Scope) subsystem uses `party_id` to reference
an entity class that does not yet have a corresponding table in the schema, OR
the PSV party_id domain is a platform-internal concept (e.g. API client IDs)
not tracked as an ORM model row.

**Required resolution:**
- PSV architecture review: what entity class does psv_party_scopes.party_id reference?
- If PSV party = API client, add `platform_clients` or equivalent table
- If PSV party = companies.id, rename column and add FK to companies
- See: `docs/architecture/05_psv_subsystem.md`

Status: **Open -- needs PSV module owner review.**

---

## SCHEMA-DRIFT-001: (Retired -- resolved in v1497a)

`products.tenant_id` VARCHAR column retired from all tenant DB tables.
Evidence: v1497a migration, commit b156802b.
Status: **Done.**

---

## SCHEMA-DRIFT-002: sales_factors.valid_from / valid_to -- VARCHAR(20) vs timestamptz

| Field | Value |
|---|---|
| DB | smriti001 (tenant) |
| Table | sales_factors |
| Filed | 2026-09-29 |
| Commit | 977b1b91 (v1502) |

**Evidence:**
- ORM: `DateTime(timezone=True)` (correct)
- Live schema: `character varying(20)` (drift)
- Row count at fix time: 0 (clean ALTER, no data migration needed)

**Fix applied (v1502):**
```sql
ALTER TABLE sales_factors ALTER COLUMN valid_from TYPE timestamptz USING valid_from::timestamptz;
ALTER TABLE sales_factors ALTER COLUMN valid_to   TYPE timestamptz USING valid_to::timestamptz;
```
Verified: both columns now `timestamp with time zone` in information_schema.
Status: **Done** (v1502, commit 977b1b91).

---

## SCHEMA-DRIFT-003: po_product_decision_log.product_id -- polymorphic column, wrong FK target

| Field | Value |
|---|---|
| DB | smriti001 (tenant) |
| Table | po_product_decision_log |
| Filed | 2026-09-29 |
| Commit | 9ff05693 (v1503) |
| Status | Open -- schema split RFC required |

**Evidence:**
```
po_product_decision_log.product_id (33 rows, 25 orphaned vs products):
  10 rows: match items.id (e.g. itm-smk-xv-27f174, itm-smk-al-27f174)
  15 rows: SMK-ALLOW-*, SMK-BLOK-*, SMK-UNASN-* decision codes (not any table row)
   8 rows: no match in any table
```

**Root cause:** The `product_id` column is a polymorphic field that stores:
1. `items.id` references (purchasing view of a product)
2. Decision status codes (`ALLOW`, `BLOCK`, `UNASSIGN` + a hash suffix)
These cannot be expressed as a single FK constraint.

The FK `fk_ppdl_product_id -> products.id` was added in v1501 in error based
on the column name, and was dropped in v1503.

**Required resolution (RFC):**
- Split `product_id` into two typed columns:
  - `item_id VARCHAR(50) -> items.id ON DELETE SET NULL`
  - `decision_code VARCHAR(20)` -- constrained to allowed values
- Requires: ORM model change, data migration, test update

Status: **Open -- no FK. Schema split RFC required before addressing.**

---

## NOT VALID FK Cleanup Backlog (4 remaining)

All 4 have real historical orphan data from deleted records.
Business decision required before `VALIDATE CONSTRAINT` can succeed.

| Constraint | Table | Column | Orphans | Root Cause |
|---|---|---|---|---|
| fk_sii_product_id | sales_invoice_items | product_id | 954 | 26 distinct products hard-deleted from catalog |
| fk_ccle_customer_id | customer_credit_ledger_entries | customer_id | 158 | 158 distinct cust-corp-* customers hard-deleted |
| fk_psi_product_id | packing_slip_items | product_id | 40 | prod_1_*, prod_dsp_* — deleted products |
| fk_di_product_id | dispatch_items | product_id | 18 | prod_api_* — deleted products |

**Required action per row group:**
- Archive orphan rows to `*_archive` shadow tables, OR
- Accept as permanent historical gaps and leave NOT VALID as permanent state, OR
- Soft-delete the orphaned product records (restore with is_deleted=TRUE) then VALIDATE

Status: **Open -- awaiting business decision.**