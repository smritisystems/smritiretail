# ADR-UX-004: Single Capability Authority & Controlled Legacy Retirement Governance

| Metadata Field | Value |
| :--- | :--- |
| **ADR Number** | `ADR-UX-004` |
| **Status** | `FROZEN & CONSTITUTIONALLY APPROVED (v1.0)` |
| **Created / Frozen** | `2026-08-07` |
| **Supersedes** | None |
| **Depends On** | `ADR-UX-001`, `ADR-UX-002`, `ADR-UX-003`, `ADR-AUTH-001` |
| **Applies To** | Workspace Shell, Navigation, Overlay, Notifications, Search, Theme |
| **Milestone** | SMRITI Retail OS v5.3.0 |

---

## 1. Context

During the SMRITI Workspace Shell (SWS) Audit, multiple visual disconnections, duplicate modal triggers, and event listener collisions were traced to the co-existence of **two architectural generations**:
1. **Legacy Procedural Shell**: `App.tsx` → `LayoutManager.tsx` → `LaunchpadShell.tsx` (containing embedded headers, search modals, and status bars).
2. **SMRITI Workspace Shell (SWS)**: Platform runtime container in `src/workspace/` governing header, sidebar, command palette, notification engine, and overlay manager.

To prevent structural debt and visual regressions from recurring, this ADR freezes strict single-ownership rules, capability registration requirements, and an enterprise retirement lifecycle for all platform capabilities.

---

## 2. Decision Rules

### SCA-001 — Single Capability Authority Rule
Every UI capability (Header, Sidebar, Command Palette, Notification Engine, Overlay Host, Taskbar Dock, Theme Engine) MUST derive strictly from a single registered platform service in `src/workspace/`. No capability may have multiple active implementations.

### SCA-002 — Business Module Isolation Rule
No business module (Inventory, POS, Sales, CRM, Purchase, Reports) may instantiate platform capabilities directly. Business modules MUST act strictly as content grid consumers of Workspace Shell contracts.

### SCA-003 — Capability Registration Rule
No new platform capability may be introduced unless:
1. It is registered in `src/workspace/capability-registry.ts`.
2. It has an explicit documented owner component.
3. It is listed in `docs/architecture/capability_ownership.md`.
4. It has an associated Architecture Decision Record (ADR).  
*Otherwise, PR merge MUST be blocked by automated CI validation.*

### SCA-004 — No Parallel Runtime Rule
No platform capability may have more than one active runtime instance. This rule applies regardless of whether the additional implementation is hidden, off-screen, conditionally rendered, or visually inactive. Only one runtime owner may exist across the entire application runtime tree.

---

## 3. Capability Ownership Lifecycle

Legacy components must transition through the following strict lifecycle before deletion:

```
Legacy Component ──► Replacement Exists ──► Consumers Migrated ──► Zero Runtime Refs ──► 🟡 Retired ──► 📦 Archived ──► ❌ Deleted
```

---

## 4. Enterprise Retirement Protocol (ERP-001)

No legacy component may be deleted from the repository until it passes all seven mandatory verification steps:

1. **Step 1: Replacement Verification** — Confirm that an authoritative SWS replacement exists in `src/workspace/`.
2. **Step 2: Consumer Migration** — Re-route all call sites, props, and event handlers to SWS contracts.
3. **Step 3: Zero-Reference Code Audit** — Execute ripgrep search confirming zero active runtime references.
4. **Step 4: Automated Playwright Verification** — Run headless verification suite with zero errors.
5. **Step 5: Runtime Inspection Gate** — Verify via React DevTools, DOM tree inspection, event listener inspection, memory snapshot, and performance profiling that only ONE active runtime implementation exists.
6. **Step 6: Mark as Retired** — Update `docs/architecture/capability_ownership.md` status to `🟡 Retired`.
7. **Step 7: Git Safety Staging & Archive** — Stage diff, verify safety check, and remove retired file.

---

## 5. CI Architecture Validation Pipeline

CI/CD automation MUST enforce architecture validation prior to build and test stages:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ CI/CD PIPELINE STAGES                                                  │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. Architecture Validation (SCA-001 / SCA-002 / SCA-003 / SCA-004)     │
 │ 2. Capability Registry Sync Validation                                 │
 │ 3. Duplicate Capability & Multi-Listener Detection                     │
 │ 4. Design Token Normalization Linter (validate_tokens.py)              │
 │ 5. Production Build (vite build)                                       │
 │ 6. Headless Test Suite Execution (npm test / playwright)                │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Approved Release Roadmap

* **v5.3.0** — Legacy Decommission Program (Shell Unification & Retirement)
* **v5.3.1** — Design Token Normalization (CSS Variable Harmonization)
* **v5.3.2** — Accessibility & Responsive Compliance (WCAG AA & Touch Targets)
* **v5.4.0** — Resume Feature Development

---

## 7. ADR Compliance Checklist

- [x] Single Capability Owner Defined (`SCA-001`)
- [x] Business Modules Consume Contracts (`SCA-002`)
- [x] Capability Registered in Registry (`SCA-003`)
- [x] No Parallel Runtime Instances Enforced (`SCA-004`)
- [x] Seven-Step Retirement Protocol Documented (`ERP-001`)
- [x] CI Architecture Validation Specified
- [x] Design Token Governance Referenced (`ADR-UX-001`)
- [x] Accessibility & Responsive Milestones Scheduled (`v5.3.2`)
- [x] TypeScript Static Verification Passed (`npm run lint`)
