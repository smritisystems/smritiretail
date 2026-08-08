/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

vi.mock("../components/common/FioriObjectPage.tsx", () => ({
  SEEFObjectPage: ({ title, subtitle }: any) => React.createElement("div", null, `${title}::${subtitle}`),
}));

vi.mock("../components/item_master/ItemMasterUomMatrix.tsx", () => ({
  ItemMasterUomMatrix: () => React.createElement("div", null, "UOM"),
}));

vi.mock("../components/item_master/ItemMasterVariantTable.tsx", () => ({
  ItemMasterVariantTable: () => React.createElement("div", null, "Variants"),
}));

vi.mock("../components/item_master/ItemMasterPrintHistoryTab.tsx", () => ({
  ItemMasterPrintHistoryTab: () => React.createElement("div", null, "Print History"),
}));

import { ItemMasterFormInspector } from "../components/item_master/ItemMasterFormInspector.tsx";

describe("ItemMasterFormInspector", () => {
  it("renders correctly when switching from no selection to a selected product", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);

    const mockProduct = {
      id: "sku-1",
      code: "SKU-001",
      sku: "SKU-001",
      name: "Test Product",
      category: "General",
      brand: "Smriti",
      mrp: 100,
      price: 90,
      purchase_price: 60,
      stock_qty: 10,
      min_stock_level: 5,
      uom: "Pcs",
    } as any;

    act(() => {
      root.render(
        React.createElement(ItemMasterFormInspector, {
          product: null,
          onSaveProduct: vi.fn(),
          onDeleteProduct: vi.fn(),
          onOpenBarcodeDialog: vi.fn(),
        })
      );
    });

    expect(container.textContent).toContain("No Product Selected");

    act(() => {
      root.render(
        React.createElement(ItemMasterFormInspector, {
          product: mockProduct,
          onSaveProduct: vi.fn(),
          onDeleteProduct: vi.fn(),
          onOpenBarcodeDialog: vi.fn(),
        })
      );
    });

    expect(container.textContent).toContain("Test Product");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
