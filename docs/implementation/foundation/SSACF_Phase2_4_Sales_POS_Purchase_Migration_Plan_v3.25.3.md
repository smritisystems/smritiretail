<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.3
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SSACF Phase 2.4 — Sales, POS, & Purchase Endpoint Migration

Migrate SMRITI's core transaction modules (Sales, POS Checkout, and Purchase Operations) from legacy role-based guards (`require_role()`) to dynamic, namespaced permissions (`require_permission()`), and significantly expand security test coverage.

## 1. Objective
Refactor authorization guards across the Sales, POS, and Purchase endpoints to validate granular permissions dynamically. Eliminate coarse role checks, secure the critical `pos_checkout` pathway, and add a comprehensive security validation suite.

## 2. Business Motivation
Transaction modules represent the highest-risk revenue flows in SMRITI. Securing these pathways with permission-based access control prevents unauthorized invoicing, unapproved purchases, or cash register manipulation, satisfying security requirements for enterprise compliance.

## 3. Scope
* Migrate [sales.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/sales.py) endpoints to dynamic permission checks: `SALES.CREATE` (creating/modifying invoices, quotations, orders, and returns), `SALES.VIEW` (listing/retrieving invoices and orders), and `SALES.DELETE` (voiding/cancellation).
* Migrate [pos.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/pos.py) endpoints: secure cash registers and profile configurations with `SYSTEM.CONFIG`, and cashier checkouts with `SALES.CREATE`.
* Migrate [purchase.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/purchase.py) endpoints: supplier management with `SUPPLIER.MANAGE`, PO creation and amendments with `PURCHASE.CREATE` and `PURCHASE.APPROVE`, and PO voiding with `PURCHASE.DELETE`.
* Construct a detailed integration test suite containing 20-30 target scenarios verifying:
  * Role mapping and cashier checkout limits.
  * Policy changes and cache invalidations.
  * Tenant and branch boundaries isolation.
  * SYSADMIN bypass (SUPER God Mode).

## 4. Current State
* Sales, POS Profile creation, and Purchase endpoints rely on static role-based access checks (`require_role`).
* POS checkout (`/pos/checkout`) has no dynamic role or permission enforcement.
* Backend testing lacks extensive edge-case security coverage for dynamic role inheritance, multi-policy deny overrides, or cache synchronization.

## 5. Gap Analysis
* **POS Checkout Security Gap**: Lacks access control, allowing any authenticated user to process billing invoices.
* **Role Dependency Coupling**: Modules are coupled to static `UserRole` enums instead of granular permission namespaces.
* **Test Coverage Depth**: The existing test suite runs only a few basic security assertions, leaving complex authorization overrides unverified.

## 6. Architecture Impact
* Enforces central authorization mapping within the SSACF engine for all transaction modules.
* Preserves fast request performance using dynamic cache resolution.
* Resolves the HREP dictionary exception detailing logic.

## 7. Proposed Design

### Sales Module Mappings
* `POST /invoices`, `POST /quotations`, `POST /orders`, `POST /returns`: `require_permission("SALES.CREATE")`
* `GET /invoices`, `GET /quotations`, `GET /orders`, `GET /returns`: `require_permission("SALES.VIEW")`
* `PUT /invoices/{id}`, `PUT /quotations/{id}`, `PUT /orders/{id}`, `PUT /returns/{id}`: `require_permission("SALES.CREATE")`
* `DELETE /invoices/{id}`, `DELETE /quotations/{id}`, `DELETE /orders/{id}`, `DELETE /returns/{id}`: `require_permission("SALES.DELETE")`
* `POST /quotations/convert/{id}`: `require_permission("SALES.CREATE")`

### POS Module Mappings
* `POST /registers/`, `POST /pos/profiles/`, `POST /pos/profiles/{id}/clone`, `POST /pos/profiles/{id}/archive`, `POST /pos/profiles/{id}/toggle-lock`: `require_permission("SYSTEM.CONFIG")`
* `POST /pos/checkout`: `require_permission("SALES.CREATE")`
* `GET /registers/`, `GET /pos/profiles/`, `GET /pos/shifts/`: `require_permission("SALES.VIEW")`

### Purchase Module Mappings
* `POST /suppliers/`, `PUT /suppliers/{id}`, `DELETE /suppliers/{id}`: `require_permission("SUPPLIER.MANAGE")`
* `POST /orders/`, `POST /purchase-orders/{id}/amend`: `require_permission("PURCHASE.CREATE")`
* `POST /orders/{id}/submit`, `POST /orders/{id}/cancel`, `POST /purchase-orders/{id}/cancel`: `require_permission("PURCHASE.APPROVE")`
* `POST /purchase-receipts/`: `require_permission("PURCHASE.CREATE")` (Creating GRN/Receipts)
* `POST /reorder-suggestions/convert`: `require_permission("PURCHASE.CREATE")`
* `POST /jurisdiction`, `POST /settings/jurisdiction`, `POST /config/jurisdiction`: `require_permission("SYSTEM.CONFIG")`

## 8. Files Created
* `backend/app/tests/test_sales_pos_purchase_security.py`

## 9. Files Modified
* `backend/app/api/v1/sales.py`
* `backend/app/api/v1/pos.py`
* `backend/app/api/v1/purchase.py`

## 10. Dependencies
* Seeding updates in `backend/app/db/seed.py` for permission codes if missing.

## 11. Risks
* Disruption of active sales routes or POS checkouts during cashier operations. Cashier policies will be thoroughly pre-seeded and tested.

## 12. Rollback Strategy
* Revert the api router files using standard `git restore`.

## 13. Verification Plan
* Execute python pytest suites on the new test file to ensure complete coverage.

## 14. Test Plan
* Validate 25+ assertions:
  * Cashier with `SALES.CREATE` can invoice.
  * Cashier without `SALES.DELETE` cannot cancel invoice.
  * Clerk with `PURCHASE.CREATE` can create orders but cannot approve (`PURCHASE.APPROVE` required).
  * POS checkout permissions check.
  * Tenant isolation (Company A user blocked from Company B sales).
  * Branch isolation (Branch A user blocked from Branch B data unless scope allows).
  * Cache invalidation and SUPER God Mode bypass.

## 15. Documentation Impact
* Walkthrough creation `Security_SSACF_Sales_POS_Purchase_Endpoint_Migration_v3.25.3.md`.
* Index updates.

## 16. Deployment Plan
* Deploy changes locally, execute the test suite, ensure clean linter checks, and commit.

## 17. Status
* Completed

## 18. Related ADRs
* `ADR-012-SSACF-Role-Engine`

## 19. Related Walkthroughs
* `Security_SSACF_CRM_And_Inventory_Endpoint_Migration_v3.25.2.md`
