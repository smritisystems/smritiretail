/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Supplier & Vendor Directory (Global Master Screen Refactor)
 */

import React from "react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { supplierMasterConfig } from "./global/configs/supplierMaster.con.tsx";

export interface SupplierDashboardTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

export const SupplierDashboardTab: React.FC<SupplierDashboardTabProps> = ({ currentUser, onNotification }) => {
  return (
    <MasterListScreen
      config={supplierMasterConfig}
      currentUser={currentUser}
      onNotification={onNotification}
    />
  );
};
