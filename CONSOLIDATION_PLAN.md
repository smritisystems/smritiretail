# Architecture Docs Consolidation Plan
Date: 2026-08-30
From: 55 files → Target: ~10-12 files

## Consolidation Strategy (File-by-file decisions)

### CONTROL_PLANE Cluster (3 files)
- **KEEP**: CONTROL_PLANE_2_3.md (v2.0 Audit Complete - most comprehensive and current)
- **DELETE**: CONTROL_PLANE.md (v1.0 Migration Plan - superseded)
- **DELETE**: CONTROL_PLANE_2.md (v1.0 Boundary Spec - subsumed in v2.0)

### COMPANY Cluster (7 files: COMPANY.md, COMPANY_001.md, COMPANY_CONTROL.md, COMPANY_CONTROL_2.md, COMPANY_DATABASE.md, COMPANY_DATABASE_2.md, COMP001.md)
- **KEEP**: COMPANY_DATABASE.md (defines 3-character standard with examples)
- **RENAME to**: COMPANY.md (consolidate under single name)
- **DELETE**: COMPANY_001.md, COMPANY_CONTROL.md, COMPANY_CONTROL_2.md, COMPANY_DATABASE_2.md, COMP001.md

### MULTI_COMPANY Cluster (2 files: MULTI_COMPANY.md, MULTI_COMPANY_2.md)
- **KEEP**: MULTI_COMPANY_2.md (marked as "CANONICAL SPECIFICATION" at top)
- **DELETE**: MULTI_COMPANY.md (marked "SUPERSEDED BY CANONICAL SPECIFICATION")

### PRODUCT_IDENTITY Cluster (13 files)
- **KEEP**: PRODUCT_IDENTITY.md (v1 base)
- **DELETE**: PRODUCT_IDENTITY_2.md through PRODUCT_IDENTITY_13.md (numbered versions suggest iterations)
- **Action**: Read PRODUCT_IDENTITY.md to verify it's current before deleting others

### PLATFORM Cluster (2 files: PLATFORM.md, PLATFORM_2.md)
- **KEEP**: PLATFORM_2.md (v2 likely more current than v1)
- **DELETE**: PLATFORM.md (v1)

### Other Singletons to KEEP (~25 files)
- BLUEPRINT_PENDING.md
- BUSINESS_BEHAVIOR.md
- CHANGELOG.md
- CONFIGURATION.md
- COST.md
- CRM_LOYALTY_SICE.md
- CUSTOMER_360.md
- DATABASE_ROUTING.md
- DEVELOPMENT.md
- FIORI_LIGHT.md
- FRONTEND_VITE.md
- FULFILLMENT.md
- GLOSSARY.md
- GOLIVE_ACCEPTANCE.md
- ITEM_MASTER.md
- OFFLINE_CONFLICT.md
- PLATFORM_ADAPTER.md
- PROMOTION.md
- PROMOTIONS_GROWTH.md
- PSV_ARCHITECTURE.md
- README.md
- REAL_WORLD.md
- REPORTING.md
- REPORT_EXECUTION.md
- SHOPER9_MIGRATION_BLUEPRINT.md
- SMRITISYS.md
- TAX_INVOICE.md
- UI_UX_CONTROL.md

## Expected Final Count
- CONTROL_PLANE consolidation: 3 files → 1 file (save 2)
- COMPANY consolidation: 7 files → 1 file (save 6)
- MULTI_COMPANY consolidation: 2 files → 1 file (save 1)
- PRODUCT_IDENTITY consolidation: 13 files → 1 file (save 12)
- PLATFORM consolidation: 2 files → 1 file (save 1)
- Total Savings: 23 files
- **New Count: 55 - 23 = 32 files**

Note: Still more than target ~10. Need to review if any of the singleton files should be consolidated further based on actual content review.
