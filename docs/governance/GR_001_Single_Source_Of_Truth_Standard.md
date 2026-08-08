<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# SMRITI Policy GR-001: Single Source of Truth (SSOT) Standard

**Status:** FROZEN — v1.0 (2026-07-28)  
**Category:** Engineering Governance Standard  
**Tier:** Level 1 Constitutional Engineering Standard

---

## 1. Objective
To enforce zero duplication across all business logic, tax calculations, pricing engines, barcode generators, UI components, data schemas, API contracts, and configuration values in SMRITI Retail OS.

---

## 2. SSOT Governance Across 7 Pillars

### Pillar 1: One Calculation Engine (Write Once, Reuse Everywhere)
- **GST Tax Engine**: All tax calculations (CGST, SGST, IGST, CESS) must call `TaxService` (`backend/app/services/tax.py`). No module shall write ad-hoc `price * 0.18` math.
- **Pricing Engine**: All retail discounts, slab pricing, and MRP calculations call `PricingService`.

### Pillar 2: One UI Component (One Component, Many Screens)
- **Selector Components**: Customer selection MUST use `<CustomerSelector />`, product selection MUST use `<ProductSelector />`. Ad-hoc dropdown popups are prohibited.
- **Dialogs & Modals**: All modals MUST wrap `<SmritiDialog />`.

### Pillar 3: One Business Rule
- Validation logic (e.g. valid GTIN/EAN-13 check-digits, HSN code formats, PAN/GSTIN patterns) resides in a single validator class and is reused across API, POS, and Spreadsheet Studio.

### Pillar 4: One Database Truth (Canonical Data Model)
- Current stock is calculated from the authoritative inventory ledger (`StockMovement`) or official material projections, never from duplicated un-synced fields.

### Pillar 5: One API Endpoint
- Exactly ONE authoritative API endpoint per business capability (e.g. `/api/v1/products`). Creating parallel endpoints (`/items`, `/stock-items`) for the same entity is forbidden.

### Pillar 6: One Design Token System
- UI styling must consume centralized layout and color tokens (`LAYOUT_TOKENS`, CSS variable tokens). Hardcoded arbitrary hex colors or pixel offsets are prohibited.

### Pillar 7: One Configuration Layer
- System values (GST rates, store currency, API keys, database URIs) are defined exclusively in `backend/app/core/config.py`.

## 8. Repository Ownership Governance (Rule 23)
- Constitutional governance, platform compatibility matrices, and platform lifecycle artifacts belong to the architecture repository.
- Contract schemas and compatibility contracts belong to the contracts repository.
- SDK and runtime implementation belong to the SDK and platform kernel repositories.
- Product compatibility declarations belong to the product repository that implements them.
- Roadmap, milestones, backlog, and lifecycle planning belong to the roadmap repository.
