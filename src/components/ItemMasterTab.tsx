/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.4.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Inventory & Item Master Workspace (Stitch Design Engine)
 */

import React from "react";
import { Product } from "../types.ts";
import { SmritiItemMasterWorkspace } from "./itemMaster/SmritiItemMasterWorkspace.tsx";

export interface ItemMasterTabProps {
  products?: Product[];
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info") => void;
  currentUser?: { role: string; name: string } | null;
  initialSubTab?: string;
  onClose?: () => void;
}

export const ItemMasterTab: React.FC<ItemMasterTabProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser,
  onClose
}) => {
  return (
    <SmritiItemMasterWorkspace
      products={products}
      onRefreshProducts={onRefreshProducts}
      onNotification={onNotification}
      currentUser={currentUser}
      onClose={onClose}
    />
  );
};

export default ItemMasterTab;
