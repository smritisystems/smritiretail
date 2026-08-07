# ADR-024: Intelligence Pack Development Standard (IPDS-001) & 8-Level Maturity Model

**Status:** FROZEN — Level 1 Platform Architecture Standard v1.0 (2026-08-07)  
**Standard:** IPDS-001 through IPDS-008  
**Parent:** ADR-023 (SMRITI Intelligence Engine v1.0 Architecture Freeze)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Executive Summary

ADR-024 establishes the **Intelligence Pack Development Standard (IPDS-001)** and the **8-Level Pack Maturity Model**. All platform domain packs (Security, Retail, Performance, Accessibility, Knowledge) MUST implement this uniform contract. No domain pack may introduce custom execution pipelines, non-standard lifecycle methods, or inline business logic inside the SIE core engine.

---

## 2. Mandatory Domain Pack Contract (IPDS-001)

Every Domain Pack MUST be declared as a self-contained module implementing the standardized interface:

```typescript
export interface IIntelligencePack {
  id: string;                      // Unique pack identifier (e.g. "pack.security")
  name: string;                    // Human readable name (e.g. "Security & RBAC Pack")
  version: string;                 // Pack version (SemVer)
  domain: string;                  // Target domain (e.g. "security", "retail", "runtime")
  maturityLevel: PackMaturityLevel;// 8-Level maturity classification (Level 0 – Level 7)
  owner: string;                   // Module owner team
  
  collectors: ICollector[];        // Fact collectors
  rules: IRule[];                  // Rule assertions with severities
  reports: IReportFormatter[];     // Report formatters
  snapshots: ISnapshotHandler[];   // Snapshot state handlers
  fixes: IFixAction[];             // Preview/Apply/Rollback fix actions
}
```

---

## 3. The 8-Level Pack Maturity Model (IPDS-002)

Every Domain Pack progress is measured objectively against the 8-Level Maturity Scale:

| Level | Classification | Capability Requirement |
| :---: | --- | --- |
| **Level 0** | **Registered** | Pack manifest registered in `RuleRegistry`. |
| **Level 1** | **Collectors** | Facts collected from UPR metadata or DOM into `FactRepository`. |
| **Level 2** | **Rules** | Assertion rules implemented with explicit Severities (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`). |
| **Level 3** | **Evidence** | Structured diagnostic findings captured in `EvidenceStore` with source locations. |
| **Level 4** | **Reports** | Domain diagnostic reports formatted and exported via `ReportGenerator`. |
| **Level 5** | **Snapshots** | Scan state SHA hashing and historical regression comparison active in `SnapshotStore`. |
| **Level 6** | **Fix Actions** | Deterministic repairs available with `Preview → Diff → Apply → Verify → Rollback`. |
| **Level 7** | **Release Certified** | Production release gate suite passing 100% in test workspace (`F:\SMRITI9TEST`). |

---

## 4. Platform Domain Pack Maturity Scorecard

Current maturity status across active platform packs:

| Domain Pack | Domain ID | Maturity Classification | Target Milestone |
| --- | --- | :---: | --- |
| **Navigation Pack** | `pack.navigation` | **Level 7 (Release Certified)** | Production Baseline |
| **Runtime Singleton Pack** | `pack.runtime` | **Level 7 (Release Certified)** | Production Baseline |
| **Security & RBAC Pack** | `pack.security` | **Level 2 (Rules Implemented)** | Sprint 2 Target |
| **Retail Business Pack** | `pack.retail` | **Level 0 (Registered)** | Sprint 3 Target |
| **Platform Knowledge Pack** | `pack.knowledge` | **Level 0 (Registered)** | Sprint 4 Target |

---

## 5. Domain Isolation Governance (IPDS-003)

1. **Zero Core Engine Business Logic:** Retail, accounting, tax (GST), or POS business rules MUST NEVER be written directly inside the SIE core engine files (`SIEEngine.ts`, `FactRepository.ts`).
2. **Domain Pack Scoping:** All domain rules, assertion logic, and repair handlers MUST live exclusively inside their respective `src/studio/intelligence/packs/<domain>/` directory.
