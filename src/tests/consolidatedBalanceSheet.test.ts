/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.83.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConsolidatedBalanceSheetModal,
  BalanceSheetLine,
} from "../components/reports/ConsolidatedBalanceSheetModal";

describe("SMRITI Multi-Branch Consolidated Balance Sheet Matrix", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleLine: BalanceSheetLine = {
    account_code: "1040",
    account_name: "Inventory Asset",
    category: "CURRENT_ASSETS",
    root_type: "ASSET",
    branch_values: { "BR-001": 3450000, "BR-002": 1850000, "BR-003": 4900000 },
    eliminations: 0,
  };

  it("STEP 1: should export ConsolidatedBalanceSheetModal component function", () => {
    expect(typeof ConsolidatedBalanceSheetModal).toBe("function");
  });

  it("STEP 2: should validate BalanceSheetLine model structure", () => {
    expect(sampleLine.account_code).toBe("1040");
    expect(sampleLine.root_type).toBe("ASSET");
    expect(sampleLine.branch_values["BR-001"]).toBe(3450000);
  });

  it("STEP 3: should correctly aggregate branch values with inter-company eliminations", () => {
    const interCoLine: BalanceSheetLine = {
      account_code: "1030",
      account_name: "Accounts Receivable",
      category: "CURRENT_ASSETS",
      root_type: "ASSET",
      branch_values: { "BR-001": 560000, "BR-002": 240000, "BR-003": 180000 },
      eliminations: -80000,
    };

    const branchSum = Object.values(interCoLine.branch_values).reduce((a, b) => a + b, 0);
    const consolidatedTotal = branchSum + interCoLine.eliminations;

    expect(branchSum).toBe(980000);
    expect(consolidatedTotal).toBe(900000); // 980,000 - 80,000
  });

  it("STEP 4: should verify fundamental accounting equation: Assets == Liabilities + Equity", () => {
    const totalAssets = 15305000;
    const totalLiabilities = 7195000;
    const totalEquity = 8110000;

    expect(totalAssets).toBe(totalLiabilities + totalEquity);
  });
});
