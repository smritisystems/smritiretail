# 🏗️ PRESENTATION 5: TECHNICAL ARCHITECTURE & FOUNDATION ENGINES
**Deep Technical Architecture & Universal Platform Registries of SMRITI Retail OS**

---

## SLIDE 1: UNIVERSAL PLATFORM REGISTRY (UPR) CAPABILITY MATRIX

SMRITI Retail OS is built on a declarative architecture governed by frozen UPR standards (`SPK.*`). Business logic and UI components consume registries rather than hardcoded conditionals.

```
┌────────────────────────────────────────────────────────────────────────┐
│               UNIVERSAL PLATFORM REGISTRY (UPR) MATRIX                 │
├─────────┬───────────────────────────────────┬──────────────────────────┤
│ Code    │ Registry Capability               │ Core Facade              │
├─────────┼───────────────────────────────────┼──────────────────────────┤
│ WNG     │ Workspace Navigation Governance  │ SPK.navigation           │
│ UFR     │ Universal Form Registry           │ SPK.forms & SPK.entities │
│ USR     │ Universal Security Registry       │ SPK.security             │
│ UCR     │ Universal Configuration Governance│ SPK.configuration        │
│ UWR     │ Universal Workflow Registry       │ SPK.workflow             │
│ URR     │ Universal Report Registry         │ SPK.reports              │
│ UPRT    │ Universal Print Registry          │ SPK.printing             │
│ UDR     │ Universal Dashboard Registry      │ SPK.dashboard            │
│ UAR     │ Universal AI Skill Registry       │ SPK.ai                   │
└─────────┴───────────────────────────────────┴──────────────────────────┘
```

---

## SLIDE 2: 5-LEVEL ENTERPRISE NAVIGATION HIERARCHY (WNG-004)

Navigation strictly obeys the enterprise navigation hierarchy:
```
Level 1 (Launchpad) ──► Level 2 (Business Domain) ──► Level 3 (Business Module) ──► Level 4 (Workspace Tabs) ──► Level 5 (Task / Form Inspector)
```

* **Single Persistent Sidebar:** Primary navigation belongs exclusively to the main left sidebar. Workspaces never render a second persistent navigation sidebar.
* **Context-Aware Left Sidebar:** Left navigation renders exclusively the modules belonging to the currently active business domain (Sales, Purchase, Inventory, Accounting, CRM, Reports).

---

## SLIDE 3: REUSABLE PRODUCT FOUNDATION ENGINES

| Foundation Engine | Purpose & Responsibilities | Public API |
| :--- | :--- | :--- |
| **Pricing Engine** | Base price, quantity breaks, basket rules, customer tier discounts | `pricing.calculate`, `pricing.applyPromotion` |
| **GST Tax Engine** | HSN lookup, state-code tax split (CGST/SGST vs IGST), tax slab calculation | `gst.calculateTax`, `gst.validateGSTIN` |
| **Workflow Engine** | State transitions, approval matrices, SLAs, task escalation | `workflow.create`, `workflow.approve` |
| **Numbering Engine** | Document series generation (SQ, SO, DC, SI, GRN), prefix management | `numbering.generateNext` |
| **Print Engine** | Raw ZPL / TSPL label generation & thermal HTML document rendering | `printing.renderDocument` |
| **Notification Engine**| Automated SMS, WhatsApp, and Email triggers | `notification.dispatch` |

---

## SLIDE 4: SYSTEM CONSTITUTION & COMPLIANCE RULES

* **AOP-001 (AI Optionality Principle):** All AI features act as advisory only (`isAdvisoryOnly: true`). No AI engine automatically posts financial transactions.
* **AOP-002 (Four-Tier Architecture):** Core Engine ──► Platform Facade ──► Retail Domain ──► Industry Packs (Restaurant, Apparel, Medical).
* **AOP-005 (Auth Isolation):** Authentication boundaries isolated from tenant business databases.
* **AOP-006 (Traceability):** Every financial ledger entry linked to originating source document ID and timestamp.
