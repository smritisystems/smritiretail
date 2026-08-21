/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.31.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Tag & Barcode Label Printing (SMRITI 9 Professional Terminal)
 */

import React from "react";
import { TagLabelPrintingTab } from "./barcode/TagLabelPrintingTab.tsx";
import { Product } from "../types.ts";

interface BarcodeStudioTabProps {
  currentUser?: { role: string; name: string } | null;
  products?: Product[];
  onNotification?: (title: string, message: string, type: "success" | "error") => void;
  onClose?: () => void;
}

export const BarcodeStudioTab: React.FC<BarcodeStudioTabProps> = ({
  currentUser,
  products = [],
  onNotification,
  onClose
}) => {
  return (
    <TagLabelPrintingTab
      currentUser={currentUser}
      products={products}
      onNotification={onNotification}
      onClose={onClose}
    />
  );
};

export default BarcodeStudioTab;
