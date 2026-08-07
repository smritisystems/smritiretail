# F2 Search & Command Palette Hotkey Precedence Policy

**Standard:** F2-GOV-001 (FROZEN)  
**Target:** Resolves hotkey collision across Command Palette, Master Pickers, and Data Grids.

---

## Precedence Hierarchy

When the `F2` key is pressed, the event MUST evaluate through the following 3-level priority chain:

| Priority | Layer | Behavior |
| --- | --- | --- |
| **Level 1 (Highest)** | **Active Modal / Master Lookup Picker** | If an active lookup dialog, dropdown, or master picker modal is open, `F2` focuses its local filter input. |
| **Level 2** | **Active Grid / Spreadsheet Cell Editor** | If an editable data grid cell is focused (e.g. `ExcelGridEntrySection`, `SalesBillingStudio`), `F2` opens inline cell editing mode. |
| **Level 3 (Lowest)** | **Global UDCP Search & Command Palette** | If no modal or editable grid cell is focused, `F2` opens the global Universal Discovery & Command Palette (`SPK.search`). |

---

## Consumer Compliance Checklist

- [x] `PosTerminalTab` — Level 3 delegate (Global search)
- [x] `CustomerMasterTab` — Level 1 lookup picker
- [x] `PurchaseOperationsStudio` — Level 2 inline cell editor
- [x] `ExcelGridEntrySection` — Level 2 grid cell editor
- [x] `SalesBillingStudio` — Level 2 POS quick-item entry
