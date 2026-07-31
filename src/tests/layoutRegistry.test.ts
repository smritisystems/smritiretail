/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Layout Registry (UFR-005) Unit Tests
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 & UFR v1.0 Standard Compliance
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { LayoutRegistry, type LayoutDefinition } from "../kernel/upr/forms/LayoutRegistry.js";

describe("Universal Layout Registry (UFR-005 Layout Core)", () => {
  beforeEach(() => {
    LayoutRegistry.clear();
  });

  it("should seed default layouts (standard-12-col, compact-grid, two-column-equal)", () => {
    const layouts = SPK.layouts.getLayouts();
    expect(layouts.length).toBeGreaterThanOrEqual(3);

    const ids = layouts.map((l) => l.id);
    expect(ids).toContain("standard-12-col");
    expect(ids).toContain("compact-grid");
    expect(ids).toContain("two-column-equal");
  });

  it("should resolve responsive grid classes correctly from layout metadata", () => {
    const span6Class = SPK.layouts.resolveGridClass(6, "standard-12-col");
    expect(span6Class).toBe("col-span-12 md:col-span-6 lg:col-span-6");

    const span4Class = SPK.layouts.resolveGridClass(4, "compact-grid");
    expect(span4Class).toContain("col-span-12");
  });

  it("should allow dynamic registration of custom plugin layouts", () => {
    const customLayout: LayoutDefinition = {
      id: "jewellery-master-layout",
      name: "Jewellery Special Layout",
      totalColumns: 12,
      defaultDensity: "compact",
      stylePattern: "card-grid",
      breakpoints: {
        mobile: 12,
        tablet: 6,
        desktop: 4
      }
    };

    SPK.layouts.registerLayout(customLayout);

    const resolved = SPK.layouts.getLayout("jewellery-master-layout");
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("Jewellery Special Layout");
  });
});
