/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Goods Receipt (GRN) Studio Workspace (SMRITI 9 Professional Terminal)
 */

import React from "react";
import { GrnReceiptTab } from "./purchase/GrnReceiptTab.tsx";

export interface GrnStudioTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  onClose?: () => void;
  onNavigateTab?: (tab: string) => void;
  initialOrderId?: string;
}

export const GrnStudioTab: React.FC<GrnStudioTabProps> = ({
  currentUser,
  onNotification,
  onClose,
  onNavigateTab,
  initialOrderId,
}) => {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-[#f4f3fa]">
      <GrnReceiptTab
        currentUser={currentUser}
        onNotification={onNotification}
        onClose={onClose}
        initialOrderId={initialOrderId}
      />
    </div>
  );
};

export default GrnStudioTab;
