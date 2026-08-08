/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import { ItemMasterStudioContextPanel, ItemMasterStudioConsole } from "../components/item_master/ItemMasterStudioPanels.tsx";

describe("ItemMaster studio panels", () => {
  it("renders selected-item context and lifecycle guidance", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const product = {
      id: "sku-1",
      code: "SKU-001",
      sku: "SKU-001",
      name: "Classic Shirt",
      category: "Apparel",
      brand: "Smriti",
      price: 1200,
      mrp: 1400,
      purchasePrice: 900,
      stock_qty: 12,
      min_stock_level: 5,
    } as any;

    act(() => {
      root.render(
        React.createElement(ItemMasterStudioContextPanel, {
          product,
          lowStockCount: 1,
          inventorySummary: { totalProducts: 12, totalStockQty: 120, totalValuation: 120000 },
        })
      );
    });

    expect(container.textContent).toContain("Selected Item");
    expect(container.textContent).toContain("Classic Shirt");
    expect(container.textContent).toContain("Lifecycle");
    expect(container.textContent).toContain("Approve");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the studio console with live status messages", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(ItemMasterStudioConsole, {
          messages: ["Draft saved", "5 validation issues"],
        })
      );
    });

    expect(container.textContent).toContain("Studio Console");
    expect(container.textContent).toContain("Draft saved");
    expect(container.textContent).toContain("5 validation issues");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
