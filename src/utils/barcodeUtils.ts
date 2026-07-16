/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { Product } from "../types.js";

/**
 * Barcode Mapping Utility Functions
 * Helps manage multiple aliases (barcodes) per item.
 */
export const BarcodeUtils = {
  /**
   * Get all barcodes for a product, including the primary barcode and aliases.
   */
  getAllBarcodes(product: Product): { type: string; value: string; isPrimary: boolean }[] {
    const barcodes: { type: string; value: string; isPrimary: boolean }[] = [];
    
    // Add primary barcode
    if (product.barcode) {
      barcodes.push({ type: "Primary", value: product.barcode, isPrimary: true });
    }
    
    // Add secondary string aliases if any
    if (product.secondaryBarcodes) {
      product.secondaryBarcodes.forEach(value => {
        barcodes.push({ type: "Secondary", value, isPrimary: false });
      });
    }
    
    // Add structured aliases
    if (product.barcodes) {
      product.barcodes.forEach(b => {
        barcodes.push({ type: b.type, value: b.value, isPrimary: !!b.isPrimary });
      });
    }
    
    // Deduplicate by value
    const unique = new Map();
    barcodes.forEach(b => {
      if (!unique.has(b.value)) {
        unique.set(b.value, b);
      } else if (b.isPrimary) {
        unique.set(b.value, b); // Prefer primary if duplicate
      }
    });
    
    return Array.from(unique.values());
  },

  /**
   * Find a product by any of its mapped barcodes
   */
  findProductByBarcode(products: Product[], barcodeValue: string): Product | undefined {
    return products.find(p => {
      if (p.barcode === barcodeValue) return true;
      if (p.secondaryBarcodes?.includes(barcodeValue)) return true;
      if (p.barcodes?.some(b => b.value === barcodeValue)) return true;
      return false;
    });
  },

  /**
   * Check if a barcode is already mapped globally
   */
  isBarcodeGloballyMapped(products: Product[], barcodeValue: string, excludeProductId?: string): boolean {
    const productsToCheck = excludeProductId ? products.filter(p => p.id !== excludeProductId) : products;
    return !!this.findProductByBarcode(productsToCheck, barcodeValue);
  }
};
