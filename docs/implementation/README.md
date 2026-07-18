<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-07-11
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Implementation Plans Index

This directory contains formal, version-controlled implementation plans for SMRITI Retail OS modules and core system enhancements.

| Date | Plan Version | Module / Topic | Target File(s) | Status | Related Walkthrough |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-07-10 | v2.1.1 | [Sales Studio Expansion](./sales/Sales_Studio_Expansion_Plan_v2.1.1.md) \| [Consolidated](./CONSOLIDATED_PLANS.md#2026-07-10-v211--sales-studio-expansion) | `/src/components/SalesStudioTab.tsx` | Completed | [Walkthrough](../walkthrough/sales/Sales_Studio_Expansion_Walkthrough_v2.1.1.md) |
| 2026-07-11 | v2.1.2 | [CRM, Auditing, and POS Upgrades](./sales/CRM_Audit_And_POS_Upgrades_Plan_v2.1.2.md) \| [Consolidated](./CONSOLIDATED_PLANS.md#2026-07-11-v212--crm-auditing-and-pos-upgrades) | `/server.ts`, `/src/App.tsx`, `/src/services/customerStore.ts`, `/src/components/AdvancedBillingEngine.tsx`, `/src/components/PosTerminalTab.tsx` | Completed | [Walkthrough](../walkthrough/sales/Sales_CRM_Audit_And_POS_Upgrades_Walkthrough_v2.1.2.md) |
| 2026-07-11 | v2.1.4 | [PostgreSQL Standalone Modular Architecture](./pos/POS_DeepReview_Fixes_Plan_v2.1.3.md) \| [Consolidated](./CONSOLIDATED_PLANS.md#2026-07-11-v214--postgresql-standalone-modular-architecture) | `/src/db/pool.ts`, `/src/db/schema.sql`, `/src/db/init.ts`, `/server.ts` | Completed | [Walkthrough](../walkthrough/db/PostgreSQL_Initialization_Walkthrough_v2.1.4.md) |
| 2026-07-11 | v3.0.0 | [Clean Architecture & Sync Engine](./foundation/Clean_Architecture_And_Offline_First_Plan_v3.0.0.md) \| [Consolidated](./CONSOLIDATED_PLANS.md#2026-07-11-v300--clean-architecture--offline-first-sync-engine) | `/src/core/`, `/src/bootstrap/`, `/src/db/` | Completed | [Walkthrough](../walkthrough/foundation/Clean_Architecture_And_Offline_First_Walkthrough_v3.0.0.md) |
| 2026-07-11 | v3.1.0 | [Docker Orchestration & Auto-Startup](./foundation/Clean_Architecture_And_Offline_First_Plan_v3.0.0.md) \| [Consolidated](./CONSOLIDATED_PLANS.md#2026-07-11-v310--docker-orchestration--automatic-startup) | `/Dockerfile`, `/docker-compose.yml`, `/startup.bat` | Completed | [Walkthrough](../walkthrough/devops/Docker_Orchestration_And_Automatic_Startup_Walkthrough_v3.1.0.md) |
| 2026-07-11 | v3.3.0 | [Project Header Standardization](./foundation/Project_Header_Standardization_Plan_v3.3.0.md) \| [Consolidated](./CONSOLIDATED_PLANS.md#2026-07-11-v330--project-header-standardization) | Entire Repository | Completed | [Walkthrough](../walkthrough/foundation/Project_Header_Standardization_Walkthrough_v3.3.0.md) |
| 2026-07-11 | v3.4.0 | [About SMRITI Retail OS](./foundation/About_Module_Implementation_Plan_v3.4.0.md) \| [Consolidated](./CONSOLIDATED_PLANS.md#2026-07-11-v340--about-smriti-retail-os) | `/server.ts`, `/src/components/AboutSmritiTab.tsx`, `/package.json`, `/src/tests/about.test.ts` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_About_Module_Walkthrough_v3.4.0.md) |
| 2026-07-11 | v3.5.0 | [SMRITI Development Intelligence Center](./foundation/Dev_Tracker_Implementation_Plan_v3.5.0.md) \| [Consolidated](./CONSOLIDATED_PLANS.md#2026-07-11-v350--smriti-development-intelligence-center-sdic) | `/src/modules/dev_tracker/` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_Dev_Tracker_Walkthrough_v3.5.0.md) |
| 2026-07-11 | v3.6.0 | [SMRITI FastAPI Core Backend](./foundation/SMRITI_FastAPI_Core_Implementation_Plan_v3.6.0.md) \| [Consolidated](./CONSOLIDATED_PLANS.md#2026-07-11-v360--smriti-fastapi-core-backend) | `/backend/` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_FastAPI_Core_Walkthrough_v3.6.0.md) |
| 2026-07-11 | v3.7.0 | [SMRITI Database & Domain Layer](./foundation/Database_Foundation_And_Domain_Layer_Plan_v3.7.0.md) | `/backend/alembic/`, `/backend/app/models/`, `/backend/app/repositories/`, `/backend/app/schemas/`, `/backend/app/services/` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_Database_Foundation_And_Domain_Layer_Walkthrough_v3.7.0.md) |
| 2026-07-11 | v3.8.0 | [Database REST API & Multi-Tenant Enforcement](./foundation/Database_API_And_Multi_Tenant_Enforcement_Plan_v3.8.0.md) | `/backend/app/api/v1/`, `/backend/app/models/tenant.py`, `/backend/app/repositories/base.py` | Draft | - |
| 2026-07-12 | v3.15.0 | [Monolith Refactoring & Database Unification](./foundation/Refactoring_Monolith_And_Database_Unification_Plan_v3.15.0.md) | `/server.ts`, `/src/state/store.ts`, `/src/lib/helpers.ts`, `/src/routes/` | Completed | [Monolith Splitting](../walkthrough/foundation/Foundation_Monolith_Refactoring_And_Route_Splitting_v3.15.0.md) \| [DB Unification](../walkthrough/db/DB_Unification_And_Security_Hotfix_v3.15.0.md) \| [Security Hardening](../walkthrough/foundation/Foundation_Security_Hardening_And_FastAPI_Integration_v3.15.0.md) |
| 2026-07-12 | v3.15.0 | [Reports Module Migration & Governance Update](./db/FastAPI_Reports_Migration_And_Governance_Update_Plan_v3.15.0.md) | `/.agents/AGENTS.md`, `/src/components/QuickReportsWidget.tsx`, `/src/components/ReportDesignerTab.tsx` | Completed | [Walkthrough](../walkthrough/reports/Reports_FastAPI_Reports_Migration_v3.15.0.md) |
| 2026-07-12 | v3.15.0 | [Inventory & Products Migration](./foundation/Inventory_Products_Migration_Plan_v3.15.0.md) | `/backend/app/models/inventory.py`, `/backend/app/api/v1/inventory.py`, `/src/components/ItemMasterTab.tsx`, `/src/components/StockLedgerTab.tsx` | Completed | [Walkthrough](../walkthrough/inventory/Inventory_Products_Migration_v3.15.0.md) |
| 2026-07-12 | v3.16.0 | [Tier 4 Migration, Form Standardization & Tier 8 Roadmap](./foundation/Tier4_Backend_Migration_Plan.md) | `/backend/`, `/server.ts`, `/src/routes/`, `/src/utils/`, `/src/constants/` | Draft | - |
| 2026-07-12 | v3.16.0 | [SMRITI Government Integration Platform (SGIP) - Product Constitution](./foundation/SGIP_PRODUCT_CONSTITUTION_v1.0.md) | Entire SGIP Framework Boundaries | Completed | - |
| 2026-07-12 | v3.16.0 | [SMRITI Government Integration Platform (SGIP)](./foundation/SGIP_IMPLEMENTATION_PLAN_v1.1.md) | `/backend/app/compliance/` | Draft | - |
| 2026-07-12 | v3.16.0 | [SMRITI Error Experience Framework (SEEF) v1.0](./foundation/SMRITI_Error_Experience_Framework_v1.0_Plan.md) | `/backend/app/core/error_handlers.py`, `/backend/app/templates/errors/`, `/backend/app/main.py` | Draft | - |
| 2026-07-13 | v3.16.0 | [FastAPI v13 to v14 Migration](./foundation/FastAPI_v13_v14_Migration_Plan.md) | `/backend/app/api/v1/exchange.py`, `/backend/app/schemas/user.py`, `/src/routes/` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_FastAPI_v13_v14_Migration_Walkthrough_v3.16.0.md) | - |
| 2026-07-13 | v3.16.0 | [Dynamic Item Master & Configurable Product Attributes](./foundation/Dynamic_Item_Master_Implementation_Plan_v3.16.0.md) | `/backend/app/models/attributes.py`, `/src/components/ItemMasterTab.tsx` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_Dynamic_Item_Master_v3.16.0.md) |
| 2026-07-13 | v3.16.0 | [Enterprise Label Printing Framework (ELPF)](./foundation/Enterprise_Label_Printing_Framework_Plan_v3.16.0.md) | `/backend/app/models/barcode.py`, `/src/components/LabelPrintingSection.tsx` | Draft | - |
| 2026-07-13 | v3.16.0 | [SMRITIDocker Repository Creation](./foundation/SMRITIDocker_Repo_Creation_Plan_v3.16.0.md) | `.dockerignore`, `Dockerfile`, `docker-compose.yml`, `startup.bat`, `startup.sh`, `backend/Dockerfile`, `backend/entrypoint.sh` | Completed | [Walkthrough](../walkthrough/devops/Devops_SMRITIDocker_Repository_Creation_v3.16.0.md) |
| 2026-07-13 | v3.16.0 | [One-Command Installation Scripts](./foundation/One_Command_Installation_Scripts_Plan_v3.16.0.md) | `install.ps1`, `install.sh` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_One_Command_Installation_Scripts_v3.16.0.md) |
| 2026-07-13 | v3.16.0 | [Barcode PRN Dynamic Field Mapping](./foundation/Barcode_PRN_Dynamic_Field_Mapping_Plan_v3.16.0.md) | `backend/app/api/v1/barcode.py`, `src/components/LabelPrintingSection.tsx` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_Barcode_PRN_Dynamic_Field_Mapping_v3.16.0.md) |
| 2026-07-13 | v3.16.0 | [Report User Role & Audit Logging](./foundation/Report_User_Role_Implementation_Plan_v3.16.0.md) | `/backend/app/models/auth.py`, `/server.ts`, `/src/routes/system.ts`, `/src/components/` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_Report_User_Role_And_Audit_Logging_v3.16.0.md) |
| 2026-07-13 | v3.16.0 | [Report User Role & Auditing Expansion](./foundation/Report_User_Role_Expansion_Plan_v3.16.0.md) | `/src/App.tsx`, `/src/components/` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_Report_User_Role_Expansion_v3.16.0.md) |
| 2026-07-13 | v3.16.0 | [CRM, Loyalty, and Customer Master Decoupling](./foundation/CRM_Loyalty_CustomerMaster_Split_Plan_v3.16.0.md) | `/src/App.tsx`, `/src/layout_engine/`, `/src/components/` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_CRM_Loyalty_CustomerMaster_Split_v3.16.0.md) |
| 2026-07-13 | v3.16.0 | [Excel Grid Header Paste Mapping](./foundation/Excel_Grid_Header_Paste_Mapping_Plan_v3.16.0.md) | `/src/components/ExcelGridEntrySection.tsx` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_Excel_Grid_Header_Paste_Mapping_v3.16.0.md) |
| 2026-07-13 | v1.0.0 | [SMRITI Product Image Framework (SPIF)](./foundation/SMRITI_Product_Image_Framework_Plan_v1.0.md) | `/backend/app/`, `/src/components/` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_SPIF_v1.0_Walkthrough.md) |
| 2026-07-13 | v3.16.0 | [SMRITI Master Framework — Phase A](./foundation/SMRITI_Master_Framework_Phase_A_Plan_v3.16.0.md) | `/backend/alembic/versions/a3e4b5c6d7e8_add_smriti_master_framework_tables.py` | In Progress | [Walkthrough](../walkthrough/foundation/SMRITI_Master_Framework_Phase_A_Walkthrough_v3.16.0.md) |
| 2026-07-13 | v3.16.0 | [SMRITI Master Framework — Phase F.3](./foundation/SMRITI_Master_Framework_Phase_F_3_Plan_v3.16.0.md) | `/backend/app/models/barcode.py`, `/src/routes/terms.ts`, `/src/routes/barcode.ts`, `/src/routes/system.ts` | Completed | [Walkthrough](../walkthrough/foundation/SMRITI_Master_Framework_Phase_F_3_Walkthrough_v3.16.0.md) |
| 2026-07-14 | v3.17.0 | [SMRITI Master Data Consolidation](./foundation/SMRITI_Master_Data_Consolidation_Plan_v3.17.0.md) | `/backend/`, `/src/components/MasterManagementTab.tsx`, `/server.ts` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_Master_Data_Consolidation_v3.17.0.md) |
| 2026-07-17 | v3.18.0 | [Modular Microservices Roadmap](./PLATFORM_MICROSERVICES_ROADMAP.md) | `/docs/architecture/PLATFORM_MICROSERVICES_ROADMAP.md` | Draft | — |
| 2026-07-18 | v3.23.0 | [Test Database Isolation & Onboarding Fixes](./foundation/Test_Database_Isolation_Plan_v3.23.0.md) | `/backend/app/tests/conftest.py`, `/backend/app/api/v1/system.py`, `/backend/app/tests/test_api_v1_migration.py` | Completed | [Walkthrough](../walkthrough/foundation/Foundation_Test_Database_Isolation_And_Setup_Fixes_v3.17.1.md) |
| 2026-07-18 | v3.24.0 | [Role & Menu Security Engine (SSACF)](./foundation/Role_And_Menu_Security_Engine_v3.24.0.md) | `/backend/app/models/security.py`, `/backend/app/api/v1/security.py`, `/backend/app/db/seed.py` | Completed | [Walkthrough](../walkthrough/foundation/Security_SSACF_Role_And_Menu_Engine_v3.24.0.md) |
| 2026-07-18 | v3.25.0 | [SSACF Phase 2 — Cache Abstraction, Cycle Detection & Scoped Permissions](./foundation/SSACF_Phase2_Roadmap_v3.25.0.md) | TBD | Draft | — |
| 2026-07-19 | v3.28.0 | [Consignment & Sale on Approval GST Engine Refinement](./foundation/Consignment_Approval_GST_Engine_Plan_v3.28.0.md) | `/backend/app/models/dispatch.py`, `/backend/app/services/dispatch_gst.py` | Draft | — |
| 2026-07-19 | v3.29.0 | [SMRITI Regulatory Engine (SRE)](./foundation/SRE_Engine_Implementation_Plan_v3.29.0.md) | `/backend/app/models/sre.py`, `/backend/app/services/sre/sre_service.py` | Draft | — |









