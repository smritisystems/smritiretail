<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Sprint 39 — Section 7 Shared Business Engines: Universal Search Engine Completion

## 1. Purpose
Implement and certify the enterprise Universal Search Engine (Blueprint Section 7) providing unified omni-search discovery across Items, Parties, Barcodes, Documents, Warehouses, and Transactions with 4-tier barcode scanner resolution and strict role-based domain filtering.

## 2. Scope
- Fast 4-tier POS barcode scanner resolution across exact Barcodes, Variant SKUs, Item Codes, and fail-safe handling.
- Multi-domain omni-search aggregation combining entity matching across Item Master, Universal Parties (Customers, Suppliers, Transporters), Documents (Sales Invoices, Purchase Orders, Dispatches, Approval Requests), Warehouses, and Payment Transactions.
- RBAC domain boundary security restricting front-of-house roles (Cashiers) from sensitive operational/financial domains while permitting Store Managers and Sysadmins full platform visibility.
- Comprehensive REST APIs at `/api/v1/search/universal`, `/api/v1/search/barcode-scan`, and `/api/v1/search/domains`.
- Integration and regression test suites validating query latency, domain gating, and exact scan matching.

## 3. Files Created
- [`backend/app/schemas/search.py`](file:///F:/SMRITRretailNX/backend/app/schemas/search.py): Pydantic models for search requests, barcode scan responses, hit results, and domain catalogs.
- [`backend/app/services/search_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/search_engine.py): Universal omni-search service engine implementing 4-tier barcode resolution, multi-domain SQL querying, scoring, and role filtering.
- [`backend/app/api/v1/search.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/search.py): FastAPI REST router mounted at `/api/v1/search`.
- [`backend/tests/t_search.py`](file:///F:/SMRITRretailNX/backend/tests/t_search.py): Pytest integration suite with 6 comprehensive test scenarios.
- [`docs/walkthrough/foundation/Sprint39_Universal_Search_Engine_Completion_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint39_Universal_Search_Engine_Completion_v1.0.0.md): This WGP documentation artifact.

## 4. Files Modified
- [`backend/app/main.py`](file:///F:/SMRITRretailNX/backend/app/main.py): Mounted `/api/v1/search` router.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md): Certified Section 7 Universal Search Engine to `Done / Verified` per Rule 11.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md): Appended Sprint 39 entry to master index.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md): Documented version `v3.55.0` release notes.

## 5. Architecture Decisions
- **4-Tier Fast Barcode Hierarchy:** POS hardware and handheld scanners query `/api/v1/search/barcode-scan` which resolves sequentially: Tier 1 (`ItemBarcode.barcode`), Tier 2 (`ItemVariant.variant_sku`), Tier 3 (`Item.item_code`), and Tier 4 (`NOT_FOUND`), ensuring instant checkout resolution without roundtrip overhead.
- **Fail-Closed RBAC Domain Filtering:** Roles have predefined domain access matrices (`CASHIER` restricted to `ITEMS`, `BARCODES`, `DOCUMENTS`; `STORE_MANAGER`, `FINANCE_CONTROLLER`, and `SYSADMIN` granted access to `PARTIES`, `WAREHOUSES`, and `TRANSACTIONS`). Queries requesting unauthorized domains are silently filtered to prevent information leakage.
- **Deep-Link Navigation:** Every search hit returns a canonical `navigation_url` enabling UI instant jump to the respective detail view (e.g., `/catalog/items/{id}`, `/parties/{id}`, `/sales/invoices/{id}`, `/procurement/orders/{id}`).

## 6. Design Rationale
- High-velocity retail operations require sub-15ms barcode scans and omni-search capabilities across disparate transaction documents without needing separate domain APIs.
- Structuring search results with domain badges, scoring, and metadata facilitates immediate rendering in command palettes, POS lookup modals, and global search bars.

## 7. Implementation Summary
- **UniversalSearchEngine Service:**
  - `quick_barcode_scan(session, company_id, req)`: Resolves barcodes and returns product metadata, tax rates, UOM, and active pricing.
  - `execute_universal_search(session, company_id, req, caller_role)`: Executes concurrent ILIKE filters across database tables and aggregates weighted search items.
  - `get_allowed_domains(role)`: Validates role against `DOMAIN_ROLE_PERMISSIONS`.
- **REST Router:**
  - `POST /api/v1/search/universal`: Multi-domain query with JSON payload.
  - `GET /api/v1/search/universal`: Query-string search endpoint for UI autocomplete components.
  - `POST /api/v1/search/barcode-scan`: Fast scanner lookup.
  - `GET /api/v1/search/domains`: Returns available search domains for the authenticated user.

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python -m pytest tests/t_search.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 6 items

tests/t_search.py::test_quick_barcode_scan_tier1_tier2_tier3 PASSED      [ 16%]
tests/t_search.py::test_universal_search_multi_domain_aggregation PASSED [ 33%]
tests/t_search.py::test_role_based_domain_filtering_rbac PASSED          [ 50%]
tests/t_search.py::test_document_search_invoice_po_dispatch PASSED       [ 66%]
tests/t_search.py::test_party_search_by_code_phone_gstin PASSED          [ 83%]
tests/t_search.py::test_api_search_endpoints PASSED                      [100%]

======================= 6 passed, 10 warnings in 9.22s ========================
```
- Full platform regression suite passed: `117/117 passed in 67.33s`.
- SMRITI Naming Guard passed: `0 naming violations`.

## 10. Known Limitations
- Trigram and full-text search (tsvector/GIN) can be enabled in future database migration phases when catalog sizes exceed 500,000 SKUs per tenant.

## 11. Future Work
- Connect AI-powered semantic similarity vector search when vector embeddings are configured in Postgres `pgvector`.
- Add search history telemetry and recently searched items caching.

## 12. Related ADRs
- `ADR-0044`: Universal Fast Barcode Scanner and Search Engine Architecture.
- `ADR-0040`: Role-Based Access Control and Tenant Isolation Model.

## 13. Related RFCs
- `RFC-0078`: Multi-Domain Universal Search Specifications.
