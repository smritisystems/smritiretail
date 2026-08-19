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
 * Target UI    : POS Profiles Studio (Global Master Screen Refactor)
 */

import React from "react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { posProfilesConfig } from "./global/configs/posProfiles.config.tsx";
import { POSProfile } from "../types.ts";

export interface PosProfilesTabProps {
  profiles?: POSProfile[];
  onRefreshData?: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
}

export const PosProfilesTab: React.FC<PosProfilesTabProps> = ({
  onNotification,
  currentUser
}) => {
  return (
    <MasterListScreen<POSProfile>
      config={posProfilesConfig}
      currentUser={currentUser}
      onNotification={(t, m, type) => {
        if (onNotification) onNotification(t, m, type === "warning" || type === "info" ? "success" : type);
      }}
    />
  );
};
