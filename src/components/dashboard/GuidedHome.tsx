/**
 * Project      : SMRITI Retail OS
 * Author       : SMRITI Systems
 * Version      : 7.0.0
 * Classification: Guided Role-Based Home
 */

import React, { useCallback, useEffect, useState } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { PlainLanguageHelp } from "../common/PlainLanguageHelp.tsx";

interface GuidedHomeProps {
  currentUser?: { role: string; name: string } | null;
  onNavigateTab?: (tab: string) => void;
}

interface HomeSummary {
  today_sales: number;
  bill_count: number;
  items_sold: number;
  new_customer_count: number;
  today_unpaid_balance?: number;
  customer_outstanding?: number;
  recent_sales: Array<{
    id: string;
    invoice_no: string;
    customer_name: string;
    net_amount: number;
    status: string;
  }>;
}

type HomeAction = { label: string; detail: string; icon: string; tab: string };

const cashierActions: HomeAction[] = [
  { label: "Sell items", detail: "Start a bill", icon: "shopping_cart", tab: "billing-workspace" },
  { label: "Add customer", detail: "Save customer details", icon: "person_add", tab: "customer-master" },
  { label: "Close counter", detail: "Check cash and close shift", icon: "lock_clock", tab: "day-close" },
];

const managerActions: HomeAction[] = [
  { label: "Sell items", detail: "Open billing", icon: "shopping_cart", tab: "billing-workspace" },
  { label: "Receive goods", detail: "Confirm delivered stock", icon: "inventory", tab: "grn-studio" },
  { label: "Add product", detail: "Create or update items", icon: "inventory_2", tab: "item-master" },
  { label: "Review staff", detail: "Attendance and shifts", icon: "groups", tab: "staff-management" },
];

const reportActions: HomeAction[] = [
  { label: "View reports", detail: "Review business performance", icon: "analytics", tab: "visual-reports" },
];

const roleActions: Record<string, HomeAction[]> = {
  CASHIER: cashierActions,
  MANAGER: managerActions,
  STORE_MANAGER: managerActions,
  BRANCH_ADMIN: managerActions,
  ADMIN: [
    ...managerActions,
    { label: "Company details", detail: "Review your shop information", icon: "settings", tab: "company-profile" },
  ],
  SYSADMIN: [
    ...managerActions,
    ...reportActions,
    { label: "Company details", detail: "Review your shop information", icon: "settings", tab: "company-profile" },
  ],
  INVENTORY_MANAGER: [
    { label: "Receive goods", detail: "Confirm delivered stock", icon: "inventory", tab: "grn-studio" },
    { label: "Add product", detail: "Create or update items", icon: "inventory_2", tab: "item-master" },
    { label: "Check stock", detail: "Review current quantities", icon: "inventory", tab: "stock-ledger" },
  ],
  PURCHASE_EXECUTIVE: [
    { label: "Create purchase order", detail: "Order goods from a supplier", icon: "shopping_bag", tab: "purchase" },
    { label: "Receive goods", detail: "Confirm delivered stock", icon: "inventory", tab: "grn-studio" },
    { label: "Find supplier", detail: "View supplier details", icon: "store", tab: "vendor-360" },
  ],
  SALES_EXECUTIVE: [
    { label: "Sell items", detail: "Start a bill", icon: "shopping_cart", tab: "billing-workspace" },
    { label: "Add customer", detail: "Save customer details", icon: "person_add", tab: "customer-master" },
    { label: "Review sales orders", detail: "Check pending customer orders", icon: "receipt_long", tab: "sales-orders" },
  ],
  ACCOUNTANT: [
    { label: "Review accounts", detail: "Check invoices and balances", icon: "account_balance", tab: "business-ledger" },
    { label: "View reports", detail: "Review financial performance", icon: "analytics", tab: "report-designer" },
  ],
  AUDITOR: reportActions,
  HR_EXECUTIVE: [
    { label: "Review staff", detail: "Manage attendance and shifts", icon: "groups", tab: "staff-management" },
    { label: "Attendance", detail: "Review daily attendance", icon: "schedule", tab: "attendance-workspace" },
  ],
  REPORT_USER: reportActions,
  VIEWER: reportActions,
};

export const GuidedHome: React.FC<GuidedHomeProps> = ({ currentUser, onNavigateTab }) => {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const role = (currentUser?.role || "").trim().replace(/[\s-]+/g, "_").toUpperCase();
  const actions = roleActions[role] || [];

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await apiFetchV1<HomeSummary>("/analytics/home-summary");
      setSummary(data);
    } catch {
      setSummary(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
  const summaryValue = (value: string) => loading ? "Loading..." : loadError ? "Unavailable" : value;
  const todayUnpaidBalance = summary?.today_unpaid_balance ?? summary?.customer_outstanding;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-700">SMRITI HOME</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            Welcome, {currentUser?.name || "Team"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Choose a task below. You do not need to understand accounting or technical menus.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateTab?.("training-academy")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-bold text-sky-800"
          >
            <span className="material-symbols-outlined text-[20px]">school</span>
            Training
          </button>
          <PlainLanguageHelp />
        </div>
      </section>

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <p>Today’s summary could not be loaded. Check your connection and try again.</p>
          <button type="button" onClick={() => void loadSummary()} className="min-h-10 rounded-lg border border-red-300 bg-white px-4 font-bold text-red-800">
            Try again
          </button>
        </div>
      )}

      <section aria-label="Today's summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Today's sales", value: summary?.today_sales === undefined ? "—" : formatMoney(summary.today_sales), icon: "payments", color: "sky" },
          { label: "Bills created", value: summary?.bill_count === undefined ? "—" : String(summary.bill_count), icon: "receipt_long", color: "emerald" },
          { label: "Items sold", value: summary?.items_sold === undefined ? "—" : String(summary.items_sold), icon: "inventory_2", color: "violet" },
          { label: "Unpaid on today's bills", value: todayUnpaidBalance === undefined ? "—" : formatMoney(todayUnpaidBalance), icon: "account_balance_wallet", color: "amber" },
        ].map((card) => (
          <article key={card.label} className="min-h-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{card.label}</span>
              <span className="material-symbols-outlined text-slate-400">{card.icon}</span>
            </div>
            <p className="mt-4 text-xl font-black text-slate-900 dark:text-white">{summaryValue(card.value)}</p>
          </article>
        ))}
      </section>

      <section aria-labelledby="what-to-do">
        <h2 id="what-to-do" className="mb-3 text-lg font-bold text-slate-900 dark:text-white">What would you like to do?</h2>
        {actions.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onNavigateTab?.(action.tab)}
                className="min-h-32 rounded-2xl border-2 border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-sky-500 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="material-symbols-outlined text-3xl text-sky-700">{action.icon}</span>
                <span className="mt-4 block text-base font-bold text-slate-900 dark:text-white">{action.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{action.detail}</span>
              </button>
            ))}
          </div>
        ) : (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Quick tasks are not set up for your role yet. Ask your manager to choose the right workspace for you.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="font-bold text-slate-900 dark:text-white">Recent bills</h2>
          <button type="button" onClick={() => onNavigateTab?.("sales")} className="text-sm font-bold text-sky-700">
            View all
          </button>
        </div>
        {loadError ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Recent bills are unavailable until the summary loads.</p>
        ) : summary?.recent_sales?.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {summary.recent_sales.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onNavigateTab?.("sales")}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{row.invoice_no}</p>
                  <p className="text-xs text-slate-500">{row.customer_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 dark:text-white">{formatMoney(row.net_amount)}</p>
                  <p className="text-xs text-slate-500">{row.status}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            {loading ? "Loading recent bills..." : "No bills have been created today."}
          </p>
        )}
      </section>
    </main>
  );
};
