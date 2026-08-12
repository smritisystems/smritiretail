# Masterbook: Multi-Company Reporting Consolidation & Fan-Out Engine

**Document ID:** `MBOOK-ARCH-CON-001`  
**Classification:** Architecture Specification (Level-2 Platform Contract)  
**Status:** FROZEN — v1.0 (2026-08-12)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Scope:** Multi-Tenant Reporting Fan-Out & Multi-Company Financial Consolidation  

---

## 1. Executive Summary

The **Multi-Company Consolidation & Fan-Out Engine** (`MultiCompanyConsolidationService`) provides cross-company reporting capability across physically isolated company databases (`smriti_company_{company_code}`).

In strict compliance with **PROD-004 (Environment & Tenant Isolation)** and **SWP-001 (Single Workspace Principle)**:
- Reporting fan-out operates 100% **read-only** against target physical company databases.
- Database connections are resolved server-side against Control DB assignment registry metadata (`control_company_databases` + `control_user_company_assignments`).
- Multi-company queries execute concurrently via `asyncio.gather`, injecting `company_code` provenance into aggregate in-memory result sets without writing to disk or combining databases at the SQL layer.

---

## 2. Core Architecture & Execution Sequence

```text
               ┌─────────────────────────────────┐
               │    CONTROL DATABASE REGISTRY    │
               │         smriti_control          │
               └────────────────┬────────────────┘
                                │ Validate User Access &
                                │ Fetch Target DB Credentials
                                ▼
               ┌─────────────────────────────────┐
               │ MultiCompanyConsolidationService │
               └────────────────┬────────────────┘
                                │ Concurrent Async Fan-Out
                                │ (asyncio.gather)
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
    ┌─────────────────┐┌─────────────────┐┌─────────────────┐
    │  COMPANY DB A   ││  COMPANY DB B   ││  COMPANY DB C   │
    │smriti_company_a ││smriti_company_b ││smriti_company_c │
    └────────┬────────┘└────────┬────────┘└────────┬────────┘
             │                  │                  │
             └──────────────────┼──────────────────┘
                                │ In-Memory Aggregation
                                ▼
               ┌─────────────────────────────────┐
               │ FinancialConsolidationEngine    │
               │ (Inter-Company Elimination)     │
               └────────────────┬────────────────┘
                                │
                                ▼
              Group Consolidated Statement (JSON)
```

---

## 3. Mandatory Safeguards

1. **Strict User Authorization Check (MANDATORY P0):** Every target company code in a fan-out request MUST be verified against `ControlDatabaseRegistryService.verify_user_company_access(control_db, user_id, company_code)`. Unassigned company codes MUST be rejected with HTTP 403.
2. **Read-Only Transaction Isolation:** Consolidation reporting sessions MUST be executed as read-only transactions with explicit session closure (`finally: await session.close()`).
3. **Inter-Company Elimination:** Group financial consolidation MUST apply `FinancialConsolidationEngine.consolidate()` to cancel inter-company balances per Ind AS 110 / AS-21.
