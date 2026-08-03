<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 2.1.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Kernel & Studio Specification
-->

# SMRITI Asset Kernel (SAK v2.1) & Enterprise Asset Management Studio Specification (EAM v2.1)

**Status:** FROZEN — Enterprise Asset Management Architecture Specification v2.1 (2026-08-04)
**Scope:** Dual State vs. Status Architecture, 13 Platform Service Contracts, & Configurable State Machines

---

## 1. SAK v2.1 Dual-Dimension Lifecycle Architecture (State vs. Operational Status)

`SAK Asset Kernel v2.1` separates **Immutable Lifecycle State** from concurrent **Operational Status**:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SAK V2.1 DUAL-DIMENSION LIFECYCLE ARCHITECTURE                         │
 ├────────────────────────────────────────────────────────────────────────┤
 │ IMMUTABLE LIFECYCLE STATE (Primary State Machine):                     │
 │ Draft ──► Planned ──► Procured ──► Received ──► Capitalized           │
 │                                                       │                │
 │ Archived ◄── Disposed ◄── Retired ◄───────────────────┴──► Active       │
 ├────────────────────────────────────────────────────────────────────────┤
 │ CONCURRENT OPERATIONAL STATUS (Sub-State Matrix):                      │
 │ [ ] Available        [ ] Assigned / In-Use    [ ] Reserved             │
 │ [ ] Under Maint      [ ] In-Transit           [ ] Inspection Hold      │
 │ [ ] Calibration Due  [ ] Warranty Claim       [ ] Staging / Store      │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Example Valid State Combinations:                                      │
 │ • State: Active      | Status: Assigned + Scheduled for Maintenance   │
 │ • State: Active      | Status: Available + In-Store Staging           │
 │ • State: Capitalized | Status: Inspection Hold + In-Transit           │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. SAK v2.1 Explicit Platform Service Integration Contracts (13 Contracts)

SAK v2.1 formally defines explicit integration contracts with all 13 shared kernels and platform services across Platform OS v4.2:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SAK V2.1 EXPLICIT PLATFORM SERVICE INTEGRATION MATRIX                   │
 ├──────────────────┬─────────────────────────────────────────────────────┤
 │ Target Component │ Explicit SAK Service Integration Contract           │
 ├──────────────────┼─────────────────────────────────────────────────────┤
 │ SEB (Event Bus)  │ Publishes 10 asset lifecycle & maintenance events   │
 │ SES (Search)     │ Indexes asset UUID, code, serials, QR/RFID, barcode │
 │ SNP (Notify)     │ Dispatches WhatsApp/SMS maintenance & warranty alerts│
 │ SWA (Automation) │ Triggers approval workflows for disposal & transfers│
 │ SAS (Audit)      │ Logs immutable audit trail of field modifications   │
 │ STS (Scheduler)  │ Runs recurring monthly depreciation & preventive jobs│
 │ SAI (AI Engine)  │ Executes predictive maintenance & useful-life ML    │
 │ SDK (Document)   │ Enforces document state machine for PO, GRN, & Move │
 │ SLK (Ledger)     │ Posts capitalization, depreciation, & disposal GLs  │
 │ STK (Tax)        │ Calculates GST ITC & tax write-off adjustments      │
 │ SBPK (Printing)  │ Generates 1D/2D Barcode, QR code, & RFID label tags │
 │ SIK (Integration)│ Syncs external vendor AMC contracts & IoT telemetry │
 │ SNK (Node Sync)  │ Reconciles multi-site node transfers & vector clocks│
 └──────────────────┴─────────────────────────────────────────────────────┘
```

---

## 3. SAK v2.1 Configurable State Machine Engine

Industry Packs (e.g. Healthcare Medical Equipment vs. Retail POS Hardware) can configure custom asset state transition rules:

```typescript
// SAK Configurable State Machine Interface
export interface AssetStateMachineConfig {
  industryPackId: string;
  allowedStateTransitions: Record<AssetLifecycleState, AssetLifecycleState[]>;
  validOperationalSubStates: Record<AssetLifecycleState, OperationalSubStatus[]>;
  requiredApprovalsForDisposal: string[];
}
```
