# SMRITI Theme Purity Audit & Migration Plan

Status: Audit only. No production code changes made yet.

## 1. Objective

SMRITI supports multiple themes and branded experiences:

- Light
- Dark
- High Contrast
- Brand Themes
- Future Customer Themes

Therefore, business UI components must not depend on hardcoded color utilities such as `bg-white`, `text-black`, `text-white`, or direct hex/RGB values.

## 2. Repository Audit Findings

A repository-wide scan of UI and component files surfaced widespread legacy color usage.

### Evidence from the scan

- 268 files contained color-related matches.
- 242 of those were categorized as business UI files.
- 22 were documentation-related and excluded from migration.
- 4 were tests/demo-related and reported separately.

### High-impact business components currently using legacy color patterns

These files are the most obvious theme bypass points and should be migrated first:

- [src/components/CustomerMasterTab.tsx](src/components/CustomerMasterTab.tsx)
- [src/components/ItemMasterTab.tsx](src/components/ItemMasterTab.tsx)
- [src/components/sales/SalesBillingStudio.tsx](src/components/sales/SalesBillingStudio.tsx)
- [src/components/purchase/PurchaseOperationsStudio.tsx](src/components/purchase/PurchaseOperationsStudio.tsx)
- [src/components/printing/PrintLabelsStudio.tsx](src/components/printing/PrintLabelsStudio.tsx)
- [src/components/printing/PRNTemplateStudio.tsx](src/components/printing/PRNTemplateStudio.tsx)
- [src/components/PrintPreviewModal.tsx](src/components/PrintPreviewModal.tsx)
- [src/components/QuickReportsWidget.tsx](src/components/QuickReportsWidget.tsx)
- [src/components/TermsEngineTab.tsx](src/components/TermsEngineTab.tsx)
- [src/components/SetupWizard/SetupWizardTab.tsx](src/components/SetupWizard/SetupWizardTab.tsx)
- [src/components/common/AdaptiveWorkspaceHeader.tsx](src/components/common/AdaptiveWorkspaceHeader.tsx)

## 3. Migration Categories

### Category A — Business UI Components (must migrate)

These are direct violations of the SMRITI theme model and should be remediated first.

Examples:

- `bg-white` → `bg-theme-surface-2`
- `text-black` → `text-theme-body`
- `text-white` → `text-theme-primary` or `text-theme-inverse` depending on context
- `border-gray-*` → `border-theme-divider`

### Category B — Documentation

Ignore for this pass.

### Category C — Demo / Playground / Examples

Report separately, but do not block the migration of the product UI.

### Category D — Tests

Ignore for this pass.

## 4. Replacement Mapping Guidance

### Surface replacements

| Current | Replacement | Reason |
| --- | --- | --- |
| `bg-white` | `bg-theme-surface-2` | Uses the semantic surface token and adapts to theme |
| `bg-gray-*` | `bg-theme-surface-2` or `bg-theme-surface-3` | Keeps panels and cards aligned with theme layers |
| `border-gray-*` | `border-theme-divider` | Uses the semantic divider token |
| `text-black` | `text-theme-body` | Uses the semantic text token |
| `text-white` | `text-theme-primary` or `text-theme-inverse` | Depends on the context and surrounding surface |

### Semantic replacements (do not replace blindly)

These should be preserved as semantic status colors when the intent is meaningful:

- Success → `--smriti-success`
- Warning → `--smriti-warning`
- Danger → `--smriti-danger`
- Info → `--smriti-info`

## 5. Migration Report (Priority Order)

| File | Line / Area | Current Color | Replacement Token | Risk |
| --- | --- | --- | --- | --- |
| [src/components/common/AdaptiveWorkspaceHeader.tsx](src/components/common/AdaptiveWorkspaceHeader.tsx) | theme selector options | `bg-white` | `bg-theme-surface-2` | Medium |
| [src/components/CustomerMasterTab.tsx](src/components/CustomerMasterTab.tsx) | card / dialog surfaces | `bg-white` | `bg-theme-surface-2` | High |
| [src/components/ItemMasterTab.tsx](src/components/ItemMasterTab.tsx) | card / dialog surfaces | `bg-white` | `bg-theme-surface-2` | High |
| [src/components/sales/SalesBillingStudio.tsx](src/components/sales/SalesBillingStudio.tsx) | panels and inputs | `bg-white` | `bg-theme-surface-2` | High |
| [src/components/purchase/PurchaseOperationsStudio.tsx](src/components/purchase/PurchaseOperationsStudio.tsx) | panels and inputs | `bg-white` | `bg-theme-surface-2` | High |
| [src/components/printing/PrintLabelsStudio.tsx](src/components/printing/PrintLabelsStudio.tsx) | headers / panels / modals | `bg-white` | `bg-theme-surface-2` | High |
| [src/components/printing/PRNTemplateStudio.tsx](src/components/printing/PRNTemplateStudio.tsx) | cards and panels | `bg-white` | `bg-theme-surface-2` | High |
| [src/components/PrintPreviewModal.tsx](src/components/PrintPreviewModal.tsx) | preview sheet / switch thumb | `bg-white` | `bg-theme-surface-2` | Medium |
| [src/components/QuickReportsWidget.tsx](src/components/QuickReportsWidget.tsx) | print preview surfaces | `bg-white` | `bg-theme-surface-2` | Medium |
| [src/components/TermsEngineTab.tsx](src/components/TermsEngineTab.tsx) | preview container | `bg-white` | `bg-theme-surface-2` | Medium |
| [src/components/SetupWizard/SetupWizardTab.tsx](src/components/SetupWizard/SetupWizardTab.tsx) | switch thumb | `bg-white` | `bg-theme-surface-2` | Low |

## 6. Recommended Migration Phases

### Phase 1 — Foundation

- Introduce a repo-wide theme governance rule.
- Add a lint/grep-based CI check for forbidden classes.
- Create a small allowlist for intentional semantic colors only.

### Phase 2 — High-traffic UI surfaces

- Migrate shared shells, cards, panels, dialogs, and headers first.
- Replace the most repeated patterns such as `bg-white`, `border-gray-*`, and `text-black`.

### Phase 3 — Semantic color cleanup

- Keep success / warning / danger / info colors semantically intact.
- Map them to the SMRITI semantic tokens instead of ad-hoc blue/red/green/yellow utilities.

### Phase 4 — Validation

Verify the migration under:

- Light Theme
- Dark Theme
- High Contrast
- Brand Themes

## 7. Theme Purity Score

### Provisional score

- Current estimated purity: about 40%
- Target: 100%

This estimate is intentionally conservative because the scan found hardcoded color usage across a large number of business files, especially in core commerce, printing, and workspace components.

## 8. Governance Rule to Add

### Forbidden

- `bg-white`
- `text-black`
- `text-white`
- `#ffffff`
- `#000000`
- `rgb(`
- `rgba(`

### Allowed

- `bg-theme-surface-*`
- `text-theme-*`
- `border-theme-*`
- `var(--smriti-*)`

## 9. Recommended Next Step

Proceed with a controlled migration pass over the highest-impact business components listed above, starting with shared shell and card surfaces before moving to feature-specific views.
