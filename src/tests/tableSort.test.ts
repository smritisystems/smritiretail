/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-11-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Unit Test
 */

import { describe, it, expect } from "vitest";
import { sortTableData } from "../utils/tableSort.ts";

describe("Universal Multi-Type Column Sorting Engine (sortTableData)", () => {
  const sampleData = [
    { id: "1", name: "Reliance", total: 15000, date: "2026-08-12" },
    { id: "2", name: "Trent", total: 5000, date: "2026-08-15" },
    { id: "3", name: "Aditya Birla", total: 25000, date: "2026-08-01" },
  ];

  it("should sort numbers ascending and descending", () => {
    const asc = sortTableData(sampleData, "total", "asc");
    expect(asc[0].name).toBe("Trent"); // 5000
    expect(asc[2].name).toBe("Aditya Birla"); // 25000

    const desc = sortTableData(sampleData, "total", "desc");
    expect(desc[0].name).toBe("Aditya Birla"); // 25000
    expect(desc[2].name).toBe("Trent"); // 5000
  });

  it("should sort strings alphabetically", () => {
    const asc = sortTableData(sampleData, "name", "asc");
    expect(asc[0].name).toBe("Aditya Birla");
    expect(asc[1].name).toBe("Reliance");
    expect(asc[2].name).toBe("Trent");

    const desc = sortTableData(sampleData, "name", "desc");
    expect(desc[0].name).toBe("Trent");
    expect(desc[2].name).toBe("Aditya Birla");
  });

  it("should sort dates chronologically", () => {
    const asc = sortTableData(sampleData, "date", "asc");
    expect(asc[0].name).toBe("Aditya Birla"); // 2026-08-01
    expect(asc[1].name).toBe("Reliance");     // 2026-08-12
    expect(asc[2].name).toBe("Trent");        // 2026-08-15

    const desc = sortTableData(sampleData, "date", "desc");
    expect(desc[0].name).toBe("Trent");
    expect(desc[2].name).toBe("Aditya Birla");
  });

  it("should handle null or empty data gracefully", () => {
    expect(sortTableData([], "name", "asc")).toEqual([]);
    expect(sortTableData(sampleData, null, "asc")).toEqual(sampleData);
  });
});
