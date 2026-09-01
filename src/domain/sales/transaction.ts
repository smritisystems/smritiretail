export type SalesDocType = "sales_order" | "billing";

export interface SalesLineItem {
  id: string;
  productId?: string;
  stockNo?: string;
  barcode?: string;
  itemDescription: string;
  qty: number;
  rate: number;
  value: number;
  discPercent?: number;
  discAmt?: number;
  taxPercent?: number;
  taxAmount?: number;
  total: number;
}

import { AttachmentReference } from "../attachment.ts";

export interface SalesTransaction {
  id?: string;
  docType: SalesDocType;
  docPrefix: string;
  docNumber: string;
  docDate: string;
  docTime: string;
  customerId?: string;
  customerCode?: string;
  customerName?: string;
  referenceNo?: string;
  deliveryTerms?: string;
  paymentTerms?: string;
  orderStatus?: string;
  remarks?: string;
  items: SalesLineItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  netAmount: number;
  /** Lightweight references to attached files (PDFs, contracts, POs, approvals, etc.) */
  attachments?: AttachmentReference[];
}
