<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS & SMRITI Systems
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.18.0
  Created      : 2026-09-14
  Modified     : 2026-09-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Bill Prefix Architecture, Multi-Terminal Scoping & Statutory GST Rule 46(b) Serialization

**Version:** `v6.18.0`  
**Date:** `2026-09-14`  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Status:** Completed & Verified  

---

## 1. Purpose
This implementation delivers a comprehensive architectural overhaul of SMRITI Retail OS's document numbering and Bill Prefix subsystem. Grounded in deep research into enterprise retail systems (specifically Shoper 9 POS and Shoper 9 Distributor numbering mechanics), this work replaces legacy, hardcoded `"D1DS13"` invoice prefixes with a configurable, multi-terminal, statutory GST Rule 46(b)-compliant numbering framework across both the FastAPI/PostgreSQL backend and the React 18/Vite POS billing terminal.

---

## 2. Scope
- **Domain Scope:** Document serialization, POS bill prefixes, multi-terminal isolation, financial year-end rollover, and statutory tax compliance.
- **Frontend Components:** `BillingTerm.tsx`, `ProPosBillingTerm.tsx`, `SmritiDefineBillPrefixModal.tsx`, `smritiBillPrefixService.ts`.
- **Backend Services & Storage:** `numbering.py` (SQLAlchemy models), `numbering.py` (Pydantic schemas), `numbering.py` (FastAPI services & endpoints), PostgreSQL `document_series` table across `smritisys` and `smriti001`.
- **Statutory Enforcement:** GST Rule 46(b) validation (max 16 characters, alphanumeric plus `/` and `-`, consecutive sequence, annual uniqueness).
- **Testing & Verification:** Pytest suite (`test_bill_prefix.py`), Vitest suite (`smritiBillPrefix.test.ts`), `tsc --noEmit`, and Vite production bundle.

---

## 3. Files Created
1. `src/services/smritiBillPrefixService.ts` — Client-side enterprise numbering service providing GST Rule 46(b) validation, dynamic prefix resolution, preview formatting, offline fallback cache, and 12 standard retail transaction defaults.
2. `src/components/billing/SmritiDefineBillPrefixModal.tsx` — Enterprise Prefix Management Studio modal supporting group-wise and transaction-wise configurations, POS terminal scoping, real-time GST character gauges, and supervisory Year-End Rollover dialogs.
3. `src/tests/smritiBillPrefix.test.ts` — Comprehensive Vitest suite covering GST Rule 46(b) validation, character limits, default schemas, and offline fallback resolution.
4. `backend/tests/test_bill_prefix.py` — Pytest suite validating backend GST Rule 46(b) checks, terminal resolution hierarchy, batch save persistence, and supervisory financial year-end rollover.

---

## 4. Files Modified
1. `backend/app/models/numbering.py` — Added columns `terminal_id`, `is_common_across_terminals`, `transaction_group`, `start_number`, and `is_void_unified` to `DocumentSeries`.
2. `backend/app/schemas/numbering.py` — Extended Pydantic request/response schemas with multi-terminal attributes, resolve requests, batch save requests, and year-end rollover schemas.
3. `backend/app/services/numbering.py` — Implemented `validate_gst_rule_46b`, `resolve_bill_prefix`, `list_bill_prefixes`, `save_bill_prefixes_batch`, and `execute_year_end_rollover` with dual `company_id`/`company_code` resolution.
4. `backend/app/api/v1/numbering.py` — Exposed REST endpoints `/bill-prefixes`, `/bill-prefixes/resolve`, `/bill-prefixes/save-batch`, `/year-end-rollover`, and `/terminal-prefixes-report`.
5. `src/components/billing/BillingTerm.tsx` — Excised hardcoded `"D1DS13"` string, added dynamic bill prefix resolver effect, hooked up "Define ⚙️" Studio modal trigger, and rendered `<SmritiDefineBillPrefixModal>`.
6. `src/components/billing/propos/ProPosBillingTerm.tsx` — Synchronized `billDocPrefix` and `billDocNumber` with dynamic prefix resolution, added "Prefix ⚙️" modal trigger button, and integrated `<SmritiDefineBillPrefixModal>`.

---

## 5. Architecture Decisions
1. **Hierarchical 3-Tier Prefix Resolution:**
   - **Tier 1 (Terminal-Specific):** If a series exists for `(company_id, document_type, terminal_id)` with `is_common_across_terminals == False`, it takes highest precedence.
   - **Tier 2 (Common Store-Level):** If no terminal override exists, the common series (`is_common_across_terminals == True` or `terminal_id == 'COMMON'`) applies.
   - **Tier 3 (Zero-Failure Fallback):** If neither exists in the database, the system automatically instantiates a statutory default without interrupting cashiers.
2. **Statutory GST Rule 46(b) Hard Guard:**
   - Evaluates `(prefix + padded_doc_no + suffix).length <= 16`.
   - Restricts character set strictly to `[A-Za-z0-9/-]`. Any special character (e.g. `_`, `@`, `#`, spaces) or excess character is rejected at both frontend input and backend API layers.
3. **Multi-Terminal Isolation vs. Unified Serialization:**
   - Configurable per series: Retail stores with autonomous billing counters use terminal-specific numbering (e.g., `T01/INV/`, `T02/INV/`), while smaller stores share a unified sequence (`INV/C/`).
4. **Supervisory Year-End Rollover (Shoper 9 Parity):**
   - Controlled rollover action that atomically updates financial year (e.g. `2025-2026` to `2026-2027`), updates serial suffix, resets running numbers to `start_number - 1`, and writes immutable audit records to `NumberingAuditLog`.

---

## 6. Design Rationale
- **Removal of Hardcoded Defaults:** The legacy `"D1DS13"` was a hardcoded test artifact from early development. In production retail chains, hardcoded values lead to invoice collision across stores and statutory penalties for invalid GST sequences.
- **Offline-First Resilience:** In the event of backend network latency or offline terminal mode, cashiers can continue billing using local cached or generated statutory defaults without checkout downtime.
- **Clean SMRITI Design System:** The Studio modal uses SMRITI slate-navy styling, semantic status chips, real-time preview bubbles, and character gauges (turning green `<= 14`, yellow `15–16`, and red `> 16`).

---

## 7. Implementation Summary
The implementation was completed systematically across 5 phases:
1. **Schema Migration & Model Extension:** Applied database DDL across `smritisys` and `smriti001`, adding the 5 columns to `document_series` with backward-compatible defaults.
2. **Backend Services & API Layer:** Extended SQLAlchemy models, created Pydantic contracts, implemented hierarchical resolution in `NumberingService`, and exposed RESTful endpoints in `/api/v1/numbering`.
3. **Frontend Enterprise Service:** Authored `smritiBillPrefixService.ts` containing the complete 12 transaction default matrix, GST validator, and API client.
4. **Prefix Management Studio Modal:** Authored `SmritiDefineBillPrefixModal.tsx` providing group-wise and transaction-wise editing, terminal selection, company code prefixes, and Year-End Rollover execution.
5. **Terminal Integration:** Connected `BillingTerm.tsx` and `ProPosBillingTerm.tsx` to automatically resolve prefixes on load and transaction-type changes, eliminating all hardcoded residue.

---

## 8. Tests Executed
1. **Pytest Backend Suite:**
   ```bash
   python -m pytest backend/tests/test_bill_prefix.py -v
   ```
2. **Vitest Frontend Suite:**
   ```bash
   npx vitest run src/tests/smritiBillPrefix.test.ts
   ```
3. **TypeScript Static Analysis:**
   ```bash
   npx tsc --noEmit
   ```
4. **Vite Production Bundle Build:**
   ```bash
   npm run build
   ```

---

## 9. Verification Results
- **Backend Tests:** 3/3 passed (100% green in 3.89s)
  - `test_gst_rule_46b_validation` PASSED
  - `test_bill_prefix_resolution_hierarchy` PASSED
  - `test_year_end_rollover_process` PASSED
- **Frontend Tests:** 7/7 passed (100% green in 401ms)
  - GST Rule 46(b) character check PASSED
  - 16-character length limit enforcement PASSED
  - Character set validation (`[A-Za-z0-9/-]`) PASSED
  - Running length padding formatter PASSED
  - Shoper 9 default schemas compliance PASSED
  - Company code inclusion PASSED
  - Offline fallback resolution PASSED
- **TypeScript:** 0 errors (`npx tsc --noEmit` exited with code 0).
- **Production Build:** 3,542 modules transformed, 0 bundle errors in 29.88s.

---

## 10. Known Limitations
- Mid-year prefix changes do not re-number historical invoices; historical records retain their original immutable invoice numbers as issued.
- Terminal-specific prefixes require cashiers to configure their local terminal ID or default to `COMMON`.

---

## 11. Future Work
- Centralized fleet prefix push from Head Office to distributed store databases via SMRITI Data Exchange.
- Automated financial year-end reminder notifications triggered on March 31st.

---

## 12. Related ADRs
- `ADR-0023`: Statutory GST Rule 46(b) Serial Number Governance.
- `ADR-0041`: Multi-Terminal POS Transaction Serialization & Outbox Concurrency.

---

## 13. Related RFCs
- `RFC-2026-08`: Elimination of Legacy Static Numbering Artifacts in SMRITI POS.
- `RFC-2026-11`: Shoper 9 Enterprise Configuration Parity in Retail OS.
