/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import { AdaptiveWorkspaceGrid } from "../components/common/AdaptiveWorkspaceGrid.tsx";
import { WorkspacePersonalizationEngine } from "../layout_engine/WorkspacePersonalizationEngine.ts";

const widgets = [
  {
    id: "sales-kpi",
    title: "Sales KPI",
    type: "kpi",
    gridSpan: { colSpan: 4, rowSpan: 1 },
  },
  {
    id: "inventory-heatmap",
    title: "Inventory Heatmap",
    type: "chart",
    gridSpan: { colSpan: 8, rowSpan: 1 },
  },
] as any;

describe("AdaptiveWorkspaceGrid", () => {
  beforeEach(() => {
    localStorage.clear();
    WorkspacePersonalizationEngine.clearDashboardLayout("inventory-dashboard");
  });

  it("persists hide/show personalization in the saved workspace layout", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(AdaptiveWorkspaceGrid, {
          workspaceId: "inventory-dashboard",
          widgets,
          renderWidget: (widget: any) => React.createElement("div", null, widget.title),
        })
      );
    });

    const hideButtons = Array.from(container.querySelectorAll("button")).filter((button) => button.textContent?.includes("Hide"));
    expect(hideButtons.length).toBeGreaterThan(0);

    act(() => {
      hideButtons[0].click();
    });

    const savedLayout = WorkspacePersonalizationEngine.getDashboardLayout("inventory-dashboard");
    expect(savedLayout.some((entry) => entry.widgetId === "sales-kpi" && entry.hidden === true)).toBe(true);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
