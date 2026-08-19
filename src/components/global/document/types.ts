/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { Product } from "../../../types.ts";

export interface DocumentLineItem {
  id: string;
  productId?: string;
  code: string;
  name: string;
  barcode?: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  price: number; // Unit price
  mrp?: number;
  discountPercent?: number;
  discountAmount?: number;
  gstRate?: number;
  taxAmount?: number;
  lineTotal: number;
  attributes?: Record<string, any>;
  batchNumber?: string;
  expiryDate?: string;
}

export interface DocumentTotals {
  itemCount: number;
  totalQuantity: number;
  subTotal: number;
  totalDiscount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
}

export interface DocumentHeaderState {
  docType: string;
  docNumber: string;
  docDate: string;
  dueDate?: string;
  partyId?: string;
  partyName?: string;
  partyGstin?: string;
  partyMobile?: string;
  partyAddress?: string;
  warehouseId?: string;
  warehouseName?: string;
  referenceNumber?: string;
  remarks?: string;
  paymentTerms?: string;
  priceListId?: string;
}

export interface DocumentStudioConfig {
  documentType: "SALES_INVOICE" | "SALES_ORDER" | "QUOTATION" | "PURCHASE_ORDER" | "GOODS_RECEIPT" | "CREDIT_NOTE" | "DEBIT_NOTE" | "TAX_INVOICE";
  title: string;
  subtitle: string;
  partyType: "Customer" | "Supplier";
  defaultWarehouse?: string;
  apiEndpoint: string;
  primaryActionLabel?: string;
  draftActionLabel?: string;
  showGstBreakdown?: boolean;
  enableBatchTracking?: boolean;
  enableSalesperson?: boolean;
}

export interface BottomScanBarProps {
  onScanProduct: (query: string, qty?: number) => Promise<boolean>;
  disabled?: boolean;
  placeholder?: string;
  defaultQty?: number;
}
