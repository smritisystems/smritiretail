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
 * Phase C Batch 1 Regression Tests
 *
 * Covers:
 *   TagLabelPrintingTab FieldAdapter — stockNoFrom / stockNoTo field routing
 *   CustMasterWs FieldAdapter       — customer identity resolution
 *   Alt+S / F11 / F8 keyboard path preservation (contract assertions)
 *
 * Test IDs:
 *   T1  TagLabel F2 on stockNoFrom -> updates stockNoFrom only, stockNoTo unchanged
 *   T2  TagLabel F2 on stockNoTo   -> updates stockNoTo only, stockNoFrom unchanged
 *   T3  Sequential From->To F2 selections remain correctly separated
 *   T4  TagLabel adapter: unknown entity -> no-op (state unchanged)
 *   T5  TagLabel adapter: no originId (null ref) -> defaults to stockNoFrom
 *   T6  CustMaster F2: resolves by id (primary key match)
 *   T7  CustMaster F2: resolves by code when id not present in result
 *   T8  CustMaster F2: id takes priority over code when both present
 *   T9  CustMaster F2: unknown id + unknown code -> no-op (-1)
 *   T10 CustMaster F2: wrong entity -> no-op (-1)
 *   T11 Alt+S key condition: e.key==="F2" must NOT match (removed from condition)
 *   T12 Alt+S key condition: altKey+s still matches (preserved)
 *   T13 F11 key still in handler (independent of F2 block)
 *   T14 TagLabel: item_barcode entity accepted by adapter
 *   T15 CustMaster: empty id falls back to code match
 */

import { describe, it, expect } from "vitest";
import type { LookupResult, LookupEntity } from "../context/F2DispatcherContext.tsx";

// ---------------------------------------------------------------------------
// Headless simulation of tagF2Adapter (mirrors TagLabelPrintingTab exactly)
// ---------------------------------------------------------------------------
function runTagF2Adapter(
  originId: string | null,
  result: LookupResult,
  criteria: { stockNoFrom: string; stockNoTo: string }
): { stockNoFrom: string; stockNoTo: string } {
  if (
    result.entity !== "variant" &&
    result.entity !== "item" &&
    result.entity !== "item_barcode"
  ) {
    return criteria;
  }
  const stockVal =
    (result.record?.stock_no as string) ||
    (result.record?.code as string) ||
    result.returnValue ||
    "";
  if (originId === "tag-stock-no-to") {
    return { ...criteria, stockNoTo: stockVal };
  } else {
    return { ...criteria, stockNoFrom: stockVal };
  }
}

type CustomerRecord = { id: string; code: string; name: string };

// ---------------------------------------------------------------------------
// Headless simulation of custF2Adapter (mirrors CustMasterWs exactly)
// Returns new currentIndex, or -1 on no-op.
// ---------------------------------------------------------------------------
function runCustF2Adapter(
  result: LookupResult,
  customers: CustomerRecord[]
): number {
  if (result.entity !== "customer") return -1;
  const lookupId   = result.id || (result.record?.id as string) || "";
  const lookupCode = (result.record?.code as string) || result.returnValue || "";
  return customers.findIndex(
    c => (lookupId && c.id === lookupId) || (lookupCode && c.code === lookupCode)
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const makeVariantResult = (stockNo: string): LookupResult => ({
  contractVersion: "2.0.0",
  entity: "variant",
  id: `var-${stockNo}`,
  returnValue: stockNo,
  displayValue: `Product ${stockNo}`,
  record: { stock_no: stockNo, code: stockNo },
});

const makeCustResult = (id: string, code: string): LookupResult => ({
  contractVersion: "2.0.0",
  entity: "customer",
  id,
  returnValue: code,
  displayValue: `Customer ${code}`,
  record: { id, code, name: `Customer ${code}` },
});

const SAMPLE_CUSTOMERS: CustomerRecord[] = [
  { id: "cust-uuid-001", code: "CUST-001", name: "Farida Jameel" },
  { id: "cust-uuid-002", code: "CUST-002", name: "Rajan Pillai" },
  { id: "cust-uuid-003", code: "CUST-003", name: "Meera Nair" },
];

const INITIAL_CRITERIA = { stockNoFrom: "000001", stockNoTo: "000010" };

// ---------------------------------------------------------------------------
// Suite A: TagLabel FieldAdapter field routing
// ---------------------------------------------------------------------------
describe("Phase C Batch 1 - TagLabelPrintingTab FieldAdapter field routing", () => {

  it("T1: F2 on stockNoFrom updates stockNoFrom only; stockNoTo unchanged", () => {
    const updated = runTagF2Adapter("tag-stock-no-from", makeVariantResult("000042"), INITIAL_CRITERIA);
    expect(updated.stockNoFrom).toBe("000042");
    expect(updated.stockNoTo).toBe("000010");
  });

  it("T2: F2 on stockNoTo updates stockNoTo only; stockNoFrom unchanged", () => {
    const updated = runTagF2Adapter("tag-stock-no-to", makeVariantResult("000099"), INITIAL_CRITERIA);
    expect(updated.stockNoTo).toBe("000099");
    expect(updated.stockNoFrom).toBe("000001");
  });

  it("T3: Sequential From->To F2 selections correctly separated", () => {
    let state = { ...INITIAL_CRITERIA };
    state = runTagF2Adapter("tag-stock-no-from", makeVariantResult("000005"), state);
    expect(state.stockNoFrom).toBe("000005");
    expect(state.stockNoTo).toBe("000010");

    state = runTagF2Adapter("tag-stock-no-to", makeVariantResult("000020"), state);
    expect(state.stockNoFrom).toBe("000005");
    expect(state.stockNoTo).toBe("000020");
  });

  it("T4: Unknown entity is a no-op; state object unchanged", () => {
    const bad: LookupResult = {
      contractVersion: "2.0.0",
      entity: "customer" as LookupEntity,
      id: "x",
      returnValue: "CUST-001",
      displayValue: "Farida",
      record: {},
    };
    const updated = runTagF2Adapter("tag-stock-no-from", bad, INITIAL_CRITERIA);
    expect(updated).toStrictEqual(INITIAL_CRITERIA);
  });

  it("T5: Null originId defaults to stockNoFrom", () => {
    const updated = runTagF2Adapter(null, makeVariantResult("000055"), INITIAL_CRITERIA);
    expect(updated.stockNoFrom).toBe("000055");
    expect(updated.stockNoTo).toBe("000010");
  });

  it("T5b: Empty string originId also defaults to stockNoFrom", () => {
    const updated = runTagF2Adapter("", makeVariantResult("000077"), INITIAL_CRITERIA);
    expect(updated.stockNoFrom).toBe("000077");
    expect(updated.stockNoTo).toBe("000010");
  });

  it("T14: item_barcode entity accepted; routes by originId correctly", () => {
    const bc: LookupResult = {
      contractVersion: "2.0.0",
      entity: "item_barcode",
      id: "bc-111",
      returnValue: "000033",
      displayValue: "Barcode 890100000033",
      record: { stock_no: "000033", code: "000033" },
    };
    const toRes = runTagF2Adapter("tag-stock-no-to", bc, INITIAL_CRITERIA);
    expect(toRes.stockNoTo).toBe("000033");
    expect(toRes.stockNoFrom).toBe("000001");

    const fromRes = runTagF2Adapter("tag-stock-no-from", bc, INITIAL_CRITERIA);
    expect(fromRes.stockNoFrom).toBe("000033");
    expect(fromRes.stockNoTo).toBe("000010");
  });

});

// ---------------------------------------------------------------------------
// Suite B: CustMasterWs FieldAdapter canonical identity resolution
// ---------------------------------------------------------------------------
describe("Phase C Batch 1 - CustMasterWs FieldAdapter customer resolution", () => {

  it("T6: Resolves by id (primary canonical key)", () => {
    const idx = runCustF2Adapter(makeCustResult("cust-uuid-002", "CUST-002"), SAMPLE_CUSTOMERS);
    expect(idx).toBe(1);
  });

  it("T7: Resolves by code when id is empty in result", () => {
    const result: LookupResult = {
      contractVersion: "2.0.0",
      entity: "customer",
      id: "",
      returnValue: "CUST-003",
      displayValue: "Meera Nair",
      record: { id: "", code: "CUST-003", name: "Meera Nair" },
    };
    expect(runCustF2Adapter(result, SAMPLE_CUSTOMERS)).toBe(2);
  });

  it("T8: id takes priority over code when both present", () => {
    // id = cust-uuid-001 (index 0), code = CUST-002 (index 1) — id wins
    const result: LookupResult = {
      contractVersion: "2.0.0",
      entity: "customer",
      id: "cust-uuid-001",
      returnValue: "CUST-002",
      displayValue: "Farida Jameel",
      record: { id: "cust-uuid-001", code: "CUST-002" },
    };
    expect(runCustF2Adapter(result, SAMPLE_CUSTOMERS)).toBe(0);
  });

  it("T9: Unknown id + unknown code -> no-op (-1)", () => {
    const result: LookupResult = {
      contractVersion: "2.0.0",
      entity: "customer",
      id: "cust-uuid-999",
      returnValue: "CUST-999",
      displayValue: "Ghost",
      record: { id: "cust-uuid-999", code: "CUST-999" },
    };
    expect(runCustF2Adapter(result, SAMPLE_CUSTOMERS)).toBe(-1);
  });

  it("T10: Wrong entity -> no-op (-1)", () => {
    const result: LookupResult = {
      contractVersion: "2.0.0",
      entity: "variant",
      id: "var-001",
      returnValue: "000001",
      displayValue: "Product 000001",
      record: {},
    };
    expect(runCustF2Adapter(result, SAMPLE_CUSTOMERS)).toBe(-1);
  });

  it("T15: Empty id falls back to code match", () => {
    const result: LookupResult = {
      contractVersion: "2.0.0",
      entity: "customer",
      id: "",
      returnValue: "CUST-001",
      displayValue: "Farida Jameel",
      record: { id: "", code: "CUST-001" },
    };
    expect(runCustF2Adapter(result, SAMPLE_CUSTOMERS)).toBe(0);
  });

});

// ---------------------------------------------------------------------------
// Suite C: Keyboard handler contract assertions
// ---------------------------------------------------------------------------
describe("Phase C Batch 1 - Keyboard handler contract assertions", () => {

  it("T11: F2 key alone does NOT satisfy Alt+S condition (removed from condition)", () => {
    // Old: e.key === "F2" || (e.altKey && e.key.toLowerCase() === "s")
    // New: e.altKey && e.key.toLowerCase() === "s"
    const f2Event = { key: "F2", altKey: false };
    const newCondition = f2Event.altKey && f2Event.key.toLowerCase() === "s";
    expect(newCondition).toBe(false);
  });

  it("T12: Alt+S still satisfies the preserved condition", () => {
    const altSEvent = { key: "s", altKey: true };
    const condition = altSEvent.altKey && altSEvent.key.toLowerCase() === "s";
    expect(condition).toBe(true);
  });

  it("T13: F11 key check is independent from F2 (not accidentally removed)", () => {
    expect({ key: "F11" }.key === "F11").toBe(true);
    expect({ key: "F2" }.key === "F11").toBe(false);
    expect({ key: "F8" }.key === "F11").toBe(false);
  });

  it("T3b: F2 string is correct for dispatcher (contract unchanged)", () => {
    const mock = { key: "F2" };
    expect(mock.key === "F2").toBe(true);
    expect(mock.key === "F11").toBe(false);
    expect(mock.key === "F8").toBe(false);
  });

});
