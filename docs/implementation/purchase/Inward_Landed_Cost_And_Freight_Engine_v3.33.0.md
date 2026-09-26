<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-09-20
  Modified     : 2026-09-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Inward Landed Cost, Multi-Component Freight & Commercial Engine

**Plan ID:** IP-PUR-2026-09-002  
**Version:** 3.33.0  
**Status:** Completed  
**Target Area:** `purchase` / `inventory`  
**Related ADRs:** ADR-PURCH-02 (Multi-Component Inward Cost & Hamilton-Hare Allocation Engine), ADR-PURCH-03 (Ind-AS 2 / AS-2 Statutory Capitalizability Enforcement), ADR-PURCH-04 (Non-Intrusive Optional Flow)  
**Related Walkthroughs:** [Procurement_Inward_Landed_Cost_And_Freight_Engine_v3.33.0.md](../../walkthrough/procurement/Procurement_Inward_Landed_Cost_And_Freight_Engine_v3.33.0.md)  

---

## 1. Objective
Design, implement, and verify a production-grade **Inward Cost, Multi-Component Freight & Landed Cost Engine** that determines the true inventory acquisition cost of every accepted SKU upon Goods Receipt Note (GRN) inwarding. The engine supports unlimited, independently traceable cost components per GRN, enforces Hamilton-Hare largest-remainder penny cent-balancing, adheres to statutory Ind-AS 2 / AS-2 tax capitalizability boundaries, and provides an operator-first UI/UX with dual-column layout, Purchase Price Variance (PPV) dispute pathways, post-GRN margin previews, and forensic cost drill-downs.

---

## 2. Business Motivation
1. **True Inventory Valuation**: Retail acquisition cost rarely equals supplier invoice rate. Freight, local cartage, unloading/hamali, insurance, and packing can add 2% to 15% to landed costs. Omitting them distorts gross margin calculations and inventory balance sheets.
2. **Statutory Compliance (Ind-AS 2 / AS-2)**: Indian accounting standards mandate that costs incurred to bring inventories to their present location and condition must be capitalized into inventory, whereas recoverable taxes (Input Tax Credit / GSTR-2B GST) must be excluded.
3. **Dispute Resolution & PPV Tracking**: When suppliers bill above contracted PO prices, warehouse clerks need immediate visibility to either accept the rate variance or initiate automated debit note claims against the vendor.
4. **Transparency & Zero Penny Loss**: Inwarding multi-item shipments across varying price tiers requires exact cent-balancing without losing single-paisa rounding fractions.

---

## 3. Scope
- **Database Architecture**: 4 relational tables in PostgreSQL (`inward_cost_component_types`, `inward_cost_components`, `inward_cost_allocations`, `inward_cost_adjustments`).
- **Mathematical Allocation**: Hamilton-Hare largest-remainder algorithm across Value, Quantity, and Weight allocation bases with 0.0000 allocation loss.
- **Statutory Rules**: Auto-separation of ITC-eligible GST vs non-creditable capitalized duties/charges.
- **Backend Services**: Pure in-memory allocation preview, atomic persistence, WMS batch unit cost updates, and forensic drill-down.
- **REST APIs**: 4 dedicated endpoints under `/api/v1/purchase/`.
- **Frontend Workspaces**: Dual-column GRN Studio layout with collapsible Transport Dock, cost modals, PPV dispute handling, and margin previews.
- **Strictly Optional**: Complete fallback to contract purchase rate with 0 extra clicks if transport expenses are unused.

---

## 4. Current State
- Prior to this implementation, SMRITI's `PurchaseReceipt` captured line items with only `unit_price`, lacking structured freight, cartage, hamali, or landed cost allocation.
- Inward transport expenses had to be tracked separately or manually blended into item unit prices, corrupting supplier invoice reconciliation and statutory tax ledgers.
- Price variances between PO and vendor invoices lacked an in-line claim generation workflow.

---

## 5. Gap Analysis
| Dimension | Legacy SMRITI / Shoper 9 | Target Inward Cost Engine |
| :--- | :--- | :--- |
| **Cost Components** | Single flat freight field or none | Unlimited, independently typed cost components |
| **Component Types** | Hardcoded text field | 19 system-seeded types with customizable registry |
| **Allocation Methods** | Manual or rough pro-rata | Hamilton-Hare largest-remainder cent-balancing (0 variance) |
| **Tax Capitalization** | Lumps all taxes into inventory | Strict Ind-AS 2 compliance: ITC excluded, duties capitalized |
| **Forensic Audit** | Not available | Line-level "Why is my landed cost ₹X?" drill-down API & UI |
| **PPV Workflow** | Manual notes | In-line dual pathway: `[Accept]` or `[Create Claim]` Debit Note |
| **Late Adjustments** | Reopening closed GRNs | Non-destructive `inward_cost_adjustments` ledger |

---

## 6. Architecture Impact
- **Database Schema**: Added migration `v1478` introducing 4 dedicated tables. Zero breaking changes to `purchase_receipts` or `purchase_receipt_items`.
- **Valuation Updates**: Updates `product_cost_valuations.last_landed_cost` and `product_batch_stocks.unit_cost` atomically upon GRN posting.
- **Architecture Governance**: Registered 4 new entities, ADR `ADR-PURCH-02`, and capability `purchase.landed_cost_engine` in PostgreSQL governance tables.

---

## 7. Proposed Design
```text
┌────────────────────────────────────────────────────────────────┐
│                   GRN Studio (GrnReceiptTab)                   │
├───────────────────────────────┬────────────────────────────────┤
│       Main GRN Workspace      │    Right Transport Dock        │
│ • Receiving Summary (4 Cards) │ • Carrier / Transporter Name   │
│ • Item Inspection Grid        │ • LR / Docket Number & Date    │
│ • 3-Tier Rate Hierarchy       │ • Unlimited Cost Components:   │
│   - PO Rate                   │   - Freight, Hamali, Packing.. │
│   - Inv. Rate                 │ • GST & ITC Eligibility Toggle │
│   - Net Rate                  │ • Real-Time Allocation Preview │
│   - Landed Cost               │                                │
│ • PPV Discrepancy Card:       │                                │
│   - [Accept] / [Create Claim] │                                │
└───────────────────────────────┴────────────────────────────────┘
                                │
                                ▼
               LandedCostAllocationEngine (FastAPI)
         • Hamilton-Hare Largest-Remainder Cent Balancer
         • Ind-AS 2 Statutory Capitalizability Filter
                                │
                                ▼
                 PostgreSQL Multi-Tenant Database
         • inward_cost_components & inward_cost_allocations
         • WMS Batch Stock unit_cost & ProductCostValuation
```

---

## 8. Files Created
1. `backend/alembic/versions/v1478_inward_cost_components_and_allocation_ledger.py`
2. `backend/app/models/inward_cost.py`
3. `backend/app/schemas/inward_cost.py`
4. `backend/app/services/landed_cost.py`
5. `scripts/register_inward_cost_architecture.py`
6. `scripts/verify_inward_landed_cost_engine.py`
7. `src/components/purchase/types/inwardCost.ts`
8. `src/components/purchase/InwardCostDock.tsx`
9. `src/components/purchase/AddCostComponentModal.tsx`
10. `src/components/purchase/CostAllocationPreviewModal.tsx`
11. `src/components/purchase/WhyThisCostModal.tsx`
12. `src/components/purchase/GrnPostedSuccessModal.tsx`
13. `docs/walkthrough/procurement/Procurement_Inward_Landed_Cost_And_Freight_Engine_v3.33.0.md`
14. `docs/implementation/purchase/Inward_Landed_Cost_And_Freight_Engine_v3.33.0.md`

---

## 9. Files Modified
1. `backend/app/models/__init__.py`
2. `backend/app/schemas/purchase.py`
3. `backend/app/services/purchase.py`
4. `backend/app/api/v1/purchase.py`
5. `src/components/CreateDebitNoteDlg.tsx`
6. `src/components/purchase/GrnReceiptTab.tsx`
7. `docs/walkthrough/README.md`
8. `docs/implementation/README.md`
9. `CHANGELOG.md`
10. `DEVELOPMENT_STATUS.md`

---

## 10. Dependencies
- **PostgreSQL 15+**: JSONB support, transactional foreign keys, identity sequences.
- **FastAPI & Pydantic v2**: High-throughput validation and contract-first schema serialisation.
- **React 18 & TypeScript**: Dual-column layout, modal state machines, Lucide icons.

---

## 11. Risks
| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Penny rounding divergence across large shipments | High | Hamilton-Hare largest-remainder algorithm enforces strict penny balancing ($0.0000$ drift). |
| Tax misclassification (capitalizing creditable GST) | Critical | Automated Ind-AS 2 filtering: ITC-eligible taxes are flagged and excluded from capitalized cost. |
| Operator friction / slowed inwarding | Medium | Entire engine is strictly optional; falls back to standard purchase rate with zero extra clicks. |

---

## 12. Rollback Strategy
1. **Feature Toggle / Backward Compatibility**: If no transport components are passed in the payload, the backend skips allocation ledger writes and defaults `landed_cost = unit_price`.
2. **Database Migration Reversibility**: Migration `v1478` includes a clean `downgrade()` function dropping all 4 tables in reverse dependency order without affecting core purchase orders or inventory tables.

---

## 13. Verification Plan
- Verify API token generation and authorization.
- Verify GET `/purchase/inward-cost-types` returns all 19 seeded categories.
- Verify POST `/purchase/landed-cost/preview` returns penny-balanced allocations for multi-item batches.
- Verify POST `/purchase/receipts/` creates GRN and persists cost allocations and component records.
- Verify GET `/purchase/receipts/{id}/cost-components` and forensic drill-down return accurate persisted data.

---

## 14. Test Plan
- Run automated verification script `scripts/verify_inward_landed_cost_engine.py` against live backend.
- Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `npm run architecture:check` to ensure zero architectural debt and 100% preflight certificate coverage.
- Run `npm run validate-launchpad` and `npm run validate-registry`.

---

## 15. Documentation Impact
- Updated Walkthrough Master Index (`docs/walkthrough/README.md`).
- Created Walkthrough (`docs/walkthrough/procurement/Procurement_Inward_Landed_Cost_And_Freight_Engine_v3.33.0.md`).
- Updated Implementation Master Index (`docs/implementation/README.md`).
- Updated `CHANGELOG.md` and `DEVELOPMENT_STATUS.md`.

---

## 16. Deployment Plan
1. Apply Alembic migration `v1478` across production and tenant databases.
2. Deploy backend service containing updated `purchase.py` and new `landed_cost.py`.
3. Deploy frontend bundle containing updated `GrnReceiptTab.tsx` and inward cost components.
4. Execute `scripts/verify_inward_landed_cost_engine.py` in staging/production to certify live functionality.

---

## 17. Status
**Completed** — Fully implemented, migrated across all databases, and verified green with 0 errors.

---

## 18. Related ADRs
- `ADR-PURCH-02`: Multi-Component Inward Cost & Hamilton-Hare Allocation Engine.
- `ADR-PURCH-03`: Ind-AS 2 / AS-2 Statutory Capitalizability Enforcement.
- `ADR-PURCH-04`: Non-Intrusive Optional Inward Cost Flow.

---

## 19. Related Walkthroughs
- [Procurement_Inward_Landed_Cost_And_Freight_Engine_v3.33.0.md](../../walkthrough/procurement/Procurement_Inward_Landed_Cost_And_Freight_Engine_v3.33.0.md)
