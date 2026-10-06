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
 * Classification: Internal — DataBridge Import History Component
 * Capability    : databridge.workspace_ux (@SmritiCapability / smriti_capability)
 */

import React, { useState } from "react";
import { ImportHistoryItem } from "./databridgeTypes.ts";
import { DataBridgeClientService } from "./databridgeService.ts";

interface DataBridgeHistoryViewProps {
  onBackToMain?: () => void;
  onStartNewImport?: () => void;
}

export const DataBridgeHistoryView: React.FC<DataBridgeHistoryViewProps> = ({
  onBackToMain,
  onStartNewImport,
}) => {
  const [filter, setFilter] = useState<"ALL" | "COMPLETED" | "IN_PROGRESS" | "FAILED">("ALL");
  const historyList = DataBridgeClientService.getImportHistory();

  const filtered = historyList.filter((item) => {
    if (filter === "COMPLETED") return item.status === "COMPLETED";
    if (filter === "IN_PROGRESS") return item.status === "IN_PROGRESS";
    if (filter === "FAILED") return item.status === "FAILED";
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 select-none">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-[24px]">history</span>
            <h2 className="text-lg font-bold text-slate-800">Import History & Audit Log</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track past bulk catalog ingests, verified commit tokens, and reconciliation reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onBackToMain && (
            <button
              onClick={onBackToMain}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              Back to Overview
            </button>
          )}
          {onStartNewImport && (
            <button
              onClick={onStartNewImport}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              Start New Import
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilter("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            filter === "ALL" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All Imports ({historyList.length})
        </button>
        <button
          onClick={() => setFilter("COMPLETED")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            filter === "COMPLETED" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Completed ({historyList.filter((h) => h.status === "COMPLETED").length})
        </button>
        <button
          onClick={() => setFilter("IN_PROGRESS")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            filter === "IN_PROGRESS" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          In Progress ({historyList.filter((h) => h.status === "IN_PROGRESS").length})
        </button>
        <button
          onClick={() => setFilter("FAILED")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            filter === "FAILED" ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Failed ({historyList.filter((h) => h.status === "FAILED").length})
        </button>
      </div>

      {/* History Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Import ID</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4 text-right">Rows</th>
                <th className="py-3 px-4 text-right text-emerald-700">Created</th>
                <th className="py-3 px-4 text-right text-blue-700">Updated</th>
                <th className="py-3 px-4 text-right text-rose-700">Errors</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No import history records found for this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {row.importId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-700">{row.entity}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-[160px]" title={row.fileName}>
                      {row.fileName}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{row.user}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                      {row.rows.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      {row.created.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                      {row.updated.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                      {row.errors > 0 ? row.errors.toLocaleString() : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          row.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : row.status === "IN_PROGRESS"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {row.status === "COMPLETED" ? "Completed" : row.status === "IN_PROGRESS" ? "In Progress" : "Failed"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title="View Summary"
                          className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          title="Download Audit Report"
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">download</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
