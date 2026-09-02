/**
 * Project      : SMRITI Retail OS
 * Module       : Sales Order Form (Deprecated Compatibility Facade)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-08-31
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * 
 * @deprecated This standard form has been consolidated into SalesOrderFormPremium.
 *             All active sales order workflows render SalesOrderFormPremium.
 *             This facade remains for backward-compatible imports and types.
 */

import React from "react";
import { 
  SalesOrderFormPremium, 
  SalesOrderFormData as PremiumSalesOrderFormData,
  SalesOrderItem as PremiumSalesOrderItem 
} from "./SalesOrderFormPremium";

export type SalesOrderItem = PremiumSalesOrderItem;
export type SalesOrderFormData = PremiumSalesOrderFormData;

export interface SalesOrderFormProps {
  initialData?: Partial<SalesOrderFormData>;
  onSubmit?: (data: SalesOrderFormData) => Promise<void>;
  onCancel?: () => void;
  onRefreshData?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

/**
 * @deprecated Use SalesOrderFormPremium directly.
 */
export const SalesOrderForm: React.FC<SalesOrderFormProps> = (props) => {
  return <SalesOrderFormPremium {...props} />;
};

export default SalesOrderForm;
