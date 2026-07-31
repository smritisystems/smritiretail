/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : IPurchaseService Public Interface Contract
 * Standard     : SMAP Constitution v1.0 — Public Contract (Level 2)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

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
  status: "Draft" | "Approved" | "Partial" | "Received" | "Cancelled" | string;
  totalAmount: number;
  totalTaxAmount: number;
  netPayable: number;
  lines: PurchaseLineItem[];
  notes?: string;
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
   * Fetch all purchase orders from SSOT
   */
  getAllPOs(): Promise<PurchaseOrderRecord[]>;
}
