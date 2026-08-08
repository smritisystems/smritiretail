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

# SMRITI Retail OS Implementation Roadmap v4.1

This document defines the controlled, operational-masters-first implementation sequence for SMRITI Retail OS under the frozen governance baseline.

## Purpose
- Provide a clear, repeatable execution roadmap for all 22 phases of SMRITI Retail OS.
- Prioritize **operational masters** after Foundation Platform to eliminate data rework.
- Establish strict dependency order for lookup entities before building Item Master and Transaction modules.
- Enforce Foundation Platform engine reuse across Customer, Supplier, and enterprise entities.
- Enforce **Gate 9A (Data Migration & Opening Stock Validation)** prior to live transaction execution.
- Guide AI agents and developers on architectural freezes and phase completion criteria.

---

## Governance Baseline
Implementation work must obey the following hierarchy:
1. `docs/governance/IMPLEMENTATION_GATE.md`
2. `docs/governance/GOVERNANCE_FREEZE_CHECKLIST.md`
3. `docs/architecture/decisions/ADR-002-SMRITI-METADATA-ARCHITECTURE.md`
4. `docs/architecture/ROADMAP_V4_SPECIFICATION.md`
5. `docs/governance/METADATA_ARCHITECTURE_EVIDENCE_LEDGER.md`
6. `docs/developer_guide/AI_IMPLEMENTATION_STANDARD.md`

Governance Status:
- Version: 4.1
- Status: ACTIVE / FROZEN BASELINE

---

## Master Development Roadmap Matrix (Phases 0–21)

| Phase | Module                                                                          | Priority | Status              |
| :---: | ------------------------------------------------------------------------------- | :------: | ------------------- |
| 0     | ✅ Foundation Platform (Identity, Address, Contact, Bank, Settings, Audit, etc.) |   ⭐⭐⭐⭐⭐  | Freeze              |
| 1     | ✅ Company Information                                                           |   ⭐⭐⭐⭐⭐  | Build               |
| 2     | Organization & Branch                                                           |   ⭐⭐⭐⭐⭐  | Next                |
| 3     | Users, Roles & Security                                                         |   ⭐⭐⭐⭐⭐  | Next                |
| 4     | Financial Year & Accounting Periods                                             |   ⭐⭐⭐⭐⭐  | Next                |
| 5     | Number Series & Document Configuration                                          |   ⭐⭐⭐⭐⭐  | Next                |
| 6     | Geography Master (Country, State, District, City, PIN, Timezone, Language)       |   ⭐⭐⭐⭐☆  | Next                |
| 7     | Currency Engine & Exchange Rates (Currency, Exchange Rates, Precision)          |   ⭐⭐⭐⭐☆  | Next                |
| 8     | Tax Foundation (GST, HSN, SAC, Tax Templates)                                   |   ⭐⭐⭐⭐⭐  | Next                |
| 9     | UOM & UOM Conversion                                                            |   ⭐⭐⭐⭐⭐  | Next                |
| 10    | Warehouse & Storage Locations                                                   |   ⭐⭐⭐⭐⭐  | Next                |
| 11    | Product Classification (Business Vertical → Dept → Sec → Cat → SubCat → Brand)  |   ⭐⭐⭐⭐⭐  | Next                |
| 12    | Supplier                                                                        |   ⭐⭐⭐⭐⭐  | Next                |
| 13    | Customer                                                                        |   ⭐⭐⭐⭐⭐  | Next                |
| 14    | Price Lists & Pricing Rules                                                     |   ⭐⭐⭐⭐⭐  | Before Item         |
| 15    | Item Master                                                                     |   ⭐⭐⭐⭐⭐  | Freeze (Gate 9)     |
| 16    | Master Data Migration, Opening Balances & Stock Validation                      |   ⭐⭐⭐⭐⭐  | Freeze (Gate 9A)    |
| 17    | Purchase                                                                        |   ⭐⭐⭐⭐⭐  | Transaction         |
| 18    | Inventory                                                                       |   ⭐⭐⭐⭐⭐  | Transaction         |
| 19    | POS / Billing                                                                   |   ⭐⭐⭐⭐⭐  | Transaction         |
| 20    | Sales                                                                           |   ⭐⭐⭐⭐⭐  | Transaction         |
| 21    | Accounting                                                                      |   ⭐⭐⭐⭐⭐  | Final               |

---

## Strategic Architectural Rules & Hierarchies

### 1. Price Management Placement (Phase 14)
Price Management is positioned **strictly before Item Master** to ensure Item Master references pre-configured price lists and rules rather than embedding ad-hoc pricing metadata.

```
Price Lists ──► Price Rules ──► Discount Rules ──► Tax Templates ──► Item Master
```

### 2. Product Classification Hierarchy (Phase 11)
Full 8-level product hierarchy supporting multi-vertical enterprise retail (Apparel, Footwear, FMCG, Lifestyle, Supermarkets):

```
Business Vertical
  └─► Department
        └─► Section
              └─► Category
                    └─► Sub Category
                          └─► Brand
                                └─► Collection
                                      └─► Season
```

### 3. Warehouse & Storage Location Hierarchy (Phase 10)
Granular 6-level storage architecture catering to micro-retail stores up to enterprise distribution warehouses:

```
Company
  └─► Branch
        └─► Warehouse
              └─► Location
                    └─► Rack
                          └─► Bin
```

### 4. Enterprise Engine Standardization (Supplier & Customer)
Supplier (Phase 12) and Customer (Phase 13) masters consume Foundation Platform engines exclusively. No custom address, contact, or bank table duplication is permitted:

```
[ Supplier / Customer Master ]
           │
           ├──► Address Engine (Foundation)
           ├──► Contact Engine (Foundation)
           ├──► Bank Engine (Foundation)
           ├──► Communication Engine (Foundation)
           ├──► Document Engine (Foundation)
           └──► Audit Engine (Foundation)
```

### 5. Item Master Dependency Prerequisites (Phase 15)
Item Master creation is prohibited until all precursor lookup entities exist:
- Company & Branch
- Warehouse & Storage Locations
- Business Vertical, Department, Section, Category, Sub Category, Brand, Collection, Season
- UOM & UOM Conversion
- GST, HSN, SAC & Tax Templates
- Price Lists & Pricing Rules
- Supplier Master
- Geography & Currency Engines
- Number Series

---

## Transactional Pipeline Architecture (Phases 17–21)

Once Item Master (Phase 15) and Master Data Migration / Opening Stock Validation (Phase 16) are complete and verified, transactional execution follows this exact operational flow:

```
Purchase Requisition
        ↓
Purchase Order
        ↓
Goods Receipt (GRN)
        ↓
Purchase Invoice
        ↓
Stock Ledger
        ↓
Inventory Management
        ↓
POS / Billing & Sales
        ↓
Sales Return
        ↓
Accounting Ledger & General Ledger (GL)
```

---

## Sequential Architecture Freeze Strategy

Architecture and schema must be frozen step-by-step in the following order:

1. ✅ Foundation Platform (Gate 0 - Frozen)
2. Company Information (Gate 1)
3. Organization & Branch (Gate 2)
4. Security (Users, Roles, Permissions - Gate 3)
5. Financial & Numbering (Gate 4)
6. Common Masters (Geography, Currency, Tax, UOM - Gate 5)
7. Warehouse & Product Classification (Gate 6)
8. Supplier & Customer (Gate 7)
9. Price Management (Gate 8)
10. **Item Master** (Gate 9 - Freeze after completion)
11. **Master Data Migration & Opening Stock Validation** (Gate 9A - Freeze after verification)
12. Transaction Modules (Gate 10 - Phases 17–21)

---

## Module Delivery & Governance Checklist

Every implementation phase must satisfy:
1. **Reuse Analysis**: 5-step search chain (`Search Project` ──► `Find Existing` ──► `Reuse` ──► `Extend` ──► `Create`).
2. **Verification Evidence**:
   - `git diff` output per file modified/created (`git add -N` for new untracked files).
   - Terminal command and execution logs.
   - Validator / Linter output (`validate_tokens.py`, `pytest`, `tsc`).
   - Explicit 4-state status (`Done`, `Failed`, `Partially Verified`, `Unverified`).
   - Labeled sections: Evidence, Interpretation, Recommendation.
