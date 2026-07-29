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
 *   * Founder, Chief Executive Officer (CEO) & Chief Systems Architect
 *   * Email: support@smritibooks.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 5.1.0  (SEEF Phase 8 - Theme token cascade)
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-26
 * * Copyright  : © SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 *
 * WNG-002: List Report Pattern (receivables list) + embedded party detail panel
 * Business Ledger is a split-view analytical domain — list on left, insights on right.
 */

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Landmark, TrendingUp, Users, ShieldAlert } from "lucide-react";
import { DrillableLink } from "./drilldown/DrillableLink.tsx";
import { useDrillDown } from "./drilldown/drilldown_store.tsx";
import { getCustomers, getCustomerGroups } from "../services/customerStore.ts";
import { resolveCustomerPolicy } from "../services/customerPolicyEngine.ts";
import { Customer, CustomerGroup } from "../types";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { FioriListReport, ListReportColumn } from "./common/FioriListReport.tsx";

interface BusinessLedgerTabProps {
  currentUser?: { role: string; name: string } | null;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);

const generateBalanceHistory = (customer: Customer) => {
  const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const out = customer.outstanding;
  const hash = customer.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return months.map((month, index) => {
    let factor = 1.0;
    let offset = 0;
    if (index === 0) { factor = 0.45; offset = (hash % 10) * 400; }
    else if (index === 1) { factor = 0.70; offset = ((hash + 3) % 12) * 800; }
    else if (index === 2) { factor = 0.65; offset = ((hash + 7) % 8) * -500; }
    else if (index === 3) { factor = 1.15; offset = ((hash + 1) % 15) * 600; }
    else if (index === 4) { factor = 0.85; offset = ((hash + 5) % 10) * -800; }
    else { factor = 1.0; offset = 0; }
    return { month, Balance: Math.max(0, Math.round(out * factor + offset)) };
  });
};

const getDisplayStatus = (customer: Customer) => {
  if (customer.status === "Blocked") return "Blocked";
  if (customer.status === "Inactive") return "Inactive";
  return customer.outstanding > 0 ? "Due" : "Settled";
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cls =
    status === "Settled"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : status === "Blocked"
      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
      : status === "Inactive"
      ? "bg-theme-surface-2 text-theme-muted border-theme-divider"
      : "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider rounded-md border ${cls}`}>
      {status}
    </span>
  );
};

export const BusinessLedgerTab: React.FC<BusinessLedgerTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const { activePanel } = useDrillDown();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  useEffect(() => {
    const refreshData = () => {
      setCustomers(getCustomers());
      setGroups(getCustomerGroups());
    };
    refreshData();
    window.addEventListener("smriti_customer_updated", refreshData);
    return () => window.removeEventListener("smriti_customer_updated", refreshData);
  }, [activePanel]);

  useEffect(() => {
    if (activePanel && activePanel.entityType === "customer") {
      setSelectedCustomerId(activePanel.entityId);
    }
  }, [activePanel]);

  useEffect(() => {
    if (selectedCustomerId) {
      const cust = customers.find((c) => c.id === selectedCustomerId);
      if (cust) {
        recordAuditAction(
          "TRANSACTION_VIEW",
          "business_ledgers",
          cust.id,
          `Viewed business ledger details for customer: ${cust.name}`
        );
      }
    }
  }, [selectedCustomerId, customers]);

  const getGroupName = (groupId: string) =>
    groups.find((g) => g.id === groupId)?.name || "Unknown Group";

  const getCustomerGroupObj = (groupId: string): CustomerGroup | undefined =>
    groups.find((g) => g.id === groupId);

  // KPI aggregates (over full customer set — not filtered, shown in header)
  const totalOutstanding = customers.reduce((acc, c) => acc + c.outstanding, 0);
  const duePartiesCount = customers.filter((c) => c.outstanding > 0).length;
  const avgOutstanding = customers.length > 0 ? Math.round(totalOutstanding / customers.length) : 0;

  // Selected party detail
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];
  const selectedCustomerGroup = selectedCustomer
    ? getCustomerGroupObj(selectedCustomer.customerGroupId)
    : undefined;
  const policy =
    selectedCustomer && selectedCustomerGroup
      ? resolveCustomerPolicy(selectedCustomer, selectedCustomerGroup)
      : null;
  const chartData = selectedCustomer ? generateBalanceHistory(selectedCustomer) : [];

  // WNG-002 List Report columns for the receivables ledger panel
  const COLUMNS: ListReportColumn<Customer>[] = [
    {
      key: "name",
      label: "Party Name",
      render: (row) => (
        <div
          onClick={() => setSelectedCustomerId(row.id)}
          className={`cursor-pointer ${selectedCustomerId === row.id ? "text-cyan-400 font-bold" : "text-theme-body"}`}
        >
          <div className="font-medium text-xs">{row.name}</div>
          <div className="text-[10px] text-theme-muted font-mono mt-0.5">{row.mobile}</div>
        </div>
      ),
    },
    {
      key: "customerGroupId",
      label: "Segment",
      render: (row) => (
        <span className="px-2 py-0.5 text-[10px] rounded bg-theme-surface-2 text-theme-body">
          {getGroupName(row.customerGroupId)}
        </span>
      ),
    },
    {
      key: "outstanding",
      label: "Outstanding",
      align: "right",
      render: (row) => (
        <span className="font-mono font-semibold text-xs text-theme-heading">
          {formatCurrency(row.outstanding)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      align: "center",
      render: (row) => <StatusBadge status={getDisplayStatus(row)} />,
    },
    {
      key: "id",
      label: "Action",
      align: "center",
      render: (row) => (
        <DrillableLink
          context={{
            entityType: "customer",
            entityId: row.id,
            title: row.name,
            metadata: { customerId: row.id },
          }}
        >
          <span className="text-cyan-400 hover:text-cyan-300 text-[11px] font-medium underline flex items-center justify-center gap-0.5">
            Profile
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
          </span>
        </DrillableLink>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-theme-base text-theme-body">
      {/* Read-Only Banner */}
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs flex-shrink-0">
          <span className="material-symbols-outlined text-sm">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Write operations are prohibited.</span>
        </div>
      )}

      {/* Fiori-style Page Header */}
      <div className="px-6 pt-6 pb-4 border-b border-theme-divider flex-shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-theme-heading">Business Ledger</h1>
        <p className="text-xs text-theme-muted mt-1">
          Operational view of outstanding balances, settlements, credit policies, and party risk
        </p>
      </div>

      {/* KPI Header Cards */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0 border-b border-theme-divider">
        {[
          { label: "Total Outstanding", value: formatCurrency(totalOutstanding), icon: <Landmark size={18} />, color: "text-rose-400 bg-rose-500/10" },
          { label: "Active Parties", value: customers.length, icon: <Users size={18} />, color: "text-blue-400 bg-blue-500/10" },
          { label: "Parties with Dues", value: duePartiesCount, icon: <ShieldAlert size={18} />, color: "text-amber-400 bg-amber-500/10" },
          { label: "Avg Outstanding", value: formatCurrency(avgOutstanding), icon: <TrendingUp size={18} />, color: "text-emerald-400 bg-emerald-500/10" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-theme-surface-1 p-4 rounded-xl border border-theme-divider flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider">{kpi.label}</p>
              <h3 className="text-base font-bold font-mono text-theme-heading mt-1">{kpi.value}</h3>
            </div>
            <div className={`p-2 rounded-lg ${kpi.color}`}>{kpi.icon}</div>
          </div>
        ))}
      </div>

      {/* Split View: List Report (left) + Party Detail Panel (right) */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Left: WNG-002 List Report — Receivables Ledger */}
        <div className="lg:col-span-7 overflow-hidden border-r border-theme-divider">
          <FioriListReport<Customer>
            title="Receivables Ledger"
            subtitle={`${customers.length} parties — click a row to load insights`}
            data={customers}
            columns={COLUMNS}
            onRowClick={(row) => setSelectedCustomerId(row.id)}
            searchPlaceholder="Search by party name, mobile, or segment..."
            filterOptions={
              groups.length > 0
                ? [
                    {
                      key: "customerGroupId",
                      label: "Segment",
                      options: groups.map((g) => ({ label: g.name, value: g.id })),
                    },
                  ]
                : []
            }
          />
        </div>

        {/* Right: Party Insights Detail Panel */}
        <div className="lg:col-span-5 overflow-auto p-6 bg-theme-surface-1/20">
          {selectedCustomer ? (
            <div className="space-y-6">
              {/* Party Header */}
              <div className="pb-4 border-b border-theme-divider">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono text-theme-muted uppercase tracking-wider">
                      Party Insights
                    </span>
                    <h3 className="text-lg font-bold text-theme-heading mt-1">{selectedCustomer.name}</h3>
                    <p className="text-xs text-theme-muted mt-1 flex items-center gap-1 font-mono">
                      <span className="material-symbols-outlined text-xs">mail</span>
                      {selectedCustomer.email || "No email on file"}
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-1 rounded font-bold">
                    {selectedCustomer.id}
                  </span>
                </div>
              </div>

              {/* 6-Month Balance Trend Chart */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider">
                    6-Month Balance History
                  </h4>
                  <span className="text-[11px] font-semibold text-cyan-400 font-mono">Trend</span>
                </div>
                <div className="h-56 bg-theme-surface-1 p-4 rounded-xl border border-theme-divider">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-theme-divider, #1e293b)" />
                      <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--color-theme-surface-1, #0f172a)", borderColor: "var(--color-theme-divider, #1e293b)", borderRadius: 8 }}
                        labelStyle={{ color: "var(--color-theme-muted, #94a3b8)", fontWeight: "bold", fontSize: 10 }}
                        itemStyle={{ color: "var(--color-theme-heading, #ffffff)", fontSize: 11 }}
                        formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Balance"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="Balance"
                        stroke="#22d3ee"
                        strokeWidth={2.5}
                        dot={{ r: 3, stroke: "#22d3ee", fill: "var(--color-theme-base, #0f172a)" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Stat Summary */}
              <div className="grid grid-cols-2 gap-3 py-4 border-t border-b border-theme-divider">
                <div className="bg-theme-surface-1 p-3 rounded-xl border border-theme-divider">
                  <span className="text-[10px] uppercase text-theme-muted font-semibold">Peak Balance (6M)</span>
                  <span className="block text-sm font-bold text-theme-heading font-mono mt-0.5">
                    {formatCurrency(Math.max(...chartData.map((d) => d.Balance), 0))}
                  </span>
                </div>
                <div className="bg-theme-surface-1 p-3 rounded-xl border border-theme-divider">
                  <span className="text-[10px] uppercase text-theme-muted font-semibold">Avg Balance</span>
                  <span className="block text-sm font-bold text-theme-heading font-mono mt-0.5">
                    {formatCurrency(
                      Math.round(chartData.reduce((s, d) => s + d.Balance, 0) / (chartData.length || 1))
                    )}
                  </span>
                </div>
              </div>

              {/* Resolved Risk Policies */}
              {policy && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider">
                    Resolved Risk Policies
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      {
                        label: "Credit Limit",
                        value: policy.unlimitedCredit ? "Unlimited" : formatCurrency(policy.creditLimit || 0),
                      },
                      { label: "Credit Period", value: `${policy.creditDays} Days (+${policy.graceDays} grace)` },
                      { label: "Tax Inclusive", value: policy.taxInclusive ? "Yes" : "No" },
                      { label: "Max Discount", value: `${policy.maxDiscountPercent}%` },
                    ].map((p) => (
                      <div
                        key={p.label}
                        className="p-2.5 bg-theme-surface-1 rounded-lg border border-theme-divider text-xs"
                      >
                        <span className="text-theme-muted block text-[10px] uppercase">{p.label}</span>
                        <span className="font-semibold text-theme-heading font-mono">{p.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-theme-muted text-sm">
              Select a party from the ledger list to view their financial insights.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
