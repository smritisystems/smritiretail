# SMRITI Widget SDK v1.0
**Status:** FROZEN  
**Authority:** SXP Constitution v1.0 / UDR Standard v1.0  
**Author:** Jawahar Ramkripal Mallah · Chief Systems Architect  
**Copyright:** © SMRITIBooks.com. All Rights Reserved.

---

## Overview

The Widget SDK defines how widgets are built, registered, and rendered on the SXP platform. Widgets are the atomic visual units of dashboard workspaces.

---

## 1. Available Widget Types

| Type | Component | Use For |
|---|---|---|
| `summary_card` | `SummaryCard` | Single KPI value with unit |
| `trend_card` | `TrendCard` | Sparkline + 7-day trend |
| `action_card` | `ActionCard` | Single-click action tile |
| `alert_card` | `AlertCard` | Info / Warning / Critical alerts |
| `timeline_card` | `TimelineCard` | Wrapped `WorkspaceTimeline` |
| `progress_card` | `KPIProgressCard` | Goal vs actual progress bar |

---

## 2. Widget Registration

Widgets are declared in the studio's `DashboardRegistry.registerDashboard()` call inside `*.manifest.ts`:

```typescript
DashboardRegistry.registerDashboard({
  id: "dash.my_domain_overview",
  name: "My Domain Dashboard",
  description: "...",
  domainId: "my_domain",
  permissionId: "my_domain.read",
  widgets: [
    {
      id: "w_my_kpi",
      title: "Total Value",
      type: "summary_card",              // Must be a registered WidgetType
      gridSpan: { colSpan: 3, rowSpan: 1 },
      entityId: "my_entity",
      widgetGroup: "health",             // "health" | "alerts" | "operations" | "planning"
      adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
      refreshIntervalMs: 60_000,         // optional: auto-refresh
    },
  ],
});
```

---

## 3. Widget Components API

### SummaryCard
```tsx
<SummaryCard
  title="Total Stock Value"
  value="₹24,87,450"
  subtitle="Across all locations"
  icon="💰"
  accent            // highlights with brand color border
/>
```

### TrendCard
```tsx
<TrendCard
  title="Units Moved (7 Days)"
  data={[{ label: "Mon", value: 420 }, ...]}
  unit=" units"
  positive          // green trend indicator
  changeLabel="+15.6%"
/>
```

### AlertCard
```tsx
<AlertCard
  alerts={[
    {
      id: "a1",
      severity: "warning",   // "info" | "warning" | "critical"
      title: "Stock Below Reorder Point",
      description: "...",
      raisedAt: new Date().toISOString(),
      actionLabel: "Order Now",
    },
  ]}
  onDismiss={(id) => dismissAlert(id)}
/>
```

### KPIProgressCard
```tsx
<KPIProgressCard
  title="Stock Health Score"
  current={78}
  target={100}
  unit="%"
  direction="high_is_good"   // "high_is_good" | "low_is_good"
  icon="❤️"
/>
```

### TimelineCard
```tsx
<TimelineCard
  title="Stock Movement Timeline"
  adapter={InventoryTimelineAdapter}
  entityId="product-123"
  limit={8}
/>
```

---

## 4. WorkspaceTimeline Adapter Contract

To add domain-specific timeline data, implement a `TimelineAdapter`:

```typescript
import { TimelineAdapter, TimelineEntry } from "../shared/WorkspaceTimeline.js";

export const MyDomainTimelineAdapter: TimelineAdapter = {
  id: "my_domain",
  label: "My Domain Events",
  async fetchEntries(entityId: string, limit: number): Promise<TimelineEntry[]> {
    const data = await apiFetchV1(`/api/v1/my_domain/timeline/${entityId}?limit=${limit}`);
    return data.map((item) => ({
      id: item.id,
      status: item.completed ? "completed" : "active",  // "completed" | "active" | "pending" | "cancelled"
      title: item.plainLanguageTitle,   // Never use ERP event codes
      subtitle: item.description,
      timestamp: item.createdAt,
      icon: "📦",
    }));
  },
};
```

Register the adapter in the manifest (or pass directly as prop):
```tsx
<WorkspaceTimeline adapter={MyDomainTimelineAdapter} entityId={selectedId} limit={5} />
```

---

## 5. WidgetEngine Lifecycle

`WidgetEngine` manages health reporting and lifecycle for all registered widgets:

```typescript
import { WidgetEngine } from "../../layout_engine/WidgetEngine.js";

// Get widgets by group for a dashboard
const groupedWidgets = WidgetEngine.getWidgetsByGroup("dash.my_domain_overview", mode);

// Report a widget render failure
WidgetEngine.reportHealth("w_my_kpi", { status: "error", errorMessage: "API timeout" });
```

---

## 6. Adaptive Visibility in Widgets

All widgets must declare `adaptiveVisibility` in their DashboardRegistry metadata. The `WidgetEngine` filters widgets automatically based on current mode — studios do not filter manually.

```typescript
// In DashboardRegistry metadata:
adaptiveVisibility: ["HYBRID", "ADVANCED"]  // widget hidden in SIMPLE mode

// In component code (for conditional sections within a widget):
const { canRender } = useSmritiExperience();
{canRender("cost_layers") && <CostBreakdown />}
```

---

## 7. Widget Grid Layout

Widgets use `gridSpan` to declare their column footprint:

```typescript
gridSpan: { colSpan: 3, rowSpan: 1 }   // Quarter width on 12-col grid
gridSpan: { colSpan: 6, rowSpan: 2 }   // Half width, double height
gridSpan: { colSpan: 12, rowSpan: 1 }  // Full width
```

The `WorkspaceShell` dashboard zone renders a 12-column responsive grid. On mobile (<768px), all widgets collapse to full width automatically.
