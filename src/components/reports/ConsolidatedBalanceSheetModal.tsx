/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.83.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

export interface BalanceSheetLine {
  account_code: string;
  account_name: string;
  category: "CURRENT_ASSETS" | "FIXED_ASSETS" | "CURRENT_LIABILITIES" | "TERM_LIABILITIES" | "EQUITY";
  root_type: "ASSET" | "LIABILITY" | "EQUITY";
  branch_values: Record<string, number>; // branch_id -> value
  eliminations: number;
}

export interface BranchInfo {
  id: string;
  name: string;
  code: string;
}

interface ConsolidatedBalanceSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asOfDate?: string;
  fiscalYear?: string;
  branches?: BranchInfo[];
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

export const ConsolidatedBalanceSheetModal: React.FC<ConsolidatedBalanceSheetModalProps> = ({
  isOpen,
  onClose,
  asOfDate = "2026-08-28",
  fiscalYear = "2026-27",
  branches = [
    { id: "BR-001", name: "Main Flagship Mall", code: "MALL" },
    { id: "BR-002", name: "High Street Boutique", code: "HSTR" },
    { id: "BR-003", name: "Central Hub Warehouse", code: "WH01" },
  ],
  onNotification,
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState<string>("INR");

  const sampleLines: BalanceSheetLine[] = [
    // ── Assets ──
    {
      account_code: "1010",
      account_name: "Cash in Hand & Till Float",
      category: "CURRENT_ASSETS",
      root_type: "ASSET",
      branch_values: { "BR-001": 245000, "BR-002": 115000, "BR-003": 45000 },
      eliminations: 0,
    },
    {
      account_code: "1020",
      account_name: "Bank Accounts (Current / POS Settlement)",
      category: "CURRENT_ASSETS",
      root_type: "ASSET",
      branch_values: { "BR-001": 1420000, "BR-002": 680000, "BR-003": 520000 },
      eliminations: 0,
    },
    {
      account_code: "1030",
      account_name: "Accounts Receivable (Trade Debtors)",
      category: "CURRENT_ASSETS",
      root_type: "ASSET",
      branch_values: { "BR-001": 560000, "BR-002": 240000, "BR-003": 180000 },
      eliminations: -80000, // Inter-branch receivable eliminated
    },
    {
      account_code: "1040",
      account_name: "Inventory Asset (Physical Stock Valuation)",
      category: "CURRENT_ASSETS",
      root_type: "ASSET",
      branch_values: { "BR-001": 3450000, "BR-002": 1850000, "BR-003": 4900000 },
      eliminations: 0,
    },
    {
      account_code: "1050",
      account_name: "GST Input Tax Credit Pool",
      category: "CURRENT_ASSETS",
      root_type: "ASSET",
      branch_values: { "BR-001": 185000, "BR-002": 95000, "BR-003": 260000 },
      eliminations: 0,
    },
    {
      account_code: "1110",
      account_name: "Store Fixtures & Display Fittings",
      category: "FIXED_ASSETS",
      root_type: "ASSET",
      branch_values: { "BR-001": 850000, "BR-002": 420000, "BR-003": 210000 },
      eliminations: 0,
    },
    {
      account_code: "1120",
      account_name: "POS Hardware & Barcode Terminals",
      category: "FIXED_ASSETS",
      root_type: "ASSET",
      branch_values: { "BR-001": 320000, "BR-002": 160000, "BR-003": 95000 },
      eliminations: 0,
    },

    // ── Liabilities ──
    {
      account_code: "2010",
      account_name: "Accounts Payable (Trade Creditors / Suppliers)",
      category: "CURRENT_LIABILITIES",
      root_type: "LIABILITY",
      branch_values: { "BR-001": 1850000, "BR-002": 920000, "BR-003": 2400000 },
      eliminations: -80000, // Inter-branch payable eliminated
    },
    {
      account_code: "2020",
      account_name: "GST Output Tax Payable Liability",
      category: "CURRENT_LIABILITIES",
      root_type: "LIABILITY",
      branch_values: { "BR-001": 290000, "BR-002": 140000, "BR-003": 85000 },
      eliminations: 0,
    },
    {
      account_code: "2110",
      account_name: "Bank Term Borrowings (Capital Expansion)",
      category: "TERM_LIABILITIES",
      root_type: "LIABILITY",
      branch_values: { "BR-001": 1500000, "BR-002": 500000, "BR-003": 1000000 },
      eliminations: 0,
    },

    // ── Equity ──
    {
      account_code: "3010",
      account_name: "Share Capital / Founder Investment",
      category: "EQUITY",
      root_type: "EQUITY",
      branch_values: { "BR-001": 2500000, "BR-002": 1000000, "BR-003": 1500000 },
      eliminations: 0,
    },
    {
      account_code: "3020",
      account_name: "Retained Earnings & Reserves",
      category: "EQUITY",
      root_type: "EQUITY",
      branch_values: { "BR-001": 890000, "BR-002": 1000000, "BR-003": 1225000 },
      eliminations: 0,
    },
  ];

  const liveLines: BalanceSheetLine[] = [];

  // Calculated totals per column
  const calculatedMatrix = useMemo(() => {
    const branchTotals: Record<
      string,
      { assets: number; liabilities: number; equity: number }
    > = {};

    branches.forEach((b) => {
      branchTotals[b.id] = { assets: 0, liabilities: 0, equity: 0 };
    });

    let totalConsolidatedAssets = 0;
    let totalConsolidatedLiabilities = 0;
    let totalConsolidatedEquity = 0;

    liveLines.forEach((line) => {
      let lineConsolidated = 0;
      branches.forEach((b) => {
        const val = line.branch_values[b.id] || 0;
        lineConsolidated += val;

        if (line.root_type === "ASSET") {
          branchTotals[b.id].assets += val;
        } else if (line.root_type === "LIABILITY") {
          branchTotals[b.id].liabilities += val;
        } else if (line.root_type === "EQUITY") {
          branchTotals[b.id].equity += val;
        }
      });

      lineConsolidated += line.eliminations;

      if (line.root_type === "ASSET") {
        totalConsolidatedAssets += lineConsolidated;
      } else if (line.root_type === "LIABILITY") {
        totalConsolidatedLiabilities += lineConsolidated;
      } else if (line.root_type === "EQUITY") {
        totalConsolidatedEquity += lineConsolidated;
      }
    });

    const isBalanced =
      Math.abs(totalConsolidatedAssets - (totalConsolidatedLiabilities + totalConsolidatedEquity)) <
      1.0;

    return {
      branchTotals,
      totalConsolidatedAssets,
      totalConsolidatedLiabilities,
      totalConsolidatedEquity,
      isBalanced,
    };
  }, [branches, liveLines]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-6xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-3">
                Enterprise Multi-Branch Consolidated Balance Sheet Matrix
                <span
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold ${
                    liveLines.length > 0 && calculatedMatrix.isBalanced
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                  }`}
                >
                  {liveLines.length === 0
                    ? "NO LIVE DATA"
                    : calculatedMatrix.isBalanced
                      ? "BALANCED & VERIFIED (A = L + E)"
                      : "OUT OF BALANCE"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Universal multi-store financial consolidation with automated inter-company eliminations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">
              FY {fiscalYear} | As of {asOfDate}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-950/50">
                <th className="py-2.5 px-3">Chart of Accounts</th>
                {branches.map((b) => (
                  <th key={b.id} className="py-2.5 px-3 text-right">
                    {b.name} ({b.code})
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right text-rose-400">Inter-Co Elim.</th>
                <th className="py-2.5 px-3 text-right text-emerald-400 font-bold">Consolidated Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {liveLines.length === 0 && (
                <tr>
                  <td colSpan={branches.length + 3} className="px-4 py-12 text-center font-sans">
                    <div className="text-sm font-semibold text-slate-200">Balance Sheet data is not connected yet</div>
                    <div className="mt-2 text-xs text-slate-400">
                      No accounting ledger data was returned, so sample figures are hidden.
                    </div>
                    <div className="mt-1 text-xs text-amber-300">This report will be available after the live ledger API is connected.</div>
                  </td>
                </tr>
              )}
              {/* ASSETS SECTION */}
              <tr className="bg-slate-800/30 font-sans">
                <td
                  colSpan={branches.length + 3}
                  className="py-2 px-3 font-bold text-cyan-400 text-[11px] uppercase tracking-wider"
                >
                  1. Assets (Current & Fixed)
                </td>
              </tr>
              {liveLines
                .filter((l) => l.root_type === "ASSET")
                .map((line) => {
                  let lineTotal = 0;
                  branches.forEach((b) => {
                    lineTotal += line.branch_values[b.id] || 0;
                  });
                  lineTotal += line.eliminations;

                  return (
                    <tr key={line.account_code} className="hover:bg-slate-800/20">
                      <td className="py-2 px-3 font-sans">
                        <span className="text-slate-200 block">{line.account_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{line.account_code}</span>
                      </td>
                      {branches.map((b) => (
                        <td key={b.id} className="py-2 px-3 text-right text-slate-300">
                          ₹{(line.branch_values[b.id] || 0).toLocaleString()}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right text-rose-400">
                        {line.eliminations !== 0 ? `₹${line.eliminations.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-cyan-300">
                        ₹{lineTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              <tr className="bg-cyan-950/20 font-bold border-t border-b border-cyan-500/30 font-sans">
                <td className="py-2.5 px-3 text-cyan-300">TOTAL ASSETS</td>
                {branches.map((b) => (
                  <td key={b.id} className="py-2.5 px-3 text-right font-mono text-cyan-300">
                    ₹{calculatedMatrix.branchTotals[b.id].assets.toLocaleString()}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">—</td>
                <td className="py-2.5 px-3 text-right font-mono text-cyan-400 text-sm">
                  ₹{calculatedMatrix.totalConsolidatedAssets.toLocaleString()}
                </td>
              </tr>

              {/* LIABILITIES SECTION */}
              <tr className="bg-slate-800/30 font-sans">
                <td
                  colSpan={branches.length + 3}
                  className="py-2 px-3 font-bold text-amber-400 text-[11px] uppercase tracking-wider pt-4"
                >
                  2. Liabilities (Current & Term)
                </td>
              </tr>
              {liveLines
                .filter((l) => l.root_type === "LIABILITY")
                .map((line) => {
                  let lineTotal = 0;
                  branches.forEach((b) => {
                    lineTotal += line.branch_values[b.id] || 0;
                  });
                  lineTotal += line.eliminations;

                  return (
                    <tr key={line.account_code} className="hover:bg-slate-800/20">
                      <td className="py-2 px-3 font-sans">
                        <span className="text-slate-200 block">{line.account_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{line.account_code}</span>
                      </td>
                      {branches.map((b) => (
                        <td key={b.id} className="py-2 px-3 text-right text-slate-300">
                          ₹{(line.branch_values[b.id] || 0).toLocaleString()}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right text-rose-400">
                        {line.eliminations !== 0 ? `₹${line.eliminations.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-amber-300">
                        ₹{lineTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              <tr className="bg-amber-950/20 font-bold border-t border-b border-amber-500/30 font-sans">
                <td className="py-2.5 px-3 text-amber-300">TOTAL LIABILITIES</td>
                {branches.map((b) => (
                  <td key={b.id} className="py-2.5 px-3 text-right font-mono text-amber-300">
                    ₹{calculatedMatrix.branchTotals[b.id].liabilities.toLocaleString()}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">—</td>
                <td className="py-2.5 px-3 text-right font-mono text-amber-400 text-sm">
                  ₹{calculatedMatrix.totalConsolidatedLiabilities.toLocaleString()}
                </td>
              </tr>

              {/* EQUITY SECTION */}
              <tr className="bg-slate-800/30 font-sans">
                <td
                  colSpan={branches.length + 3}
                  className="py-2 px-3 font-bold text-purple-400 text-[11px] uppercase tracking-wider pt-4"
                >
                  3. Shareholders' Equity & Reserves
                </td>
              </tr>
              {liveLines
                .filter((l) => l.root_type === "EQUITY")
                .map((line) => {
                  let lineTotal = 0;
                  branches.forEach((b) => {
                    lineTotal += line.branch_values[b.id] || 0;
                  });
                  lineTotal += line.eliminations;

                  return (
                    <tr key={line.account_code} className="hover:bg-slate-800/20">
                      <td className="py-2 px-3 font-sans">
                        <span className="text-slate-200 block">{line.account_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{line.account_code}</span>
                      </td>
                      {branches.map((b) => (
                        <td key={b.id} className="py-2 px-3 text-right text-slate-300">
                          ₹{(line.branch_values[b.id] || 0).toLocaleString()}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right text-rose-400">
                        {line.eliminations !== 0 ? `₹${line.eliminations.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-purple-300">
                        ₹{lineTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              <tr className="bg-purple-950/20 font-bold border-t border-b border-purple-500/30 font-sans">
                <td className="py-2.5 px-3 text-purple-300">TOTAL EQUITY & RESERVES</td>
                {branches.map((b) => (
                  <td key={b.id} className="py-2.5 px-3 text-right font-mono text-purple-300">
                    ₹{calculatedMatrix.branchTotals[b.id].equity.toLocaleString()}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">—</td>
                <td className="py-2.5 px-3 text-right font-mono text-purple-400 text-sm">
                  ₹{calculatedMatrix.totalConsolidatedEquity.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Consolidated Net Worth</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                ₹{calculatedMatrix.totalConsolidatedEquity.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Consolidated Gearing Ratio</span>
              <span className="font-mono font-bold text-slate-200">
                {liveLines.length > 0 && calculatedMatrix.totalConsolidatedEquity !== 0
                  ? `${((calculatedMatrix.totalConsolidatedLiabilities / calculatedMatrix.totalConsolidatedEquity) * 100).toFixed(1)}%`
                  : "Not available"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              Close
            </button>
            <button
              disabled
              title="Balance Sheet export is unavailable until the live ledger API is connected"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-slate-500 bg-slate-800 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span>Export Consolidated Statement</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsolidatedBalanceSheetModal;
