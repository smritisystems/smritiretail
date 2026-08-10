<!--
  SMRITI Retail OS — Masterbook
  Document  : 07_CONSOLIDATION/CONSOLIDATED_REPORTING.md
  Status    : FROZEN
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Consolidated Reporting

---

## Purpose

For retail groups with multiple companies, consolidated reporting aggregates financial and operational data across all companies within a tenant.

---

## Consolidation Architecture

```
Company A (Sales, P&L, Stock)
Company B (Sales, P&L, Stock)
Company C (Sales, P&L, Stock)
            │
            ▼
    Consolidation Engine
    (tenant_id scoped, cross company_id aggregation)
            │
            ▼
    Consolidated P&L Report
    Consolidated Balance Sheet
    Consolidated Stock Statement
    Consolidated Sales Dashboard
```

---

## Report Execution (URR-002)

All consolidated reports execute through `SPK.reports.executeReport()`:

```typescript
SPK.reports.executeReport({
  reportId: "CONSOLIDATED_SALES_SUMMARY",
  parameters: {
    tenantId: tenant.id,
    companyIds: ["comp-a", "comp-b", "comp-c"],
    dateFrom: "2026-04-01",
    dateTo: "2026-08-10",
  }
});
```

---

## Intercompany Elimination

For holding companies, intercompany transactions (sales from Company A to Company B) must be eliminated in consolidated financials. This is handled via:
1. Intercompany transaction tagging (`is_intercompany: bool`)
2. Elimination entries in the consolidation engine

---

## Access Control for Consolidated Reports

Consolidated reports require:
- `REPORTS.VIEW_CONSOLIDATED` permission
- User assigned to multiple companies (via `UserCompanyAssignment`)
- OWNER or SYSADMIN role (typically)

A branch-level CASHIER cannot access consolidated group reports.

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
