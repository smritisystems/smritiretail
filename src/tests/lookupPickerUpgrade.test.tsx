/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import { LookupPicker } from "../components/LookupPicker.tsx";
import { SPK } from "../kernel/SPK.js";

describe("LookupPicker.tsx — Phase 2 ULE Discovery Upgrade", () => {
  it("renders inline field input and launches ULE modal discovery mode on F2 / expand click", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChange = vi.fn();

    // Seed mock provider in SPK.ule
    SPK.ule.registerProvider({
      domain: "SUPPLIER",
      manifest: {
        manifestVersion: "2.3.0",
        schemaVersion: "1.0.0",
        minimumKernelVersion: "1.0.0",
        domain: "SUPPLIER",
        title: "Supplier Sourcing Discovery",
        icon: "building",
        defaultColumns: [{ key: "name", label: "Supplier Name", type: "text" }],
        searchFields: ["name", "code"],
        filterGroups: [],
        sortOptions: [{ label: "Name", key: "name", order: "asc" }],
        savedViews: [],
        permissions: { readScope: "supplier:read" },
        quickActions: [],
        keyboardShortcuts: { universalSearch: "F2" },
        defaultLayout: "table",
        supportedModes: ["field", "grid", "workspace", "global"],
        capabilities: { barcode: false, qr: true, voice: false, ai: true, bulkSelection: true, quickCreate: true }
      },
      search: async (query: string) => [
        { id: "sup-1", code: "SUP-001", name: "Raymond Textiles", type: "SUPPLIER", metadata: {} }
      ],
      getById: async (id: string) => ({
        id, code: "SUP-001", name: "Raymond Textiles", type: "SUPPLIER", metadata: {}
      })
    });

    act(() => {
      root.render(
        <LookupPicker
          typeCode="SUPPLIER"
          onChange={onChange}
          placeholder="Select Supplier..."
          mode="inline"
        />
      );
    });

    expect(container.textContent).toContain("Select Supplier...");
    expect(container.textContent).toContain("F2");

    // Click expand button to trigger modal discovery mode
    const expandBtn = container.querySelector("button[title='Expand Universal Discovery (F2)']") as HTMLButtonElement | null;
    expect(expandBtn).toBeTruthy();

    await act(async () => {
      expandBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Supplier Sourcing Discovery");
    expect(container.textContent).toContain("SMRITI Discovery (F2)");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
