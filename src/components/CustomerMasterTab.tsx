/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.5.0
 * Created      : 2026-07-13
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Retail Customer Catalogue (3-Tab Catalogue & Search Workspace)
 */

import React from "react";
import { CustMasterWs } from "./customer/CustMasterWs.tsx";

export interface CustomerMasterTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const CustomerMasterTab: React.FC<CustomerMasterTabProps> = ({ currentUser, onNotification }) => {
  return (
    <CustMasterWs
      currentUser={currentUser}
      onNotification={onNotification}
    />
  );
};

