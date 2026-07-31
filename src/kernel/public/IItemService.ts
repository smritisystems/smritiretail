/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : IItemService Public Interface Contract
 * Standard     : SMAP Constitution v1.0 — Public Contract (Level 2)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { Product } from "../../types.js";

export interface IItemService {
  /**
   * Resolve an item by its primary surrogate key (UUID / item_id)
   */
  getById(id: string): Promise<Product | null>;

  /**
   * Resolve an item by its unique business SKU identifier
   */
  getBySku(sku: string): Promise<Product | null>;

  /**
   * Resolve an item by any associated barcode (retail, supplier, carton, package)
   */
  getByBarcode(barcode: string): Promise<Product | null>;

  /**
   * Search items across SKU, Barcode, Name, Brand, Category, HSN using Universal Search Engine
   */
  search(query: string, category?: string, limit?: number): Promise<Product[]>;

  /**
   * Create or update an item master record through UVE validation and Command Bus
   */
  save(product: Partial<Product>): Promise<Product>;

  /**
   * Soft-delete an item master record by UUID
   */
  delete(id: string): Promise<boolean>;

  /**
   * Fetch all active items from Item Master SSOT
   */
  getAll(): Promise<Product[]>;
}
