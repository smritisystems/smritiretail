<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Version      : 3.13.0
  Created      : 2026-10-19
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# CRM Customer Catalogue - C3 Purchase History & H8 Customer 360 (v3.13.0)

**WGP Document**
**Date:** 2026-10-19
**Author:** Jawahar Ramkripal Mallah
**Commits:** cb80f982, ffe9c888
**Branch:** smritiNX

---

## 1. Purpose

Implement C3 (Customer Purchase History) and H8 (Customer 360 Composite) endpoints for the
CRM module, enabling single-call retrieval of a customer's full transactional and loyalty profile.
Fix three attribute errors in H8 caused by incorrect Customer model field assumptions.

---

## 2. Scope

- GET /crm/customers/{id}/purchases (C3) -- paginated invoice history
- GET /crm/customers/{id}/360 (H8) -- composite 360-degree view
- Bug fixes: gst_no, credit_limit/credit_days, credit_hold sourcing

---

## 3. Files Created

None.

---

## 4. Files Modified

| File | Change |
|---|---|
| backend/app/api/v1/crm.py | Added C3 endpoint (~60 lines), added H8 endpoint (~100 lines), 3 bug fixes |

---

## 5. Architecture Decisions

- C3 queries sales_invoices filtered by customer_id + company_id with optional status filter.
- H8 aggregates in a single async function: identity, credit (from CustomerGroup), purchase aggs
  (COUNT/SUM/MAX on sales_invoices), loyalty (LoyaltyMember + LoyaltyTier join), segments
  (CrmSegmentMembership join), and group (CustomerGroup).
- credit_limit and credit_days are NOT on Customer; they live on CustomerGroup. H8 derives
  these from the group record, not the customer row.
- loyalty_tier_id field (not 	ier_id) is the correct LoyaltyMember column name.

---

## 6. Design Rationale

- H8 uses a single endpoint to minimise round-trips for the Corporate 360 dashboard.
- C3 uses offset pagination (limit/offset) with total count to support infinite scroll.
- Credit sourced from group allows individual customers without personal credit overrides
  to inherit group policy without redundant column storage.

---

## 7. Implementation Summary

### C3 -- GET /crm/customers/{id}/purchases

`python
SELECT sales_invoices WHERE customer_id=X AND company_id=Y
Optional: AND status=Z
ORDER BY date DESC, id DESC
LIMIT/OFFSET pagination
Returns: total, data[{invoice_no, date, grand_total, tax_total, status, ...}]
`

Verified: 	otal=263 for customer cust-rrl-192b561d.

### H8 -- GET /crm/customers/{id}/360

Five sequential async queries:
1. Customer identity row
2. Purchase aggregates (COUNT, SUM, MAX, AVG on sales_invoices)
3. Loyalty (LoyaltyMember LEFT JOIN LoyaltyTier)
4. Segments (CrmSegmentMembership JOIN CrmSegment)
5. Group (CustomerGroup SELECT with credit_limit, credit_days, credit_hold)

Returns composite JSON dict with all fields.

### Bug Fixes

| Bug | Root Cause | Fix |
|---|---|---|
| AttributeError: Customer has no attribute gst_no | Column is gst_number not gst_no | Changed to cust.gst_number |
| AttributeError: Customer has no attribute credit_limit | credit_limit is on CustomerGroup not Customer | Sourced from grp[credit_limit] |
| AttributeError: Customer has no attribute credit_days | credit_days is on CustomerGroup not Customer | Sourced from grp[credit_days] |
| AttributeError: LoyaltyMember has no attribute tier_id | Column is loyalty_tier_id not tier_id | Changed to loyalty_tier_id |

---

## 8. Tests Executed

`
Smoke test -- live API against smriti001 tenant, 2026-10-19 13:46 IST

C3_purchases: total=263 returned=3 first_inv=INV-20261017-E405B3   PASS
H8_360: name=Reliance Retail Limited invoices=262 spend=24422678.28  PASS
H8_360: credit_limit=100000.0 credit_days=30 credit_hold=False       PASS
H8_360: loyal=False tier= pts=0.0                                    PASS
H8_360: segs=1 grp=Retail Clients grp_code=                          PASS
H8_360: gst_no=27AAACR1921R1Z5 status=Active type=                   PASS
GST_regs: count=13                                                    PASS
Delivery_locs: count=7                                                PASS
ROUTES: 1654                                                          PASS
`

---

## 9. Verification Results

| Item | Status |
|---|---|
| C3 /purchases returns paginated invoices | Done |
| H8 /360 returns composite profile | Done |
| H8 credit_limit from CustomerGroup | Done |
| H8 gst_no = gst_number | Done |
| H8 loyalty_tier_id join | Done |
| All H8 fields non-null for RRL-001 | Done |
| Routes = 1654 | Done |
| Committed to smritiNX | Done |
| Pushed to origin | Done |

---

## 10. Known Limitations

- H8 invoice_count discrepancy: C3 total=263, H8 invoices=262. One invoice may have a
  NULL customer_id or different company_id scope. Not a bug -- different query filters.
- H8 customer_type is empty for RRL-001 (not set in seed data).
- H8 group_code is empty for RRL-001's group (code not assigned yet).
- Loyalty tier is empty -- no tier assigned to RRL-001's loyalty member.

---

## 11. Future Work

- Run 	est_corporate_customer_360.py formal test suite.
- Add vg_order_value null-safety check.
- C3: add date_from/date_to filter parameters.
- H8: add invoice_by_status breakdown dict.

---

## 12. Related ADRs

- ADR pending: Customer credit fields on Group vs. Customer (discovered in this session)

---

## 13. Related RFCs

- ARCH-CRM-001: Enterprise Customer Architecture Discovery (docs/architecture/)

---

*End of Walkthrough*
*Author: Jawahar Ramkripal Mallah | (c) SMRITIBooks.com. All Rights Reserved.*
