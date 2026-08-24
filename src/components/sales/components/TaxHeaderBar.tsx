/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.10.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { 
  Receipt, 
  PlusSquare, 
  XCircle, 
  RotateCcw, 
  Printer, 
  Bell, 
  Settings, 
  HelpCircle,
  LogOut,
  Save,
  Loader2
} from "lucide-react";
import { ExportButton } from "../../export/ExportButton.tsx";
import { ExportColumnDefinition } from "../../export/types.ts";

export interface TaxInvoiceHeaderToolbarProps {
  onNew: () => void;
  onSave: () => void;
  onDelete: () => void;
  onPrint: () => void;
  onFind: () => void;
  onExit: () => void;
  isSaving?: boolean;
  canDelete?: boolean;
  exportColumns: ExportColumnDefinition[];
  exportData: any[];
  currentUser?: { role: string; name: string } | null;
}

export const TaxInvoiceHeaderToolbar: React.FC<TaxInvoiceHeaderToolbarProps> = ({
  onNew,
  onSave,
  onDelete,
  onPrint,
  onFind,
  onExit,
  isSaving = false,
  canDelete = false,
  exportColumns,
  exportData,
  currentUser,
}) => {
  const [currentDateTime, setCurrentDateTime] = useState({
    date: new Date().toLocaleDateString("en-GB"),
    time: new Date().toLocaleTimeString("en-US", { hour12: true }),
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentDateTime({
        date: now.toLocaleDateString("en-GB"),
        time: now.toLocaleTimeString("en-US", { hour12: true }),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-surface dark:bg-primary-container text-primary dark:text-primary-fixed w-full top-0 sticky z-50 border-b border-outline-variant dark:border-outline">
      <div className="flex justify-between items-center px-margin-page h-16 w-full max-w-container-max-width mx-auto">
        <div className="flex items-center gap-stack-gap">
          <Receipt className="w-8 h-8 text-primary dark:text-primary-fixed" />
          <span className="font-headline-lg text-headline-lg font-bold text-primary dark:text-primary-fixed">
            Smriti Distributor
          </span>
        </div>

        <div className="flex items-center gap-gutter">
          {/* Realtime Date & Time badges */}
          <div className="flex items-center gap-stack-gap text-on-surface-variant">
            <span className="font-code-md text-code-md bg-surface-container-high px-2 py-1 rounded">
              {currentDateTime.date}
            </span>
            <span className="font-code-md text-code-md bg-surface-container-high px-2 py-1 rounded">
              {currentDateTime.time}
            </span>
          </div>

          {/* Quick Action Icons matching code.html */}
          <div className="flex items-center gap-unit">
            <button
              type="button"
              onClick={onNew}
              className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
              title="New (Ctrl+N)"
            >
              <PlusSquare className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="p-2 text-primary dark:text-primary-fixed hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer disabled:opacity-50"
              title="Save & Commit (Ctrl+S)"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
              title="Void (Ctrl+V)"
            >
              <XCircle className="w-5 h-5 text-error" />
            </button>
            <button
              type="button"
              onClick={onFind}
              className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
              title="Return (Ctrl+R)"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
              title="Reprint (Ctrl+P)"
            >
              <Printer className="w-5 h-5" />
            </button>
          </div>

          <div className="h-8 w-px bg-outline-variant"></div>

          {/* Utility & Navigation Icons */}
          <div className="flex items-center gap-2">
            <ExportButton
              columns={exportColumns}
              data={exportData}
              filename="Smriti_Distributor_Tax_Invoice"
              moduleTitle="Smriti Distributor Tax Invoice"
              buttonLabel="Export"
            />
            <button
              type="button"
              className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
              title="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onExit}
              className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors rounded active:opacity-80 cursor-pointer"
              title="Exit Workspace (ESC)"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* User profile avatar badge */}
          <div
            className="w-8 h-8 rounded-full border border-outline-variant bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs"
            title={currentUser?.name || "Jawahar Mallah"}
          >
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "J"}
          </div>
        </div>
      </div>
    </header>
  );
};
