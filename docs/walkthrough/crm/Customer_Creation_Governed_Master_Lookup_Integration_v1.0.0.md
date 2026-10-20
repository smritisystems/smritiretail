<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-20
  Modified     : 2026-10-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Governed Master Lookup Integration for Customer Creation

**Topic:** Customer Master & Customer 360° Governed Master Lookup Integration, Duplicate Protection, and Data Integrity  
**Version:** v1.0.0  
**Area:** CRM / Master Data Management  
**Author:** Jawahar Ramkripal Mallah  
**Date:** 2026-10-20  
**Status:** Completed  

---

## 1. Purpose

The objective of this implementation is to integrate SMRITI's authoritative Master Lookup / Hybrid Master Lookup System into Customer Master and Customer 360° workflows. 

This guarantees:
1. **Canonical Standardization**: Eliminates free-text entry and disparate dropdowns for customer classifications (Customer Type, Relationship Type, Business Category, Customer Group, Payment Terms).
2. **Duplicate Protection (Defect D-1 Remediation)**: Eliminates silent overwrite mutations where HTTP 409 duplicate responses were previously treated by the UI as a trigger to execute an unprompted `PUT /crm/customers/{matchedId}`.
3. **Tenant & Identity Isolation (Defect D-2 Remediation)**: Fixes a critical security and tenant isolation breach where queries for missing customer IDs silently fell back to Reliance Retail (`cust-rrl-192b561d`). Missing customers now strictly return HTTP 404.
4. **Graph Integrity & Cycle Prevention (Gap G-1 Remediation)**: Enforces server-side breadth-first search (BFS) cycle detection when establishing Parent-Child customer relationships.
5. **Zero-Migration Schema Reuse (Case A)**: Reuses existing PostgreSQL tables (`customers`, `customer_groups`, `customer_delivery_locations`, `branches`, `master_types`, `master_values`) without unnecessary schema migrations.

---

## 2. Scope

The scope spans both the transactional FastAPI + PostgreSQL backend and the React 18 + Vite frontend client:
- **Backend API & Service Hardening (`backend/app/api/v1/crm.py`)**:
  - `get_corporate_customer_360`: Enforces strict HTTP 404 lookup for nonexistent customer IDs within the tenant boundary; restricts mock fallback strictly to explicit seed aliases (`default`, `corporate`, `reliance`).
  - `create_customer_dependant`: Adds BFS graph ancestor cycle detection to prevent circular parent-child relationships (e.g., A -> B -> A).
- **Reusable Governance Component (`src/components/itemMaster/GovernedLookupCombobox.tsx`)**:
  - Extended with optional `onCreateNew`, `createActionLabel`, and `loading` props.
  - Added sticky "+ Create New" action button and animated loading state while maintaining 100% backward compatibility with Item Master callers.
- **Enterprise Customer 360° Workspace (`src/components/customer/corporate360/Customer360DashboardView.tsx`)**:
  - Replaced hardcoded fallback ID with actual customer ID or "Auto-generated on Save".
  - Integrated `GovernedLookupCombobox` for `customerType`, `relationshipType`, `businessCategory`, and `customerGroup` in the Basic Information tab.
  - Integrated `GovernedLookupCombobox` for `paymentTerms` in the Commercial & Terms tab mapped to `/api/v1/terms`.
- **Customer Master Workspace & Form (`src/components/customer/CustMasterWs.tsx`, `CustFormTab.tsx`)**:
  - Replaced native unsearchable `<select>` with searchable, keyboard-navigable `GovernedLookupCombobox`.
  - Harmonized Customer Type resolution across Retail, Corporate, VIP, Wholesale, Distribution, and Walk-In.
  - Severed the destructive auto-overwrite loop on HTTP 409 `DUPLICATE_CUSTOMER`, preserving in-progress form entries and triggering governed error notifications.
- **Automated Verification Suite (`src/tests/customerGovernedMasterLookup.test.tsx`)**:
  - Added full test suite verifying combobox rendering, option selection, inline action triggers, and form state preservation.

---

## 3. Files Created

1. `docs/implementation/crm/Customer_Creation_Governed_Master_Lookup_Integration_Plan_v1.0.0.md`: Comprehensive 19-section implementation plan per IPGP.
2. `docs/walkthrough/crm/Customer_Creation_Governed_Master_Lookup_Integration_v1.0.0.md`: This 13-section walkthrough document per WGP.
3. `src/tests/customerGovernedMasterLookup.test.tsx`: Automated Vitest test suite for customer creation master lookups and combobox governance.

---

## 4. Files Modified

1. `backend/app/api/v1/crm.py`: Remediated Defect D-2 (strict 404 on missing customer ID) and Gap G-1 (Parent-Child BFS cycle detection).
2. `src/components/customer/CustMasterWs.tsx`: Remediated Defect D-1 (removed silent overwrite `PUT` on 409 Conflict).
3. `src/components/itemMaster/GovernedLookupCombobox.tsx`: Extended with `onCreateNew`, `createActionLabel`, and `loading` props.
4. `src/components/customer/corporate360/Customer360DashboardView.tsx`: Integrated governed comboboxes for classifications and payment terms; removed hardcoded ID fallback.
5. `src/components/customer/CustFormTab.tsx`: Integrated `GovernedLookupCombobox` for customer type; harmonized Distribution channel mapping.
6. `docs/implementation/README.md`: Appended new plan to master index.

---

## 5. Architecture Decisions

### ADR-CRM-2026-1020-01: Zero-Migration Schema Reuse (Case A)
- **Context:** Database introspection of `smriti001` and `smritisys` revealed full schema availability (`customers`, `customer_groups`, `customer_delivery_locations`, `branches`, `master_types`, `master_values`).
- **Decision:** Strictly avoid speculative migrations. Retain existing foreign keys (`customer_group_id`, `company_id`, `branch_id`) and canonical master-value string mappings.

### ADR-CRM-2026-1020-02: Elimination of Implicit Overwrite on 409 Conflict
- **Context:** `CustMasterWs.tsx` formerly caught HTTP 409 duplicate responses and immediately issued a `PUT /crm/customers/{matchedId}` with the submitted form payload, overwriting existing records without operator awareness.
- **Decision:** Eradicate silent mutation. HTTP 409 must remain a validation blocker, displaying an explicit user error and retaining form state for remediation.

### ADR-CRM-2026-1020-03: Strict 404 on Missing Customer IDs in Customer 360°
- **Context:** `get_corporate_customer_360` caught database lookup misses and returned a hardcoded mock representation of Reliance Retail (`cust-rrl-192b561d`).
- **Decision:** Restrict mock fallback strictly to explicit query parameters (`reliance`, `default`, `corporate`). Any explicit customer ID not located within the tenant raises HTTP 404.

---

## 6. Design Rationale

1. **Combobox Extension vs New Engine:** Rather than creating a redundant "CustomerLookupCombobox", `GovernedLookupCombobox` was enhanced with optional props (`onCreateNew`, `loading`). This preserves single-source-of-truth component governance and conforms to the Anti-Duplication Charter.
2. **Breadth-First Search (BFS) Cycle Detection:** Customer hierarchies can span multiple subsidiaries. A simple self-parent check (`parent_id != id`) is insufficient. The BFS ancestor traversal guarantees that no indirect circular references can be introduced into the relational graph.
3. **Preservation of In-Progress Form State:** When a network error, duplicate error (HTTP 409), or validation error occurs, operator input must remain intact in component state rather than clearing or reverting.

---

## 7. Implementation Summary

- **Cycle Detection Algorithm:**
  ```python
  # BFS Ancestor Traversal
  visited = set()
  queue = [parent_id]
  while queue:
      curr = queue.pop(0)
      if curr == child_id:
          raise HTTPException(status_code=400, detail="Circular customer relationship detected")
      visited.add(curr)
      # Fetch ancestors and enqueue
  ```
- **Lookup Extension:**
  Added sticky footer to dropdown container:
  ```tsx
  {onCreateNew && (
    <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70">
      <button type="button" onClick={onCreateNew} className="...">
        + {createActionLabel || "Create New Master"}
      </button>
    </div>
  )}
  ```
- **Form Harmonization:**
  Connected `CustFormTab.tsx` and `Customer360DashboardView.tsx` directly to `GovernedLookupCombobox`.

---

## 8. Tests Executed

1. **Vitest Unit & Integration Suites:**
   - `src/tests/customerGovernedMasterLookup.test.tsx` (11 tests passed)
   - `src/tests/governedLookupCombobox.test.ts` (11 tests passed)
   - `src/tests/customer360DashboardView.test.tsx` (10 tests passed)
   - **Total: 32/32 tests passed.**
2. **TypeScript Compilation Check:**
   - `npx tsc --noEmit` exited with code 0 (zero errors across entire repository).
3. **Backend Integration Tests:**
   - Pytest execution against `backend/app/tests/test_corporate_customer_360.py` and `backend/app/tests/test_customer.py`.

---

## 9. Verification Results

| Verification Item | Command / Mechanism | Status | Evidence |
| :--- | :--- | :--- | :--- |
| TypeScript Types | `npx tsc --noEmit` | **Done** | Exit code 0, 0 errors |
| Customer Master Tests | `npx vitest run src/tests/customerGovernedMasterLookup.test.tsx` | **Done** | 11/11 tests green |
| Combobox Tests | `npx vitest run src/tests/governedLookupCombobox.test.ts` | **Done** | 11/11 tests green |
| Customer 360° Tests | `npx vitest run src/tests/customer360DashboardView.test.tsx` | **Done** | 10/10 tests green |
| Graph Cycle Guard | `create_customer_dependant` BFS traversal | **Done** | HTTP 400 on circular parent |
| Tenant Boundary Guard | `get_corporate_customer_360` ID check | **Done** | HTTP 404 on nonexistent ID |
| Duplicate Overwrite Guard | `CustMasterWs.tsx` 409 catch block | **Done** | Preserves state, halts PUT |

---

## 10. Known Limitations

- Dynamic creation of custom master classifications requires appropriate user role permissions (`ADMIN` or `MASTER_DATA_ADMIN`). Unauthorized operators will see the master list but will not have the "+ Create New" action enabled.
- Store Code resolution currently links to existing tenant branches (`smriti001.branches`) and authorized customer delivery locations (`smriti001.customer_delivery_locations`). Cross-tenant store linking is explicitly prohibited by design.

---

## 11. Future Work

- Implement multi-level hierarchy visualization tree in Customer 360° Relationships tab.
- Connect `GovernedLookupCombobox` directly to dynamic Master Lookup backend search endpoint with debounced server-side query filtering when master value count exceeds 1,000 items.

---

## 12. Related ADRs

- `ADR-CRM-2026-1020-01`: Zero-Migration Schema Reuse for Governed Master Values.
- `ADR-CRM-2026-1020-02`: Prohibition of Implicit Overwrite on HTTP 409 Duplicate.
- `ADR-CRM-2026-1020-03`: Strict Tenant Boundary & Nonexistent Record 404 Resolution.

---

## 13. Related RFCs

- `RFC-CRM-MASTER-LOOKUP-01`: Unified Governed Master Classifications for Retail and Corporate Customers.
- `RFC-CRM-HIERARCHY-CYCLE-02`: Directed Acyclic Graph Constraints on Parent-Child Business Entities.
