<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.10.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# CRM Customer Catalogue -- Missing Endpoints & Hardcoded Defaults Fix
**Walkthrough Version:** v3.10.0
**Area:** CRM / Customer Catalogue
**Date:** 2026-10-19
**Commit:** 09edbebb
**Status:** Done

## 1. Purpose
Resolve 5 critical gaps in the Customer Catalogue API that caused CustomerCreditModal, Customer360LoyaltyModal, LoyaltyLedgerModal, and CorporateCustomer360 to fail silently. Also remove all tenant-specific hardcoded string defaults from CustMasterWs.tsx.

## 2. Scope
| Layer | Affected |
|---|---|
| Backend | backend/app/api/v1/crm.py |
| Frontend | src/components/customer/CustMasterWs.tsx |
| Routes added | +10 (1624 -> 1634 total) |

## 3. Files Created
None.

## 4. Files Modified
| File | Change |
|---|---|
| backend/app/api/v1/crm.py | 5 new endpoints; version 3.9.0 -> 3.10.0 |
| src/components/customer/CustMasterWs.tsx | 5 hardcoded defaults removed; SEED_CUSTOMERS replaced with empty array; pagination added |

## 5. Architecture Decisions
- Credit fields (credit_limit, credit_days, credit_hold) live on CustomerGroup, not Customer. Endpoint uses selectinload(Customer.group).
- Payment terms live on CustomerPolicy. Endpoint uses selectinload(Customer.policy).
- Loyalty returns enrolled=False (not 404) when no membership exists.
- SEED_CUSTOMERS removed: initial state is empty array with localStorage fallback only.
- customer-price-groups maps CustomerGroup as the price group entity.

## 6. Design Rationale
All new endpoints are GET-only, no extra role restriction. Purchases supports pagination (limit/skip). No mock data returned.

## 7. Implementation Summary

### New Backend Endpoints
- GET /crm/customers/{id}/loyalty   -> LoyaltyMember + tier + last 10 transactions
- GET /crm/customers/{id}/credit    -> credit from customer.group, payment from customer.policy
- GET /crm/customers/{id}/purchases -> paginated SalesInvoice {total, data[]}
- GET /crm/customers/{id}/summary   -> aggregated 360: invoices, spend, loyalty, credit
- GET /crm/customer-price-groups    -> CustomerGroup list for price group dropdown

### Frontend Changes (CustMasterWs.tsx)
| Field | Before | After |
|---|---|---|
| createEmptyCustomer.priceGroup | "TI#Tech Infotech Ltd" | "" |
| createEmptyCustomer.loyaltyPgmId | "024" | "" |
| createEmptyCustomer.loyaltyPgmCode | "DSC" | "" |
| mapper priceGroup fallback | "TI#Tech Infotech Ltd" | "" |
| mapper loyaltyPgmId fallback | || "024" | || "" |
| initial customers state | SEED_CUSTOMERS | [] (localStorage fallback) |
| loadCustomersFromBackend URL | /crm/customers | /crm/customers?limit=100&skip=0 |

## 8. Tests Executed
PowerShell smoke test suite on localhost:1981, 2026-10-19T07:57:44+05:30

## 9. Verification Results
```
AUTH: OK | routes=1634
  PASS  [C1] loyalty       -> enrolled=False pts=0
  PASS  [C2] credit        -> credit_limit=100000.0 hold=False outstanding=155.24
  PASS  [C3] purchases     -> total=263 data[20]
  PASS  [C4] summary       -> invoices=0 lifetime_spend=0.0 loyalty_enrolled=False
  PASS  [C5] price-groups  -> array[100]
  PASS  [H1] customers?100 -> array[100]
  PASS  [H7] search?relia  -> array[4]
Result: 7/7 PASS | Routes: 1624 -> 1634 (+10) | Commit: 09edbebb
```

## 10. Known Limitations
- Loyalty enrolled=False for RRL-001: loyalty_members FK was seeded with code-based key, not UUID. Needs data migration.
- customer-price-groups uses CustomerGroup as proxy -- no dedicated price group table yet.
- loadCustomersFromBackend only fetches page 1 (limit=100). Multi-page navigation is future work.

## 11. Future Work
- H1: Multi-page customer list with server-side pagination
- H2: Add code field to CustomerGroup for short codes (CG-CORP, CG-VIP)
- H3: Reseed group/tier names to remove random suffixes
- H4: Fix loyalty tier member_count discrepancy (Silver shows 0)
- H7: Filter archived customers from search by default
- M1: Add /crm/segments and /crm/customers/{id}/segments
- M2: Add /api/v1/customers/export (CSV/XLSX)

## 12. Related ADRs
None.

## 13. Related RFCs
None.
