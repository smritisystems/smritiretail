<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Vertical Slice 6 — Capability, Template, and Workspace Resolution

## 1. Objective
Establish the governed Business Capability Catalog and Industry Workspace Template resolution engine in the control plane (`smritisys`), with dynamic capability binding and user workspace layout personalization across tenant environments (`smritiXXX`).

---

## 2. Business Motivation
SMRITI Retail OS powers diverse verticals—Supermarkets, Fashion & Apparel, Distribution, Pharmacies, and Restaurants. Hardcoding feature sets leads to bloated interfaces and operational friction. Governed capability catalogs and workspace templates enable instant vertical adaptation (e.g. enabling FEFO batching for Pharma/FMCG, Matrix Grid for Apparel, and Table Ordering for F&B) while preserving a single canonical codebase.

---

## 3. Scope

### In-Scope
1. **Control-Plane Capability Catalog (`platform_capabilities`)**:
   - Governed capability definitions (`BATCH_EXPIRY_FEFO`, `SERIAL_IMEI_TRACKING`, `STYLE_COLOR_SIZE_MATRIX`, `TABLE_ORDERING`, `RULE55_DELIVERY_CHALLAN`, `PHYSICAL_STOCK_AUDIT`).
2. **Industry Workspace Templates (`workspace_templates`)**:
   - Pre-configured vertical templates:
     - `RETAIL_SUPERMARKET`: Fast POS, barcode scanning, loyalty, cashier shift reconciliation.
     - `APPAREL_FASHION`: Multi-attribute matrix, size/color breakdown, seasonal price books.
     - `DISTRIBUTOR_WMS`: Multi-godown inward GRN, FEFO B2B allocation, Rule 55 delivery challans, stock audit.
     - `PHARMACY_HEALTH`: Drug batch expiry control, Schedule H compliance, doctor prescriptions.
3. **Tenant Capability Binding & User Workspace Resolution (`tenant_capability_bindings`, `user_workspace_configs`)**:
   - Dynamic evaluation of company-enabled features.
   - User-level workspace preference resolution with fallback to tenant defaults.

### Out-of-Scope (Deferred)
- Automated AI-driven workspace layout generation (scheduled for future platform AI releases).
- Analytics plane outbox stream ingestion (scheduled for Slice 7).

---

## 4. Current State
- Industry templates existed partially in frontend configurations without authoritative backend capability registry models.

---

## 5. Gap Analysis
| Dimension | Current State | Target Architecture (Slice 6) |
| :--- | :--- | :--- |
| **Capability Governance** | Hardcoded frontend flags | Authoritative `platform_capabilities` in control plane (`smritisys`) |
| **Industry Templates** | Static JSON configs | Governed `workspace_templates` mapping features, menus, and widgets |
| **Tenant Subscriptions** | Implicit all-enabled | Explicit `tenant_capability_bindings` with activation dates and status |
| **Control Plane Boundary** | Fragmented | Strict control plane (`smritisys`) catalog + tenant plane (`smritiXXX`) binding |

---

## 6. Architecture Impact
- **Zero Interface Bloat**: A supermarket terminal only loads FMCG/POS widgets; an apparel warehouse loads matrix grids and delivery challans.
- **Control-Plane Invariant Preserved**: Capability definitions and master templates live in `smritisys`; effective operational assignments live in `smritiXXX`.

---

## 7. Proposed Design

### A. Capability & Workspace Models (`backend/app/models/capability_template.py`)
- `PlatformCapability`: `id`, `code`, `name`, `category`, `description`, `default_enabled`.
- `WorkspaceTemplate`: `id`, `code`, `vertical_name`, `included_capabilities` (JSON), `layout_config` (JSON).
- `TenantCapabilityBinding`: `id`, `company_id`, `capability_code`, `is_enabled`, `activated_at`.
- `UserWorkspaceConfig`: `id`, `user_id`, `active_workspace_template_id`, `custom_widgets` (JSON).

---

## 8. Files Created
- `backend/app/models/capability_template.py`: Canonical models for platform capabilities, workspace templates, and tenant bindings.
- `backend/app/services/unified_workspace_capability_service.py`: Domain service resolving active capabilities, applying vertical templates, and retrieving personalized user layouts.
- `backend/tests/test_unified_workspace_capability.py`: Automated verification suite certifying template resolution, capability filtering, user workspace bindings, and control/tenant plane isolation.
- `docs/implementation/foundation/Platform_Refactor_Slice6_Capability_Template_Workspace_Plan_v1.0.md`: This implementation plan.

---

## 9. Files Modified
- `backend/app/models/__init__.py`: Export Capability and Workspace models.
- `docs/implementation/README.md`: Append Slice 6 plan to master index.
- `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`: Track Slice 6 verification.

---

## 10. Dependencies
- Control Plane (`smritisys`) & Tenant Data Planes (`smriti001`, `smriti002`).
- Milestone 1: Routing Boundary and Security Roles.

---

## 11. Risks
| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Disabled capability accessed directly via API | High | Enforce capability guard middleware checking `tenant_capability_bindings` |
| Corrupt layout JSON configuration | Low | Enforce strict schema validation on `layout_config` |

---

## 12. Rollback Strategy
Additive DDL tables. If rollback is required, services fall back to default retail template configurations.

---

## 13. Verification Plan
1. Seed canonical platform capabilities and industry workspace templates.
2. Bind specific capabilities (e.g. `BATCH_EXPIRY_FEFO`) to `smriti001`.
3. Verify capability queries return only enabled features for the tenant.
4. Verify user workspace personalization resolves correctly.

---

## 14. Test Plan
- Run `backend/tests/test_unified_workspace_capability.py`.
- Run full 85+ test multi-module regression suite.

---

## 15. Documentation Impact
- Update `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`.
- Generate Walkthrough `docs/walkthrough/foundation/Platform_Capability_Template_Workspace_v6.16.0.md`.
- Update `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
1. Apply DDL to `smritisys` and tenant databases.
2. Deploy backend service models.
3. Validate automated test execution.

---

## 17. Status
**Draft — Ready for Review & Execution**

---

## 18. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-011`: Governed Capability Catalog & Dynamic Workspace Resolution.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Platform_Approval_Workflow_Communicator_v6.16.0.md`.
