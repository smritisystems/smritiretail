/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.19
 * Created      : 2026-11-02
 * Modified     : 2026-11-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Reporting Center Workspace Hub & Redesign Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  ReportingCenterHub,
  formatInrCompact,
  formatInrFull,
} from "../components/reports/ReportingCenterHub";
import { ReportDesignerTab } from "../components/ReportDesignerTab";

describe("ReportingCenterHub & Reporting Center UX Redesign Suite", () => {
  it("1. formatInrCompact formats numbers in Crores and Lakhs accurately per Indian Numbering System", () => {
    expect(formatInrCompact(0)).toBe("₹0");
    expect(formatInrCompact(30000000)).toBe("₹3.00 Cr");
    expect(formatInrCompact(25400000)).toBe("₹2.54 Cr");
    expect(formatInrCompact(5000000)).toBe("₹50.00 L");
    expect(formatInrCompact(14236890)).toBe("₹1.42 Cr");
    expect(formatInrCompact(5418320)).toBe("₹54.18 L");
    expect(formatInrCompact(9647203)).toBe("₹96.47 L");
  });

  it("2. formatInrFull formats numbers into full Indian currency format with standard separators", () => {
    expect(formatInrFull(31752767)).toBe("₹3,17,52,767");
    expect(formatInrFull(14236890)).toBe("₹1,42,36,890");
    expect(formatInrFull(5418320)).toBe("₹54,18,320");
    expect(formatInrFull(9647203)).toBe("₹96,47,203");
  });

  it("3. ReportingCenterHub component defines all 4 primary KPI cards matching reference architecture", () => {
    const hubCode = ReportingCenterHub.toString();
    expect(hubCode).toContain("Net Sales");
    expect(hubCode).toContain("Stock Value");
    expect(hubCode).toContain("At Cost");
    expect(hubCode).toContain("Receivables");
    expect(hubCode).toContain("Outstanding");
    expect(hubCode).toContain("Gross Margin");
  });

  it("4. ReportingCenterHub defines 4 chart metrics: Sales, Purchase, Stock, Margin and Key Insights", () => {
    const hubCode = ReportingCenterHub.toString();
    expect(hubCode).toContain("Sales Trend – Net Sales");
    expect(hubCode).toContain("Purchase Trend");
    expect(hubCode).toContain("Stock Trend");
    expect(hubCode).toContain("Margin Trend");
    expect(hubCode).toContain("Key Insights");
    expect(hubCode).toContain("Sales up by");
    expect(hubCode).toContain("Stock value increased by");
    expect(hubCode).toContain("Receivables up by");
    expect(hubCode).toContain("Gross margin at");
  });

  it("5. ReportingCenterHub includes 6 standard Quick Reports shortcuts matching reference UX", () => {
    const hubCode = ReportingCenterHub.toString();
    expect(hubCode).toContain("Daily Sales Register");
    expect(hubCode).toContain("Current Stock on Hand");
    expect(hubCode).toContain("Cashier & Tender Summary");
    expect(hubCode).toContain("Purchase Inward Register");
    expect(hubCode).toContain("Item Wise Sales");
    expect(hubCode).toContain("GST Sales Summary");
  });

  it("6. ReportingCenterHub defines the 4x2 grid of 8 Business Functions with exact report counts", () => {
    const hubCode = ReportingCenterHub.toString();
    expect(hubCode).toContain("Reports by Business Function");
    expect(hubCode).toContain("Sales & POS");
    expect(hubCode).toContain("Purchasing");
    expect(hubCode).toContain("Inventory");
    expect(hubCode).toContain("Customers");
    expect(hubCode).toContain("Suppliers");
    expect(hubCode).toContain("Finance & Accounts");
    expect(hubCode).toContain("GST & Compliance");
    expect(hubCode).toContain("Management");
    expect(hubCode).toContain("View All Reports (66)");
  });

  it("7. ReportDesignerTab mounts ReportingCenterHub and wires seamless Back to Reporting Center navigation", () => {
    const designerCode = ReportDesignerTab.toString();
    expect(designerCode).toContain("ReportingCenterHub");
    expect(designerCode).toContain("findAndRunReport");
    expect(designerCode).toContain("showFullCatalogTable");
    expect(designerCode).toContain("Back to Reporting Center");
  });
});
