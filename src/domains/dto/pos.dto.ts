/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : POS Domain Data Transfer Objects (DTOs)
 * Standard     : SMAP Constitution v1.0 & Wave 1 POS Standard
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface POSItemLineDTO {
  sku: string;
  itemName: string;
  qty: number;
  unitPrice: number;
}

export interface POSCheckoutRequestDTO {
  items: POSItemLineDTO[];
  cashierId: string;
  discountPercent?: number;
  paymentMethod: "cash" | "card" | "upi";
}

export interface POSCheckoutResponseDTO {
  saleId: string;
  invoiceNo: string;
  subTotalFormatted: string;
  taxFormatted: string;
  totalFormatted: string;
  receiptHtml: string;
  receiptPlainText?: string;
  status: "completed" | "failed";
  reason?: string;
}
