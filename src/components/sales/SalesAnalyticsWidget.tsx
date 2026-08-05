/**
 * Project      : SMRITI Retail OS
 * Component    : SalesAnalyticsWidget
 * Description  : Store-wide POS & Sales Intelligence Dashboard — Real-time revenue,
 *                invoice counts, AOV, GST tax collected, top selling SKUs, payment
 *                channel distribution (UPI, Cash, Card, Credit), and live sales feed.
 *                Subscribes to live SPK.events (InvoiceCreated, InvoiceCancelled).
 * Standard     : AUD-006 / GAP-4 — POS Sales Analytics Dashboard
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Receipt,
  IndianRupee,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronRight,
  BarChart3,
  PieChart,
  Users,
  Percent,
} from "lucide-react";
import { SPK } from "../../kernel/SPK.js";
import { ISalesService, SalesInvoiceRecord } from "../../kernel/public/ISalesService.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductSalesSummary {
  itemId: string;
  itemCode: string;
  itemName: string;
  totalQty: number;
  totalRevenue: number;
}

interface PaymentChannelSummary {
  channel: string;
  totalAmount: number;
  count: number;
  percentage: number;
}

interface SalesAnalyticsData {
  totalInvoices: number;
  paidInvoices: number;
  creditInvoices: number;
  cancelledInvoices: number;
  totalRevenue: number;
  totalTax: number;
  avgOrderValue: number;
  topProducts: ProductSalesSummary[];
  paymentChannels: PaymentChannelSummary[];
  recentInvoices: SalesInvoiceRecord[];
}

interface SalesAnalyticsWidgetProps {
  onViewInvoice?: (invoiceId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

function buildSalesAnalytics(invoices: SalesInvoiceRecord[]): SalesAnalyticsData {
  const productMap = new Map<string, ProductSalesSummary>();
  const paymentMap = new Map<string, { totalAmount: number; count: number }>();

  let paidInvoices = 0;
  let creditInvoices = 0;
  let cancelledInvoices = 0;
  let totalRevenue = 0;
  let totalTax = 0;

  invoices.forEach((inv) => {
    if (inv.status === "Cancelled") {
      cancelledInvoices++;
      return; // exclude revenue of cancelled bills
    }

    if (inv.status === "Credit") creditInvoices++;
    else paidInvoices++;

    totalRevenue += inv.netPayable || 0;
    totalTax += inv.taxTotal || 0;

    // Payment channel split
    const mode = inv.paymentMode || "Cash";
    const existingPayment = paymentMap.get(mode);
    if (existingPayment) {
      existingPayment.totalAmount += inv.netPayable || 0;
      existingPayment.count++;
    } else {
      paymentMap.set(mode, { totalAmount: inv.netPayable || 0, count: 1 });
    }

    // Line items aggregation
    (inv.lines || []).forEach((line) => {
      const key = line.itemId || line.itemCode;
      const existingProduct = productMap.get(key);
      if (existingProduct) {
        existingProduct.totalQty += line.qty || 1;
        existingProduct.totalRevenue += line.lineTotal || 0;
      } else {
        productMap.set(key, {
          itemId: key,
          itemCode: line.itemCode,
          itemName: line.itemName,
          totalQty: line.qty || 1,
          totalRevenue: line.lineTotal || 0,
        });
      }
    });
  });

  const validInvoiceCount = paidInvoices + creditInvoices;
  const avgOrderValue = validInvoiceCount > 0 ? totalRevenue / validInvoiceCount : 0;

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  const totalPaymentVol = totalRevenue || 1;
  const paymentChannels: PaymentChannelSummary[] = Array.from(paymentMap.entries())
    .map(([channel, data]) => ({
      channel,
      totalAmount: data.totalAmount,
      count: data.count,
      percentage: Math.round((data.totalAmount / totalPaymentVol) * 100),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const recentInvoices = [...invoices]
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
    .slice(0, 6);

  return {
    totalInvoices: invoices.length,
    paidInvoices,
    creditInvoices,
    cancelledInvoices,
    totalRevenue,
    totalTax,
    avgOrderValue,
    topProducts,
    paymentChannels,
    recentInvoices,
  };
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  Paid:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  Credit:    "bg-amber-50 text-amber-700 border-amber-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
  Refunded:  "bg-purple-50 text-purple-700 border-purple-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${STATUS_STYLES[status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {status}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const SalesAnalyticsWidget: React.FC<SalesAnalyticsWidgetProps> = ({ onViewInvoice }) => {
  const [invoices, setInvoices] = useState<SalesInvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const svc = SPK.services.resolve<ISalesService>("SALES");
      const list = await svc.getAllInvoices();
      setInvoices(list);
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn("[SalesAnalyticsWidget] Could not load sales invoices:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();

    // Live update: subscribe to sales domain events
    const unsubCreated   = SPK.events.on("InvoiceCreated",   () => fetchInvoices());
    const unsubCancelled = SPK.events.on("InvoiceCancelled", () => fetchInvoices());

    return () => {
      unsubCreated?.();
      unsubCancelled?.();
    };
  }, []);

  const analytics = useMemo(() => buildSalesAnalytics(invoices), [invoices]);

  const metricCards = [
    {
      label: "Total Sales Revenue",
      value: formatINR(analytics.totalRevenue),
      icon: IndianRupee,
      color: "from-emerald-500 to-emerald-700",
    },
    {
      label: "Invoices Generated",
      value: analytics.totalInvoices,
      icon: Receipt,
      color: "from-blue-500 to-blue-700",
    },
    {
      label: "Avg Order Value (AOV)",
      value: formatINR(analytics.avgOrderValue),
      icon: TrendingUp,
      color: "from-indigo-500 to-indigo-700",
    },
    {
      label: "GST Tax Collected",
      value: formatINR(analytics.totalTax),
      icon: Percent,
      color: "from-violet-500 to-violet-700",
    },
    {
      label: "Credit Liabilities",
      value: analytics.creditInvoices,
      icon: Users,
      color: "from-amber-500 to-amber-700",
    },
    {
      label: "Cancelled Bills",
      value: analytics.cancelledInvoices,
      icon: XCircle,
      color: "from-rose-500 to-rose-700",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading sales analytics…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          <h2 className="font-bold text-slate-800 text-base">POS & Sales Intelligence</h2>
          <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 font-medium">AUD-006</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">
            Last refreshed {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={fetchInvoices}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Metric Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="relative bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
            >
              <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.color} opacity-80`} />
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${card.color} text-white shadow-sm`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-800 leading-none">{card.value}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-medium">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Three Column Layout: Payment Split + Top Products + Recent Invoices ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Payment Channels */}
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-slate-700">Payment Modes</h3>
            </div>
            <span className="text-[10px] text-slate-400">{analytics.paymentChannels.length} channels</span>
          </div>
          <div className="p-4 space-y-3">
            {analytics.paymentChannels.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">No transactions yet</div>
            ) : (
              analytics.paymentChannels.map((item) => (
                <div key={item.channel}>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-slate-700">{item.channel}</span>
                    <span className="font-mono text-slate-600 font-bold">
                      {formatINR(item.totalAmount)} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-sm text-slate-700">Top Selling Products</h3>
            </div>
            <span className="text-[10px] text-slate-400">By Revenue</span>
          </div>
          <div className="divide-y divide-slate-50">
            {analytics.topProducts.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">No products sold yet</div>
            ) : (
              analytics.topProducts.map((prod, idx) => (
                <div key={prod.itemId} className="px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-slate-700">{prod.itemName}</div>
                        <div className="text-[10px] text-slate-400">{prod.totalQty} sold</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 font-mono">{formatINR(prod.totalRevenue)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Invoices Feed */}
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-sm text-slate-700">Recent Invoices</h3>
            </div>
            <span className="text-[10px] text-slate-400">Last {Math.min(6, analytics.recentInvoices.length)}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {analytics.recentInvoices.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">No sales invoices found</div>
            ) : (
              analytics.recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => onViewInvoice?.(inv.id)}
                  className={`px-4 py-2.5 transition-colors ${onViewInvoice ? "hover:bg-slate-50/60 cursor-pointer" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-700 font-mono">{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-400">{inv.customerName} • {inv.paymentMode}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-700 font-mono">{formatINR(inv.netPayable)}</div>
                        <StatusBadge status={inv.status} />
                      </div>
                      {onViewInvoice && <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SalesAnalyticsWidget;
