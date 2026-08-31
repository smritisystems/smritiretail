/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Tag & Barcode Label Printing Studio (SMRITI 9 Professional Terminal)
 */

import React, { useState } from "react";
import { TagLabelPrintingTab } from "./barcode/TagLabelPrintingTa.tsx";
import { VisualLabelDesigner } from "./barcode/VisualLabelDesign.tsx";
import { BarcodeScriptGenerationView } from "./barcode/BarcodeScriptGenVi.tsx";
import { Product } from "../types.ts";
import { Printer, Sliders, Code } from "lucide-react";

interface BarcodeStudioTabProps {
  currentUser?: { role: string; name: string } | null;
  products?: Product[];
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info") => void;
  onClose?: () => void;
}

export const BarcodeStudioTab: React.FC<BarcodeStudioTabProps> = ({
  currentUser,
  products = [],
  onNotification,
  onClose
}) => {
  const [subTab, setSubTab] = useState<"batch-print" | "visual-designer" | "script-compiler">("visual-designer");

  return (
    <div className="h-full flex flex-col bg-theme-base text-theme-body select-none overflow-hidden">
      {/* Studio Sub-Navigation Bar */}
      <div className="h-11 bg-theme-surface-1 border-b border-theme-divider px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSubTab("visual-designer")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              subTab === "visual-designer"
                ? "bg-primary-500 text-white shadow-sm font-bold"
                : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-2"
            }`}
          >
            <Sliders size={14} />
            <span>Visual Label Designer</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("batch-print")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              subTab === "batch-print"
                ? "bg-primary-500 text-white shadow-sm font-bold"
                : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-2"
            }`}
          >
            <Printer size={14} />
            <span>Batch Tag & Barcode Printing</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("script-compiler")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              subTab === "script-compiler"
                ? "bg-primary-500 text-white shadow-sm font-bold"
                : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-2"
            }`}
          >
            <Code size={14} />
            <span>PRN / ZPL Script Compiler</span>
          </button>
        </div>

        <div className="text-[10px] font-mono text-theme-muted">
          SMRITI Barcode & Thermal Label Studio v6.9
        </div>
      </div>

      {/* Main SubTab Content Area */}
      <div className="flex-1 overflow-hidden">
        {subTab === "visual-designer" && (
          <VisualLabelDesigner
            onBackToPrinting={() => setSubTab("batch-print")}
            onNotification={onNotification}
          />
        )}

        {subTab === "batch-print" && (
          <TagLabelPrintingTab
            currentUser={currentUser}
            products={products}
            onNotification={onNotification}
            onClose={onClose}
          />
        )}

        {subTab === "script-compiler" && (
          <BarcodeScriptGenerationView
            onBackToPrinting={() => setSubTab("batch-print")}
            onNotification={onNotification}
          />
        )}
      </div>
    </div>
  );
};

export default BarcodeStudioTab;
