/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Purchase Order / Indent Generation (SMRITI 9 Professional Terminal)
 */

import React from "react";
import { PoGenerateTab } from "./purchase/PoGenerateTab.tsx";
import { Product } from "../types.ts";

interface PurchaseStudioTabProps {
  products?: Product[];
  onRefreshProducts?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
  onClose?: () => void;
}

export const PurchaseStudioTab: React.FC<PurchaseStudioTabProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser,
  onClose
}) => {
  return (
    <PoGenerateTab
      products={products}
      currentUser={currentUser}
      onNotification={onNotification}
      onClose={onClose}
    />
  );
};

export default PurchaseStudioTab;
