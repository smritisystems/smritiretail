/**
 * Project      : SMRITI Retail OS
 * Component    : PurchaseAnalyticsWidget
 * Description  : Store-wide Purchase Intelligence — Pending POs, Overdue Deliveries,
 *                Top Suppliers by Spend, GRN Pending, Recent Activity Feed.
 *                Subscribes to SPK.events for live updates (PurchaseOrderCreated,
 *                PurchaseOrderCancelled, GRNPosted).
 * Standard     : AUD-004 / GAP-5 — Purchase Analytics Dashboard
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  Package,
  Building2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronRight,
  TrendingDown,
  BarChart3,
  IndianRupee,
  CalendarClock,
} from "lucide-react";
import { SPK } from "../../kernel/SPK.js";
import { IPurchaseService, PurchaseOrderRecord } from "../../kernel/public/IPurchaseService.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SupplierSpend {
  supplierId: string;
  supplierName: string;
  totalSpend: number;
  poCount: number;
  avgOrderValue: number;
}

interface PurchaseAnalyticsData {
  totalPOs: number;
  pendingApproval: number;
  pendingGRN: number;
  overdueDeliveries: number;
  cancelled: number;
  received: number;
  totalNetPayable: number;
  topSuppliers: SupplierSpend[];
  recentPOs: PurchaseOrderRecord[];
}

interface PurchaseAnalyticsWidgetProps {
  onViewPO?: (poId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOverdue(po: PurchaseOrderRecord): boolean {
  if (!po.expectedDeliveryDate) return false;
  if (po.status === "Received" || po.status === "Cancelled") return false;
  return new Date(po.expectedDeliveryDate) < new Date();
}

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

function buildAnalytics(pos: PurchaseOrderRecord[]): PurchaseAnalyticsData {
  const supplierMap = new Map<string, SupplierSpend>();

  let pendingApproval = 0;
  let pendingGRN = 0;
  let overdueDeliveries = 0;
  let cancelled = 0;
  let received = 0;
  let totalNetPayable = 0;

  pos.forEach((po) => {
    totalNetPayable += po.netPayable || 0;

    if (po.status === "Draft" || po.status === "Submitted") pendingApproval++;
    if (po.status === "Approved" || po.status === "Partial") pendingGRN++;
    if (isOverdue(po)) overdueDeliveries++;
    if (po.status === "Cancelled") cancelled++;
    if (po.status === "Received") received++;

    const existing = supplierMap.get(po.supplierId);
    if (existing) {
      existing.totalSpend += po.netPayable || 0;
      existing.poCount++;
      existing.avgOrderValue = existing.totalSpend / existing.poCount;
    } else {
      supplierMap.set(po.supplierId, {
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        totalSpend: po.netPayable || 0,
        poCount: 1,
        avgOrderValue: po.netPayable || 0,
      });
    }
  });

  const topSuppliers = Array.from(supplierMap.values())
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 5);

  const recentPOs = [...pos]
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
    .slice(0, 6);

  return {
    totalPOs: pos.length,
    pendingApproval,
    pendingGRN,
    overdueDeliveries,
    cancelled,
    received,
    totalNetPayable,
    topSuppliers,
    recentPOs,
  };
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  Draft:     "bg-slate-100 text-slate-600 border-slate-200",
  Submitted: "bg-blue-50 text-blue-700 border-blue-200",
  Approved:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  Partial:   "bg-amber-50 text-amber-700 border-amber-200",
  Received:  "bg-green-50 text-green-700 border-green-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${STATUS_STYLES[status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {status}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const PurchaseAnalyticsWidget: React.FC<PurchaseAnalyticsWidgetProps> = ({ onViewPO }) => {
  const [allPOs, setAllPOs] = useState<PurchaseOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchAllPOs = async () => {
    try {
      setIsLoading(true);
      const svc = SPK.services.resolve<IPurchaseService>("PURCHASE");
      const pos = await svc.getAllPOs();
      setAllPOs(pos);
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn("[PurchaseAnalyticsWidget] Could not load POs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPOs();

    // Live update: subscribe to purchase domain events
    const unsubCreated   = SPK.events.on("PurchaseOrderCreated",   () => fetchAllPOs());
    const unsubUpdated   = SPK.events.on("PurchaseOrderUpdated",   () => fetchAllPOs());
    const unsubCancelled = SPK.events.on("PurchaseOrderCancelled", () => fetchAllPOs());
    const unsubGRN       = SPK.events.on("GRNPosted",              () => fetchAllPOs());

    return () => {
      unsubCreated?.();
      unsubUpdated?.();
      unsubCancelled?.();
      unsubGRN?.();
    };
  }, []);

  const analytics = useMemo(() => buildAnalytics(allPOs), [allPOs]);

  // ── Metric Cards ────────────────────────────────────────────────────────────

  const metricCards = [
    {
      label: "Total POs",
      value: analytics.totalPOs,
      icon: Package,
      color: "from-indigo-500 to-indigo-700",
      badge: null,
    },
    {
      label: "Pending Approval",
      value: analytics.pendingApproval,
      icon: Clock,
      color: "from-amber-500 to-amber-700",
      badge: analytics.pendingApproval > 0 ? "Needs Action" : null,
    },
    {
      label: "Pending GRN",
      value: analytics.pendingGRN,
      icon: TrendingUp,
      color: "from-blue-500 to-blue-700",
      badge: analytics.pendingGRN > 0 ? "Awaiting Goods" : null,
    },
    {
      label: "Overdue",
      value: analytics.overdueDeliveries,
      icon: AlertTriangle,
      color: analytics.overdueDeliveries > 0 ? "from-red-500 to-red-700" : "from-slate-400 to-slate-600",
      badge: analytics.overdueDeliveries > 0 ? "⚠ Urgent" : null,
    },
    {
      label: "Received",
      value: analytics.received,
      icon: CheckCircle2,
      color: "from-emerald-500 to-emerald-700",
      badge: null,
    },
    {
      label: "Cancelled",
      value: analytics.cancelled,
      icon: XCircle,
      color: "from-rose-500 to-rose-700",
      badge: null,
    },
    {
      label: "Total Committed",
      value: formatINR(analytics.totalNetPayable),
      icon: IndianRupee,
      color: "from-violet-500 to-violet-700",
      badge: null,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading purchase analytics…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-slate-800 text-base">Purchase Intelligence</h2>
          <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 font-medium">AUD-004</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">
            Last refreshed {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={fetchAllPOs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Metric Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="relative bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
            >
              {/* gradient accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.color} opacity-80`} />
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${card.color} text-white shadow-sm`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                {card.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded font-semibold leading-none">
                    {card.badge}
                  </span>
                )}
              </div>
              <div className="text-xl font-bold text-slate-800 leading-none">{card.value}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-medium">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Two-Column: Top Suppliers + Recent POs ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Suppliers by Spend */}
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-600" />
              <h3 className="font-semibold text-sm text-slate-700">Top Suppliers by Spend</h3>
            </div>
            <span className="text-[10px] text-slate-400">{analytics.topSuppliers.length} vendors</span>
          </div>
          <div className="divide-y divide-slate-50">
            {analytics.topSuppliers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">No purchase history yet</div>
            ) : (
              analytics.topSuppliers.map((supplier, idx) => {
                const maxSpend = analytics.topSuppliers[0]?.totalSpend || 1;
                const pct = Math.round((supplier.totalSpend / maxSpend) * 100);
                return (
                  <div key={supplier.supplierId} className="px-4 py-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-slate-700 leading-none">{supplier.supplierName}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{supplier.poCount} PO{supplier.poCount !== 1 ? "s" : ""} • Avg {formatINR(supplier.avgOrderValue)}</div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-violet-700">{formatINR(supplier.totalSpend)}</span>
                    </div>
                    <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent POs Feed */}
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-slate-700">Recent Purchase Orders</h3>
            </div>
            <span className="text-[10px] text-slate-400">Last {Math.min(6, analytics.recentPOs.length)}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {analytics.recentPOs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">No purchase orders found</div>
            ) : (
              analytics.recentPOs.map((po) => (
                <div
                  key={po.id}
                  onClick={() => onViewPO?.(po.id)}
                  className={`px-4 py-3 transition-colors ${onViewPO ? "hover:bg-slate-50/60 cursor-pointer" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700 font-mono">{po.poNumber}</span>
                        {isOverdue(po) && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded font-bold">OVERDUE</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {po.supplierName} • {po.orderDate}
                        {po.expectedDeliveryDate && ` → ${po.expectedDeliveryDate}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-700">{formatINR(po.netPayable)}</div>
                        <StatusBadge status={po.status} />
                      </div>
                      {onViewPO && <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Overdue Alert Banner ─────────────────────────────────────────────── */}
      {analytics.overdueDeliveries > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-700">
              {analytics.overdueDeliveries} Purchase Order{analytics.overdueDeliveries !== 1 ? "s" : ""} Overdue
            </div>
            <div className="text-xs text-red-500 mt-0.5">
              Expected delivery dates have passed. Contact suppliers or update delivery dates.
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-red-600 font-semibold">
            <span>Review</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseAnalyticsWidget;
