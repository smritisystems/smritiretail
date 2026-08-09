/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : ItemService Core Domain Implementation
 * Standard     : SMAP Constitution v1.0 — Internal Domain Engine
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import logger from "../../core/logging/logger.js";
import { Product } from "../../types.js";
import { IItemService } from "../public/IItemService.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import { SPK } from "../SPK.js";

export class ItemService implements IItemService {
  private localCache: Product[] = [];
  private isLoaded = false;

  public async getAll(): Promise<Product[]> {
    try {
      const data = await apiFetchV1("/inventory/");
      if (Array.isArray(data)) {
        this.localCache = data.map((p: any) => this.normalizeBackendProduct(p));
        this.isLoaded = true;
        return this.localCache;
      }
    } catch (e) {
      logger.warn("[ItemService] Offline or API unreachable. Returning cached items.", e as unknown);
    }
    return this.localCache;
  }

  public async getById(id: string): Promise<Product | null> {
    const items = await this.getAll();
    return items.find((p) => p.id === id || p.code === id) || null;
  }

  public async getBySku(sku: string): Promise<Product | null> {
    const items = await this.getAll();
    const clean = sku.trim().toLowerCase();
    return items.find((p) => (p.sku && p.sku.toLowerCase() === clean) || p.code.toLowerCase() === clean) || null;
  }

  public async getByBarcode(barcode: string): Promise<Product | null> {
    const items = await this.getAll();
    const clean = barcode.trim();
    return items.find((p) => {
      if (p.barcode === clean) return true;
      if (p.secondaryBarcodes && p.secondaryBarcodes.includes(clean)) return true;
      if (p.barcodes && p.barcodes.some((b) => b.value === clean)) return true;
      return false;
    }) || null;
  }

  public async search(query: string, category?: string, limit = 50): Promise<Product[]> {
    const items = await this.getAll();
    const q = query.trim().toLowerCase();

    return items
      .filter((p) => {
        const matchesCategory = !category || category === "ALL" || p.category === category;
        if (!matchesCategory) return false;

        if (!q) return true;
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku ? p.sku.toLowerCase().includes(q) : false;
        const matchCode = p.code ? p.code.toLowerCase().includes(q) : false;
        const matchBarcode = p.barcode ? p.barcode.includes(q) : false;
        const matchBrand = p.brand ? p.brand.toLowerCase().includes(q) : false;
        const matchHsn = p.hsn_code || p.hsnCode ? (p.hsn_code || p.hsnCode || "").includes(q) : false;

        return matchName || matchSku || matchCode || matchBarcode || matchBrand || matchHsn;
      })
      .slice(0, limit);
  }

  public validateStatus(product: Product | Partial<Product>): { allowed: boolean; reason?: string } {
    const status = product.status || "Active";
    switch (status) {
      case "Active":
        return { allowed: true };
      case "Draft":
        return { allowed: false, reason: `Item [${product.name || product.code}] is in DRAFT status and cannot be billed or ordered.` };
      case "Inactive":
        return { allowed: false, reason: `Item [${product.name || product.code}] is INACTIVE.` };
      case "Blocked":
        return { allowed: false, reason: `SECURITY ALERT: Item [${product.name || product.code}] is BLOCKED by governance.` };
      case "Discontinued":
        return { allowed: false, reason: `Item [${product.name || product.code}] is DISCONTINUED.` };
      default:
        return { allowed: true };
    }
  }

  public async save(productData: Partial<Product>): Promise<Product> {
    const isNew = !productData.id || productData.id.startsWith("prod_temp_");
    const id = productData.id || `prod_${Date.now()}`;
    
    // Phase A Enforcement 1: Duplicate Barcode Check (in-process, no API needed)
    if (productData.barcode && productData.barcode.trim()) {
      const cleanBarcode = productData.barcode.trim();
      const existingWithBarcode = this.localCache.find(
        (p) => p.id !== id && (p.barcode === cleanBarcode || (p.secondaryBarcodes && p.secondaryBarcodes.includes(cleanBarcode)))
      );
      if (existingWithBarcode) {
        throw new Error(
          `DUPLICATE BARCODE REJECTED: Barcode "${cleanBarcode}" is already assigned to "${existingWithBarcode.name}" (SKU: ${existingWithBarcode.sku || existingWithBarcode.code}).`
        );
      }
    }

    const sku: Product = {
      id,
      code: productData.code || productData.sku || `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      sku: productData.sku || productData.code || `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      barcode: productData.barcode || `${Math.floor(8900000000000 + Math.random() * 9000000000)}`,
      name: productData.name || "Unnamed Master SKU",
      category: productData.category || "General",
      brand: productData.brand || "Smriti Standard",
      hsn_code: productData.hsn_code || productData.hsnCode || "8471",
      hsnCode: productData.hsn_code || productData.hsnCode || "8471",
      gst_rate: productData.gst_rate ?? productData.gstPercentage ?? 18,
      gstPercentage: productData.gst_rate ?? productData.gstPercentage ?? 18,
      mrp: productData.mrp ?? 100,
      price: productData.price ?? 100,
      purchase_price: productData.purchase_price ?? productData.costPrice ?? 60,
      costPrice: productData.purchase_price ?? productData.costPrice ?? 60,
      stock: productData.stock ?? productData.stock_qty ?? 0,
      stock_qty: productData.stock ?? productData.stock_qty ?? 0,
      uom: productData.uom || "Pcs",
      status: productData.status || "Active",
      secondaryBarcodes: productData.secondaryBarcodes || [],
      attributes: productData.attributes || {}
    };

    // Optimistically upsert into local cache so that the duplicate-barcode
    // guard above can detect conflicts on subsequent in-process saves even
    // when the API is unreachable (unit-test environment, offline mode).
    // The cache entry is rolled back if the API call fails.
    const previousCacheEntry = this.localCache.find((p) => p.id === id);
    this.upsertLocalCache(sku);

    try {
      const endpoint = isNew ? "/inventory/" : `/inventory/${id}`;
      const method = isNew ? "POST" : "PUT";
      const savedResponse = await apiFetchV1(endpoint, {
        method,
        body: JSON.stringify(sku)
      });

      const normalized = this.normalizeBackendProduct(savedResponse || sku);
      this.upsertLocalCache(normalized);
      
      SPK.events.emit(isNew ? "ItemCreated" : "ItemUpdated", normalized.id, normalized);
      return normalized;
    } catch (err) {
      // Roll back optimistic cache entry on API failure
      if (previousCacheEntry) {
        this.upsertLocalCache(previousCacheEntry);
      } else {
        this.localCache = this.localCache.filter((p) => p.id !== id);
      }
      logger.error("[ItemService] Backend save failed:", err as unknown);
      throw err;
    }
  }

  public async delete(id: string): Promise<boolean> {
    try {
      await apiFetchV1(`/inventory/${id}`, { method: "DELETE" });
    } catch (e) {
      logger.error("[ItemService] Backend delete failed:", e as unknown);
      throw e;
    }
    this.localCache = this.localCache.filter((p) => p.id !== id);
    SPK.events.emit("ItemDeleted", id, { id });
    return true;
  }

  private upsertLocalCache(product: Product): void {
    const idx = this.localCache.findIndex((p) => p.id === product.id);
    if (idx >= 0) {
      this.localCache[idx] = product;
    } else {
      this.localCache.unshift(product);
    }
  }

  private normalizeBackendProduct(p: any): Product {
    return {
      id: p.id,
      code: p.code || p.sku,
      sku: p.sku || p.code,
      barcode: p.barcode || "",
      secondaryBarcodes: p.secondary_barcodes || p.secondaryBarcodes || [],
      barcodes: [
        { type: "Code128", value: p.barcode, isPrimary: true },
        ...(p.secondary_barcodes || []).map((val: string) => ({ type: "Code128", value: val, isPrimary: false }))
      ],
      name: p.name || "",
      category: p.category || "General",
      brand: p.brand || "Smriti Standard",
      hsn_code: p.hsn_code || p.hsnCode || "8471",
      hsnCode: p.hsn_code || p.hsnCode || "8471",
      gst_rate: p.gst_rate !== undefined ? parseFloat(p.gst_rate) : (p.gst_percentage ? parseFloat(p.gst_percentage) : 18),
      gstPercentage: p.gst_percentage !== undefined ? parseFloat(p.gst_percentage) : (p.gst_rate ? parseFloat(p.gst_rate) : 18),
      mrp: p.mrp ? parseFloat(p.mrp) : 0,
      price: p.price ? parseFloat(p.price) : 0,
      purchase_price: p.cost_price ? parseFloat(p.cost_price) : (p.purchase_price ? parseFloat(p.purchase_price) : 0),
      costPrice: p.cost_price ? parseFloat(p.cost_price) : 0,
      stock: p.stock !== undefined ? p.stock : (p.stock_qty !== undefined ? p.stock_qty : 0),
      stock_qty: p.stock_qty !== undefined ? p.stock_qty : (p.stock !== undefined ? p.stock : 0),
      uom: p.uom || "Pcs",
      color: p.color,
      size: p.size,
      attributes: p.attributes || {}
    };
  }
}
