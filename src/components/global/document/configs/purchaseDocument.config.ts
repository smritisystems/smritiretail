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

import { DocumentStudioConfig } from "../types.ts";

export const purchaseDocumentConfig: DocumentStudioConfig = {
  documentType: "PURCHASE_ORDER",
  title: "Purchase Order & Inward Studio",
  subtitle: "Vendor procurement orders, inward goods receipt notes (GRN), and batch receipt",
  partyType: "Supplier",
  apiEndpoint: "/api/v1/purchase/orders/",
  primaryActionLabel: "Post Purchase Order",
  draftActionLabel: "Save Purchase Draft",
  showGstBreakdown: true,
  enableBatchTracking: true,
  enableSalesperson: false,
};
