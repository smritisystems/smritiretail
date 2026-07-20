<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.0.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS v5.0 — Enterprise Billing Terminal Framework Developer Guide

## 1. Coding Standards
- All billing terminal components must be developed using TypeScript React (`.tsx`).
- Type safety is strictly enforced. Avoid using `any`; define concrete interfaces.
- Standard dark theme HSL color tokens from the SMRITI Design System must be used. Avoid hardcoding Tailwind or custom hex codes.
- Do not introduce external dependencies for layout, grid, or key bindings; use native hooks and virtualized structures.

## 2. Component Design Hierarchy & Ownership

```text
src/components/terminal/
 ├── SharedTerminalFramework.tsx   [Owns window lifecycle, dark theme container, and terminal context]
 ├── PosTerminal.tsx               [Owns retail fast-checkout layouts and continuous scanning loop]
 ├── TaxInvoiceTerminal.tsx        [Owns GST-compliant invoice forms, transporter logs, and payment terms]
 ├── ImportEngine.tsx              [Owns import parsing and preview queues for quotes/orders]
 ├── RecallEngine.tsx              [Owns drafts and held transaction state lists]
 ├── ReturnEngine.tsx              [Owns reference-linked returns, credit note issues, and exchanges]
 ├── KeyboardEngine.tsx            [Owns shortcut routing maps and key override handlers]
 └── PaymentEngine.tsx             [Owns split-tender state and cash register calculators]
```

## 3. State Management Paradigm
State cascades down from context boundaries to avoid scattered state arrays across nested views:
```text
Terminal Context (Owns Shift, profile, and terminal mode state)
       ↓
Billing Context (Owns active Cart items, customer profile, and remarks)
       ↓
Transaction Context (Owns Discounts, line totals, and tax rate breakdowns)
       ↓
Payment Context (Owns split tender payment arrays and quick buttons)
       ↓
Offline Queue (Owns sync queues persisted in local storage cache)
```

- Terminals must maintain active transactional state locally (cart, customer, discounts) to ensure maximum rendering speed (< 100ms render loop).
- Committed transactions are queued locally in `sessionStorage` or IndexedDB before being pushed asynchronously via the Sync Engine to the backend, enabling offline checkout capability.
- Average average-item additions must run in under 150ms. Use `useMemo` and `useCallback` to avoid re-rendering cart lists.

## 4. Fullscreen Routing & Launchers
- URL parameters are parsed in `src/App.tsx` on initialization:
  ```typescript
  const queryParams = new URLSearchParams(window.location.search);
  const terminalMode = queryParams.get("terminal"); // 'pos' or 'tax'
  ```
- If `terminalMode` matches `pos` or `tax`, render `SharedTerminalFramework` directly to bypass the sidebar/header shell, providing a true fullscreen cashier panel.
- Terminals are triggered from Sales Studio using:
  ```typescript
  window.open(`${window.location.origin}/?terminal=pos`, '_blank', 'fullscreen=yes,scrollbars=yes');
  ```

## 5. Salesperson Engine Integration
Developers must implement salesperson binding in accordance with the config settings:
- Mode is resolved from the global config parameters: `config.salespersonMode` ('disabled' | 'single' | 'line').
- If single mode is enabled, map the salesperson selection dropdown to the billing header area:
  ```typescript
  interface BillingHeaderProps {
    salespersonMode: "disabled" | "single" | "line";
    selectedSalesperson: Employee | null;
    onAssignSalesperson: (emp: Employee) => void;
  }
  ```
- If line-level mode is active, the transaction grid must display a Salesperson column with dropdown selections populated from the Employee master registry context.

## 6. Keyboard Shortcut Framework Hook Example
Register key overrides and block browser defaults:
```typescript
import { useEffect } from "react";

export function useTerminalShortcuts(handlers: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let keyCombo = "";
      if (e.ctrlKey) keyCombo += "Ctrl+";
      if (e.altKey) keyCombo += "Alt+";
      keyCombo += e.key;

      if (handlers[keyCombo]) {
        e.preventDefault();
        handlers[keyCombo]();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
```

## 7. Barcode Scanner Continuous Mode Hook Example
Provides instant input capture and automatic quantity increments:
```typescript
import { useEffect, useRef } from "react";

export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const buffer = useRef("");
  const lastKeyTime = useRef(0);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      // Barcode scanner character sequence is typically extremely fast (< 30ms difference)
      if (currentTime - lastKeyTime.current > 50) {
        buffer.current = ""; // Reset buffer if typing slow (manual keyboard input)
      }
      
      lastKeyTime.current = currentTime;

      if (e.key === "Enter") {
        if (buffer.current.length > 2) {
          onScan(buffer.current);
          buffer.current = "";
        }
      } else {
        buffer.current += e.key;
      }
    };
    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [onScan]);
}
```

## 8. Extension Points Hook Example
Inject custom checkout checks using hook plugins:
```typescript
export interface TerminalPlugin {
  name: string;
  beforeSave?: (invoice: any) => boolean;
  afterSave?: (invoice: any) => void;
}

export class TerminalPluginRegistry {
  private static plugins: TerminalPlugin[] = [];

  public static register(plugin: TerminalPlugin) {
    this.plugins.push(plugin);
  }

  public static executeBeforeSave(invoice: any): boolean {
    for (const plugin of this.plugins) {
      if (plugin.beforeSave && !plugin.beforeSave(invoice)) {
        return false;
      }
    }
    return true;
  }
}
```
