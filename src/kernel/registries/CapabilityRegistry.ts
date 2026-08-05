/**
 * Project      : SMRITI Retail OS
 * Module       : CapabilityRegistry (SCS-WSC-001 Standard)
 * Description  : Platform-wide capability assertions registry. Asserts whether
 *                the underlying platform supports technical features (e.g. batch,
 *                expiry, rfid, priceMatrix, thermal, digitalSignature).
 * Standard     : SCS-WSC-001 — SMRITI Workspace Context & Resolver
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

export type CapabilityCategory = "Inventory" | "Pricing" | "Documents" | "POS" | "Accounting";

export interface CapabilityDef {
  key: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  supported: boolean;
}

class CapabilityRegistryService {
  private capabilities = new Map<string, CapabilityDef>([
    // Inventory Capabilities
    ["batch", { key: "batch", name: "Batch / Lot Tracking", category: "Inventory", description: "Batch & Lot number tracking with manufacturing dates", supported: true }],
    ["expiry", { key: "expiry", name: "Expiry Date Tracking", category: "Inventory", description: "Perishable item shelf-life and FEFO enforcement", supported: true }],
    ["serial", { key: "serial", name: "Serial Number Tracking", category: "Inventory", description: "Unique serial number tracking for electronics", supported: true }],
    ["rfid", { key: "rfid", name: "RFID Tagging", category: "Inventory", description: "High-speed RFID inventory scanning", supported: true }],
    ["negativeStock", { key: "negativeStock", name: "Negative Stock Control", category: "Inventory", description: "Policy control for billing items below zero stock", supported: true }],
    ["multiWarehouse", { key: "multiWarehouse", name: "Multi-Warehouse Transfers", category: "Inventory", description: "Inter-warehouse stock transfer and transit tracking", supported: true }],

    // Pricing Capabilities
    ["priceMatrix", { key: "priceMatrix", name: "Tiered Price Matrix", category: "Pricing", description: "Wholesale & retail volume pricing tiers", supported: true }],
    ["promotions", { key: "promotions", name: "Promotions & Discounts", category: "Pricing", description: "Rule-based promotional discounts", supported: true }],
    ["coupons", { key: "coupons", name: "Coupon Code Engine", category: "Pricing", description: "Single-use and multi-use coupon validation", supported: true }],

    // Document Capabilities
    ["barcode", { key: "barcode", name: "Barcode Label Engine", category: "Documents", description: "Dynamic SVG barcode & QR label generator", supported: true }],
    ["thermal", { key: "thermal", name: "ESC/POS Thermal Printing", category: "Documents", description: "Direct hardware thermal printer output", supported: true }],
    ["qr", { key: "qr", name: "Dynamic UPI QR Generation", category: "Documents", description: "NPCI compliant payment QR codes on receipts", supported: true }],
    ["digitalSignature", { key: "digitalSignature", name: "Digital Signature PDF", category: "Documents", description: "PKCS#7 cryptographic PDF signing", supported: true }],
  ]);

  public has(key: string): boolean {
    const cap = this.capabilities.get(key);
    return cap ? cap.supported : false;
  }

  public get(key: string): CapabilityDef | undefined {
    return this.capabilities.get(key);
  }

  public register(cap: CapabilityDef): void {
    this.capabilities.set(cap.key, cap);
  }

  public getAll(): CapabilityDef[] {
    return Array.from(this.capabilities.values());
  }

  public getByCategory(category: CapabilityCategory): CapabilityDef[] {
    return this.getAll().filter((c) => c.category === category);
  }
}

export const CapabilityRegistry = new CapabilityRegistryService();
