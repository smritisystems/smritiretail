/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 1.0.0
 * * Created    : 2026-10-13
 * * Modified   : 2026-10-13
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import { FIELD_TO_ELEMENT_ID } from "../services/itemMasterValidationMapper.ts";

describe("GovernedLookupCombobox DOM Contract & Field Mapping", () => {
  it("preserves exact canonical element ID for Brand lookup input", () => {
    expect(FIELD_TO_ELEMENT_ID["brand"]).toBe("im-field-brand");
  });

  it("preserves exact canonical element ID for Category lookup input", () => {
    expect(FIELD_TO_ELEMENT_ID["category"]).toBe("im-field-category");
  });

  it("preserves exact canonical element ID for Sub-Category lookup input", () => {
    expect(FIELD_TO_ELEMENT_ID["subcategory"]).toBe("im-field-subcategory");
    expect(FIELD_TO_ELEMENT_ID["subCategory"]).toBe("im-field-subcategory");
    expect(FIELD_TO_ELEMENT_ID["sub_category"]).toBe("im-field-subcategory");
  });

  it("preserves exact canonical element ID for Department lookup input", () => {
    expect(FIELD_TO_ELEMENT_ID["department"]).toBe("im-field-department");
    expect(FIELD_TO_ELEMENT_ID["dept"]).toBe("im-field-department");
  });

  it("preserves exact canonical element ID for Size Group lookup input", () => {
    expect(FIELD_TO_ELEMENT_ID["size_group"]).toBe("im-field-size_group");
    expect(FIELD_TO_ELEMENT_ID["sizeGroup"]).toBe("im-field-size_group");
    expect(FIELD_TO_ELEMENT_ID["size_group_id"]).toBe("im-field-size_group");
  });

  it("filters lookup options case-insensitively and returns matching items", () => {
    const rawOptions = [
      { code: "NIKE", name: "Nike" },
      { code: "ADIDAS", name: "Adidas" },
      { code: "PUMA", name: "Puma" },
      { code: "REBOK", name: "Reebok" },
    ];

    const filterComboboxOptions = (opts: typeof rawOptions, query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return opts;
      return opts.filter(
        (o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
      );
    };

    expect(filterComboboxOptions(rawOptions, "ad")).toHaveLength(1);
    expect(filterComboboxOptions(rawOptions, "ad")[0].name).toBe("Adidas");
    expect(filterComboboxOptions(rawOptions, "puma")).toHaveLength(1);
    expect(filterComboboxOptions(rawOptions, "puma")[0].name).toBe("Puma");
    expect(filterComboboxOptions(rawOptions, "")).toHaveLength(4);
    expect(filterComboboxOptions(rawOptions, "xyz")).toHaveLength(0);
  });
});
