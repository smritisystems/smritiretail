/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.31.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { Product } from "../../types.ts";

export type PortType = "COM 1" | "USB" | "Network TCP/IP";

export type LabelSourceOption =
  | "Manual Selection"
  | "Against Purchase (PT File)"
  | "Against Transactions"
  | "Against Purchase Order"
  | "Against Masters"
  | "Against Direct Scan"
  | "Against PDT File";

export type LabelQuantityMode = "Specified Quantity" | "Present Stock";

export interface LabelPrintRow {
  id: string;
  sNo: number;
  stockNo: string;
  barcode: string;
  brand: string;
  product: string;
  colour: string;
  style: string;
  size: string;
  mrp: number;
  sellingPrice: number;
  currentStock: number;
  labelCount: number; // # Lbls
  originalProduct?: Product;
}

export interface SelectionCriteriaRange {
  stockNoFrom: string;
  stockNoTo: string;
  brandFrom: string;
  brandTo: string;
  productFrom: string;
  productTo: string;
  colourFrom: string;
  colourTo: string;
  styleFrom: string;
  styleTo: string;
  sizeFrom: string;
  sizeTo: string;
}

export interface LabelPrintSettings {
  scriptFileName: string;
  labelsPerRow: number;
  outputToPort: boolean;
  outputToFile: boolean;
  portSetting: PortType;
  sourceOption: LabelSourceOption;
  piPdtFileName: string;
  quantityMode: LabelQuantityMode;
}
