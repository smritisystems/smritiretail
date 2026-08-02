# SMRITI Platform — UX Kernel Certification Matrix

**Kernel Status:** FROZEN — UX Kernel v1.0.0 (SEDS / UFR / WNG / SUNEF)  
**Last Updated:** 2026-08-03  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## 1. Two-Level UX Certification Model

The SMRITI UX Kernel Certification separates platform infrastructure readiness from individual consumer domain adoption:

```text
Level A: Platform Kernel Certification (Reusable UI Infrastructure Readiness)
  ↓
Level B: Domain UX Certification (Domain-Specific Evidence Verification)
```

---

## 2. Level A — Platform Kernel Certification

Certifies the readiness of the core reusable frontend platform components:

| Platform Component | Constitutional Standard | Technical Capability | Level A Platform Status |
|---|---|---|---|
| **Workspace Kernel** | Rule UX001 | Single persistent `WorkspaceLayout` shell | ✅ **PLATFORM CERTIFIED** |
| **Navigation Kernel** | Rule UX002 | SUNEF 5-level declarative hierarchy (`SPK.navigation`) | ✅ **PLATFORM CERTIFIED** |
| **Universal Form Renderer** | Rule UX003 | Metadata-driven form engine (`SPK.forms`) | ✅ **PLATFORM CERTIFIED** |
| **Universal Grid Engine** | Rule UX004 | List Report Pattern & filter drawer | ✅ **PLATFORM CERTIFIED** |
| **Mobile Experience Layer** | Rule UX005 | 3 Profiles (Desktop, Tablet, Mobile) | ✅ **PLATFORM CERTIFIED** |
| **Accessibility Engine** | Rule UX006 | Keyboard focus, ARIA roles, shortcuts | ✅ **PLATFORM CERTIFIED** |
| **SEDS Theme Engine** | Rule UX007 | Slate token compliance (0 linter errors) | ✅ **PLATFORM CERTIFIED** |
| **Security UI Layer** | Rule UX008 | Visibility via `SPK.security.evaluateAccess()` | ✅ **PLATFORM CERTIFIED** |

---

## 3. Level B — Domain UX Certification

Each business domain earns UX certification independently based on direct domain UI test evidence:

| Business Domain | UX001 (Shell) | UX002 (Nav) | UX003 (Forms) | UX004 (Grids) | UX005 (Profiles) | UX006 (A11y) | UX007 (SEDS) | UX008 (USR) | Level B Status |
|---|---|---|---|---|---|---|---|---|---|
| **Sales (SI_001)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 **UX CERTIFIED** |
| **Purchase (PI_001)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 **UX CERTIFIED** |
| **POS (POS001)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 **UX CERTIFIED** |
| **Warehouse (WMS001)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 **UX CERTIFIED** |
| **Marketplace (MP001)** | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ✅ | ✅ | 🟡 **IN ADOPTION** |
| **Consignment (CS001)** | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ✅ | ✅ | 🟡 **IN ADOPTION** |
| **Manufacturing** | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⚪ **PLANNED** |

---

## 4. Experience Profile Architecture

| Profile | Primary Target Users | UX Characteristics |
|---|---|---|
| **Desktop Profile** | Back office, accountants, administrators | Dense grids, multi-pane workspaces, keyboard-first workflows |
| **Tablet Profile** | Store managers, warehouse supervisors | Touch-first layouts, split view, larger controls, quick actions |
| **Mobile Profile** | Sales staff, POS counter, delivery, field inventory | Bottom navigation, scanner-first interactions, card-based UI, one-handed operation |
