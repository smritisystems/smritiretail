/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import { ItemMasterToolbar } from "../components/item_master/ItemMasterToolbar.tsx";

describe("ItemMasterToolbar", () => {
  it("renders overview and explorer as first-class studio views", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onModeChange = vi.fn();

    act(() => {
      root.render(
        React.createElement(ItemMasterToolbar, {
          activeMode: "overview",
          onModeChange,
          searchTerm: "",
          onSearchChange: vi.fn(),
          productCount: 12,
          onNewProduct: vi.fn(),
          onRefresh: vi.fn(),
          onOpenBarcodeHub: vi.fn(),
          isReadOnly: false,
        })
      );
    });

    expect(container.textContent).toContain("Overview");
    expect(container.textContent).toContain("Explorer");
    expect(container.textContent).toContain("Create");
    expect(container.textContent).toContain("Spreadsheet");
    expect(container.textContent).toContain("Pricing");
    expect(container.textContent).toContain("Studio Layers");
    expect(container.textContent).toContain("Workspace");

    const explorerButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Explorer")
    ) as HTMLButtonElement | undefined;

    expect(explorerButton).toBeTruthy();

    act(() => {
      explorerButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onModeChange).toHaveBeenCalledWith("explorer");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
