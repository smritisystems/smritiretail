/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-07-13
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Customer Master Data (Global Master Screen Refactor)
 */

import React from "react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { customerMasterConfig } from "./global/configs/customerMaster.config.tsx";
import { Customer } from "../types.ts";

export interface CustomerMasterTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

export const CustomerMasterTab: React.FC<CustomerMasterTabProps> = ({ currentUser, onNotification }) => {
  return (
    <MasterListScreen<Customer>
      config={customerMasterConfig}
      currentUser={currentUser}
      onNotification={onNotification}
    />
  );
};
