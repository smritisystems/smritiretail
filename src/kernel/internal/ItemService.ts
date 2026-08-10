/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : ItemService Core Domain Implementation
 * Standard     : SMAP Constitution v1.0 — Internal Domain Engine
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 *
 * Hardening    : F-001 (EAN-13), F-002 (lifecycle mapping),
 *                F-003 (honest failure), F-004 (UUID identity)
 */

import logger from "../../core/logging/logger.js";
import { Product, ProductStatus } from "../../types.js";
import { IItemService } from "../public/IItemService.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import { SPK } from "../SPK.js";
// F-001: Reuse the canonical SMRITI BarcodeEngine — no duplicate algorithm.
import { BarcodeEngine } from "../../services/barcodeEngine.js";

// ─── F-002: Lifecycle Mapping Helpers ────────────────────────────────────────

/**
 * Maps the frontend ProductStatus vocabulary to the existing backend
 * authoritative columns: workflow_status (String(30)) and is_active (Boolean).
 * Both columns are part of BaseEntity — no migration required.
 */
function mapStatusToLifecycle(status?: string): { workflow_status: string; is_active: boolean } {
  switch (status) {
    case "Active":       return { workflow_status: "Active",       is_active: true  };
    case "Inactive":     return { workflow_status: "Inactive",     is_active: false };
    case "Draft":        return { workflow_status: "Draft",        is_active: false };
    case "Blocked":      return { workflow_status: "Blocked",      is_active: false };
    case "Discontinued": return { workflow_status: "Discontinued", is_active: false };
    default:             return { workflow_status: "Active",       is_active: true  };
  }
}

/**
 * Reverse mapping: derives frontend ProductStatus from the backend
 * authoritative fields returned in ProductResponse.
 */
function mapLifecycleToStatus(
  workflowStatus?: string | null,
  isActive?: boolean | null
): ProductStatus {
  const ws = workflowStatus || "Active";
  if (isActive !== false && ws === "Active") return "Active";
  if (ws === "Draft")        return "Draft";
  if (ws === "Blocked")      return "Blocked";
  if (ws === "Discontinued") return "Discontinued";
  return "Inactive";
}

// ─── F-001: EAN-13 Generation ─────────────────────────────────────────────────

/**
 * Generates a GS1 restricted-circulation EAN-13 (prefix "200") using the
 * canonical BarcodeEngine check-digit algorithm.
 *
 * The "200" prefix range is reserved for internal retail use (GS1 standard).
 * This is the ONLY auto-generation entry point in ItemService.
 * Exported so ItemMasterTab.blankItemForm() can use the same logic.
 */
export function generateSmritiEan13(): string {
  const seq = Math.floor(Math.random() * 999999999) + 1;
  return BarcodeEngine.generateInternalEAN13("200", seq);
}

// ─────────────────────────────────────────────────────────────────────────────

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
      // ─── F-003: Honest API failure distinction ──────────────────────────
      // Case A: Cache populated from prior successful load (legitimate offline).
      //         Return cache + emit ItemLoadFailed so UI can show indicator.
      if (this.isLoaded && this.localCache.length > 0) {
        logger.warn("[ItemService] API unavailable. Serving cached items.", e as unknown);
        SPK.events.emit("ItemLoadFailed", "network", {
          error: String(e),
          source: "getAll",
          cacheSize: this.localCache.length,
        });
        return this.localCache;
      }
      // Case B: Cache empty (never loaded). Do NOT return empty [] and pretend success.
      //         Rethrow so ItemMasterTab surfaces a real error state.
      logger.error("[ItemService] API unavailable and local cache is empty.", e as unknown);
      throw e;
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
        return (
          p.name.toLowerCase().includes(q) ||
          (p.sku ? p.sku.toLowerCase().includes(q) : false) ||
          (p.code ? p.code.toLowerCase().includes(q) : false) ||
          (p.barcode ? p.barcode.includes(q) : false) ||
          (p.brand ? p.brand.toLowerCase().includes(q) : false) ||
          ((p.hsn_code || p.hsnCode || "").includes(q))
        );
      })
      .slice(0, limit);
  }

  /**
   * validateStatus reads the frontend status field (always populated via
   * normalizeBackendProduct after F-002 fix) and applies POS guardrail rules.
   */
  public validateStatus(product: Product | Partial<Product>): { allowed: boolean; reason?: string } {
    const status = product.status || "Active";
    switch (status) {
      case "Active":       return { allowed: true };
      case "Draft":        return { allowed: false, reason: `Item [${product.name || product.code}] is in DRAFT status and cannot be billed or ordered.` };
      case "Inactive":     return { allowed: false, reason: `Item [${product.name || product.code}] is INACTIVE.` };
      case "Blocked":      return { allowed: false, reason: `SECURITY ALERT: Item [${product.name || product.code}] is BLOCKED by governance.` };
      case "Discontinued": return { allowed: false, reason: `Item [${product.name || product.code}] is DISCONTINUED.` };
      default:             return { allowed: true };
    }
  }

  public async save(productData: Partial<Product>): Promise<Product> {
    // ─── F-004: Stable UUID identity ───────────────────────────────────────
    // crypto.randomUUID() replaces prod_${Date.now()} — standards-compliant UUID v4.
    // prod_temp_ prefix check is preserved for backward compatibility.
    // For Item Master (always online), the backend generates the authoritative ID
    // (ProductCreate.id is now Optional server-side). The client UUID is passed
    // for optimistic cache coherence; the server returns the final ID.
    const isNew = !productData.id || productData.id.startsWith("prod_temp_");
    const id = (productData.id && !productData.id.startsWith("prod_temp_"))
      ? productData.id
      : crypto.randomUUID();

    // Phase A Enforcement 1: Duplicate Barcode Check (in-process, no API needed)
    if (productData.barcode && productData.barcode.trim()) {
      const cleanBarcode = productData.barcode.trim();
      const existingWithBarcode = this.localCache.find(
        (p) => p.id !== id &&
          (p.barcode === cleanBarcode || (p.secondaryBarcodes && p.secondaryBarcodes.includes(cleanBarcode)))
      );
      if (existingWithBarcode) {
        throw new Error(
          `DUPLICATE BARCODE REJECTED: Barcode "${cleanBarcode}" is already assigned to "${existingWithBarcode.name}" (SKU: ${existingWithBarcode.sku || existingWithBarcode.code}).`
        );
      }
    }

    // ─── F-001: EAN-13 generation ───────────────────────────────────────────
    // Only auto-generate when no barcode was supplied (manual/Excel barcodes are preserved).
    const barcode = productData.barcode?.trim() || generateSmritiEan13();

    // ─── F-002: Map frontend status → backend authoritative lifecycle columns ─
    const lifecycle = mapStatusToLifecycle(productData.status);

    const sku: Product = {
      id,
      code: productData.code || productData.sku || `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      sku: productData.sku || productData.code || `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      barcode,
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

    // Optimistic cache update — rolled back on API failure
    const previousCacheEntry = this.localCache.find((p) => p.id === id);
    this.upsertLocalCache(sku);

    try {
      const endpoint = isNew ? "/inventory/" : `/inventory/${id}`;
      const method = isNew ? "POST" : "PUT";

      // F-002: Send backend-authoritative lifecycle fields alongside the rest of the payload
      const backendPayload = {
        ...sku,
        workflow_status: lifecycle.workflow_status,
        is_active: lifecycle.is_active,
      };

      const savedResponse = await apiFetchV1(endpoint, {
        method,
        body: JSON.stringify(backendPayload)
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

  /**
   * normalizeBackendProduct — maps FastAPI ProductResponse → frontend Product.
   *
   * F-002: status is ALWAYS derived from the backend authoritative fields:
   *   workflow_status (String(30)) and is_active (Boolean) — both in BaseEntity.
   * The frontend status field is a display-only concept; it is never stored as-is.
   */
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
      attributes: p.attributes || {},
      // F-002: derive status from backend authoritative lifecycle columns
      status: mapLifecycleToStatus(p.workflow_status, p.is_active),
    };
  }
}

