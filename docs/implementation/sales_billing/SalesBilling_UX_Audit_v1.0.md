<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Version      : 1.0.0
  Created      : 2026-10-11
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
-->

# Implementation Plan: Sales / Billing / Audit UX Audit v1.0

**Status:** Completed | **Commit:** 12fa565b | **Date:** 2026-10-11

---

## 1. Objective
Remediate all UX deficiencies across Sales Studio, Billing Workspace, ProPOS Terminal, and Audit module — delivering 25 prioritised recommendations across 3 sprints.

## 2. Business Motivation
- window.confirm / window.prompt dialogs break brand immersion.
- Billing Workspace toolbar overcrowded (9+ buttons) on narrow screens.
- Raw spinner on ledger loads increases perceived latency.
- Customer directory lacked sorting, inline tag management, meaningful empty states.
- Audit had no drill-down, no tamper-proof indicator, simulation buttons in prod.
- No keyboard navigation for high-volume power users.

## 3. Scope

| Module | Files |
|--------|-------|
| Sales Studio | src/components/SalesStudioTab.tsx |
| Billing Workspace | src/components/billing/BillingWorkspace.tsx |
| POS Terminal | src/components/billing/propos/ProPosBillingTerm.tsx |
| Supervisor Auth | src/components/billing/propos/ProPosSupervisorAuthModal.tsx |
| Audit Feed | src/components/AuditActivityFeed.tsx |
| Audit Logs | src/components/AuditLogsTab.tsx |
| Ledger Config | src/components/global/ledger/configs/auditLogs.config.tsx |
| Ledger Screen | src/components/global/ledger/LedgerScreen.tsx |
| New Primitives | SmritiConfirmDialog.tsx, SmritiEmptyState.tsx, SmritiTableSkeleton.tsx |

## 4. Current State (pre-implementation)
- window.confirm / window.prompt in 3 SalesStudioTab call sites.
- Simulation Centre buttons unconditionally rendered in production.
- 9 BillingWorkspace toolbar buttons on all screen sizes.
- Generic RefreshCw spinner on all ledger sub-view loads.
- Customer table: no sort, no tag editing, bare empty states.
- LedgerScreen: hardcoded pageSize=50, no first/last navigation.
- No keyboard shortcuts or help overlay.
- Audit: 2 filter dimensions, no drill-down, no tamper badge.

## 5. Gap Analysis

| Gap | Impact | Priority |
|-----|--------|----------|
| window.confirm breaks modal flow | High | P1 |
| Simulation in prod | High | P1 |
| No audit drill-down | Medium | P1 |
| Toolbar overflow | Medium | P2 |
| Generic spinner | Medium | P2 |
| No sorting/tags | Medium | P2 |
| No keyboard nav | Low | P3 |
| Fixed page size | Low | P3 |

## 6. Architecture Impact
- 3 new reusable primitives in src/components/common/
- LedgerScreen pageSize promoted to useState + localStorage
- BillingWorkspace gains showOverflowMenu state
- ProPosBillingTerm showTotalsPanel initialised from window.innerWidth
- SalesStudioTab gains 6 new state vars

## 7. Proposed Design
All changes follow existing SMRITI dark-mode token system (theme-surface-*, theme-muted, theme-divider, theme-primary). No new CSS custom properties introduced.

## 8. Files Created

| File | Purpose |
|------|---------|
| src/components/common/SmritiConfirmDialog.tsx | Design-system confirm + reason dialogs |
| src/components/common/SmritiEmptyState.tsx | Standardised empty state primitive |
| src/components/common/SmritiTableSkeleton.tsx | Animated shimmer table skeleton |
| docs/walkthrough/sales_billing/SalesBilling_UX_Audit_Implementation_v1.0.md | WGP walkthrough |
| docs/implementation/sales_billing/SalesBilling_UX_Audit_v1.0.md | This plan |

## 9. Files Modified

| File | Sprint | Key Changes |
|------|--------|-------------|
| SalesStudioTab.tsx | 1+2+3 | REC-01,05,08,12,11,13,14,18,15,19 |
| BillingWorkspace.tsx | 1+2 | REC-20,23,24,25,07 |
| ProPosBillingTerm.tsx | 1+3 | REC-12 toast, REC-16 responsive |
| ProPosSupervisorAuthModal.tsx | 1 | REC-04 audit event |
| AuditActivityFeed.tsx | 1 | REC-03 DEV guard |
| AuditLogsTab.tsx | 1 | REC-02 4-dim filters |
| auditLogs.config.tsx | 1 | REC-06,10 drill-down + tamper badge |
| LedgerScreen.tsx | 2 | REC-09 pageSize state + nav |

## 10. Dependencies
- lucide-react (existing): ChevronsUpDown, ChevronUp, ChevronDown, MoreHorizontal added.
- motion/react (existing): bulk toolbar entry animation.
- No new npm packages.

## 11. Risks

| Risk | Mitigation |
|------|------------|
| sortedCustomers useMemo recomputes | Scoped dep array — acceptable cost |
| Tag edits are local-optimistic only | Future sprint: PATCH /api/v1/customers/{id} |
| POS panel resize mid-transaction | Auto-collapse only; never auto-opens |

## 12. Rollback Strategy
```
git revert 12fa565b --no-edit
```
New common components are leaf imports; deletion has no cascade.

## 13. Verification Plan
Evidence gathered: git diff --cached --stat = 12 files, 1526 insertions, 172 deletions.
Browser smoke test (F:\Smriti9 after git pull):
- Customer form onBlur validation: red/green border
- Tags: add via Enter, remove via hover-x
- POS at 1280px: panel collapses; F9 re-opens
- Sales Studio ?: overlay + Shift+Q tab jump
- Audit: 4 filters + drill-down + copy entityId
- More menu: all 5 secondary billing tools accessible
- Ledger: page size 25 persists after reload

## 14. Test Plan

| Scenario | Expected | Status |
|----------|----------|--------|
| Delete quotation via SmritiConfirmDialog | Modal, Cancel, Confirm | Unverified |
| Mobile field blur invalid | Red border + error | Unverified |
| GSTIN 15 chars | Green border | Unverified |
| Select 3 rows -> Escape | Bulk bar clears | Unverified |
| Resize to 1100px | Totals panel collapses | Unverified |
| Sort Credit Limit desc | Highest first | Unverified |

## 15. Documentation Impact

| Document | Status |
|----------|--------|
| CHANGELOG.md | Done |
| Walkthrough v1.0 | Done |
| Implementation Plan v1.0 | Done (this file) |
| docs/implementation/README.md | Pending manual append |
| docs/walkthrough/README.md | Pending manual append |

## 16. Deployment Plan
1. Commit 12fa565b on dev branch.
2. git pull into F:\Smriti9 test environment.
3. npm run dev + smoke-test checklist.
4. Pass -> merge to main.

## 17. Status
Completed — 2026-10-11T14:58:46+05:30
Commit: 12fa565b | 12 files | 1526 insertions / 172 deletions

## 18. Related ADRs
- ADR-001: FastAPI + Postgres sole backend
- ADR-002: React 18 + Vite + SMRITI design tokens
- ADR-003: Audit immutability / tamper-proof ledger

## 19. Related Walkthroughs
- docs/walkthrough/sales_billing/SalesBilling_UX_Audit_Implementation_v1.0.md
