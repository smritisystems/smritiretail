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
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
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
      // Mock download
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

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Accounting Sync</h1>
            <p className="text-sm text-slate-500 mt-1">Export operational transactions to TallyPrime, track sync status, and manage failed syncs</p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button 
              onClick={() => setActiveSubTab("export")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md ${activeSubTab === "export" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500"}`}
            >Export</button>
            <button 
              onClick={() => setActiveSubTab("queue")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md ${activeSubTab === "queue" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500"}`}
            >Sync Queue</button>
            <button 
              onClick={() => setActiveSubTab("history")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md ${activeSubTab === "history" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500"}`}
            >History</button>
            <button 
              onClick={() => setActiveSubTab("mapping")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md ${activeSubTab === "mapping" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500"}`}
            >Mapping</button>
          </div>
        </div>
      </div>

      <SmritiScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {activeSubTab === "export" && (
          <div className="bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-slate-900 dark:text-white">Export Vouchers to Tally XML</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Voucher Type</label>
                <select 
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From Date</label>
                <input 
                  type="date" 
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To Date</label>
                <input 
                  type="date" 
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
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

          {activeSubTab === "queue" && (
            <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-medium text-slate-900 dark:text-white">Pending Exports Queue</h3>
                <button className="text-sm bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">Sync Now</button>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Event Ref</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {syncQueue.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-slate-500">No pending items in queue</td></tr>
                  ) : (
                    syncQueue.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3 font-mono text-xs">{item.id}</td>
                        <td className="px-4 py-3 font-medium">{item.type}</td>
                        <td className="px-4 py-3 text-slate-500">{item.eventId}</td>
                        <td className="px-4 py-3">
                          <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-medium">Pending</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 text-xs font-medium">Preview XML</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSubTab === "history" && (
            <div className="bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center text-slate-500">
              Export History and Audit Logs will appear here.
            </div>
          )}

          {activeSubTab === "mapping" && (
            <div className="bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center text-slate-500">
              Tally Ledger to SMRITI Category Mappings will appear here.
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-4 rounded-xl flex items-start space-x-3">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-500">info</span>
            <div className="text-sm text-amber-800 dark:text-amber-400">
              <p className="font-semibold mb-1">Accounting Policy Note</p>
              <p>SMRITI Retail OS acts as the operational source of truth. All complex accounting, taxation, and final GL consolidation should be performed in TallyPrime. Ensure your ledger names mapped in SMRITI perfectly match your Tally chart of accounts.</p>
            </div>
          </div>
        </div>
      </SmritiScrollArea>
    </div>
  );
};
