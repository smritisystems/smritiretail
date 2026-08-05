/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import { ItemMasterToolbar } from "../components/item_master/ItemMasterToolbar.tsx";

describe("ItemMasterToolbar", () => {
  it("renders 5 primary studio view tabs (List, Spreadsheet, Product, Variants, Import)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onModeChange = vi.fn();

    act(() => {
      root.render(
        <ItemMasterToolbar
          activeMode="excel-grid"
          onModeChange={onModeChange}
          searchTerm=""
          onSearchChange={vi.fn()}
          productCount={12}
          onNewProduct={vi.fn()}
          onRefresh={vi.fn()}
          onOpenBarcodeHub={vi.fn()}
          isReadOnly={false}
        />
      );
    });

    expect(container.textContent).toContain("List");
    expect(container.textContent).toContain("Spreadsheet");
    expect(container.textContent).toContain("Product");
    expect(container.textContent).toContain("Variants");
    expect(container.textContent).toContain("Import");

    const listButton = container.querySelector("#im-mode-explorer") as HTMLButtonElement | null;
    expect(listButton).toBeTruthy();

    act(() => {
      listButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onModeChange).toHaveBeenCalledWith("explorer");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
