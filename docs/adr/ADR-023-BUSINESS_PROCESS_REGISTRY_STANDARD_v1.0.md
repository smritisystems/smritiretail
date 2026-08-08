# ADR-023: Business Process Registry (BPR) & Workflow Certification Engine Standard v1.0

**Status:** CERTIFIED & ACTIVE — v1.0 (2026-08-06)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Level 2 Architecture Decision Record (Child of ADR-022)  
**Extends:** ADR-022 (SMRITI Platform Control Center Enterprise Standard v1.0)  

---

## Context & Problem Statement

While **ADR-022** and the **Business Capability Registry (BCR v2.0)** certify whether individual business capabilities exist across 6 full-stack layers (`[DB]`, `[API]`, `[UI]`, `[MENU]`, `[WF]`, `[TEST]`), enterprise SaaS platforms must also verify whether multi-step retail operational workflows function end-to-end.

For example, a retail business cannot operate merely because `Purchase Order` and `General Ledger` exist individually; it requires a certified **Procure-to-Pay (P2P)** workflow where data flows seamlessly from Purchase Order ➔ GRN ➔ Supplier Ledger ➔ Payment Vouchers ➔ Cashier Drawer Outflow.

---

## Architecture Decision

It is decided that **Business Process Registry (BPR)** is established as the official workflow certification engine for SMRITI Retail OS, extending **ADR-022 Rule 11 (Check #11)**.

### BPR Core Architecture Principles

1. **Process-Level Certification**:
   BPR audits the platform against 7 canonical retail business process workflows:
   - **`BPR-P2P`**: Procure-to-Pay Workflow (4 Steps)
   - **`BPR-O2C`**: Order-to-Cash Workflow (4 Steps)
   - **`BPR-STR`**: Stock Transfer & Logistics Workflow (3 Steps)
   - **`BPR-SRT`**: Sales Return & Credit Note Workflow (3 Steps)
   - **`BPR-PRT`**: Purchase Return & Vendor Debit Note Workflow (2 Steps)
   - **`BPR-STK`**: Physical Stock Take Audit Workflow (2 Steps)
   - **`BPR-CLS`**: Day Closing & Shift Reconciliation Workflow (2 Steps)

2. **3-Tier Process Certification Status**:
   - `CERTIFIED` (100% — All steps in the workflow satisfy registration & workspace assignment criteria)
   - `IN_PROGRESS` (1–99% — Some workflow steps registered, pending missing modules)
   - `NOT_STARTED` (0% — Workflow steps unmapped)

3. **SPK Integration Facade**:
   BPR is exposed via Level 1 Platform Kernel facade API:
   `SPK.navigation.auditBusinessProcesses(): BusinessProcessCertificationReport`

---

## Process Certification Audit Output

```text
===================================================================================================
BUSINESS PROCESS REGISTRY (BPR) & WORKFLOW CERTIFICATION REPORT
===================================================================================================
Total Enterprise Retail Workflows : 7 Business Processes
Certified End-to-End Workflows    : 7 Workflows (100% Step Completeness Passed)
In Progress Workflows             : 0 Workflows
Not Started Workflows             : 0 Workflows
Overall Process Coverage Score    : 100.0%
===================================================================================================
```

---

## Relationship to ADR-022

```text
ADR-022: SPCC Enterprise Governance Constitution (FROZEN)
 ├── Rule 11 (Check #10) ──► ADR-022 BCR (Business Capability Registry)
 └── Rule 11 (Check #11) ──► ADR-023 BPR (Business Process Registry)
```

---

## Architecture Status

**Status:** ACTIVE & CERTIFIED v1.0.  
This document is a child ADR extending `ADR-022` without modifying its frozen constitutional baseline.
