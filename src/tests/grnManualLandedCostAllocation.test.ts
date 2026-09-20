import { describe, expect, it } from "vitest";
import { calculateManualLineAllocations, normalizeAllocationMethod } from "../components/purchase/manualAllocation";

describe("GRN manual landed cost allocation engine", () => {
  it("normalizes allocation method strings consistently", () => {
    expect(normalizeAllocationMethod("manual")).toBe("MANUAL");
    expect(normalizeAllocationMethod("VALUE")).toBe("VALUE");
    expect(normalizeAllocationMethod("quantity")).toBe("QUANTITY");
  });

  it("reconciles manual allocations across rows and recalculates landed cost", () => {
    const grnLines = [
      {
        rowId: "r1",
        quantity_received: 10,
        quantity_damaged: 0,
        invoice_rate: 100,
        trade_discount: 0,
      },
      {
        rowId: "r2",
        quantity_received: 20,
        quantity_damaged: 2,
        invoice_rate: 80,
        trade_discount: 0,
      },
    ];

    const manualAllocations = {
      c1: {
        r1: 100,
        r2: 150,
      },
    };

    const allocations = calculateManualLineAllocations({
      grnLines,
      manualAllocations,
      totalAddons: 250,
      totalPurchaseValue: 2000,
      costItems: [{ id: "c1", amount: 250 } as any],
    });

    expect(allocations[0].allocatedAmount).toBe(100);
    expect(allocations[1].allocatedAmount).toBe(150);
    expect(allocations[0].landedCost).toBe(110);
    expect(allocations[1].landedCost).toBe(88.33);
    expect(allocations.reduce((sum, row) => sum + row.allocatedAmount, 0)).toBe(250);
  });

  it("blocks under-allocation and over-allocation for manual posting", () => {
    const grnLines = [
      { rowId: "r1", quantity_received: 5, quantity_damaged: 0, invoice_rate: 100, trade_discount: 0 },
      { rowId: "r2", quantity_received: 10, quantity_damaged: 0, invoice_rate: 80, trade_discount: 0 },
    ];

    const under = calculateManualLineAllocations({
      grnLines,
      manualAllocations: { c1: { r1: 600, r2: 200 } },
      costItems: [{ id: "c1", amount: 1000 } as any],
    });
    expect(under.reduce((sum, row) => sum + row.allocatedAmount, 0)).toBe(800);

    const over = calculateManualLineAllocations({
      grnLines,
      manualAllocations: { c1: { r1: 600, r2: 500 } },
      costItems: [{ id: "c1", amount: 1000 } as any],
    });
    expect(over.reduce((sum, row) => sum + row.allocatedAmount, 0)).toBe(1100);
  });

  it("treats zero accepted quantity lines safely and preserves base purchase cost when no add-on exists", () => {
    const grnLines = [
      { rowId: "r1", quantity_received: 5, quantity_damaged: 5, invoice_rate: 100, trade_discount: 0 },
      { rowId: "r2", quantity_received: 10, quantity_damaged: 0, invoice_rate: 90, trade_discount: 5 },
    ];

    const zeroAddon = calculateManualLineAllocations({
      grnLines,
      manualAllocations: { c1: { r1: 0, r2: 0 } },
      costItems: [{ id: "c1", amount: 0 } as any],
    });

    expect(zeroAddon[0].allocatedAmount).toBe(0);
    expect(zeroAddon[0].landedCost).toBe(100);
    expect(zeroAddon[1].allocatedAmount).toBe(0);
    expect(zeroAddon[1].landedCost).toBe(85);
  });

  it("sums multi-component manual allocations into each row landed cost", () => {
    const grnLines = [
      { rowId: "r1", quantity_received: 10, quantity_damaged: 0, invoice_rate: 100, trade_discount: 0 },
      { rowId: "r2", quantity_received: 20, quantity_damaged: 2, invoice_rate: 80, trade_discount: 0 },
    ];

    const allocations = calculateManualLineAllocations({
      grnLines,
      manualAllocations: {
        freight: { r1: 600, r2: 400 },
        loading: { r1: 100, r2: 200 },
      },
      costItems: [{ id: "freight", amount: 1000 } as any, { id: "loading", amount: 300 } as any],
    });

    expect(allocations[0].allocatedAmount).toBe(700);
    expect(allocations[1].allocatedAmount).toBe(600);
    expect(allocations[0].landedCost).toBe(170);
    expect(allocations[1].landedCost).toBe(113.33);
  });
});
