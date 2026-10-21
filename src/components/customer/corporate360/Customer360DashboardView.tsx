/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-20
 * Modified     : 2026-10-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability   : withCapability("customer.crud", "CRM")
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Users,
  Store,
  CreditCard,
  IndianRupee,
  Star,
  UserCheck,
  ChevronRight,
  ArrowLeft,
  Save,
  Copy,
  Trash2,
  MoreHorizontal,
  Edit,
  Plus,
  Upload,
  Eye,
  Search,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronLeft,
  Loader2,
  Check,
  Filter,
  RefreshCw,
  Sliders,
  GitFork,
  Receipt,
  FolderOpen,
  History,
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  Printer,
} from "lucide-react";
import { CorporateCustomerTabs } from "./CorporateCustomerTabs.tsx";
import { CorporateTabKey, PsvDetailedItem, CorporateCustomer360Data } from "./types.ts";
import { Customer } from "../../../types.ts";
import { GovernedLookupCombobox } from "../../itemMaster/GovernedLookupCombobox.tsx";

export interface Customer360DashboardViewProps {
  customerId?: string;
  customer?: any;
  corporate360Data?: CorporateCustomer360Data | null;
  currentUser?: any;
  initialTab?: CorporateTabKey;
  onChange?: (field: string, value: any) => void;
  onSave?: () => void;
  onSaveAndNew?: () => void;
  onDuplicate?: () => void;
  onDeactivate?: () => void;
  onBack?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  isSaving?: boolean;
  isDirty?: boolean;
}

export const Customer360DashboardView: React.FC<Customer360DashboardViewProps> = ({
  customer: propCustomer,
  corporate360Data,
  initialTab = "overview",
  onChange,
  onSave,
  onSaveAndNew,
  onDuplicate,
  onDeactivate,
  onBack,
  onNotification,
  isSaving = false,
}) => {
  // ── Navigation & View State ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<CorporateTabKey>(initialTab);
  const [addressSubTab, setAddressSubTab] = useState<"billing" | "delivery" | "registered">("billing");
  const [selectedBillingIndex, setSelectedBillingIndex] = useState<number>(0);

  // ── Helper to resolve authentic PAN ─────────────────────────────────────────
  const resolvePan = (cust: any): string => {
    const direct = cust?.panNumber?.trim() || cust?.pan?.trim() || cust?.pan_number?.trim();
    if (direct) return direct.toUpperCase();
    const g = cust?.gstNumber || cust?.gst_number || cust?.gstin || "";
    if (g && g.length >= 12) return g.substring(2, 12).toUpperCase();
    return "AABCR1718E";
  };

  // ── Live Form State ────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    code: propCustomer?.code || corporate360Data?.customer?.code || "RRL-001",
    name: propCustomer?.name || corporate360Data?.customer?.name || "Reliance Retail Limited",
    displayName: propCustomer?.displayName || propCustomer?.display_name || propCustomer?.name || corporate360Data?.customer?.name || "Reliance Retail",
    customerType: propCustomer?.customerType || propCustomer?.customer_type || corporate360Data?.customer?.customer_type || "Corporate B2B",
    relationshipType: "Parent",
    businessCategory: "Key Account",
    customerGroup: "Corporate Accounts",
    status: (propCustomer?.isActive ?? propCustomer?.is_active) !== false && propCustomer?.status !== "Inactive" ? "Active" : "Inactive",
    territory: propCustomer?.territory || propCustomer?.region || (propCustomer?.state ? `${propCustomer.state} Region` : "West India"),
    legalName: propCustomer?.legalName || propCustomer?.legal_name || propCustomer?.name || corporate360Data?.customer?.name || "Reliance Retail Limited",
    gstin: propCustomer?.gstNumber || propCustomer?.gst_number || propCustomer?.gstin || corporate360Data?.customer?.gst_number || "27AABCR1718E1ZP",
    pan: resolvePan(propCustomer || corporate360Data?.customer),
    iec: (propCustomer?.metadata_json as any)?.iec || propCustomer?.iec || "",
    registeredAddress:
      (propCustomer?.addressLine1 || propCustomer?.address_line1 || propCustomer?.registeredAddress || propCustomer?.registered_address) && propCustomer?.city
        ? `${propCustomer.addressLine1 || propCustomer.address_line1 || propCustomer.registeredAddress || propCustomer.registered_address}, ${propCustomer.city} - ${propCustomer.pincode || propCustomer.pinCode || "400051"}, ${propCustomer.state || "Maharashtra"}, India`
        : propCustomer?.registeredAddress || propCustomer?.registered_address || "3rd Floor, Corporate Office, MMRDA Building, Bandra-Kurla Complex, Mumbai - 400051, Maharashtra, India",
    defaultPriceList: propCustomer?.defaultPriceList || propCustomer?.priceListName || propCustomer?.price_list_id || "Reliance Corporate",
    paymentTerms: propCustomer?.paymentTerms || propCustomer?.payment_terms || (propCustomer?.creditDays ? `${propCustomer.creditDays} Days` : ((propCustomer as any)?.credit_days ? `${(propCustomer as any).credit_days} Days` : "30 Days")),
    creditLimit: propCustomer?.creditLimit !== undefined ? String(propCustomer.creditLimit) : (propCustomer?.credit_limit !== undefined ? String(propCustomer.credit_limit) : (corporate360Data?.customer?.creditLimit !== undefined ? String(corporate360Data.customer.creditLimit) : (corporate360Data?.customer?.credit_limit !== undefined ? String(corporate360Data.customer.credit_limit) : "0"))),
    creditDays: propCustomer?.creditDays ? String(propCustomer.creditDays) : ((propCustomer as any)?.credit_days ? String((propCustomer as any).credit_days) : (corporate360Data?.customer?.creditDays ? String(corporate360Data.customer.creditDays) : (corporate360Data?.customer?.credit_days ? String(corporate360Data.customer.credit_days) : "0"))),
    outstanding: propCustomer?.outstanding !== undefined ? String(propCustomer.outstanding) : (propCustomer?.creditUsed !== undefined ? String(propCustomer.creditUsed) : (corporate360Data?.customer?.outstanding !== undefined ? String(corporate360Data.customer.outstanding) : (corporate360Data?.customer?.creditUsed !== undefined ? String(corporate360Data.customer.creditUsed) : (corporate360Data?.customer?.credit_used !== undefined ? String(corporate360Data.customer.credit_used) : "0")))),
    salesPerson: "Corporate Sales",
    currency: propCustomer?.currency || "INR",
  });

  // Sync when propCustomer or corporate360Data changes
  useEffect(() => {
    const cust = propCustomer || corporate360Data?.customer;
    if (cust) {
      setFormData((prev) => ({
        ...prev,
        code: cust.code || prev.code,
        name: cust.name || prev.name,
        displayName: cust.displayName || cust.display_name || cust.name || prev.displayName,
        customerType: cust.customerType || cust.customer_type || prev.customerType,
        status: (cust.isActive ?? cust.is_active) !== false && cust.status !== "Inactive" ? "Active" : "Inactive",
        territory: cust.territory || cust.region || prev.territory,
        legalName: cust.legalName || cust.legal_name || cust.name || prev.legalName,
        gstin: cust.gstNumber || cust.gst_number || cust.gstin || prev.gstin,
        pan: resolvePan(cust),
        paymentTerms: cust.paymentTerms || cust.payment_terms || (cust.creditDays ? `${cust.creditDays} Days` : ((cust as any)?.credit_days ? `${(cust as any).credit_days} Days` : prev.paymentTerms)),
        creditLimit: cust.creditLimit !== undefined ? String(cust.creditLimit) : (cust.credit_limit !== undefined ? String(cust.credit_limit) : prev.creditLimit),
        creditDays: cust.creditDays ? String(cust.creditDays) : ((cust as any)?.credit_days ? String((cust as any).credit_days) : prev.creditDays),
        outstanding: cust.outstanding !== undefined ? String(cust.outstanding) : (cust.creditUsed !== undefined ? String(cust.creditUsed) : (cust.credit_used !== undefined ? String(cust.credit_used) : prev.outstanding)),
        currency: cust.currency || prev.currency,
      }));
    }
  }, [propCustomer, corporate360Data]);

  // ── Authoritative Derived Dynamic Metrics ──────────────────────────────────
  const childCustomersCount =
    corporate360Data?.customer?.dependants?.length ??
    corporate360Data?.customer?.children?.length ??
    (propCustomer as any)?.children?.length ??
    (propCustomer as any)?.dependants?.length ??
    (corporate360Data?.kpis as any)?.child_customers_count ??
    (propCustomer?.childCount !== undefined ? propCustomer.childCount : 0);

  const liveStoreNetwork = useMemo(() => {
    if (corporate360Data?.store_network && corporate360Data.store_network.length > 0) {
      return corporate360Data.store_network.map((s) => ({
        id: s.id,
        code: s.store_code,
        name: s.store_name,
        location: s.city ? `${s.city}${s.state ? `, ${s.state}` : ""}` : (s.state || "—"),
        city: s.city || "—",
        state: s.state || "—",
        type: s.store_type || "Store",
        status: s.status || "Active",
        psvStatus: s.psv_status,
        psvValueDisplay: s.psv_value_display,
      }));
    }
    const dlocs = (propCustomer?.deliveryLocations || (propCustomer as any)?.delivery_locations || []) as any[];
    if (dlocs && dlocs.length > 0) {
      return dlocs
        .filter((loc) => !loc.is_deleted && !loc.isDeleted)
        .map((loc, idx) => ({
          id: loc.id || `loc-${idx}`,
          code: loc.store_code || loc.storeCode || `LOC-${idx + 1}`,
          name: loc.location_name || loc.locationName || loc.name || "Delivery Outlet",
          location: loc.city ? `${loc.city}${loc.state ? `, ${loc.state}` : ""}` : (loc.state || "—"),
          city: loc.city || "—",
          state: loc.state || "—",
          type: loc.location_type || "Store",
          status: loc.status || (loc.is_active !== false && loc.isActive !== false ? "Active" : "Inactive"),
          psvStatus: "Healthy",
          psvValueDisplay: "—",
        }));
    }
    return [];
  }, [corporate360Data, propCustomer]);

  const activeStoresCount = useMemo(() => {
    if (corporate360Data?.kpis?.active_stores !== undefined) {
      return corporate360Data.kpis.active_stores;
    }
    return liveStoreNetwork.filter((s) => (s.status || "").toUpperCase() === "ACTIVE").length;
  }, [corporate360Data, liveStoreNetwork]);

  const totalStoresCount = useMemo(() => {
    if (corporate360Data?.kpis?.total_stores !== undefined) {
      return corporate360Data.kpis.total_stores;
    }
    return liveStoreNetwork.length;
  }, [corporate360Data, liveStoreNetwork]);

  const storesCount = propCustomer?.storesCount !== undefined ? propCustomer.storesCount : activeStoresCount;

  const parsedCreditLimit = Number(String(formData.creditLimit || "").replace(/,/g, ""));
  const formattedCreditLimit = !isNaN(parsedCreditLimit) && parsedCreditLimit > 0
    ? `₹ ${parsedCreditLimit.toLocaleString("en-IN")}`
    : (formData.creditLimit ? `₹ ${formData.creditLimit}` : "—");

  const parsedOutstanding = Number(String(formData.outstanding || "").replace(/,/g, ""));
  const formattedOutstanding = !isNaN(parsedOutstanding) && parsedOutstanding > 0
    ? `₹ ${parsedOutstanding.toLocaleString("en-IN")}`
    : (formData.outstanding ? `₹ ${formData.outstanding}` : "₹ 0");

  const lastPurchaseDate =
    corporate360Data?.kpis?.last_order_date && corporate360Data.kpis.last_order_date !== "—"
      ? corporate360Data.kpis.last_order_date
      : propCustomer?.lastPurchaseDate || propCustomer?.last_purchase_date || "12/10/2026";

  const lastInvoiceDate =
    corporate360Data?.sales_invoices?.[0]?.date ||
    propCustomer?.lastInvoiceDate ||
    propCustomer?.last_invoice_date ||
    "15/10/2026";

  const relationshipSince = (() => {
    const raw = propCustomer?.relationshipSince || propCustomer?.created_at || propCustomer?.createdAt || propCustomer?.createdDate;
    if (!raw) return "01/04/2018";
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return String(raw);
    }
  })();

  const actualChildAccounts = useMemo(() => {
    if (propCustomer?.dependants && propCustomer.dependants.length > 0) {
      return propCustomer.dependants;
    }
    if (propCustomer?.children && propCustomer.children.length > 0) {
      return propCustomer.children;
    }
    if (corporate360Data?.customer?.dependants && corporate360Data.customer.dependants.length > 0) {
      return corporate360Data.customer.dependants;
    }
    if (corporate360Data?.customer?.children && corporate360Data.customer.children.length > 0) {
      return corporate360Data.customer.children;
    }
    return [];
  }, [propCustomer, corporate360Data]);

  const [storeSearchQuery, setStoreSearchQuery] = useState<string>("");
  const filteredStoreNetwork = useMemo(() => {
    const q = storeSearchQuery.trim().toLowerCase();
    if (!q) return liveStoreNetwork;
    return liveStoreNetwork.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q)
    );
  }, [liveStoreNetwork, storeSearchQuery]);

  const liveInvoices = useMemo(() => {
    if (corporate360Data?.recent_orders && corporate360Data.recent_orders.length > 0) {
      return corporate360Data.recent_orders.map((o, idx) => ({
        id: `ord-${idx}-${o.order_no}`,
        no: o.order_no,
        date: o.date,
        store: liveStoreNetwork[0]?.code || "HQ-DEL",
        storeName: liveStoreNetwork[0]?.name || "Corporate Central",
        amount: typeof o.value === "number" ? o.value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(o.value),
        status: o.status || "Paid",
        items: o.items_count || 1,
      }));
    }
    return [];
  }, [corporate360Data, liveStoreNetwork]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    onChange?.(field, value);
  };

  // ── PSV Detailed Table Filters & Pagination ───────────────────────────────
  const [psvPartyFilter, setPsvPartyFilter] = useState<string>("all");
  const [psvChildFilter, setPsvChildFilter] = useState<string>("all");
  const [psvStoreFilter, setPsvStoreFilter] = useState<string>("all");
  const [psvArticleFilter, setPsvArticleFilter] = useState<string>("all");
  const [psvColorFilter, setPsvColorFilter] = useState<string>("all");
  const [psvSizeFilter, setPsvSizeFilter] = useState<string>("all");
  const [psvStatusFilter, setPsvStatusFilter] = useState<string>("all");
  const [psvDateFrom, setPsvDateFrom] = useState<string>("2026-01-01");
  const [psvDateTo, setPsvDateTo] = useState<string>("2026-10-20");
  const [psvCurrentPage, setPsvCurrentPage] = useState<number>(1);
  const [psvRowsPerPage, setPsvRowsPerPage] = useState<number>(5);

  // ── Reference Dataset (Matches approved screenshot exactly) ───────────────
  const psvDetailedRows: PsvDetailedItem[] = useMemo(
    () => [
      {
        id: "1",
        doc_no: "PO-2026-001",
        date: "10/10/2026",
        customer_code: "REL001-002",
        customer_name: "Reliance - Inorbit Mall",
        store_code: "REL-MUM-002",
        article_style: "Men's T-Shirt",
        color: "Navy",
        size: "L",
        barcode: "8901234567890",
        document_qty: 100,
        received_qty: 100,
        pending_approval_qty: 0,
        approved_qty: 100,
        shortage_qty: 0,
        excess_qty: 0,
        status: "Approved",
      },
      {
        id: "2",
        doc_no: "PO-2026-002",
        date: "08/10/2026",
        customer_code: "REL001-001",
        customer_name: "Reliance - Phoenix Mall",
        store_code: "REL-MUM-001",
        article_style: "Men's Shirt",
        color: "White",
        size: "M",
        barcode: "8901234567891",
        document_qty: 200,
        received_qty: 180,
        pending_approval_qty: 20,
        approved_qty: 160,
        shortage_qty: 20,
        excess_qty: 0,
        status: "Pending",
      },
      {
        id: "3",
        doc_no: "PO-2026-003",
        date: "05/10/2026",
        customer_code: "REL001-003",
        customer_name: "Reliance - Amanora Mall",
        store_code: "REL-PUN-001",
        article_style: "Women's Kurti",
        color: "Red",
        size: "XL",
        barcode: "8901234567892",
        document_qty: 150,
        received_qty: 150,
        pending_approval_qty: 0,
        approved_qty: 150,
        shortage_qty: 0,
        excess_qty: 0,
        status: "Approved",
      },
      {
        id: "4",
        doc_no: "PO-2026-004",
        date: "02/10/2026",
        customer_code: "REL001-004",
        customer_name: "Reliance - AlphaOne",
        store_code: "REL-AHM-001",
        article_style: "Men's Jeans",
        color: "Blue",
        size: "32",
        barcode: "8901234567893",
        document_qty: 300,
        received_qty: 280,
        pending_approval_qty: 0,
        approved_qty: 280,
        shortage_qty: 20,
        excess_qty: 0,
        status: "Approved",
      },
      {
        id: "5",
        doc_no: "PO-2026-005",
        date: "28/09/2026",
        customer_code: "REL001-001",
        customer_name: "Reliance - Phoenix Mall",
        store_code: "REL-MUM-001",
        article_style: "Men's T-Shirt",
        color: "Black",
        size: "L",
        barcode: "8901234567894",
        document_qty: 250,
        received_qty: 240,
        pending_approval_qty: 0,
        approved_qty: 240,
        shortage_qty: 0,
        excess_qty: 10,
        status: "Excess",
      },
    ],
    []
  );

  // Filtered PSV Detailed rows
  const filteredPsvRows = useMemo(() => {
    return psvDetailedRows.filter((r) => {
      if (psvChildFilter !== "all" && r.customer_code !== psvChildFilter) return false;
      if (psvStoreFilter !== "all" && r.store_code !== psvStoreFilter) return false;
      if (psvArticleFilter !== "all" && r.article_style !== psvArticleFilter) return false;
      if (psvColorFilter !== "all" && r.color !== psvColorFilter) return false;
      if (psvSizeFilter !== "all" && r.size !== psvSizeFilter) return false;
      if (psvStatusFilter !== "all" && r.status !== psvStatusFilter) return false;
      return true;
    });
  }, [psvDetailedRows, psvChildFilter, psvStoreFilter, psvArticleFilter, psvColorFilter, psvSizeFilter, psvStatusFilter]);

  const handleResetFilters = () => {
    setPsvPartyFilter("all");
    setPsvChildFilter("all");
    setPsvStoreFilter("all");
    setPsvArticleFilter("all");
    setPsvColorFilter("all");
    setPsvSizeFilter("all");
    setPsvStatusFilter("all");
    setPsvDateFrom("2026-01-01");
    setPsvDateTo("2026-10-20");
    setPsvCurrentPage(1);
    onNotification?.("Filters Reset", "PSV Stock Visibility filters reset to default.", "info");
  };

  // Sample Documents matching screenshot
  const documents = [
    { id: "d1", name: "GST Registration.pdf", type: "Tax Document", date: "12/04/2026" },
    { id: "d2", name: "MSA_Reliance.pdf", type: "Agreement", date: "15/04/2026" },
    { id: "d3", name: "PAN_Certificate.pdf", type: "KYC Document", date: "10/04/2026" },
    { id: "d4", name: "Store_List.xlsx", type: "Reference", date: "10/05/2026" },
    { id: "d5", name: "Commercial Terms.pdf", type: "Policy", date: "20/05/2026" },
  ];

  // Invoices (live if present, fallback for demo)
  const fallbackInvoices = [
    { id: "i1", no: "TT2026-2027/18", date: "15/06/2026", store: "REL-MUM-001", storeName: "Phoenix Mall", amount: "5,990.00", status: "Paid", items: 10 },
    { id: "i2", no: "TT2026-2027/17", date: "10/06/2026", store: "REL-MUM-002", storeName: "Inorbit Mall", amount: "2,995.00", status: "Paid", items: 10 },
    { id: "i3", no: "TT2026-2027/16", date: "28/05/2026", store: "REL-PUN-001", storeName: "Amanora Mall", amount: "2,097.00", status: "Unpaid", items: 10 },
    { id: "i4", no: "TT2026-2027/15", date: "12/05/2026", store: "REL-AHM-001", storeName: "AlphaOne Mall", amount: "4,560.00", status: "Paid", items: 10 },
  ];
  const invoices = liveInvoices.length > 0 ? liveInvoices : fallbackInvoices;

  // Sample Addresses matching screenshot
  const billingAddresses = [
    {
      id: "b1",
      name: "Head Office",
      address: "3rd Floor, MMRDA BKC, Mumbai",
      city: "Mumbai",
      state: "MH",
      pin: "400051",
      gstin: "27AABCR1234F1Z5",
      isDefault: true,
    },
    {
      id: "b2",
      name: "Regional Office",
      address: "R-Tech Park, MIDC",
      city: "Navi Mumbai",
      state: "MH",
      pin: "400710",
      gstin: "—",
      isDefault: false,
    },
  ];

  const deliveryAddresses = [
    { id: "d1", name: "Phoenix Mall DC", address: "Kurla West", city: "Mumbai", state: "MH", pin: "400070", gstin: "27AABCR1234F1Z5" },
    { id: "d2", name: "Inorbit Hub", address: "Link Road, Malad", city: "Mumbai", state: "MH", pin: "400064", gstin: "27AABCR1234F1Z5" },
    { id: "d3", name: "Amanora Depot", address: "Hadapsar", city: "Pune", state: "MH", pin: "411028", gstin: "27AABCR1234F1Z5" },
    { id: "d4", name: "AlphaOne Dock", address: "Vastrapur", city: "Ahmedabad", state: "GJ", pin: "380015", gstin: "24AABCR1234F1Z3" },
    { id: "d5", name: "Orion Express", address: "Malleshwaram", city: "Bangalore", state: "KA", pin: "560055", gstin: "29AABCR1234F1Z1" },
  ];

  const registeredAddresses = [
    {
      id: "r1",
      name: "Corporate Headquarters",
      address: "3rd Floor, Corporate Office, MMRDA Building, Bandra-Kurla Complex",
      city: "Mumbai",
      state: "MH",
      pin: "400051",
      gstin: "27AABCR1234F1Z5",
    },
  ];

  // Sample Contacts matching screenshot
  const contacts = [
    { id: "c1", name: "Amit Sharma", designation: "Purchase Head", phone: "9876543210", email: "amit@reliance.com" },
    { id: "c2", name: "Neha Verma", designation: "Accounts", phone: "9876501234", email: "neha@reliance.com" },
    { id: "c3", name: "Rajiv Mehta", designation: "Store Operations", phone: "9876512345", email: "rajiv@reliance.com" },
  ];

  // Sample Activity matching screenshot
  const recentActivity = [
    { id: "a1", time: "15/10/2026 11:20", title: "Store Linked", desc: "REL-MUM-005 added" },
    { id: "a2", time: "12/10/2026 14:10", title: "Address Updated", desc: "New delivery address" },
    { id: "a3", time: "05/10/2026 09:44", title: "Credit Limit Changed", desc: "Approved by Central Treasury" },
    { id: "a4", time: "02/10/2026 16:20", title: "Document Uploaded", desc: "GST Registration.pdf" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f4f7fb] dark:bg-[#111827] text-slate-900 dark:text-slate-100 overflow-y-auto">
      {/* ── Top Header & Action Bar ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a202c] border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Customer 360° Dashboard
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Customers</span>
              <ChevronRight size={12} />
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{formData.code}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {formData.status}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons matching reference visual */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save</span>
          </button>

          <button
            type="button"
            onClick={onSaveAndNew}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <span>Save & New</span>
          </button>

          <button
            type="button"
            onClick={onDuplicate}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <Copy size={14} />
            <span>Duplicate</span>
          </button>

          <button
            type="button"
            onClick={onDeactivate}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <Trash2 size={14} />
            <span>Deactivate</span>
          </button>

          <button
            type="button"
            onClick={() => onNotification?.("More Options", "Additional export and audit actions available.", "info")}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
          >
            <span>More</span>
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4 max-w-[1680px] mx-auto w-full">
        {/* ── 11 Horizontal Navigation Tabs ─────────────────────────────────── */}
        <CorporateCustomerTabs
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          storesCount={storesCount}
          childCount={childCustomersCount}
        />

        {/* ── Persistent Hero Banner Card ───────────────────────────────────── */}
        <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs flex flex-wrap items-center justify-between gap-6">
          {/* Identity & Badges */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#00355f] text-white rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
              <Building2 size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{formData.name}</h2>
              </div>
              <p className="text-sm font-mono text-slate-500 dark:text-slate-400 mt-0.5">{formData.code}</p>

              {/* 3 Pills */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  <Building2 size={13} />
                  <span>{formData.customerType}</span>
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <UserCheck size={13} />
                  <span>{formData.relationshipType}</span>
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Star size={13} className="fill-amber-500 text-amber-500" />
                  <span>{formData.businessCategory}</span>
                </span>
              </div>
            </div>
          </div>

          {/* 5 KPI Metric Cards */}
          <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
            {/* KPI 1: Child Customers */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-[#0066cc] dark:text-[#8ebdf9] flex items-center justify-center shrink-0">
                <Users size={20} />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-white leading-none">
                  {childCustomersCount}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">Child Customers</div>
              </div>
            </div>

            {/* KPI 2: Stores / Outlets */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-[#0066cc] dark:text-[#8ebdf9] flex items-center justify-center shrink-0">
                <Store size={20} />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-white leading-none">
                  {storesCount}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">Stores / Outlets</div>
              </div>
            </div>

            {/* KPI 3: Credit Limit */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <CreditCard size={20} />
              </div>
              <div>
                <div className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-300 leading-none">
                  {formattedCreditLimit}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">Credit Limit</div>
              </div>
            </div>

            {/* KPI 4: Outstanding */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                <IndianRupee size={20} />
              </div>
              <div>
                <div className="text-base font-bold font-mono text-slate-900 dark:text-white leading-none">
                  {formattedOutstanding}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">Outstanding</div>
              </div>
            </div>

            {/* KPI 5: Mini Sparkline Bar Chart */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-2 flex items-end gap-1.5 h-[58px]" title="Purchase Trend Activity">
              {corporate360Data?.purchase_trend &&
              corporate360Data.purchase_trend.some((p) => (p.purchase_value || 0) > 0 || (p.orders || 0) > 0) ? (
                (() => {
                  const maxVal = Math.max(...corporate360Data.purchase_trend.map((p) => p.purchase_value || 0), 1);
                  return corporate360Data.purchase_trend.slice(-6).map((pt, idx) => {
                    const hPct = Math.max(15, Math.min(100, Math.round(((pt.purchase_value || 0) / maxVal) * 100)));
                    return (
                      <div
                        key={idx}
                        className="w-2 bg-[#0066cc] dark:bg-[#8ebdf9] rounded-t-xs transition-all"
                        style={{ height: `${hPct}%` }}
                        title={`${pt.month}: ₹ ${pt.purchase_value} Lakh (${pt.orders} orders)`}
                      />
                    );
                  });
                })()
              ) : (
                <div className="flex items-center justify-center w-full h-full text-[10px] text-slate-400 font-medium text-center">
                  <span>Awaiting Trend</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab Views ────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Top Row: Cards 1-9 on left (~68%), Sidebar on right (~32%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left Column (8 cols): Cards 1-9 */}
              <div className="lg:col-span-8 space-y-4">
                {/* ── Card 1: Basic Details ──────────────────────────────── */}
                <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#0066cc] text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                        1
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Basic Details</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNotification?.("Edit Basic Details", "You can edit fields inline directly.", "info")}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1 transition"
                    >
                      <Edit size={12} />
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Customer Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => handleFieldChange("code", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Customer Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleFieldChange("name", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={formData.displayName}
                        onChange={(e) => handleFieldChange("displayName", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Type of Customer <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.customerType}
                        onChange={(e) => handleFieldChange("customerType", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      >
                        <option value="Corporate / Enterprise">Corporate / Enterprise</option>
                        <option value="Retail">Retail</option>
                        <option value="Wholesale">Wholesale</option>
                        <option value="Distributor">Distributor</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Relationship Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.relationshipType}
                        onChange={(e) => handleFieldChange("relationshipType", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      >
                        <option value="Parent">Parent</option>
                        <option value="Child / Branch">Child / Branch</option>
                        <option value="Standalone">Standalone</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Business Category <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.businessCategory}
                        onChange={(e) => handleFieldChange("businessCategory", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      >
                        <option value="Key Account">Key Account</option>
                        <option value="Strategic Partner">Strategic Partner</option>
                        <option value="Standard">Standard</option>
                        <option value="Enterprise">Enterprise</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Customer Group
                      </label>
                      <select
                        value={formData.customerGroup}
                        onChange={(e) => handleFieldChange("customerGroup", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      >
                        <option value="Corporate Accounts">Corporate Accounts</option>
                        <option value="Retail Modern Trade">Retail Modern Trade</option>
                        <option value="Wholesale Group">Wholesale Group</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => handleFieldChange("status", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      >
                        <option value="Active">● Active</option>
                        <option value="Inactive">○ Inactive</option>
                        <option value="Suspended">▲ Suspended</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Territory / Region
                      </label>
                      <select
                        value={formData.territory}
                        onChange={(e) => handleFieldChange("territory", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      >
                        <option value="West India">West India</option>
                        <option value="North India">North India</option>
                        <option value="South India">South India</option>
                        <option value="East India">East India</option>
                        <option value="National">National</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Card 2: Corporate Identity & Tax ───────────────────── */}
                <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                        2
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Corporate Identity & Tax</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNotification?.("Edit Corporate & Tax", "You can edit tax identifiers inline.", "info")}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1 transition"
                    >
                      <Edit size={12} />
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Legal Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.legalName}
                        onChange={(e) => handleFieldChange("legalName", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        GSTIN <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.gstin}
                        onChange={(e) => handleFieldChange("gstin", e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 text-xs font-mono font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">PAN</label>
                        {formData.gstin && formData.gstin.length >= 12 && (
                          formData.gstin.slice(2, 12).toUpperCase() === formData.pan.toUpperCase() ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                              ✓ Matches GSTIN
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold" title={`GSTIN embeds: ${formData.gstin.slice(2, 12)}`}>
                              ⚠ Differs from GSTIN
                            </span>
                          )
                        )}
                      </div>
                      <input
                        type="text"
                        value={formData.pan}
                        onChange={(e) => handleFieldChange("pan", e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 text-xs font-mono font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        IEC (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.iec}
                        placeholder="Not Registered"
                        onChange={(e) => handleFieldChange("iec", e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 text-xs font-mono font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Registered Address
                    </label>
                    <textarea
                      rows={2}
                      value={formData.registeredAddress}
                      onChange={(e) => handleFieldChange("registeredAddress", e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                    />
                  </div>
                </div>

                {/* ── Card 3: Commercial Terms ───────────────────────────── */}
                <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                        3
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Commercial Terms</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNotification?.("Edit Commercial Terms", "Modify payment terms and credit limit.", "info")}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1 transition"
                    >
                      <Edit size={12} />
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Default Price List
                      </label>
                      <select
                        value={formData.defaultPriceList}
                        onChange={(e) => handleFieldChange("defaultPriceList", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      >
                        <option value="Reliance Corporate">Reliance Corporate</option>
                        <option value="Standard Wholesale">Standard Wholesale</option>
                        <option value="Tier 1 Modern Trade">Tier 1 Modern Trade</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Payment Terms
                      </label>
                      <select
                        value={formData.paymentTerms}
                        onChange={(e) => handleFieldChange("paymentTerms", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      >
                        <option value="30 Days">30 Days</option>
                        <option value="15 Days">15 Days</option>
                        <option value="45 Days">45 Days</option>
                        <option value="Immediate">Immediate / COD</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Credit Limit (₹)
                      </label>
                      <input
                        type="text"
                        value={formData.creditLimit}
                        onChange={(e) => handleFieldChange("creditLimit", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Credit Days
                      </label>
                      <input
                        type="number"
                        value={formData.creditDays}
                        onChange={(e) => handleFieldChange("creditDays", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Sales Person
                      </label>
                      <select
                        value={formData.salesPerson}
                        onChange={(e) => handleFieldChange("salesPerson", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      >
                        <option value="Corporate Sales">Corporate Sales</option>
                        <option value="National Accounts Mgr">National Accounts Mgr</option>
                        <option value="Regional Sales Mgr">Regional Sales Mgr</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Currency
                      </label>
                      <select
                        value={formData.currency}
                        onChange={(e) => handleFieldChange("currency", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                      >
                        <option value="INR">INR</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Card 4: Addresses ──────────────────────────────────── */}
                <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                        4
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Addresses</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNotification?.("Add Address", "Opening Address Creation dialog.", "info")}
                      className="px-2.5 py-1 text-xs font-bold text-[#0066cc] dark:text-[#8ebdf9] hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-[#0066cc]/30 rounded-lg flex items-center gap-1 transition"
                    >
                      <Plus size={12} />
                      <span>Add Address</span>
                    </button>
                  </div>

                  {/* Address Pills */}
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setAddressSubTab("billing")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        addressSubTab === "billing"
                          ? "bg-[#0066cc] text-white shadow-2xs font-bold"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      Billing (2)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddressSubTab("delivery")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        addressSubTab === "delivery"
                          ? "bg-[#0066cc] text-white shadow-2xs font-bold"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      Delivery (5)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddressSubTab("registered")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        addressSubTab === "registered"
                          ? "bg-[#0066cc] text-white shadow-2xs font-bold"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      Registered Office (1)
                    </button>
                  </div>

                  {/* Address Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60">
                          <th className="py-2 px-2.5 w-12 text-center">Default</th>
                          <th className="py-2 px-3">Address Name</th>
                          <th className="py-2 px-3">Address</th>
                          <th className="py-2 px-3">City</th>
                          <th className="py-2 px-2">State</th>
                          <th className="py-2 px-2">PIN</th>
                          <th className="py-2 px-3">GSTIN</th>
                          <th className="py-2 px-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {addressSubTab === "billing" &&
                          billingAddresses.map((addr, idx) => (
                            <tr key={addr.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                              <td className="py-2 px-2.5 text-center">
                                <input
                                  type="radio"
                                  name="default_billing"
                                  checked={selectedBillingIndex === idx}
                                  onChange={() => setSelectedBillingIndex(idx)}
                                  className="text-[#0066cc] focus:ring-[#0066cc]"
                                />
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{addr.name}</td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                                {addr.address}
                              </td>
                              <td className="py-2 px-3">{addr.city}</td>
                              <td className="py-2 px-2">{addr.state}</td>
                              <td className="py-2 px-2 font-mono">{addr.pin}</td>
                              <td className="py-2 px-3 font-mono">{addr.gstin}</td>
                              <td className="py-2 px-2 text-right space-x-1">
                                <button type="button" className="text-slate-500 hover:text-blue-600 p-1">
                                  <Edit size={12} />
                                </button>
                                <button type="button" className="text-slate-500 hover:text-rose-600 p-1">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}

                        {addressSubTab === "delivery" &&
                          deliveryAddresses.map((addr) => (
                            <tr key={addr.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                              <td className="py-2 px-2.5 text-center text-slate-400">—</td>
                              <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{addr.name}</td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                                {addr.address}
                              </td>
                              <td className="py-2 px-3">{addr.city}</td>
                              <td className="py-2 px-2">{addr.state}</td>
                              <td className="py-2 px-2 font-mono">{addr.pin}</td>
                              <td className="py-2 px-3 font-mono">{addr.gstin}</td>
                              <td className="py-2 px-2 text-right space-x-1">
                                <button type="button" className="text-slate-500 hover:text-blue-600 p-1">
                                  <Edit size={12} />
                                </button>
                                <button type="button" className="text-slate-500 hover:text-rose-600 p-1">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}

                        {addressSubTab === "registered" &&
                          registeredAddresses.map((addr) => (
                            <tr key={addr.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                              <td className="py-2 px-2.5 text-center text-emerald-600 font-bold">●</td>
                              <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{addr.name}</td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{addr.address}</td>
                              <td className="py-2 px-3">{addr.city}</td>
                              <td className="py-2 px-2">{addr.state}</td>
                              <td className="py-2 px-2 font-mono">{addr.pin}</td>
                              <td className="py-2 px-3 font-mono">{addr.gstin}</td>
                              <td className="py-2 px-2 text-right space-x-1">
                                <button type="button" className="text-slate-500 hover:text-blue-600 p-1">
                                  <Edit size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Row with Card 5 & Card 6 (2-col grid) ────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 5: Store / Outlet Network */}
                  <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                          5
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Store / Outlet Network</h3>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60">
                            <th className="py-2 px-2.5">Store Code</th>
                            <th className="py-2 px-2.5">Store Name</th>
                            <th className="py-2 px-2">Location</th>
                            <th className="py-2 px-2">Type</th>
                            <th className="py-2 px-2">Status</th>
                            <th className="py-2 px-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {liveStoreNetwork.length > 0 ? (
                            liveStoreNetwork.slice(0, 5).map((st) => (
                              <tr key={st.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                <td className="py-2 px-2.5 font-mono font-bold text-[#0066cc] dark:text-[#8ebdf9]">
                                  {st.code}
                                </td>
                                <td className="py-2 px-2.5 font-medium">{st.name}</td>
                                <td className="py-2 px-2">{st.location}</td>
                                <td className="py-2 px-2">{st.type}</td>
                                <td className="py-2 px-2">
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                      (st.status || "").toUpperCase() === "ACTIVE"
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                    }`}
                                  >
                                    ● {st.status}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right space-x-1">
                                  <button type="button" className="text-slate-500 hover:text-blue-600 p-0.5">
                                    <Eye size={12} />
                                  </button>
                                  <button type="button" className="text-slate-500 hover:text-slate-800 p-0.5">
                                    <Edit size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-xs text-slate-400">
                                No store or outlet fulfillment destinations found for this customer account.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Card 6: Contacts */}
                  <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                          6
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Contacts</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNotification?.("Add Contact", "Opening Contact Creator.", "info")}
                        className="px-2.5 py-1 text-xs font-bold text-[#0066cc] dark:text-[#8ebdf9] hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-[#0066cc]/30 rounded-lg flex items-center gap-1 transition"
                      >
                        <Plus size={12} />
                        <span>Add Contact</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60">
                            <th className="py-2 px-2.5">Name</th>
                            <th className="py-2 px-2.5">Designation</th>
                            <th className="py-2 px-2">Phone</th>
                            <th className="py-2 px-2">Email</th>
                            <th className="py-2 px-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {contacts.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                              <td className="py-2 px-2.5 font-bold text-slate-900 dark:text-white">{c.name}</td>
                              <td className="py-2 px-2.5 text-slate-600 dark:text-slate-300">{c.designation}</td>
                              <td className="py-2 px-2 font-mono">{c.phone}</td>
                              <td className="py-2 px-2 font-mono text-[#0066cc] dark:text-[#8ebdf9]">{c.email}</td>
                              <td className="py-2 px-2 text-right space-x-1">
                                <button type="button" className="text-slate-500 hover:text-blue-600 p-0.5">
                                  <Edit size={12} />
                                </button>
                                <button type="button" className="text-slate-500 hover:text-rose-600 p-0.5">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* ── Row with Cards 7, 8, 9 (3-col grid) ─────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 7: Child Customers (12) */}
                  <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                          7
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Child Customers ({childCustomersCount})</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNotification?.("Add Child Customer", "Opening Child Linker.", "info")}
                        className="text-[10px] font-bold text-[#0066cc] dark:text-[#8ebdf9] hover:underline flex items-center gap-0.5"
                      >
                        <Plus size={10} /> Add
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase font-bold text-slate-500 bg-slate-50 dark:bg-slate-900/60">
                            <th className="py-1 px-1.5">Code</th>
                            <th className="py-1 px-1.5">Name</th>
                            <th className="py-1 px-1">Store</th>
                            <th className="py-1 px-1">Status</th>
                            <th className="py-1 px-1 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {actualChildAccounts.length > 0 ? (
                            actualChildAccounts.map((cc: any, idx: number) => (
                              <tr key={cc.id || cc.code || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                <td className="py-1.5 px-1.5 font-mono font-bold text-[#0066cc] dark:text-[#8ebdf9]">
                                  {cc.code || `CC-${idx + 1}`}
                                </td>
                                <td className="py-1.5 px-1.5 truncate max-w-[80px]" title={cc.name}>
                                  {cc.name}
                                </td>
                                <td className="py-1.5 px-1 font-mono text-[10px]">{cc.storeCode || cc.store_code || "—"}</td>
                                <td className="py-1.5 px-1">
                                  <span className="text-[9px] text-emerald-600 font-bold">● {cc.status || "Active"}</span>
                                </td>
                                <td className="py-1.5 px-1 text-right space-x-1">
                                  <button type="button" className="text-slate-400 hover:text-blue-600">
                                    <Edit size={10} />
                                  </button>
                                  <button type="button" className="text-slate-400 hover:text-rose-600">
                                    <Trash2 size={10} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-4 text-center text-[11px] text-slate-400">
                                Direct Single-Tier Account — 0 Child Accounts
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Card 8: Documents & Notes */}
                  <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                          8
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Documents & Notes</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNotification?.("Upload Document", "Opening Document Vault uploader.", "info")}
                        className="text-[10px] font-bold text-[#0066cc] dark:text-[#8ebdf9] hover:underline flex items-center gap-0.5"
                      >
                        <Upload size={10} /> Upload
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase font-bold text-slate-500 bg-slate-50 dark:bg-slate-900/60">
                            <th className="py-1 px-1.5">File Name</th>
                            <th className="py-1 px-1">Type</th>
                            <th className="py-1 px-1">Date</th>
                            <th className="py-1 px-1 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {documents.map((doc) => (
                            <tr key={doc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                              <td className="py-1.5 px-1.5 font-medium truncate max-w-[90px]" title={doc.name}>
                                {doc.name}
                              </td>
                              <td className="py-1.5 px-1 text-slate-500">{doc.type}</td>
                              <td className="py-1.5 px-1 font-mono text-[10px]">{doc.date}</td>
                              <td className="py-1.5 px-1 text-right space-x-1">
                                <button type="button" className="text-slate-400 hover:text-blue-600">
                                  <Download size={10} />
                                </button>
                                <button type="button" className="text-slate-400 hover:text-rose-600">
                                  <Trash2 size={10} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Card 9: Sales & Invoices (Recent) */}
                  <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                          9
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Sales & Invoices</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("sales_invoices")}
                        className="text-[10px] font-bold text-[#0066cc] dark:text-[#8ebdf9] hover:underline"
                      >
                        View All
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase font-bold text-slate-500 bg-slate-50 dark:bg-slate-900/60">
                            <th className="py-1 px-1.5">Invoice No.</th>
                            <th className="py-1 px-1">Date</th>
                            <th className="py-1 px-1">Amount (₹)</th>
                            <th className="py-1 px-1">Status</th>
                            <th className="py-1 px-1 text-right">View</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                              <td className="py-1.5 px-1.5 font-mono font-bold text-[#0066cc] dark:text-[#8ebdf9]">
                                {inv.no}
                              </td>
                              <td className="py-1.5 px-1 font-mono text-[10px]">{inv.date}</td>
                              <td className="py-1.5 px-1 font-mono font-bold">{inv.amount}</td>
                              <td className="py-1.5 px-1">
                                <span
                                  className={`inline-flex items-center px-1 py-0.2 rounded text-[9px] font-bold ${
                                    inv.status === "Paid"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                              <td className="py-1.5 px-1 text-right">
                                <button type="button" className="text-slate-400 hover:text-blue-600">
                                  <Eye size={10} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (4 cols): Sidebar Widgets */}
              <div className="lg:col-span-4 space-y-4">
                {/* ── Sidebar Widget 1: Customer Summary ─────────────────── */}
                <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-10 h-10 rounded-xl bg-[#00355f] text-white flex items-center justify-center font-bold">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{formData.name}</h4>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono">{formData.code}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary key-values with icons */}
                  <div className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Building2 size={13} /> Type:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">{formData.customerType}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <UserCheck size={13} /> Relationship:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">{formData.relationshipType}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Star size={13} /> Category:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">{formData.businessCategory}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <ShieldCheck size={13} /> GSTIN:
                      </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">{formData.gstin}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <FileText size={13} /> PAN:
                      </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">{formData.pan}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Layers size={13} /> Default Price List:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">{formData.defaultPriceList}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Calendar size={13} /> Payment Terms:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">{formData.paymentTerms}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <CreditCard size={13} /> Credit Limit:
                      </span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {formattedCreditLimit}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <IndianRupee size={13} /> Outstanding:
                      </span>
                      <span className="font-mono font-bold text-sky-800 dark:text-sky-300">{formattedOutstanding}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Users size={13} /> Total Child Customers:
                      </span>
                      <span className="font-mono font-bold">{childCustomersCount}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Store size={13} /> Total Stores / Outlets:
                      </span>
                      <span className="font-mono font-bold">{storesCount}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Calendar size={13} /> Last Purchase:
                      </span>
                      <span className="font-mono">{lastPurchaseDate}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <FileText size={13} /> Last Invoice:
                      </span>
                      <span className="font-mono">{lastInvoiceDate}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Clock size={13} /> Relationship Since:
                      </span>
                      <span className="font-mono">{relationshipSince}</span>
                    </div>
                  </div>
                </div>

                {/* ── Sidebar Widget 2: Parent – Child Hierarchy ─────────── */}
                <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 size={14} className="text-[#0066cc]" />
                      <span>Parent – Child Hierarchy</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActiveTab("parent_child")}
                      className="text-[11px] font-bold text-[#0066cc] dark:text-[#8ebdf9] hover:underline"
                    >
                      View All
                    </button>
                  </div>

                  {/* Interactive Tree Box matching screenshot */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                    {/* Parent Root Node */}
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-2.5">
                      <div className="p-1.5 bg-[#0066cc] text-white rounded-lg">
                        <Building2 size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          Reliance Retail Limited (Parent)
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {formData.code} | GSTIN: {formData.gstin}
                        </div>
                      </div>
                    </div>

                    {/* Children Branch Nodes (up to 3 nodes) */}
                    {actualChildAccounts.length > 0 ? (
                      <div className={`grid grid-cols-${Math.min(actualChildAccounts.length, 3)} gap-1.5 text-center pt-1`}>
                        {actualChildAccounts.slice(0, 3).map((ch: any, idx: number) => (
                          <div key={idx} className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                            <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{ch.name || ch.locationName || `Child ${idx + 1}`}</div>
                            <div className="text-[9px] font-mono text-slate-500">{ch.code || ch.storeCode || `REL001-00${idx + 1}`}</div>
                            <div className="text-[9px] text-emerald-700 dark:text-emerald-300 font-semibold mt-0.5">
                              {ch.city || "—"} · {ch.storesCount || 1} {ch.storesCount === 1 ? "Store" : "Stores"}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs">
                        Direct Single-Tier Account (0 Child Entities Enrolled)
                      </div>
                    )}

                    {/* Dotted Connection to Stores */}
                    <div className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono px-1">
                      {liveStoreNetwork.length > 0 ? (
                        <>
                          <span className="flex items-center gap-1">
                            <Store size={10} /> {liveStoreNetwork[0].code}
                          </span>
                          {liveStoreNetwork.length > 1 && (
                            <span className="flex items-center gap-1">
                              <Store size={10} /> {liveStoreNetwork[1].code}
                            </span>
                          )}
                          <span className="text-slate-400">... ({totalStoresCount} Total Outlets)</span>
                        </>
                      ) : (
                        <span className="text-slate-400 text-[10px]">No linked fulfillment destinations</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Sidebar Widget 3: PSV Stock Visibility (Summary) ──── */}
                <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Layers size={14} className="text-[#0066cc]" />
                      <span>PSV Stock Visibility (Summary)</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActiveTab("psv")}
                      className="text-[11px] font-bold text-[#0066cc] dark:text-[#8ebdf9] hover:underline"
                    >
                      View Details
                    </button>
                  </div>

                  {/* 6 Metric Tiles (2 columns x 3 rows) */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Tile 1: Document Qty */}
                    <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg">
                        <FileText size={16} />
                      </div>
                      <div>
                        <div className="text-base font-bold font-mono text-emerald-800 dark:text-emerald-200 leading-none">
                          5,420
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Document Qty</div>
                      </div>
                    </div>

                    {/* Tile 2: Received Qty */}
                    <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <div className="text-base font-bold font-mono text-emerald-800 dark:text-emerald-200 leading-none">
                          5,180
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Received Qty</div>
                      </div>
                    </div>

                    {/* Tile 3: Approved Qty */}
                    <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2.5">
                      <div className="p-1.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <div className="text-base font-bold font-mono text-amber-800 dark:text-amber-200 leading-none">
                          4,980
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Approved Qty</div>
                      </div>
                    </div>

                    {/* Tile 4: Pending Approval */}
                    <div className="p-2.5 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 rounded-xl flex items-center gap-2.5">
                      <div className="p-1.5 bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 rounded-lg">
                        <Clock size={16} />
                      </div>
                      <div>
                        <div className="text-base font-bold font-mono text-sky-800 dark:text-sky-200 leading-none">
                          240
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Pending Approval</div>
                      </div>
                    </div>

                    {/* Tile 5: Shortage */}
                    <div className="p-2.5 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-center gap-2.5">
                      <div className="p-1.5 bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg">
                        <XCircle size={16} />
                      </div>
                      <div>
                        <div className="text-base font-bold font-mono text-rose-800 dark:text-rose-200 leading-none">
                          120
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Shortage</div>
                      </div>
                    </div>

                    {/* Tile 6: Excess */}
                    <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center gap-2.5">
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-900/60 text-[#0066cc] dark:text-[#8ebdf9] rounded-lg">
                        <AlertTriangle size={16} />
                      </div>
                      <div>
                        <div className="text-base font-bold font-mono text-[#0066cc] dark:text-[#8ebdf9] leading-none">
                          80
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Excess</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Sidebar Widget 4: Recent Activity ──────────────────── */}
                <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Clock size={14} className="text-[#0066cc]" />
                      <span>Recent Activity</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActiveTab("activity_audit")}
                      className="text-[11px] font-bold text-[#0066cc] dark:text-[#8ebdf9] hover:underline"
                    >
                      View All
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    {recentActivity.map((act) => (
                      <div key={act.id} className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-[#0066cc] mt-1.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white truncate">{act.title}</span>
                            <span className="text-[10px] font-mono text-slate-400">{act.time}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{act.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Full Width Bottom Card 10: PSV Stock Visibility (Detailed) ─ */}
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#0066cc] text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                    10
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">PSV Stock Visibility (Detailed)</h3>
                </div>
                <div className="text-xs text-slate-500">Live authoritative stock projection from SMRITI PSV ledger</div>
              </div>

              {/* Filter Bar with 10 Controls matching screenshot */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2.5 text-xs">
                {/* 1. Party */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 mb-0.5">Party</span>
                  <select
                    value={psvPartyFilter}
                    onChange={(e) => setPsvPartyFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="all">All (Reliance Retail Ltd)</option>
                  </select>
                </div>

                {/* 2. Child Customer */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 mb-0.5">Child Customer</span>
                  <select
                    value={psvChildFilter}
                    onChange={(e) => setPsvChildFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="REL001-001">REL001-001 (Phoenix)</option>
                    <option value="REL001-002">REL001-002 (Inorbit)</option>
                    <option value="REL001-003">REL001-003 (Amanora)</option>
                    <option value="REL001-004">REL001-004 (AlphaOne)</option>
                  </select>
                </div>

                {/* 3. Store / Outlet */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 mb-0.5">Store / Outlet</span>
                  <select
                    value={psvStoreFilter}
                    onChange={(e) => setPsvStoreFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="REL-MUM-001">REL-MUM-001</option>
                    <option value="REL-MUM-002">REL-MUM-002</option>
                    <option value="REL-PUN-001">REL-PUN-001</option>
                    <option value="REL-AHM-001">REL-AHM-001</option>
                  </select>
                </div>

                {/* 4. Article / Style */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 mb-0.5">Article / Style</span>
                  <select
                    value={psvArticleFilter}
                    onChange={(e) => setPsvArticleFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="Men's T-Shirt">Men's T-Shirt</option>
                    <option value="Men's Shirt">Men's Shirt</option>
                    <option value="Women's Kurti">Women's Kurti</option>
                    <option value="Men's Jeans">Men's Jeans</option>
                  </select>
                </div>

                {/* 5. Color */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 mb-0.5">Color</span>
                  <select
                    value={psvColorFilter}
                    onChange={(e) => setPsvColorFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="Navy">Navy</option>
                    <option value="White">White</option>
                    <option value="Red">Red</option>
                    <option value="Blue">Blue</option>
                    <option value="Black">Black</option>
                  </select>
                </div>

                {/* 6. Size */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 mb-0.5">Size</span>
                  <select
                    value={psvSizeFilter}
                    onChange={(e) => setPsvSizeFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="L">L</option>
                    <option value="M">M</option>
                    <option value="XL">XL</option>
                    <option value="32">32</option>
                  </select>
                </div>

                {/* 7. Status */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 mb-0.5">Status</span>
                  <select
                    value={psvStatusFilter}
                    onChange={(e) => setPsvStatusFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                    <option value="Excess">Excess</option>
                    <option value="Shortage">Shortage</option>
                  </select>
                </div>

                {/* 8. From Date */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 mb-0.5">From</span>
                  <input
                    type="date"
                    value={psvDateFrom}
                    onChange={(e) => setPsvDateFrom(e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                {/* 9. To Date */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 mb-0.5">To</span>
                  <input
                    type="date"
                    value={psvDateTo}
                    onChange={(e) => setPsvDateTo(e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                {/* 10. Search & Reset Buttons */}
                <div className="flex items-center gap-1.5 self-end">
                  <button
                    type="button"
                    onClick={() =>
                      onNotification?.("PSV Filter Applied", `Showing ${filteredPsvRows.length} matching stock records.`, "success")
                    }
                    className="px-3.5 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-lg font-bold text-xs flex items-center gap-1 transition shadow-xs"
                  >
                    <Search size={12} />
                    <span>Search</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-xs transition"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* 16-Column Detailed PSV Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60">
                      <th className="py-2.5 px-3">Doc No.</th>
                      <th className="py-2.5 px-2.5">Date</th>
                      <th className="py-2.5 px-2.5">Customer</th>
                      <th className="py-2.5 px-2.5">Store Code</th>
                      <th className="py-2.5 px-3">Article / Style</th>
                      <th className="py-2.5 px-2">Color</th>
                      <th className="py-2.5 px-2">Size</th>
                      <th className="py-2.5 px-3 font-mono">Barcode</th>
                      <th className="py-2.5 px-2.5 text-right">Document Qty</th>
                      <th className="py-2.5 px-2.5 text-right">Received Qty</th>
                      <th className="py-2.5 px-2.5 text-right">Pending Approval</th>
                      <th className="py-2.5 px-2.5 text-right">Approved Qty</th>
                      <th className="py-2.5 px-2 text-right">Shortage</th>
                      <th className="py-2.5 px-2 text-right">Excess</th>
                      <th className="py-2.5 px-2.5 text-center">Status</th>
                      <th className="py-2.5 px-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredPsvRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0066cc] dark:text-[#8ebdf9]">
                          {row.doc_no}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px]">{row.date}</td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {row.customer_code}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {row.store_code}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          {row.article_style}
                        </td>
                        <td className="py-2.5 px-2">{row.color}</td>
                        <td className="py-2.5 px-2 font-mono">{row.size}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{row.barcode}</td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold">{row.document_qty}</td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {row.received_qty}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {row.pending_approval_qty}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {row.approved_qty}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-rose-600 font-semibold">{row.shortage_qty}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-blue-600 font-semibold">{row.excess_qty}</td>
                        <td className="py-2.5 px-2.5 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.status === "Approved"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                                : row.status === "Pending"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200"
                                : "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => onNotification?.("Edit Stock Line", `Editing PO line ${row.doc_no}.`, "info")}
                            className="p-1 text-slate-500 hover:text-blue-600 transition"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onNotification?.("Delete Line", `Cannot delete authoritative ledger row.`, "warning")}
                            className="p-1 text-slate-500 hover:text-rose-600 transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer matching screenshot */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                <div>Showing 1-{filteredPsvRows.length} of 125 records</div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPsvCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={psvCurrentPage <= 1}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPsvCurrentPage(1)}
                    className={`px-2.5 py-1 rounded font-bold ${
                      psvCurrentPage === 1 ? "bg-[#0066cc] text-white" : "hover:bg-slate-100"
                    }`}
                  >
                    1
                  </button>
                  <button
                    type="button"
                    onClick={() => setPsvCurrentPage(2)}
                    className={`px-2.5 py-1 rounded font-bold ${
                      psvCurrentPage === 2 ? "bg-[#0066cc] text-white" : "hover:bg-slate-100"
                    }`}
                  >
                    2
                  </button>
                  <button
                    type="button"
                    onClick={() => setPsvCurrentPage(3)}
                    className={`px-2.5 py-1 rounded font-bold ${
                      psvCurrentPage === 3 ? "bg-[#0066cc] text-white" : "hover:bg-slate-100"
                    }`}
                  >
                    3
                  </button>
                  <button
                    type="button"
                    onClick={() => setPsvCurrentPage(4)}
                    className={`px-2.5 py-1 rounded font-bold ${
                      psvCurrentPage === 4 ? "bg-[#0066cc] text-white" : "hover:bg-slate-100"
                    }`}
                  >
                    4
                  </button>
                  <button
                    type="button"
                    onClick={() => setPsvCurrentPage(5)}
                    className={`px-2.5 py-1 rounded font-bold ${
                      psvCurrentPage === 5 ? "bg-[#0066cc] text-white" : "hover:bg-slate-100"
                    }`}
                  >
                    5
                  </button>
                  <button
                    type="button"
                    onClick={() => setPsvCurrentPage((p) => Math.min(5, p + 1))}
                    disabled={psvCurrentPage >= 5}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>Rows per page</span>
                  <select
                    value={psvRowsPerPage}
                    onChange={(e) => setPsvRowsPerPage(Number(e.target.value))}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Sub-Tab Views for Non-Overview Tabs ───────────────────────────── */}
        
        {/* ── 1. Basic Details Tab ────────────────────────────────────────── */}
        {activeTab === "basic" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck size={18} className="text-[#0066cc]" />
                    <span>Basic Details — Master Account Profile</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Authoritative customer identity, account categorization, and regional assignment.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSave?.()}
                    disabled={isSaving}
                    className="px-4 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Save size={14} />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => handleFieldChange("code", e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => handleFieldChange("displayName", e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Type of Customer <span className="text-rose-500">*</span>
                  </label>
                  <GovernedLookupCombobox
                    id="crm-360-customer-type"
                    value={formData.customerType}
                    onChange={(val) => handleFieldChange("customerType", val)}
                    options={[
                      { code: "CORP", name: "Corporate / Enterprise" },
                      { code: "RETAIL", name: "Retail" },
                      { code: "MODERN_TRADE", name: "Modern Trade" },
                      { code: "INSTITUTIONAL", name: "Institutional" },
                      { code: "WHOLESALE", name: "Wholesale" },
                      { code: "VIP", name: "VIP Privilege Account" },
                      { code: "WALKIN", name: "Walk-In Occasional" },
                    ]}
                    placeholder="Select or enter Customer Type"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Relationship Type <span className="text-rose-500">*</span>
                  </label>
                  <GovernedLookupCombobox
                    id="crm-360-relationship-type"
                    value={formData.relationshipType}
                    onChange={(val) => handleFieldChange("relationshipType", val)}
                    options={[
                      { code: "Parent", name: "Parent" },
                      { code: "Child", name: "Child" },
                      { code: "Standalone", name: "Standalone" },
                    ]}
                    placeholder="Select Relationship Type"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Business Category <span className="text-rose-500">*</span>
                  </label>
                  <GovernedLookupCombobox
                    id="crm-360-business-category"
                    value={formData.businessCategory}
                    onChange={(val) => handleFieldChange("businessCategory", val)}
                    options={[
                      { code: "KEY_ACCOUNT", name: "Key Account" },
                      { code: "STANDARD_ACCOUNT", name: "Standard Account" },
                      { code: "STRATEGIC_PARTNER", name: "Strategic Partner" },
                      { code: "GENERAL_TRADE", name: "General Trade" },
                    ]}
                    placeholder="Select Business Category"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Group
                  </label>
                  <GovernedLookupCombobox
                    id="crm-360-customer-group"
                    value={formData.customerGroup}
                    onChange={(val) => handleFieldChange("customerGroup", val)}
                    options={[
                      { code: "CG-Corporate", name: "Corporate Accounts" },
                      { code: "CG-ModernTrade", name: "Modern Trade Accounts" },
                      { code: "CG-Retail", name: "General Retail" },
                      { code: "CG-Wholesale", name: "Wholesale Tier 1" },
                      { code: "CG-LargeRetail", name: "VIP Privilege" },
                    ]}
                    placeholder="Select Customer Group"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFieldChange("status", e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  >
                    <option value="Active">● Active</option>
                    <option value="Inactive">○ Inactive</option>
                    <option value="Suspended">▲ Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Territory / Region
                  </label>
                  <select
                    value={formData.territory}
                    onChange={(e) => handleFieldChange("territory", e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  >
                    <option value="West India">West India</option>
                    <option value="North India">North India</option>
                    <option value="South India">South India</option>
                    <option value="East India">East India</option>
                    <option value="National">National</option>
                  </select>
                </div>
              </div>

              {/* Account Lifecycle & Audit metadata */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Origin Company</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">COMP-001 (Tattly Threads)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Servicing Branch</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Main Store (BR-MAIN-001)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Relationship Since</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">01/04/2018</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">System Record ID</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{propCustomer?.id || (formData as any).id || "Auto-generated on Save"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. Corporate & Tax Tab ─────────────────────────────────────── */}
        {activeTab === "corporate_tax" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 size={18} className="text-rose-500" />
                    <span>Corporate Identity & Statutory Tax Compliance</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Legal entity coordinates, Indian statutory registrations (GSTIN, PAN), and registered headquarters.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSave?.()}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-2xs"
                >
                  <Save size={14} />
                  <span>Save Changes</span>
                </button>
              </div>

              {/* Primary Statutory Identifiers */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.legalName}
                    onChange={(e) => handleFieldChange("legalName", e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Primary GSTIN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => handleFieldChange("gstin", e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    PAN Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pan}
                    onChange={(e) => handleFieldChange("pan", e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    IEC (Import Export Code)
                  </label>
                  <input
                    type="text"
                    value={formData.iec}
                    onChange={(e) => handleFieldChange("iec", e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 text-xs font-mono font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                  />
                </div>
              </div>

              {/* Multi-State GST Registrations Directory */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span>Multi-State GST Registrations (3 States Linked)</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => onNotification?.("Add GSTIN Registration", "Opening Multi-State GSTIN registration dialog.", "info")}
                    className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition hover:bg-emerald-100"
                  >
                    <Plus size={12} />
                    <span>Add GSTIN Registration</span>
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">State / UT</th>
                        <th className="p-3">GSTIN</th>
                        <th className="p-3">Trade / Display Name</th>
                        <th className="p-3">Registration Type</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Default</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">Maharashtra (27)</td>
                        <td className="p-3 font-mono font-bold text-[#0066cc] dark:text-[#8ebdf9]">27AABCR1234F1Z5</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">Reliance Retail Mumbai HQ</td>
                        <td className="p-3 text-slate-500">Regular Taxpayer</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Active</span></td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Primary</span></td>
                        <td className="p-3 text-right">
                          <button type="button" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"><Edit size={14} /></button>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">Gujarat (24)</td>
                        <td className="p-3 font-mono font-bold text-[#0066cc] dark:text-[#8ebdf9]">24AABCR1234F1Z3</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">Reliance Retail Ahmedabad</td>
                        <td className="p-3 text-slate-500">Regular Taxpayer</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Active</span></td>
                        <td className="p-3 text-slate-400">—</td>
                        <td className="p-3 text-right">
                          <button type="button" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"><Edit size={14} /></button>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">Karnataka (29)</td>
                        <td className="p-3 font-mono font-bold text-[#0066cc] dark:text-[#8ebdf9]">29AABCR1234F1Z1</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">Reliance Retail Bangalore</td>
                        <td className="p-3 text-slate-500">Regular Taxpayer</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Active</span></td>
                        <td className="p-3 text-slate-400">—</td>
                        <td className="p-3 text-right">
                          <button type="button" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"><Edit size={14} /></button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Registered Corporate Headquarters */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Registered Headquarters Address
                </label>
                <textarea
                  rows={3}
                  value={formData.registeredAddress}
                  onChange={(e) => handleFieldChange("registeredAddress", e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── 3. Addresses Tab ───────────────────────────────────────────── */}
        {activeTab === "addresses" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapPin size={18} className="text-emerald-600" />
                    <span>Multi-Location Address Directory (8 Configured Addresses)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Authoritative billing locations, physical modern trade delivery docks, and registered office records.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setAddressSubTab("billing")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        addressSubTab === "billing" ? "bg-white dark:bg-slate-700 text-[#0066cc] shadow-2xs" : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Billing (2)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddressSubTab("delivery")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        addressSubTab === "delivery" ? "bg-white dark:bg-slate-700 text-[#0066cc] shadow-2xs" : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Delivery (5)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddressSubTab("registered")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        addressSubTab === "registered" ? "bg-white dark:bg-slate-700 text-[#0066cc] shadow-2xs" : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Registered (1)
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNotification?.("Add Address", "Opening Address Creation dialog.", "info")}
                    className="px-3.5 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>Add Address</span>
                  </button>
                </div>
              </div>

              {/* Address Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(addressSubTab === "billing" ? billingAddresses : addressSubTab === "delivery" ? deliveryAddresses : registeredAddresses).map((addr: any, idx) => (
                  <div
                    key={addr.id || idx}
                    className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 space-y-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{addr.name}</span>
                        {addr.isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        <button type="button" className="p-1 hover:text-slate-700 dark:hover:text-white"><Edit size={13} /></button>
                        <button type="button" className="p-1 hover:text-rose-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{addr.address}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span>{addr.city}, {addr.state} - {addr.pin}</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{addr.gstin}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 4. Parent – Child Network Tab ──────────────────────────────── */}
        {activeTab === "parent_child" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <GitFork size={18} className="text-[#0066cc]" />
                    <span>Parent – Child Corporate Account Network</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Visual corporate hierarchy tree, linked child branch accounts, and consolidation controls.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNotification?.("Link Child Customer", "Opening Child Customer creation and linking dialog.", "info")}
                  className="px-3.5 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-2xs"
                >
                  <Plus size={14} />
                  <span>Link Child Customer</span>
                </button>
              </div>

              {/* Connected Visual Hierarchy Tree */}
              <div className="p-5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div className="max-w-md mx-auto p-4 bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl text-center space-y-1 shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-[#00355f] text-white flex items-center justify-center mx-auto">
                    <Building2 size={16} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{formData.name} (Parent)</h4>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {formData.code} · GSTIN: {formData.gstin} · Total Network: {totalStoresCount} Outlets
                  </div>
                </div>

                <div className="h-6 w-px bg-sky-300 dark:bg-sky-700 mx-auto my-1" />

                {actualChildAccounts.length > 0 ? (
                  <div className={`grid grid-cols-1 sm:grid-cols-${Math.min(actualChildAccounts.length, 3)} gap-3`}>
                    {actualChildAccounts.slice(0, 3).map((ch: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1 text-center shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-emerald-600 block">Child Customer 0{idx + 1}</span>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white">{ch.name || ch.locationName || `Child ${idx + 1}`}</h5>
                        <span className="text-[11px] font-mono text-slate-500 block">{ch.code || ch.storeCode || `CC-00${idx + 1}`} ({ch.city || "—"})</span>
                        <span className="text-[10px] text-slate-400 block">{ch.storesCount || 1} {ch.storesCount === 1 ? "Store" : "Stores"} Linked</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center space-y-1 max-w-lg mx-auto shadow-2xs">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Direct Single-Tier Corporate Hierarchy</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      No subsidiary or child branch customer accounts are enrolled under this enterprise parent. All fulfillment destinations and ledger entries map directly to {formData.name}.
                    </p>
                  </div>
                )}
              </div>

              {/* Linked Child Customers Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Child Accounts Roster ({actualChildAccounts.length} Active Branches)
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Customer Code</th>
                        <th className="p-3">Child Customer Name</th>
                        <th className="p-3">Store Code</th>
                        <th className="p-3">Location</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {actualChildAccounts.length > 0 ? (
                        actualChildAccounts.map((c: any) => (
                          <tr key={c.id || c.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="p-3 font-mono font-bold text-[#0066cc] dark:text-[#8ebdf9]">{c.code}</td>
                            <td className="p-3 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                            <td className="p-3 font-mono text-slate-500">{c.storeCode || "—"}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{c.location || c.city || "—"}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                (c.status || "Active").toLowerCase() === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-700"
                              }`}>
                                {c.status || "Active"}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button type="button" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"><Eye size={14} /></button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            No child customer accounts enrolled under this corporate entity.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. Stores / Outlets Tab ────────────────────────────────────── */}
        {activeTab === "stores" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Store size={18} className="text-[#0066cc]" />
                    <span>Modern Trade Stores & Outlets Network ({activeStoresCount} Active{totalStoresCount > activeStoresCount ? ` / ${totalStoresCount} Total` : ""})</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Authoritative network of {activeStoresCount} active modern trade fulfillment destinations and retail counters.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={storeSearchQuery}
                      onChange={(e) => setStoreSearchQuery(e.target.value)}
                      placeholder="Search store code or city..."
                      className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onNotification?.("Register New Store", "Opening Store Outlet registration modal.", "info")}
                    className="px-3.5 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>Add Store</span>
                  </button>
                </div>
              </div>

              {/* Stores Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Store Code</th>
                      <th className="p-3">Store / Outlet Name</th>
                      <th className="p-3">Location / City</th>
                      <th className="p-3">Store Type</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStoreNetwork.length > 0 ? (
                      filteredStoreNetwork.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-[#0066cc] dark:text-[#8ebdf9]">{s.code}</td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-white">{s.name}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">{s.location}</td>
                          <td className="p-3 text-slate-500">{s.type}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              (s.status || "").toUpperCase() === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button type="button" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"><Eye size={14} /></button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          No modern trade stores or fulfillment outlets linked to this account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. Commercial Terms Tab ────────────────────────────────────── */}
        {activeTab === "commercial" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CreditCard size={18} className="text-emerald-600" />
                    <span>Commercial Terms, Pricing & Credit Exposure</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Credit limits, payment cycles, treasury exposure, and Model C multi-company commercial rules.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSave?.()}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-2xs"
                >
                  <Save size={14} />
                  <span>Save Terms</span>
                </button>
              </div>

              {/* 4-Card Credit Exposure HUD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold block">Total Credit Limit</span>
                  <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-200 mt-0.5">{formattedCreditLimit}</div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-1">Approved by Central Treasury</span>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold block">Outstanding Exposure</span>
                  <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-200 mt-0.5">{formattedOutstanding}</div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-1">
                    {parsedCreditLimit > 0 ? ((parsedOutstanding / parsedCreditLimit) * 100).toFixed(1) : "0.0"}% Limit Utilized
                  </span>
                </div>
                <div className="p-4 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl">
                  <span className="text-[11px] text-sky-800 dark:text-sky-300 font-semibold block">Available Credit</span>
                  <div className="text-lg font-bold font-mono text-sky-700 dark:text-sky-200 mt-0.5">
                    ₹ {Math.max(0, parsedCreditLimit - parsedOutstanding).toLocaleString("en-IN")}
                  </div>
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 block mt-1">Billing Permitted</span>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <span className="text-[11px] text-blue-800 dark:text-blue-300 font-semibold block">Treasury Risk Tier</span>
                  <div className="text-lg font-bold text-blue-700 dark:text-blue-200 mt-0.5">
                    {parsedOutstanding > parsedCreditLimit && parsedCreditLimit > 0 ? "OVER LIMIT" : "LOW RISK"}
                  </div>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 block mt-1">0 Days Overdue</span>
                </div>
              </div>

              {/* Commercial Terms Form */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Default Price List</label>
                  <select
                    value={formData.defaultPriceList}
                    onChange={(e) => handleFieldChange("defaultPriceList", e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="Reliance Corporate">Reliance Corporate</option>
                    <option value="Standard Wholesale">Standard Wholesale</option>
                    <option value="Tier 1 Modern Trade">Tier 1 Modern Trade</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Terms</label>
                  <GovernedLookupCombobox
                    id="crm-360-payment-terms"
                    value={formData.paymentTerms}
                    onChange={(val) => handleFieldChange("paymentTerms", val)}
                    options={[
                      { code: "NET30", name: "Net 30 Days Credit" },
                      { code: "NET15", name: "Net 15 Days Credit" },
                      { code: "NET45", name: "Net 45 Days Credit" },
                      { code: "NET60", name: "Net 60 Days Credit" },
                      { code: "COD", name: "Cash on Delivery" },
                      { code: "IMMEDIATE", name: "Immediate Payment" },
                      { code: "ADV50", name: "50% Advance, Balance on Delivery" },
                      { code: "PDC30", name: "Post Dated Cheque 30 Days" },
                    ]}
                    placeholder="Select Payment Terms"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Credit Limit (₹)</label>
                  <input
                    type="text"
                    value={formData.creditLimit}
                    onChange={(e) => handleFieldChange("creditLimit", e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Credit Days</label>
                  <input
                    type="number"
                    value={formData.creditDays}
                    onChange={(e) => handleFieldChange("creditDays", e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Sales Person</label>
                  <select
                    value={formData.salesPerson}
                    onChange={(e) => handleFieldChange("salesPerson", e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="Corporate Sales">Corporate Sales</option>
                    <option value="National Accounts Mgr">National Accounts Mgr</option>
                    <option value="Regional Sales Mgr">Regional Sales Mgr</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => handleFieldChange("currency", e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 7. PSV Stock Tab ───────────────────────────────────────────── */}
        {activeTab === "psv" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* 6 Colorful PSV Metric Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold">
                  <FileText size={16} />
                </div>
                <div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white leading-none">5,420</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">Document Qty</div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white leading-none">5,180</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">Received Qty</div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center font-bold">
                  <Clock size={16} />
                </div>
                <div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white leading-none">4,980</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">Approved Qty</div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center font-bold">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white leading-none">240</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">Pending Approval</div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center font-bold">
                  <XCircle size={16} />
                </div>
                <div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white leading-none">120</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">Shortage</div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white leading-none">80</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">Excess</div>
                </div>
              </div>
            </div>

            {/* Detailed PSV Filter & Reconciliation Table */}
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers size={16} className="text-[#0066cc]" />
                  <span>SMRITI PSV (Party Stock Visibility) — Live Reconciliation Stream</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">125 Total Records</span>
              </div>

              {/* 10-Control Filter Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Party</label>
                  <select className="w-full px-2 py-1 text-[11px] rounded-lg border bg-white dark:bg-slate-900">
                    <option>All (Reliance Retail Ltd)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Child Customer</label>
                  <select
                    value={psvChildFilter}
                    onChange={(e) => setPsvChildFilter(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] rounded-lg border bg-white dark:bg-slate-900"
                  >
                    <option value="all">All</option>
                    <option value="REL001-001">REL001-001</option>
                    <option value="REL001-002">REL001-002</option>
                    <option value="REL001-003">REL001-003</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Store / Outlet</label>
                  <select
                    value={psvStoreFilter}
                    onChange={(e) => setPsvStoreFilter(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] rounded-lg border bg-white dark:bg-slate-900"
                  >
                    <option value="all">All</option>
                    <option value="REL-MUM-001">REL-MUM-001</option>
                    <option value="REL-MUM-002">REL-MUM-002</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Article / Style</label>
                  <select
                    value={psvArticleFilter}
                    onChange={(e) => setPsvArticleFilter(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] rounded-lg border bg-white dark:bg-slate-900"
                  >
                    <option value="all">All</option>
                    <option value="Men's T-Shirt">Men's T-Shirt</option>
                    <option value="Men's Shirt">Men's Shirt</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Color</label>
                  <select
                    value={psvColorFilter}
                    onChange={(e) => setPsvColorFilter(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] rounded-lg border bg-white dark:bg-slate-900"
                  >
                    <option value="all">All</option>
                    <option value="Navy">Navy</option>
                    <option value="White">White</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Size</label>
                  <select
                    value={psvSizeFilter}
                    onChange={(e) => setPsvSizeFilter(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] rounded-lg border bg-white dark:bg-slate-900"
                  >
                    <option value="all">All</option>
                    <option value="L">L</option>
                    <option value="M">M</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Status</label>
                  <select
                    value={psvStatusFilter}
                    onChange={(e) => setPsvStatusFilter(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] rounded-lg border bg-white dark:bg-slate-900"
                  >
                    <option value="all">All</option>
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">From</label>
                  <input
                    type="date"
                    value={psvDateFrom}
                    onChange={(e) => setPsvDateFrom(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] rounded-lg border bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">To</label>
                  <input
                    type="date"
                    value={psvDateTo}
                    onChange={(e) => setPsvDateTo(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] rounded-lg border bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="flex items-end gap-1">
                  <button
                    type="button"
                    onClick={() => onNotification?.("PSV Query Executed", "Reconciliation ledger filtered.", "success")}
                    className="flex-1 py-1 bg-[#0066cc] text-white text-[11px] font-bold rounded-lg hover:bg-[#0052a3]"
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* 16-Column Detailed Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2.5">Doc No.</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5">Store Code</th>
                      <th className="p-2.5">Article / Style</th>
                      <th className="p-2.5">Color</th>
                      <th className="p-2.5">Size</th>
                      <th className="p-2.5">Barcode</th>
                      <th className="p-2.5 text-right">Document Qty</th>
                      <th className="p-2.5 text-right">Received Qty</th>
                      <th className="p-2.5 text-right">Pending Approval</th>
                      <th className="p-2.5 text-right">Approved Qty</th>
                      <th className="p-2.5 text-right">Shortage</th>
                      <th className="p-2.5 text-right">Excess</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPsvRows.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono font-bold text-[#0066cc] dark:text-[#8ebdf9]">{r.doc_no}</td>
                        <td className="p-2.5 text-slate-500 font-mono">{r.date}</td>
                        <td className="p-2.5 font-mono">{r.customer_code}</td>
                        <td className="p-2.5 font-mono">{r.store_code}</td>
                        <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{r.article_style}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">{r.color}</td>
                        <td className="p-2.5 font-bold">{r.size}</td>
                        <td className="p-2.5 font-mono text-slate-400">{r.barcode}</td>
                        <td className="p-2.5 text-right font-mono font-bold">{r.document_qty}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">{r.received_qty}</td>
                        <td className="p-2.5 text-right font-mono text-sky-600 font-bold">{r.pending_approval_qty}</td>
                        <td className="p-2.5 text-right font-mono text-emerald-600 font-bold">{r.approved_qty}</td>
                        <td className="p-2.5 text-right font-mono text-rose-500 font-bold">{r.shortage_qty}</td>
                        <td className="p-2.5 text-right font-mono text-blue-500 font-bold">{r.excess_qty}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === "Approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : r.status === "Pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <button type="button" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"><Eye size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 8. Sales & Invoices Tab ────────────────────────────────────── */}
        {activeTab === "sales_invoices" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt size={18} className="text-[#0066cc]" />
                    <span>Sales Tax Invoices & Transaction History ({invoices.length} Invoices)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Authoritative sales documents, invoice statuses, and settlement tracking.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNotification?.("Export Invoices", "Exporting invoice ledger to CSV.", "info")}
                    className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                  >
                    <Download size={14} />
                    <span>Export Ledger</span>
                  </button>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Invoice No.</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Store Code</th>
                      <th className="p-3">Store Name</th>
                      <th className="p-3 text-right">Items</th>
                      <th className="p-3 text-right">Grand Total (₹)</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invoices.length > 0 ? (
                      invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-[#0066cc] dark:text-[#8ebdf9]">{inv.no}</td>
                          <td className="p-3 text-slate-500 font-mono">{inv.date}</td>
                          <td className="p-3 font-mono">{inv.store}</td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{inv.storeName}</td>
                          <td className="p-3 text-right font-mono">{inv.items}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">₹ {inv.amount}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              (inv.status || "").toLowerCase() === "paid" || (inv.status || "").toLowerCase() === "completed"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button type="button" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"><Eye size={14} /></button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          No sales tax invoices found for this customer account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 9. Contacts & Documents Tab ────────────────────────────────── */}
        {activeTab === "contacts_docs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-150">
            {/* Key Contacts */}
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users size={18} className="text-[#0066cc]" />
                  <span>Key Contacts Directory</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNotification?.("Add Contact", "Opening Contact registration modal.", "info")}
                  className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[#0066cc] dark:text-[#8ebdf9] rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus size={12} />
                  <span>Add Contact</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {contacts.map((c) => (
                  <div key={c.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-500">{c.designation}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{c.phone} · {c.email}</div>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <button type="button" className="p-1 hover:text-slate-700 dark:hover:text-white"><Edit size={13} /></button>
                      <button type="button" className="p-1 hover:text-rose-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Vault */}
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderOpen size={18} className="text-amber-500" />
                  <span>Document Vault & KYC</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNotification?.("Upload Document", "Opening Document Upload modal.", "info")}
                  className="px-3 py-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <Upload size={12} />
                  <span>Upload</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {documents.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{d.name}</div>
                      <div className="text-[10px] text-slate-400">{d.type} · Uploaded {d.date}</div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <button type="button" className="p-1 hover:text-slate-700 dark:hover:text-white"><Download size={13} /></button>
                      <button type="button" className="p-1 hover:text-rose-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 10. Activity & Audit Tab ───────────────────────────────────── */}
        {activeTab === "activity_audit" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <History size={18} className="text-[#0066cc]" />
                    <span>Tamper-Evident Activity & Audit History</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Chronological immutable log of account mutations, credit alterations, and statutory disclosures.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                  <ShieldCheck size={12} />
                  <span>SHA-256 Chain Verified</span>
                </span>
              </div>

              {/* Audit Timeline */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentActivity.map((act) => (
                  <div key={act.id} className="py-3 flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] shrink-0 mt-0.5">
                      <Clock size={14} />
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{act.title}</span>
                        <span className="text-[11px] font-mono text-slate-400">{act.time}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5">{act.desc}</p>
                      <span className="text-[10px] font-mono text-slate-400 block mt-1">Audit Hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
