# SMRITI Retail OS — Category Article Numbering UX Audit Report

**Audit Date:** 2026-09-30  
**Audit Type:** Read-Only Visual & Responsive UX Verification  
**Target Environment:** Local Dev / Test (Frontend: `http://localhost:3000`, Backend: `http://localhost:1981`, Database: PostgreSQL `smriti001`)  
**Audit Route:** `http://localhost:3000/` → Workspace: `item-master` (`Article / Design Master`)  
**Drawer Component:** `src/components/itemMaster/AddProductDrawer.tsx`  

---

## 1. Executive Summary

This observation-only audit verified the live user experience of the canonical **Article Master** workspace following the implementation and production counter reset of category-based Article Numbering (`SER-ART-SANDAL-001` and `SER-ART-SHOES-001`).

- **No database mutations occurred**: Database item count remains exactly `796`.
- **Numbering counters preserved**:
  - `SANDAL` (`SER-ART-SANDAL-001`): `current_number = 9999`
  - `SHOES` (`SER-ART-SHOES-001`): `current_number = 19999`
- **Zero test articles created**: No items matching `SND-%` or `SH-%` were inserted.
- **Dynamic previews verified**:
  - `Category = SANDAL` → Next Article Number Preview: **`SND-10000-A`**
  - `Category = SHOES` → Next Article Number Preview: **`SH-20000-A`**
- **Field Independence**:
  - Article Number is **Read-Only / System Generated** with clear series provenance (`Series: SER-ART-SANDAL-001 (Will be generated on save)`).
  - Design / Style Name (`name`) remains an independent text input.
  - Variant Matrix remains a separate Step 2 workflow with 2D Color × Size grid.
  - SKU is auto-generated as `${article}-${color}-${size}` and locked (disabled).
  - Primary Barcode and Secondary Barcodes remain completely separate from the Article Number and SKU.

---

## 2. Screenshot Artifacts

| Viewport | Category | Preview Value | File Name | File Path |
|---|---|---|---|---|
| **1920 × 1080 (Desktop)** | `SANDAL` | `SND-10000-A` | `article-numbering-sandal-desktop.png` | `docs/ux-audit/article-numbering/article-numbering-sandal-desktop.png` |
| **1920 × 1080 (Desktop)** | `SHOES` | `SH-20000-A` | `article-numbering-shoes-desktop.png` | `docs/ux-audit/article-numbering/article-numbering-shoes-desktop.png` |
| **1920 × 1080 (Desktop)** | `SANDAL` (Step 2 Matrix) | Variant Matrix & Auto SKU | `article-numbering-variants-matrix-desktop.png` | `docs/ux-audit/article-numbering/article-numbering-variants-matrix-desktop.png` |
| **1366 × 768 (Laptop)** | `SANDAL` | `SND-10000-A` | `article-numbering-sandal-laptop.png` | `docs/ux-audit/article-numbering/article-numbering-sandal-laptop.png` |
| **768 × 1024 (Tablet)** | `SANDAL` | `SND-10000-A` | `article-numbering-sandal-tablet.png` | `docs/ux-audit/article-numbering/article-numbering-sandal-tablet.png` |
| **390 × 844 (Mobile)** | `SANDAL` | `SND-10000-A` | `article-numbering-sandal-mobile.png` | `docs/ux-audit/article-numbering/article-numbering-sandal-mobile.png` |

---

## 3. UI Hierarchy & Exact Field Labels

### Step 1: Article Identity
- **Drawer Title:** `New Article / Design`
- **Stepper Navigation:** `1 Article Identity` (Active) → `2 Variants` → `3 Review`
- **Section 1:** `ARTICLE INFORMATION`
  - `Article Number` (Radio selection):
    - `Auto Generate (Recommended)` (Default: Selected)
    - `Manual Entry`
  - `Next Article Number (Preview)` (Read-Only Display Card):
    - Value (Monospace Bold): `SND-10000-A` (or `SH-20000-A`)
    - Caption: `Series: SER-ART-SANDAL-001 (Will be generated on save)`
  - `Design / Style Name *`: Placeholder `"e.g. Running Shoe Pro"`
  - 3-Column Attributes Row 1:
    - `Brand *` (Select dropdown)
    - `Category *` (Select dropdown, containing `SANDAL`, `SHOES`, `Footwear`, etc.)
    - `Gender` (Select dropdown: `KIDS`, `LADIES`, `MENS`, `UNISEX`)
  - 3-Column Attributes Row 2:
    - `Product Type *` (Select dropdown: `CHAPPAL`, `SANDAL`, `SHOE`, etc.)
    - `Heel Type *` (Select dropdown: `FLAT`, `BLOCK`, `CONE`, etc.)
    - `Upper Material *` (Select dropdown: `SYNTHETIC`, `LEATHER`, `MESH`, etc.)
  - 3-Column Financials Row 3:
    - `HSN Code` (Text input, default: `6403`)
    - `Base MRP (₹) *` (Number input, default: `2999.00`)
    - `Base Selling Price (₹)` (Number input, default: `2499.00`)
- **Section 2:** `SUPPLIER ASSIGNMENT`
  - `Preferred Supplier` (Select dropdown)
  - `Priority` (Select dropdown: `Primary`, `Preferred`, `Secondary`)
  - `Auto PO on Low Stock` (Checkbox)
  - `Auto GRN on Receipt` (Checkbox, default: checked)
- **Footer Actions:**
  - `Cancel` (Closes drawer without committing)
  - `Next >` (Validates Step 1 and advances to Step 2 Variants)

### Step 2: Variants (Size × Color Matrix)
- **Stepper Navigation:** `1 Article Identity` (Completed checkmark) → `2 Variants` (Active) → `3 Review`
- **Left Panel (Matrix Builder):**
  - `Select Colors`: Color chips (`Black`, `Navy`, `Red`, `Grey`, etc.) + `+ Add Color`
  - `Select Sizes`: Size chips (`7`, `8`, `9`, `10`, `11`, etc.) + `+ Add Size`
  - `Variant Matrix Preview` (`20 variants enabled`): 2D Grid with Color rows × Size columns
- **Right Panel (Variant Details Preview):**
  - `VARIANT DETAILS (PREVIEW)` — e.g., `BLACK / SIZE 7`
  - `SKU (Auto)`: Read-only, disabled input with lock icon (`<Lock />`)
  - `Primary Barcode *`: Independent editable text input
  - `Additional Barcodes`: Chips list with secondary barcode tags + `+ Add barcode`
  - `Variant MRP (₹)`: Independent pricing input
  - `Variant Cost (₹)`: Independent cost input
- **Footer Actions:**
  - `Cancel`
  - `< Back` (Returns to Step 1)
  - `Create Article & All Variants` (Submit button — NOT clicked during audit)

---

## 4. Responsive Layout Assessment

| Viewport | Sidebar / Shell | Form Visibility | Preview Visibility | Horizontal Overflow | Primary Actions |
|---|---|---|---|---|---|
| **1920 × 1080 (Desktop)** | Fully visible, fixed rail | 940px modal drawer centered right | Cleanly centered, bold mono | None | Fully accessible in sticky footer |
| **1366 × 768 (Laptop)** | Fully visible, compact rail | 940px modal drawer, full vertical fit | Cleanly visible, bold mono | None | Fully accessible in sticky footer |
| **768 × 1024 (Tablet)** | Hidden behind backdrop | Full-width modal drawer (752px) | Cleanly visible, bold mono | None | Fully accessible in sticky footer |
| **390 × 844 (Mobile)** | Hidden behind backdrop | Full-width modal drawer (374px) | Cleanly visible, bold mono | None | Fully accessible in sticky footer |

---

## 5. UX Observations & Identified Improvement Opportunities

1. **Mobile 3-Column Grid Density:**  
   On mobile viewport (390px), the 3-column attribute rows (`Brand | Category | Gender` and `Product Type | Heel Type | Upper Material`) retain `grid-cols-3` without a responsive breakpoint (`grid-cols-1 sm:grid-cols-3`). While inputs do not overflow horizontally, dropdowns are narrow (~100px) and labels like `Base Selling Price (₹)` wrap onto two lines.
   *Recommendation for future iteration:* Change `grid grid-cols-3 gap-4` to `grid grid-cols-1 sm:grid-cols-3 gap-3`.

2. **Step 2 Initial Matrix SKU Synchronization:**  
   In `AddProductDrawer.tsx`, the `useEffect` initializing `variantMatrix` uses `if (!next[key])` to populate default cells on drawer mount before user category selection. When the user changes Category from default to `SANDAL` (`SND-10000-A`), the Step 1 preview correctly displays `SND-10000-A`, but pre-initialized Step 2 variant matrix cells retain the initial mount preview prefix until manually toggled or recreated.
   *Recommendation for future iteration:* Update the variant synchronization effect to refresh the SKU prefix when `seriesPreview` changes.

---

## 6. Post-Audit Database Verification (Zero Mutations)

Literal terminal test output of `phase8_final_integrity.py`:
```
============================================================
PHASE 8: FINAL DATABASE INTEGRITY
============================================================
Total items count: 796 (Expected: 796)
NULL/empty item_code: 0 (Expected: 0)
Duplicate active item_code count: 0 (Expected: 0)
Actual Article count for SND-10000-A : 0 (Expected: 0)
Actual Article count for SND-10001-A : 0 (Expected: 0)
Actual Article count for SH-20000-A  : 0 (Expected: 0)
Actual Article count for SH-20001-A  : 0 (Expected: 0)

Series current_number:
  SANDAL: 9999 (Expected: 9999)
  SHOES:  19999 (Expected: 19999)

PHASE 8 FINAL DATABASE INTEGRITY: ALL CHECKS PASSED.
```
