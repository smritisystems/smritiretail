"""
Fix TSC errors - PRECISE VERSION.
Only replaces JSX tag names (not inside string literals or import paths).
"""
import re
from pathlib import Path

repo_root = Path(".").resolve()

# ─────────────────────────────────────────────────────────────────────────────
# UNDO the damage: restore import paths that were incorrectly modified
# ─────────────────────────────────────────────────────────────────────────────
IMPORT_PATH_RESTORE = {
    # App.tsx: restore import paths that were changed from file-name to symbol-name
    "src/App.tsx": [
        ("./components/MasterManagementTab.tsx", "./components/MasterMgmtTab.tsx"),
        ("./components/SupplierDashboardTab.tsx", "./components/SupplierDashTab.tsx"),
        ("./components/drilldown/DrillDownBreadcrumbs.tsx", "./components/drilldown/DrillDownCrumbs.tsx"),
        ("./components/drilldown/GlobalF2BrowseModal.tsx", "./components/drilldown/GlobalF2BrowseDlg.tsx"),
        ("./components/drilldown/ContextualInspectorHUD.tsx", "./components/drilldown/CtxInspectorHUD.tsx"),
        ("./components/TaxInvoicePrintPage.tsx", "./components/TaxInvoicePrintPag.tsx"),
        ("./components/CompanySelectionScreen.tsx", "./components/CompanySelectScree.tsx"),
        ("./components/SmritiErrorBoundary.tsx", "./components/ErrorBoundary.tsx"),
    ],
    # BarcodeStudioTab: restore import path
    "src/components/BarcodeStudioTab.tsx": [
        ("./barcode/TagLabelPrintingTab.tsx", "./barcode/TagLabelPrintingTa.tsx"),
    ],
    # TagLabelPrintingTa: restore import paths
    "src/components/barcode/TagLabelPrintingTa.tsx": [
        ("./EditQuantityDetailsModal.tsx", "./EditQuantityDetDlg.tsx"),
        ("./BarcodeScriptGenerationView.tsx", "./BarcodeScriptGenVi.tsx"),
        ("./BarcodePrinterSelectModal.tsx", "./BarcodePrinterSele.tsx"),
        ("./SearchableMultiSelect.tsx", "./SearchableMultiSel.tsx"),
    ],
    # ProPosBillingTerm: restore import paths that were mangled
    "src/components/billing/propos/ProPosBillingTerm.tsx": [
        ("./SmritiPosSettlement.tsx", "./ProPosSettlementDl.tsx"),
        ("./SmritiProPosRecallDlg.tsx", "./ProPosRecallDlg.tsx"),
        ("./SmritiProPosCancelDlg.tsx", "./ProPosCancellation.tsx"),
        ("./SmritiPdtImportDlg.tsx", "./ProPosPdtImportDlg.tsx"),
        ("./SmritiCustomerBrowseModal.tsx", "./CustBrowseDlg.tsx"),
        ("./SmritiProPosHotkeysDlg.tsx", "./ProPosHotkeysDlg.tsx"),
        ("./SmritiProPosReprintDlg.tsx", "./ProPosReprintDlg.tsx"),
        ("../../common/SmritiItemTypeaheadDropdown.tsx", "../../common/ItemTypeaheadDrop.tsx"),
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# Now that import paths are correct (file names), fix the IMPORT ALIASES
# (the { XxxYyy } part of import) to match the actual exported names.
# ─────────────────────────────────────────────────────────────────────────────
# Format: "file_key": [ (old_alias_in_import, new_alias_to_use) ]
# These are replacements in the import statement only, not in JSX.
IMPORT_ALIAS_FIXES = {
    "src/components/billing/propos/ProPosBillingTerm.tsx": [
        # Import aliases need to match what the file actually exports
        # ProPosSettlementDl.tsx exports SmritiPosSettlement -- check:
        # (already correct from original)
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# FIX IMPORT ALIAS NAMES in import statements ONLY
# (for cases where the import alias was changed by fix_tsc_errors.py but is wrong)
# ─────────────────────────────────────────────────────────────────────────────
# Strategy: in import statements { OldName } from "path" → { NewName } from "path"
# Only match in import lines, not JSX.
IMPORT_LINE_ALIAS_FIX = {
    "src/App.tsx": [
        # The import alias must match what the .tsx file actually exports
        # MasterMgmtTab.tsx exports MasterManagementTab -- alias is correct
        # SupplierDashTab.tsx exports SupplierDashboardTab -- alias is correct
        # DrillDownCrumbs.tsx exports DrillDownBreadcrumbs -- alias is correct
        # GlobalF2BrowseDlg.tsx exports GlobalF2BrowseModal -- alias is correct
        # CtxInspectorHUD.tsx exports ContextualInspectorHUD -- alias is correct
        # TaxInvoicePrintPag.tsx exports TaxInvoicePrintPage -- alias is correct
        # CompanySelectScree.tsx exports CompanySelectionScreen -- alias is correct
        # ErrorBoundary.tsx exports SmritiErrorBoundary -- alias is correct
        # (no changes needed — alias names are already matching exported names)
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# JSX TAG NAME FIXES
# Replace <WrongName> and </WrongName> with <CorrectName> and </CorrectName>
# These use <Tag syntax so they won't hit import paths.
# ─────────────────────────────────────────────────────────────────────────────
JSX_TAG_FIXES = {
    "src/App.tsx": [
        # JSX used short names, but imports use full exported symbol names
        # Now that import paths are restored, the import aliases are:
        # MasterManagementTab, SupplierDashboardTab, DrillDownBreadcrumbs,
        # GlobalF2BrowseModal, ContextualInspectorHUD, TaxInvoicePrintPage,
        # CompanySelectionScreen, SmritiErrorBoundary
        # The previous fix already changed JSX from short names to full names -- good.
        # But "ErrorBoundary" was changed to "SmritiErrorBoundary" -- check if that was right.
    ],
    "src/components/BarcodeStudioTab.tsx": [
        # TagLabelPrintingTa → TagLabelPrintingTab (already fixed by previous run -- keep)
    ],
    "src/components/barcode/TagLabelPrintingTa.tsx": [
        # BarcodeScriptGenerationView, SearchableMultiSelect, EditQuantityDetailsModal,
        # BarcodePrinterSelectModal -- already fixed by previous run -- keep
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# ADDITIONAL MISSING IMPORT PATH FIXES (new ones discovered)
# ─────────────────────────────────────────────────────────────────────────────
ADDITIONAL_PATH_FIXES = {
    # BillingTerm.tsx: ItemTypeaheadDrop, InvoiceSettlementD, ProductSearchBrows
    "src/components/billing/BillingTerm.tsx": [],
}


def restore_import_paths(path: Path, file_key: str, content: str) -> tuple[str, list[str]]:
    changes = []
    if file_key not in IMPORT_PATH_RESTORE:
        return content, changes
    for wrong_path, correct_path in IMPORT_PATH_RESTORE[file_key]:
        if wrong_path in content:
            content = content.replace(wrong_path, correct_path)
            changes.append(f"  path restore: {wrong_path} -> {correct_path}")
    return content, changes


def process_file(path: Path) -> bool:
    try:
        content = path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  ERROR reading {path}: {e}")
        return False

    original = content
    try:
        rel = path.relative_to(repo_root)
        file_key = str(rel).replace("\\", "/")
    except ValueError:
        file_key = str(path).replace("\\", "/")

    all_changes = []

    content, ch = restore_import_paths(path, file_key, content)
    all_changes.extend(ch)

    if content != original:
        path.write_text(content, encoding="utf-8")
        print(f"RESTORED: {path}")
        for c in all_changes:
            print(c)
        return True
    return False


fixed_count = 0
for path in sorted(list(repo_root.glob("src/**/*.tsx")) + list(repo_root.glob("src/**/*.ts"))):
    if process_file(path):
        fixed_count += 1

print(f"\nTotal files restored: {fixed_count}")
