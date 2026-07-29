/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 5.1.0  (SEEF Phase 8 - Theme token cascade; removed dark: dual-mode)
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { SmritiScrollArea } from "./SmritiScrollArea.js";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

export const AccountingSyncTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("export");
  const [syncQueue, setSyncQueue] = useState<any[]>([]);

  const [exportType, setExportType] = useState("Sales");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (activeSubTab === "queue") {
      apiFetchV1("/tally")
        .then(data => setSyncQueue(data))
        .catch(err => {
          console.error("Failed to load tally sync queue:", err);
          setSyncQueue([]);
        });
    }
  }, [activeSubTab]);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      const xml = `<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n  </HEADER>\n  <BODY>\n    <IMPORTDATA>\n      <REQUESTDESC>\n        <REPORTNAME>Vouchers</REPORTNAME>\n      </REQUESTDESC>\n      <REQUESTDATA>\n        <!-- Generated Tally XML for ${exportType} -->\n      </REQUESTDATA>\n    </IMPORTDATA>\n  </BODY>\n</ENVELOPE>`;
      const blob = new Blob([xml], { type: 'text/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tally_Export_${exportType}_${dateFrom}_to_${dateTo}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, 1500);
  };

  // Shared class for tab buttons
  const tabBtn = (tab: string) =>
    `px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
      activeSubTab === tab
        ? "bg-theme-surface-1 shadow-sm text-theme-heading"
        : "text-theme-muted hover:text-theme-body"
    }`;

  // Shared class for form inputs
  const inputCls = "w-full px-3 py-2 border border-theme-divider rounded-md bg-theme-surface-1 text-theme-body focus:ring-2 focus:ring-blue-500 outline-none";

  return (
    // SEEF Phase 8: removed all dark: dual-mode classes → SEEF theme tokens
    <div className="flex flex-col h-full bg-theme-base text-theme-body">
      {/* Page Header */}
      <div className="p-6 border-b border-theme-divider bg-theme-surface-1">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-theme-heading">Accounting Sync</h1>
            <p className="text-sm text-theme-muted mt-1">
              Export operational transactions to TallyPrime, track sync status, and manage failed syncs
            </p>
          </div>
          {/* Sub-Tab Switcher */}
          <div className="flex bg-theme-surface-2 p-1 rounded-lg">
            <button onClick={() => setActiveSubTab("export")} className={tabBtn("export")}>Export</button>
            <button onClick={() => setActiveSubTab("queue")} className={tabBtn("queue")}>Sync Queue</button>
            <button onClick={() => setActiveSubTab("history")} className={tabBtn("history")}>History</button>
            <button onClick={() => setActiveSubTab("mapping")} className={tabBtn("mapping")}>Mapping</button>
          </div>
        </div>
      </div>

      <SmritiScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Export Tab */}
          {activeSubTab === "export" && (
            <div className="bg-theme-surface-1 p-6 rounded-xl border border-theme-divider shadow-sm">
              <h2 className="text-lg font-medium mb-4 text-theme-heading">Export Vouchers to Tally XML</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">Voucher Type</label>
                  <select
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value)}
                    className={inputCls}
                  >
                    <option value="Sales">Sales Invoices</option>
                    <option value="Purchase">Purchase (GRN Bills)</option>
                    <option value="Receipts">Receipts (Customer Payments)</option>
                    <option value="Payments">Payments (Vendor Settlements)</option>
                    <option value="Journal">Inventory Journals (Adjustments)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md transition-colors flex items-center justify-center disabled:opacity-50"
              >
                <span className="material-symbols-outlined mr-2">download</span>
                {isExporting ? "Generating Tally XML..." : "Export to Tally XML"}
              </button>
            </div>
          )}

          {/* Sync Queue Tab */}
          {activeSubTab === "queue" && (
            <div className="bg-theme-surface-1 rounded-xl border border-theme-divider shadow-sm overflow-hidden">
              <div className="p-4 border-b border-theme-divider flex justify-between items-center">
                <h3 className="font-medium text-theme-heading">Pending Exports Queue</h3>
                <button className="text-sm bg-theme-surface-2 hover:bg-theme-surface-hover px-3 py-1.5 rounded-md text-theme-body transition-colors">
                  Sync Now
                </button>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-theme-surface-2 border-b border-theme-divider text-theme-muted">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Event Ref</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider">
                  {syncQueue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-theme-muted">
                        No pending items in queue
                      </td>
                    </tr>
                  ) : (
                    syncQueue.map(item => (
                      <tr key={item.id} className="hover:bg-theme-surface-1 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-theme-body">{item.id}</td>
                        <td className="px-4 py-3 font-medium text-theme-body">{item.type}</td>
                        <td className="px-4 py-3 text-theme-muted">{item.eventId}</td>
                        <td className="px-4 py-3">
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-medium">
                            Pending
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors">
                            Preview XML
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* History Tab */}
          {activeSubTab === "history" && (
            <div className="bg-theme-surface-1 p-6 rounded-xl border border-theme-divider shadow-sm text-center text-theme-muted">
              Export History and Audit Logs will appear here.
            </div>
          )}

          {/* Mapping Tab */}
          {activeSubTab === "mapping" && (
            <div className="bg-theme-surface-1 p-6 rounded-xl border border-theme-divider shadow-sm text-center text-theme-muted">
              Tally Ledger to SMRITI Category Mappings will appear here.
            </div>
          )}

          {/* Accounting Policy Notice */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex items-start space-x-3">
            <span className="material-symbols-outlined text-amber-400">info</span>
            <div className="text-sm text-amber-300">
              <p className="font-semibold mb-1 text-amber-400">Accounting Policy Note</p>
              <p>
                SMRITI Retail OS acts as the operational source of truth. All complex accounting,
                taxation, and final GL consolidation should be performed in TallyPrime. Ensure your
                ledger names mapped in SMRITI perfectly match your Tally chart of accounts.
              </p>
            </div>
          </div>

        </div>
      </SmritiScrollArea>
    </div>
  );
};
