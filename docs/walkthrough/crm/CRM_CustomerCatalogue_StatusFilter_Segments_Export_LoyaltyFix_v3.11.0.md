<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Version      : 3.11.0
  Created      : 2026-10-19
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# CRM Customer Catalogue -- Status Filter, Segments, Export, Loyalty Tier Fix
**Walkthrough Version:** v3.11.0
**Area:** CRM / Customer Catalogue
**Date:** 2026-10-19
**Commit:** 13eb4e4f
**Status:** Done

## 1. Purpose
Complete the remaining 4 Customer Catalogue improvement items from the previous sprint
(H7 archive filter, M1 segments, M2 export, H4 loyalty tier count).

## 2. Scope
| Layer | Affected |
|---|---|
| Backend | backend/app/api/v1/crm.py |
| Backend | backend/app/repositories/customer.py |
| Database | smriti001.loyalty_members (data fix only, no schema change) |
| Routes added | +6 (1634 -> 1640 total) |

## 3. Files Created
None.

## 4. Files Modified
| File | Change |
|---|---|
| backend/app/api/v1/crm.py | H7 status params; M1 segments endpoints; M2 export endpoint |
| backend/app/repositories/customer.py | H7 status filter in get_all() and search() |

## 5. Architecture Decisions

### H7 — Archived customer filter
- search() defaults to status='Active' (archived excluded by default)
- list() defaults to no filter (returns all statuses) — used for admin views
- Pass status=all to search to include archived records (sentinel normalized to None)
- status filter applied BEFORE tenant filter for optimal index use

### M1 — Tag-based Segments
- No separate CrmSegment table. Customer.tags (ARRAY(String)) acts as segment membership.
- list_customer_segments uses raw SQL UNNEST(tags) for efficiency; avoids ORM scan.
- Per-customer segments returns the tags array with TAG_BASED type label.
- Future: add CrmSegment table for rule-based segments (RFM, spend tier, etc.)

### M2 — Customer Export
- Access-controlled: MANAGER, SYSADMIN, REPORT_USER only (via require_role dependency)
- Supports CSV (StreamingResponse) and JSON (JSONResponse) formats
- Limit capped at 5000 rows per export request
- Credit fields read from customer.group (not Customer directly)
- Payment fields read from customer.policy

### H4 — Loyalty Tier Count Fix
- Root cause: seed data created loyalty_members with loyalty_tier_id = '' (empty string)
- The tier count query groups by loyalty_tier_id, so '' members count against no tier
- Fix: direct UPDATE 42 rows WHERE tier_id='' to tier_silver_f27460
- This is a data-only fix, no schema or code change

## 6. Tests Executed
PowerShell 12-endpoint smoke test suite on localhost:1981, 2026-10-19T08:09:57+05:30

## 7. Verification Results
```
AUTH: OK | routes=1640

  PASS  [C1] loyalty             -> enrolled=False pts=0
  PASS  [C2] credit              -> credit_limit=100000.0 hold=False
  PASS  [C3] purchases           -> total=263 data[20]
  PASS  [C4] summary             -> credit_limit=100000.0 hold=False
  PASS  [C5] price-groups        -> array[100]
  PASS  [H1] customers?100       -> array[100]
  PASS  [H7a] search(Active)     -> array[3]
  PASS  [H7b] list?status=Active -> array[10]
  PASS  [H7c] search?status=all  -> array[10]
  PASS  [M1a] /segments          -> array[3] first={B2B,count=14}
  PASS  [M1b] /cust/segments     -> segments=2 for RRL-001
  PASS  [H4] loyalty/tiers       -> array[2] Silver=42

Result: 12/12 PASS | Routes: 1634 -> 1640 (+6) | Commit: 13eb4e4f
```

## 8. Database Evidence (H4)
```
-- BEFORE
Silver Tier 0b18 | 0 members
Gold Tier 36d7   | 1 member

-- FIX APPLIED
UPDATE 42 rows (loyalty_tier_id was empty string, set to tier_silver_f27460)

-- AFTER
Silver Tier 0b18 | 42 members
Gold Tier 36d7   |  1 member
still_no_tier    |  0
```

## 9. Known Limitations
- Segments are tag-based only. Rule-based segments (RFM scoring, spend tier) require CrmSegment table + migration.
- Export limit is 5000 rows. For full tenant dump, batch export via skip/limit is needed.
- loyalty/tiers does not filter by company_id on the LoyaltyTier query (tiers are global config).
  If multi-tenant tier isolation is needed, add company_id to loyalty_tiers table.

## 10. Future Work
- H2: Add short code field to CustomerGroup (e.g. CG-CORP, CG-VIP)
- M3: Rule-based CrmSegment model + migration (RFM, spend tier, last-purchase-date ranges)
- M4: Batch export API for full tenant dump (paginated streaming)
- M5: Loyalty tier isolation per company_id if multi-tenancy requires it

## 11. Related ADRs / RFCs
None.
