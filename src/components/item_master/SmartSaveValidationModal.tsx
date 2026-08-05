/**
 * Project      : SMRITI Retail OS v7.0
 * Module       : Smart Save Validation Modal (Pre-commit Audit Guardrail)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import React from "react";
import { SmritiDialog } from "../../layout_engine/components/SmritiDialog.tsx";
import { Product } from "../../types.js";
import { MDQE, ProductQualityResult } from "../../kernel/ule/MasterDataQualityEngine.js";
import { ShieldAlert, CheckCircle2, AlertTriangle, AlertCircle, Save, FileEdit, ArrowRight } from "lucide-react";

interface SmartSaveValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Partial<Product>;
  onConfirmSave: (action: "SAVE_ACTIVE" | "SAVE_DRAFT", updatedStatus?: string) => Promise<void>;
  onNavigateTab: (tabId: string) => void;
}

export const SmartSaveValidationModal: React.FC<SmartSaveValidationModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirmSave,
  onNavigateTab
}) => {
  if (!isOpen) return null;

  const quality: ProductQualityResult = MDQE.evaluateProduct(product as Product);
  const { overallScore, grade, missingGaps, hasCriticalGaps } = quality;

  const mandatoryChecks = [
    { label: "Item Name", valid: Boolean(product.name && product.name.trim().length >= 3) },
    { label: "Primary Barcode", valid: Boolean(product.barcode && product.barcode.trim().length >= 6) },
    { label: "Retail Selling Price", valid: Boolean((product.price || 0) > 0) },
    { label: "GST Tax Rate", valid: Boolean(product.gst_rate !== undefined || product.gstPercentage !== undefined) },
  ];

  return (
    <SmritiDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Smart Save Pre-Commit Audit"
      subtitle={`Master Data Quality Score: ${overallScore}% (${grade}) | Checks & Hygiene`}
      icon={ShieldAlert}
      maxWidthClass="max-w-xl"
      footerActions={
        <div className="flex flex-wrap items-center justify-end gap-2 w-full font-mono text-xs">
          {missingGaps.length > 0 && (
            <button
              onClick={() => {
                onClose();
                if (missingGaps[0]) onNavigateTab(missingGaps[0].targetTab);
              }}
              className="px-3 py-2 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-heading rounded-lg border border-theme-divider flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <ArrowRight className="w-4 h-4 text-[var(--c-seef-accent)]" /> Fix Now
            </button>
          )}

          <button
            onClick={() => onConfirmSave("SAVE_DRAFT", "Draft")}
            className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/30 flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <FileEdit className="w-4 h-4 text-amber-400" /> Save Draft
          </button>

          <button
            onClick={() => onConfirmSave("SAVE_ACTIVE", "Active")}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Anyway
          </button>
        </div>
      }
    >
      <div className="space-y-4 font-mono text-xs text-theme-body py-1">
        {/* Mandatory Checks Section */}
        <div className="p-3 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-2">
          <div className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">Mandatory Operational Validations:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {mandatoryChecks.map((chk) => (
              <div key={chk.label} className="flex items-center gap-2">
                {chk.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span className={chk.valid ? "text-theme-heading font-bold" : "text-rose-400 font-bold"}>
                  {chk.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Missing Quality Gaps Warnings */}
        {missingGaps.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center justify-between">
              <span>Operational Data Gaps ({missingGaps.length}):</span>
              <span className="text-amber-400 font-bold">Recommended to resolve</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {missingGaps.map((gap) => (
                <div
                  key={gap.id}
                  className="p-2.5 bg-theme-surface-1 border border-theme-divider rounded-lg flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>{gap.message}</span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab(gap.targetTab);
                    }}
                    className="px-2 py-1 text-[10px] font-bold rounded bg-theme-surface-2 text-[var(--c-seef-accent)] hover:underline cursor-pointer"
                  >
                    Go to tab
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SmritiDialog>
  );
};
