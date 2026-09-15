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
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Vendor 360 Workspace (Universal Party Master Operational Host)
 */

import React from "react";
import { VendorMasterWs } from "./vendor/VendorMasterWs.tsx";

export interface SupplierDashboardTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

/**
 * SupplierDashboardTab (Host Container)
 * Mounts the canonical Vendor 360 Workspace powered by the Universal Party Master.
 */
export const SupplierDashboardTab: React.FC<SupplierDashboardTabProps> = ({ currentUser, onNotification }) => {
  return (
    <VendorMasterWs
      currentUser={currentUser}
      onNotification={onNotification}
    />
  );
};

export default SupplierDashboardTab;
