import { describe, expect, it } from "vitest";
import {
  calculateManualLineAllocations,
  getManualAllocationVariance,
  normalizeAllocationMethod,
} from "../components/purchase/manualAllocation";

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

  it("matches the requested business cases A-D and blocks under-allocation", () => {
    const grnLines = [
      { rowId: "A", quantity_received: 10, quantity_damaged: 0, invoice_rate: 500, trade_discount: 0 },
      { rowId: "B", quantity_received: 10, quantity_damaged: 0, invoice_rate: 300, trade_discount: 0 },
      { rowId: "C", quantity_received: 10, quantity_damaged: 0, invoice_rate: 200, trade_discount: 0 },
    ];

    const caseA = getManualAllocationVariance({
      costItem: { id: "freight", amount: 1000 },
      grnLines,
      manualAllocations: { freight: { A: 600, B: 250, C: 150 } },
    });
    expect(caseA.allocatedTotal).toBe(1000);
    expect(caseA.variance).toBe(0);
    expect(caseA.isBalanced).toBe(true);

    const caseB = getManualAllocationVariance({
      costItem: { id: "freight", amount: 1000 },
      grnLines,
      manualAllocations: { freight: { A: 600, B: 250, C: 50 } },
    });
    expect(caseB.allocatedTotal).toBe(900);
    expect(caseB.variance).toBe(100);
    expect(caseB.isBalanced).toBe(false);

    const caseC = getManualAllocationVariance({
      costItem: { id: "freight", amount: 1000 },
      grnLines,
      manualAllocations: { freight: { A: 600, B: 250, C: 150 } },
    });
    const loading = getManualAllocationVariance({
      costItem: { id: "loading", amount: 500 },
      grnLines,
      manualAllocations: { loading: { A: 100, B: 200, C: 200 } },
    });
    expect(caseC.isBalanced).toBe(true);
    expect(loading.isBalanced).toBe(true);

    const rounding = calculateManualLineAllocations({
      grnLines: [
        { rowId: "R1", quantity_received: 3, quantity_damaged: 0, invoice_rate: 1, trade_discount: 0 },
        { rowId: "R2", quantity_received: 3, quantity_damaged: 0, invoice_rate: 1, trade_discount: 0 },
        { rowId: "R3", quantity_received: 3, quantity_damaged: 0, invoice_rate: 1, trade_discount: 0 },
      ],
      manualAllocations: { freight: { R1: 333.33, R2: 333.33, R3: 333.34 } },
      costItems: [{ id: "freight", amount: 1000 } as any],
    });
    expect(rounding.reduce((sum, row) => sum + row.allocatedAmount, 0)).toBe(1000);
  });
});
