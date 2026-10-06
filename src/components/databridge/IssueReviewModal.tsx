/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-06
 * Modified     : 2026-10-06
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal — DataBridge Issue Review & Explainability Component
 * Capability    : databridge.workspace_ux (@SmritiCapability / smriti_capability)
 */

import React, { useState } from "react";
import { DataBridgeResultItem } from "./databridgeTypes.ts";
import { DataBridgeClientService } from "./databridgeService.ts";

interface IssueReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DataBridgeResultItem[];
  onSelectRowForDiff?: (item: DataBridgeResultItem) => void;
}

export const IssueReviewModal: React.FC<IssueReviewModalProps> = ({
  isOpen,
  onClose,
  items,
  onSelectRowForDiff,
}) => {
  const [activeTab, setActiveTab] = useState<"CONFLICTS" | "VALIDATION">("CONFLICTS");

  if (!isOpen) return null;

  const conflictItems = items.filter(
    (i) => i.classification === "EXISTING_CONFLICT" || i.conflicts.length > 0
  );
  const validationItems = items.filter(
    (i) => i.classification === "VALIDATION_ERROR" || i.classification === "DEPENDENCY_ERROR" || i.validation_errors.length > 0
  );

  const currentList = activeTab === "CONFLICTS" ? conflictItems : validationItems;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[24px]">gpp_maybe</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Review Import Issues</h3>
              <p className="text-xs text-slate-500">
                Understand why rows were blocked and what you should do to resolve them.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="px-6 pt-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("CONFLICTS")}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "CONFLICTS"
                  ? "border-rose-600 text-rose-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>Conflicts</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === "CONFLICTS"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {conflictItems.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("VALIDATION")}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "VALIDATION"
                  ? "border-amber-600 text-amber-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>Validation Errors</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === "VALIDATION"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {validationItems.length}
              </span>
            </button>
          </div>

          <button
            onClick={() => DataBridgeClientService.downloadErrorRowsCSV(items)}
            className="mb-2 text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Download All Error Rows</span>
          </button>
        </div>

        {/* Issues List */}
        <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/50 flex-1">
          {currentList.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <span className="material-symbols-outlined text-emerald-500 text-[48px] block mx-auto mb-2">
                check_circle
              </span>
              <p className="text-sm font-semibold text-slate-600">No issues found in this category.</p>
            </div>
          ) : (
            currentList.map((item, idx) => {
              const conflict = item.conflicts[0];
              const barcodeVal = item.raw_data["barcode"] || item.normalized_data["barcode"];
              const existingSku = conflict?.existing_identifier || "CH-501-BLK-08";
              const incomingSku = conflict?.incoming_identifier || item.identifier || "CH-502-BLU-08";

              return (
                <div
                  key={idx}
                  className="bg-white border border-rose-200 rounded-2xl p-5 shadow-xs space-y-4"
                >
                  {/* Issue Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
                        <span className="material-symbols-outlined text-[20px]">error</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">
                          {activeTab === "CONFLICTS" ? "Barcode Conflict" : "Validation Error"}
                        </h4>
                        <p className="text-xs text-rose-600 font-medium">
                          {conflict?.message || item.validation_errors.join("; ") || "Data row requires manual correction."}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      Row #{item.row_index + 1}
                    </span>
                  </div>

                  {/* Conflict Technical Grid */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs grid grid-cols-1 md:grid-cols-3 gap-3">
                    {barcodeVal && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Barcode
                        </span>
                        <span className="font-mono font-bold text-slate-800">{barcodeVal}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Existing in SMRITI
                      </span>
                      <span className="font-mono font-bold text-slate-800">{existingSku}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Incoming in File
                      </span>
                      <span className="font-mono font-bold text-rose-700">{incomingSku}</span>
                    </div>
                  </div>

                  {/* "Why this happened?" Box */}
                  <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                      <span className="material-symbols-outlined text-[16px]">help</span>
                      <span>Why this happened?</span>
                    </div>
                    <p className="text-amber-900 leading-relaxed pl-5">
                      {item.explanation ||
                        "SMRITI protects barcode identity and will never automatically transfer a barcode between SKUs to prevent retail counter scanning discrepancies."}
                    </p>
                  </div>

                  {/* "What you should do:" Guidance */}
                  <div className="bg-blue-50/60 border border-blue-200/60 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-blue-800 font-bold">
                      <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                      <span>What you should do:</span>
                    </div>
                    <ul className="text-blue-900 list-disc list-inside space-y-0.5 pl-2">
                      <li>
                        {conflict?.suggested_action ||
                          "Correct the barcode in your source spreadsheet, OR"}
                      </li>
                      <li>Remove this duplicate row and run Preview again.</li>
                    </ul>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                    {onSelectRowForDiff && (
                      <button
                        onClick={() => {
                          onClose();
                          onSelectRowForDiff(item);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                      >
                        View Row Details
                      </button>
                    )}
                    <button
                      onClick={() => DataBridgeClientService.downloadErrorRowsCSV([item], `Error_Row_${item.row_index + 1}.csv`)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">download</span>
                      Download Issue
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Fix issues in your file and re-upload to unlock import commit.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
