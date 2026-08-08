/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Component    : SMRITI Modern Trade & Customer Inventory Visibility (CIV / ADR-CSV-001)
 * Standard     : SCS-BUS-001 / SCS-BUS-004 — Off-Balance-Sheet Commercial Stock Tracking
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 2.0.0
 *
 * NOTE: Ownership of stock is transferred upon GST Tax Invoice issuance.
 * This engine tracks commercial visibility at modern trade stores (e.g., Reliance, D-Mart, Lifestyle, Croma)
 * WITHOUT modifying internal Inventory Ledger or Tally accounting vouchers.
 */

import logger from "../core/logging/logger.js";
import { SPK } from "../kernel/SPK.js";

export interface StoreHierarchy {
  keyAccount: string; // e.g. "Reliance Retail Ltd", "Avenue Supermarts (D-Mart)", "Lifestyle Stores"
  region: string; // e.g. "West Zone", "South Zone"
  distributionCenter: string; // e.g. "DC Mumbai — Bhiwandi", "DC Pune"
  storeName: string; // e.g. "Reliance Fresh — Phoenix Marketcity", "D-Mart — Malad"
}

export interface InvoiceAllocationRecord {
  invoiceNo: string;
  invoiceDate: string;
  totalInvoicedQty: number;
  allocatedStore: string;
  storeAllocatedQty: number;
  storeLyingQty: number;
}

export interface RetailerClaimRecord {
  id: string;
  customerName: string;
  storeLocation: string;
  sku: string;
  claimType: "DAMAGE" | "EXPIRY" | "SHRINKAGE" | "DISPLAY_LOSS" | "PROMOTION_CLAIM";
  claimQty: number;
  claimAmount: number;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  submittedDate: string;
}

export interface SuggestedDispatchOrder {
  id: string;
  customerName: string;
  destinationStore: string;
  sku: string;
  productName: string;
  currentStockDOS: number;
  suggestedQty: number;
  unitPrice: number;
  estimatedTotal: number;
  status: "DRAFT_SUGGESTED" | "APPROVED" | "DISPATCHED";
  createdDate: string;
}

export interface CustomerStoreStockRecord {
  id: string;
  hierarchy: StoreHierarchy;
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
  invoiceAllocations: InvoiceAllocationRecord[];
  claims: {
    damageQty: number;
    expiryQty: number;
    shrinkageQty: number;
    displayLossQty: number;
  };
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
      id: "civ-rec-101",
      hierarchy: {
        keyAccount: "Reliance Retail Ltd",
        region: "West Zone",
        distributionCenter: "DC Mumbai — Bhiwandi",
        storeName: "Reliance Fresh — Phoenix Marketcity, Kurla",
      },
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
      invoiceAllocations: [
        {
          invoiceNo: "INV-2026-0041",
          invoiceDate: "2026-07-15",
          totalInvoicedQty: 100,
          allocatedStore: "Reliance Fresh — Phoenix Marketcity, Kurla",
          storeAllocatedQty: 100,
          storeLyingQty: 25,
        },
      ],
      claims: {
        damageQty: 2,
        expiryQty: 0,
        shrinkageQty: 1,
        displayLossQty: 0,
      },
      agingBuckets: {
        days0to30: 20,
        days31to60: 5,
        days61plus: 0,
      },
      replenishmentRecommendation: {
        suggestedReorderQty: 50,
        urgency: "CRITICAL_REORDER",
        actionMessage: "Stock cover under 8 days. Issue replenishment dispatch order.",
      },
    },
    {
      id: "civ-rec-102",
      hierarchy: {
        keyAccount: "Avenue Supermarts (D-Mart)",
        region: "West Zone",
        distributionCenter: "DC Thane",
        storeName: "D-Mart — Malad West, Mumbai",
      },
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
      invoiceAllocations: [
        {
          invoiceNo: "INV-2026-0089",
          invoiceDate: "2026-07-20",
          totalInvoicedQty: 250,
          allocatedStore: "D-Mart — Malad West, Mumbai",
          storeAllocatedQty: 250,
          storeLyingQty: 55,
        },
      ],
      claims: {
        damageQty: 3,
        expiryQty: 0,
        shrinkageQty: 2,
        displayLossQty: 0,
      },
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
      id: "civ-rec-103",
      hierarchy: {
        keyAccount: "Lifestyle Stores",
        region: "West Zone",
        distributionCenter: "DC Mumbai — Bhiwandi",
        storeName: "Lifestyle — Lower Parel, Mumbai",
      },
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
      invoiceAllocations: [
        {
          invoiceNo: "INV-2026-0012",
          invoiceDate: "2026-06-12",
          totalInvoicedQty: 80,
          allocatedStore: "Lifestyle — Lower Parel, Mumbai",
          storeAllocatedQty: 80,
          storeLyingQty: 60,
        },
      ],
      claims: {
        damageQty: 0,
        expiryQty: 0,
        shrinkageQty: 0,
        displayLossQty: 0,
      },
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

  private suggestedDispatches: SuggestedDispatchOrder[] = [
    {
      id: "dsp-501",
      customerName: "Reliance Retail Ltd",
      destinationStore: "Reliance Fresh — Phoenix Marketcity, Kurla",
      sku: "SHOE-001",
      productName: "Nike Sports Shoes (Black / 9)",
      currentStockDOS: 7.1,
      suggestedQty: 50,
      unitPrice: 2000,
      estimatedTotal: 100000,
      status: "DRAFT_SUGGESTED",
      createdDate: new Date().toISOString().slice(0, 10),
    },
    {
      id: "dsp-502",
      customerName: "Avenue Supermarts (D-Mart)",
      destinationStore: "D-Mart — Malad West, Mumbai",
      sku: "TSHIRT-001",
      productName: "Cotton Polo T-Shirt Premium (L)",
      currentStockDOS: 6.9,
      suggestedQty: 100,
      unitPrice: 600,
      estimatedTotal: 60000,
      status: "DRAFT_SUGGESTED",
      createdDate: new Date().toISOString().slice(0, 10),
    },
  ];

  private constructor() {}

  public static getInstance(): CustomerStockVisibilityEngine {
    if (!CustomerStockVisibilityEngine.instance) {
      CustomerStockVisibilityEngine.instance = new CustomerStockVisibilityEngine();
    }
    return CustomerStockVisibilityEngine.instance;
  }

  public getCustomerStoreStock(keyAccount?: string, region?: string): CustomerStoreStockRecord[] {
    let result = [...this.storeStockLedger];
    if (keyAccount && keyAccount !== "ALL") {
      result = result.filter((r) => r.hierarchy.keyAccount === keyAccount);
    }
    if (region && region !== "ALL") {
      result = result.filter((r) => r.hierarchy.region === region);
    }
    return result;
  }

  public getSuggestedDispatches(): SuggestedDispatchOrder[] {
    return [...this.suggestedDispatches];
  }

  public approveDispatch(id: string): SuggestedDispatchOrder | null {
    const dsp = this.suggestedDispatches.find((d) => d.id === id);
    if (dsp) {
      dsp.status = "APPROVED";
      logger.info(`[CustomerStockVisibilityEngine] Approved suggested replenishment dispatch ${id} for ${dsp.destinationStore}.`);
      SPK.events.emit("ReplenishmentDispatchApproved", id, { id, store: dsp.destinationStore });
    }
    return dsp || null;
  }

  public importSellOutData(rows: SellOutImportRow[]): { importedRows: number; updatedRecords: number } {
    let updatedCount = 0;

    for (const row of rows) {
      const rec = this.storeStockLedger.find(
        (r) =>
          r.hierarchy.keyAccount.toLowerCase().includes(row.customerCode.toLowerCase()) &&
          r.sku === row.sku
      );

      if (rec) {
        rec.confirmedSoldQty += row.sellOutQty;
        rec.lastSellOutDate = row.sellOutDate;
        
        rec.currentLyingStock = Math.max(0, rec.invoicedQty - rec.confirmedSoldQty - rec.returnedQty);
        rec.sellThroughPct = rec.invoicedQty > 0 ? parseFloat(((rec.confirmedSoldQty / rec.invoicedQty) * 100).toFixed(1)) : 0;
        
        if (rec.avgDailySalesVelocity > 0) {
          rec.daysOfStock = parseFloat((rec.currentLyingStock / rec.avgDailySalesVelocity).toFixed(1));
          rec.weeksOfCover = parseFloat((rec.daysOfStock / 7).toFixed(1));
        }

        updatedCount += 1;
      }
    }

    logger.info(`[CustomerStockVisibilityEngine] Successfully imported ${rows.length} sell-out rows.`);
    return { importedRows: rows.length, updatedRecords: updatedCount };
  }
}
