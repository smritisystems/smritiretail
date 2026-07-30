/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUPAE MeasureRegistry (Universal Measure Registry)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.1.0
 */

export interface MeasureDefinition {
  id: string;
  label: string;
  aggregation: "sum" | "avg" | "count" | "min" | "max";
  format: "currency" | "number" | "percentage";
  field: string;
}

export const MEASURE_REGISTRY: Record<string, MeasureDefinition> = {
  SalesQty: { id: "SalesQty", label: "Sales Quantity", aggregation: "sum", format: "number", field: "salesQty" },
  SalesValue: { id: "SalesValue", label: "Sales Value (₹)", aggregation: "sum", format: "currency", field: "salesValue" },
  GrossSales: { id: "GrossSales", label: "Gross Sales (₹)", aggregation: "sum", format: "currency", field: "grossSales" },
  NetSales: { id: "NetSales", label: "Net Sales (₹)", aggregation: "sum", format: "currency", field: "netSales" },
  Margin: { id: "Margin", label: "Margin %", aggregation: "avg", format: "percentage", field: "marginPct" },
  Profit: { id: "Profit", label: "Profit (₹)", aggregation: "sum", format: "currency", field: "profit" },
  StockQty: { id: "StockQty", label: "Stock Quantity", aggregation: "sum", format: "number", field: "stockQty" },
  StockValue: { id: "StockValue", label: "Stock Value (₹)", aggregation: "sum", format: "currency", field: "stockValue" }
};
