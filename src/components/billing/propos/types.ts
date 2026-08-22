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
  taxableValue?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  isTaxInclusive?: boolean;
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
  state?: string;
  stateCode?: string;
  registrationType?: "REGISTERED" | "UNREGISTERED";
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
  date?: string;
  originalDate?: string;
  customerName: string;
  amount: number;
  reasonCode: string;
  reasonText?: string;
  reasonNotes?: string;
  authorizedBy: string;
  cancelledAt?: string;
}

export interface ReturnItem {
  cartItem?: ProPosCartItem;
  sku?: string;
  name?: string;
  originalQty?: number;
  unitPrice?: number;
  returnQty: number;
  reasonCode?: string;
  returnReason?: string;
  condition: "Good" | "Defective" | "Damaged";
  refundAmount: number;
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
  status: "Balanced" | "Variance_Detected";
  remarks?: string;
}

export interface PromotionRule {
  id: string;
  name: string;
  code: string;
  type: "BUY_X_GET_Y" | "FLAT_DISCOUNT" | "HAPPY_HOURS" | "PERCENT_DISCOUNT";
  description: string;
  startDate: string;
  endDate: string;
  minQuantity?: number;
  minBillAmount?: number;
  discountValue: number;
  applicableCategories?: string[];
  isActive: boolean;
  usageCount: number;
}
