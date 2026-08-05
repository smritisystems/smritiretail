/**
 * Project      : SMRITI Retail OS v7.0
 * Module       : Master Data Quality Engine (MDQE / SPK.quality)
 * Standard     : UPR / UEDF Standard v1.0 — Reusable Enterprise Quality Engine
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import { Product } from "../../types.js";

export interface MissingGapItem {
  id: string;
  field: string;
  category: "Basic Info" | "Pricing" | "Inventory" | "Barcode & Labels" | "Supplier" | "Images";
  severity: "critical" | "warning" | "info";
  message: string;
  targetTab: string;
  weightPercent: number;
}

export interface ProductQualityResult {
  overallScore: number; // 0 - 100
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  gradeLabel: string;
  categoryBreakdown: {
    basicInfo: number;
    pricing: number;
    inventory: number;
    barcodeLabel: number;
    supplier: number;
    images: number;
  };
  missingGaps: MissingGapItem[];
  hasCriticalGaps: boolean;
}

export class MasterDataQualityEngine {
  /**
   * Assesses Product Master data quality against retail operational standards
   */
  public evaluateProduct(product: Product | Partial<Product>): ProductQualityResult {
    const missingGaps: MissingGapItem[] = [];

    // 1. Basic Info Assessment (Weight: 25%)
    let basicScore = 0;
    if (product.name && product.name.trim().length >= 3) basicScore += 40;
    else {
      missingGaps.push({
        id: "gap_name",
        field: "name",
        category: "Basic Info",
        severity: "critical",
        message: "Item Name is missing or too short",
        targetTab: "overview",
        weightPercent: 10,
      });
    }

    if (product.code || product.sku) basicScore += 30;
    else {
      missingGaps.push({
        id: "gap_sku",
        field: "sku",
        category: "Basic Info",
        severity: "critical",
        message: "Item Code / SKU identifier is unassigned",
        targetTab: "overview",
        weightPercent: 7.5,
      });
    }

    if (product.category && product.category !== "General") basicScore += 15;
    else {
      missingGaps.push({
        id: "gap_category",
        field: "category",
        category: "Basic Info",
        severity: "warning",
        message: "Category is defaulted to General",
        targetTab: "overview",
        weightPercent: 3.75,
      });
    }

    if (product.brand && product.brand !== "Smriti Standard") basicScore += 15;
    else {
      missingGaps.push({
        id: "gap_brand",
        field: "brand",
        category: "Basic Info",
        severity: "info",
        message: "Brand is defaulted to Smriti Standard",
        targetTab: "overview",
        weightPercent: 3.75,
      });
    }

    // 2. Pricing & Tax Assessment (Weight: 20%)
    let pricingScore = 0;
    const mrp = product.mrp || 0;
    const price = product.price || 0;
    const cost = product.costPrice || product.purchase_price || 0;

    if (mrp > 0) pricingScore += 25;
    else {
      missingGaps.push({
        id: "gap_mrp",
        field: "mrp",
        category: "Pricing",
        severity: "critical",
        message: "MRP Price is not configured",
        targetTab: "pricing",
        weightPercent: 5,
      });
    }

    if (price > 0) pricingScore += 25;
    else {
      missingGaps.push({
        id: "gap_price",
        field: "price",
        category: "Pricing",
        severity: "critical",
        message: "Retail Selling Price is 0.00",
        targetTab: "pricing",
        weightPercent: 5,
      });
    }

    if (cost > 0) pricingScore += 25;
    else {
      missingGaps.push({
        id: "gap_cost",
        field: "costPrice",
        category: "Pricing",
        severity: "warning",
        message: "Purchase Cost is zero (Margin calculations incomplete)",
        targetTab: "pricing",
        weightPercent: 5,
      });
    }

    const hsn = product.hsn_code || product.hsnCode;
    if (hsn && hsn.trim().length >= 4) pricingScore += 25;
    else {
      missingGaps.push({
        id: "gap_hsn",
        field: "hsnCode",
        category: "Pricing",
        severity: "critical",
        message: "HSN / SAC Tax Code is missing for GST compliance",
        targetTab: "overview",
        weightPercent: 5,
      });
    }

    // 3. Inventory & Location Assessment (Weight: 15%)
    let inventoryScore = 0;
    if (product.stock_qty !== undefined || product.qty !== undefined || product.stock !== undefined) {
      inventoryScore += 40;
    }
    if ((product.min_stock_level || 0) > 0) inventoryScore += 30;
    else {
      missingGaps.push({
        id: "gap_min_stock",
        field: "min_stock_level",
        category: "Inventory",
        severity: "warning",
        message: "Min Stock Reorder level is not defined",
        targetTab: "inventory",
        weightPercent: 4.5,
      });
    }
    if (product.warehouse) inventoryScore += 30;
    else {
      missingGaps.push({
        id: "gap_warehouse",
        field: "warehouse",
        category: "Inventory",
        severity: "info",
        message: "Preferred Warehouse location unassigned",
        targetTab: "inventory",
        weightPercent: 4.5,
      });
    }

    // 4. Barcode & Label Assessment (Weight: 15%)
    let barcodeLabelScore = 0;
    if (product.barcode && product.barcode.trim().length >= 6) {
      barcodeLabelScore += 60;
    } else {
      missingGaps.push({
        id: "gap_barcode",
        field: "barcode",
        category: "Barcode & Labels",
        severity: "critical",
        message: "Primary Barcode is unassigned",
        targetTab: "overview",
        weightPercent: 9,
      });
    }

    const template =
      (product as any).defaultLabelTemplate ||
      (product as any).label_template ||
      (product.attributes && (product.attributes.defaultLabelTemplate || product.attributes.label_template));
    if (template && String(template).trim().length > 0) {
      barcodeLabelScore += 40;
    } else {
      missingGaps.push({
        id: "gap_label_template",
        field: "defaultLabelTemplate",
        category: "Barcode & Labels",
        severity: "warning",
        message: "Default Thermal Label Profile unassigned (Required for 1-Click Print)",
        targetTab: "barcode",
        weightPercent: 6,
      });
    }

    // 5. Supplier Assessment (Weight: 10%)
    let supplierScore = 0;
    const supplier =
      (product as any).preferred_supplier ||
      (product as any).supplier ||
      (product.attributes && (product.attributes.preferred_supplier || product.attributes.supplier));
    const hasCatalogue = (product as any).supplierCatalogue && Array.isArray((product as any).supplierCatalogue) && (product as any).supplierCatalogue.length > 0;

    if (hasCatalogue || (supplier && String(supplier).trim().length > 0)) {
      supplierScore = 100;
    } else {
      missingGaps.push({
        id: "gap_supplier",
        field: "preferred_supplier",
        category: "Supplier",
        severity: "warning",
        message: "Preferred Supplier Linkage is missing for Procurement PO generation",
        targetTab: "suppliers",
        weightPercent: 10,
      });
    }

    // 6. Images & Media Assessment (Weight: 15%)
    let imageScore = 0;
    const hasPrimaryImg = product.primaryImageUrl && product.primaryImageUrl.trim().length > 0;
    const hasTaggedImg = (product as any).taggedMedia && Array.isArray((product as any).taggedMedia) && (product as any).taggedMedia.length > 0;

    if (hasPrimaryImg || hasTaggedImg) {
      imageScore += 70;
    } else {
      missingGaps.push({
        id: "gap_image",
        field: "primaryImageUrl",
        category: "Images",
        severity: "warning",
        message: "Primary Product Image is missing",
        targetTab: "overview",
        weightPercent: 10.5,
      });
    }

    if ((product.galleryImages && product.galleryImages.length > 0) || hasTaggedImg) {
      imageScore += 30;
    } else {
      missingGaps.push({
        id: "gap_gallery",
        field: "galleryImages",
        category: "Images",
        severity: "info",
        message: "No multi-angle gallery images uploaded",
        targetTab: "overview",
        weightPercent: 4.5,
      });
    }

    // Weighted Overall Score Calculation
    const overallScore = Math.round(
      basicScore * 0.25 +
        pricingScore * 0.2 +
        inventoryScore * 0.15 +
        barcodeLabelScore * 0.15 +
        supplierScore * 0.1 +
        imageScore * 0.15
    );

    let grade: "A+" | "A" | "B" | "C" | "D" | "F" = "F";
    let gradeLabel = "Critical Gaps";

    if (overallScore >= 95) {
      grade = "A+";
      gradeLabel = "Pristine Master Data";
    } else if (overallScore >= 85) {
      grade = "A";
      gradeLabel = "Production Ready";
    } else if (overallScore >= 75) {
      grade = "B";
      gradeLabel = "Minor Gaps";
    } else if (overallScore >= 60) {
      grade = "C";
      gradeLabel = "Requires Review";
    } else if (overallScore >= 40) {
      grade = "D";
      gradeLabel = "Incomplete SKU";
    }

    const hasCriticalGaps = missingGaps.some((g) => g.severity === "critical");

    return {
      overallScore,
      grade,
      gradeLabel,
      categoryBreakdown: {
        basicInfo: Math.round(basicScore),
        pricing: Math.round(pricingScore),
        inventory: Math.round(inventoryScore),
        barcodeLabel: Math.round(barcodeLabelScore),
        supplier: Math.round(supplierScore),
        images: Math.round(imageScore),
      },
      missingGaps,
      hasCriticalGaps,
    };
  }
}

export const MDQE = new MasterDataQualityEngine();
