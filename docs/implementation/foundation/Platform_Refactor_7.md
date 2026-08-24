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

# Implementation Plan: Vertical Slice 2 — Universal Party Master & Universal Item Master Canonicalization

## 1. Objective
Establish canonical, extensible, and normalized Universal Party Master and Universal Item Master foundations in the tenant data plane (`smritiXXX`) without breaking existing POS, Sales, Billing, Procurement, or WMS transactional endpoints.

---

## 2. Business Motivation
SMRITI operates as a single configurable business operating platform. In multi-channel retail and distribution, a party can act in multiple business capacities simultaneously (e.g. a customer who is also a distributor, or an employee who acts as a salesman), and items require unified barcode, variant, pricing, and batch attributes across POS, B2B sales, warehousing, and procurement. Unifying these masters prevents data duplication and reconciliation bottlenecks.

---

## 3. Scope

### In-Scope
1. **Universal Party Identity (`parties`)**:
   - Normalized core party identity in `smritiXXX` (name, GSTIN, PAN, contacts, status).
   - Role extensions (`party_roles`, `customer_profiles`, `supplier_profiles`).
   - Non-destructive compatibility views/adapters for legacy `customers` and `suppliers`.
2. **Universal Item Identity (`items` / `products`)**:
   - Normalized item master in `smritiXXX` (SKU, title, UOM, HSN, tax rate, tracking flags).
   - Variant & barcode structure (`item_variants`, `item_barcodes`).
   - Direct integration with authoritative batch stock ledger (`product_batch_stocks`).
3. **Automated Verification Suite**:
   - Regression and data-integrity tests verifying dual-role parties and variant/batch item resolution.

### Out-of-Scope (Deferred)
- Predictive Distribution Twin (PDT) and demand forecasting.
- Analytics/Intelligence Plane pipelines.
- Microservices extraction.
- Universal metadata-generated UI engines.

---

## 4. Current State
- `customers` and `suppliers` exist as distinct tables in `smritiXXX`, resulting in duplicate contact, tax, and address entries for dual-capacity entities.
- `products` and `product_batch_stocks` exist with WMS enhancements, but variant hierarchies and barcode indexes are partially fragmented between POS auto-search and warehouse scanning.

---

## 5. Gap Analysis
| Dimension | Current State | Target Architecture (Slice 2) |
| :--- | :--- | :--- |
| **Party Identity** | Disjoint `customers` and `suppliers` tables | Core `parties` identity table with polymorphic `party_roles` and role-specific profiles (`customer_profiles`, `supplier_profiles`) |
| **Party Roles** | Implicit in table type | Explicit role assignment (`CUSTOMER`, `SUPPLIER`, `DEALER`, `EMPLOYEE`, `TRANSPORTER`) |
| **Item Master** | Flat `products` table | Normalized `Item` entity + `item_variants` + `item_barcodes` + `product_batch_stocks` |
| **Backward Compatibility** | Direct queries to `customers`/`suppliers` | Compatibility view adapters + legacy model facades ensuring zero breaking changes to existing endpoints |

---

## 6. Architecture Impact
- **Data Plane Isolation**: All party and item masters reside strictly in tenant databases (`smritiXXX`). No business masters are written to `smritisys`.
- **Authoritative Ledgers Preserved**: `stock_movements` and financial ledger entries remain the sole authoritative transactional truth.

---

## 7. Proposed Design

### A. Party Domain (`backend/app/models/party.py`)
```sql
CREATE TABLE IF NOT EXISTS parties (
    id VARCHAR(50) PRIMARY KEY,
    party_code VARCHAR(50) UNIQUE NOT NULL,
    party_type VARCHAR(30) NOT NULL DEFAULT 'ORGANIZATION', -- INDIVIDUAL, ORGANIZATION
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    gstin VARCHAR(15),
    pan VARCHAR(10),
    email VARCHAR(255),
    phone VARCHAR(20),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, BLOCKED, SUSPENDED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS party_roles (
    id VARCHAR(50) PRIMARY KEY,
    party_id VARCHAR(50) REFERENCES parties(id) ON DELETE CASCADE,
    role_type VARCHAR(30) NOT NULL, -- CUSTOMER, SUPPLIER, DEALER, DISTRIBUTOR, EMPLOYEE, TRANSPORTER
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(party_id, role_type)
);

CREATE TABLE IF NOT EXISTS customer_profiles (
    party_id VARCHAR(50) PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
    customer_category VARCHAR(30) DEFAULT 'RETAIL', -- RETAIL, WHOLESALE, INSTITUTIONAL
    credit_limit NUMERIC(12, 2) DEFAULT 0.00,
    credit_days INTEGER DEFAULT 0,
    price_tier_id VARCHAR(50),
    loyalty_tier_id VARCHAR(50),
    tax_category VARCHAR(30) DEFAULT 'B2C', -- B2B, B2C, SEZ, EXPORT
    is_credit_hold BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS supplier_profiles (
    party_id VARCHAR(50) PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
    supplier_type VARCHAR(30) DEFAULT 'DISTRIBUTOR',
    payment_terms_days INTEGER DEFAULT 30,
    msme_registration_no VARCHAR(50),
    tax_treatment VARCHAR(30) DEFAULT 'REGISTERED_REGULAR'
);
```

### B. Item Domain (`backend/app/models/item.py`)
- Core `Item` model with SKU, HSN, tax rate, UOM, and batch/serial tracking flags.
- `ItemVariant` model for multi-attribute variant resolution.
- `ItemBarcode` model for rapid POS and WMS barcode lookups.
- Compatibility bridge to `Product` and `ProductBatchStock`.

---

## 8. Files Created
- `backend/app/models/party.py`: Canonical Party, PartyRole, CustomerProfile, and SupplierProfile models.
- `backend/app/models/item_master.py`: Canonical Item, ItemVariant, and ItemBarcode models.
- `backend/app/services/party_service.py`: Universal Party domain management service.
- `backend/app/services/item_master_service.py`: Universal Item domain management service.
- `backend/tests/test_universal_party_master.py`: Verification suite for multi-role party resolution.
- `backend/tests/test_universal_item_master.py`: Verification suite for item variants, barcodes, and batch stock linking.

---

## 9. Files Modified
- `backend/app/models/__init__.py`: Export canonical Party and Item models.
- `backend/app/api/deps.py`: Add party/item domain dependency helpers.
- `docs/implementation/README.md`: Append Slice 2 plan to implementation master index.

---

## 10. Dependencies
- Milestone 1 hardened database routing boundary (`CompanyDatabaseResolver`).
- PostgreSQL multi-tenant databases (`smriti001`, `smriti002`).

---

## 11. Risks
| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Breaking legacy Customer/Supplier queries | High | Implement transparent dual-read / view adapters so legacy endpoints query without schema friction |
| Schema collision on existing tenant DBs | Medium | Use `IF NOT EXISTS` idempotent DDL migrations |

---

## 12. Rollback Strategy
All new tables (`parties`, `party_roles`, `customer_profiles`, `supplier_profiles`, `item_variants`, `item_barcodes`) are additive. If rollback is required, existing `customers`, `suppliers`, and `products` tables remain intact and operational.

---

## 13. Verification Plan
1. Validate non-breaking backward compatibility across existing POS (`/api/v1/pos/*`), Sales (`/api/v1/sales/*`), and Procurement (`/api/v1/procurement/*`) endpoints.
2. Validate multi-role party creation (e.g. entity acting as both Customer and Supplier).
3. Validate item variant and barcode resolution in POS and WMS scanners.

---

## 14. Test Plan
- Run `backend/tests/test_universal_party_master.py`.
- Run `backend/tests/test_universal_item_master.py`.
- Run full 63+ test regression suite to ensure zero breakages across WMS, Security, and Routing.

---

## 15. Documentation Impact
- Update `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`.
- Generate Walkthrough `docs/walkthrough/foundation/Platform_Universal_Party_Item_Master_v6.16.0.md`.
- Update `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
1. Apply additive DDL across tenant databases (`smriti001`, `smriti002`).
2. Deploy backend service models and compatibility adapters.
3. Execute automated test validation.

---

## 17. Status
**Draft — Ready for Review & Execution**

---

## 18. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-003`: Universal Party and Universal Item Extension Architecture.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Platform_Routing_Boundary_Hardening_v6.16.0.md`.
