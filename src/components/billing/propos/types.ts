/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export interface ProPosCartItem {
  id: string;
  itemNo: number;
  sku: string;
  barcode: string;
  name: string;
  size: string;
  color: string;
  brand: string;
  salesStaff: string;
  qty: number;
  mrp: number;
  unitPrice: number;
  discCode?: string;
  discQty?: number;
  discountPct: number;
  discountAmt: number;
  taxPct: number;
  taxAmt: number;
  hsnCode?: string;
  lineTotal: number;
}

export interface ProPosCustomer {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyTier?: "Silver" | "Gold" | "Platinum" | "Diamond";
  loyaltyPoints?: number;
  creditLimit?: number;
  currentBalance?: number;
  address?: string;
  gstin?: string;
}

export interface ProPosTenderSplit {
  cash: number;
  card: number;
  cardLast4?: string;
  cardAuthCode?: string;
  upi: number;
  upiRef?: string;
  creditNote: number;
  creditNoteNo?: string;
  giftVoucher: number;
  voucherCode?: string;
  loyaltyPointsRedeemed: number;
  loyaltyAmount: number;
}

export interface SuspendedBill {
  id: string;
  billNo: string;
  timestamp: string;
  customer: ProPosCustomer;
  salesStaff: string;
  items: ProPosCartItem[];
  itemCount: number;
  totalQty: number;
  netAmount: number;
}

export interface CancelledBillRecord {
  id: string;
  billNo: string;
  date: string;
  customerName: string;
  amount: number;
  reasonCode: string;
  reasonText: string;
  authorizedBy: string;
}

export interface ReturnItem {
  cartItem: ProPosCartItem;
  returnQty: number;
  reasonCode: string;
  condition: "Good" | "Defective" | "Damaged";
  refundAmount: number;
}
