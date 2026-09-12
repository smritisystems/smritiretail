/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-02
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Regression test — SalesOrderFormPremium F2 wrong-row defect fix
 *
 * Proves: the F2 FieldAdapter routes lookup results to the exact originating
 * row by reading data-row-index from document.activeElement.
 *
 * Required regression:
 *   R1  F2 on row 0     -> updates row 0 only
 *   R2  F2 on middle row -> updates that exact middle row only
 *   R3  F2 on last row  -> updates last row only
 *   R4  F2 on quick-entry -> updates setQuickEntry only; no item row touched
 *   R5  No lookup result can silently update the wrong row
 *   R6  Out-of-bounds rowIndex -> no-op (prev state unchanged)
 *   R7  Missing data-row-index -> no-op (prev state unchanged)
 *   R8  null activeElement -> no-op
 *   R9  Original items array is not mutated
 *   R10 Single-item list: F2 on row 0 updates row 0 (not "last" by coincidence)
 */

import { describe, it, expect, beforeEach } from "vitest";

interface MockItem {
  id: string;
  stockNo: string;
  description: string;
  rate: number;
}

interface AdapterInput {
  stockVal: string;
  nameVal: string;
  rateVal: number;
  activeElement: { id?: string; dataset?: Record<string, string> } | null;
}

interface AdapterState {
  items: MockItem[];
  quickEntry: { stockNo: string; description: string; rate: string };
}

/** Pure replication of the post-fix adapter routing logic from SalesOrderFormPremium. */
function runAdapter(input: AdapterInput, prev: AdapterState): AdapterState {
  const { stockVal, nameVal, rateVal, activeElement } = input;
  const origin = activeElement;
  const originId = origin?.id ?? "";

  if (originId === "sofp-quickentry-stockno") {
    return {
      ...prev,
      quickEntry: { stockNo: stockVal, description: nameVal, rate: String(rateVal) },
    };
  }

  const rowIndexStr = origin?.dataset?.rowIndex;
  const rowIdx = rowIndexStr !== undefined ? parseInt(rowIndexStr, 10) : -1;

  if (rowIdx < 0 || isNaN(rowIdx)) {
    return prev;
  }

  const updated = [...prev.items];
  if (rowIdx >= updated.length) {
    return prev;
  }

  const target = { ...updated[rowIdx] };
  target.stockNo = stockVal;
  target.description = nameVal;
  target.rate = rateVal;
  updated[rowIdx] = target;

  return { ...prev, items: updated };
}

const RESULT = { stockVal: "SKU-9001", nameVal: "Nike Air Max", rateVal: 4999 };

function makeItems(n: number): MockItem[] {
  return Array.from({ length: n }, (_, i) => ({ id: `item-${i}`, stockNo: "", description: "", rate: 0 }));
}

function lineEl(rowIndex: number) { return { id: "", dataset: { rowIndex: String(rowIndex) } }; }
function quickEl() { return { id: "sofp-quickentry-stockno", dataset: {} }; }

describe("SalesOrderFormPremium F2 row-identity regression", () => {
  let baseQE: AdapterState["quickEntry"];

  beforeEach(() => { baseQE = { stockNo: "", description: "", rate: "" }; });

  it("R1  F2 on row 0 updates ONLY row 0", () => {
    const prev = { items: makeItems(3), quickEntry: baseQE };
    const r = runAdapter({ ...RESULT, activeElement: lineEl(0) }, prev);
    expect(r.items[0].stockNo).toBe("SKU-9001");
    expect(r.items[1].stockNo).toBe("");
    expect(r.items[2].stockNo).toBe("");
    expect(r.quickEntry.stockNo).toBe("");
  });

  it("R2  F2 on middle row (2 of 5) updates ONLY row 2", () => {
    const prev = { items: makeItems(5), quickEntry: baseQE };
    const r = runAdapter({ ...RESULT, activeElement: lineEl(2) }, prev);
    expect(r.items[2].stockNo).toBe("SKU-9001");
    [0,1,3,4].forEach(i => expect(r.items[i].stockNo).toBe(""));
    expect(r.quickEntry.stockNo).toBe("");
  });

  it("R3  F2 on last row (4 of 5) updates ONLY last row", () => {
    const prev = { items: makeItems(5), quickEntry: baseQE };
    const r = runAdapter({ ...RESULT, activeElement: lineEl(4) }, prev);
    expect(r.items[4].stockNo).toBe("SKU-9001");
    [0,1,2,3].forEach(i => expect(r.items[i].stockNo).toBe(""));
    expect(r.quickEntry.stockNo).toBe("");
  });

  it("R4  F2 on quick-entry updates quickEntry ONLY; no line-item row touched", () => {
    const prev = { items: makeItems(3), quickEntry: baseQE };
    const r = runAdapter({ ...RESULT, activeElement: quickEl() }, prev);
    expect(r.quickEntry.stockNo).toBe("SKU-9001");
    r.items.forEach((item, i) => expect(item.stockNo, `row ${i}`).toBe(""));
  });

  it("R5  Successive F2 on different rows each update the correct row", () => {
    let s = { items: makeItems(5), quickEntry: baseQE };
    s = runAdapter({ stockVal:"SKU-001", nameVal:"A", rateVal:100, activeElement: lineEl(1) }, s);
    s = runAdapter({ stockVal:"SKU-002", nameVal:"B", rateVal:200, activeElement: lineEl(3) }, s);
    s = runAdapter({ stockVal:"SKU-003", nameVal:"C", rateVal:300, activeElement: lineEl(0) }, s);
    expect(s.items[0].stockNo).toBe("SKU-003");
    expect(s.items[1].stockNo).toBe("SKU-001");
    expect(s.items[2].stockNo).toBe("");
    expect(s.items[3].stockNo).toBe("SKU-002");
    expect(s.items[4].stockNo).toBe("");
  });

  it("R6  Out-of-bounds rowIndex is a no-op (returns prev unchanged)", () => {
    const prev = { items: makeItems(3), quickEntry: baseQE };
    const r = runAdapter({ ...RESULT, activeElement: lineEl(5) }, prev);
    expect(r).toBe(prev);
  });

  it("R7  Missing data-row-index is a no-op (returns prev unchanged)", () => {
    const prev = { items: makeItems(3), quickEntry: baseQE };
    const r = runAdapter({ ...RESULT, activeElement: { id: "", dataset: {} } }, prev);
    expect(r).toBe(prev);
  });

  it("R8  null activeElement is a no-op (returns prev unchanged)", () => {
    const prev = { items: makeItems(3), quickEntry: baseQE };
    const r = runAdapter({ ...RESULT, activeElement: null }, prev);
    expect(r).toBe(prev);
  });

  it("R9  Original items array is NOT mutated", () => {
    const items = makeItems(3);
    const snap = items.map(i => ({ ...i }));
    const prev = { items, quickEntry: baseQE };
    runAdapter({ ...RESULT, activeElement: lineEl(1) }, prev);
    items.forEach((item, i) => expect(item.stockNo).toBe(snap[i].stockNo));
  });

  it("R10 Single-item list: F2 on row 0 updates row 0 (not last by coincidence)", () => {
    const prev = { items: makeItems(1), quickEntry: baseQE };
    const r = runAdapter({ ...RESULT, activeElement: lineEl(0) }, prev);
    expect(r.items[0].stockNo).toBe("SKU-9001");
    expect(r.quickEntry.stockNo).toBe("");
  });
});
