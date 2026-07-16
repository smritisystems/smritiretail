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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { StockLedgerEntry } from "../types.js";
import { SmritiScrollArea } from "./SmritiScrollArea.js";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { recordAuditAction } from "../lib/apiFetch.ts";

interface StockLedgerTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const StockLedgerTab: React.FC<StockLedgerTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [entries, setEntries] = useState<StockLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("All");

  useEffect(() => {
    apiFetchV1("/inventory/ledger")
      .then(data => {
        const mapped = data.map((item: any) => {
          const qty = parseFloat(item.quantity) || 0;
          const mType = item.movement_type;
          return {
            id: item.id,
            timestamp: item.created_at || new Date().toISOString(),
            productId: item.product_id,
            productCode: item.sku,
            productName: item.product_name,
            movementType: mType,
            quantity: qty,
            balanceAfter: 0,
            referenceDocType: item.reference_doc_type,
            referenceDocId: item.reference_doc_id,
            warehouse: item.warehouse || "Main Outlet Retail WH",
            bin: item.bin || "Default",
            batch: item.batch || "-",
            serial: item.serial || "-",
            notes: item.remarks,
            user: item.user || "System",
            sourceModule: item.source_module || "System",
            quantityIn: mType === "IN" ? qty : (mType === "ADJUSTMENT" && qty > 0 ? qty : 0),
            quantityOut: mType === "OUT" ? Math.abs(qty) : (mType === "ADJUSTMENT" && qty < 0 ? Math.abs(qty) : 0),
          };
        });
        setEntries(mapped);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load stock movements from FastAPI:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    recordAuditAction("FILTER", "stock_ledgers", filterType, `Filtered stock ledger by movement type: ${filterType}`);
  }, [filterType]);

  const filteredEntries = filterType === "All" 
    ? entries 
    : entries.filter(e => e.movementType === filterType);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs">
          <span className="material-symbols-outlined text-sm">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Write operations are prohibited.</span>
        </div>
      )}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-950">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Stock Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">Immutable record of all inventory movements</p>
        </div>
        <div className="flex items-center space-x-4">
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-md text-sm font-medium focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Movements</option>
            <option value="IN">Stock IN</option>
            <option value="OUT">Stock OUT</option>
            <option value="ADJUSTMENT">Adjustments</option>
            <option value="TRANSFER">Transfers</option>
          </select>
        </div>
      </div>

      <SmritiScrollArea className="flex-1 p-6">
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Trans ID</th>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3">Warehouse & Bin</th>
                <th className="px-4 py-3">Batch / Serial</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Qty In</th>
                <th className="px-4 py-3 text-right">Qty Out</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-500">Loading ledger data...</td></tr>
              ) : filteredEntries.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-500">No stock movements recorded yet.</td></tr>
              ) : (
                filteredEntries.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
                      {new Date(entry.timestamp).toLocaleString()}
                      <div className="text-[10px] text-slate-400 mt-0.5">{entry.user || 'System'} | {entry.sourceModule || 'App'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-500 truncate max-w-[100px]">{entry.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{entry.productName}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{entry.productCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-600 dark:text-slate-400 text-sm">{entry.warehouse || 'Main WH'}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Bin: {entry.bin || 'Default'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                      <div>B: {entry.batch || '-'}</div>
                      <div>S: {entry.serial || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded ${
                          entry.movementType === 'IN' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          entry.movementType === 'OUT' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {entry.movementType}
                        </span>
                        {entry.referenceDocId && (
                          <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-500">
                            {entry.referenceDocId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {(entry.quantityIn ?? 0) > 0 ? entry.quantityIn : (entry.quantity > 0 ? entry.quantity : '-')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">
                      {(entry.quantityOut ?? 0) > 0 ? entry.quantityOut : (entry.quantity < 0 ? Math.abs(entry.quantity) : '-')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/50">
                      {entry.balanceAfter}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SmritiScrollArea>
    </div>
  );
};
