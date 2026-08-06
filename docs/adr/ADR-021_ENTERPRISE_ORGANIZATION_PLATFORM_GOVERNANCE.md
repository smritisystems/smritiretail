# ADR-021: Enterprise Organization Platform Governance & Hierarchy Evolution

**Status:** APPROVED (FROZEN Baseline v1.4 / Additive Roadmap v2.x)
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)
**Date:** 2026-08-06
**Standard:** Level 1 SMRITI Architecture Constitution (AFR-001, AFR-002, PBC-001)

---

## 1. Context & Executive Assessment

SMRITI Retail OS contains a multi-tenant, multi-company relational architecture. Following a formal architectural audit, the core foundation achieves **9.6 / 10 Enterprise Architecture Readiness** with **~90–95% capability reuse** across existing baseline models.

In accordance with **Rule 15 – Promote Before Create (PBC-001)**, existing core models (`Tenant`, `Organization`, `Company`, `CompanyTaxProfile`, `CompanyFinancialYear`, `Warehouse`, `SMRITIUserAssignment`) satisfy the majority of enterprise multi-entity requirements.

The baseline architecture is formally frozen (`v1.4`), and future multi-entity scalability will evolve incrementally via optional additive entities (`BusinessUnit`, `Region`) without introducing breaking changes or database redesigns.

---

## 2. Target Enterprise Hierarchy

```text
Tenant [tenants / tenant_settings / tenant_provision_profiles]
    │
Organization [organizations]
    │
Business Unit [business_units]             ← Optional Additive (v2.x)
    │
Company [companies] (Legal Entity)
    ├── CompanyTaxProfile [company_tax_profiles]
    └── CompanyFinancialYear [company_financial_years]
    │
Region [regions]                           ← Optional Additive (v2.x)
    │
Branch [branches]
    ├── Warehouse [warehouses]             ← Independent logistics entity
    └── Store [stores]
            └── POS Terminal [pos_terminals]
```

---

## 3. Governance Status & Classification Matrix

| Subsystem / Layer | Current Status | Architecture Governance Recommendation | Implementation File / Blueprint |
|---|---|---|---|
| **Tenant Architecture** | ✅ Complete | FROZEN | `backend/app/models/tenant.py` (`Tenant`, `TenantSettings`) |
| **Organization Layer** | ✅ Complete | FROZEN | `backend/app/models/company_master.py` (`Organization`) |
| **Company Legal Layer** | ✅ Complete | FROZEN | `backend/app/models/company.py` (`Company`) |
| **Tax Profile & Financial Year** | ✅ Complete | FROZEN | `backend/app/models/company_master.py` (`CompanyTaxProfile`, `CompanyFinancialYear`) |
| **Warehouse Architecture** | ✅ Complete | FROZEN | `backend/app/models/wms.py` (`Warehouse` — independent WMS) |
| **User & Role Assignment** | ✅ Complete | FROZEN | `backend/app/models/user_assignment.py` (`SMRITIUserAssignment`) |
| **Business Unit Layer** | 🟡 Planned | Additive v2.x Extension | Optional division layer between `Organization` & `Company` |
| **Region Layer** | 🟡 Planned | Additive v2.x Extension | Optional regional layer between `Company` & `Branch` |
| **Organization Service** | 🟡 Planned | Additive Orchestration Layer | Centralized `OrganizationService` facade |
| **REST Resource APIs** | 🟡 Planned | Additive Resource Endpoints | `/organizations`, `/companies`, `/branches`, `/stores`, `/warehouses` |

---

## 4. Architectural Directives

1. **Zero Breaking Changes:** Existing Level-1 API contracts (`/company/setup`, `/system/company/list`, `SPK.navigation`) remain 100% backward compatible.
2. **Optional Entity Policy:** `BusinessUnit` and `Region` layers shall remain strictly optional. Single-store and medium retailers operate without creating dummy division/region rows.
3. **Warehouse Independence:** Warehouses remain independent logistics entities linked by `company_id`, serving multiple stores/branches.
4. **Promote Before Create:** Future organization logic MUST route through the centralized `OrganizationService` and UPR metadata facades rather than creating procedural code branches in UI components.
