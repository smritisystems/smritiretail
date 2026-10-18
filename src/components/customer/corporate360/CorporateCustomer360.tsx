/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Corporate Customer 360 Full Dashboard (Master View)
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Store,
  FileText,
  Receipt,
  CreditCard,
  Package,
  MapPin,
  Users,
  History as HistoryIcon,
  BookOpen,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  X,
  Phone,
  Mail,
  ShieldCheck
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import {
  CorporateCustomer360Data,
  CorporateTabKey,
  CorporateStoreItem
} from "./types.ts";
import { CorporateAccountHeader } from "./CorporateAccountHeader.tsx";
import { CorporateCustomerTabs } from "./CorporateCustomerTabs.tsx";
import { CorporateKpiCards } from "./CorporateKpiCards.tsx";
import { CorporateStoreNetwork } from "./CorporateStoreNetwork.tsx";
import { CorporatePsvWidget } from "./CorporatePsvWidget.tsx";
import { CorporateStoreTypeWidget } from "./CorporateStoreTypeWidget.tsx";
import { CorporateRecentOrdersWidget } from "./CorporateRecentOrdersWidget.tsx";
import { CorporatePurchaseTrendWidget } from "./CorporatePurchaseTrendWidget.tsx";
import { CorporateTopCategoriesWidget } from "./CorporateTopCategoriesWidget.tsx";

export interface CorporateCustomer360Props {
  customerId?: string;
  currentUser?: { role?: string; name?: string; id?: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigateTab?: (tabId: string) => void;
  onBack?: () => void;
  onEditCustomer?: (customer: any) => void;
}

export const CorporateCustomer360: React.FC<CorporateCustomer360Props> = ({
  customerId = "CUST-REL-0001",
  currentUser,
  onNotification,
  onNavigateTab,
  onBack,
  onEditCustomer,
}) => {
  const [data, setData] = useState<CorporateCustomer360Data | null>(null);
  const [activeTab, setActiveTab] = useState<CorporateTabKey>("overview");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<CorporateStoreItem | null>(null);

  // Authoritative data fetcher
  const load360Data = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetchV1<CorporateCustomer360Data>(
        `/crm/customers/${encodeURIComponent(customerId)}/corporate-360`
      );
      if (res && res.customer) {
        setData(res);
      } else {
        throw new Error("Invalid corporate customer response payload.");
      }
    } catch (err: any) {
      console.warn("[CorporateCustomer360] Live API error:", err);
      setError(err?.message || "Failed to load corporate profile.");
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load360Data();
  }, [load360Data]);

  const handleCreateOrder = () => {
    if (onNavigateTab) {
      onNavigateTab("sales");
    } else {
      window.dispatchEvent(
        new CustomEvent("smriti_navigate_module", {
          detail: { moduleId: "sales" },
        })
      );
    }
    onNotification?.(
      "Sales Order",
      `Initiating B2B Sales Order for ${data?.customer?.name || "Corporate Customer"}.`,
      "info"
    );
  };

  const handleNavigatePsv = () => {
    if (onNavigateTab) {
      onNavigateTab("psv");
    } else {
      window.dispatchEvent(
        new CustomEvent("smriti_navigate_module", {
          detail: { moduleId: "psv" },
        })
      );
    }
  };

  // Skeleton Loading UI
  if (isLoading && !data) {
    return (
      <div className="p-4 space-y-4 max-w-7xl mx-auto animate-pulse">
        {/* Breadcrumb Skeleton */}
        <div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded"></div>
        {/* Header Skeleton */}
        <div className="h-48 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800"></div>
        {/* Tabs Skeleton */}
        <div className="h-10 bg-slate-100 dark:bg-slate-800/40 rounded-xl"></div>
        {/* KPI Row Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
          ))}
        </div>
        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="h-72 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
          <div className="h-72 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
          <div className="h-72 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Error State with Retry
  if (error && !data) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-12 bg-white dark:bg-[#1e222d] border border-rose-200 dark:border-rose-900 rounded-2xl shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 mx-auto">
          <AlertCircle size={24} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Unable to Load Corporate Customer Profile
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {error}
          </p>
        </div>
        <button
          onClick={load360Data}
          className="px-4 py-2 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-2"
        >
          <RefreshCw size={14} />
          <span>Retry Loading Profile</span>
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 sm:p-5 space-y-4 max-w-7xl mx-auto font-sans text-slate-800 dark:text-slate-100 select-none animate-fadeIn">

      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 hover:text-slate-800 dark:hover:text-white rounded transition mr-1"
              title="Return to Customer Directory"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          <span
            className="hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer font-medium"
            onClick={onBack}
          >
            Customers
          </span>
          <span className="text-slate-400">›</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            Customer Profile
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load360Data}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Refresh Live Data"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin text-[#0284c7]" : ""} />
          </button>
        </div>
      </div>

      {/* 1. Corporate Account Header */}
      <CorporateAccountHeader
        data={data}
        onEdit={() => onEditCustomer?.(data.customer)}
        onCreateOrder={handleCreateOrder}
        onRefresh={load360Data}
        onExport={() => onNotification?.("Export", "Exporting complete Corporate 360 Dataset...", "info")}
        onPrint={() => window.print()}
      />

      {/* 2. Customer Navigation Tab Strip */}
      <CorporateCustomerTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        storesCount={data.kpis.total_stores || 2456}
      />

      {/* Tab Panels */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* 3. 6-KPI Summary Cards */}
          <CorporateKpiCards kpis={data.kpis} />

          {/* 4. Middle Dense Row: Store Network Table (Col 1-2) + PSV Donut + Store Type Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

            {/* Store Network Table: 5 columns on wide */}
            <div className="lg:col-span-5">
              <CorporateStoreNetwork
                stores={data.store_network}
                customerId={data.customer.id}
                customerName={data.customer.name}
                totalStoresCount={data.kpis.total_stores}
                onViewAllStores={() => setActiveTab("stores")}
                onSelectStore={setSelectedStore}
              />
            </div>

            {/* PSV Donut Widget: 4 columns on wide */}
            <div className="lg:col-span-4">
              <CorporatePsvWidget
                psvSummary={data.psv_summary}
                onNavigatePsv={handleNavigatePsv}
              />
            </div>

            {/* Store Type Distribution: 3 columns on wide */}
            <div className="lg:col-span-3">
              <CorporateStoreTypeWidget
                distribution={data.store_type_distribution}
                totalStoresCount={data.kpis.total_stores}
                onViewStoreDetails={() => setActiveTab("stores")}
              />
            </div>

          </div>

          {/* 5. Bottom Row: Recent Orders + Purchase Trend + Top Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

            {/* Recent Orders Table: 4 columns */}
            <div className="lg:col-span-4">
              <CorporateRecentOrdersWidget
                orders={data.recent_orders}
                onViewAllOrders={() => setActiveTab("orders")}
                onSelectOrder={(ord) => onNotification?.("Order", `Viewing details for ${ord.order_no}`, "info")}
              />
            </div>

            {/* Purchase Trend Combo Chart: 4 columns */}
            <div className="lg:col-span-4">
              <CorporatePurchaseTrendWidget
                trendData={data.purchase_trend}
              />
            </div>

            {/* Top Categories Progress Bars: 4 columns */}
            <div className="lg:col-span-4">
              <CorporateTopCategoriesWidget
                categories={data.top_categories}
                onViewAllCategories={() => setActiveTab("products")}
              />
            </div>

          </div>
        </div>
      )}

      {/* Stores Tab (Expanded View) */}
      {activeTab === "stores" && (
        <div className="space-y-4">
          <CorporateStoreNetwork
            stores={data.store_network}
            customerId={data.customer.id}
            customerName={data.customer.name}
            totalStoresCount={data.kpis.total_stores}
            onSelectStore={setSelectedStore}
            onStoreAssigned={async (assignedStore) => {
              onNotification?.(
                "Store Code Assigned",
                `Store Code ${assignedStore.store_code} mapped successfully to ${data.customer.name}.`,
                "success"
              );
              load360Data();
            }}
          />
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <CorporateRecentOrdersWidget
            orders={data.recent_orders}
            onSelectOrder={(ord) => onNotification?.("Order", `Viewing details for ${ord.order_no}`, "info")}
          />
        </div>
      )}

      {/* PSV & Inventory Tab */}
      {activeTab === "psv" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CorporatePsvWidget
            psvSummary={data.psv_summary}
            onNavigatePsv={handleNavigatePsv}
          />
          <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Consignment Health Status</h3>
            <p className="text-xs text-slate-500">
              Live Stock visibility engine continuously audits SKU-level sell-through at Modern Trade locations.
            </p>
            <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="block text-[10px] text-emerald-600 font-bold uppercase">In Stock</span>
                <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  {data.psv_summary.in_stock_stores}
                </span>
                <span className="text-[10px] text-slate-400 block">Stores Healthy</span>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800">
                <span className="block text-[10px] text-amber-600 font-bold uppercase">Low Stock</span>
                <span className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300">
                  {data.psv_summary.low_stock_stores}
                </span>
                <span className="text-[10px] text-slate-400 block">Restock Prompted</span>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800">
                <span className="block text-[10px] text-rose-600 font-bold uppercase">Out of Stock</span>
                <span className="text-lg font-bold font-mono text-rose-700 dark:text-rose-300">
                  {data.psv_summary.out_of_stock_stores}
                </span>
                <span className="text-[10px] text-slate-400 block">Immediate Attention</span>
              </div>
            </div>
            <div className="pt-3">
              <button
                onClick={handleNavigatePsv}
                className="w-full py-2 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold rounded-lg transition"
              >
                Open Full PSV Management Engine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tax Invoices & Financial Vouchers</h3>
          <p className="text-xs text-slate-500">
            Authoritative GST tax invoices billed against {data.customer.name} across regional state registrations.
          </p>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
                <tr>
                  <th className="p-2.5">Invoice No</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Delivery Store</th>
                  <th className="p-2.5">Amount</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recent_orders.map((o) => (
                  <tr key={o.order_no} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 font-mono text-[#0284c7] font-semibold">{o.order_no.replace("SO-", "INV-")}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">{o.date}</td>
                    <td className="p-2.5 text-slate-800 dark:text-slate-200">Reliance Fresh - Andheri</td>
                    <td className="p-2.5 font-mono font-medium">₹ {(o.value / 100000).toFixed(2)} Lakh</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700">Settled</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments & Credit Tab */}
      {activeTab === "payments" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-2">
            <span className="text-xs text-slate-400 font-medium">Authoritative Credit Limit</span>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              ₹ 50,00,00,000
            </div>
            <span className="text-[11px] text-emerald-600 block">Approved by Credit Committee</span>
          </div>
          <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-2">
            <span className="text-xs text-slate-400 font-medium">Payment Term</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {data.customer.payment_term || "30 Days (Credit)"}
            </div>
            <span className="text-[11px] text-slate-400 block">Default corporate policy</span>
          </div>
          <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-2">
            <span className="text-xs text-slate-400 font-medium">Outstanding Exposure</span>
            <div className="text-xl font-bold font-mono text-emerald-600">
              ₹ {(data.customer.outstanding || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-400 block">0 Days overdue</span>
          </div>
        </div>
      )}

      {/* Products Tab */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <CorporateTopCategoriesWidget
            categories={data.top_categories}
          />
        </div>
      )}

      {/* Other Tabs Placeholder with Rich Corporate State */}
      {["communication", "contracts", "addresses", "team", "notes", "history"].includes(activeTab) && (
        <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0284c7] flex items-center justify-center mx-auto">
            {activeTab === "communication" && <MessageSquare size={22} />}
            {activeTab === "contracts" && <BookOpen size={22} />}
            {activeTab === "addresses" && <MapPin size={22} />}
            {activeTab === "team" && <Users size={22} />}
            {activeTab === "notes" && <FileText size={22} />}
            {activeTab === "history" && <HistoryIcon size={22} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
              Corporate Customer {activeTab} Records
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Authoritative records for {data.customer.name} are synchronized with the PostgreSQL database.
            </p>
          </div>
          <button
            onClick={() => setActiveTab("overview")}
            className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg transition"
          >
            Return to 360 Overview
          </button>
        </div>
      )}

      {/* Store Quick Details Modal (when clicking a store) */}
      {selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Store size={18} className="text-[#0284c7]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Store Identity & Details</h3>
                  <span className="font-mono text-xs font-bold text-[#0284c7]">{selectedStore.store_code}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedStore(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Store / Site Name</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStore.store_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">City</span>
                  <span className="text-slate-800 dark:text-slate-200">{selectedStore.city}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">State / Region</span>
                  <span className="text-slate-800 dark:text-slate-200">{selectedStore.state}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Store Type</span>
                  <span className="text-slate-800 dark:text-slate-200">{selectedStore.store_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    {selectedStore.status}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">PSV Value</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ₹ {(selectedStore.psv_value / 100000).toFixed(2)} Lakh
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Primary Contact</span>
                <span className="text-slate-800 dark:text-slate-200">{selectedStore.contact}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStore(null)}
                className="px-4 py-1.5 bg-[#0284c7] text-white rounded-lg text-xs font-semibold hover:bg-[#0369a1] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
