<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.9.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Customer Price Group Master & Database Flow Integrity (v6.9.0)

## 1. Objective
Provide full desktop ERP fidelity for Customer Price Groups and enforce PostgreSQL as the single source of truth across all POS, billing, and CRM modules.

## 2. Business Motivation
Price groups control commercial terms, credit limits, credit days, destination tax types, and billing permissions (Credit, Cash, Tax Exclusive, and Misc. Issues). The audit revealed discrepancies between frontend mock arrays and the PostgreSQL database; fixing this ensures accurate pricing, invoicing, and tax compliance.

## 3. Scope
* Frontend Customer Price Group Modal (`SmritiCustomerPriceGroupModal.tsx`)
* Form Tab selector integration (`SmritiCustomerFormTab.tsx`)
* Customer store service (`customerStore.ts`)
* Billing terminal and ProPOS customer lookup (`SmritiBillingTerminal.tsx`, `SmritiCustomerBrowseModal.tsx`)
* Backend tenant context and CRM service (`deps.py`, `crm.py`, `schemas/crm.py`)
* Database seeding (`seed_customers.py`)

## 4. Current State
Previously, frontend stores fell back to hardcoded `initialCustomers` and `DEFAULT_CUSTOMERS`, masking empty databases or tenant isolation errors. PostgreSQL had 0 customer groups and was missing invoice-linked customer records.

## 5. Gap Analysis
1. Missing Customer Price Group master window matching desktop ERP layout.
2. Inconsistent branch ID resolution in backend dependency injection.
3. Silent mock data fallback preventing users from detecting unseeded backend environments.
4. Missing canonical customer records in PostgreSQL.

## 6. Architecture Impact
* Enforces PostgreSQL + FastAPI as the exclusive transactional system of record.
* Decouples local caching from mock initialization.
* Synchronizes price group configuration directly to customer profile records.

## 7. Proposed Design
* `CustomerPriceGroup` model containing Code, Description, Terms, Days, Limit, Tax Type, and 4 transaction permission flags.
* Dedicated modal matching the desktop layout with keyboard shortcuts (<kbd>Alt+O</kbd>, <kbd>Alt+C</kbd>, <kbd>Alt+A</kbd>, <kbd>Alt+E</kbd>, <kbd>Alt+D</kbd>, <kbd>Alt+X</kbd>).
* Direct seeding script preserving invoice-linked customer IDs (`cust-rrl-192b561d`).

## 8. Files Created
* `src/components/customer/SmritiCustomerPriceGroupModal.tsx`
* `backend/app/db/seed_customers.py`
* `src/tests/customerPriceGroup.test.ts`
* `src/tests/customerFlowIntegrity.test.ts`
* `docs/walkthrough/crm/Customer_Price_Group_And_Database_Integrity_v6.9.0.md`
* `docs/implementation/crm/Customer_Price_Group_And_Database_Integrity_Plan_v6.9.0.md`

## 9. Files Modified
* `src/types.ts`
* `src/components/customer/types.ts`
* `src/services/customerStore.ts`
* `src/components/customer/SmritiCustomerFormTab.tsx`
* `src/components/billing/SmritiBillingTerminal.tsx`
* `src/components/billing/propos/SmritiCustomerBrowseModal.tsx`
* `backend/app/api/deps.py`
* `backend/app/services/crm.py`
* `backend/app/schemas/crm.py`
* `docs/walkthrough/README.md`
* `docs/implementation/README.md`
* `CHANGELOG.md`

## 10. Dependencies
* React 18, Tailwind CSS, Lucide React icons, FastAPI, SQLAlchemy, PostgreSQL 15, Vitest.

## 11. Risks
* Network outages during customer creation: Mitigated by offline queue in `smriti_pending_customers` and auto-sync on reconnect.

## 12. Rollback Strategy
* Revert git commits; PostgreSQL schema remains backwards compatible.

## 13. Verification Plan
* Headless Vitest test suite execution.
* Direct PostgreSQL table queries asserting row counts and foreign keys.
* Production bundle compilation.

## 14. Test Plan
* Validate default Price Groups (`CPP`, `TI`, `VIP`, `CORP`, `RETAIL`).
* Validate Add, Edit, Delete CRUD operations on price groups.
* Validate transaction permissions toggles.
* Validate customer creation and lookup without mock injection.

## 15. Documentation Impact
* Walkthrough created under `docs/walkthrough/crm/`.
* Implementation Plan created under `docs/implementation/crm/`.
* Master index tables updated in `docs/walkthrough/README.md` and `docs/implementation/README.md`.
* `CHANGELOG.md` updated with release notes.

## 16. Deployment Plan
* Rebuilt and validated Docker container stack (`docker compose build` & `docker compose up -d`).

## 17. Status
* **Completed**

## 18. Related ADRs
* ADR-028: Multi-Tenant Schema & Branch Scope Alignment
* ADR-034: Removal of In-Memory Mock Fallbacks in Production Billing

## 19. Related Walkthroughs
* `docs/walkthrough/crm/Customer_Price_Group_And_Database_Integrity_v6.9.0.md`
