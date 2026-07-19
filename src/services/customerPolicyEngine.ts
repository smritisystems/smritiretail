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
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import {
  Customer,
  CustomerGroup,
  ResolvedCustomerPolicy,
  CreditCheckResult,
} from "../types";

/**
 * Merges a Customer's overrides on top of its CustomerGroup's defaults.
 * Any field left `undefined` on the Customer falls back to the group's value.
 * This is the single function that should be called anywhere billing,
 * checkout, or pricing needs to know "what applies to this customer right now" —
 * nothing downstream should read Customer or CustomerGroup fields directly.
 */
export function resolveCustomerPolicy(
  customer: Customer,
  group: CustomerGroup
): ResolvedCustomerPolicy {
  return {
    creditLimit: customer.creditLimit ?? group.creditLimit,
    unlimitedCredit: customer.unlimitedCredit ?? group.unlimitedCredit,
    creditDays: customer.creditDays ?? group.creditDays,
    graceDays: customer.graceDays ?? group.graceDays,
    creditHold: customer.creditHold ?? group.creditHold,
    autoBlockSales: group.autoBlockSales, // not customer-overridable by design
    warningThresholdPercent: group.warningThresholdPercent,
    taxInclusive: customer.taxInclusive ?? group.taxInclusive,
    gstPercentageOverride: customer.gstPercentageOverride ?? group.gstPercentageOverride,
    taxCategory: customer.taxCategory ?? group.taxCategory,
    priceListId: customer.priceListId ?? group.defaultPriceListId,
    maxDiscountPercent: group.maxDiscountPercent,
    minMarginPercent: group.minMarginPercent,
    roundingRule: group.roundingRule,
    preferredPaymentMethod: customer.preferredPaymentMethod ?? group.preferredPaymentMethod,
    allowBackOrders: group.allowBackOrders,
    allowNegativeStockSales: group.allowNegativeStockSales,
    requireApprovalAboveAmount: group.requireApprovalAboveAmount,
    requirePoNumber: group.requirePoNumber,
    invoiceLanguage: group.invoiceLanguage,
    canViewPrice: group.canViewPrice,
    canViewMargin: group.canViewMargin,
    canPurchaseOnCredit: group.canPurchaseOnCredit,
    canReceiveDiscount: group.canReceiveDiscount,
  };
}

/**
 * The one feature worth building for real right now: Credit Hold / Auto Block
 * Sales. Call this before confirming any credit sale in the billing flow.
 *
 * Deliberately NOT included: any "AI credit risk score" or default-probability
 * prediction. That needs real historical transaction data across many
 * customers to mean anything — with no persistence layer yet and one live
 * customer, there's nothing honest to compute it from. Add it later, once
 * there's real data; don't fake it now.
 */
export function checkCreditStatus(
  customer: Customer,
  group: CustomerGroup,
  newSaleAmount: number
): CreditCheckResult {
  const policy = resolveCustomerPolicy(customer, group);
  const wouldBeOutstanding = customer.outstanding + newSaleAmount;

  if (policy.creditHold) {
    return {
      allowed: false,
      reason: `${customer.name} is on Credit Hold. This sale requires manual approval.`,
      effectiveCreditLimit: policy.creditLimit,
      currentOutstanding: customer.outstanding,
      wouldBeOutstanding,
      usagePercentAfter: policy.unlimitedCredit
        ? 0
        : (wouldBeOutstanding / policy.creditLimit) * 100,
      warningTriggered: true,
    };
  }

  if (policy.unlimitedCredit) {
    return {
      allowed: true,
      effectiveCreditLimit: Infinity,
      currentOutstanding: customer.outstanding,
      wouldBeOutstanding,
      usagePercentAfter: 0,
      warningTriggered: false,
    };
  }

  const usagePercentAfter = (wouldBeOutstanding / policy.creditLimit) * 100;
  const overLimit = wouldBeOutstanding > policy.creditLimit;

  if (overLimit && policy.autoBlockSales) {
    return {
      allowed: false,
      reason: `This ₹${newSaleAmount.toLocaleString("en-IN")} sale would take ${customer.name} to ₹${wouldBeOutstanding.toLocaleString(
        "en-IN"
      )}, over their ₹${policy.creditLimit.toLocaleString("en-IN")} limit.`,
      effectiveCreditLimit: policy.creditLimit,
      currentOutstanding: customer.outstanding,
      wouldBeOutstanding,
      usagePercentAfter,
      warningTriggered: true,
    };
  }

  return {
    allowed: true,
    reason: overLimit
      ? "Over limit, but Auto Block Sales is off for this group — allowed with a warning."
      : undefined,
    effectiveCreditLimit: policy.creditLimit,
    currentOutstanding: customer.outstanding,
    wouldBeOutstanding,
    usagePercentAfter,
    warningTriggered: usagePercentAfter >= policy.warningThresholdPercent,
  };
}
