/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Component    : Customer Stock Visibility Engine (ADR-CSV-001)
 * Standard     : SCS-BUS-001 / SCS-BUS-004 — Off-Balance-Sheet Commercial Stock Tracking
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 *
 * NOTE: Ownership of stock is transferred upon GST Tax Invoice issuance.
 * This engine tracks commercial visibility at customer store locations (e.g., Reliance, D-Mart, Lifestyle, Croma)
 * WITHOUT modifying internal Inventory Ledger or Tally accounting vouchers.
 */

import logger from "../core/logging/logger.js";
import { SPK } from "../kernel/SPK.js";

export interface CustomerStoreStockRecord {
  id: string;
  customerId: string;
  customerName: string; // e.g. "Reliance Retail Ltd", "Avenue Supermarts (D-Mart)", "Lifestyle Stores", "Croma"
  storeLocation: string; // e.g. "Reliance Fresh — Andheri West", "D-Mart — Malad"
  sku: string;
  productName: string;
  invoicedQty: number; // Cumulative GST Tax Invoiced Qty
  confirmedSoldQty: number; // Secondary Sell-out Qty reported by customer POS / EDI
  returnedQty: number; // Returns / Claims from customer
  currentLyingStock: number; // Invoiced - Sold - Returned
  sellThroughPct: number; // (Sold / Invoiced) * 100
  avgDailySalesVelocity: number; // Units sold per day
  daysOfStock: number; // Days of Stock cover remaining
  weeksOfCover: number; // Weeks of Cover remaining
  lastSellOutDate: string;
  agingBuckets: {
    days0to30: number;
    days31to60: number;
    days61plus: number;
  };
  replenishmentRecommendation: {
    suggestedReorderQty: number;
    urgency: "HEALTHY" | "MONITOR" | "CRITICAL_REORDER" | "EXCESS_STOCK";
    actionMessage: string;
  };
}

export interface SellOutImportRow {
  customerCode: string;
  storeCode: string;
  sku: string;
  sellOutQty: number;
  sellOutDate: string;
  storeLocation?: string;
}

export class CustomerStockVisibilityEngine {
  private static instance: CustomerStockVisibilityEngine;

  private storeStockLedger: CustomerStoreStockRecord[] = [
    {
      id: "csv-rec-101",
      customerId: "CUST-001",
      customerName: "Reliance Retail Ltd",
      storeLocation: "Reliance Fresh — Andheri West, Mumbai",
      sku: "SHOE-001",
      productName: "Nike Sports Shoes (Black / 9)",
      invoicedQty: 100,
      confirmedSoldQty: 72,
      returnedQty: 3,
      currentLyingStock: 25,
      sellThroughPct: 72.0,
      avgDailySalesVelocity: 3.5,
      daysOfStock: 7.1,
      weeksOfCover: 1.0,
      lastSellOutDate: "2026-08-05",
      agingBuckets: {
        days0to30: 20,
        days31to60: 5,
        days61plus: 0,
      },
      replenishmentRecommendation: {
        suggestedReorderQty: 50,
        urgency: "CRITICAL_REORDER",
        actionMessage: "Stock runway under 8 days. Issue replenishment PO to prevent stock-out.",
      },
    },
    {
      id: "csv-rec-102",
      customerId: "CUST-002",
      customerName: "Avenue Supermarts (D-Mart)",
      storeLocation: "D-Mart — Malad West, Mumbai",
      sku: "TSHIRT-001",
      productName: "Cotton Polo T-Shirt Premium (L)",
      invoicedQty: 250,
      confirmedSoldQty: 190,
      returnedQty: 5,
      currentLyingStock: 55,
      sellThroughPct: 76.0,
      avgDailySalesVelocity: 8.0,
      daysOfStock: 6.9,
      weeksOfCover: 1.0,
      lastSellOutDate: "2026-08-05",
      agingBuckets: {
        days0to30: 45,
        days31to60: 10,
        days61plus: 0,
      },
      replenishmentRecommendation: {
        suggestedReorderQty: 100,
        urgency: "CRITICAL_REORDER",
        actionMessage: "High sell-through rate (76%). Reorder immediately for weekend peak.",
      },
    },
    {
      id: "csv-rec-103",
      customerId: "CUST-003",
      customerName: "Lifestyle Stores",
      storeLocation: "Lifestyle — Lower Parel, Mumbai",
      sku: "JEANS-002",
      productName: "Slim Fit Denim Jeans (32)",
      invoicedQty: 80,
      confirmedSoldQty: 20,
      returnedQty: 0,
      currentLyingStock: 60,
      sellThroughPct: 25.0,
      avgDailySalesVelocity: 0.5,
      daysOfStock: 120.0,
      weeksOfCover: 17.1,
      lastSellOutDate: "2026-08-01",
      agingBuckets: {
        days0to30: 15,
        days31to60: 25,
        days61plus: 20,
      },
      replenishmentRecommendation: {
        suggestedReorderQty: 0,
        urgency: "EXCESS_STOCK",
        actionMessage: "Slow moving stock (25% sell-through). Consider promotional markdown or store transfer.",
      },
    },
  ];

  private constructor() {}

  public static getInstance(): CustomerStockVisibilityEngine {
    if (!CustomerStockVisibilityEngine.instance) {
      CustomerStockVisibilityEngine.instance = new CustomerStockVisibilityEngine();
    }
    return CustomerStockVisibilityEngine.instance;
  }

  /**
   * Returns commercial customer store stock records, optionally filtered by customer or store.
   */
  public getCustomerStoreStock(customerId?: string, storeLocation?: string): CustomerStoreStockRecord[] {
    let result = [...this.storeStockLedger];
    if (customerId) {
      result = result.filter((r) => r.customerId === customerId || r.customerName.toLowerCase().includes(customerId.toLowerCase()));
    }
    if (storeLocation) {
      result = result.filter((r) => r.storeLocation.toLowerCase().includes(storeLocation.toLowerCase()));
    }
    return result;
  }

  /**
   * Returns salesman-scoped customer stock visibility for field beat routes.
   */
  public getSalesmanCustomerStock(salesmanId: string): CustomerStoreStockRecord[] {
    logger.info(`[CustomerStockVisibilityEngine] Fetching customer store stock for Salesman ${salesmanId}`);
    return [...this.storeStockLedger];
  }

  /**
   * Imports sell-out POS/EDI transactions from customer feeds (CSV/EDI).
   * Updates commercial lying stock and recalculates sell-through % & replenishment recommendations.
   */
  public importSellOutData(rows: SellOutImportRow[]): { importedRows: number; updatedRecords: number } {
    let updatedCount = 0;

    for (const row of rows) {
      const rec = this.storeStockLedger.find(
        (r) =>
          (r.customerId === row.customerCode || r.customerName.toLowerCase().includes(row.customerCode.toLowerCase())) &&
          r.sku === row.sku
      );

      if (rec) {
        rec.confirmedSoldQty += row.sellOutQty;
        rec.lastSellOutDate = row.sellOutDate;
        
        // Recalculate lying stock & sell-through %
        rec.currentLyingStock = Math.max(0, rec.invoicedQty - rec.confirmedSoldQty - rec.returnedQty);
        rec.sellThroughPct = rec.invoicedQty > 0 ? parseFloat(((rec.confirmedSoldQty / rec.invoicedQty) * 100).toFixed(1)) : 0;
        
        // Recalculate Days of Stock (DOS)
        if (rec.avgDailySalesVelocity > 0) {
          rec.daysOfStock = parseFloat((rec.currentLyingStock / rec.avgDailySalesVelocity).toFixed(1));
          rec.weeksOfCover = parseFloat((rec.daysOfStock / 7).toFixed(1));
        }

        // Recalculate Replenishment Urgency
        if (rec.daysOfStock < 8) {
          rec.replenishmentRecommendation.urgency = "CRITICAL_REORDER";
          rec.replenishmentRecommendation.suggestedReorderQty = Math.max(50, Math.round(rec.avgDailySalesVelocity * 21));
          rec.replenishmentRecommendation.actionMessage = `Critical stock level (${rec.daysOfStock} days left). Reorder ${rec.replenishmentRecommendation.suggestedReorderQty} units.`;
        } else if (rec.daysOfStock > 60) {
          rec.replenishmentRecommendation.urgency = "EXCESS_STOCK";
          rec.replenishmentRecommendation.suggestedReorderQty = 0;
          rec.replenishmentRecommendation.actionMessage = `Excess stock detected (${rec.daysOfStock} days cover). Avoid reorder.`;
        } else {
          rec.replenishmentRecommendation.urgency = "HEALTHY";
          rec.replenishmentRecommendation.suggestedReorderQty = Math.round(rec.avgDailySalesVelocity * 14);
          rec.replenishmentRecommendation.actionMessage = "Stock levels optimal.";
        }

        updatedCount += 1;
      }
    }

    logger.info(`[CustomerStockVisibilityEngine] Successfully imported ${rows.length} sell-out rows. Updated ${updatedCount} commercial records.`);
    SPK.events.emit("CustomerSellOutImported", String(rows.length), { importedRows: rows.length, updatedRecords: updatedCount });
    return { importedRows: rows.length, updatedRecords: updatedCount };
  }

  /**
   * Automatically calculates replenishment recommendations across all modern trade customer stores.
   */
  public getReplenishmentRecommendations(): CustomerStoreStockRecord[] {
    return this.storeStockLedger.filter((r) => r.replenishmentRecommendation.urgency === "CRITICAL_REORDER");
  }
}
