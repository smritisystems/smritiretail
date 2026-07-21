# SMRITI Retail Terminal Framework v1.0 — Master Architecture Standard (FROZEN)

**Document ID:** STF-STD-001  
**Document Status:** FROZEN — v1.0.0  
**Effective Date:** 2026-07-20  
**Classification:** Internal Architectural Standard  

---

## 1. Golden Design Principles

> **A terminal is justified only when it supports a high-frequency, repetitive operational workflow where speed, keyboard efficiency, and focus materially improve user productivity. Administrative and low-frequency configuration tasks remain in Studios.**

> **A Terminal is a Workspace, not a Form.** It must occupy 100% of the available application viewport (`100vw` / `100vh`), remove max-width containers and centered dialog card layouts, minimize wasted space, and keep the operator's primary task—such as scanning items or entering quantities—in continuous focus. Administrative forms belong in Studios; operational workflows belong in full-width Terminals.

* **Studios**: Rich administrative workspaces for master data, reporting, configuration, and audit management.
* **Terminals**: High-speed, full-width/fullscreen, keyboard-first operational environments.

---

## 2. Architecture Guardrails & Dependency Hierarchy (MANDATORY)

```text
Studios
  │
  ▼
Terminal Launcher
  │
  ▼
Terminal Framework
  │
  ▼
Terminal Plugins
  │
  ▼
SMRITI Adapters (SMRITIGrid, HardwareAdapterRegistry)
  │
  ▼
Third-Party Permissive Open-Source Libraries
```

* **Strict Dependency Rule**: Dependencies flow downward only. Lower layers shall never import higher layers.

### Guardrail Rules:
1. **Backend System-of-Record**: The FastAPI + PostgreSQL backend is the single source of truth for all data, pricing, discounts, and tax calculations. The frontend never duplicates business rules.
2. **SDK Compliance**: Every operational terminal must implement the `TerminalPlugin` interface contract.
3. **Drawer Isolation**: Every drawer must register through `DrawerRegistry` and mount inside `RightDrawerHost`.
4. **Grid Abstraction**: Every item grid must render via `SMRITIGrid` abstraction.
5. **Hardware Abstraction**: All hardware (scanners, printers, cash drawers, scales, pole displays) is accessed exclusively through `HardwareAdapterRegistry`.
6. **Encapsulated Dependencies**: All third-party libraries must be wrapped behind SMRITI abstraction adapters.
7. **Studio Independence**: Studios must never depend on internal implementation details of Terminals.
8. **Refined Statelessness**: Business state belongs to centralized stores or backend services. Terminal-local state is limited to transient UI interaction (selection, focus, drawer visibility, active document session).
9. **Contract Preservation**: Existing REST APIs (`/api/v1/*`), database schemas, and permissions remain strictly unchanged.
10. **Out of Scope Enforcement**: Scope boundary rules (Section 12) are non-negotiable.

---

## 3. Terminal Lifecycle Protocol

Every terminal strictly follows this lifecycle sequence:

```text
  [Launch] ──► [Initialize Context] ──► [Load Config & Permissions] ──► [Load Hardware]
                                                                            │
  [Cleanup / Exit] ◄── [Complete / Settle] ◄── [Working] ◄── [Ready] ◄─────┘
```

---

## 4. Shared TerminalContext Specification

Every terminal receives a standardized, immutable context environment:

```typescript
export interface TerminalContext {
  terminalId: string;
  branch: { id: string; name: string; code: string };
  warehouse: { id: string; name: string };
  counter: { id: string; name: string };
  shift: { id: string; status: "Open" | "Closed"; openedAt: string };
  operator: { id: string; name: string; role: string };
  company: { id: string; gstin: string; legalName: string };
  financialYear: string;
  permissions: Set<string>;
  configuration: Record<string, any>;
  hardware: HardwareStatus;
}
```

---

## 5. Document Session Framework

Every terminal manages documents through a standardized document session state machine:

```text
[Draft] ──► [Dirty] ──► [Validated] ──► [Saved] ──► [Held / Recalled] ──► [Completed] ──► [Printed] ──► [Synced]
```

---

## 6. Granular Permission Engine

Permissions control not just access to a terminal, but granular action execution within it:

```text
Permission Engine
  ├── Terminal Access         (billing.terminal.access)
  ├── Toolbar Actions         (billing.hold, billing.recall, billing.checkout)
  ├── Drawer Visibility       (billing.gst.edit, billing.transport.edit)
  ├── Approval Override       (billing.price_override.approve)
  ├── Printing & Export       (billing.print.reprint, billing.export)
  └── Shift Settlement        (pos.shift.close)
```

---

## 7. Standardized Telemetry Events

All operational activities emit standardized telemetry events via `TerminalEventBus`:

```text
TerminalOpened       ──► Logged on terminal mount
BarcodeScanned       ──► Logged on scanner buffer receipt
DocumentHeld         ──► Logged when bill is parked
DocumentCompleted    ──► Logged on successful checkout
DrawerOpened         ──► Logged on cash drawer RJ11 pulse
DrawerClosed         ──► Logged on cash drawer closure
PrintStarted         ──► Logged on print job creation
PrintCompleted       ──► Logged on printer spool completion
HardwareDisconnected ──► Logged on peripheral drop
```

---

## 8. Form Factor & Device Adaptation

The framework adapts across physical hardware formats:
* **Desktop POS**: Dual-monitor 1080p/2K display layout.
* **Touch POS**: 15" capacitive touch terminal with enlarged targets.
* **Android Handheld Scanner**: High-speed single-column barcode audit list.
* **Tablet / Kiosk**: Customer-facing self-checkout interface.

---

## 9. Terminal Layout & Keyboard Standards

### 9.1 Layout Standard

```text
+--------------------------------------------------------------+
| Header (Terminal ID, Active Counter, Shift, Operator)         |
+--------------------------------------------------------------+
| Toolbar (New, Hold, Recall, Drawers, Finish/Checkout)        |
+--------------------------------------------------------------+
| Barcode Scanner Input / SKU Universal Search                 |
+--------------------------------------------------------------+
|                                                              |
|                     SMRITIGrid (70–80%)                      |
|                                                              |
+--------------------------------------+-----------------------+
| Summary / GST Totals                 | Main Actions          |
+--------------------------------------+-----------------------+
| Shared Status Bar (Scanner, Printer, Drawer, Time)           |
+--------------------------------------------------------------+
```

### 9.2 Global Keyboard Standard

```text
F2      Customer Search / Selection
F3      Item Search
F4      Payment / Checkout
F5      Hold Bill
F6      Recall Held Bill
F7      Quantity Adjustment Focus
F8      Discount / Scheme Toggle
F9      Print Invoice
F10     Save Document
Ctrl+K  Universal Search Modal
Esc     Close Drawer / Cancel / Clear Cart
```

---

## 10. Canonical Reference Implementation & Phased Roadmap

> **Canonical Reference Implementation**: The POS Terminal (PosTerminalTab.tsx) is the canonical reference implementation of the SMRITI Terminal Framework. New terminals should follow its architecture, layout, lifecycle, and interaction patterns.

* **Phase 1**: Core Framework (`TerminalPlugin`, `TerminalManifest`, `RightDrawerHost`, `DrawerRegistry`, `HardwareAdapterRegistry`, `SMRITIGrid`, `TerminalEventBus`, `Ctrl+K` search) & Canonical **POS Terminal**.
* **Phase 2**: **Tax Invoice Terminal** (Full-width 100vw layout).
* **Phase 3**: **Purchase Order** & **GRN** Terminals.
* **Phase 4**: **Stock Transfer** & **Physical Count** Terminals.
* **Phase 5**: **Finance Terminals** (Receipt, Payment, Journal).
* **Phase 6**: Master Maintenance (retained inside Studios).

---

## 11. Success Metrics & Non-Functional Requirements (NFRs)

- **95% Workflow Speed**: 95% of standard retail bills completed without opening a drawer.
- **Scan Response**: Barcode scan to grid line insertion processed in **<150 ms**.
- **UI Responsiveness**: UI response **<100 ms** for common user actions.
- **Rendering Performance**: **60 FPS** smooth rendering during item grid scrolling.
- **Volume Scalability**: Support for **1,000+ line items** per document without performance degradation.
- **Error Handling Policy**: Active document protection, non-blocking barcode scanners, recoverable UI alerts, automatic retry for transient network drops.

---

## 12. Out of Scope

- Database schema redesign / migrations
- FastAPI endpoint modifications
- Backend pricing / GST calculation algorithm changes
- Approval workflow backend engine redesign
- Accounting engine modifications
- Authentication & JWT token architecture changes

---

## 13. Architectural Decision Records (ADRs)

- **ADR-001**: Introduction of SMRITI Terminal Framework & `TerminalPlugin` SDK.
- **ADR-002**: Abstraction of Item Grid behind `SMRITIGrid` adapter component.
- **ADR-003**: Hardware abstraction via `HardwareAdapterRegistry` for scanners, printers, and cash drawers.
- **ADR-004**: Progressive disclosure right-side drawer architecture (`RightDrawerHost` + `DrawerRegistry`).
- **ADR-005**: 100vw Full-Width Operational Workspace requirement for high-frequency terminals.
- **ADR-006**: Standardization of `DocumentSession` state machine and `TerminalContext` environment.
