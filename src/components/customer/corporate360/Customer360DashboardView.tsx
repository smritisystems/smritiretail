/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-25
 * Modified     : 2026-10-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Corporate Customer 360 Dashboard View
 * Capability   : withCapability("customer.crud", "CRM")
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ban, Building2, CheckCircle2, CreditCard, Loader2, MapPin, PackageCheck, Pencil, RefreshCw, Save, Search, Store, Users } from "lucide-react";
import { CorporateCustomerTabs } from "./CorporateCustomerTabs.tsx";
import { CorporateTabKey, CorporateCustomer360Data, PsvDetailedItem, PsvQuantityReconciliationPayload, PsvQuantityReconciliationSummary } from "./types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import type { CustomerDirectoryItem } from "../types.ts";
import { SmritiAdvancedCustomerSearchModal } from "../AdvancedCustSearch.tsx";

export interface Customer360DashboardViewProps {
  customerId?: string;
  customer?: any;
  corporate360Data?: CorporateCustomer360Data | null;
  initialPsvItems?: PsvDetailedItem[];
  initialPsvSummary?: PsvQuantityReconciliationSummary | null;
  initialInvoices?: any[];
  initialTab?: CorporateTabKey;
  onSave?: () => void;
  onDeactivate?: () => void;
  onEditCustomer?: (customer: any) => void;
  onSelectCustomer?: (customer: CustomerDirectoryItem) => void;
  onBack?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
}

const textValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "Not provided";
  return String(value);
};

const amountValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "Not set";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
    : String(value);
};

const isDeleted = (item: any): boolean => item?.is_deleted === true || item?.isDeleted === true;

const Field: React.FC<{ label: string; value: unknown }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">{textValue(value)}</dd>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode; description?: string }> = ({ title, description, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#1a202c]">
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
    {children}
  </section>
);

export const Customer360DashboardView: React.FC<Customer360DashboardViewProps> = ({
  customerId,
  customer: propCustomer,
  corporate360Data,
  initialPsvItems,
  initialPsvSummary,
  initialInvoices,
  initialTab = "overview",
  onSave,
  onDeactivate,
  onEditCustomer,
  onSelectCustomer,
  onBack,
  isSaving = false,
  isDirty = false,
}) => {
  const customer = propCustomer || corporate360Data?.customer;
  const id = customerId || customer?.id;
  const [activeTab, setActiveTab] = useState<CorporateTabKey>(initialTab);
  const [psvSummary, setPsvSummary] = useState<PsvQuantityReconciliationSummary | null>(initialPsvSummary || corporate360Data?.psv_reconciliation?.summary || null);
  const [psvItems, setPsvItems] = useState<PsvDetailedItem[]>(initialPsvItems || corporate360Data?.psv_reconciliation?.items || []);
  const [psvLoading, setPsvLoading] = useState(false);
  const [psvError, setPsvError] = useState<string | null>(null);
  const [psvStatus, setPsvStatus] = useState("all");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  const loadPsv = useCallback(async () => {
    if (!id || initialPsvItems || corporate360Data?.psv_reconciliation) return;
    setPsvLoading(true);
    setPsvError(null);
    try {
      const query = new URLSearchParams({ customer_id: String(id), limit: "500" });
      const response = await apiFetchV1<PsvQuantityReconciliationPayload>(`/psv/reconciliation?${query.toString()}`);
      setPsvSummary(response?.summary || null);
      setPsvItems(response?.items || []);
    } catch (error: any) {
      setPsvError(error?.message || "PSV reconciliation could not be loaded.");
    } finally {
      setPsvLoading(false);
    }
  }, [id, initialPsvItems, corporate360Data?.psv_reconciliation]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, id]);

  useEffect(() => {
    if (activeTab === "psv" || activeTab === "overview") loadPsv();
  }, [activeTab, loadPsv]);

  const stores = useMemo(() => {
    if (corporate360Data?.store_network && corporate360Data.store_network.length > 0) return corporate360Data.store_network;
    const directLocations = (customer?.delivery_locations || customer?.deliveryLocations || [])
      .filter((location: any) => !isDeleted(location))
      .map((location: any) => ({
        id: location.id,
        store_code: location.store_code || location.storeCode,
        store_name: location.location_name || location.locationName || location.name,
        city: location.city,
        state: location.state,
        store_type: location.location_type || location.locationType || "Store",
        status: location.status || ((location.is_active ?? location.isActive) === false ? "Inactive" : "Active"),
      }));
    if (directLocations.length > 0) return directLocations;

    // Subordinate child branch stores (consistent with Customer Master)
    return (customer?.dependants || customer?.children || [])
      .filter((row: any) => !isDeleted(row))
      .map((dep: any, idx: number) => ({
        id: dep.dependantCustomerId || dep.dependant_customer_id || dep.id || String(idx + 1),
        store_code: dep.dependantCustomerCode || dep.dependant_customer_code || dep.code || "—",
        store_name: dep.dependantCustomerName || dep.dependant_customer_name || dep.name || "Child Store",
        city: dep.dependantCustomerCity || dep.dependant_customer_city || dep.city || "—",
        state: dep.dependantCustomerState || dep.dependant_customer_state || dep.state || "—",
        store_type: "Branch Outlet",
        status: dep.dependantCustomerStatus || dep.status || "Active",
      }));
  }, [corporate360Data?.store_network, customer]);

  const children = useMemo(() => {
    const rows = customer?.dependants || customer?.children || [];
    return Array.isArray(rows) ? rows.filter((row: any) => !isDeleted(row)) : [];
  }, [customer]);

  const invoices = initialInvoices || corporate360Data?.sales_invoices || corporate360Data?.recent_orders || customer?.invoices || [];
  const activeStores = stores.filter((store: any) => String(store.status || "").toLowerCase() === "active").length;
  const status = String(customer?.status || ((customer?.is_active ?? customer?.isActive) === false ? "Inactive" : "Active"));
  const isActive = status.toLowerCase() === "active";
  const creditHold = Boolean(customer?.credit_hold ?? customer?.creditHold);
  const pendingPsvQty = psvSummary?.total_pending_approval_qty ?? 0;
  const displayName = customer?.display_name || customer?.displayName || customer?.name;
  const gstRegistrations = (customer?.gst_registrations || customer?.gstRegistrations || []).filter((row: any) => !isDeleted(row));
  const billingLocations = (customer?.billing_locations || customer?.billingLocations || []).filter((row: any) => !isDeleted(row));
  const deliveryLocations = (customer?.delivery_locations || customer?.deliveryLocations || []).filter((row: any) => !isDeleted(row));
  const filteredPsvItems = psvStatus === "all" ? psvItems : psvItems.filter((row) => row.status.toLowerCase() === psvStatus);

  if (!customer) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">Customer details are unavailable. Return to Customer Master and open a customer record.</div>;
  }

  const openTab = (tab: CorporateTabKey) => {
    setActiveTab(tab);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-900 dark:bg-[#111827] dark:text-slate-100 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#1a202c]">
          <div className="flex items-center gap-3">
            <Building2 className="text-sky-700 dark:text-sky-300" size={24} />
            <div>
              <h1 className="text-lg font-semibold">{textValue(displayName)}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Customer {textValue(customer.code)} · {textValue(customer.customer_type || customer.customerType || "Customer")}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"}`}>{status}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {onSelectCustomer && <button type="button" onClick={() => setShowCustomerSearch(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700"><Search size={15} />Search customer</button>}
            {onBack && <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700"><ArrowLeft size={15} />Back</button>}
            {onEditCustomer && <button type="button" onClick={() => onEditCustomer(customer)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700"><Pencil size={15} />Edit customer</button>}
            {isDirty && onSave && <button type="button" onClick={onSave} disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save changes</button>}
            {isActive && onDeactivate && <button type="button" onClick={onDeactivate} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-900 dark:text-rose-300"><Ban size={15} />Deactivate</button>}
          </div>
        </header>

        {onSelectCustomer && <SmritiAdvancedCustomerSearchModal
          isOpen={showCustomerSearch}
          onClose={() => setShowCustomerSearch(false)}
          onSelectCustomer={selectedCustomer => {
            onSelectCustomer(selectedCustomer);
            setShowCustomerSearch(false);
          }}
        />}

        <CorporateCustomerTabs activeTab={activeTab} onTabChange={openTab} />

        {activeTab === "overview" && <div className="space-y-4">
          {isDirty && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><strong>Changes are not saved.</strong><span className="ml-1">Use “Save changes” above to persist the customer update.</span></div>}
          {!isActive && <div role="status" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"><strong>New billing is blocked.</strong><span className="ml-1">This customer is {status.toLowerCase()}. Review the account in Customer Master if its status needs to change.</span></div>}
          {creditHold && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><strong>Credit invoices are on hold.</strong><span className="ml-1">Review the customer’s company commercial terms before processing a credit sale.</span><button type="button" onClick={() => openTab("commercial")} className="ml-2 font-semibold underline">Review terms</button></div>}
          {pendingPsvQty > 0 && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><div><strong>{pendingPsvQty.toLocaleString("en-IN")} units await PSV approval.</strong><span className="ml-1">Unapproved receipts are not included in approved stock.</span></div><button type="button" onClick={() => openTab("psv")} className="rounded-lg border border-amber-500 px-3 py-2 font-semibold">Review reconciliation</button></div>}
          {psvError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"><span><strong>PSV status could not be loaded.</strong><span className="ml-1">{psvError}</span></span><button type="button" onClick={() => openTab("psv")} className="font-semibold underline">Review PSV data</button></div>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<Users size={18} />} label="Child customers" value={String(children.length)} onClick={() => openTab("parent_child")} />
            <Metric icon={<Store size={18} />} label="Active stores / outlets" value={`${activeStores} / ${stores.length}`} onClick={() => openTab("stores")} />
            <Metric icon={<CreditCard size={18} />} label="Credit limit" value={amountValue(customer.credit_limit ?? customer.creditLimit)} onClick={() => openTab("commercial")} />
            <Metric icon={<PackageCheck size={18} />} label="PSV pending approval" value={psvLoading && !psvSummary ? "Loading" : psvSummary ? psvSummary.total_pending_approval_qty.toLocaleString("en-IN") : "Not available"} onClick={() => openTab("psv")} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Customer identity" description="Saved customer master information.">
              <dl className="grid gap-4 sm:grid-cols-2"><Field label="Legal name" value={customer.legal_name || customer.legalName || customer.name} /><Field label="Customer code" value={customer.code} /><Field label="Customer group" value={customer.customer_group_name || customer.customerGroupName || customer.customer_group_id || customer.customerGroupId} /><Field label="GSTIN" value={customer.gst_number || customer.gstNumber || customer.gstin} /><Field label="PAN" value={customer.pan_number || customer.panNumber || customer.pan} /><Field label="Mobile" value={customer.mobile || customer.phone} /></dl>
            </Section>
            <Section title="Recent transactions" description="Recent orders or invoices returned for this customer.">
              {invoices.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{invoices.slice(0, 5).map((row: any, index: number) => <div key={row.id || row.order_no || row.invoice_number || index} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><div className="font-medium">{textValue(row.order_no || row.invoice_number || row.no || row.invoice_no)}</div><div className="text-xs text-slate-500">{textValue(row.date)}</div></div><div className="text-right"><div>{amountValue(row.value ?? row.total_amount ?? row.amount)}</div><div className="text-xs text-slate-500">{textValue(row.status)}</div></div></div>)}</div> : <p className="text-sm text-slate-500">No recent orders or invoices are available for this customer.</p>}
            </Section>
          </div>
        </div>}

        {activeTab === "basic" && <Section title="Customer details"><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Customer code" value={customer.code} /><Field label="Name" value={customer.name} /><Field label="Display name" value={displayName} /><Field label="Customer type" value={customer.customer_type || customer.customerType} /><Field label="Status" value={status} /><Field label="Customer group" value={customer.customer_group_name || customer.customer_group_id || customer.customerGroupId} /><Field label="Mobile" value={customer.mobile || customer.phone} /><Field label="Email" value={customer.email} /><Field label="Company" value={customer.company_name || customer.company_id} /></dl></Section>}

        {activeTab === "corporate_tax" && <div className="space-y-4"><Section title="Legal and tax identity"><dl className="grid gap-4 sm:grid-cols-2"><Field label="Legal name" value={customer.legal_name || customer.legalName || customer.name} /><Field label="PAN" value={customer.pan_number || customer.panNumber || customer.pan} /><Field label="Registered address" value={customer.registered_address || customer.registeredAddress || customer.address_line1 || customer.addressLine1 || (billingLocations.length > 0 ? (billingLocations[0].address_line1 || billingLocations[0].addressLine1 || billingLocations[0].address) : "")} /><Field label="GSTIN" value={customer.gst_number || customer.gstNumber || customer.gstin} /></dl></Section><Section title="GST registrations" description="Registrations saved against this customer.">{gstRegistrations.length ? <DataTable headers={["GSTIN", "State", "Status", "Primary"]} rows={gstRegistrations.map((row: any) => [row.gstin, row.state_name || row.stateName || row.state, row.status, (row.is_primary ?? row.isPrimary) ? "Yes" : "No"])} /> : <Empty>No GST registrations are recorded.</Empty>}</Section></div>}

        {activeTab === "addresses" && <div className="grid gap-4 lg:grid-cols-2"><Section title="Billing locations">{billingLocations.length ? <DataTable headers={["Location", "Address", "City", "Default"]} rows={billingLocations.map((row: any) => [row.location_name || row.locationName || row.name || "Billing Location", row.address_line1 || row.addressLine1 || row.address || "—", row.city || "—", (row.is_default ?? row.isDefault) ? "Yes" : "No"])} /> : <Empty>No billing locations are recorded.</Empty>}</Section><Section title="Delivery locations">{deliveryLocations.length ? <DataTable headers={["Store code", "Location", "City", "Status"]} rows={deliveryLocations.map((row: any) => [row.store_code || row.storeCode || "—", row.location_name || row.locationName || row.name || "Delivery Location", row.city || "—", row.status || "Active"])} /> : <Empty>No delivery locations are recorded.</Empty>}</Section></div>}

        {activeTab === "parent_child" && <Section title="Customer relationships" description="Linked customer accounts are separate records from delivery locations.">{children.length ? <><DataTable headers={["Customer code", "Customer", "Status"]} rows={children.map((row: any) => [row.dependant_customer_code || row.dependantCustomerCode || row.customer_code || row.customerCode || row.code || "—", row.dependant_customer_name || row.dependantCustomerName || row.customer_name || row.customerName || row.name || "Child Account", row.dependant_customer_status || row.dependantCustomerStatus || row.status || "Active"])} /><p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Child customers appear in billing only when this parent’s “Show Child Customers in Billing” setting is enabled.</p><p className="mt-1 text-sm font-medium">Billing visibility: {customer.show_child_customers_in_billing || customer.showChildCustomersInBilling ? "Enabled" : "Disabled"}</p></> : <Empty>This customer has no linked child accounts.</Empty>}</Section>}

        {activeTab === "stores" && <Section title="Stores and outlets" description="Non-deleted delivery locations associated with this customer.">{stores.length ? <DataTable headers={["Store code", "Location", "City", "State", "Type", "Status"]} rows={stores.map((row: any) => [row.store_code || row.storeCode || "—", row.store_name || row.storeName || row.name || "—", row.city || "—", row.state || "—", row.store_type || row.storeType || "Store", row.status || "Active"])} /> : <Empty>No stores or delivery outlets are recorded.</Empty>}</Section>}

        {activeTab === "commercial" && <Section title="Commercial terms" description="Customer credit policy and group information returned for this company."><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Customer group" value={customer.customer_group_name || customer.customer_group_id || customer.customerGroupId} /><Field label="Credit limit" value={amountValue(customer.credit_limit ?? customer.creditLimit)} /><Field label="Credit days" value={customer.credit_days ?? customer.creditDays} /><Field label="Credit hold" value={creditHold ? "On hold" : "Not on hold"} /><Field label="Credit ledger balance" value={amountValue(customer.credit_used ?? customer.creditUsed ?? customer.outstanding)} /></dl><p className="mt-4 text-xs text-slate-500">Commercial terms are maintained in the existing Customer Master workflow.</p></Section>}

        {activeTab === "sales_invoices" && <Section title="Recent orders and invoices">{invoices.length ? <DataTable headers={["Document", "Date", "Amount", "Status"]} rows={invoices.map((row: any) => [row.order_no || row.invoice_number || row.no || row.invoice_no, row.date, amountValue(row.value ?? row.total_amount ?? row.amount), row.status])} /> : <Empty>No recent orders or invoices are available.</Empty>}</Section>}

        {activeTab === "psv" && <div className="space-y-4"><Section title="PSV quantity reconciliation" description="Received quantities remain pending until approved through the physical stock verification workflow."><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2 text-xs"><MetricValue label="Document" value={psvSummary?.total_document_qty} /><MetricValue label="Received" value={psvSummary?.total_received_qty} /><MetricValue label="Approved" value={psvSummary?.total_approved_qty} /><MetricValue label="Pending approval" value={psvSummary?.total_pending_approval_qty} /><MetricValue label="Shortage" value={psvSummary?.total_short_qty} /><MetricValue label="Excess" value={psvSummary?.total_excess_qty} /></div><div className="flex items-center gap-2"><select aria-label="Filter PSV status" value={psvStatus} onChange={(event) => setPsvStatus(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="all">All statuses</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="shortage">Shortage</option><option value="excess">Excess</option><option value="rejected">Rejected</option></select><button type="button" onClick={loadPsv} disabled={psvLoading} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm disabled:opacity-60 dark:border-slate-700"><RefreshCw size={14} className={psvLoading ? "animate-spin" : ""} />Refresh</button></div></div>{psvError && <p role="alert" className="mb-3 text-sm text-rose-700 dark:text-rose-300">{psvError}</p>}{psvLoading && <p role="status" className="mb-3 text-sm text-slate-500">Loading reconciliation…</p>}{filteredPsvItems.length ? <DataTable headers={["Document", "Date", "Store", "Article / Style", "Document qty", "Received", "Approved", "Pending", "Shortage", "Excess", "Status"]} rows={filteredPsvItems.map((row) => [row.doc_no, row.date, row.store_code, row.article_style, row.document_qty, row.received_qty, row.approved_qty, row.pending_approval_qty, row.shortage_qty, row.excess_qty, row.status])} /> : !psvLoading && <Empty>No PSV reconciliation rows match this filter.</Empty>}</Section></div>}
      </div>
    </main>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string; onClick: () => void }> = ({ icon, label, value, onClick }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-sky-400 dark:border-slate-800 dark:bg-[#1a202c]">
    <span className="text-sky-700 dark:text-sky-300">{icon}</span><span><span className="block text-xs text-slate-500 dark:text-slate-400">{label}</span><span className="mt-1 block text-base font-semibold text-slate-900 dark:text-white">{value}</span></span>
  </button>
);

const MetricValue: React.FC<{ label: string; value?: number }> = ({ label, value }) => (
  <div className="rounded-lg bg-slate-100 px-2.5 py-2 dark:bg-slate-800"><span className="block text-slate-500 dark:text-slate-400">{label}</span><strong>{value === undefined ? "Not available" : value.toLocaleString("en-IN")}</strong></div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>;

const DataTable: React.FC<{ headers: string[]; rows: unknown[][] }> = ({ headers, rows }) => (
  <div className="overflow-x-auto"><table className="w-full min-w-[520px] border-collapse text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">{headers.map((header) => <th key={header} className="px-3 py-2 font-medium">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-slate-100 last:border-0 dark:border-slate-800">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2.5 text-slate-800 dark:text-slate-200">{textValue(cell)}</td>)}</tr>)}</tbody></table></div>
);
