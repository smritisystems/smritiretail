/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.74.0
 * Created      : 2026-10-14
 * Modified     : 2026-10-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: UI Workspace / Cost Management & Cost Truth Engine
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  FileText,
  BarChart3,
  Layers,
  Scale,
  ShieldCheck,
  Search,
  ArrowRight,
  Percent,
} from "lucide-react";

interface CostTruthDashboardTabProps {
  currentUser?: any;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface DashboardKPIs {
  inventory_valuation: number;
  gl_inventory_balance: number;
  reconciliation_variance: number;
  reconciliation_status: string;
  period_gross_sales: number;
  period_cogs: number;
  period_gross_profit: number;
  period_gross_margin_pct: number;
  period_net_contribution: number;
  posted_invoices_audited: number;
  unallocated_landed_cost_amount: number;
  unallocated_landed_cost_count: number;
  blocked_itc_17_5_h_amount: number;
  zero_cost_skus_count: number;
  total_active_skus: number;
}

interface ReconciliationData {
  reconciliation_date: string;
  status: string;
  physical_stock_valuation: number;
  gl_account_1040_balance: number;
  variance: number;
  gl_debits_total: number;
  gl_credits_total: number;
  total_active_skus: number;
  total_physical_units: number;
  zero_cost_skus_count: number;
  is_audited: boolean;
}

const fmt = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${(n ?? 0).toFixed(1)}%`;

export const CostTruthDashboardTab: React.FC<CostTruthDashboardTabProps> = ({
  currentUser,
  onNotification,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    "overview" | "valuation" | "variance" | "landed" | "profitability" | "exceptions"
  >("overview");
  const [loading, setLoading] = useState<boolean>(false);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [recon, setRecon] = useState<ReconciliationData | null>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [recalculating, setRecalculating] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetchV1<{ status: string; data: DashboardKPIs }>("/cost/dashboard");
      if (res && res.data) {
        setKpis(res.data);
      }
      const reconRes = await apiFetchV1<{ status: string; data: ReconciliationData }>("/cost/reconciliation");
      if (reconRes && reconRes.data) {
        setRecon(reconRes.data);
      }
    } catch (err: any) {
      console.error("Failed to load Cost Truth KPIs:", err);
      if (onNotification) {
        onNotification("Cost Truth Error", err.message || "Failed to load Cost Truth metrics", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [onNotification]);

  const fetchSubReport = useCallback(async (tab: string, query?: string) => {
    setLoading(true);
    try {
      let endpoint = "";
      if (tab === "valuation") {
        endpoint = `/cost/reports/stock-valuation${query ? `?search=${encodeURIComponent(query)}` : ""}`;
      } else if (tab === "variance") {
        endpoint = "/cost/reports/purchase-variance";
      } else if (tab === "landed") {
        endpoint = "/cost/reports/landed-breakdown";
      } else if (tab === "profitability") {
        endpoint = "/cost/reports/cogs-profitability";
      } else if (tab === "exceptions") {
        endpoint = "/cost/reports/exceptions";
      }

      if (endpoint) {
        const res = await apiFetchV1<{ status: string; data: { items: any[] } }>(endpoint);
        setReportData(res?.data?.items || []);
      }
    } catch (err: any) {
      console.error("Failed to load report data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (activeSubTab !== "overview") {
      fetchSubReport(activeSubTab, searchQuery);
    }
  }, [activeSubTab, searchQuery, fetchSubReport]);

  const handleRecalculateWac = async () => {
    if (!window.confirm("Execute rolling WAC recalculation from stock movement history? This will calibrate current stock valuations without modifying historical invoices.")) {
      return;
    }
    setRecalculating(true);
    try {
      const res = await apiFetchV1<{ status: string; data: any }>("/cost/recalculate-wac-backfill", {
        method: "POST",
      });
      if (onNotification) {
        onNotification(
          "WAC Recalculation Complete",
          `Successfully updated ${res?.data?.valuations_updated || 0} product valuation records.`,
          "success"
        );
      }
      fetchDashboardData();
      if (activeSubTab === "valuation") {
        fetchSubReport("valuation", searchQuery);
      }
    } catch (err: any) {
      if (onNotification) {
        onNotification("Recalculation Failed", err.message || "Failed to recalculate WAC", "error");
      }
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Cost Management & Cost Truth Engine
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Double-Entry Ind AS 2
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritative Inventory Valuation, Landed Cost Breakdown, COGS Snapshots & General Ledger Reconciliation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRecalculateWac}
            disabled={recalculating}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculating..." : "Recalculate WAC Backfill"}
          </button>
          <button
            onClick={() => {
              fetchDashboardData();
              if (activeSubTab !== "overview") fetchSubReport(activeSubTab, searchQuery);
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Inventory Valuation */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Physical Stock Valuation</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {fmt(kpis?.inventory_valuation ?? 0)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <span>Active SKUs: {kpis?.total_active_skus ?? 0}</span>
            <span className="text-amber-400 font-mono">Zero-Cost: {kpis?.zero_cost_skus_count ?? 0}</span>
          </div>
        </div>

        {/* Card 2: Inventory to GL Reconciliation */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">GL Account 1040 Balance</span>
            <Scale className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {fmt(kpis?.gl_inventory_balance ?? 0)}
          </div>
          <div className="flex items-center justify-between text-xs mt-3 pt-3 border-t border-slate-800/80">
            <span className="text-slate-400">Reconciliation:</span>
            <span
              className={`font-semibold flex items-center gap-1 ${
                kpis?.reconciliation_status === "RECONCILED" ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {kpis?.reconciliation_status === "RECONCILED" ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" /> Reconciled (₹0.00 Drift)
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" /> Variance {fmt(kpis?.reconciliation_variance ?? 0)}
                </>
              )}
            </span>
          </div>
        </div>

        {/* Card 3: Period Sales COGS & Gross Profit */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sales Gross Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            {fmt(kpis?.period_gross_profit ?? 0)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <span>COGS: {fmt(kpis?.period_cogs ?? 0)}</span>
            <span className="font-semibold text-white">Margin: {pct(kpis?.period_gross_margin_pct ?? 0)}</span>
          </div>
        </div>

        {/* Card 4: Tax & Landed Charges Oversight */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Blocked ITC 17(5)(h)</span>
            <ShieldCheck className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 tracking-tight">
            {fmt(kpis?.blocked_itc_17_5_h_amount ?? 0)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <span>Unallocated Landed:</span>
            <span className="font-mono text-white">{fmt(kpis?.unallocated_landed_cost_amount ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 pb-2">
        {[
          { id: "overview", label: "Executive Overview & GL Meter", icon: BarChart3 },
          { id: "valuation", label: "Stock Valuation Matrix", icon: Layers },
          { id: "variance", label: "Purchase Price Variance", icon: Scale },
          { id: "landed", label: "Landed Cost Breakdown", icon: FileText },
          { id: "profitability", label: "COGS & Profitability Ledger", icon: TrendingUp },
          { id: "exceptions", label: "Cost Exceptions", icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sub-Tab 1: Executive Overview & Reconciliation Meter */}
      {activeSubTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Detailed Reconciliation Panel */}
          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-400" />
                Inventory-to-General-Ledger Reconciliation Ledger
              </h2>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                  recon?.status === "RECONCILED"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}
              >
                {recon?.status ?? "AUDITED"}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Validates physical stock balance sheet assets against authoritative General Ledger Account 1040 (Inventory Asset).
              Enforces zero financial drift between warehouse movements and double-entry books.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
                <span className="text-[11px] text-slate-400 font-semibold uppercase">Physical Valuation</span>
                <div className="text-lg font-bold text-white mt-1">
                  {fmt(recon?.physical_stock_valuation ?? 0)}
                </div>
                <span className="text-[11px] text-slate-500">∑ (Sound Qty × WAC)</span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
                <span className="text-[11px] text-slate-400 font-semibold uppercase">GL 1040 Balance</span>
                <div className="text-lg font-bold text-white mt-1">
                  {fmt(recon?.gl_account_1040_balance ?? 0)}
                </div>
                <span className="text-[11px] text-slate-500">Debits - Credits</span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
                <span className="text-[11px] text-slate-400 font-semibold uppercase">Variance Drift</span>
                <div
                  className={`text-lg font-bold mt-1 ${
                    (recon?.variance ?? 0) === 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {fmt(recon?.variance ?? 0)}
                </div>
                <span className="text-[11px] text-slate-500">Physical - GL</span>
              </div>
            </div>

            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Total Active Catalog SKUs:</span>
                <span className="font-semibold text-white">{recon?.total_active_skus ?? 0}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Total Physical Units in Warehouse:</span>
                <span className="font-semibold text-white">{recon?.total_physical_units ?? 0}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Zero-Cost SKUs Requiring Valuation:</span>
                <span className="font-semibold text-amber-400">{recon?.zero_cost_skus_count ?? 0}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Cumulative Inward Debits Posted (1040):</span>
                <span className="font-mono text-slate-300">{fmt(recon?.gl_debits_total ?? 0)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Cumulative COGS Credits Posted (1040):</span>
                <span className="font-mono text-slate-300">{fmt(recon?.gl_credits_total ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* Column 3: Policy & Statutory Summary */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Statutory Cost Rules Active
            </h3>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                  Valuation Method: Rolling WAC
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Governed by Ind AS 2 / AS 2. Recalculates dynamically upon GRN sound quantity intake.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                  GR/IR Clearing Account (1045)
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Receipts credit Unbilled GRN (1045); vendor commercial bills clear 1045, eliminating double-booking.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-rose-400" />
                  GST Section 17(5)(h) Protection
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Damaged/destroyed goods auto-block Input Tax Credit, preventing statutory tax penalties.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tabs 2-6: Report Grids */}
      {activeSubTab !== "overview" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white capitalize">
              {activeSubTab.replace("-", " ")} Report ({reportData.length} records)
            </h2>

            {activeSubTab === "valuation" && (
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by SKU or item name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Loading report records...
            </div>
          ) : reportData.length === 0 ? (
            <div className="text-center p-12 text-slate-500 text-xs">
              No records found for the current query.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  {activeSubTab === "valuation" && (
                    <tr>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Item Name</th>
                      <th className="p-3 text-right">Physical Stock</th>
                      <th className="p-3 text-right">Purchase Cost</th>
                      <th className="p-3 text-right">Landed Cost</th>
                      <th className="p-3 text-right">Rolling WAC</th>
                      <th className="p-3 text-right">Replacement Cost</th>
                      <th className="p-3 text-right">Total WAC Value</th>
                    </tr>
                  )}
                  {activeSubTab === "variance" && (
                    <tr>
                      <th className="p-3">Receipt No</th>
                      <th className="p-3">Item Name</th>
                      <th className="p-3">Supplier</th>
                      <th className="p-3 text-right">Received Qty</th>
                      <th className="p-3 text-right">GRN Rate</th>
                      <th className="p-3 text-right">PO Rate</th>
                      <th className="p-3 text-right">Variance</th>
                    </tr>
                  )}
                  {activeSubTab === "landed" && (
                    <tr>
                      <th className="p-3">Receipt No</th>
                      <th className="p-3">Component Type</th>
                      <th className="p-3">Transporter</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Basis Method</th>
                      <th className="p-3 text-right">Allocated Amount</th>
                      <th className="p-3 text-right">Per Unit Addon</th>
                    </tr>
                  )}
                  {activeSubTab === "profitability" && (
                    <tr>
                      <th className="p-3">Invoice No</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Gross Sales</th>
                      <th className="p-3 text-right">COGS</th>
                      <th className="p-3 text-right">Gross Profit</th>
                      <th className="p-3 text-right">Net Margin %</th>
                    </tr>
                  )}
                  {activeSubTab === "exceptions" && (
                    <tr>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-right">Stock</th>
                      <th className="p-3">Exception Type</th>
                      <th className="p-3">Severity</th>
                      <th className="p-3">Recommended Remediation</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      {activeSubTab === "valuation" && (
                        <>
                          <td className="p-3 font-mono text-blue-400">{row.sku}</td>
                          <td className="p-3 text-white font-medium">{row.name}</td>
                          <td className="p-3 text-right font-mono text-slate-300">{row.current_stock}</td>
                          <td className="p-3 text-right font-mono text-slate-300">{fmt(row.purchase_cost)}</td>
                          <td className="p-3 text-right font-mono text-slate-300">{fmt(row.landed_cost)}</td>
                          <td className="p-3 text-right font-mono text-emerald-400 font-semibold">{fmt(row.weighted_average_cost)}</td>
                          <td className="p-3 text-right font-mono text-slate-400">{fmt(row.replacement_cost)}</td>
                          <td className="p-3 text-right font-mono text-white font-bold">{fmt(row.stock_valuation_wac)}</td>
                        </>
                      )}
                      {activeSubTab === "variance" && (
                        <>
                          <td className="p-3 font-mono text-blue-400">{row.receipt_no}</td>
                          <td className="p-3 text-white font-medium">{row.item_name}</td>
                          <td className="p-3 text-slate-400">{row.supplier_name}</td>
                          <td className="p-3 text-right font-mono text-slate-300">{row.received_qty}</td>
                          <td className="p-3 text-right font-mono text-slate-300">{fmt(row.grn_cost_price)}</td>
                          <td className="p-3 text-right font-mono text-slate-400">{fmt(row.po_cost_price)}</td>
                          <td className={`p-3 text-right font-mono font-semibold ${row.variance_amount > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                            {fmt(row.variance_amount)} ({row.variance_pct}%)
                          </td>
                        </>
                      )}
                      {activeSubTab === "landed" && (
                        <>
                          <td className="p-3 font-mono text-blue-400">{row.receipt_no}</td>
                          <td className="p-3 text-white font-medium">{row.component_type}</td>
                          <td className="p-3 text-slate-400">{row.transporter}</td>
                          <td className="p-3 font-mono text-slate-300">{row.sku}</td>
                          <td className="p-3 text-slate-300">{row.product_name}</td>
                          <td className="p-3 font-mono text-slate-400">{row.allocation_method}</td>
                          <td className="p-3 text-right font-mono text-white font-semibold">{fmt(row.allocated_amount)}</td>
                          <td className="p-3 text-right font-mono text-emerald-400">{fmt(row.allocated_per_unit)}</td>
                        </>
                      )}
                      {activeSubTab === "profitability" && (
                        <>
                          <td className="p-3 font-mono text-blue-400">{row.invoice_no}</td>
                          <td className="p-3 text-slate-400">{row.date ? new Date(row.date).toLocaleDateString() : "-"}</td>
                          <td className="p-3 text-right font-mono text-white font-semibold">{fmt(row.gross_sales)}</td>
                          <td className="p-3 text-right font-mono text-slate-400">{fmt(row.cogs)}</td>
                          <td className="p-3 text-right font-mono text-emerald-400 font-bold">{fmt(row.gross_profit)}</td>
                          <td className="p-3 text-right font-mono text-slate-300">{row.net_margin_pct}%</td>
                        </>
                      )}
                      {activeSubTab === "exceptions" && (
                        <>
                          <td className="p-3 font-mono text-blue-400">{row.sku}</td>
                          <td className="p-3 text-white font-medium">{row.name}</td>
                          <td className="p-3 text-right font-mono text-amber-400 font-semibold">{row.stock}</td>
                          <td className="p-3 text-rose-400 font-mono text-[11px]">{row.exception_type}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              {row.severity}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">{row.recommended_action}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
