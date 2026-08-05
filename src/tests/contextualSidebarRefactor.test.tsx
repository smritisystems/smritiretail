/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import { ContextualSidebar } from "../components/common/ContextualSidebar.tsx";
import { SPK } from "../kernel/SPK.js";

describe("ContextualSidebar.tsx — SPK.navigation Registry Binding Refactoring", () => {
  it("dynamically resolves domain and modules from active workspace context without hardcoded maps", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSelectTab = vi.fn();

    act(() => {
      root.render(
        <ContextualSidebar
          activeTab="item-master"
          onSelectTab={onSelectTab}
          onReturnToLaunchpad={vi.fn()}
        />
      );
    });

    // Should resolve Inventory & Stock Domain dynamically from SPK.navigation for workspace "item-master"
    expect(container.textContent).toContain("Inventory & Stock Domain");
    expect(container.textContent).toContain("Product Master");
    expect(container.textContent).toContain("Stock Ledger");

    act(() => { root.unmount(); });
    container.remove();
  });

  it("automatically switches sidebar items when switching to purchase workspace tab", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ContextualSidebar
          activeTab="purchase"
          onSelectTab={vi.fn()}
          onReturnToLaunchpad={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Purchase & Sourcing Domain");
    expect(container.textContent).toContain("Procurement POs");
    expect(container.textContent).toContain("Supplier Registry");

    act(() => { root.unmount(); });
    container.remove();
  });
});
