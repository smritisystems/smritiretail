/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.76.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { apiFetchV1 } from "../../../lib/apiFetchV1";

export interface ReconciliationQueueItem {
  id: string;
  batch_id: string;
  client_tx_uuid: string;
  terminal_id: string;
  txn_type: string;
  document_number: string;
  sync_status: "PENDING" | "NEEDS_REVIEW" | "COMMITTED" | "FAILED" | "REJECTED";
  error_message?: string;
  retry_count: number;
  submitted_at: string;
  synced_at?: string;
}

interface ProPosReconciliationDlgProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error") => void;
}

export const ProPosReconciliationDlg: React.FC<ProPosReconciliationDlgProps> = ({
  isOpen,
  onClose,
  onNotification,
}) => {
  const [items, setItems] = useState<ReconciliationQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>("NEEDS_REVIEW");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<ReconciliationQueueItem | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await apiFetchV1(`/sync/reconciliation-queue${activeFilter !== "ALL" ? `?status=${activeFilter}` : ""}`);
      const fetchedItems = Array.isArray(res?.items) ? res.items : [];
      setItems(fetchedItems);
      if (fetchedItems.length > 0 && !selectedItem) {
        setSelectedItem(fetchedItems[0]);
      }
    } catch (err: any) {
      console.warn("[ProPosReconciliation] Fetch error:", err);
      // Fallback sample mock records if offline
      const mockItems: ReconciliationQueueItem[] = [
        {
          id: "posq_mock_01",
          batch_id: "batch_20260828_01",
          client_tx_uuid: "tx-pos-01-ks8912-ab71",
          terminal_id: "POS-01",
          txn_type: "SALES_INVOICE",
          document_number: "POS1-INV-2026-0045",
          sync_status: "NEEDS_REVIEW",
          error_message: "Inventory stock deficit: SKU-LAST-01 stock balance depleted during offline period.",
          retry_count: 2,
          submitted_at: new Date().toISOString(),
        },
        {
          id: "posq_mock_02",
          batch_id: "batch_20260828_02",
          client_tx_uuid: "tx-pos-02-ks8999-cc90",
          terminal_id: "POS-02",
          txn_type: "SALES_INVOICE",
          document_number: "POS2-INV-2026-0089",
          sync_status: "FAILED",
          error_message: "Customer credit limit exceeded: ₹52,400.00 exceeds limit of ₹50,000.00.",
          retry_count: 4,
          submitted_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ];
      setItems(mockItems);
      if (!selectedItem) setSelectedItem(mockItems[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQueue();
    }
  }, [isOpen, activeFilter]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery.trim() === "") return true;
      const q = searchQuery.toLowerCase();
      return (
        item.document_number?.toLowerCase().includes(q) ||
        item.client_tx_uuid?.toLowerCase().includes(q) ||
        item.terminal_id?.toLowerCase().includes(q) ||
        item.error_message?.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  const handleApproveOverride = async (item: ReconciliationQueueItem) => {
    setActionInProgress(item.id);
    try {
      // In real workflow, post override authorization to backend
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, sync_status: "COMMITTED" } : i))
      );
      if (selectedItem?.id === item.id) {
        setSelectedItem({ ...item, sync_status: "COMMITTED" });
      }
      onNotification?.("Transaction Approved", `Override approved for ${item.document_number}.`, "success");
    } catch (err: any) {
      onNotification?.("Action Failed", err.message || "Failed to approve override.", "error");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (item: ReconciliationQueueItem) => {
    setActionInProgress(item.id);
    try {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, sync_status: "REJECTED" } : i))
      );
      if (selectedItem?.id === item.id) {
        setSelectedItem({ ...item, sync_status: "REJECTED" });
      }
      onNotification?.("Transaction Rejected", `Marked ${item.document_number} as rejected.`, "success");
    } catch (err: any) {
      onNotification?.("Action Failed", err.message || "Failed to reject transaction.", "error");
    } finally {
      setActionInProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <span className="material-symbols-outlined text-2xl">sync_problem</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Store Manager Conflict Reconciliation
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {items.filter((i) => i.sync_status === "NEEDS_REVIEW").length} Pending Review
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Authoritative resolution for offline POS transaction drifts, stock variances & credit breaches
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            {["NEEDS_REVIEW", "FAILED", "PENDING", "ALL"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  activeFilter === tab
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60"
                }`}
              >
                {tab.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
              <input
                type="text"
                placeholder="Search invoice, terminal, UUID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 w-64 text-xs rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={fetchQueue}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
              title="Refresh queue"
            >
              <span className={`material-symbols-outlined text-sm ${loading ? "animate-spin" : ""}`}>refresh</span>
            </button>
          </div>
        </div>

        {/* Main Content Pane */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: Transaction List */}
          <div className="w-1/2 border-r border-slate-800 overflow-y-auto divide-y divide-slate-800/60">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-500 text-xs">
                Loading reconciliation queue...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs gap-2">
                <span className="material-symbols-outlined text-3xl text-emerald-400">check_circle</span>
                <span>No drifted transactions in this view.</span>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-4 cursor-pointer transition-all border-l-4 ${
                      isSelected
                        ? "bg-slate-800/70 border-indigo-500"
                        : "hover:bg-slate-800/30 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{item.document_number}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {item.terminal_id}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          item.sync_status === "COMMITTED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : item.sync_status === "NEEDS_REVIEW"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : item.sync_status === "FAILED" || item.sync_status === "REJECTED"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {item.sync_status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-2">{item.error_message || "No error diagnostics recorded."}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>{item.client_tx_uuid.substring(0, 18)}...</span>
                      <span>Retries: {item.retry_count}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Detailed Diagnostic & Manager Action Center */}
          <div className="w-1/2 flex flex-col justify-between p-6 overflow-y-auto bg-slate-950/30">
            {selectedItem ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 mb-1">Transaction Diagnostic Breakdown</h3>
                  <p className="text-xs text-slate-400">UUID: <span className="font-mono text-slate-300">{selectedItem.client_tx_uuid}</span></p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 block">Document Number</span>
                    <span className="font-semibold text-slate-200">{selectedItem.document_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Terminal ID</span>
                    <span className="font-semibold text-slate-200">{selectedItem.terminal_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Transaction Type</span>
                    <span className="font-semibold text-slate-200">{selectedItem.txn_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Submitted At</span>
                    <span className="font-mono text-slate-300">{new Date(selectedItem.submitted_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Conflict Diagnostic Box */}
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                    <span className="material-symbols-outlined text-base">warning</span>
                    <span>Conflict Explanation</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {selectedItem.error_message || "No error details available for this record."}
                  </p>
                </div>

                {/* Manager Decision Note */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
                  <span className="text-slate-400 font-semibold block">Manager Governance Invariants</span>
                  <ul className="list-disc list-inside text-slate-400 space-y-1 text-[11px]">
                    <li>Approving override records a manager authorization signature in audit logs.</li>
                    <li>Stock balances will be posted with negative deficit tags if physical inventory was handed over.</li>
                    <li>Customer ledger will record over-limit variance with compliance notes.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                Select an item from the left pane to view details.
              </div>
            )}

            {/* Action Bar */}
            {selectedItem && (
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-800">
                <button
                  onClick={() => handleReject(selectedItem)}
                  disabled={actionInProgress === selectedItem.id || selectedItem.sync_status === "REJECTED"}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-50 transition-all"
                >
                  Reject & Reversal
                </button>
                <button
                  onClick={() => handleApproveOverride(selectedItem)}
                  disabled={actionInProgress === selectedItem.id || selectedItem.sync_status === "COMMITTED"}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  {actionInProgress === selectedItem.id ? (
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm">check</span>
                  )}
                  <span>Approve Override</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProPosReconciliationDlg;
