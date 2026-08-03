<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Quality & Certification Standard
-->

# SMRITI Purchase Studio v1.0 End-to-End Business Certification Suite

**Status:** FROZEN — Procurement Certification Suite v1.0 (2026-08-03)
**Governance:** Mandatory End-to-End Business Scenario Execution Protocols

---

## 1. Procurement Certification Matrix (PS-CERT-001 — PS-CERT-006)

| Scenario ID | Procurement Business Scenario | Primary Workspaces | Target Platform Services Verified | Pass / Fail Criteria |
|---|---|---|---|---|
| **PS-CERT-001** | **Standard Purchase Lifecycle** (PO $\rightarrow$ Approve $\rightarrow$ Receive $\rightarrow$ Bill $\rightarrow$ Pay $\rightarrow$ Close) | Orders, GRN, Bills, Supplier Object Page | UFR, UWR, Inventory Kernel, UPRT, SEEF Tokens | All document states transition cleanly; inventory ledger updated; 0 console errors |
| **PS-CERT-002** | **Partial Receipt Fulfillment** (PO 100 Qty $\rightarrow$ GRN #1 60 Qty $\rightarrow$ GRN #2 40 Qty) | Orders, GRN Receiving | Inventory Kernel, Stock Movement Journal | PO state remains `Partial Receipt` until total received = 100; stock balances accurate |
| **PS-CERT-003** | **Automated 3-Way Match & Variance Handling** (PO Rate ₹100 $\rightarrow$ GRN 100 Qty $\rightarrow$ Invoice Rate ₹102) | Supplier Bills, PO Studio | Tolerance Engine, GST ITC Calculation | Price variance flagged when above tolerance; GST CGST/SGST/IGST breakdown matches |
| **PS-CERT-004** | **Quality Hold & Supplier Return** (Receive $\rightarrow$ Quality Inspection Hold $\rightarrow$ Debit Note Return) | GRN Receiving, Purchase Returns | Quality Hold Journal, Inventory Kernel | Stock held in quarantine bin; stock ledger debited upon supplier return dispatch |
| **PS-CERT-005** | **Offline Handheld Stock Receiving Replay** (Offline Barcode Scan $\rightarrow$ Sync Replay) | GRN Receiving, Offline Queue | `OfflineExperienceManager`, UPR Replay | Operations queue offline without crash; replays cleanly upon network reconnect |
| **PS-CERT-006** | **Dedicated PO Approval Queue** | PO Approvals Queue, Purchase Orders | USR RBAC, `SPK.workflow.executeTransition()` | Role-based approval authority enforced; approver queue updates in real-time |

---

## 2. Execution Order & Verification Protocol

```text
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ WAVE EXECUTION & BUSINESS CERTIFICATION PROTOCOL                         │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ Wave 1: Purchase Order Lifecycle (Draft ──► Approve ──► Submit)           │
 │ Wave 2: Goods Receipt Note (Scan receive ──► Batch allocation)           │
 │ Wave 3: Supplier Bills & 3-Way Match (Variance tolerance ──► Post)        │
 │ Wave 4: Supplier Payments & Ledger Postings                              │
 │ Wave 5: Supplier 360 Object Page (Header, POs, GRNs, Bills, Ledger)      │
 │ Wave 6: Universal Report Registry (URR) Procurement Analytics           │
 └──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Dedicated PO Approval Queue Registration

Per architecture recommendation, `purchase.approvals` is registered as a dedicated top-level approval workspace (`PO Approvals Queue`) within `purchase.manifest.ts` to grant multi-approver organizations a streamlined operational view.
