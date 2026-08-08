/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Report Registry (URR-001)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & URR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { PlatformContext } from "../../context/PlatformContext.js";

export type ReportCategory = "sales" | "inventory" | "purchase" | "accounting" | "crm" | "taxation";

export interface ReportParameter {
  id: string;             // Parameter key (e.g. "startDate", "endDate", "storeId", "categoryId")
  label: string;
  type: "date" | "string" | "number" | "select";
  required?: boolean;
  defaultValue?: any;
}

export interface ReportColumn {
  id: string;             // Property ID (e.g. "invoiceNo", "totalAmount", "taxAmount")
  label: string;
  dataType: "string" | "number" | "currency" | "date";
  width?: number;
  align?: "left" | "center" | "right";
}

export interface ReportDefinition {
  id: string;             // Report key (e.g. "rep.sales_summary", "rep.gst_r1_tax")
  name: string;
  description?: string;
  category: ReportCategory;
  entityId: string;       // Source entity ID
  permissionId: string;   // Required permission key
  parameters: ReportParameter[];
  columns: ReportColumn[];
  exportFormats: Array<"excel" | "pdf" | "csv" | "json">;
}

export interface ReportExecutionResult {
  reportId: string;
  generatedAt: string;
  totalRecords: number;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  summary?: Record<string, any>;
}

export class ReportRegistryService {
  private reports: Map<string, Readonly<ReportDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultReports();
  }

  private seedDefaultReports() {
    const defaults: ReportDefinition[] = [
      {
        id: "rep.sales_summary",
        name: "Daily Sales & POS Revenue Summary",
        description: "Aggregated store sales revenue, tax, and discount breakdown",
        category: "sales",
        entityId: "sales_invoice",
        permissionId: "sales.pos.billing",
        exportFormats: ["excel", "pdf", "csv", "json"],
        parameters: [
          { id: "startDate", label: "Start Date", type: "date", required: true },
          { id: "endDate", label: "End Date", type: "date", required: true }
        ],
        columns: [
          { id: "invoiceNo", label: "Invoice No", dataType: "string", width: 150 },
          { id: "invoiceDate", label: "Date", dataType: "date", width: 120 },
          { id: "customerName", label: "Customer Name", dataType: "string", width: 200 },
          { id: "taxableValue", label: "Taxable (₹)", dataType: "currency", align: "right" },
          { id: "gstAmount", label: "GST (₹)", dataType: "currency", align: "right" },
          { id: "netTotal", label: "Net Total (₹)", dataType: "currency", align: "right" }
        ]
      },
      {
        id: "rep.inventory_stock",
        name: "Inventory Stock Valuation Report",
        description: "SKU stock quantities, cost valuation, and reorder alerts",
        category: "inventory",
        entityId: "product",
        permissionId: "inventory.item.read",
        exportFormats: ["excel", "pdf", "csv"],
        parameters: [
          { id: "storeId", label: "Store Branch", type: "select", defaultValue: "store-01" }
        ],
        columns: [
          { id: "sku", label: "SKU Code", dataType: "string", width: 120 },
          { id: "name", label: "Item Description", dataType: "string", width: 250 },
          { id: "qtyOnHand", label: "Stock Qty", dataType: "number", align: "right" },
          { id: "valuation", label: "Stock Value (₹)", dataType: "currency", align: "right" }
        ]
      }
    ];

    defaults.forEach((r) => this.registerReport(r));
  }

  public registerReport(report: ReportDefinition): void {
    const payload = Object.freeze({ ...report, id: report.id.toLowerCase() });
    this.reports.set(payload.id, payload);
    this.emitChange();
  }

  public getReport(id: string): Readonly<ReportDefinition> | undefined {
    if (!id) return undefined;
    return this.reports.get(id.toLowerCase());
  }

  public getReports(): ReadonlyArray<Readonly<ReportDefinition>> {
    return Array.from(this.reports.values());
  }

  public getReportsByCategory(category: ReportCategory): ReadonlyArray<Readonly<ReportDefinition>> {
    return this.getReports().filter((r) => r.category === category);
  }

  public executeReport(
    reportId: string,
    params: Record<string, any>,
    context: Readonly<PlatformContext>
  ): ReportExecutionResult {
    const report = this.getReport(reportId);
    if (!report) {
      throw new Error(`Report '${reportId}' is not registered in URR.`);
    }

    // Mock analytical data projection
    const rows = [
      { invoiceNo: "INV-2026-001", invoiceDate: "2026-07-31", customerName: "Rahul Sharma", taxableValue: 1000, gstAmount: 180, netTotal: 1180, sku: "SKU-1001", name: "Cotton Polo Shirt", qtyOnHand: 45, valuation: 45000 },
      { invoiceNo: "INV-2026-002", invoiceDate: "2026-07-31", customerName: "Priya Patel", taxableValue: 2500, gstAmount: 450, netTotal: 2950, sku: "SKU-1002", name: "Slim Fit Jeans", qtyOnHand: 20, valuation: 30000 }
    ];

    return {
      reportId: report.id,
      generatedAt: new Date().toISOString(),
      totalRecords: rows.length,
      columns: report.columns,
      rows,
      summary: { totalRevenue: 4130, totalTax: 630 }
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.reports.clear();
    this.seedDefaultReports();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const ReportRegistry = new ReportRegistryService();
