<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 2.0.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Specification
-->

# SMRITI Product Studio & PIM Engine Specification (PROD v2.0)

**Status:** FROZEN — Enterprise Product Information Management Specification v2.0 (2026-08-04)
**Scope:** Single Source of Truth Product Catalog, Product Health Score, Governed Lifecycle, & Kernel Connectors

---

## 1. Universal Product Single Source of Truth Architecture

`Product Studio v2.0` acts as the single source of truth for product data across the SMRITI Digital Commerce Platform. All transactional, operational, and channel capabilities consume `Product Studio v2.0` through immutable platform kernels:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SMRITI PRODUCT STUDIO V2.0 (SINGLE SOURCE OF TRUTH PIM ENGINE)          │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │                            PRODUCT STUDIO                              │
 │                                  │                                     │
 │       ┌──────────────────────────┼──────────────────────────┐          │
 │       │                          │                          │          │
 │   Purchase                  Sales / POS                 Inventory      │
 │       │                          │                          │          │
 │       └────────────────── SDK Document Kernel ──────────────┘          │
 │                                  │                                     │
 │                        SBPK Printing Kernel                            │
 │                                  │                                     │
 │                        SPPK Pricing Kernel                             │
 │                                  │                                     │
 │                        SIK Integration Kernel                          │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Product Governed Lifecycle State Machine

Product catalog lifecycle transitions are governed strictly via **SDK Document Kernel (`SDK v1.0`)** and **Universal Workflow Registry (`UWR`)**:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ PRODUCT GOVERNED LIFECYCLE STATE MACHINE                               │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │   ┌───────────┐    Submit    ┌──────────────┐   Approve   ┌──────────┐ │
 │   │   DRAFT   ├─────────────►│ UNDER REVIEW ├────────────►│ APPROVED │ │
 │   └─────┬─────┘              └──────┬───────┘             └────┬─────┘ │
 │         │                           │                          │       │
 │         │ Cancel                    │ Reject                   │       │
 │         ▼                           ▼                          │ Activate
 │   ┌───────────┐              ┌──────────────┐                  ▼       │
 │   │ CANCELLED │              │   REJECTED   │             ┌──────────┐ │
 │   └───────────┘              └──────────────┘             │  ACTIVE  │ │
 │                                                           └────┬─────┘ │
 │                                                                │       │
 │                                                 Season / EOL   ▼       │
 │                                                           ┌──────────┐ │
 │                                                           │ SEASONAL │ │
 │                                                           └────┬─────┘ │
 │                                                                │       │
 │                                                                ▼       │
 │                                                           ┌──────────┐ │
 │                                                           │DISCONTINUED│
 │                                                           └────┬─────┘ │
 │                                                                │       │
 │                                                                ▼       │
 │                                                           ┌──────────┐ │
 │                                                           │ ARCHIVED │ │
 │                                                           └──────────┘ │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Product Health Score & Governance Index

Product Studio v2.0 calculates an automated **Product Health Score (0–100%)** per SKU to enforce catalog completeness before active billing deployment:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ PRODUCT HEALTH SCORE EVALUATION ALGORITHM (100% MAXIMUM SCORE)          │
 ├────────────────────────────────────────────────────────────────────────┤
 │ • Identity & Classification (Name, HSN Code, Category, Brand) ── [20%] │
 │ • Primary Barcode & SKU Code Verification                     ── [15%] │
 │ • Multi-Price Matrix (MRP, Cost, Retail, Wholesale Prices)    ── [15%] │
 │ • Multi-Supplier Assignment & Rate Matrix                     ── [10%] │
 │ • Primary & High-Res Product Media Asset                      ── [15%] │
 │ • GST Tax Rate & Statutory Compliance Badging                 ── [10%] │
 │ • Packaging Hierarchy & Base UOM Ratios                       ── [10%] │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Target Health Threshold: ≥ 85% Required for Active Channel Distribution│
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Product Relationship Matrix

Product Studio v2.0 maintains structured product relationships across 8 relational dimensions:
1. **Cross-Sell:** Suggested complementary items at counter checkout.
2. **Up-Sell:** Higher margin premium tier alternatives.
3. **Replacement / Substitute:** Equivalent SKU for out-of-stock items.
4. **Accessory:** Required attachments or peripherals.
5. **Bundle Component:** Composite SKU parts for Kitting/BOM assembly.
6. **Parent Product:** Master style SKU for variant children.
7. **Child Variant:** Specific Color/Size/Fit SKU.
8. **Alternative Item:** Industry-compatible SKU equivalent.
