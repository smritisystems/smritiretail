/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { Product, POSProfile, Shift } from "../types.ts";
import { SmritiBillingTerminal } from "./billing/SmritiBillingTerminal.tsx";

interface PosTerminalTabProps {
  products: Product[];
  profiles: POSProfile[];
  shifts: Shift[];
  onRefreshData: () => void;
  onNotification: (title: string, msg: string, type: "success" | "error") => void;
}

export const PosTerminalTab: React.FC<PosTerminalTabProps> = ({
  products,
  profiles,
  shifts,
  onRefreshData,
  onNotification
}) => {
  return (
    <SmritiBillingTerminal
      products={products}
      profiles={profiles}
      shifts={shifts}
      onRefreshData={onRefreshData}
      onNotification={onNotification}
      isStandaloneTab={false}
    />
  );
};
