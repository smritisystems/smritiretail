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
 * Classification: Internal — DataBridge Diff View Component
 * Capability    : databridge.workspace_ux (@SmritiCapability / smriti_capability)
 */

import React, { useState } from "react";
import { DataBridgeResultItem } from "./databridgeTypes.ts";

interface DiffViewModalProps {
  item: DataBridgeResultItem | null;
  onClose: () => void;
}

export const DiffViewModal: React.FC<DiffViewModalProps> = ({ item, onClose }) => {
  const [showAllFields, setShowAllFields] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);

  if (!item) return null;

  const diffFields = Object.values(item.diff?.fields || {});
  const changedFields = diffFields.filter((f) => f.diff_type === "CHANGED" || f.diff_type === "NEW");
  const unchangedFields = diffFields.filter((f) => f.diff_type === "UNCHANGED");

  const identifier = item.identifier || item.raw_data["item_code"] || item.raw_data["variant_sku"] || item.raw_data["barcode"] || `Row #${item.row_index + 1}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-800 tracking-tight">{identifier}</h3>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                item.classification === "CREATE"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : item.classification === "UPDATE"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-slate-100 text-slate-700 border border-slate-300"
              }`}
            >
              {item.classification === "CREATE" ? "New Record" : item.classification === "UPDATE" ? "Update" : "No Change"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Diff Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100">
            <span>
              {changedFields.length} field{changedFields.length !== 1 ? "s" : ""} will be updated in SMRITI.
            </span>
            <button
              onClick={() => setShowAllFields(!showAllFields)}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>{showAllFields ? "Hide extra details" : `Show all fields (${diffFields.length})`}</span>
              <span className="material-symbols-outlined text-[16px]">
                {showAllFields ? "expand_less" : "expand_more"}
              </span>
            </button>
          </div>

          {/* Changed Fields Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 w-1/3">Field</th>
                  <th className="py-2.5 px-4 w-1/3">Current Value (in SMRITI)</th>
                  <th className="py-2.5 px-4 w-1/3 text-emerald-700">New Value (from file)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {changedFields.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-400 italic">
                      No modified values detected for this record.
                    </td>
                  </tr>
                ) : (
                  changedFields.map((field) => (
                    <tr key={field.field_name} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-700 capitalize">
                        {field.field_name.replace(/_/g, " ")}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono">
                        {field.current_value !== null && field.current_value !== undefined
                          ? String(field.current_value)
                          : "—"}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-700 bg-emerald-50/50">
                        {field.incoming_value !== null && field.incoming_value !== undefined
                          ? String(field.incoming_value)
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Unchanged Fields Collapsible Section */}
          {unchangedFields.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowUnchanged(!showUnchanged)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1.5 p-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-slate-400">
                  {showUnchanged ? "arrow_drop_down" : "arrow_right"}
                </span>
                <span>Unchanged Fields ({unchangedFields.length})</span>
              </button>

              {showUnchanged && (
                <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden bg-slate-50">
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-slate-100">
                      {unchangedFields.map((field) => (
                        <tr key={field.field_name}>
                          <td className="py-2 px-4 w-1/3 font-medium text-slate-600 capitalize">
                            {field.field_name.replace(/_/g, " ")}
                          </td>
                          <td className="py-2 px-4 w-2/3 text-slate-500 font-mono" colSpan={2}>
                            {String(field.current_value ?? "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Raw record inspection for advanced users */}
          {showAllFields && (
            <div className="p-3 bg-slate-900 rounded-xl text-slate-200 text-xs font-mono overflow-x-auto">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                Normalized Source Record
              </div>
              <pre>{JSON.stringify(item.normalized_data, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Preview
          </button>
        </div>
      </div>
    </div>
  );
};
