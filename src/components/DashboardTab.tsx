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
 * * Version    : 3.17.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  Line,
  LineChart,
} from "recharts";
import { apiFetch, apiFetchV1 } from "../lib/apiFetch.ts";
import { Product, Formula, PSVParty } from "../types";

import { DrillableLink } from "./drilldown/DrillableLink.tsx";
import { AboutSmritiWidget } from "./AboutSmritiWidget.tsx";
import { InventoryForecastWidget } from "./InventoryForecastWidget.tsx";
import { AuditActivityFeed } from "./AuditActivityFeed.tsx";
import { QuickReportsWidget } from "./QuickReportsWidget.tsx";

// Branded Custom Tooltip for Trend/Sales Performance
const TrendSalesTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const revenue = payload.find((p: any) => p.name === "Revenue (INR)")?.value;
    const invoices = payload.find((p: any) => p.name === "Invoice Count")?.value;
    
    const projRevenue = payload.find((p: any) => p.name === "Projected Revenue")?.value || 0;
    const projInvoices = payload.find((p: any) => p.name === "Projected Invoices")?.value || 0;

    const isForecastPoint = revenue === undefined || revenue === null || (label && label.includes("Fcst")) || payload[0]?.payload?.isForecast;

    const displayRevenue = isForecastPoint ? projRevenue : (revenue || 0);
    const displayInvoices = isForecastPoint ? projInvoices : (invoices || 0);

    const avgRevenue = displayInvoices > 0 ? Math.round(displayRevenue / displayInvoices) : 0;
    const estMargin = Math.round(displayRevenue * 0.72); // 72% Margin estimate

    return (
      <div className="bg-theme-surface-3 border border-[#2a3a5c] rounded-xl p-4 shadow-xl backdrop-blur-md min-w-[240px] text-xs font-sans">
        <div className="flex items-center justify-between border-b border-[#2a3a5c] pb-2 mb-2">
          <span className="font-semibold text-theme-body flex items-center">
            <span className="material-symbols-outlined text-[#2563EB] text-sm mr-1">calendar_today</span>
            {label}
          </span>
          <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
            isForecastPoint 
              ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          }`}>
            {isForecastPoint ? "Forecast" : "Actuals"}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-theme-muted flex items-center">
              <span className={`w-2 h-2 rounded-full ${isForecastPoint ? "bg-amber-500 animate-pulse" : "bg-emerald-500"} mr-1.5`}></span>
              {isForecastPoint ? "Projected Revenue" : "Revenue"}
            </span>
            <span className={`font-mono font-bold ${isForecastPoint ? "text-amber-400" : "text-emerald-400"}`}>
              ₹{Number(displayRevenue).toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-theme-muted flex items-center">
              <span className={`w-2 h-2 rounded-full ${isForecastPoint ? "bg-amber-500/55" : "bg-blue-500"} mr-1.5`}></span>
              {isForecastPoint ? "Projected Invoices" : "Invoices"}
            </span>
            <span className="font-mono font-bold text-theme-body">
              {displayInvoices}
            </span>
          </div>
          <div className="border-t border-[#2a3a5c]/50 my-1.5 pt-1.5 space-y-1 text-[11px] font-mono text-theme-muted">
            <div className="flex justify-between">
              <span>{isForecastPoint ? "Proj. Avg / Invoice:" : "Avg / Invoice:"}</span>
              <span className="text-theme-body font-semibold">₹{avgRevenue.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span>{isForecastPoint ? "Est. Proj. Profit (72%):" : "Est. Profit (72%):"}</span>
              <span className={`${isForecastPoint ? "text-amber-500/90" : "text-emerald-500/90"} font-semibold`}>
                ₹{estMargin.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-[#2a3a5c]/50 text-[10px] text-theme-muted font-mono flex items-center justify-between">
          <span>{isForecastPoint ? "SMRITI PROJECTION" : "SMRITI ENGINE"}</span>
          <span>v2.1.2</span>
        </div>
      </div>
    );
  }
  return null;
};

// Branded Custom Tooltip for Distributor Stock Allocations
const DistributorStockTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload as PSVParty;
    if (!data) return null;

    const stockCount = payload.find((p: any) => p.name === "Stock Units")?.value || data.stockCount || 0;
    const sellThrough = payload.find((p: any) => p.name === "Sell-Through %")?.value || data.sellThrough || 0;
    
    const statusColors = {
      Healthy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      Monitor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      Critical: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    };
    
    const statusColor = statusColors[data.status] || "bg-slate-500/10 text-slate-400 border-slate-500/20";

    return (
      <div className="bg-theme-surface-3 border border-[#2a3a5c] rounded-xl p-4 shadow-xl backdrop-blur-md min-w-[260px] text-xs font-sans">
        <div className="flex items-center justify-between border-b border-[#2a3a5c] pb-2 mb-2">
          <div className="flex flex-col">
            <span className="font-semibold text-theme-body flex items-center">
              <span className="material-symbols-outlined text-[#2563EB] text-sm mr-1">hub</span>
              {data.name}
            </span>
            <span className="text-[10px] text-theme-muted mt-0.5 flex items-center">
              <span className="material-symbols-outlined text-[10px] mr-0.5">location_on</span>
              {data.location}
            </span>
          </div>
          <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${statusColor}`}>
            {data.status}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-theme-muted flex items-center">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>
              Stock Units
            </span>
            <span className="font-mono font-bold text-theme-body">
              {stockCount} units
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-theme-muted flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
              Sell-Through
            </span>
            <span className="font-mono font-bold text-emerald-400">
              {sellThrough}%
            </span>
          </div>
          <div className="border-t border-[#2a3a5c]/50 my-1.5 pt-1.5 space-y-1 text-[11px] font-mono text-theme-muted">
            <div className="flex justify-between">
              <span>Weeks of Cover:</span>
              <span className="text-theme-body font-semibold">{data.weeksOfCover} weeks</span>
            </div>
            <div className="flex justify-between">
              <span>Capital Locked:</span>
              <span className="text-amber-400 font-semibold">₹{Number(data.capitalLocked).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-[#2a3a5c]/50 text-[10px] text-theme-muted font-mono flex items-center justify-between">
          <span>CHANNEL LEDGER</span>
          <span>PSV INTEGRATED</span>
        </div>
      </div>
    );
  }
  return null;
};

// Branded Custom Tooltip for 7-Day Sales Growth Trend
const SalesGrowthTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isGrowthPositive = data.growth >= 0;
    return (
      <div className="bg-theme-surface-3 border border-theme-divider rounded-xl p-4 shadow-xl backdrop-blur-md min-w-[220px] text-xs font-sans">
        <div className="flex items-center justify-between border-b border-theme-divider pb-2 mb-2">
          <span className="font-semibold text-theme-body flex items-center">
            <span className="material-symbols-outlined text-[#2563EB] text-sm mr-1">trending_up</span>
            {data.label}
          </span>
          <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
            isGrowthPositive 
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          }`}>
            {isGrowthPositive ? `+${data.growth}%` : `${data.growth}%`}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-theme-muted">Gross Sales:</span>
            <span className="font-mono font-bold text-theme-body">
              ₹{Number(data.sales).toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-theme-muted">Transactions:</span>
            <span className="font-mono font-bold text-theme-body">
              {data.transactions} bills
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-theme-muted pt-1 border-t border-theme-divider/50 font-mono">
            <span>Avg Ticket Size:</span>
            <span className="text-theme-body">
              ₹{Math.round(data.sales / data.transactions).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface DashboardTabProps {
  products: Product[];
  formulas: Formula[];
  psvParties: PSVParty[];
  onSelectFormula: (f: Formula) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  products,
  formulas,
  psvParties,
  onSelectFormula,
}) => {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [trendView, setTrendView] = useState<"weekly" | "hourly">("weekly");
  
  // Date Range Picker States (Default to the past 7 days, up to today)
  const [startDate, setStartDate] = useState<string>("2026-07-04");
  const [endDate, setEndDate] = useState<string>("2026-07-10");

  // Filter logs by date range selection
  const filteredAuditLogs = React.useMemo(() => {
    if (!Array.isArray(auditLogs)) return [];
    return auditLogs.filter(log => {
      try {
        if (!log.timestamp) return true;
        const logDate = new Date(log.timestamp);
        if (isNaN(logDate.getTime())) return true;
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return logDate >= start && logDate <= end;
      } catch {
        return true;
      }
    });
  }, [auditLogs, startDate, endDate]);

  // Compute scale factor dynamically based on days between selection (normalized to 7 days)
  const scaleFactor = React.useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1.0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(10, Math.max(0.1, diffDays / 7));
  }, [startDate, endDate]);

  // Real-time Hourly Sales Density Heatmap States
  const getInitialSlot = () => {
    const hr = new Date().getHours();
    if (hr < 11) return "09-11";
    if (hr < 13) return "11-13";
    if (hr < 15) return "13-15";
    if (hr < 17) return "15-17";
    if (hr < 19) return "17-19";
    return "19-21";
  };

  const [selectedCell, setSelectedCell] = useState<{ day: string; slot: string } | null>({
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] || "Fri",
    slot: getInitialSlot()
  });

  const baseHeatmap: Record<string, Record<string, { count: number; revenue: number }>> = {
    Mon: {
      "09-11": { count: 8, revenue: 14200 },
      "11-13": { count: 18, revenue: 29500 },
      "13-15": { count: 32, revenue: 54000 },
      "15-17": { count: 24, revenue: 39000 },
      "17-19": { count: 48, revenue: 82000 },
      "19-21": { count: 58, revenue: 98000 },
    },
    Tue: {
      "09-11": { count: 12, revenue: 19800 },
      "11-13": { count: 22, revenue: 34000 },
      "13-15": { count: 28, revenue: 49000 },
      "15-17": { count: 19, revenue: 31000 },
      "17-19": { count: 52, revenue: 89000 },
      "19-21": { count: 64, revenue: 112000 },
    },
    Wed: {
      "09-11": { count: 9, revenue: 15400 },
      "11-13": { count: 25, revenue: 41000 },
      "13-15": { count: 35, revenue: 59000 },
      "15-17": { count: 22, revenue: 35000 },
      "17-19": { count: 45, revenue: 78000 },
      "19-21": { count: 61, revenue: 104000 },
    },
    Thu: {
      "09-11": { count: 14, revenue: 21000 },
      "11-13": { count: 20, revenue: 32000 },
      "13-15": { count: 30, revenue: 51000 },
      "15-17": { count: 26, revenue: 42000 },
      "17-19": { count: 49, revenue: 84000 },
      "19-21": { count: 55, revenue: 91000 },
    },
    Fri: {
      "09-11": { count: 16, revenue: 26000 },
      "11-13": { count: 31, revenue: 52000 },
      "13-15": { count: 44, revenue: 74000 },
      "15-17": { count: 38, revenue: 61000 },
      "17-19": { count: 72, revenue: 128000 },
      "19-21": { count: 85, revenue: 156000 },
    },
    Sat: {
      "09-11": { count: 25, revenue: 42000 },
      "11-13": { count: 45, revenue: 78000 },
      "13-15": { count: 68, revenue: 119000 },
      "15-17": { count: 54, revenue: 92000 },
      "17-19": { count: 92, revenue: 174000 },
      "19-21": { count: 108, revenue: 215000 },
    },
    Sun: {
      "09-11": { count: 22, revenue: 36000 },
      "11-13": { count: 40, revenue: 69000 },
      "13-15": { count: 74, revenue: 132000 },
      "15-17": { count: 58, revenue: 99000 },
      "17-19": { count: 88, revenue: 163000 },
      "19-21": { count: 96, revenue: 189000 },
    }
  };

  // Compile Heatmap Data live from filtered active Audit Logs (Invoice Created)
  const compiledHeatmap = React.useMemo(() => {
    // Clone base data
    const res: Record<string, Record<string, { count: number; revenue: number }>> = JSON.parse(JSON.stringify(baseHeatmap));
    
    // Scale baseline counts and revenues by scaleFactor to keep chart metrics dynamic!
    Object.keys(res).forEach(day => {
      Object.keys(res[day]).forEach(slot => {
        res[day][slot].count = Math.round(res[day][slot].count * scaleFactor);
        res[day][slot].revenue = Math.round(res[day][slot].revenue * scaleFactor);
      });
    });

    // Scan dynamic logs within the filtered date range
    const invoiceLogs = filteredAuditLogs.filter(log => log.action === "Invoice Created");
    invoiceLogs.forEach(log => {
      try {
        const d = new Date(log.timestamp);
        if (isNaN(d.getTime())) return;
        
        const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayLabel = daysMap[d.getDay()];
        const hour = d.getHours();
        
        let slotLabel = "09-11";
        if (hour >= 9 && hour < 11) slotLabel = "09-11";
        else if (hour >= 11 && hour < 13) slotLabel = "11-13";
        else if (hour >= 13 && hour < 15) slotLabel = "13-15";
        else if (hour >= 15 && hour < 17) slotLabel = "15-17";
        else if (hour >= 17 && hour < 19) slotLabel = "17-19";
        else if (hour >= 19 && hour < 21) slotLabel = "19-21";
        else if (hour < 9) slotLabel = "09-11"; // clamped
        else slotLabel = "19-21"; // clamped
        
        // Extract revenue
        const match = log.after.match(/Total Sales: (\d+) INR/);
        const amt = match ? parseInt(match[1]) : 0;
        
        if (res[dayLabel] && res[dayLabel][slotLabel]) {
          res[dayLabel][slotLabel].count += 1;
          res[dayLabel][slotLabel].revenue += amt || 12000; // fallback default
        }
      } catch (err) {
        console.error("Error compiling heatmap row", err);
      }
    });
    
    return res;
  }, [filteredAuditLogs, scaleFactor]);

  const getCellInsights = (day: string, slot: string) => {
    const data = compiledHeatmap[day]?.[slot] || { count: 0, revenue: 0 };
    const timeLabel = {
      "09-11": "09:00 AM - 11:00 AM (Early Shift)",
      "11-13": "11:00 AM - 01:00 PM (Morning Rush)",
      "13-15": "01:00 PM - 03:00 PM (Mid-Day & Lunch)",
      "15-17": "03:00 PM - 05:00 PM (Afternoon Dip)",
      "17-19": "05:00 PM - 07:00 PM (Evening Surge)",
      "19-21": "07:00 PM - 09:00 PM (Peak Outlet Traffic)"
    }[slot] || slot;

    let recommendation = "";
    let staffing = "";
    let risk = "";

    if (data.count > 70) {
      staffing = "Critical Peak (4-5 Cashiers + 3 Floor Execs)";
      recommendation = "Enable express checkout lines & run targeted flash offers on seasonal apparel.";
      risk = "High risk of queue bottlenecks. Ensure power backups and secondary terminals are online.";
    } else if (data.count > 40) {
      staffing = "High Load (3 Cashiers + 2 Floor Execs)";
      recommendation = "Deploy front-facing staff to support self-checkout and run item master audits.";
      risk = "Moderate queue build-up expected. Check billing paper and scanner diagnostics.";
    } else if (data.count > 20) {
      staffing = "Moderate Load (2 Cashiers + 1 Floor Exec)";
      recommendation = "Execute shelf-replenishment, scan stock check-in logs, and clear purchase queues.";
      risk = "Standard operational thresholds. Low risk of delay.";
    } else {
      staffing = "Minimal Load (1 Cashier)";
      recommendation = "Perfect window for staff training, high-value asset inventory counts, and TallyPrime reconciliations.";
      risk = "Idle capacity. Consider reducing lighting or HVAC levels to optimize utility overhead.";
    }

    return {
      timeLabel,
      count: data.count,
      revenue: data.revenue,
      staffing,
      recommendation,
      risk
    };
  };

  const [chatMessage, setChatMessage] = useState("");
  const [chatReplies, setChatReplies] = useState<
    { sender: "user" | "ai"; text: string }[]
  >([
    {
      sender: "ai",
      text: "Hello! I am your SMRITI Operational Intelligence assistant. Ask me anything about your stock velocity, Weeks of Cover, or how to resolve dead capital issues.",
    },
  ]);
  const [isSending, setIsSending] = useState(false);

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    try {
      const data = await apiFetchV1("/audit-logs");
      const logsData = Array.isArray(data) ? data : data?.logs || [];
      setAuditLogs(logsData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    const interval = setInterval(fetchAuditLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Send AI message
  const handleSendMessage = async (msgText?: string) => {
    const textToSend = msgText || chatMessage;
    if (!textToSend.trim() || isSending) return;

    if (!msgText) setChatMessage("");

    setChatReplies((prev) => [...prev, { sender: "user", text: textToSend }]);
    setIsSending(true);

    try {
      const data = await apiFetchV1("/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: textToSend,
          context: {
            stockStatus: products.map((p) => ({
              code: p.code,
              name: p.name,
              stock: p.stock,
            })),
            distributors: psvParties.map((p) => ({
              name: p.name,
              stock: p.stockCount,
              status: p.status,
            })),
          },
        }),
      });
      setChatReplies((prev) => [...prev, { sender: "ai", text: data.reply }]);
    } catch (error) {
      setChatReplies((prev) => [
        ...prev,
        { sender: "ai", text: "Error connecting to server-side AI reasoning." },
      ]);
    } finally {
      setIsSending(false);
      fetchAuditLogs();
    }
  };

  // Pre-calculated Dashboard Metrics
  const totalLiveSales = filteredAuditLogs
    .filter((log) => log.action === "Invoice Created")
    .reduce((sum, log) => {
      const match = log.after.match(/Total Sales: (\d+) INR/);
      return match ? parseInt(match[1]) : sum;
    }, Math.round(9895 * scaleFactor));

  const totalCapitalLocked = psvParties.reduce(
    (sum, p) => sum + p.capitalLocked,
    0,
  );
  const deadStockPercent = 24.5; // Fixed mockup calculation representing items with zero 30d sales

  // Format INR Currencies
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const lowStockCount = products.filter((p) => p.stock < 15).length;
  const dailyRevenue = totalLiveSales + Math.round(125000 * scaleFactor);
  const totalSalesUnits = Math.round(1450 * scaleFactor) + (filteredAuditLogs.filter((log) => log.action === "Invoice Created").length * 5); // Approximate units sold within selection

  // Real-time Trend Calculations
  const invoicesCount = filteredAuditLogs.filter((log) => log.action === "Invoice Created").length;
  
  const weeklyData = React.useMemo(() => {
    const raw = [
      { label: "Mon", revenue: Math.round(135000 * scaleFactor), invoices: Math.round(12 * scaleFactor), isForecast: false },
      { label: "Tue", revenue: Math.round(148000 * scaleFactor), invoices: Math.round(15 * scaleFactor), isForecast: false },
      { label: "Wed", revenue: Math.round(162000 * scaleFactor), invoices: Math.round(18 * scaleFactor), isForecast: false },
      { label: "Thu", revenue: Math.round(155000 * scaleFactor), invoices: Math.round(14 * scaleFactor), isForecast: false },
      { label: "Fri (Today)", revenue: Math.round(125000 * scaleFactor) + totalLiveSales, invoices: Math.round(10 * scaleFactor) + invoicesCount, isForecast: false },
      { label: "Sat (Fcst)", revenue: Math.round(170000 * scaleFactor), invoices: Math.round(20 * scaleFactor), isForecast: true },
      { label: "Sun (Fcst)", revenue: Math.round(185000 * scaleFactor), invoices: Math.round(22 * scaleFactor), isForecast: true },
    ];

    const historical = raw.filter(r => !r.isForecast);
    const n = historical.length;
    let slopeRev = 0, interceptRev = 0;
    let slopeInv = 0, interceptInv = 0;

    if (n > 1) {
      let sumX = 0, sumYRev = 0, sumYInv = 0, sumXYRev = 0, sumXYInv = 0, sumXX = 0;
      historical.forEach((d, idx) => {
        sumX += idx;
        sumYRev += d.revenue;
        sumYInv += d.invoices;
        sumXYRev += idx * d.revenue;
        sumXYInv += idx * d.invoices;
        sumXX += idx * idx;
      });
      const denom = n * sumXX - sumX * sumX;
      if (denom !== 0) {
        slopeRev = (n * sumXYRev - sumX * sumYRev) / denom;
        interceptRev = (sumYRev - slopeRev * sumX) / n;
        slopeInv = (n * sumXYInv - sumX * sumYInv) / denom;
        interceptInv = (sumYInv - slopeInv * sumX) / n;
      }
    }

    return raw.map((d, idx) => {
      const trendRev = Math.max(0, Math.round(slopeRev * idx + interceptRev));
      const trendInv = Math.max(0, Math.round(slopeInv * idx + interceptInv));
      return {
        ...d,
        revenue: d.isForecast ? null : d.revenue,
        invoices: d.isForecast ? null : d.invoices,
        projectedRevenue: trendRev,
        projectedInvoices: trendInv,
      };
    });
  }, [scaleFactor, totalLiveSales, invoicesCount]);

  const hourlyData = React.useMemo(() => {
    const raw = [
      { label: "09:00 AM", revenue: Math.round(12000 * scaleFactor), invoices: Math.round(1 * scaleFactor), isForecast: false },
      { label: "11:00 AM", revenue: Math.round(24000 * scaleFactor), invoices: Math.round(2 * scaleFactor), isForecast: false },
      { label: "01:00 PM", revenue: Math.round(38000 * scaleFactor) + Math.round(totalLiveSales * 0.3), invoices: Math.round(2 * scaleFactor) + (invoicesCount > 0 ? 1 : 0), isForecast: false },
      { label: "03:00 PM", revenue: Math.round(45000 * scaleFactor) + Math.round(totalLiveSales * 0.4), invoices: Math.round(3 * scaleFactor) + (invoicesCount > 1 ? 1 : 0), isForecast: false },
      { label: "05:00 PM", revenue: Math.round(18000 * scaleFactor) + Math.round(totalLiveSales * 0.3), invoices: Math.round(1 * scaleFactor) + (invoicesCount > 2 ? invoicesCount - 2 : 0), isForecast: false },
      { label: "07:00 PM", revenue: Math.round(10000 * scaleFactor), invoices: Math.round(1 * scaleFactor), isForecast: true },
      { label: "09:00 PM", revenue: Math.round(5000 * scaleFactor), invoices: Math.round(0.5 * scaleFactor), isForecast: true },
    ];

    const historical = raw.filter(r => !r.isForecast);
    const n = historical.length;
    let slopeRev = 0, interceptRev = 0;
    let slopeInv = 0, interceptInv = 0;

    if (n > 1) {
      let sumX = 0, sumYRev = 0, sumYInv = 0, sumXYRev = 0, sumXYInv = 0, sumXX = 0;
      historical.forEach((d, idx) => {
        sumX += idx;
        sumYRev += d.revenue;
        sumYInv += d.invoices;
        sumXYRev += idx * d.revenue;
        sumXYInv += idx * d.invoices;
        sumXX += idx * idx;
      });
      const denom = n * sumXX - sumX * sumX;
      if (denom !== 0) {
        slopeRev = (n * sumXYRev - sumX * sumYRev) / denom;
        interceptRev = (sumYRev - slopeRev * sumX) / n;
        slopeInv = (n * sumXYInv - sumX * sumYInv) / denom;
        interceptInv = (sumYInv - slopeInv * sumX) / n;
      }
    }

    return raw.map((d, idx) => {
      const trendRev = Math.max(0, Math.round(slopeRev * idx + interceptRev));
      const trendInv = Math.max(0, Math.round(slopeInv * idx + interceptInv));
      return {
        ...d,
        revenue: d.isForecast ? null : d.revenue,
        invoices: d.isForecast ? null : d.invoices,
        projectedRevenue: trendRev,
        projectedInvoices: trendInv,
      };
    });
  }, [scaleFactor, totalLiveSales, invoicesCount]);

  const salesGrowth7Days = React.useMemo(() => {
    const data = [];
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const baseSales = [112000, 125000, 138000, 129000, 145000, 156000, 168000];
    const today = new Date("2026-07-11");
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateString = d.toISOString().split("T")[0];
      const label = `${daysOfWeek[d.getDay()]} (${d.getMonth() + 1}/${d.getDate()})`;
      
      const daySales = auditLogs
        .filter(log => {
          if (log.action !== "Invoice Created" || !log.timestamp) return false;
          const logDate = new Date(log.timestamp).toISOString().split("T")[0];
          return logDate === dateString;
        })
        .reduce((sum, log) => {
          const match = log.after.match(/Total Sales: (\d+) INR/);
          return match ? sum + parseInt(match[1]) : sum;
        }, 0);
        
      const baseVal = baseSales[6 - i] * scaleFactor;
      const totalSales = Math.round(baseVal + daySales);
      
      const prevVal = baseSales[Math.max(0, 5 - i)] * scaleFactor;
      const growthPct = prevVal > 0 ? ((totalSales - prevVal) / prevVal) * 100 : 0;

      data.push({
        date: dateString,
        label,
        sales: totalSales,
        growth: parseFloat(growthPct.toFixed(1)),
        transactions: Math.round((12 + (6 - i) * 2) * scaleFactor),
      });
    }
    return data;
  }, [auditLogs, scaleFactor]);

  const trendData = trendView === "weekly" ? weeklyData : hourlyData;

  return (
    <div className="space-y-6">
      {/* Date Range Picker Controls Bar */}
      <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-[#2563EB]">calendar_month</span>
            <h3 className="font-display font-semibold text-base text-theme-body">
              Temporal Operational Scope
            </h3>
          </div>
          <p className="text-xs text-theme-muted">
            Configure target timeframe to sync trends, velocity metrics, and sales density.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Presets */}
          <div className="flex bg-theme-surface-2 rounded-lg p-0.5 border border-theme-divider text-xs">
            {[
              { label: "Today", start: "2026-07-10", end: "2026-07-10" },
              { label: "Yesterday", start: "2026-07-09", end: "2026-07-09" },
              { label: "Last 7 Days", start: "2026-07-04", end: "2026-07-10" },
              { label: "Last 30 Days", start: "2026-06-11", end: "2026-07-10" },
            ].map((p) => {
              const isActive = startDate === p.start && endDate === p.end;
              return (
                <button
                  key={p.label}
                  onClick={() => {
                    setStartDate(p.start);
                    setEndDate(p.end);
                  }}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "text-theme-muted hover:text-theme-body"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Picker Inputs */}
          <div className="flex items-center space-x-2 bg-theme-surface-2 px-3 py-1.5 rounded-lg border border-theme-divider">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] uppercase font-mono text-theme-muted">Start</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-mono text-theme-body focus:outline-none border-none cursor-pointer [color-scheme:dark]"
              />
            </div>
            <span className="text-theme-muted text-xs font-mono">→</span>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] uppercase font-mono text-theme-muted">End</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="bg-transparent text-xs font-mono text-theme-body focus:outline-none border-none cursor-pointer [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Scale Indicator */}
          <div className="text-[11px] font-mono bg-theme-surface-3 border border-theme-divider px-3 py-2 rounded-lg flex items-center space-x-2 text-theme-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Scale: <strong className="text-theme-body">{(scaleFactor * 7).toFixed(0)} days</strong> ({scaleFactor.toFixed(2)}x modifier)</span>
          </div>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider relative group hover:border-[#2563EB] transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-theme-muted uppercase font-display">
              Outlet Health Score
            </span>
            <button
              onClick={() => {
                const f = formulas.find((f) => f.id === "for-3");
                if (f) onSelectFormula(f);
              }}
              className="text-theme-muted hover:text-[#2563EB] flex items-center space-x-0.5"
            >
              <span className="material-symbols-outlined text-sm">info</span>
              <span className="text-xs font-medium">Explain</span>
            </button>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-display text-emerald-400">
              <DrillableLink context={{ entityType: "kpi", entityId: "HEALTH-89", title: "Outlet Health Score Details" }}>
                89%
              </DrillableLink>
            </span>
            <span className="text-xs text-emerald-400 flex items-center font-semibold">
              <span className="material-symbols-outlined text-sm mr-1">
                trending_up
              </span>
              +1.2%
            </span>
          </div>
          <p className="mt-2 text-xs text-theme-muted">
            Operational Safety & Accuracy
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider relative group hover:border-[#2563EB] transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-theme-muted uppercase font-display">
              Weeks of Cover
            </span>
            <button
              onClick={() => {
                const f = formulas.find((f) => f.id === "for-1");
                if (f) onSelectFormula(f);
              }}
              className="text-theme-muted hover:text-[#2563EB] flex items-center space-x-0.5"
            >
              <span className="material-symbols-outlined text-sm">info</span>
              <span className="text-xs font-medium">Explain</span>
            </button>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-display text-theme-body">
              <DrillableLink context={{ entityType: "kpi", entityId: "WOC-5", title: "Weeks of Cover Analytics" }}>
                5.0 W
              </DrillableLink>
            </span>
            <span className="text-xs text-amber-500 font-semibold">
              Trigger Range
            </span>
          </div>
          <p className="mt-2 text-xs text-theme-muted">
            Average inventory runway
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider relative group hover:border-[#2563EB] transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-theme-muted uppercase font-display">
              Dead Stock %
            </span>
            <button
              onClick={() => {
                const f = formulas.find((f) => f.id === "for-2");
                if (f) onSelectFormula(f);
              }}
              className="text-theme-muted hover:text-[#2563EB] flex items-center space-x-0.5"
            >
              <span className="material-symbols-outlined text-sm">info</span>
              <span className="text-xs font-medium">Explain</span>
            </button>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-display text-rose-500">
              <DrillableLink context={{ entityType: "report", entityId: "REP-DEAD-STOCK", title: "Dead Stock Report" }}>
                {deadStockPercent}%
              </DrillableLink>
            </span>
            <span className="text-xs text-rose-400 flex items-center font-semibold">
              <span className="material-symbols-outlined text-sm mr-1">
                warning
              </span>
              Critical
            </span>
          </div>
          <p className="mt-2 text-xs text-theme-muted">
            Unsold in past 30 days
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider relative group hover:border-[#2563EB] transition-all">
          <span className="text-xs font-semibold text-theme-muted uppercase font-display block">
            Live Sales Value
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-display text-blue-400">
              {formatCurrency(totalLiveSales)}
            </span>
            <span className="text-xs text-emerald-400 font-semibold">
              Active Shift
            </span>
          </div>
          <p className="mt-2 text-xs text-theme-muted">
            Aggregated shift totals
          </p>
        </div>

        {/* Metric 5 */}
        <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider relative group hover:border-[#2563EB] transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-theme-muted uppercase font-display">
              Channel Capital
            </span>
            <button
              onClick={() => {
                const f = formulas.find((f) => f.id === "for-4");
                if (f) onSelectFormula(f);
              }}
              className="text-theme-muted hover:text-[#2563EB] flex items-center space-x-0.5"
            >
              <span className="material-symbols-outlined text-sm">info</span>
              <span className="text-xs font-medium">Explain</span>
            </button>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-display text-theme-body">
              {formatCurrency(totalCapitalLocked)}
            </span>
            <span className="text-xs text-rose-400 font-semibold">
              Locked in PSV
            </span>
          </div>
          <p className="mt-2 text-xs text-theme-muted">
            Downstream partner stock
          </p>
        </div>

        {/* Metric 6: Daily Revenue */}
        <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider relative group hover:border-[#2563EB] transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-theme-muted uppercase font-display">
              Daily Revenue
            </span>
            <span className="material-symbols-outlined text-sm text-theme-muted">
              payments
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-display text-emerald-400">
              {formatCurrency(dailyRevenue)}
            </span>
            <span className="text-xs text-emerald-400 flex items-center font-semibold">
              <span className="material-symbols-outlined text-sm mr-1">
                trending_up
              </span>
              +12%
            </span>
          </div>
          <p className="mt-2 text-xs text-theme-muted">Today's total revenue</p>
        </div>

        {/* Metric 7: Total Sales */}
        <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider relative group hover:border-[#2563EB] transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-theme-muted uppercase font-display">
              Total Sales
            </span>
            <span className="material-symbols-outlined text-sm text-theme-muted">
              shopping_bag
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-display text-blue-400">
              {totalSalesUnits}
            </span>
            <span className="text-xs text-blue-400 flex items-center font-semibold">
              Units
            </span>
          </div>
          <p className="mt-2 text-xs text-theme-muted">Products sold today</p>
        </div>

        {/* Metric 8: Low-Stock Items */}
        <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider relative group hover:border-[#2563EB] transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-theme-muted uppercase font-display">
              Low-Stock Items
            </span>
            <span className="material-symbols-outlined text-sm text-theme-muted">
              inventory_2
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-display text-rose-500">
              {lowStockCount}
            </span>
            <span className="text-xs text-rose-400 flex items-center font-semibold">
              <span className="material-symbols-outlined text-sm mr-1">
                warning
              </span>
              Action req.
            </span>
          </div>
          <p className="mt-2 text-xs text-theme-muted">
            Items below safety stock
          </p>
        </div>
      </div>

      {/* Main Grid: Visuals and AI Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Visual Distributor Chart */}
        <div className="lg:col-span-2 space-y-6">
          {/* KPI Trend: Last 7 Days Sales Growth Widget */}
          <div className="bg-theme-surface-1 rounded-xl p-6 border border-theme-divider shadow-lg" id="kpi-sales-growth-trend-widget">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="material-symbols-outlined text-[#2563EB]">
                    show_chart
                  </span>
                  <h3 className="font-display font-semibold text-lg text-theme-body">
                    7-Day Sales Growth & Revenue Velocity
                  </h3>
                </div>
                <p className="text-xs text-theme-muted mt-1">
                  Rolling 7-day performance curve with daily transactional increments
                </p>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse"></span>
                <span className="text-theme-muted">Model: SMRITI Velocity</span>
              </div>
            </div>

            {/* Quick Metrics Bar inside Widget */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-theme-surface-3 rounded-lg border border-theme-divider">
              <div>
                <div className="text-[10px] text-theme-muted uppercase font-mono tracking-wider">Total 7D Revenue</div>
                <div className="text-base font-bold text-theme-body font-mono mt-0.5">
                  ₹{salesGrowth7Days.reduce((sum, d) => sum + d.sales, 0).toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-theme-muted uppercase font-mono tracking-wider">Daily Average</div>
                <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                  ₹{Math.round(salesGrowth7Days.reduce((sum, d) => sum + d.sales, 0) / 7).toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-theme-muted uppercase font-mono tracking-wider">7D Growth Rate</div>
                <div className="text-base font-bold text-blue-400 font-mono mt-0.5">
                  +{(() => {
                    const first = salesGrowth7Days[0]?.sales || 1;
                    const last = salesGrowth7Days[6]?.sales || 1;
                    return (((last - first) / first) * 100).toFixed(1);
                  })()}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-theme-muted uppercase font-mono tracking-wider">Peak Sales Day</div>
                <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                  {(() => {
                    const peak = [...salesGrowth7Days].sort((a, b) => b.sales - a.sales)[0];
                    return peak ? peak.label.split(" ")[0] : "N/A";
                  })()}
                </div>
              </div>
            </div>

            {/* Visual Recharts Area Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={salesGrowth7Days}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSales7D" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3a5c" opacity={0.25} />
                  <XAxis
                    dataKey="label"
                    stroke="#8892a4"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#8892a4"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<SalesGrowthTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSales7D)"
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    name="Daily Sales (INR)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 pt-3 border-t border-[#2a3a5c]/40 flex justify-between items-center text-[10px] font-mono text-theme-muted">
              <span>SMRITI AUTOMATED AGGREGATIONS</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Checkout Stream Active
              </span>
            </div>
          </div>

          <div className="bg-theme-surface-1 rounded-xl p-6 border border-theme-divider">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display font-semibold text-lg text-theme-body">
                Distributor Stock Allocations
              </h3>
              <span className="text-xs text-theme-muted font-mono">
                Channel Ledger (PSV)
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={psvParties}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3a5c" />
                  <XAxis
                    dataKey="name"
                    stroke="#8892a4"
                    fontSize={11}
                    tickFormatter={(val) => val.split(" ")[0]}
                  />
                  <YAxis stroke="#8892a4" fontSize={11} />
                  <Tooltip content={<DistributorStockTooltip />} />
                  <Bar
                    dataKey="stockCount"
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                    name="Stock Units"
                  />
                  <Bar
                    dataKey="sellThrough"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    name="Sell-Through %"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Real-Time Hourly Sales Density Heatmap */}
          <div className="bg-theme-surface-1 rounded-xl p-6 border border-theme-divider">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="material-symbols-outlined text-amber-500">
                    local_fire_department
                  </span>
                  <h3 className="font-display font-semibold text-lg text-theme-body">
                    Hourly Sales Density Heatmap
                  </h3>
                </div>
                <p className="text-xs text-theme-muted mt-1">
                  Identify peak transaction times and optimize staffing • Live synced with checkout events
                </p>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono text-theme-muted">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Real-Time Analytics Enabled</span>
              </div>
            </div>

            {/* Grid Container */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[580px]">
                {/* Header (Time Slots) */}
                <div className="grid grid-cols-[80px_1fr] gap-2 mb-2 items-center">
                  <div className="text-xs font-semibold text-theme-muted uppercase font-display text-center">Day</div>
                  <div className="grid grid-cols-6 gap-2">
                    {["09-11", "11-13", "13-15", "15-17", "17-19", "19-21"].map((slot) => {
                      const displayNames: Record<string, string> = {
                        "09-11": "09am-11am",
                        "11-13": "11am-01pm",
                        "13-15": "01pm-03pm",
                        "15-17": "03pm-05pm",
                        "17-19": "05pm-07pm",
                        "19-21": "07pm-09pm"
                      };
                      return (
                        <div key={slot} className="text-center text-[11px] font-mono font-semibold text-theme-muted">
                          {displayNames[slot]}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Grid Rows (Days) */}
                <div className="space-y-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                    const isToday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] === day;
                    return (
                      <div key={day} className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <div className="flex items-center justify-between pr-2">
                          <span className={`text-xs font-semibold font-sans ${isToday ? "text-[#2563EB] font-bold" : "text-theme-body"}`}>
                            {day}
                          </span>
                          {isToday && (
                            <span className="text-[9px] bg-blue-500/20 text-[#2563EB] border border-blue-500/40 px-1 rounded scale-90">
                              Today
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {["09-11", "11-13", "13-15", "15-17", "17-19", "19-21"].map((slot) => {
                            const val = compiledHeatmap[day]?.[slot] || { count: 0, revenue: 0 };
                            const isSelected = selectedCell?.day === day && selectedCell?.slot === slot;
                            
                            // Color classification logic based on transaction density
                            let cellBg = "bg-slate-800/20 hover:bg-slate-800/40 border border-slate-700/30";
                            let cellText = "text-slate-500";
                            
                            if (val.count > 75) {
                              cellBg = isSelected 
                                ? "bg-emerald-500 border-2 border-white shadow-lg shadow-emerald-500/30 text-white" 
                                : "bg-emerald-500 hover:bg-emerald-400 border border-emerald-400 text-white shadow-sm shadow-emerald-500/10";
                              cellText = "text-white font-bold";
                            } else if (val.count > 45) {
                              cellBg = isSelected 
                                ? "bg-emerald-600 border-2 border-white shadow-lg text-white" 
                                : "bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-emerald-50";
                              cellText = "text-emerald-50 font-semibold";
                            } else if (val.count > 25) {
                              cellBg = isSelected 
                                ? "bg-emerald-700 border-2 border-white shadow-md text-emerald-100" 
                                : "bg-emerald-700/80 hover:bg-emerald-700 border border-emerald-600 text-emerald-100";
                              cellText = "text-emerald-100";
                            } else if (val.count > 10) {
                              cellBg = isSelected 
                                ? "bg-emerald-900 border-2 border-white shadow-sm text-emerald-300" 
                                : "bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-900/60 text-emerald-300";
                              cellText = "text-emerald-300";
                            } else if (val.count > 0) {
                              cellBg = isSelected 
                                ? "bg-slate-800 border-2 border-white shadow-sm text-emerald-400" 
                                : "bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 text-slate-300";
                              cellText = "text-slate-300";
                            }

                            return (
                              <button
                                key={slot}
                                onClick={() => setSelectedCell({ day, slot })}
                                className={`h-11 rounded-lg transition-all flex flex-col justify-center items-center text-center cursor-pointer select-none relative focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${cellBg}`}
                                title={`${day} ${slot}: ${val.count} bills, ₹${val.revenue.toLocaleString()}`}
                              >
                                <span className="text-[11px] font-bold tracking-tight font-mono">
                                  {val.count}
                                </span>
                                <span className="text-[8px] font-mono opacity-80 uppercase tracking-wider">
                                  ₹{(val.revenue / 1000).toFixed(0)}k
                                </span>
                                {isSelected && (
                                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 border border-white rounded-full"></span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="flex flex-wrap items-center justify-between mt-4 pt-3 border-t border-[#2a3a5c] gap-3 text-xs">
              <div className="flex items-center space-x-1.5 font-mono text-[10px] text-theme-muted">
                <span>Density Key (Orders):</span>
                <span className="flex items-center space-x-1 pl-1">
                  <span className="w-3 h-3 rounded bg-slate-800/40 border border-slate-700/50 block"></span>
                  <span>0-10</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-emerald-950/70 border border-emerald-900/60 block"></span>
                  <span>11-25</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-emerald-700 block"></span>
                  <span>26-45</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-emerald-600 block"></span>
                  <span>46-75</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-emerald-500 block"></span>
                  <span>76+</span>
                </span>
              </div>
              <div className="text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Peak: Sat & Sun (07:00 PM - 09:00 PM)
              </div>
            </div>

            {/* Selected Cell Insights Detail Card */}
            {selectedCell && (() => {
              const info = getCellInsights(selectedCell.day, selectedCell.slot);
              return (
                <div className="mt-5 p-4 bg-theme-surface-3 rounded-lg border border-theme-divider animate-fadeIn">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 border-b border-[#2a3a5c] pb-2">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-theme-muted font-mono">
                        Active Intelligence Block
                      </h4>
                      <div className="text-sm font-semibold font-display text-theme-body flex items-center mt-0.5">
                        <span className="text-[#2563EB] font-bold mr-1">{selectedCell.day}</span> • {info.timeLabel}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-[10px] text-theme-muted font-mono uppercase">Invoices</div>
                        <div className="text-xs font-bold font-mono text-theme-body">{info.count} bills</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-theme-muted font-mono uppercase">Est. Revenue</div>
                        <div className="text-xs font-bold font-mono text-emerald-400">₹{info.revenue.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                    {/* Column 1: Staff Allocations */}
                    <div className="bg-theme-surface-1 p-3 rounded-md border border-theme-divider">
                      <div className="flex items-center space-x-1.5 text-blue-400 font-semibold mb-1">
                        <span className="material-symbols-outlined text-sm">badge</span>
                        <span>Staff Allocation Profile</span>
                      </div>
                      <p className="text-theme-body font-medium">{info.staffing}</p>
                      <p className="text-[11px] text-theme-muted mt-1 leading-relaxed">
                        Recommended active checkout staffing based on dynamic traffic metrics.
                      </p>
                    </div>

                    {/* Column 2: Recommended Actions */}
                    <div className="bg-theme-surface-1 p-3 rounded-md border border-theme-divider">
                      <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold mb-1">
                        <span className="material-symbols-outlined text-sm">lightbulb</span>
                        <span>Suggested Action</span>
                      </div>
                      <p className="text-theme-body leading-relaxed">{info.recommendation}</p>
                    </div>

                    {/* Column 3: Operational Risks */}
                    <div className="bg-theme-surface-1 p-3 rounded-md border border-theme-divider">
                      <div className="flex items-center space-x-1.5 text-rose-400 font-semibold mb-1">
                        <span className="material-symbols-outlined text-sm">error</span>
                        <span>Operational Safeguard</span>
                      </div>
                      <p className="text-theme-body leading-relaxed">{info.risk}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Real-Time Daily Sales Performance Trends Widget */}
          <div className="bg-theme-surface-1 rounded-xl p-6 border border-theme-divider">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="material-symbols-outlined text-emerald-400">
                    monitoring
                  </span>
                  <h3 className="font-display font-semibold text-lg text-theme-body">
                    Real-Time Sales Performance Trends
                  </h3>
                </div>
                <p className="text-xs text-theme-muted mt-1">
                  Active Shift tracking • Live updates every 5s
                </p>
              </div>
              <div className="flex bg-theme-surface-3 p-1 rounded-lg border border-theme-divider">
                <button
                  onClick={() => setTrendView("weekly")}
                  className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-all ${
                    trendView === "weekly"
                      ? "bg-[#2563EB] text-theme-body shadow-sm"
                      : "text-theme-muted hover:text-theme-body"
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setTrendView("hourly")}
                  className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-all ${
                    trendView === "hourly"
                      ? "bg-[#2563EB] text-theme-body shadow-sm"
                      : "text-theme-muted hover:text-theme-body"
                  }`}
                >
                  Hourly (Today)
                </button>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3a5c" />
                  <XAxis
                    dataKey="label"
                    stroke="#8892a4"
                    fontSize={11}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="#8892a4" 
                    fontSize={11} 
                    tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#8892a4" 
                    fontSize={11} 
                  />
                  <Tooltip content={<TrendSalesTooltip />} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={0.15}
                    fill="url(#colorSales)"
                    name="Revenue (INR)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="invoices"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={0.05}
                    fill="url(#colorCount)"
                    name="Invoice Count"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="projectedRevenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Projected Revenue"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="projectedInvoices"
                    stroke="#2563eb"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Projected Invoices"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex flex-wrap justify-between items-center mt-4 pt-4 border-t border-[#2a3a5c] text-xs text-theme-muted font-mono gap-y-2">
              <div className="flex items-center space-x-4">
                <span className="flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                  Live Feed Active
                </span>
                <span className="flex items-center">
                  <span className="border-b border-dashed border-emerald-500 w-6 h-0 mr-1.5 inline-block"></span>
                  <span>Trend Projection (LSQ Model)</span>
                </span>
              </div>
              <span>
                Total revenue today: <span className="text-emerald-400 font-bold">₹{dailyRevenue.toLocaleString("en-IN")}</span>
              </span>
            </div>
          </div>

          {/* Compliance Audit Logs */}
          <div className="bg-theme-surface-1 rounded-xl p-6 border border-theme-divider">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-rose-500">
                  gavel
                </span>
                <h3 className="font-display font-semibold text-lg text-theme-body">
                  Rule 10 Audit Ledger
                </h3>
              </div>
              <span className="text-xs bg-emerald-500 bg-opacity-20 text-emerald-400 font-mono font-semibold px-2 py-0.5 rounded border border-emerald-500">
                ACTIVE
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-theme-muted">
                <thead className="text-xs uppercase text-theme-body bg-theme-surface-3 rounded border-b border-theme-divider">
                  <tr>
                    <th className="px-4 py-2">Timestamp</th>
                    <th className="px-4 py-2">Operator</th>
                    <th className="px-4 py-2">Action</th>
                    <th className="px-4 py-2">Before Value</th>
                    <th className="px-4 py-2">After Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a3a5c]">
                  {auditLogs.slice(0, 5).map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-theme-surface-3 hover:bg-opacity-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-theme-body">
                        {log.user}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-theme-body text-xs font-semibold">
                          {log.action}
                        </div>
                        <div className="text-[11px] text-theme-muted">
                          {log.details}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-rose-400">
                        {log.before}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-emerald-400">
                        {log.after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        
        {/* Right column: Copilot AI Chat panel */}
        <div className="flex flex-col space-y-6">
          <QuickReportsWidget 
            products={products}
            psvParties={psvParties}
            auditLogs={filteredAuditLogs}
            startDate={startDate}
            endDate={endDate}
            scaleFactor={scaleFactor}
          />
          <AuditActivityFeed />
          <div className="bg-theme-surface-1 rounded-xl border border-theme-divider flex flex-col h-[490px]">
  
          <div className="px-5 py-4 border-b border-theme-divider flex justify-between items-center bg-theme-surface-3 rounded-t-xl">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-[#2563EB] animate-pulse">
                psychology
              </span>
              <h4 className="font-semibold text-theme-body font-display">
                AI Retail Assistant
              </h4>
            </div>
            <span className="text-[10px] bg-blue-500 bg-opacity-20 text-blue-400 border border-blue-500 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
              Gemini Inside
            </span>
          </div>

          {/* Chats view */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 font-sans text-xs">
            {chatReplies.map((reply, i) => (
              <div
                key={i}
                className={`flex ${reply.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    reply.sender === "user"
                      ? "bg-[#2563EB] text-theme-body"
                      : "bg-theme-surface-3 text-theme-primary border border-theme-divider whitespace-pre-wrap leading-relaxed"
                  }`}
                >
                  {reply.text}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-theme-surface-3 text-theme-muted border border-theme-divider rounded-lg p-3 flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Quick query buttons */}
          <div className="p-3 border-t border-theme-divider bg-theme-surface-3 bg-opacity-40 flex gap-2 overflow-x-auto shrink-0">
            <button
              onClick={() =>
                handleSendMessage(
                  "How do I reduce Southern Logistics' capital exposure?",
                )
              }
              className="shrink-0 text-[10px] bg-theme-surface-1 hover:bg-[#2563EB] text-theme-primary font-semibold px-2 py-1 rounded border border-theme-divider transition-colors"
            >
              Expose Southern Capital
            </button>
            <button
              onClick={() =>
                handleSendMessage("Explain the WOC formula and target levels.")
              }
              className="shrink-0 text-[10px] bg-theme-surface-1 hover:bg-[#2563EB] text-theme-primary font-semibold px-2 py-1 rounded border border-theme-divider transition-colors"
            >
              Analyze Weeks of Cover
            </button>
          </div>

          {/* Input field */}
          <div className="p-3 border-t border-theme-divider bg-theme-surface-3 flex items-center space-x-2 rounded-b-xl shrink-0">
            <input
              type="text"
              placeholder="Ask SMRITI Intelligence..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="flex-1 bg-theme-surface-1 border border-theme-divider text-theme-body text-xs px-3 py-2 rounded focus:outline-none focus:border-[#2563EB]"
              disabled={isSending}
            />
            <button
              onClick={() => handleSendMessage()}
              className="bg-[#2563EB] hover:bg-opacity-95 text-theme-body p-2 rounded flex items-center justify-center transition-colors shrink-0"
              disabled={isSending}
            >
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </div>
        </div>
        <div className="h-80"><InventoryForecastWidget /></div>
        <AboutSmritiWidget />
      </div>
      </div>
    </div>
  );
};
