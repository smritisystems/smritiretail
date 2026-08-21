/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { Product, POSProfile, Shift, Bill } from "../types.ts";
import { SmritiBillingTerminal } from "./billing/SmritiBillingTerminal.tsx";

export interface AdvancedCustomer {
  type: "Registered" | "Unregistered";
  name: string;
  mobile: string;
  email: string;
  gstin: string;
  companyName: string;
  membershipId: string;
  billingAddress: string;
  shippingAddress: string;
  isShippingDifferent: boolean;
}

export interface ItemDiscountState {
  percentage: number;
  flat: number;
  promo: number;
  scheme: number;
  salesperson: number;
}

export interface ItemBillingDetails {
  product: Product;
  quantity: number;
  hsnCode: string;
  isTaxInclusive: boolean;
  gstRate: number;
  discounts: ItemDiscountState;
  salespersonId: string;
}

interface AdvancedBillingEngineProps {
  cart?: { product: Product; quantity: number }[];
  onClearCart?: () => void;
  activeShift?: Shift | null;
  activeProfile?: POSProfile | null;
  onCheckoutSuccess?: (bill: Bill) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error") => void;
  isStandaloneTab?: boolean;
}

export const AdvancedBillingEngine: React.FC<AdvancedBillingEngineProps> = ({
  activeShift,
  activeProfile,
  onNotification,
  isStandaloneTab = true
}) => {
  return (
    <SmritiBillingTerminal
      products={[]}
      profiles={activeProfile ? [activeProfile] : []}
      shifts={activeShift ? [activeShift] : []}
      onNotification={onNotification}
      isStandaloneTab={isStandaloneTab}
    />
  );
};
