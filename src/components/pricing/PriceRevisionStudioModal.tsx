/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.2
 * Created      : 2026-10-13
 * Modified     : 2026-10-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Price Revision Studio Modal Facade (Phase 5)
 */

import React from "react";
import { X } from "lucide-react";
import { PriceRevisionStudioWorkspace, PriceRevisionRecord } from "./PriceRevisionStudioWorkspace";

export type { PriceRevisionRecord };

export interface PriceRevisionStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialVariantId?: string;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const PriceRevisionStudioModal: React.FC<PriceRevisionStudioModalProps> = ({
  isOpen,
  onClose,
  initialVariantId,
  onNotification,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in">
      <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl h-[92vh] shadow-2xl flex flex-col font-sans overflow-hidden relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-5 z-20 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 overflow-hidden">
          <PriceRevisionStudioWorkspace
            onNotification={onNotification}
          />
        </div>
      </div>
    </div>
  );
};

export default PriceRevisionStudioModal;
