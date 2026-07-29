<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 7.1.0
  Created      : 2026-07-28
  Modified     : 2026-07-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# SMRITI Phase 6 Enterprise Modules Walkthrough (v7.1.0)

## Task 6-1: AI Advisory Settings & Key Registry (CR-2026-1761, Rule AOP-001)
- `backend/app/core/ai_advisory_config.py` — AiAdvisoryConfigEngine
- Default: `AI_ENABLED=false`. Requires `AI_ADMIN` RBAC scope to enable. API key is obscured on return.

## Task 6-2: BOM Kitting Assembly Engine (CR-2026-1762)
- `backend/app/core/bom_kitting.py` — BillOfMaterialsEngine
- Registers Bill of Materials, audits component stock, and atomically executes kitting work orders.

## Task 6-3: Financial Consolidation Engine (CR-2026-1763)
- `backend/app/core/financial_consolidation.py` — FinancialConsolidationEngine
- Consolidates parent + subsidiary Trial Balances with Ind AS 110 inter-company AR/AP elimination.

## Task 6-4: Data Archival Engine (CR-2026-1764, AOP-004)
- `backend/app/core/data_archival.py` — DataArchivalEngine
- Dry-run manifests, blocked-dependency protection, FK-safe cold-storage JSON export.
