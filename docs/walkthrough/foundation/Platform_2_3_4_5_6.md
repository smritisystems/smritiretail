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

# Walkthrough: Vertical Slice 6 — Capability, Template, and Workspace Resolution

## 1. Purpose
Establish the governed Business Capability Catalog and Industry Workspace Template resolution engine in the control plane (`smritisys`), with dynamic capability binding (`tenant_capability_bindings`) and user workspace layout personalization (`user_workspace_configs`) across tenant environments (`smritiXXX`). This guarantees zero UI bloat, vertical-specific feature isolation, and strict separation between control-plane templates and tenant-plane operational subscriptions.

---

## 2. Scope
- **Control Plane (`smritisys`) Governance**: Canonical platform capabilities (`PlatformCapability`) and vertical workspace templates (`WorkspaceTemplate`) for Supermarket, Apparel, Distributor WMS, and Pharmacy.
- **Tenant Data Plane (`smritiXXX`) Subscriptions**: Explicit capability activation bindings (`TenantCapabilityBinding`).
- **User Personalization**: User layout preferences (`UserWorkspaceConfig`) with dynamic capability intersection resolution.
- **Strict Physical Tenancy**: Subscriptions and user configurations strictly isolated per tenant database.

---

## 3. Files Created
1. `backend/app/models/capability_template.py`: Canonical `PlatformCapability`, `WorkspaceTemplate`, `TenantCapabilityBinding`, and `UserWorkspaceConfig` models.
2. `backend/app/services/workspace_cap_svc.py`: Domain service handling control catalog seeding, tenant capability binding, and cross-plane workspace layout resolution.
3. `backend/tests/t_workspace_cap.py`: Automated verification suite certifying template seeding in `smritisys`, capability filtering in `smriti001`, layout resolution, and tenant isolation.
4. `docs/implementation/foundation/Platform_Refactor_2.md`: Master 19-section implementation plan for Slice 6.

---

## 4. Files Modified
1. `backend/app/models/__init__.py`: Exported Capability and Workspace models.
2. `docs/implementation/README.md`: Appended Slice 6 implementation plan to master index.
3. `docs/architecture/PLATFORM.md`: Updated platform tracker with verified Slice 6 status.
4. `docs/walkthrough/README.md`: Appended Slice 6 walkthrough to chronological master index.

---

## 5. Architecture Decisions
- **ADR-011: Governed Capability Catalog in Control Plane**: Platform capability definitions and master workspace templates live strictly in `smritisys`. Tenant databases (`smritiXXX`) hold only activation records (`tenant_capability_bindings`) and user preferences.
- **ADR-012: Dynamic Workspace Layout Intersection**: The runtime layout returned to a client application is the strict intersection of the template's included capabilities and the company's active tenant subscriptions.

---

## 6. Design Rationale
Separating the capability catalog from tenant subscriptions allows SMRITI to introduce new industry verticals and feature modules without migrating individual tenant database schemas.

---

## 7. Implementation Summary
- **Control Catalog Seeding**:
  - Registers standard capabilities: `BATCH_EXPIRY_FEFO`, `SERIAL_IMEI_TRACKING`, `STYLE_COLOR_SIZE_MATRIX`, `TABLE_ORDERING`, `RULE55_DELIVERY_CHALLAN`, `PHYSICAL_STOCK_AUDIT`.
  - Registers standard templates: `RETAIL_SUPERMARKET`, `APPAREL_FASHION`, `DISTRIBUTOR_WMS`, `PHARMACY_HEALTH`.
- **Tenant Subscription Binding**:
  - Actively enables/disables capability codes for each tenant database.
- **Cross-Plane Layout Resolution**:
  - Queries `user_workspace_configs` in tenant DB.
  - Resolves master template from `smritisys`.
  - Filters template capabilities to only those enabled in tenant DB.

---

## 8. Tests Executed
1. `backend/tests/t_workspace_cap.py`:
   - `test_control_plane_capability_and_template_seeding` (Passed)
   - `test_tenant_capability_binding_and_filtering` (Passed)
   - `test_user_workspace_layout_cross_plane_resolution` (Passed)
   - `test_capability_and_workspace_tenant_isolation` (Passed)
2. Full Multi-Module Regression Suite:
   - 85/85 automated tests passed in 36.48s across Routing Boundary, Tenant DB Provisioning, Menu Governance, Security Access, WMS Phases 1–4, Slice 2 Universal Party/Item Masters, Slice 3 Sales/POS & Stock Ledger, Slice 4 Pricing/Payments, Slice 5 Approvals/Communicator, and Slice 6 Capabilities/Workspaces.

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 85 items

backend\tests\t_workspace_cap.py ....                  [  4%]
backend\tests\t_approval_comm.py ....                 [  9%]
backend\tests\t_pricing_eng.py ....                [ 14%]
backend\tests\t_sales_ledger.py ....                          [ 18%]
backend\tests\t_univ_party.py ...                         [ 22%]
backend\tests\t_univ_item.py ...                          [ 25%]
backend\tests\t_route_boundary.py .............           [ 41%]
backend\tests\t_comp_db_route.py .......                 [ 49%]
backend\tests\t_comp_db_name.py ......                [ 56%]
backend\tests\t_comp_db_wire.py .....                        [ 62%]
backend\tests\t_multi_comp_db.py ......         [ 69%]
backend\tests\t_comp_db_prov.py .....                      [ 75%]
backend\tests\t_menu_gov.py .                                  [ 76%]
backend\tests\t_sec_menu.py ..                            [ 78%]
backend\tests\test_wms_phase1.py ....                                    [ 83%]
backend\tests\t_wms_phase2.py ...                           [ 87%]
backend\tests\t_wms_phase3.py .....                         [ 92%]
backend\tests\t_wms_phase4.py ......             [100%]

======================= 85 passed, 1 warning in 36.48s ========================
```

---

## 10. Known Limitations
- Dynamic drag-and-drop widget customizer is stored as raw JSON in `custom_widgets`.

---

## 11. Future Work
- **Slice 7**: Outbox and Analytics Plane.

---

## 12. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-011`: Governed Capability Catalog & Dynamic Workspace Resolution.

---

## 13. Related RFCs
- `RFC-013`: Universal Capability Registry and Cross-Plane Workspace Resolution.
