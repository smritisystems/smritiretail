/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : IInventoryService Public Interface Contract
 * Standard     : SMAP Constitution v1.0 — Public Contract (Level 2)
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * License      : Proprietary Commercial Software
 */

export interface StockLevelRecord {
  sku: string;
  productId: string;
  warehouseId: string;
  onHand: number;
  reserved: number;
  locked: number;
  availableToPromise: number; // On Hand - Reserved - Locked
  reorderLevel?: number;
  maxStockLevel?: number;
}

export interface StockAdjustmentRecord {
  id: string;
  sku: string;
  warehouseId: string;
  previousQty: number;
  changeQty: number;
  newQty: number;
  reason: string;
  batchNumber?: string;
  expiryDate?: string;
  binLocation?: string;
  adjustedAt: string;
  adjustedBy?: string;
  success: boolean;
}

export interface StockTransferRecord {
  transferId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  items: Array<{ productId: string; sku?: string; qty: number }>;
  status: "Draft" | "InTransit" | "Completed" | "Cancelled";
  reference?: string;
  createdAt: string;
}

export interface IInventoryService {
  /**
   * Resolve physical on-hand quantity for a SKU in a warehouse
   */
  getStockQuantity(sku: string, warehouseId?: string): Promise<number>;

  /**
   * Resolve Available-To-Promise (ATP) derived stock (On Hand - Reserved - Locked)
   */
  getAvailableToPromise(productId: string, warehouseId?: string): Promise<number>;

  /**
   * Adjust stock quantity (+/-) with mandatory reason code, batch/expiry and bin location
   */
  adjustStock(
    sku: string,
    qtyChange: number,
    reason: string,
    warehouseId?: string,
    userId?: string,
    batchNumber?: string,
    expiryDate?: string,
    binLocation?: string
  ): Promise<StockAdjustmentRecord>;

  /**
   * Transfer stock between warehouses
   */
  transferStock(
    fromWarehouseId: string,
    toWarehouseId: string,
    items: Array<{ productId: string; sku?: string; qty: number }>,
    reference?: string
  ): Promise<StockTransferRecord>;

  /**
   * Fetch stock levels across warehouses or for a specific warehouse
   */
  getAllStockLevels(warehouseId?: string): Promise<StockLevelRecord[]>;

  /**
   * Fetch unified inventory movement timeline / audit stream
   */
  getTimeline(productId?: string, warehouseId?: string, limit?: number): Promise<any[]>;
}
