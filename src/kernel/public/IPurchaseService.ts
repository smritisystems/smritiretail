/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : IPurchaseService Public Interface Contract
 * Standard     : SMAP Constitution v1.0 — Public Contract (Level 2)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export type PurchaseOrderStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Partial"
  | "Received"
  | "Cancelled";

export interface PurchaseLineItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  hsnCode?: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  discountPercent?: number;
  uom?: string;
  warehouseId?: string;
}

export interface PurchaseOrderRecord {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: string; // ISO YYYY-MM-DD
  expectedDeliveryDate?: string;
  warehouseId?: string;
  paymentTerms?: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  totalTaxAmount: number;
  netPayable: number;
  lines: PurchaseLineItem[];
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

export interface IPurchaseService {
  /**
   * Resolve a purchase order by primary ID / UUID
   */
  getPOById(id: string): Promise<PurchaseOrderRecord | null>;

  /**
   * Resolve a purchase order by PO Number
   */
  getByPONumber(poNumber: string): Promise<PurchaseOrderRecord | null>;

  /**
   * Fetch all purchase orders for a specific supplier
   * AUD-004 / GAP-2: Supplier-level PO lookup
   */
  getBySupplier(supplierId: string): Promise<PurchaseOrderRecord[]>;

  /**
   * Search purchase orders by PO Number, Supplier, or Status
   */
  searchPOs(query: string, limit?: number): Promise<PurchaseOrderRecord[]>;

  /**
   * Save or update a purchase order record through UVE validation and Command Bus
   */
  savePO(po: Partial<PurchaseOrderRecord>): Promise<PurchaseOrderRecord>;

  /**
   * Post Goods Receipt Note (GRN) against a Purchase Order
   */
  postGRN(poId: string, receivedLines: { itemId: string; receivedQty: number }[]): Promise<PurchaseOrderRecord>;

  /**
   * Cancel a Purchase Order with a mandatory reason.
   * AUD-004 / GAP-1 / GAP-4: cancelPO lifecycle guardrail
   * Only Draft, Submitted, or Approved POs can be cancelled.
   * Received or already Cancelled POs must reject with a domain error.
   */
  cancelPO(id: string, reason: string, cancelledBy?: string): Promise<PurchaseOrderRecord>;

  /**
   * Fetch all purchase orders from SSOT
   */
  getAllPOs(): Promise<PurchaseOrderRecord[]>;
}
