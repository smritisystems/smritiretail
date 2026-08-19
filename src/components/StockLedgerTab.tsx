/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { LedgerScreen } from "./global/ledger/LedgerScreen.tsx";
import { stockLedgerConfig } from "./global/ledger/configs/stockLedger.config.tsx";

interface StockLedgerTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const StockLedgerTab: React.FC<StockLedgerTabProps> = () => {
  return <LedgerScreen config={stockLedgerConfig} />;
};
