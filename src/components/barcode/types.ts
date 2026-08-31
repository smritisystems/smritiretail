/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.8.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { Product } from "../../types.ts";

export type PortType = "USB" | "COM 1" | "COM 2" | "COM 3" | "COM 4" | "LPT 1" | "Network TCP/IP" | "QZ Tray Thermal" | "PRN File Download";


export type LabelSourceOption =
  | "Manual Selection"
  | "Against Masters"
  | "Against Direct Scan"
  | "Against Purchase (PT File)"
  | "Against Transactions"
  | "Against Purchase Order"
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
  category?: string;
  mrp: number;
  sellingPrice: number;
  currentStock: number;
  labelCount: number; // # Lbls
  originalProduct?: Product;
}

export interface DerivedLabelRow {
  row: LabelPrintRow;
  sourceIndex: number;
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

export interface ItemMasterSelectionCriteria {
  stockNoFrom: string;
  stockNoTo: string;
  barcode: string;
  productNames: string[];
  brands: string[];
  categories: string[];
  styleCodes: string[];
  colours: string[];
  sizes: string[];
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
  targetPrinterName?: string;
  ipAddress?: string;
  portNumber?: number;
  resolutionDpi?: number;
}

export interface ScriptFieldIdentification {
  field: "Stock Number" | "Retail Price" | "Lot Code" | "Barcode" | "Product Name" | "Brand" | "Style" | "Size" | "Shade" | "Custom Text";
  direction: "From Left" | "From Right";
  startPosition: number;
  numDigits: number;
  textValue1: string;
  textValue2: string;
}

export interface PrinterTargetConfig {
  name: string;
  connectionType: "USB" | "SERIAL" | "NETWORK" | "QZ_TRAY" | "SYSTEM_DEFAULT";
  address?: string;
  isOnline: boolean;
  resolutionDpi: 203 | 300 | 600;
}

export interface PrintSafetyValidation {
  canPrint: boolean;
  hasLoadedItems: boolean;
  hasSelectedItems: boolean;
  hasPositiveQuantity: boolean;
  hasValidTemplate: boolean;
  hasValidPrinter: boolean;
  missingReasons: string[];
}
