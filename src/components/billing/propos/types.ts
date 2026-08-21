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
  notes?: string;
}

export interface CancelledBillRecord {
  id: string;
  billNo: string;
  originalDate: string;
  customerName: string;
  amount: number;
  reasonCode: string;
  reasonNotes: string;
  authorizedBy: string;
  cancelledAt: string;
}

export interface ReturnItem {
  sku: string;
  name: string;
  originalQty: number;
  returnQty: number;
  unitPrice: number;
  refundAmount: number;
  returnReason: string;
  condition: "Good" | "Defective" | "Damaged";
}

export interface EodRegisterCloseout {
  registerId: string;
  shiftId: string;
  openedAt: string;
  closedAt: string;
  cashierName: string;
  openingFloat: number;
  systemCash: number;
  actualCash: number;
  systemCard: number;
  actualCard: number;
  systemUpi: number;
  actualUpi: number;
  totalBills: number;
  totalItemsSold: number;
  grossSales: number;
  discountsTotal: number;
  netSales: number;
  returnsTotal: number;
  cashVariance: number;
  status: "Balanced" | "Variance_Detected" | "Audit_Required";
  remarks?: string;
}

export interface PromotionRule {
  id: string;
  name: string;
  code: string;
  type: "BUY_X_GET_Y" | "FLAT_DISCOUNT" | "PERCENT_DISCOUNT" | "BUNDLE_COMBO" | "HAPPY_HOURS";
  description: string;
  startDate: string;
  endDate: string;
  minBillAmount?: number;
  minQuantity?: number;
  discountValue: number;
  applicableCategories?: string[];
  isActive: boolean;
  usageCount: number;
}

export interface CommissionRule {
  id: string;
  salesStaffCode: string;
  staffName: string;
  category: string;
  tierMin: number;
  tierMax: number;
  commissionPct: number;
  effectiveFrom: string;
  isActive: boolean;
}
