import { describe, expect, it } from "vitest";
import { formatBillingDate } from "../components/billing/BillingWorkspace.tsx";
import { getRetailBusinessDate } from "../utils/formatters.ts";

describe("BillingWorkspace clock", () => {
  it("formats the supplied date instead of a fixed calendar date", () => {
    expect(formatBillingDate(new Date("2026-11-24T19:00:00Z"))).toBe("25 Nov 2026");
  });

  it("uses the Kolkata calendar date at UTC day boundaries", () => {
    expect(getRetailBusinessDate(new Date("2026-11-24T19:00:00Z"))).toBe("2026-11-25");
    expect(getRetailBusinessDate(new Date("2026-11-25T18:45:00Z"))).toBe("2026-11-26");
  });
});
