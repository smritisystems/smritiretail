# SMRITI Workspace SDK v1.0
**Status:** FROZEN  
**Authority:** SXP Constitution v1.0  
**Author:** Jawahar Ramkripal Mallah · Chief Systems Architect  
**Copyright:** © SMRITIBooks.com. All Rights Reserved.

---

## Overview

The Workspace SDK defines how a new studio integrates into the SMRITI Experience Platform (SXP). A studio is a business domain workspace (Inventory, POS, Sales, Purchase, CRM, etc.).

Every studio must:
1. Create a co-located `*.manifest.ts` file
2. Auto-register on import (side-effect import pattern)
3. Mount inside `WorkspaceShell`
4. Use `canRender()` for adaptive visibility — never `mode ===`

---

## 1. Studio Manifest Contract

```typescript
// src/components/{domain}/{domain}.manifest.ts

import { WorkspaceRegistry } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceActionRegistry } from "../../layout_engine/WorkspaceActionRegistry.js";
import { DashboardRegistry } from "../../kernel/upr/dashboard/DashboardRegistry.js";

// 1. Declare actions
const MY_ACTIONS: WorkspaceActionDef[] = [
  {
    id: "my_domain.action_name",
    label: "Plain Language Label",       // Never ERP terminology
    icon: "📦",
    shortcut: "F5",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true };
    },
  },
];

// 2. Declare workspaces
const MY_WORKSPACES: WorkspaceManifest[] = [
  {
    id: "my_domain.dashboard",
    title: "My Dashboard",
    icon: "📊",
    domainId: "my_domain",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "dashboard",
    mobileEnabled: true,
    actions: ["my_domain.action_name"],
    widgets: ["w_my_kpi"],
  },
];

// 3. Register
export function registerMyStudio(): void {
  MY_ACTIONS.forEach((a) => WorkspaceActionRegistry.register(a));
  MY_WORKSPACES.forEach((w) => WorkspaceRegistry.register(w));
}

// 4. Auto-register on import (side-effect pattern)
registerMyStudio();
```

---

## 2. WorkspaceShell Integration

Every studio workspace component renders inside `WorkspaceShell`:

```tsx
import { WorkspaceShell } from "../../layout_engine/components/WorkspaceShell.js";
import { WorkspaceRegistry } from "../../layout_engine/WorkspaceRegistry.js";

export const MyDashboard: React.FC = () => {
  const metadata = WorkspaceRegistry.get("my_domain.dashboard")!;

  return (
    <WorkspaceShell
      metadata={metadata}
      filterStrip={<MyFilterBar />}    // optional
      body={<MyDashboardBody />}
    />
  );
};
```

`WorkspaceShell` provides: breadcrumbs, action bar (via metadata.actions), zone class, mobile layout.

---

## 3. Adaptive Visibility

```tsx
import { useSmritiExperience } from "../../context/SmritiExperienceContext.js";

const { canRender, mode } = useSmritiExperience();

// CORRECT — uses canRender with feature key
{canRender("cost_layers") && <CostLayerWidget />}
{canRender("reservations") && <ReservationPanel />}

// PROHIBITED — direct mode comparison
{mode === "ADVANCED" && <CostLayerWidget />}  // ❌ Architecture violation
```

---

## 4. Action Execution

Actions are **never** called directly. Always go through the registry:

```typescript
import { WorkspaceActionRegistry } from "../../layout_engine/WorkspaceActionRegistry.js";

const result = await WorkspaceActionRegistry.execute("receive_stock", {
  tenantId: "default",
  userId: "current_user",
  workspaceId: "inventory.operations",
  mode: "HYBRID",
});
```

---

## 5. OperationLauncher (SWEF P-007)

```tsx
import { OperationLauncher } from "../shared/OperationLauncher.js";

<OperationLauncher
  actionIds={["receive_stock", "transfer_stock", "adjust_stock"]}
  getOperationDef={(actionId) => {
    if (actionId === "receive_stock") return {
      actionId: "receive_stock",
      mode: "wizard",              // wizard | quick_action | bulk_action | scanner_action
      context: executionContext,
      steps: [...],               // MAX 3 steps for scanner_action
    };
    return null;                  // null = direct execute (no modal)
  }}
  executionContext={executionContext}
/>
```

`MAX_STEPS` is enforced by `OperationLauncher`:
- `wizard`: 5 steps max
- `quick_action`: 2 steps max
- `scanner_action`: **3 steps** (SWEF P-007, non-negotiable)
- `bulk_action`: 3 steps max

---

## 6. Workspace Navigation

```typescript
import { WorkspaceNavigationEngine } from "../../layout_engine/WorkspaceNavigationEngine.js";

// Navigate to a workspace
WorkspaceNavigationEngine.navigate("inventory.dashboard");

// Navigate with breadcrumb trail
WorkspaceNavigationEngine.navigate("inventory.scan");

// Go back
WorkspaceNavigationEngine.goBack();
```

---

## 7. Offline Operations

```typescript
import { OfflineExperienceManager } from "../../layout_engine/OfflineExperienceManager.js";

// Check connectivity before API call
if (!OfflineExperienceManager.getIsOnline()) {
  OfflineExperienceManager.enqueue("stock_receipt", "inventory.operations", {
    productId, quantity, warehouseId,
  });
  return { success: true, queued: true };
}
// else: proceed with API call
```

Register a sync handler in the manifest:
```typescript
OfflineExperienceManager.registerHandler("stock_receipt", async (op) => {
  const result = await apiFetchV1("/api/v1/inventory/receipts", { method: "POST", body: op.payload });
  return { success: result.ok };
});
```

---

## 8. ExperienceZone Reference

| Zone | Use When |
|---|---|
| `dashboard` | KPI overview, timeline, alerts |
| `operator` | Action grid, filtered list |
| `document` | Object page (master record detail) |
| `scanner` | Barcode scan, 3-interaction flow |
| `executive` | Reports, charts |
| `approval` | Approval queue + detail split |

---

## 9. Studio Certification Checklist (SXP-CS)

Before a studio ships to production, it must pass all 12 gates (see `SXP_CERTIFICATION_STANDARD_V1.md`).
