/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.0.0
 * * Created    : 2026-07-11
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { IProductRepository, ICustomerRepository, IShiftRepository, ISalesInvoiceRepository, IAuditRepository } from "../interfaces/db.js";
import { SalesInvoice, SalesInvoiceItem } from "../domain/entities.js";

export interface CheckoutItem {
  product: { id: string };
  quantity: number;
  discounts?: {
    percentage?: number;
    flat?: number;
    promo?: number;
    scheme?: number;
    salesperson?: number;
  };
}

export interface CheckoutPayload {
  shiftId: string;
  items: CheckoutItem[];
  total: number;
  customerName?: string;
  customerId?: string;
  appliedPromoOffer?: string;
  billDiscountVal?: number;
  billDiscountType?: "flat" | "percentage";
  appliedCoupon?: { minPurchase?: number; type?: "percent" | "flat"; value?: number };
  loyaltyRedeemPoints?: number;
  giftCardRedemption?: number;
  paymentMode?: string;
  payment?: { mode: string; amount?: number; breakup?: Record<string, number> };
  user?: string;
}

export interface CheckoutResult {
  bill: {
    id: string;
    timestamp: string;
    items: { product: any; quantity: number }[];
    total: number;
    customerName: string;
    paymentMode: string;
    invoiceId: string;
  };
  shift: any;
}

export class BillingService {
  private products: IProductRepository;
  private customers: ICustomerRepository;
  private shifts: IShiftRepository;
  private invoices: ISalesInvoiceRepository;
  private audits: IAuditRepository;

  constructor(
    products: IProductRepository,
    customers: ICustomerRepository,
    shifts: IShiftRepository,
    invoices: ISalesInvoiceRepository,
    audits: IAuditRepository
  ) {
    this.products = products;
    this.customers = customers;
    this.shifts = shifts;
    this.invoices = invoices;
    this.audits = audits;
  }

  async checkout(payload: CheckoutPayload): Promise<CheckoutResult> {
    const { shiftId, items, total, customerName, customerId, user } = payload;

    // 1. Fetch active shift
    const activeShift = await this.shifts.getById(shiftId);
    if (!activeShift || activeShift.status !== "Open") {
      throw new Error("No active open shift found to bind this transaction");
    }

    // 2. Validate products and verify stock levels
    let grossAmount = 0;
    let itemDiscountsTotal = 0;
    const itemsLog: string[] = [];
    const dbProductsMap: Record<string, any> = {};

    for (const item of items) {
      const dbProd = await this.products.getById(item.product.id);
      if (!dbProd) {
        throw new Error(`Product with ID ${item.product.id} not found in database.`);
      }
      dbProductsMap[item.product.id] = dbProd;

      const unitPrice = dbProd.price;
      const qty = item.quantity || 1;
      grossAmount += unitPrice * qty;

      if (item.discounts) {
        const percentageDisc = (unitPrice * ((item.discounts.percentage || 0) / 100)) * qty;
        const flatDisc = (item.discounts.flat || 0) * qty;
        const promoDisc = (item.discounts.promo || 0) * qty;
        const schemeDisc = (item.discounts.scheme || 0) * qty;
        const salespersonDisc = (item.discounts.salesperson || 0) * qty;

        itemDiscountsTotal += (percentageDisc + flatDisc + promoDisc + schemeDisc + salespersonDisc);
      }

      // Verify stock levels
      if (dbProd.trackingMode !== "No-stock") {
        if (dbProd.stock < qty) {
          throw new Error(`Insufficient stock for SKU ${dbProd.code} (${dbProd.name}). Required: ${qty}, Available: ${dbProd.stock}.`);
        }
      }
    }

    const subTotalAfterItemDiscounts = grossAmount - itemDiscountsTotal;

    // 3. Apply Promo Offer adjustments
    let promoValue = 0;
    const promoOffer = payload.appliedPromoOffer || null;
    if (promoOffer === "Happy Hour") {
      promoValue = Math.min(150, subTotalAfterItemDiscounts);
    } else if (promoOffer === "Festival Offer") {
      promoValue = subTotalAfterItemDiscounts * 0.05;
    }

    // 4. Bill Discount Overall
    let billDiscVal = 0;
    const billDiscountValAttr = payload.billDiscountVal || 0;
    const billDiscountTypeAttr = payload.billDiscountType || "flat";
    if (billDiscountTypeAttr === "percentage") {
      billDiscVal = (subTotalAfterItemDiscounts - promoValue) * (billDiscountValAttr / 100);
    } else {
      billDiscVal = Math.min(billDiscountValAttr, subTotalAfterItemDiscounts - promoValue);
    }

    // 5. Coupon Discount
    let couponDiscountValue = 0;
    const appliedCoupon = payload.appliedCoupon || null;
    if (appliedCoupon) {
      if (subTotalAfterItemDiscounts >= (appliedCoupon.minPurchase || 0)) {
        if (appliedCoupon.type === "percent") {
          couponDiscountValue = (subTotalAfterItemDiscounts - promoValue - billDiscVal) * ((appliedCoupon.value || 0) / 100);
        } else {
          couponDiscountValue = Math.min(appliedCoupon.value || 0, subTotalAfterItemDiscounts - promoValue - billDiscVal);
        }
      }
    }

    // 6. Loyalty Points discount
    const loyaltyRedeemPoints = payload.loyaltyRedeemPoints || 0;
    const loyaltyValue = Math.min(
      loyaltyRedeemPoints,
      subTotalAfterItemDiscounts - promoValue - billDiscVal - couponDiscountValue
    );

    const totalBillDiscounts = promoValue + billDiscVal + couponDiscountValue + loyaltyValue;
    const netAmountCalculated = Math.max(0, subTotalAfterItemDiscounts - totalBillDiscounts);

    // 7. Gift Card Redemption
    const giftCardRedemption = payload.giftCardRedemption || 0;
    const roundedGrandTotal = Math.round(netAmountCalculated);
    const finalGiftCardValue = Math.min(giftCardRedemption, roundedGrandTotal);
    
    const serverCalculatedTotal = Math.max(0, roundedGrandTotal - finalGiftCardValue);

    // Validate client-claimed total
    if (Math.abs(serverCalculatedTotal - total) > 1) {
      throw new Error(`Financial Integrity Violation: Total checkout amount mismatch. Server recomputed: ₹${serverCalculatedTotal}, Client claimed: ₹${total}.`);
    }
    const verifiedTotal = serverCalculatedTotal;

    // 8. Deduct stock levels in repositories
    for (const item of items) {
      const dbProd = dbProductsMap[item.product.id];
      const qty = item.quantity || 1;
      const deduction = dbProd.trackingMode === "No-stock" ? 0 : qty;
      
      if (dbProd.trackingMode !== "No-stock") {
        await this.products.update(dbProd.id, {
          stock: dbProd.stock - deduction
        });
      }
      itemsLog.push(`${dbProd.name} x${qty} (Stock: ${dbProd.stock} → ${dbProd.stock - deduction})`);
    }

    const billId = `BILL-${Date.now().toString().slice(-6)}`;
    const invoiceId = `si-${Date.now()}`;
    const paymentMode = payload.paymentMode || "Cash";

    // 9. Save Sales Invoice record
    const invoiceItems: SalesInvoiceItem[] = items.map(item => {
      const dbProd = dbProductsMap[item.product.id];
      const qty = item.quantity || 1;
      const price = dbProd.price;
      return {
        productId: dbProd.id,
        code: dbProd.code,
        name: dbProd.name,
        quantity: qty,
        price,
        gstRate: dbProd.gstPercentage || 18,
        taxAmount: 0,
        totalAmount: qty * price
      };
    });

    await this.invoices.create({
      id: invoiceId,
      invoiceNo: billId, // Use receipt number
      date: new Date().toISOString(),
      customerId: customerId || "CUST-001",
      taxTotal: 0,
      grandTotal: verifiedTotal,
      status: "Submitted",
      items: invoiceItems
    });

    // 10. Update shift metrics
    const updatedShift = await this.shifts.updateStats(shiftId, 1, verifiedTotal);

    // 11. Handle customer outstanding balance updates
    const paymentObj = payload.payment || { mode: paymentMode, amount: verifiedTotal };
    const tenders: Record<string, number> = {};

    if (paymentObj.mode === "Split" && paymentObj.breakup) {
      Object.assign(tenders, paymentObj.breakup);
    } else {
      tenders[paymentObj.mode || "Cash"] = paymentObj.amount !== undefined ? paymentObj.amount : verifiedTotal;
    }

    let creditAmount = 0;
    Object.entries(tenders).forEach(([method, amt]) => {
      if (method === "Credit" || method === "Udhaar") {
        creditAmount += amt;
      }
    });

    if (creditAmount > 0 && customerId) {
      await this.customers.updateOutstanding(customerId, creditAmount);
    }

    // 12. Record Audit Logs
    await this.audits.log({
      operator: user || activeShift.cashier,
      actionType: "INSERT",
      tableName: "sales_invoices",
      recordId: invoiceId,
      oldValue: JSON.stringify(`Total Sales: ${activeShift.salesValue} INR`),
      newValue: JSON.stringify(`Total Sales: ${activeShift.salesValue + verifiedTotal} INR`),
      reason: `POS transaction successful. Bill ID: ${billId}. Items: ${itemsLog.join(", ")}`
    });

    return {
      bill: {
        id: billId,
        timestamp: new Date().toISOString(),
        items: items.map(item => ({
          product: dbProductsMap[item.product.id],
          quantity: item.quantity
        })),
        total: verifiedTotal,
        customerName: customerName || "Walk-In Customer",
        paymentMode,
        invoiceId
      },
      shift: updatedShift
    };
  }
}
