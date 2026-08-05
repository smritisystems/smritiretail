/**
 * Project      : SMRITI Retail OS
 * Module       : IndustryRegistry & Industry Plugin System (SCS-PRO-001 Standard)
 * Description  : Pluggable industry package system supplying Masters, Templates,
 *                Policies, Reports, Layouts, Validators, and Barcode Profiles.
 * Standard     : SCS-PRO-001 — Organization Lifecycle Engine & Industry Plugins
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

export interface IndustryPluginPackage {
  id: string;
  name: string;
  icon: string;
  description: string;
  capabilitiesEnabled: string[];
  defaultPolicies: Record<string, any>;
  customAttributes: Array<{ name: string; type: string; required: boolean }>;
  barcodeTemplate: string;
  receiptFooter: string;
}

const FOOTWEAR_PLUGIN: IndustryPluginPackage = {
  id: "footwear",
  name: "Footwear & Apparel Retail",
  icon: "👟",
  description: "Shoe Size Matrix (UK/US/EU), Color Master, Brand Matrix, and Barcode Label Profiles",
  capabilitiesEnabled: ["priceMatrix", "promotions", "barcode", "thermal"],
  defaultPolicies: {
    negativeStockPolicy: "block",
    maxDiscountPercent: 25,
    allowReturns: true,
  },
  customAttributes: [
    { name: "Shoe Size", type: "enum", required: true },
    { name: "Color", type: "string", required: true },
    { name: "Gender / Age Group", type: "enum", required: false },
  ],
  barcodeTemplate: "FOOTWEAR_STICKER_50X25",
  receiptFooter: "Thank you for shopping at SMRITI Footwear! Exchange valid within 7 days with bill.",
};

const PHARMACY_PLUGIN: IndustryPluginPackage = {
  id: "pharmacy",
  name: "Pharmacy & Healthcare Retail",
  icon: "💊",
  description: "Batch tracking, Expiry enforcement (FEFO), Schedule H Drug Register, and Doctor Prescriptions",
  capabilitiesEnabled: ["batch", "expiry", "barcode", "thermal"],
  defaultPolicies: {
    negativeStockPolicy: "block",
    maxDiscountPercent: 10,
    requireManagerApprovalOnReturn: true,
  },
  customAttributes: [
    { name: "Batch Number", type: "string", required: true },
    { name: "Expiry Date", type: "date", required: true },
    { name: "Drug Schedule Type", type: "enum", required: true },
  ],
  barcodeTemplate: "PHARMA_BATCH_STICKER_38X25",
  receiptFooter: "Medicines once sold cannot be returned. Doctor prescription required for Schedule H items.",
};

const GENERAL_RETAIL_PLUGIN: IndustryPluginPackage = {
  id: "general_retail",
  name: "General Supermarket & Kirana",
  icon: "🛒",
  description: "High-speed POS billing, weighing scale integration, MRP discounts, and multi-buy offers",
  capabilitiesEnabled: ["barcode", "thermal", "promotions", "coupons"],
  defaultPolicies: {
    negativeStockPolicy: "warn",
    maxDiscountPercent: 20,
    allowReturns: true,
  },
  customAttributes: [
    { name: "Brand", type: "string", required: false },
    { name: "Category", type: "string", required: true },
  ],
  barcodeTemplate: "SUPERMARKET_SHELF_LABEL",
  receiptFooter: "Thank you for shopping with us! Visit again.",
};

class IndustryRegistryService {
  private plugins = new Map<string, IndustryPluginPackage>([
    ["footwear", FOOTWEAR_PLUGIN],
    ["pharmacy", PHARMACY_PLUGIN],
    ["general_retail", GENERAL_RETAIL_PLUGIN],
  ]);

  public get(pluginId: string): IndustryPluginPackage {
    return this.plugins.get(pluginId) || GENERAL_RETAIL_PLUGIN;
  }

  public getAll(): IndustryPluginPackage[] {
    return Array.from(this.plugins.values());
  }

  public register(plugin: IndustryPluginPackage): void {
    this.plugins.set(plugin.id, plugin);
  }
}

export const IndustryRegistry = new IndustryRegistryService();
