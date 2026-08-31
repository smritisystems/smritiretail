/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { Product, POSProfile, Shift } from "../types.ts";
import { ProPosWs } from "./billing/propos/ProPosWs.tsx";

interface PosTerminalTabProps {
  products?: Product[];
  profiles?: POSProfile[];
  shifts?: Shift[];
  onRefreshData?: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error") => void;
  initialTab?: "BILLING" | "INVOICING" | "EOD_Z_REPORT" | "DAILY_REPORTS" | "PROMOTIONS" | "COMMISSIONS";
}

export const PosTerminalTab: React.FC<PosTerminalTabProps> = ({
  products = [],
  profiles = [],
  shifts = [],
  onRefreshData,
  onNotification,
  initialTab,
}) => {
  return (
    <ProPosWs
      products={products}
      profiles={profiles}
      shifts={shifts}
      onRefreshData={onRefreshData}
      onNotification={onNotification}
      initialTab={initialTab}
    />
  );
};

export default PosTerminalTab;
