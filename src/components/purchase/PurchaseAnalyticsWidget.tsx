/**
 * Project      : SMRITI Retail OS
 * Component    : PurchaseAnalyticsWidget
 * Description  : Store-wide Purchase Intelligence Dashboard — Real-time metrics for
 *                Pending Approvals, Pending GRNs, Overdue POs, Top Vendors by spend,
 *                and live status subscription via SPK.events.
 * Standard     : SEDS Standard v1.0 — Zero Legacy Slate Tokens
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * Version      : 1.1.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  AlertTriangle,
  Building2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronRight,
  IndianRupee,
  BarChart3,
  CalendarClock,
  ArrowUpRight,
} from "lucide-react";
import { SPK } from "../../kernel/SPK.js";
import { IPurchaseService, PurchaseOrderRecord } from "../../kernel/public/IPurchaseService.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SupplierSpendSummary {
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
  receivedCount: number;
  cancelledCount: number;
  totalNetPayable: number;
  topSuppliers: SupplierSpendSummary[];
  recentPOs: PurchaseOrderRecord[];
}

interface PurchaseAnalyticsWidgetProps {
  onViewPO?: (poId: string) => void;
  onFilterStatus?: (status: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

function isOverdue(po: PurchaseOrderRecord): boolean {
  if (!po.expectedDeliveryDate) return false;
  if (po.status === "Received" || po.status === "Cancelled") return false;
  const today = new Date().toISOString().slice(0, 10);
  return po.expectedDeliveryDate < today;
}

function buildAnalytics(pos: PurchaseOrderRecord[]): PurchaseAnalyticsData {
  const today = new Date().toISOString().slice(0, 10);
  const supplierMap = new Map<string, { name: string; spend: number; count: number }>();

  let pendingApproval = 0;
  let pendingGRN = 0;
  let overdueDeliveries = 0;
  let receivedCount = 0;
  let cancelledCount = 0;
  let totalNetPayable = 0;

  pos.forEach((po) => {
    totalNetPayable += po.netPayable || 0;

    switch (po.status) {
      case "Draft":
      case "Submitted":
        pendingApproval++;
        break;
      case "Approved":
      case "Partial":
        pendingGRN++;
        break;
      case "Received":
        receivedCount++;
        break;
      case "Cancelled":
        cancelledCount++;
        break;
    }

    if (isOverdue(po)) {
      overdueDeliveries++;
    }

    if (po.status !== "Cancelled") {
      const key = po.supplierId || po.supplierName || "Unknown";
      const existing = supplierMap.get(key);
      if (existing) {
        existing.spend += po.netPayable || 0;
        existing.count += 1;
      } else {
        supplierMap.set(key, {
          name: po.supplierName || "Vendor",
          spend: po.netPayable || 0,
          count: 1,
        });
      }
    }
  });

  const topSuppliers: SupplierSpendSummary[] = Array.from(supplierMap.entries())
    .map(([supplierId, data]) => ({
      supplierId,
      supplierName: data.name,
      totalSpend: data.spend,
      poCount: data.count,
      avgOrderValue: data.count > 0 ? data.spend / data.count : 0,
    }))
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
    receivedCount,
    cancelledCount,
    totalNetPayable,
    topSuppliers,
    recentPOs,
  };
}

// ── Status Badge Component ───────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  Draft:     "bg-amber-500/10 text-amber-500 border-amber-500/20",
  Submitted: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Approved:  "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  Partial:   "bg-purple-500/10 text-purple-500 border-purple-500/20",
  Received:  "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${STATUS_STYLES[status] || "bg-theme-surface-2 text-theme-muted border-theme-divider"}`}>
      {status}
    </span>
  );
}

// ── Main Widget Component ────────────────────────────────────────────────────

export const PurchaseAnalyticsWidget: React.FC<PurchaseAnalyticsWidgetProps> = ({
  onViewPO,
  onFilterStatus,
}) => {
  const [pos, setPos] = useState<PurchaseOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchAllPOs = async () => {
    try {
      setIsLoading(true);
      const svc = SPK.services.resolve<IPurchaseService>("PURCHASE");
      const list = await svc.getAllPOs();
      setPos(list);
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn("[PurchaseAnalyticsWidget] Could not load POs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPOs();

    // Subscribe to live purchase events
    const unsub1 = SPK.events.on("PurchaseOrderCreated", () => fetchAllPOs());
    const unsub2 = SPK.events.on("PurchaseOrderUpdated", () => fetchAllPOs());
    const unsub3 = SPK.events.on("PurchaseOrderCancelled", () => fetchAllPOs());
    const unsub4 = SPK.events.on("GRNPosted", () => fetchAllPOs());

    return () => {
      unsub1?.();
      unsub2?.();
      unsub3?.();
      unsub4?.();
    };
  }, []);

  const analytics = useMemo(() => buildAnalytics(pos), [pos]);

  const metricCards = [
    {
      label: "Total POs",
      value: analytics.totalPOs,
      icon: ShoppingBag,
      color: "from-blue-500 to-blue-700",
      badge: null,
    },
    {
      label: "Pending Approval",
      value: analytics.pendingApproval,
      icon: Clock,
      color: "from-amber-500 to-amber-700",
      badge: analytics.pendingApproval > 0 ? `${analytics.pendingApproval} action needed` : null,
      filter: "Submitted",
    },
    {
      label: "Pending GRN",
      value: analytics.pendingGRN,
      icon: TrendingUp,
      color: "from-indigo-500 to-indigo-700",
      badge: null,
      filter: "Approved",
    },
    {
      label: "Overdue Deliveries",
      value: analytics.overdueDeliveries,
      icon: AlertTriangle,
      color: "from-rose-500 to-rose-700",
      badge: analytics.overdueDeliveries > 0 ? `${analytics.overdueDeliveries} overdue` : null,
      filter: "Overdue",
    },
    {
      label: "Fully Received",
      value: analytics.receivedCount,
      icon: CheckCircle2,
      color: "from-emerald-500 to-emerald-700",
      badge: null,
      filter: "Received",
    },
    {
      label: "Cancelled POs",
      value: analytics.cancelledCount,
      icon: XCircle,
      color: "from-gray-500 to-gray-700",
      badge: null,
      filter: "Cancelled",
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
      <div className="flex items-center justify-center py-16 text-theme-muted">
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
          <h2 className="font-bold text-theme-body text-base">Purchase Intelligence</h2>
          <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full border border-indigo-500/20 font-medium">AUD-004</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-theme-muted">
            Last refreshed {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={fetchAllPOs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-theme-surface-1 border border-theme-divider rounded-lg hover:bg-theme-surface-hover transition-colors text-theme-body cursor-pointer"
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
              onClick={() => card.filter && onFilterStatus?.(card.filter)}
              className={`relative bg-theme-surface-1 border border-theme-divider rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow overflow-hidden group ${
                card.filter ? "cursor-pointer" : ""
              }`}
            >
              <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.color} opacity-80`} />
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${card.color} text-white shadow-sm`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                {card.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded font-semibold leading-none">
                    {card.badge}
                  </span>
                )}
              </div>
              <div className="text-xl font-bold text-theme-body leading-none">{card.value}</div>
              <div className="text-[10px] text-theme-muted mt-1 font-medium">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Two-Column: Top Suppliers + Recent POs ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Suppliers by Spend */}
        <div className="bg-theme-surface-1 border border-theme-divider rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-theme-divider flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-500" />
              <h3 className="font-semibold text-sm text-theme-body">Top Suppliers by Spend</h3>
            </div>
            <span className="text-[10px] text-theme-muted">{analytics.topSuppliers.length} vendors</span>
          </div>
          <div className="divide-y divide-theme-divider">
            {analytics.topSuppliers.length === 0 ? (
              <div className="py-8 text-center text-theme-muted text-sm">No purchase history yet</div>
            ) : (
              analytics.topSuppliers.map((supplier, idx) => {
                const maxSpend = analytics.topSuppliers[0]?.totalSpend || 1;
                const pct = Math.round((supplier.totalSpend / maxSpend) * 100);
                return (
                  <div key={supplier.supplierId} className="px-4 py-3 hover:bg-theme-surface-hover transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-500 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-theme-body leading-none">{supplier.supplierName}</div>
                          <div className="text-[10px] text-theme-muted mt-0.5">{supplier.poCount} PO{supplier.poCount !== 1 ? "s" : ""} • Avg {formatINR(supplier.avgOrderValue)}</div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-violet-500">{formatINR(supplier.totalSpend)}</span>
                    </div>
                    <div className="mt-1.5 h-1 bg-theme-surface-2 rounded-full overflow-hidden">
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
        <div className="bg-theme-surface-1 border border-theme-divider rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-theme-divider flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-sm text-theme-body">Recent Purchase Orders</h3>
            </div>
            <span className="text-[10px] text-theme-muted">Last {Math.min(6, analytics.recentPOs.length)}</span>
          </div>
          <div className="divide-y divide-theme-divider">
            {analytics.recentPOs.length === 0 ? (
              <div className="py-8 text-center text-theme-muted text-sm">No purchase orders found</div>
            ) : (
              analytics.recentPOs.map((po) => (
                <div
                  key={po.id}
                  onClick={() => onViewPO?.(po.id)}
                  className={`px-4 py-3 transition-colors ${onViewPO ? "hover:bg-theme-surface-hover cursor-pointer" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-theme-body font-mono">{po.poNumber}</span>
                        {isOverdue(po) && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded font-bold">OVERDUE</span>
                        )}
                      </div>
                      <div className="text-[10px] text-theme-muted mt-0.5">
                        {po.supplierName} • {po.orderDate}
                        {po.expectedDeliveryDate && ` → ${po.expectedDeliveryDate}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs font-bold text-theme-body">{formatINR(po.netPayable)}</div>
                        <StatusBadge status={po.status} />
                      </div>
                      {onViewPO && <ChevronRight className="w-3.5 h-3.5 text-theme-muted flex-shrink-0" />}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ── Overdue PO Banner ───────────────────────────────────────────────── */}
      {analytics.overdueDeliveries > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-rose-500">
                {analytics.overdueDeliveries} Purchase Order{analytics.overdueDeliveries > 1 ? "s" : ""} past expected delivery date
              </div>
              <div className="text-[11px] text-theme-muted mt-0.5">
                Contact suppliers to request shipping status updates or reschedule PO delivery dates.
              </div>
            </div>
          </div>
          {onFilterStatus && (
            <button
              onClick={() => onFilterStatus("Overdue")}
              className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-600 bg-theme-surface-1 px-3 py-1.5 rounded-lg border border-rose-500/20 shadow-xs flex-shrink-0 cursor-pointer"
            >
              View Overdue <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PurchaseAnalyticsWidget;
