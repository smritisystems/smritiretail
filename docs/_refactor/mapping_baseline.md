<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-08-19
  Modified     : 2026-08-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Phase 0 & Phase 1: Header Auto-Mapping Model Baseline & Refactor Specification

## 1. Phase 0: Current Mapping Model Audit

### 1.1 Where is source→target mapping stored in state per-paste session?
- **Component State:** In [`src/components/HeaderMappingPrevi.tsx`](file:///F:/SMRITRretailNX/src/components/HeaderMappingPrevi.tsx), state is managed as `const [columns, setColumns] = useState<ColumnMappingResult[]>([]);`.
- **Handoff:** When confirmed, `onConfirm(columns)` passes `ColumnMappingResult[]` to `applyConfirmedHeaderMappings()` in [`src/components/ExcelGridEntrySec.tsx`](file:///F:/SMRITRretailNX/src/components/ExcelGridEntrySec.tsx).

### 1.2 Is it 1:1 or 1:Many today?
- **Data Model:** `ColumnMappingResult` has `mappedFieldKey: string | null` (1:1 primary) with optional `additionalTargets?: ConditionalTarget[]`.
- **UI:** The UI currently renders 1 row per source column with a single `<select>` dropdown for `mappedFieldKey`.

### 1.3 Where does "Save as Permanent Alias" persist to?
- **Persistence Mechanism:** In [`src/lib/headerMapping/HeaderAliasRegistry.ts`](file:///F:/SMRITRretailNX/src/lib/headerMapping/HeaderAliasRegistry.ts), custom aliases are stored in browser localStorage under key `"smriti_header_custom_aliases_v1"` via `addCustomAlias(targetFieldKey, sourceAlias)`.
- It maps normalized alias string $\to$ `fieldKey`.

### 1.4 UI Constraints on Source/Target Reuse:
- Currently, each source header has a single primary target dropdown.
- Mapping the same source column to multiple targets requires supporting either:
  1. Multiple targets per source column (e.g. `targets: { target: string; note?: string }[]`), OR
  2. Multi-target selection UI with badge/warning thresholds.

---

## 2. Phase 1: Data Model Definition

### 2.1 Updated Session Mapping Types
```ts
export interface MappingTarget {
  target: string;         // Smriti field key (e.g. "mrp", "price", "attr_color")
  targetLabel?: string;   // Display label (e.g. "MRP", "SELLING PRICE")
  note?: string;          // Optional reason text
}

export interface MultiTargetColumnMapping {
  sourceHeader: string;
  sourceIndex: number;
  targets: MappingTarget[];
  confidence: ConfidenceLevel;
  confidenceScore: number;
  isAmbiguous: boolean;
  isOverridden?: boolean;
}
```

### 2.2 Backward Compatibility
- A single-target mapping is represented seamlessly by `targets.length === 1` and `mappedFieldKey = targets[0].target`.
- Legacy `mappedFieldKey` and `mappedFieldLabel` accessors are preserved as getters/computed properties so existing consumers function without regressions.

---

## 3. Threshold Constants (Phase 3)

```ts
export const REUSE_WARNING_THRESHOLDS = {
  TIER_1_DEFAULT: 1,    // 1x: Normal display
  TIER_2_BADGE: 2,      // 2x: Neutral badge "Used 2x" + optional Reason note
  TIER_3_WARNING: 3,    // 3x: Yellow warning "Used 3x - confirm this is intentional"
  TIER_4_CONFIRM: 4     // 4x+: Yellow warning + Required Checkbox confirmation
} as const;
```

