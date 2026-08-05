/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import { UniversalLookupRenderer } from "../components/common/renderers/ILookupRenderer.tsx";
import { NormalizedLookupItem } from "../kernel/SPK.js";

describe("UniversalLookupRenderer (Phase 3 Layout Renderers)", () => {
  const sampleItems: NormalizedLookupItem[] = [
    {
      id: "sku-1",
      title: "Cotton Classic Shirt",
      subtitle: "SKU-001",
      badge: { label: "In Stock", type: "success" },
      columns: { code: "SKU-001", name: "Cotton Classic Shirt", city: "Mumbai" },
      metadata: { brand: "Smriti" }
    }
  ];

  it("renders Table layout renderer by default", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <UniversalLookupRenderer
          layout="table"
          items={sampleItems}
          columns={[{ key: "code", label: "Code", type: "text" }]}
          onSelect={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Cotton Classic Shirt");
    expect(container.textContent).toContain("SKU-001");
    expect(container.querySelector("table")).toBeTruthy();

    act(() => { root.unmount(); });
    container.remove();
  });

  it("renders Gallery layout renderer for apparel/image grids", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <UniversalLookupRenderer
          layout="gallery"
          items={sampleItems}
          onSelect={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Cotton Classic Shirt");
    expect(container.textContent).toContain("In Stock");

    act(() => { root.unmount(); });
    container.remove();
  });

  it("renders Card layout renderer for customer CRM cards", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <UniversalLookupRenderer
          layout="card"
          items={sampleItems}
          onSelect={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Cotton Classic Shirt");
    expect(container.textContent).toContain("City: Mumbai");

    act(() => { root.unmount(); });
    container.remove();
  });
});
