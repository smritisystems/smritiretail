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

export const salesDocumentConfig: DocumentStudioConfig = {
  documentType: "SALES_INVOICE",
  title: "Sales Studio Document",
  subtitle: "Create retail tax invoices, sales orders, and B2C billing documents",
  partyType: "Customer",
  apiEndpoint: "/api/v1/sales/invoices",
  primaryActionLabel: "Post Sales Invoice",
  draftActionLabel: "Save Quotation Draft",
  showGstBreakdown: true,
  enableBatchTracking: true,
  enableSalesperson: true,
};
