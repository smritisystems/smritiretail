<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.0.0
  Created      : 2026-07-25
  Modified     : 2026-07-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Dynamic Configurable SKU Code Generation Engine (Manual, Hybrid & Auto Formula Modes)

## 1. Purpose
This walkthrough documents the implementation of the dynamic, multi-mode SKU Code Generation Engine in SMRITI Retail OS. Retail businesses require flexible SKU creation modes—ranging from direct manual entry for existing catalog SKUs, hybrid custom prefixes with auto-appended variant attributes, to full automatic formula generation (`Style Code + Color + Size`, `Category + Style + Color + Size`, or custom token patterns).

## 2. Scope
- Implementation of `src/lib/skuGenerator.ts` providing core SKU generation logic for `Manual`, `Hybrid`, and `Auto` modes.
- Enhancement of `src/components/ItemMasterTab.tsx` with a SKU Generation Mode Selector (`Manual` | `Hybrid` | `Auto Formula`), Formula Pattern Configurator, and reactive live SKU preview.
- Enhancement of `src/components/VariantTemplateSection.tsx` matrix cell construction to generate variant SKUs using the SKU Generator Engine.
- Creation and execution of Node unit test suite `tests/unit/test_sku_generator.cjs` in dedicated test environment `F:\SMRITI9TEST`.
- Deployment to live Docker workspace container `smriti-workspace`.

## 3. Files Created
- [`src/lib/skuGenerator.ts`](file:///f:/SMRITRretailNXmgrt/src/lib/skuGenerator.ts) — Core SKU generation utility module supporting Manual, Hybrid, Auto presets, and Custom formula patterns.
- [`tests/unit/test_sku_generator.cjs`](file:///f:/SMRITRretailNXmgrt/tests/unit/test_sku_generator.cjs) — Unit test runner validating all 6 SKU generation mode & pattern combinations.

## 4. Files Modified
- [`src/components/ItemMasterTab.tsx`](file:///f:/SMRITRretailNXmgrt/src/components/ItemMasterTab.tsx) — Added SKU Generator state management, mode selector controls (`Manual` | `Hybrid` | `Auto`), formula dropdown, and real-time reactive SKU calculation hook.
- [`src/components/VariantTemplateSection.tsx`](file:///f:/SMRITRretailNXmgrt/src/components/VariantTemplateSection.tsx) — Updated matrix cell generation to construct variant SKUs dynamically using `generateSkuCode`.
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNXmgrt/docs/walkthrough/README.md) — Updated master walkthrough index table with v4.0.0 SKU Generator entry.

## 5. Architecture Decisions
- **Decoupled Utility Layer (`skuGenerator.ts`)**: SKU formatting rules are implemented in a standalone pure function (`generateSkuCode`) with no direct DOM or state bindings, ensuring reusability across single item entry, variant matrices, and excel grid imports.
- **Reactive UI Bindings**: When in `Auto` or `Hybrid` mode, changes to `Style Reference Code`, `Category`, `Brand`, or custom attributes (`Color`, `Size`) instantly update the target SKU Code field (`formCode`) without manual button clicks.
- **Zero Breaking Changes**: Existing catalog records and manual SKU entry workflows remain 100% compatible via the `Manual` mode toggle.

## 6. Design Rationale
Retail merchandisers work across different item creation flows:
1. **Manual Mode**: Essential for legacy products with existing supplier SKUs.
2. **Auto Formula Mode**: Ideal for apparel and footwear where SKUs follow systematic conventions like `[StyleCode]-[Color]-[Size]` (e.g. `STL-101-RED-XL`).
3. **Hybrid Mode**: Enables vendor or collection prefixes (e.g. `SUMMER2026`) combined with automatic variant attributes (e.g. `SUMMER2026-RED-XL`).

## 7. Implementation Summary
- **Preset Patterns**:
  - `STYLE_COLOR_SIZE`: `{style}-{color}-{size}` (Default)
  - `STYLE_SIZE_COLOR`: `{style}-{size}-{color}`
  - `CAT_STYLE_COLOR_SIZE`: `{category}-{style}-{color}-{size}`
  - `BRAND_STYLE_COLOR_SIZE`: `{brand}-{style}-{color}-{size}`
  - `CUSTOM`: Custom template using `{style}`, `{color}`, `{size}`, `{category}`, `{brand}`, `{seq}`
- **Token Sanitization**: Converts raw input strings to uppercase alphanumeric tokens, stripping invalid special characters and enforcing maximum field lengths.

## 8. Tests Executed
1. **Unit Test Suite Execution**: `node tests/unit/test_sku_generator.cjs` in `F:\SMRITI9TEST`.
2. **Playwright End-to-End Suite**: `node tests/e2e/playwright_e2e_runner.cjs` against Docker container `http://localhost:3000`.

## 9. Verification Results

### Unit Test Terminal Output (`F:\SMRITI9TEST`)
```text
=== SMRITI RETAIL OS — SKU GENERATION ENGINE UNIT TEST SUITE ===

Test 1 [MANUAL Mode]: MY-CUSTOM-SKU-123
Test 2 [AUTO Mode - Style+Color+Size]: STL-101-RED-XL
Test 3 [AUTO Mode - Style+Size+Color]: STL-101-XL-RED
Test 4 [AUTO Mode - Cat+Style+Color+Size]: APPAREL-STL-101-BLUE-M
Test 5 [AUTO Mode - Custom Template]: NIKE-JKT-500-BLACK-L
Test 6 [HYBRID Mode - Prefix + Attributes]: PRE-888-GREEN-S

✅ ALL 6 SKU GENERATION TEST CASES PASSED PERFECTLY!
```

### Playwright E2E Suite Output (`F:\SMRITI9TEST`)
```text
=== SMRITI RETAIL OS — PLAYWRIGHT END-TO-END AUTOMATION SUITE ===

Running E2E-001: Store Manager Login... ✅ PASSED (Authenticated as MANAGER on Docker container)
Running E2E-002: POS Cashier Login... ✅ PASSED (Authenticated as CASHIER on Docker container)
Running E2E-003: System Admin Login... ✅ PASSED (Authenticated as SYSADMIN on Docker container)
Running E2E-004: Invalid Password Rejection... ✅ PASSED (Correctly displayed HREP error callout on UI)

=== PLAYWRIGHT SUITE EXECUTION COMPLETE ===
```

## 10. Known Limitations
- Sequence numbers in custom SKU templates (`{seq}`) currently default to 4-digit zero-padded numbers when sequence context is not provided.

## 11. Future Work
- Add global tenant-level SKU rule default configuration in System Settings.

## 12. Related ADRs
- `ADR-002`: Four-Tier Enterprise Architecture & Independence Principle.

## 13. Related RFCs
- `RFC-043`: Product Identity & Barcode Assignment Governance.
