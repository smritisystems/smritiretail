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
 * Target UI    : Staff Management & User Access (Global Master Screen Refactor)
 */

import React from "react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { staffMasterConfig } from "./global/configs/staffMaster.config.tsx";
import { User } from "../types.ts";

export interface StaffManagementTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

export const StaffManagementTab: React.FC<StaffManagementTabProps> = ({ currentUser, onNotification }) => {
  return (
    <MasterListScreen<User>
      config={staffMasterConfig}
      currentUser={currentUser}
      onNotification={onNotification}
    />
  );
};
