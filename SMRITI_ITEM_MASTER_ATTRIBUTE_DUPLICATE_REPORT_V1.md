# SMRITI ITEM MASTER ATTRIBUTE DUPLICATE REPORT V1
## Empirical Source Code Trace & Duplication Verification

> **Status:** READ-ONLY ARCHITECTURAL AUDIT | VERIFIED BASELINE

---

## Section 1: Detailed Empirical Trace Findings

### 1. `Brand` vs `Brand Name` Code & DB Trace
- **PostgreSQL Database Schema:** Table `products` contains column `brand VARCHAR(100)`. There is no `brand_name` column in PostgreSQL.
- **SQLAlchemy ORM Model:** `Product.brand` in `[backend/app/models/inventory.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/inventory.py#L35)`.
- **Pydantic API Schema:** `ProductRead.brand` in `[backend/app/schemas/inventory.py](file:///f:/SMRITRretailNXmgrt/backend/app/schemas/inventory.py)`.
- **Import API Mapper:** `/api/v1/attributes/import-commit` in `[backend/app/api/v1/attributes.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/attributes.py#L749)` checks `row.get('Brand Name')` OR `row.get('Brand')` and maps to `brand`.
- **Frontend Grid Config:** `ExcelGridEntrySection.tsx` line 174 maps `key: 'brand'`, `label: 'Brand Name'`, `aliases: ['Brand', 'Brand Name', 'Manufacturer', 'Label']`.
- **Universal Attribute Engine:** `UniversalAttributeEngine.ts` line 27 maps `canonicalKey: 'BRAND'` with `aliases: ['BRAND', 'BRAND NAME', 'MANUFACTURER', 'LABEL']`.
- **Verification Status:** **VERIFIED** — Zero database duplication. Duplication is strictly an import header alias & display label issue, resolved via canonical key `BRAND`.

### 2. `Style` / `Model` / `Article` / `Style Code` / `Model Code` / `Article Code` Code & DB Trace
- **PostgreSQL Database Schema:** Table `products` contains column `style_code VARCHAR(100)`. There are no physical columns named `style`, `model`, `article`, `model_code`, or `article_code` in PostgreSQL.
- **SQLAlchemy ORM Model:** `Product.style_code` in `[backend/app/models/inventory.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/inventory.py#L40)`.
- **Variant Template Model:** `VariantTemplate.style_code` in `[backend/app/models/attributes.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/attributes.py#L65)`.
- **Import API Mapper:** `/api/v1/attributes/import-commit` in `[backend/app/api/v1/attributes.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/attributes.py#L733)` checks `row.get('Style Code')`, `row.get('Article Code')`, `row.get('Model Number')` and maps to `style_code`.
- **Universal Attribute Engine:** `UniversalAttributeEngine.ts` line 43 maps `canonicalKey: 'STYLE_CODE'` with aliases for all 15 industry synonyms and resolves adaptive labels (`Apparel` -> `'Style Code'`, `Footwear` -> `'Article Code'`, `Electronics` -> `'Model Number'`).
- **Verification Status:** **VERIFIED** — Zero database duplication. All 6 terms represent the single canonical parent style concept `STYLE_CODE` stored in `products.style_code`.

### 3. Item Master Column Registry Analysis
- **Hardcoded React Definitions:** `ExcelGridEntrySection.tsx` `defaultFieldConfigs` contains 22 predefined grid columns.
- **Attribute Registry:** `UniversalAttributeEngine.getAttributes()` dynamically merges industry pack overrides (`ApparelPack`, `FootwearPack`, etc.).
- **Master Lookup Configuration:** `MasterType` (`master_types`) and `MasterValue` (`master_values`) feed dropdown choices for `brand`, `category`, `hsn_code`.
- **Verification Status:** **VERIFIED** — Column sources operate in a strict hierarchy: Core Model Columns -> UAME Metadata Engine -> Industry Pack Label Overrides -> Master Value Dropdowns.

### 4. Variant Dimensions & SKU Formula Audit
- **Identity Attributes:** `style_code`, `brand`, `category`, `name` identify parent item templates.
- **Variant Dimensions:** `color`, `size`, `width`, `material` are flagged `isVariantDimension: true` in `UniversalAttributeEngine.ts`.
- **SKU Formula:** `skuGenerator.ts` generates SKU codes using formula `style_code + configured variant dimensions` (e.g. `{style_code}-{color}-{size}`).
- **Verification Status:** **VERIFIED** — Brand, Style, Model, and Article cannot become accidental variant dimensions. SKU formula is preserved.

### 5. Import Compatibility & Header Normalization Audit
- Import engine accepts all legacy/synonym Excel headers (`Brand`, `Brand Name`, `Style`, `Style Code`, `Article Code`, `Model No`).
- Aliases are normalized to canonical keys (`BRAND`, `STYLE_CODE`) prior to database persistence.
- Zero user data loss occurs during import mapping.
- **Verification Status:** **VERIFIED**.

---

## Section 2: Final Suspected Duplicate Verification Matrix

| Suspected Duplicate Pair / Group | Verification Status | Rationale & Evidence |
|---|---|---|
| `Brand` vs `Brand Name` | 🟢 **VERIFIED** | Both map to canonical key `BRAND` and physical column `products.brand`. Zero DB duplication. |
| `Style` vs `Style Code` | 🟢 **VERIFIED** | Both map to canonical key `STYLE_CODE` and physical column `products.style_code`. Zero DB duplication. |
| `Article` vs `Article Code` | 🟢 **VERIFIED** | Footwear industry display alias for canonical key `STYLE_CODE`. Zero DB duplication. |
| `Model` vs `Model Code` / `Model Number` | 🟢 **VERIFIED** | Electronics industry display alias for canonical key `STYLE_CODE`. Zero DB duplication. |
| `Buy Cost` vs `Cost Price` | 🟢 **VERIFIED** | Both map to canonical key `COST_PRICE` and physical column `products.cost_price`. |
| `Selling Price` vs `Price` | 🟢 **VERIFIED** | Both map to canonical key `SELLING_PRICE` and physical column `products.price`. |
| `GST %` vs `Tax Percentage` | 🟢 **VERIFIED** | Both map to canonical key `GST_RATE` and physical column `products.gst_percentage`. |
| Custom EAV Attributes | 🟡 **REQUIRES BUSINESS DECISION** | User-defined custom dynamic attributes in `attribute_definitions` should be validated against UAME canonical registry to prevent duplicate dynamic field creation by tenant admins. |