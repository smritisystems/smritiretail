/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";

export interface TerminalCapabilities {
  supportsBarcode: boolean;
  supportsPrinting: boolean;
  supportsPayments: boolean;
  supportsScale: boolean;
  supportsApproval: boolean;
  supportsHoldRecall: boolean;
  supportsLineSalesperson: boolean;
  supportsInterstateGst: boolean;
}

export type TerminalLifecycleState =
  | "LAUNCH"
  | "INITIALIZE"
  | "LOAD_CONFIG"
  | "LOAD_PERMISSIONS"
  | "LOAD_HARDWARE"
  | "READY"
  | "WORKING"
  | "HOLD"
  | "COMPLETE"
  | "CLEANUP"
  | "EXIT";

export interface TerminalPluginProps {
  currentUser: any;
  activeShift: any;
  activeProfile: any;
  onNotification: (title: string, msg: string, type: "success" | "error") => void;
  onClose: () => void;
}

export interface TerminalPlugin {
  id: string;
  name: string;
  code: string;
  category: "sales" | "purchase" | "inventory" | "finance";
  capabilities: TerminalCapabilities;
  icon: string;
  description: string;
  component: React.FC<TerminalPluginProps>;
}
