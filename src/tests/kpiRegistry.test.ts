/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.4
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: SMRITI Formula & KPI Registry Unit Tests
 */

import { describe, it, expect } from "vitest";
import { Formula } from "../types.ts";

// Canonical SMRITI KPI definitions complying with DOC-01 Explainability Standards
export const standardRetailKpis: Formula[] = [
  {
    id: "KPI-GMROI",
    name: "GMROI (Gross Margin Return on Investment)",
    category: "Profitability",
    expression: "(Gross Margin / Average Inventory Cost)",
    meaning: "Measures the ability to turn inventory into cash above the cost of inventory.",
    workedExample: "Gross Margin = ₹50,000, Avg Inventory Cost = ₹25,000 => GMROI = 2.0 (₹2 returned per ₹1 invested)",
    dataSources: ["SalesInvoices", "StockLedger"],
    interpretation: {
      critical: "< 1.0 (Losing money on inventory holding)",
      monitor: "1.0 - 2.5 (Moderate inventory productivity)",
      healthy: "> 2.5 (High yield inventory asset)"
    },
    recommendedAction: "Liquidate aging SKUs with GMROI < 1.0 through promotional bundles or price markdown.",
    value: "2.4x"
  },
  {
    id: "KPI-STR",
    name: "Sell-Through Rate (STR)",
    category: "Inventory Velocity",
    expression: "(Units Sold / (Beginning Inventory + Units Received)) * 100",
    meaning: "Percentage of inventory sold within a defined reporting cycle.",
    workedExample: "Sold 80 units from a total available stock of 100 units => STR = 80%",
    dataSources: ["SalesItems", "GoodsReceiptNotes"],
    interpretation: {
      critical: "< 40% (Slow mover or overstocked)",
      monitor: "40% - 70% (Balanced velocity)",
      healthy: "> 70% (Fast runner, monitor stock-out risk)"
    },
    recommendedAction: "If STR > 85%, trigger auto-reorder immediately to prevent lost sales.",
    value: "68%"
  },
  {
    id: "KPI-WOC",
    name: "Weeks of Cover (WOC)",
    category: "Inventory Velocity",
    expression: "Current Stock Units / Average Weekly Sales Units",
    meaning: "Estimated number of weeks existing stock will last at current run-rate.",
    workedExample: "Stock = 600 units, Weekly Sales = 100 units => WOC = 6.0 weeks",
    dataSources: ["StockBatches", "WeeklySalesSummary"],
    interpretation: {
      critical: "< 2.0 weeks (Stock-out imminent) or > 16.0 weeks (Severe overstock)",
      monitor: "2.0 - 4.0 weeks or 8.0 - 16.0 weeks",
      healthy: "4.0 - 8.0 weeks (Optimal retail pipeline)"
    },
    recommendedAction: "Initiate stock replenishment if WOC falls below safety threshold of 3.0 weeks.",
    value: "5.2 wks"
  },
  {
    id: "KPI-CONV",
    name: "Footfall Conversion Rate",
    category: "Store Operations",
    expression: "(Total Invoices Generated / Footfall Visitor Count) * 100",
    meaning: "Percentage of shoppers entering the store who complete a purchase.",
    workedExample: "250 invoices generated from 1000 visitors => Conversion = 25.0%",
    dataSources: ["PosTransactions", "FootfallSensors"],
    interpretation: {
      critical: "< 15% (Poor merchandising or floor assistance)",
      monitor: "15% - 25% (Standard retail benchmark)",
      healthy: "> 25% (High conversion floor engagement)"
    },
    recommendedAction: "Conduct sales associate placement review during peak traffic hours.",
    value: "22.5%"
  },
  {
    id: "KPI-ATV",
    name: "Average Transaction Value (ATV / Basket Size)",
    category: "Sales Performance",
    expression: "Total Net Sales Revenue / Total Bill Count",
    meaning: "Average revenue generated per checkout transaction.",
    workedExample: "₹1,50,000 revenue across 100 bills => ATV = ₹1,500",
    dataSources: ["PosPayments", "SalesInvoices"],
    interpretation: {
      critical: "< ₹500 (Low ticket size)",
      monitor: "₹500 - ₹1,200 (Average)",
      healthy: "> ₹1,200 (Strong cross-selling)"
    },
    recommendedAction: "Incentivize cashier impulse add-on items at checkout counter.",
    value: "₹1,450"
  },
  {
    id: "KPI-SHRINK",
    name: "Inventory Shrinkage Rate",
    category: "Loss Prevention",
    expression: "((Book Stock Value - Physical Stock Value) / Book Stock Value) * 100",
    meaning: "Unaccounted loss of inventory due to theft, damage, or administrative errors.",
    workedExample: "Book Stock = ₹10,00,000, Physical Stock = ₹9,85,000 => Shrinkage = 1.5%",
    dataSources: ["StockReconciliationLogs", "PhysicalAudit"],
    interpretation: {
      critical: "> 2.0% (Severe loss prevention breakdown)",
      monitor: "1.0% - 2.0% (Requires audit tightening)",
      healthy: "< 1.0% (Under control)"
    },
    recommendedAction: "Schedule mandatory cycle count for top 20 high-shrinkage merchandise categories.",
    value: "0.8%"
  }
];

// Calculation helper for Sell-Through Rate
export function calculateSellThrough(soldUnits: number, availableUnits: number): number {
  if (availableUnits <= 0) return 0;
  return Number(((soldUnits / availableUnits) * 100).toFixed(2));
}

// Calculation helper for Weeks of Cover
export function calculateWeeksOfCover(currentStock: number, weeklyRunRate: number): number {
  if (weeklyRunRate <= 0) return 999;
  return Number((currentStock / weeklyRunRate).toFixed(1));
}

// Status evaluator for Sell-Through Rate
export function evaluateSellThroughStatus(str: number): "Critical" | "Monitor" | "Healthy" {
  if (str < 40) return "Critical";
  if (str < 70) return "Monitor";
  return "Healthy";
}

describe("SMRITI — Formula & KPI Registry Unit Tests", () => {
  describe("1. DOC-01 Compliance & Schema Integrity", () => {
    it("should verify that all standard KPIs contain required explainability fields", () => {
      expect(standardRetailKpis.length).toBeGreaterThanOrEqual(6);

      standardRetailKpis.forEach(kpi => {
        expect(kpi.id).toMatch(/^KPI-[A-Z]+$/);
        expect(kpi.name.trim().length).toBeGreaterThan(0);
        expect(kpi.category.trim().length).toBeGreaterThan(0);
        expect(kpi.expression.trim().length).toBeGreaterThan(0);
        expect(kpi.meaning.trim().length).toBeGreaterThan(0);
        expect(kpi.workedExample.trim().length).toBeGreaterThan(0);
        expect(kpi.dataSources.length).toBeGreaterThan(0);
        expect(kpi.interpretation.critical).toBeDefined();
        expect(kpi.interpretation.monitor).toBeDefined();
        expect(kpi.interpretation.healthy).toBeDefined();
        expect(kpi.recommendedAction.trim().length).toBeGreaterThan(0);
      });
    });

    it("should provide valid categories across standard retail dimensions", () => {
      const categories = Array.from(new Set(standardRetailKpis.map(k => k.category)));
      expect(categories).toContain("Profitability");
      expect(categories).toContain("Inventory Velocity");
      expect(categories).toContain("Store Operations");
      expect(categories).toContain("Sales Performance");
      expect(categories).toContain("Loss Prevention");
    });
  });

  describe("2. Mathematical Calculation Helpers", () => {
    it("should accurately compute Sell-Through Rate (STR)", () => {
      expect(calculateSellThrough(50, 100)).toBe(50.0);
      expect(calculateSellThrough(75, 100)).toBe(75.0);
      expect(calculateSellThrough(0, 50)).toBe(0.0);
      expect(calculateSellThrough(10, 0)).toBe(0.0); // Zero division guard
    });

    it("should accurately compute Weeks of Cover (WOC)", () => {
      expect(calculateWeeksOfCover(500, 100)).toBe(5.0);
      expect(calculateWeeksOfCover(120, 50)).toBe(2.4);
      expect(calculateWeeksOfCover(100, 0)).toBe(999); // Zero division guard
    });

    it("should evaluate KPI health status based on standard thresholds", () => {
      expect(evaluateSellThroughStatus(25.0)).toBe("Critical");
      expect(evaluateSellThroughStatus(55.0)).toBe("Monitor");
      expect(evaluateSellThroughStatus(82.5)).toBe("Healthy");
    });
  });

  describe("3. Registry Search & Filter Mechanics", () => {
    it("should filter KPIs by category", () => {
      const velocityKpis = standardRetailKpis.filter(k => k.category === "Inventory Velocity");
      expect(velocityKpis.length).toBe(2);
      expect(velocityKpis.map(k => k.id)).toEqual(["KPI-STR", "KPI-WOC"]);
    });

    it("should search KPIs by name, meaning, or expression query", () => {
      const query = "margin";
      const results = standardRetailKpis.filter(k =>
        k.name.toLowerCase().includes(query) ||
        k.meaning.toLowerCase().includes(query) ||
        k.expression.toLowerCase().includes(query)
      );
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("KPI-GMROI");
    });
  });
});
