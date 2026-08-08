# Architecture Decision Record (ADR-001)

## ADR-001: Centralization of Document Generation, Rendering, and Output in SMRITI Document Experience Platform (SCS-DXP-001)

**Status:** APPROVED & FROZEN  
**Date:** 2026-08-05  
**Constitutional Standard:** SCS-DXP-001  
**Author:** Jawahar Ramkripal Mallah  
**Ownership:** SMRITI Retail OS Architecture Team  
**Copyright:** © Jawahar Ramkripal Mallah. All Rights Reserved.  

---

### Context

Prior to SCS-DXP-001, document processing across SMRITI Retail OS was fragmented across multiple procedural printing scripts (`prnGenerator.ts`, `PRNVariableEngine.ts`, `PrintProviderFramework.ts`, `PrintHistoryService.ts`). Technical hardware details (ZPL, TSPL, ESC/POS, WebSerial, RawBT) leaked directly into user interfaces, violating **Principle 001 ("Enterprise Power. WhatsApp Simplicity.")** and causing maintenance duplication across POS, Purchase, Inventory, and Barcode modules.

---

### Decision

1. **Centralize All Document Workflows**: All document generation, rendering, previewing, printing, emailing, sharing, and archiving MUST execute exclusively through `DocumentService` / SCS-DXP-001.
2. **Decouple Hardware via SDP**: Hardware communication is isolated inside the SMRITI Device Platform (`SdaRuntime.ts`), hiding Layer 3 infrastructure from business components.
3. **Purge Legacy Stack**: Purged 6 legacy printing files (-1,819 lines of technical debt).
4. **Universal API Contract**: Business modules interact only via `DocumentService.execute()` / `DocumentService.output()`.

---

### Consequences

- **Positive**: Single authoritative document API; 100% layer isolation; resolution-independent vector rendering; automatic tenant branding; unified audit history.
- **Negative / Constraints**: Business modules are strictly forbidden from executing custom procedural printer drivers or direct PDF generators.

---

### Compliance Criteria (DXP 9-Point Certification)

1. Uses `DocumentService` for all document operations.
2. Zero direct PDF generation outside DXP.
3. Zero direct printer driver or hardware calls.
4. Zero custom procedural template renderers.
5. Uses universal `DxpPreviewStudio` / `SEEFDialog`.
6. Integrates with central DXP Output History.
7. Follows standard DXP Document Lifecycle (`DRAFT` $\rightarrow$ `DELIVERED`).
8. Inherits tenant branding automatically via `BrandingInjector`.
9. Enforces role-based permissions via `DocumentSecurity`.
