/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.10.0
 * Created      : 2026-08-21
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Stitch Distributor Invoicing Terminal
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Product, Customer, POSProfile, Shift } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { useF2Screen } from "../../context/F2DispatcherContext.tsx";
import type { LookupResult } from "../../context/F2DispatcherContext.tsx";
import type { SalesLineItem, SalesTransaction } from "../../domain/sales/transaction";
import { calculateLineTotal, recomputeTransaction } from "../../services/sales/transactionCalculator";
import { getCustomers, saveCustomers } from "../../services/customerStore.ts";
import { 
  searchBackendCustomers, 
  searchBackendProducts, 
  AutoPopulateCustomerResult, 
  AutoPopulateProductResult 
} from "../../services/autoPopulateService.ts";
import { TypeaheadDrop, TypeaheadOption } from "../common/TypeaheadDrop.tsx";
import { SmritiItemTypeaheadDropdown } from "../common/ItemTypeaheadDrop.tsx";
import {
  BillingLineItem,
  BillType,
  TransactionType,
  BillingHeaderState,
  BillingSummaryTotals,
  TransporterRow,
  AddonDeductionRow,
  SettlementPaymentRow,
  CustomerGSTRegistrationDTO,
  CustomerDeliveryLocationDTO,
  CustomerBillingLocationDTO
} from "./types.ts";
import { ProductSearchBrowserModal } from "./ProductSearchBrows.tsx";
import { ItemBrowseOverlayModal } from "./ItemBrowseOverlayD.tsx";
import { PdtImportModal } from "./PdtImportModal.tsx";
import { SmritiInvoiceSettlementModal } from "./InvoiceSettlementD.tsx";
import { PrintPreviewModal } from "../PrintPreviewModal.tsx";
import { TransactionAttachmentPanel } from "../common/TransactionAttachmentPanel.tsx";
import type { TransactionAttachment } from "../../domain/attachment";
import { 
  Download, 
  History, 
  Search, 
  Plus, 
  Trash2, 
  X, 
  FileText, 
  Truck, 
  CreditCard, 
  Receipt,
  UserPlus,
  Printer,
  RotateCcw,
  Bell,
  Settings,
  HelpCircle,
  Clock,
  User,
  Maximize2,
  Minimize2,
  ExternalLink,
  Paperclip
} from "lucide-react";

interface SmritiBillingTerminalProps {
  products?: Product[];
  customers?: Customer[];
  profiles?: POSProfile[];
  shifts?: Shift[];
  currentUser?: { role: string; name: string; companyId?: string; branchId?: string } | null;
  onRefreshData?: () => void;
  onNotification?: (title: string, message: string, type: "success" | "error") => void;
  isStandaloneTab?: boolean;
}

export const BillingTerm: React.FC<SmritiBillingTerminalProps> = ({
  products = [],
  customers: initialCustomersProp,
  currentUser,
  onRefreshData,
  onNotification,
  isStandaloneTab = false
}) => {
  // Main Line Items Table State
  const [items, setItems] = useState<BillingLineItem[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);

  // Header State
  const [headerState, setHeaderState] = useState<BillingHeaderState>({
    billType: "Product",
    transaction: "Credit",
    docPrefix: "D1DS13",
    docNo: "1",
    billDate: new Date().toLocaleDateString("en-GB"),
    customer: null,
    salesStaff: currentUser?.name || "EMP001 - John Doe",
    remarks: "",
    billedPartyGstinId: null,
    billedGstin: null,
    deliveryLocationId: null,
    deliveryStoreCode: null,
    deliveryGstin: null,
    deliveryLocationSnapshot: null,
    placeOfSupplyCode: null,
    poReference: ""
  });

  // Corporate B2B Multi-State GST, Billing & Delivery Location State
  const [customerGstRegistrations, setCustomerGstRegistrations] = useState<CustomerGSTRegistrationDTO[]>([]);
  const [customerDeliveryLocations, setCustomerDeliveryLocations] = useState<CustomerDeliveryLocationDTO[]>([]);
  const [customerBillingLocations, setCustomerBillingLocations] = useState<CustomerBillingLocationDTO[]>([]);
  const [isLoadingB2BData, setIsLoadingB2BData] = useState<boolean>(false);
  const activeCustomerFetchIdRef = useRef<string | null>(null);

  const fetchCustomerB2BData = async (customerId: string) => {
    activeCustomerFetchIdRef.current = customerId;
    setIsLoadingB2BData(true);
    try {
      const [regsRes, locsRes, blocRes] = await Promise.all([
        apiFetchV1(`/crm/customers/${customerId}/gst-registrations`).catch(() => []),
        apiFetchV1(`/crm/customers/${customerId}/delivery-locations`).catch(() => []),
        apiFetchV1(`/crm/customers/${customerId}/billing-locations`).catch(() => []),
      ]);
      if (activeCustomerFetchIdRef.current !== customerId) return;

      const regs: CustomerGSTRegistrationDTO[] = Array.isArray(regsRes) ? regsRes : (regsRes?.items || []);
      const locs: CustomerDeliveryLocationDTO[] = Array.isArray(locsRes) ? locsRes : (locsRes?.items || []);
      const blocs: CustomerBillingLocationDTO[] = Array.isArray(blocRes) ? blocRes : (blocRes?.items || []);
      setCustomerGstRegistrations(regs);
      setCustomerDeliveryLocations(locs);
      setCustomerBillingLocations(blocs);

      // 1. Primary GST auto-selection:
      const primaryReg = regs.find(r => r.is_primary) || (regs.length === 1 ? regs[0] : null);

      // 2. Default Billing Location auto-selection:
      const defaultBloc = blocs.find(b => b.is_default) || (blocs.length === 1 ? blocs[0] : null);

      // 3. Default Shipping / Delivery Location auto-selection:
      const defaultDelLoc = locs.find(l => l.is_default) || (locs.length === 1 ? locs[0] : null);

      const delSnapshot = defaultDelLoc ? {
        id: defaultDelLoc.id,
        store_code: defaultDelLoc.store_code,
        location_name: defaultDelLoc.location_name,
        address_line1: defaultDelLoc.address_line1,
        address_line2: defaultDelLoc.address_line2,
        city: defaultDelLoc.city,
        state_code: defaultDelLoc.state_code,
        state_name: defaultDelLoc.state_name,
        pin_code: defaultDelLoc.pin_code,
        delivery_gstin: defaultDelLoc.delivery_gstin,
        contact_person: defaultDelLoc.contact_person,
        contact_phone: defaultDelLoc.contact_phone
      } : null;

      setHeaderState(prev => ({
        ...prev,
        billedPartyGstinId: primaryReg?.id || null,
        billedGstin: primaryReg?.gstin || null,
        placeOfSupplyCode: defaultDelLoc?.state_code || primaryReg?.state_code || prev.placeOfSupplyCode,
        billingLocationId: defaultBloc?.id || null,
        billingStoreCode: defaultBloc?.billing_store_code || null,
        billingAddress: defaultBloc ? [defaultBloc.address_line1, defaultBloc.city, defaultBloc.state].filter(Boolean).join(", ") : null,
        deliveryLocationId: defaultDelLoc?.id || null,
        deliveryStoreCode: defaultDelLoc?.store_code || null,
        deliveryGstin: defaultDelLoc?.delivery_gstin || null,
        deliveryLocationSnapshot: delSnapshot,
        shippingAddress: defaultDelLoc ? [defaultDelLoc.address_line1, defaultDelLoc.city, defaultDelLoc.state_name].filter(Boolean).join(", ") : null,
      }));
    } catch {
      // Offline fallback
    } finally {
      if (activeCustomerFetchIdRef.current === customerId) {
        setIsLoadingB2BData(false);
      }
    }
  };

  const handleBilledGstinChange = (regId: string) => {
    if (!regId) {
      setHeaderState(prev => ({
        ...prev,
        billedPartyGstinId: null,
        billedGstin: null
      }));
      return;
    }
    const reg = customerGstRegistrations.find(r => r.id === regId);
    if (!reg) return;
    setHeaderState(prev => ({
      ...prev,
      billedPartyGstinId: reg.id,
      billedGstin: reg.gstin,
      placeOfSupplyCode: prev.deliveryLocationId ? prev.placeOfSupplyCode : reg.state_code
    }));
  };

  const handleDeliveryLocationChange = (locId: string) => {
    if (!locId) {
      setHeaderState(prev => {
        const billedReg = customerGstRegistrations.find(r => r.id === prev.billedPartyGstinId);
        return {
          ...prev,
          deliveryLocationId: null,
          deliveryStoreCode: null,
          deliveryGstin: null,
          deliveryLocationSnapshot: null,
          placeOfSupplyCode: billedReg?.state_code || null
        };
      });
      return;
    }
    const loc = customerDeliveryLocations.find(l => l.id === locId);
    if (!loc) return;
    const snapshot = {
      id: loc.id,
      store_code: loc.store_code,
      location_name: loc.location_name,
      site_type: loc.site_type,
      address_line1: loc.address_line1,
      address_line2: loc.address_line2,
      city: loc.city,
      district: loc.district,
      state_code: loc.state_code,
      state_name: loc.state_name,
      pin_code: loc.pin_code,
      delivery_gstin: loc.delivery_gstin,
      contact_person: loc.contact_person,
      contact_phone: loc.contact_phone
    };
    setHeaderState(prev => ({
      ...prev,
      deliveryLocationId: loc.id,
      deliveryStoreCode: loc.store_code,
      deliveryGstin: loc.delivery_gstin || null,
      deliveryLocationSnapshot: snapshot,
      placeOfSupplyCode: loc.state_code
    }));
  };

  // Direct Entry Row (F11) State
  const [directEntry, setDirectEntry] = useState<{
    barcode: string;
    stockNo: string;
    itemDescription: string;
    rate: string;
    qty: string;
    discCode: string;
    discQty: string;
    discPercent: string;
    staff: string;
  }>({
    barcode: "",
    stockNo: "",
    itemDescription: "",
    rate: "",
    qty: "1",
    discCode: "",
    discQty: "",
    discPercent: "",
    staff: currentUser?.name || "Staff A"
  });

  // Tabbed Details State (Footer Left Card)
  const [activeFooterTab, setActiveFooterTab] = useState<"transporter" | "payment" | "addons">("transporter");
  const [transporterRows, setTransporterRows] = useState<TransporterRow[]>([
    {
      sNo: 1,
      type: "Road Freight",
      code: "TR-01",
      description: "Local Express Logistics",
      rateType: "Fixed",
      rateAmt: 0,
      rate: 0,
      amount: 0
    }
  ]);
  const [addonRows, setAddonRows] = useState<AddonDeductionRow[]>([
    {
      sNo: 1,
      type: "Addon",
      code: "INS",
      description: "Transit Insurance",
      rateType: "Fixed",
      rate: 0,
      amount: 0
    }
  ]);

  // Customers State & Auto-Populate Search
  // getCustomers() returns backend-seeded cache (populated by refreshCustomerCache on login).
  // Empty array on cold start is correct — Billing search uses backend typeahead, not this list.
  const [customers, setCustomers] = useState<Customer[]>(() => {
    if (initialCustomersProp && initialCustomersProp.length > 0) return initialCustomersProp;
    return getCustomers(); // returns [] if cache not yet warm; backend typeahead still works
  });
  const [customerSearchInput, setCustomerSearchInput] = useState<string>("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [isCustomerSearching, setIsCustomerSearching] = useState<boolean>(false);
  const [customerSuggestions, setCustomerSuggestions] = useState<TypeaheadOption[]>([]);
  const [customerSelectedIndex, setCustomerSelectedIndex] = useState<number>(0);
  const customerDebounceRef = useRef<any>(null);

  // Direct Entry Product Auto-Populate Search
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const [isProductSearching, setIsProductSearching] = useState<boolean>(false);
  const [productSearchError, setProductSearchError] = useState<string | null>(null);
  const [productSuggestions, setProductSuggestions] = useState<AutoPopulateProductResult[]>([]);
  const [productSelectedIndex, setProductSelectedIndex] = useState<number>(0);
  const [activeItemSearchField, setActiveItemSearchField] = useState<"stockNo" | "barcode">("stockNo");
  const [selectedItemProductMeta, setSelectedItemProductMeta] = useState<AutoPopulateProductResult | null>(null);
  const productDebounceRef = useRef<any>(null);
  const directBarcodeRef = useRef<HTMLInputElement>(null);

  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>("");
  const [newCustMobile, setNewCustMobile] = useState<string>("");
  const [newCustGstin, setNewCustGstin] = useState<string>("");

  // Modals State
  const [showProductSearchModal, setShowProductSearchModal] = useState<boolean>(false);
  const [showItemBrowseModal, setShowItemBrowseModal] = useState<boolean>(false);
  const [showPdtImportModal, setShowPdtImportModal] = useState<boolean>(false);
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);
  const [showRecallModal, setShowRecallModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showAttachmentPanel, setShowAttachmentPanel] = useState<boolean>(false);
  const [suspendedBills, setSuspendedBills] = useState<{ id: string; header: BillingHeaderState; items: BillingLineItem[]; date: string; netAmount: number }[]>([]);
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<any>(null);

  // Fullscreen State & Terminal Ref
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  const handleToggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
    if (!document.fullscreenElement) {
      terminalContainerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Live Date & Time for Header Display
  const [liveDate, setLiveDate] = useState<string>(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  });
  const [liveTime, setLiveTime] = useState<string>(() => {
    return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      setLiveDate(`${day}/${month}/${year}`);
      setLiveTime(d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Quick Action Handlers
  const handleNewInvoice = () => {
    if (items.length > 0) {
      if (!window.confirm("Start a new invoice? Current unsaved items will be cleared.")) return;
    }
    setItems([]);
    setHeaderState(prev => ({
      ...prev,
      docNo: String((parseInt(prev.docNo) || 1) + 1),
      customer: null,
      remarks: "",
      billedPartyGstinId: null,
      billedGstin: null,
      deliveryLocationId: null,
      deliveryStoreCode: null,
      deliveryGstin: null,
      deliveryLocationSnapshot: null,
      placeOfSupplyCode: null,
      poReference: ""
    }));
    setCustomerGstRegistrations([]);
    setCustomerDeliveryLocations([]);
    setDirectEntry({
      barcode: "",
      stockNo: "",
      itemDescription: "",
      rate: "",
      qty: "1",
      discCode: "",
      discQty: "",
      discPercent: "",
      staff: currentUser?.name || "Staff A"
    });
    setCustomerSearchInput("");
    setSelectedItemProductMeta(null);
    onNotification?.("New Invoice", "Fresh billing canvas initialized.", "success");
    directStockNoRef.current?.focus();
  };

  const handleVoidInvoice = () => {
    if (items.length === 0) {
      onNotification?.("Void Bill", "No items to void.", "error");
      return;
    }
    if (window.confirm("Void all line items for this transaction? (Ctrl+V)")) {
      setItems([]);
      onNotification?.("Invoice Voided", "All line items have been voided.", "success");
    }
  };

  const handleReprintInvoice = () => {
    if (lastCompletedInvoice || items.length > 0) {
      setShowPrintModal(true);
    } else {
      onNotification?.("Reprint", "No recent invoice to reprint.", "error");
    }
  };

  // References
  const directStockNoRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // ─── F2 Universal Lookup Architecture v2 — Screen Registration ───────────
  // F2 when focus is on the customer field → entity=customer (Tier 1 data-f2-entity).
  // F2 on the direct-entry stockNo field → entity=variant (Tier 1 data-f2-entity).
  // Resolution priority:
  //   Tier 1: data-f2-entity attribute on the focused element (customerSearch, directStockNo)
  //   Tier 2: fieldOverrides map below (belt-and-suspenders for the stockNo field)
  //   Tier 3: defaultEntity = "customer" (fallback for untagged fields)
  // The click-triggered ProductSearchBrowserModal (setShowProductSearchModal) is NOT
  // affected — it is a non-F2 consumer and is preserved.
  useF2Screen({
    screenId: "BillingTerm",
    defaultEntity: "customer",
    fieldOverrides: new Map([
      ["customerSearch",  "customer" as const],
      ["directStockNo",   "variant"  as const],
    ]),
    adapter: (result: LookupResult) => {
      // ── Customer lookup ────────────────────────────────────────────────────
      if (result.entity === "customer") {
        const custObj: Customer = {
          id: result.id ?? "",
          name: result.displayValue || "",
          mobile: (result.record?.mobile as string) || (result.record?.phone as string) || "",
          gstNumber: (result.record?.gst_number as string) || "",
          customerGroupId: (result.record?.customer_group_id as string) || "CG-Retail",
          status: (result.record?.status as string) || "Active",
          outstanding: (result.record?.outstanding_balance as number) ?? 0,
          createdDate: (result.record?.created_at as string) || new Date().toISOString().split("T")[0],
        };
        setHeaderState(prev => ({
          ...prev,
          customer: custObj,
          billedPartyGstinId: null,
          billedGstin: null,
          deliveryLocationId: null,
          deliveryStoreCode: null,
          deliveryGstin: null,
          deliveryLocationSnapshot: null,
          placeOfSupplyCode: null,
          poReference: ""
        }));
        setCustomerSearchInput(result.displayValue || "");
        if (custObj.id) {
          fetchCustomerB2BData(custObj.id);
        } else {
          setCustomerGstRegistrations([]);
          setCustomerDeliveryLocations([]);
        }
        return;
      }

      // ── Variant / Item / Barcode lookup (direct entry row) ─────────────────
      if (result.entity === "variant" || result.entity === "item" || result.entity === "item_barcode") {
        const stockVal  = (result.record?.stock_no as string)
                       || (result.record?.style_code as string)
                       || result.returnValue
                       || "";
        const barcodeVal = (result.record?.barcode as string)
                        || (result.record?.default_barcode as string)
                        || stockVal;
        const descVal   = result.displayValue
                       || (result.record?.name as string)
                       || "";
        const rateVal   = String(
                          (result.record?.selling_price as number)
                       || (result.record?.mrp as number)
                       || (result.record?.price as number)
                       || 0
                        );
        setDirectEntry(prev => ({
          ...prev,
          stockNo:         stockVal,
          barcode:         barcodeVal,
          itemDescription: descVal,
          rate:            rateVal,
        }));
        // Keep focus in the direct-entry row after selection (focus restoration
        // is handled by F2Dispatcher.closeLookup → originElementRef, which points
        // back to the directStockNoRef input automatically).
        if (process.env.NODE_ENV !== "production") {
          console.debug("[BillingTerm][F2] variant adapter applied:", { stockVal, rateVal });
        }
        return;
      }

      // ── Unresolved entity — development-only warning ───────────────────────
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[BillingTerm][F2] FieldAdapter received unhandled entity:",
          result.entity,
          "— no state update performed."
        );
      }
    }
  });

  // Live Products State for item browse, modals, and search
  const [liveProducts, setLiveProducts] = useState<Product[]>(products);

  const fetchProducts = async () => {
    try {
      const res = await apiFetchV1("/products?page_size=100");
      const list = Array.isArray(res) ? res : (res?.items || []);
      if (list.length > 0) {
        setLiveProducts(list);
      }
    } catch {
      // offline fallback
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await apiFetchV1("/crm/customers?page_size=100");
      const list = Array.isArray(res) ? res : (res?.items || []);
      if (list.length > 0) {
        setCustomers(list);
        saveCustomers(list);
        return;
      }
    } catch {
      // Offline fallback
    }
    const local = getCustomers();
    setCustomers(local || []);
  };

  const fetchSuspendedInvoices = async () => {
    try {
      const res = await apiFetchV1("/sales/invoices/suspended");
      const list = Array.isArray(res) ? res : (res?.items || []);
      const mapped = list.map((inv: any) => ({
        id: inv.id,
        invoice_no: inv.invoice_no,
        header: {
          billType: "Product" as BillType,
          transaction: (inv.payment_mode === "CASH" ? "Cash" : "Credit") as TransactionType,
          docPrefix: inv.invoice_no?.split("-")?.[0] || "INV",
          docNo: inv.invoice_no?.split("-")?.[1] || "1",
          billDate: inv.date ? new Date(inv.date).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB"),
          customer: inv.customer_id ? { id: inv.customer_id, name: inv.customer_name || "Counter Cash", gstNumber: inv.customer_gstin } as Customer : null,
          salesStaff: inv.salesperson_name || "Staff",
          remarks: inv.import_validation_notes || ""
        },
        items: (inv.items || []).map((it: any, idx: number) => ({
          id: "item-" + idx,
          sNo: idx + 1,
          stockNo: it.code,
          barcode: it.code,
          itemDescription: it.name,
          rate: Number(it.price || 0),
          qty: Number(it.quantity || 1),
          value: Number(it.price || 0) * Number(it.quantity || 1),
          discCode: "",
          discQty: 0,
          discPercent: Number(it.disc_pct || 0),
          discAmt: 0,
          total: Number(it.total_amount || (Number(it.price || 0) * Number(it.quantity || 1))),
          salesStaff: inv.salesperson_name || "Staff",
          productId: it.product_id,
          gstPercentage: Number(it.gst_rate || 18),
          taxAmount: Number(it.tax_amount || 0)
        })),
        date: inv.created_at || inv.date,
        netAmount: Number(inv.grand_total || 0)
      }));
      setSuspendedBills(mapped);
    } catch {
      // offline fallback
    }
  };

  // Focus direct entry row on mount & fetch live data
  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    fetchSuspendedInvoices();
    directStockNoRef.current?.focus();
  }, []);

  // Global Keyboard Shortcuts Listener #1
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F2 handled by F2DispatcherProvider (F2 Universal Lookup Architecture v2).
      // This screen registers via useF2Screen() above. No screen-level F2 handler.
      if (e.key === "F11" || e.key === "F1") {
        e.preventDefault();
        if (activeItemSearchField === "barcode") {
          directBarcodeRef.current?.focus();
        } else {
          directStockNoRef.current?.focus();
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        if (items.length > 0) setShowSettlementModal(true);
        else onNotification?.("Settlement", "Add items to invoice before opening settlement.", "error");
      } else if (e.key === "F12") {
        e.preventDefault();
        handleSuspendInvoice();
      } else if (e.ctrlKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        handleNewInvoice();
      } else if (e.ctrlKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        handleVoidInvoice();
      } else if (e.ctrlKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        handleReturnInvoice();
      } else if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        handleReprintInvoice();
      } else if (e.ctrlKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setShowPdtImportModal(true);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [items, headerState, lastCompletedInvoice, activeItemSearchField]);

  const handleSelectCustomer = (c: Customer | null) => {
    setHeaderState(prev => ({
      ...prev,
      customer: c,
      billedPartyGstinId: null,
      billedGstin: null,
      deliveryLocationId: null,
      deliveryStoreCode: null,
      deliveryGstin: null,
      deliveryLocationSnapshot: null,
      placeOfSupplyCode: null,
      poReference: ""
    }));
    if (c) {
      setCustomerSearchInput(c.name);
      fetchCustomerB2BData(c.id);
    } else {
      setCustomerGstRegistrations([]);
      setCustomerDeliveryLocations([]);
    }
    setShowCustomerDropdown(false);
  };

  const applyCustomerAutoPopulate = (r: AutoPopulateCustomerResult | Customer) => {
    const custObj: Customer = {
      id: r.id,
      name: r.name,
      mobile: (r as any).mobile || (r as any).phone || "",
      gstNumber: (r as any).gstNumber || (r as any).gst_number,
      customerGroupId: (r as any).customerGroupId || (r as any).customer_group_id || "CG-Retail",
      status: (r as any).status || "Active",
      outstanding: (r as any).outstanding || (r as any).outstanding_balance || 0,
      createdDate: (r as any).createdDate || (r as any).created_at || new Date().toISOString().split("T")[0]
    };

    setHeaderState(prev => ({
      ...prev,
      customer: custObj,
      transaction: (r as any).allowCreditInvoice !== false ? prev.transaction : "Cash",
      billedPartyGstinId: null,
      billedGstin: null,
      deliveryLocationId: null,
      deliveryStoreCode: null,
      deliveryGstin: null,
      deliveryLocationSnapshot: null,
      placeOfSupplyCode: null,
      poReference: ""
    }));

    setCustomerSearchInput(r.name);
    setShowCustomerDropdown(false);
    if (custObj.id) {
      fetchCustomerB2BData(custObj.id);
    }
    onNotification?.("Customer Auto-Populated", `Auto-populated ${r.name} from backend.`, "success");
  };

  const handleCustomerSearchChange = (val: string) => {
    setCustomerSearchInput(val);
    setShowCustomerDropdown(true);

    if (!val.trim()) {
      setHeaderState(prev => ({
        ...prev,
        customer: null,
        billedPartyGstinId: null,
        billedGstin: null,
        deliveryLocationId: null,
        deliveryStoreCode: null,
        deliveryGstin: null,
        deliveryLocationSnapshot: null,
        placeOfSupplyCode: null,
        poReference: ""
      }));
      setCustomerSuggestions([]);
      setCustomerGstRegistrations([]);
      setCustomerDeliveryLocations([]);
      return;
    }

    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);
    setIsCustomerSearching(true);

    customerDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchBackendCustomers(val);
        const options: TypeaheadOption[] = results.map(r => ({
          id: r.id,
          title: r.name,
          subtitle: `${r.mobile || "No Mobile"} • ${r.customerGroupId || "CG-Retail"}`,
          badge: r.outstanding > 0 ? `Bal: ₹${r.outstanding}` : "Clear",
          badgeColor: r.outstanding > 0 ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
          iconType: "customer",
          metadata: r
        }));
        setCustomerSuggestions(options);
        setCustomerSelectedIndex(0);

        // Immediate exact match check
        const clean = val.trim().toLowerCase();
        const exact = results.find(r =>
          r.name.toLowerCase() === clean ||
          r.mobile === val.trim() ||
          r.id.toLowerCase() === clean ||
          r.code.toLowerCase() === clean
        );
        if (exact) {
          applyCustomerAutoPopulate(exact);
        }
      } finally {
        setIsCustomerSearching(false);
      }
    }, 150);
  };

  // NOTE: Legacy Keyboard Shortcuts Listener #2 has been removed as part of
  // F2 Universal Lookup Architecture v2 Phase B Batch 1 (2026-09-02).
  // Its unique hotkeys (F7/F8 settlement) are already covered by Listener #1
  // above. F2 routing is now exclusively handled by F2DispatcherProvider.

  // Derived Direct Entry Calculations
  const directRateNum = parseFloat(directEntry.rate) || 0;
  const directQtyNum = parseFloat(directEntry.qty) || 0;
  const directGrossValue = directRateNum * directQtyNum;
  const directDiscPctNum = parseFloat(directEntry.discPercent) || 0;
  const directDiscAmt = directDiscPctNum > 0 ? (directGrossValue * directDiscPctNum) / 100 : (parseFloat(directEntry.discQty) || 0);
  const directLineTotal = Math.max(0, directGrossValue - directDiscAmt);

  // Recompute Summary Totals
  const summaryTotals: BillingSummaryTotals = useMemo(() => {
    const transaction: SalesTransaction = {
      docType: "billing",
      docPrefix: headerState.docPrefix || "D1DS13",
      docNumber: headerState.docNo || "1",
      docDate: headerState.billDate || new Date().toISOString().split("T")[0],
      docTime: liveTime || new Date().toTimeString().slice(0, 5),
      customerId: headerState.customer?.id,
      customerCode: headerState.customer?.code,
      customerName: headerState.customer?.name,
      referenceNo: "",
      deliveryTerms: "",
      paymentTerms: "",
      orderStatus: "Open",
      remarks: headerState.remarks,
      items: items.map((it) => ({
        id: it.id,
        productId: it.productId,
        stockNo: it.stockNo,
        barcode: it.barcode,
        itemDescription: it.itemDescription,
        qty: Number(it.qty || 0),
        rate: Number(it.rate || 0),
        value: Number(it.value || 0),
        discPercent: Number(it.discPercent || 0),
        discAmt: Number(it.discAmt || 0),
        taxPercent: Number(it.gstPercentage ?? (it.taxAmount ? 18 : 0)),
        taxAmount: Number(it.taxAmount || 0),
        total: Number(it.total || 0),
      })),
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      netAmount: 0,
    };

    const recomputed = recomputeTransaction(transaction);
    const itemCount = items.length;
    const totalQty = items.reduce((sum, it) => sum + Number(it.qty || 0), 0);
    const billDiscount = 0;
    const totalAddons = transporterRows.reduce((s, r) => s + (Number(r.amount) || 0), 0) + addonRows.filter(a => a.type === "Addon").reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const totalDeductions = addonRows.filter(a => a.type === "Deduction").reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const netAmount = Math.max(0, Math.round((recomputed.netAmount + totalAddons - totalDeductions) * 100) / 100);

    return {
      itemCount,
      totalQty,
      salesValue: recomputed.subtotal,
      itemDiscount: recomputed.discountTotal,
      billDiscount,
      totalTax: recomputed.taxTotal,
      totalAddons,
      totalDeductions,
      roundOff: 0,
      netAmount
    };
  }, [items, transporterRows, addonRows, headerState, liveTime]);

  const applyProductAutoPopulate = (p: AutoPopulateProductResult | Product) => {
    const rateVal = String((p as any).sellingPrice || (p as any).mrp || (p as any).price || 0);
    const stockVal = (p as any).stockNo || (p as any).styleCode || (p as any).style_code || p.code || "";
    const barcodeVal = p.barcode || (p as any).code || "";
    setDirectEntry(prev => ({
      ...prev,
      stockNo: stockVal,
      barcode: barcodeVal,
      itemDescription: p.name || (p as any).itemDescription || (p as any).description || "",
      rate: rateVal
    }));
    setSelectedItemProductMeta(p as AutoPopulateProductResult);
    setShowProductDropdown(false);
    setProductSearchError(null);
    setTimeout(() => {
      directStockNoRef.current?.focus();
    }, 10);
  };

  // Handle Direct Entry Barcode or Stock No Change & Real-Time Auto-Population
  const handleItemSearchChange = (val: string, fieldType: "stockNo" | "barcode") => {
    setActiveItemSearchField(fieldType);
    if (fieldType === "barcode") {
      setDirectEntry(prev => ({ ...prev, barcode: val }));
    } else {
      setDirectEntry(prev => ({ ...prev, stockNo: val }));
    }

    if (!val.trim()) {
      setShowProductDropdown(false);
      setProductSuggestions([]);
      setProductSearchError(null);
      return;
    }

    setShowProductDropdown(true);
    setProductSearchError(null);
    if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    setIsProductSearching(true);

    productDebounceRef.current = setTimeout(async () => {
      try {
        setProductSearchError(null);
        const results = await searchBackendProducts(val, products);
        setProductSuggestions(results);
        setProductSelectedIndex(0);

        // Immediate exact match check
        const clean = val.trim().toLowerCase();
        const exact = results.find(p =>
          p.code.toLowerCase() === clean ||
          p.stockNo?.toLowerCase() === clean ||
          (p.barcode && p.barcode.toLowerCase() === clean) ||
          p.sku?.toLowerCase() === clean ||
          p.id.toLowerCase() === clean
        );
        if (exact) {
          applyProductAutoPopulate(exact);
        }
      } catch (err: any) {
        setProductSearchError(err?.message || "Product lookup error");
      } finally {
        setIsProductSearching(false);
      }
    }, 120);
  };

  // Keyboard navigation for Item Typeahead in Distributor Invoicing
  const handleItemInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, fieldType: "stockNo" | "barcode") => {
    if (showProductDropdown && productSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setProductSelectedIndex(prev => (prev + 1) % productSuggestions.length);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setProductSelectedIndex(prev => (prev - 1 + productSuggestions.length) % productSuggestions.length);
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = productSuggestions[productSelectedIndex];
        if (selected) {
          applyProductAutoPopulate(selected);
        } else {
          handleCommitDirectEntry();
        }
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowProductDropdown(false);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      handleCommitDirectEntry();
    }
  };

  // Commit Direct Entry Item to Table
  const handleCommitDirectEntry = () => {
    if (!directEntry.stockNo && !directEntry.barcode && !directEntry.itemDescription) return;

    const matched = products.find(p => 
      p.code === directEntry.stockNo || 
      p.barcode === directEntry.barcode || 
      p.barcode === directEntry.stockNo
    ) || selectedItemProductMeta;

    const rate = directRateNum > 0 ? directRateNum : Number((matched as any)?.sellingPrice || (matched as any)?.mrp || 0);
    const qty = directQtyNum > 0 ? directQtyNum : 1;
    const lineItem: SalesLineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productId: (matched as any)?.id,
      stockNo: directEntry.stockNo || (matched as any)?.stockNo || (matched as any)?.code || "SKU-GEN",
      barcode: directEntry.barcode || (matched as any)?.barcode || directEntry.stockNo,
      itemDescription: directEntry.itemDescription || (matched as any)?.name || "Item " + (items.length + 1),
      qty,
      rate,
      value: rate * qty,
      discPercent: directDiscPctNum,
      discAmt: directDiscAmt,
      taxPercent: (matched as any)?.gstPercentage || 18,
      taxAmount: 0,
      total: 0,
    };

    const computedLine = calculateLineTotal(lineItem);
    const newLine: BillingLineItem = {
      id: computedLine.id,
      sNo: items.length + 1,
      stockNo: computedLine.stockNo || "SKU-GEN",
      barcode: computedLine.barcode || "",
      itemDescription: computedLine.itemDescription,
      rate: computedLine.rate,
      qty: computedLine.qty,
      value: computedLine.value,
      discCode: directEntry.discCode,
      discQty: parseFloat(directEntry.discQty) || 0,
      discPercent: Number(computedLine.discPercent ?? 0),
      discAmt: Number(computedLine.discAmt ?? 0),
      total: computedLine.total,
      salesStaff: directEntry.staff,
      productId: (matched as any)?.id,
      hsnCode: (matched as any)?.hsnCode,
      gstPercentage: Number(computedLine.taxPercent ?? 18),
      taxAmount: Number(computedLine.taxAmount ?? 0),
      brand: (matched as any)?.brand,
      size: (matched as any)?.size
    };

    setItems(prev => [...prev, newLine]);

    // Reset direct entry row
    setDirectEntry({
      barcode: "",
      stockNo: "",
      itemDescription: "",
      rate: "",
      qty: "1",
      discCode: "",
      discQty: "",
      discPercent: "",
      staff: directEntry.staff
    });
    setSelectedItemProductMeta(null);
    setShowProductDropdown(false);

    if (activeItemSearchField === "barcode") {
      directBarcodeRef.current?.focus();
    } else {
      directStockNoRef.current?.focus();
    }
    onNotification?.("Item Added", `${newLine.itemDescription} added to invoice.`, "success");
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id).map((it, idx) => ({ ...it, sNo: idx + 1 })));
  };

  const handleReturnInvoice = () => {
    fetchSuspendedInvoices();
    setShowRecallModal(true);
  };

  // Suspend / Hold Invoice
  const handleSuspendInvoice = async () => {
    if (items.length === 0) {
      onNotification?.("Suspend Bill", "No items to suspend.", "error");
      return;
    }

    const suspendedNo = `HOLD-${headerState.docPrefix}-${headerState.docNo}-${Date.now().toString().slice(-4)}`;
    const invoicePayload = {
      invoice_no: suspendedNo,
      date: new Date().toISOString().split("T")[0],
      customer_id: headerState.customer?.id || null,
      customer_name: headerState.customer?.name || "Counter Cash Sale",
      customer_gstin: headerState.billedGstin || headerState.customer?.gstNumber || null,
      billed_party_gstin_id: headerState.billedPartyGstinId || null,
      delivery_location_id: headerState.deliveryLocationId || null,
      delivery_store_code: headerState.deliveryStoreCode || null,
      delivery_gstin: headerState.deliveryGstin || null,
      delivery_location_snapshot: headerState.deliveryLocationSnapshot || null,
      place_of_supply_code: headerState.placeOfSupplyCode || null,
      po_reference: headerState.poReference || null,
      status: "Suspended",
      payment_mode: "CREDIT",
      items: items.map((it, idx) => ({
        product_id: it.productId || it.stockNo,
        code: it.stockNo,
        name: it.itemDescription,
        quantity: it.qty,
        price: it.rate,
        disc_pct: it.discPercent,
        gst_rate: it.gstPercentage,
        line_no: idx + 1
      })),
      taxable_value: summaryTotals.salesValue,
      tax_total: summaryTotals.totalTax,
      grand_total: summaryTotals.netAmount,
      remarks: headerState.remarks || "Suspended from Invoicing Terminal",
      rule_snapshots: {
        headerState,
        transporterRows,
        addonRows
      }
    };

    try {
      const saved = await apiFetchV1("/sales/invoices", {
        method: "POST",
        body: JSON.stringify(invoicePayload)
      });
      const suspended = {
        id: saved.id || suspendedNo,
        header: { ...headerState },
        items: [...items],
        date: new Date().toLocaleTimeString(),
        netAmount: summaryTotals.netAmount
      };
      setSuspendedBills(prev => [suspended, ...prev]);
      setItems([]);
      setHeaderState(prev => ({
        ...prev,
        docNo: String((parseInt(prev.docNo) || 1) + 1),
        customer: null
      }));
      setCustomerSearchInput("");
      onNotification?.("Invoice Suspended", `Bill ${suspended.header.docPrefix}-${suspended.header.docNo} held in PostgreSQL database.`, "success");
    } catch {
      // Local fallback
      const suspended = {
        id: suspendedNo,
        header: { ...headerState },
        items: [...items],
        date: new Date().toLocaleTimeString(),
        netAmount: summaryTotals.netAmount
      };
      setSuspendedBills(prev => [suspended, ...prev]);
      setItems([]);
      setHeaderState(prev => ({
        ...prev,
        docNo: String((parseInt(prev.docNo) || 1) + 1),
        customer: null
      }));
      setCustomerSearchInput("");
      onNotification?.("Invoice Suspended (Local)", `Bill ${suspended.header.docPrefix}-${suspended.header.docNo} held locally.`, "success");
    }
  };

  // Recall Suspended Invoice
  const handleRecallInvoice = (suspended: any) => {
    setHeaderState(suspended.header);
    setItems(suspended.items);
    if (suspended.header.customer) {
      setCustomerSearchInput(suspended.header.customer.name);
    }
    setSuspendedBills(prev => prev.filter(b => b.id !== suspended.id));
    setShowRecallModal(false);
    onNotification?.("Invoice Recalled", `Restored bill ${suspended.header.docPrefix}-${suspended.header.docNo}`, "success");
  };

  // Handle PDT Import Items
  const handleImportPdtItems = (imported: { product: Product; qty: number; rate?: number }[]) => {
    const newLines: BillingLineItem[] = imported.map((imp, idx) => {
      const rate = imp.rate ?? Number((imp.product as any).sellingPrice || imp.product.price || imp.product.mrp || 0);
      const qty = imp.qty;
      const value = rate * qty;
      return {
        id: "pdt-item-" + Date.now() + "-" + idx,
        sNo: items.length + idx + 1,
        stockNo: imp.product.code || "SKU-PDT",
        barcode: imp.product.barcode || imp.product.code,
        itemDescription: imp.product.name,
        rate,
        qty,
        value,
        discCode: "",
        discQty: 0,
        discPercent: 0,
        discAmt: 0,
        total: value,
        salesStaff: headerState.salesStaff,
        productId: imp.product.id,
        gstPercentage: imp.product.gstPercentage || 18,
        taxAmount: (value * (imp.product.gstPercentage || 18)) / 100
      };
    });

    setItems(prev => [...prev, ...newLines]);
    onNotification?.("PDT Imported", `Imported ${newLines.length} items from PDT file.`, "success");
  };

  // Handle Settlement Completion
  const handleCompleteSettlement = async (
    payments: SettlementPaymentRow[],
    totalTendered: number,
    changeDue: number,
    denominations?: any
  ) => {
    const isCreditTx = headerState.transaction === "Credit" || payments.some(p => (p.mode || "").toUpperCase() === "CREDIT");
    // If docPrefix and docNo are the static default "D1DS13-1", omit invoice_no so backend allocates canonical sequence
    const invNo = (headerState.docPrefix === "D1DS13" && headerState.docNo === "1")
      ? undefined
      : `${headerState.docPrefix}-${headerState.docNo}`;

    const invoicePayload = {
      invoice_no: invNo,
      date: new Date().toISOString().split("T")[0],
      customer_id: headerState.customer?.id || null,
      customer_name: headerState.customer?.name || "Counter Cash Sale",
      customer_gstin: headerState.billedGstin || headerState.customer?.gstNumber || null,
      billed_party_gstin_id: headerState.billedPartyGstinId || null,
      billing_location_id: headerState.billingLocationId || null,
      billing_store_code: headerState.billingStoreCode || null,
      billing_address: headerState.billingAddress || null,
      delivery_location_id: headerState.deliveryLocationId || null,
      delivery_store_code: headerState.deliveryStoreCode || null,
      delivery_gstin: headerState.deliveryGstin || null,
      delivery_location_snapshot: headerState.deliveryLocationSnapshot || null,
      shipping_address: headerState.shippingAddress || null,
      place_of_supply_code: headerState.placeOfSupplyCode || null,
      po_reference: headerState.poReference || null,
      status: "Completed",
      payment_mode: isCreditTx ? "CREDIT" : (payments[0]?.mode.toUpperCase() || "CASH"),
      paid_amount: isCreditTx ? 0 : totalTendered,
      balance_amount: isCreditTx ? summaryTotals.netAmount : (changeDue > 0 ? 0 : Math.max(0, summaryTotals.netAmount - totalTendered)),
      discount_amount: summaryTotals.itemDiscount + summaryTotals.billDiscount,
      net_amount: summaryTotals.netAmount,
      taxable_value: summaryTotals.salesValue,
      tax_total: summaryTotals.totalTax,
      grand_total: summaryTotals.netAmount,
      salesperson_name: headerState.salesStaff,
      remarks: headerState.remarks || (isCreditTx ? "B2B Corporate Credit Invoice" : "B2B Distributor Invoice"),
      items: items.map((it, idx) => ({
        product_id: it.productId || it.stockNo,
        code: it.stockNo,
        name: it.itemDescription,
        quantity: it.qty,
        price: it.rate,
        disc_pct: it.discPercent,
        gst_rate: it.gstPercentage,
        line_no: idx + 1
      })),
      rule_snapshots: {
        transaction_type: isCreditTx ? "Credit" : "Cash",
        credit_terms: isCreditTx ? {
          credit_days: (headerState.customer as any)?.creditDays ?? (headerState.customer as any)?.credit_days ?? null,
          credit_limit: (headerState.customer as any)?.creditLimit ?? (headerState.customer as any)?.credit_limit ?? null,
          previous_outstanding: (headerState.customer as any)?.outstanding || 0,
          projected_outstanding: ((headerState.customer as any)?.outstanding || 0) + summaryTotals.netAmount
        } : undefined,
        payments: isCreditTx ? [{ mode: "On Account", amount: summaryTotals.netAmount }] : payments,
        denominations: isCreditTx ? undefined : denominations,
        transporterRows,
        addonRows
      }
    };

    try {
      const saved = await apiFetchV1("/sales/invoices", {
        method: "POST",
        body: JSON.stringify(invoicePayload)
      });

      const completedInvoice = {
        invoiceNumber: saved.invoice_no || invNo || "INV-CONFIRMED",
        date: saved.date || headerState.billDate,
        customerName: headerState.customer?.name || "Counter Cash Sale",
        customerGstin: headerState.billedGstin || headerState.customer?.gstNumber || "",
        items: items.map(it => ({
          sku: it.stockNo,
          description: it.itemDescription,
          quantity: it.qty,
          rate: it.rate,
          discount: it.discAmt,
          tax: it.taxAmount || 0,
          amount: it.total
        })),
        subtotal: summaryTotals.salesValue,
        discount: summaryTotals.itemDiscount + summaryTotals.billDiscount,
        tax: summaryTotals.totalTax,
        total: summaryTotals.netAmount,
        totalTendered: isCreditTx ? 0 : totalTendered,
        changeDue: isCreditTx ? 0 : changeDue,
        paymentMode: isCreditTx ? "CREDIT" : payments.map(p => p.mode).join(", ")
      };

      setLastCompletedInvoice(completedInvoice);
      setShowSettlementModal(false);
      setShowPrintModal(true);

      // Reset for next invoice
      setItems([]);
      setHeaderState(prev => ({
        ...prev,
        docNo: String((parseInt(prev.docNo) || 1) + 1),
        customer: null,
        remarks: "",
        billedPartyGstinId: null,
        billedGstin: null,
        billingLocationId: null,
        billingStoreCode: null,
        billingAddress: null,
        shippingAddress: null,
        deliveryLocationId: null,
        deliveryStoreCode: null,
        deliveryGstin: null,
        deliveryLocationSnapshot: null,
        placeOfSupplyCode: null,
        poReference: ""
      }));
      setCustomerGstRegistrations([]);
      setCustomerDeliveryLocations([]);
      setCustomerBillingLocations([]);
      setCustomerSearchInput("");
      onNotification?.("Settlement Complete", `Invoice ${completedInvoice.invoiceNumber} saved to PostgreSQL database.`, "success");
      onRefreshData?.();
    } catch (err: any) {
      alert(`Database Settlement Error: ${err?.message || "Failed to commit transaction."}. Your invoice items are preserved. Please retry.`);
    }
  };

  // Add Quick Customer
  const handleCreateCustomer = async () => {
    if (!newCustName.trim()) return;
    const newCust: Customer = {
      id: "CUST-" + Date.now().toString().slice(-4),
      customerGroupId: "CG-Retail",
      name: newCustName.trim(),
      mobile: newCustMobile.trim() || "0000000000",
      gstNumber: newCustGstin.trim() || undefined,
      status: "Active",
      outstanding: 0,
      createdDate: new Date().toISOString().split("T")[0]
    };
    try {
      const res = await apiFetchV1("/crm/customers", {
        method: "POST",
        body: JSON.stringify({
          name: newCust.name,
          mobile: newCust.mobile,
          gst_number: newCust.gstNumber,
          customer_group_id: newCust.customerGroupId,
          status: newCust.status
        })
      });
      if (res && res.id) {
        newCust.id = res.id;
        newCust.code = res.code || res.id;
      }
      window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
    } catch (e) {
      console.warn("[Quick Customer] Backend persistence fallback to local:", e);
    }
    setCustomers(prev => [newCust, ...prev]);
    handleSelectCustomer(newCust);
    setShowAddCustomerModal(false);
    setNewCustName("");
    setNewCustMobile("");
    setNewCustGstin("");
    onNotification?.("Customer Added", `Customer ${newCust.name} selected.`, "success");
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearchInput.trim()) return customers;
    const q = customerSearchInput.toLowerCase().trim();
    return customers.filter(c => 
      c.name?.toLowerCase().includes(q) ||
      (c.mobile && c.mobile.includes(q)) ||
      (c.id && c.id.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      ((c as any).phone && (c as any).phone.includes(q))
    );
  }, [customers, customerSearchInput]);

  return (
    <div 
      ref={terminalContainerRef}
      className={`flex flex-col bg-surface text-on-surface font-sans select-none overflow-hidden transition-all ${
        isFullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "h-full"
      }`}
    >
      
      {/* Top Application Bar */}
      <header className="bg-surface dark:bg-primary-container text-primary dark:text-primary-fixed w-full top-0 sticky z-50 border-b border-outline-variant dark:border-outline shadow-xs">
        <div className="flex justify-between items-center px-margin-page h-16 w-full max-w-container-max-width mx-auto">
          
          {/* Logo & Brand Title */}
          <div className="flex items-center gap-stack-gap">
            <span className="p-2 bg-primary/10 dark:bg-primary-fixed-dim/20 rounded-lg text-primary dark:text-primary-fixed">
              <Receipt size={26} className="text-secondary" />
            </span>
            <span className="font-headline-lg text-headline-lg font-bold text-primary dark:text-primary-fixed tracking-tight">
              Smriti Distributor
            </span>
          </div>

          {/* Clock, Action Buttons, Separator, System Controls & Avatar */}
          <div className="flex items-center gap-gutter">
            
            {/* Live Date & Time Badges */}
            <div className="flex items-center gap-stack-gap text-on-surface-variant font-code-md text-code-md">
              <span className="bg-surface-container-high px-2 py-1 rounded font-bold">{liveDate}</span>
              <span className="bg-surface-container-high px-2 py-1 rounded font-bold">{liveTime}</span>
            </div>

            {/* Quick Action Icons */}
            <div className="flex items-center gap-unit">
              <button
                type="button"
                onClick={handleNewInvoice}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
                title="New (Ctrl+N)"
              >
                <Plus size={18} />
              </button>
              <button
                type="button"
                onClick={handleVoidInvoice}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
                title="Void (Ctrl+V)"
              >
                <Trash2 size={18} className="text-error" />
              </button>
              <button
                type="button"
                onClick={handleReturnInvoice}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
                title="Return / Recall (Ctrl+R)"
              >
                <RotateCcw size={18} />
              </button>
              <button
                type="button"
                onClick={handleReprintInvoice}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
                title="Reprint / Preview (Ctrl+P)"
              >
                <Printer size={18} />
              </button>
            </div>

            {/* Vertical Separator */}
            <div className="h-8 w-px bg-outline-variant"></div>

            {/* System Utility Icons */}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onNotification?.("Notifications", "System is up to date.", "success")}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
                title="Notifications"
              >
                <Bell size={17} />
              </button>
              <button
                type="button"
                onClick={() => setShowItemBrowseModal(true)}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
                title="Settings / Item Master (F3)"
              >
                <Settings size={17} />
              </button>
              <button
                type="button"
                onClick={() => setShowAttachmentPanel(!showAttachmentPanel)}
                className={`p-2 transition-colors rounded active:opacity-80 cursor-pointer ${
                  showAttachmentPanel 
                    ? "bg-surface-container-high text-primary" 
                    : "text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim"
                }`}
                title="Attachments (Add contracts, POs, approvals)"
              >
                <Paperclip size={17} />
              </button>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Invoicing Terminal"}
              >
                {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
              <button
                type="button"
                onClick={() => onNotification?.("Help", "F2: Search Customer | F11: Direct Entry | F8: Settlement | F12: Suspend | Ctrl+P: Preview/Reprint", "success")}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-primary-fixed-dim transition-colors rounded active:opacity-80 cursor-pointer"
                title="Help & Shortcuts"
              >
                <HelpCircle size={17} />
              </button>
            </div>

            {/* User Profile Avatar */}
            <div className="w-8 h-8 rounded-full border border-outline-variant bg-surface-container-high flex items-center justify-center font-bold text-xs text-primary font-code-md">
              {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : "SD"}
            </div>

            {/* Settlement F8 Primary Action */}
            <button
              type="button"
              onClick={() => {
                if (items.length > 0) setShowSettlementModal(true);
                else alert("Add items before settlement.");
              }}
              className="h-9 px-4 bg-primary hover:bg-primary-container text-on-primary rounded font-title-sm text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer ml-1"
              title="Settlement (F8)"
            >
              <CreditCard size={15} />
              <span>Settlement (F8)</span>
            </button>

          </div>
        </div>
      </header>

      {/* Main Invoicing Canvas */}
      <main className="flex-1 flex flex-col p-stack-gap gap-stack-gap overflow-y-auto max-w-container-max-width mx-auto w-full">
        
        {/* HEADER SECTION */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded p-stack-gap flex flex-col gap-stack-gap shadow-xs">
          
          {/* Row 1: Bill Type, Transaction, Doc Prefix, Doc No, Action Buttons */}
          <div className="flex flex-wrap items-end gap-gutter">
            <div className="flex flex-col gap-unit w-48">
              <label className="font-label-caps text-label-caps text-on-surface-variant font-bold">Bill Type</label>
              <select
                value={headerState.billType}
                onChange={e => setHeaderState({ ...headerState, billType: e.target.value as BillType })}
                className="border-outline-variant text-body-md focus:border-secondary focus:ring-secondary rounded h-9 bg-surface-container-lowest px-2.5 font-medium border"
              >
                <option value="Product">Product</option>
                <option value="Service">Service</option>
                <option value="Both">Both</option>
              </select>
            </div>

            <div className="flex flex-col gap-unit w-48">
              <label className="font-label-caps text-label-caps text-on-surface-variant font-bold">Transaction</label>
              <select
                value={headerState.transaction}
                onChange={e => setHeaderState({ ...headerState, transaction: e.target.value as TransactionType })}
                className="border-outline-variant text-body-md focus:border-secondary focus:ring-secondary rounded h-9 bg-surface-container-lowest px-2.5 font-medium border"
              >
                <option value="Credit">Credit</option>
                <option value="Cash">Cash</option>
                <option value="Retail">Retail</option>
              </select>
            </div>

            <div className="flex flex-col gap-unit w-32">
              <label className="font-label-caps text-label-caps text-on-surface-variant font-bold">Doc Prefix</label>
              <input
                type="text"
                value={headerState.docPrefix}
                readOnly
                className="bg-surface-container-low border-outline-variant text-body-md font-code-md text-on-surface-variant rounded h-9 cursor-not-allowed px-2.5 border"
              />
            </div>

            <div className="flex flex-col gap-unit w-32">
              <label className="font-label-caps text-label-caps text-on-surface-variant font-bold">Doc No.</label>
              <input
                type="text"
                value={headerState.docNo}
                readOnly
                className="bg-surface-container-low border-outline-variant text-body-md font-code-md text-on-surface-variant rounded h-9 cursor-not-allowed px-2.5 border"
              />
            </div>

            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setShowPdtImportModal(true)}
                className="h-9 px-4 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-title-sm transition-colors flex items-center gap-2 cursor-pointer"
                title="Import from PDT / File (Ctrl+I)"
              >
                <Download size={16} className="text-secondary" />
                <span>Import</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRecallModal(true)}
                className="h-9 px-4 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-title-sm transition-colors flex items-center gap-2 cursor-pointer"
                title="Recall Held Invoice (Ctrl+R)"
              >
                <History size={16} className="text-secondary" />
                <span>Recall {suspendedBills.length > 0 ? `(${suspendedBills.length})` : ""}</span>
              </button>
            </div>
          </div>

          {/* Row 2: Customer F2 search, Display, Add button, Sales Staff */}
          <div className="flex flex-wrap items-end gap-gutter">
            
            {/* Customer Search & Quick Add */}
            <div className="flex flex-col gap-unit flex-1 relative">
              <label className="font-label-caps text-label-caps text-on-surface-variant font-bold">
                Customer <span className="text-error">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={customerInputRef}
                    type="text"
                    name="customerSearch"
                    aria-label="Search customer (F2)"
                    data-f2-entity="customer"
                    data-context-type="customer"
                    data-lookup="customer"
                    value={customerSearchInput}
                    onChange={e => handleCustomerSearchChange(e.target.value)}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (customerSuggestions.length > 0) {
                          const selected = customerSuggestions[customerSelectedIndex] || customerSuggestions[0];
                          if (selected?.metadata) applyCustomerAutoPopulate(selected.metadata as any);
                        } else if (filteredCustomers.length > 0) {
                          handleSelectCustomer(filteredCustomers[0]);
                        }
                      } else if (e.key === "ArrowDown") {
                        if (customerSuggestions.length > 0) {
                          e.preventDefault();
                          setCustomerSelectedIndex(prev => (prev + 1) % customerSuggestions.length);
                        }
                      } else if (e.key === "ArrowUp") {
                        if (customerSuggestions.length > 0) {
                          e.preventDefault();
                          setCustomerSelectedIndex(prev => (prev - 1 + customerSuggestions.length) % customerSuggestions.length);
                        }
                      } else if (e.key === "Escape") {
                        setShowCustomerDropdown(false);
                      }
                    }}
                    placeholder="Search customer (F2)"
                    className="w-full border-outline-variant text-body-md focus:border-secondary focus:ring-secondary rounded h-9 pl-9 pr-2 border bg-surface-container-lowest font-medium"
                  />
                  <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  
                  {/* Real-Time Backend Customer Typeahead Dropdown */}
                  <TypeaheadDrop
                    isOpen={showCustomerDropdown && (customerSuggestions.length > 0 || isCustomerSearching)}
                    options={customerSuggestions}
                    selectedIndex={customerSelectedIndex}
                    isLoading={isCustomerSearching}
                    onSelect={(opt) => {
                      if (opt.metadata) {
                        applyCustomerAutoPopulate(opt.metadata as any);
                      }
                    }}
                    onClose={() => setShowCustomerDropdown(false)}
                    emptyMessage="No matching customers found in database"
                  />
                </div>

                <input
                  type="text"
                  name="customerNameDisplay"
                  aria-label="Customer Name Display"
                  value={headerState.customer?.name || ""}
                  readOnly
                  placeholder="Customer Name Display"
                  className="flex-1 bg-surface-container-low border-outline-variant text-body-md text-on-surface-variant rounded h-9 px-3 border truncate font-medium"
                />

                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="h-9 px-4 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-title-sm transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Sales Staff */}
            <div className="flex flex-col gap-unit w-64">
              <label className="font-label-caps text-label-caps text-on-surface-variant font-bold">Sales Staff</label>
              <select
                value={headerState.salesStaff}
                onChange={e => setHeaderState({ ...headerState, salesStaff: e.target.value })}
                className="border-outline-variant text-body-md focus:border-secondary focus:ring-secondary rounded h-9 border bg-surface-container-lowest px-2.5 font-medium"
              >
                <option value="">Select Staff...</option>
                <option value="EMP001 - John Doe">EMP001 - John Doe</option>
                <option value="EMP002 - Jane Smith">EMP002 - Jane Smith</option>
                <option value="EMP003 - Rahul Sharma">EMP003 - Rahul Sharma</option>
              </select>
            </div>

          </div>

          {/* Row 3: Corporate B2B Multi-State GST & Delivery Location Strip */}
          {headerState.customer && (
            <div className="flex flex-wrap items-end gap-gutter pt-2 border-t border-outline-variant/60" data-testid="b2b-corporate-strip">
              
              {/* Billed GST Registration */}
              <div className="flex flex-col gap-unit flex-1 min-w-[240px]">
                <div className="flex items-center justify-between">
                  <label className="font-label-caps text-label-caps text-on-surface-variant font-bold flex items-center gap-1.5">
                    <span>Billed GST Registration</span>
                    {customerGstRegistrations.length > 1 && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                        {customerGstRegistrations.length} GSTINs (Select)
                      </span>
                    )}
                  </label>
                  {isLoadingB2BData && (
                    <span className="text-[10px] text-secondary animate-pulse">Loading B2B data...</span>
                  )}
                </div>
                <select
                  aria-label="Billed GST Registration"
                  data-testid="billed-gst-registration"
                  value={headerState.billedPartyGstinId || ""}
                  onChange={e => handleBilledGstinChange(e.target.value)}
                  className="border-outline-variant text-body-md focus:border-secondary focus:ring-secondary rounded h-9 border bg-surface-container-lowest px-2.5 font-medium"
                >
                  <option value="">
                    {customerGstRegistrations.length === 0
                      ? (headerState.customer.gstNumber ? `Default (${headerState.customer.gstNumber})` : "Unregistered / Counter Cash")
                      : "-- Select Billed GSTIN --"}
                  </option>
                  {customerGstRegistrations.map(reg => (
                    <option key={reg.id} value={reg.id}>
                      {reg.gstin} — {reg.state_name} ({reg.state_code}){reg.trade_name ? ` • ${reg.trade_name}` : ""}{reg.is_primary ? " [Primary]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delivery Location / Store */}
              <div className="flex flex-col gap-unit flex-1 min-w-[280px]">
                <div className="flex items-center justify-between">
                  <label className="font-label-caps text-label-caps text-on-surface-variant font-bold flex items-center gap-1.5">
                    <span>Delivery Location / Store</span>
                    {customerDeliveryLocations.length > 0 && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                        {customerDeliveryLocations.length} Stores
                      </span>
                    )}
                  </label>
                </div>
                <select
                  aria-label="Delivery Location"
                  data-testid="delivery-location-select"
                  value={headerState.deliveryLocationId || ""}
                  onChange={e => handleDeliveryLocationChange(e.target.value)}
                  className="border-outline-variant text-body-md focus:border-secondary focus:ring-secondary rounded h-9 border bg-surface-container-lowest px-2.5 font-medium"
                >
                  <option value="">
                    {customerDeliveryLocations.length === 0 ? "No Registered Delivery Locations" : "-- Select Delivery Location / Store --"}
                  </option>
                  {customerDeliveryLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.store_code}] {loc.location_name} — {loc.city}, {loc.state_name} ({loc.delivery_gstin || "No GSTIN"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Store Code Badge */}
              <div className="flex flex-col gap-unit w-28">
                <label className="font-label-caps text-label-caps text-on-surface-variant font-bold">Store Code</label>
                <div 
                  data-testid="delivery-store-code-display"
                  className="h-9 px-2.5 flex items-center bg-surface-container-low border border-outline-variant rounded text-body-md font-mono font-bold text-primary"
                >
                  {headerState.deliveryStoreCode || "—"}
                </div>
              </div>

              {/* Place of Supply (POS) */}
              <div className="flex flex-col gap-unit w-24">
                <label className="font-label-caps text-label-caps text-on-surface-variant font-bold">POS State</label>
                <div 
                  data-testid="pos-code-display"
                  title={headerState.placeOfSupplyCode || "Default POS"}
                  className="h-9 px-2.5 flex items-center bg-surface-container-low border border-outline-variant rounded text-body-md font-mono font-bold text-secondary"
                >
                  {headerState.placeOfSupplyCode || "—"}
                </div>
              </div>

              {/* PO Reference */}
              <div className="flex flex-col gap-unit w-36">
                <label className="font-label-caps text-label-caps text-on-surface-variant font-bold">PO Reference</label>
                <input
                  type="text"
                  name="poReference"
                  aria-label="PO Reference"
                  data-testid="po-reference-input"
                  placeholder="PO / Order Ref"
                  value={headerState.poReference || ""}
                  onChange={e => setHeaderState(prev => ({ ...prev, poReference: e.target.value }))}
                  className="border-outline-variant text-body-md focus:border-secondary focus:ring-secondary rounded h-9 px-2.5 border bg-surface-container-lowest font-medium"
                />
              </div>

            </div>
          )}

        </section>

        {/* DETAIL SECTION (MAIN WORKSPACE) */}
        <section className="flex-1 bg-surface-container-lowest border border-outline-variant rounded flex flex-col overflow-hidden min-h-[300px] shadow-xs">
          
          {/* Multi-attribute quick inspector ribbon */}
          {selectedItemProductMeta && (
            <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 px-3 py-1.5 text-xs flex items-center justify-between text-blue-900 dark:text-cyan-200 shrink-0">
              <div className="flex items-center gap-3 overflow-x-auto">
                <span><strong>Barcode:</strong> {selectedItemProductMeta.barcode}</span>
                <span>•</span>
                <span><strong>Stock/SKU:</strong> {selectedItemProductMeta.stockNo || selectedItemProductMeta.sku}</span>
                <span>•</span>
                <span><strong>Stock:</strong> {selectedItemProductMeta.stockQty} {selectedItemProductMeta.uom}</span>
                <span>•</span>
                <span><strong>MRP:</strong> ₹{selectedItemProductMeta.mrp.toFixed(2)}</span>
                <span>•</span>
                <span><strong>Cost:</strong> ₹{selectedItemProductMeta.costPrice.toFixed(2)}</span>
                <span>•</span>
                <span><strong>Size/Color:</strong> {selectedItemProductMeta.size}/{selectedItemProductMeta.color}</span>
                <span>•</span>
                <span><strong>Brand:</strong> {selectedItemProductMeta.brand}</span>
                <span>•</span>
                <span><strong>HSN:</strong> {selectedItemProductMeta.hsnCode} ({selectedItemProductMeta.gstPercentage}%)</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemProductMeta(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Main Line Items Table */}
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="sticky top-0 bg-surface-container-high border-b border-outline-variant z-10">
                <tr className="font-label-caps text-label-caps text-on-surface-variant font-bold">
                  <th className="px-3 py-2 w-10 text-center border-r border-outline-variant">S.No</th>
                  <th className="px-3 py-2 w-[100px] border-r border-outline-variant">Stock No</th>
                  <th className="px-3 py-2 border-r border-outline-variant">Item Description</th>
                  <th className="px-3 py-2 w-[80px] text-right border-r border-outline-variant">Rate</th>
                  <th className="px-3 py-2 w-[80px] text-right border-r border-outline-variant">Qty</th>
                  <th className="px-3 py-2 w-[100px] text-right border-r border-outline-variant">Value</th>
                  <th className="px-3 py-2 w-[80px] border-r border-outline-variant">Disc Code</th>
                  <th className="px-3 py-2 w-[80px] text-right border-r border-outline-variant">Disc Qty</th>
                  <th className="px-3 py-2 w-[80px] text-right border-r border-outline-variant">Disc %</th>
                  <th className="px-3 py-2 w-[100px] text-right border-r border-outline-variant">Disc Amt</th>
                  <th className="px-3 py-2 w-[120px] text-right border-r border-outline-variant">Total</th>
                  <th className="px-3 py-2 w-[120px]">Sales Staff</th>
                  <th className="px-2 py-2 w-8 text-center"></th>
                </tr>
              </thead>
              <tbody className="font-code-md text-code-md divide-y divide-outline-variant/40">
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedRowIndex(idx)}
                    className={`transition-colors ${
                      selectedRowIndex === idx
                        ? "bg-secondary-fixed/40 font-semibold"
                        : "hover:bg-surface-container-low"
                    }`}
                  >
                    <td className="px-3 py-2 text-center border-r border-outline-variant bg-surface-container-low">
                      {item.sNo}
                    </td>
                    <td className="px-3 py-2 border-r border-outline-variant font-bold text-primary">
                      {item.stockNo}
                    </td>
                    <td className="px-3 py-2 border-r border-outline-variant truncate max-w-xs font-sans font-medium">
                      {item.itemDescription}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant">
                      {Number(item.rate).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant font-bold">
                      {item.qty}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant">
                      {Number(item.value).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 border-r border-outline-variant text-on-surface-variant">
                      {item.discCode || "-"}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant">
                      {item.discQty || "0"}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant">
                      {item.discPercent ? `${item.discPercent}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant">
                      {item.discAmt > 0 ? item.discAmt.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant font-bold text-primary">
                      {Number(item.total).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 border-r border-outline-variant truncate max-w-[120px] text-on-surface-variant font-sans">
                      {item.salesStaff}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleRemoveItem(item.id);
                        }}
                        className="text-on-surface-variant hover:text-error transition-colors p-1 cursor-pointer"
                        title="Delete Row"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Empty placeholders if rows < 5 */}
                {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
                  <tr key={"empty-" + i} className="border-b border-outline-variant/30">
                    <td className="px-3 py-2 text-center border-r border-outline-variant bg-surface-container-low text-on-surface-variant/40">
                      {items.length + i + 1}
                    </td>
                    <td colSpan={12} className="px-3 py-2 text-on-surface-variant/20 italic"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Direct Entry Row (F11 / F1) at Bottom of Detail Card */}
          <div className="bg-surface-container-low border-t border-outline-variant p-2 flex gap-2 items-center shrink-0">
            <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-variant px-2 py-1 rounded w-10 text-center font-bold">
              F11
            </span>

            {/* Inputs aligned with table columns */}
            <div className="flex-1 flex gap-2 items-center">
              {/* Stock / Barcode Search — data-f2-entity="variant" enables F2 → UniversalBrowseEngine (variant) */}
              <div className="w-[100px] relative">
                <input
                  ref={directStockNoRef}
                  type="text"
                  id="directStockNo"
                  name="directStockNo"
                  aria-label="Stock No (F2 to browse)"
                  data-f2-entity="variant"
                  value={directEntry.stockNo}
                  onChange={e => handleItemSearchChange(e.target.value, "stockNo")}
                  onFocus={() => {
                    setActiveItemSearchField("stockNo");
                    if (productSuggestions.length > 0) setShowProductDropdown(true);
                  }}
                  onKeyDown={e => handleItemInputKeyDown(e, "stockNo")}
                  placeholder="Stock No"
                  className="w-full border-outline-variant h-8 font-code-md text-xs rounded px-2 bg-surface-container-lowest font-bold focus:border-secondary outline-none border"
                />
                {activeItemSearchField === "stockNo" && (
                  <SmritiItemTypeaheadDropdown
                    isOpen={showProductDropdown && (productSuggestions.length > 0 || isProductSearching || Boolean(productSearchError))}
                    items={productSuggestions}
                    selectedIndex={productSelectedIndex}
                    isLoading={isProductSearching}
                    errorMessage={productSearchError}
                    onSelect={(opt) => {
                      applyProductAutoPopulate(opt);
                      directStockNoRef.current?.focus();
                    }}
                    onClose={() => setShowProductDropdown(false)}
                    searchFieldType="stockNo"
                    anchorRef={directStockNoRef}
                  />
                )}
              </div>

              {/* Item Description Display */}
              <input
                type="text"
                value={directEntry.itemDescription}
                onChange={e => setDirectEntry({ ...directEntry, itemDescription: e.target.value })}
                onKeyDown={e => e.key === "Enter" && handleCommitDirectEntry()}
                placeholder="Item Description"
                className="flex-1 bg-surface-container border-outline-variant h-8 text-xs rounded px-2 font-medium border focus:border-secondary outline-none truncate"
              />

              {/* Rate */}
              <input
                type="number"
                step="0.01"
                value={directEntry.rate}
                onChange={e => setDirectEntry({ ...directEntry, rate: e.target.value })}
                onKeyDown={e => e.key === "Enter" && handleCommitDirectEntry()}
                placeholder="Rate"
                className="w-[80px] border-outline-variant h-8 font-code-md text-xs rounded px-2 text-right bg-surface-container-lowest font-bold focus:border-secondary outline-none border"
              />

              {/* Qty */}
              <input
                type="number"
                min="1"
                value={directEntry.qty}
                onChange={e => setDirectEntry({ ...directEntry, qty: e.target.value })}
                onKeyDown={e => e.key === "Enter" && handleCommitDirectEntry()}
                placeholder="Qty"
                className="w-[80px] border-outline-variant h-8 font-code-md text-xs rounded px-2 text-right bg-surface-container-lowest font-bold focus:border-secondary outline-none border"
              />

              {/* Value */}
              <input
                type="text"
                value={directGrossValue > 0 ? directGrossValue.toFixed(2) : ""}
                readOnly
                placeholder="Value"
                className="w-[100px] bg-surface-variant border-outline-variant h-8 font-code-md text-xs rounded px-2 text-right font-bold text-on-surface border"
              />

              {/* Disc Code */}
              <input
                type="text"
                value={directEntry.discCode}
                onChange={e => setDirectEntry({ ...directEntry, discCode: e.target.value })}
                placeholder="Disc Code"
                className="w-[80px] border-outline-variant h-8 font-code-md text-xs rounded px-2 bg-surface-container-lowest focus:border-secondary outline-none border"
              />

              {/* Disc Qty */}
              <input
                type="number"
                value={directEntry.discQty}
                onChange={e => setDirectEntry({ ...directEntry, discQty: e.target.value })}
                placeholder="Disc Qty"
                className="w-[80px] border-outline-variant h-8 font-code-md text-xs rounded px-2 text-right bg-surface-container-lowest focus:border-secondary outline-none border"
              />

              {/* Disc % */}
              <input
                type="number"
                value={directEntry.discPercent}
                onChange={e => setDirectEntry({ ...directEntry, discPercent: e.target.value })}
                placeholder="Disc %"
                className="w-[80px] border-outline-variant h-8 font-code-md text-xs rounded px-2 text-right bg-surface-container-lowest focus:border-secondary outline-none border"
              />

              {/* Disc Amt */}
              <input
                type="text"
                value={directDiscAmt > 0 ? directDiscAmt.toFixed(2) : ""}
                readOnly
                placeholder="Disc Amt"
                className="w-[100px] bg-surface-container-highest border-outline-variant h-8 font-code-md text-xs rounded px-2 text-right font-bold text-on-surface border"
              />

              {/* Total */}
              <input
                type="text"
                value={directLineTotal > 0 ? directLineTotal.toFixed(2) : ""}
                readOnly
                placeholder="Total"
                className="w-[120px] bg-surface-container-lowest border-outline-variant h-8 font-code-md text-xs rounded px-2 text-right font-bold text-primary border"
              />

              {/* Staff Select */}
              <select
                value={directEntry.staff}
                onChange={e => setDirectEntry({ ...directEntry, staff: e.target.value })}
                className="w-[120px] border-outline-variant h-8 text-xs rounded px-1.5 bg-surface-container-lowest border font-medium"
              >
                <option value="Staff A">Staff A</option>
                <option value="Staff B">Staff B</option>
                <option value="Staff C">Staff C</option>
              </select>

              {/* Add Button */}
              <button
                type="button"
                onClick={handleCommitDirectEntry}
                className="h-8 w-8 bg-primary hover:bg-primary-container text-on-primary rounded flex items-center justify-center shadow-2xs shrink-0 cursor-pointer"
                title="Add Item (Enter)"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

        </section>

        {/* FOOTER SECTION */}
        <section className="flex flex-col gap-stack-gap shrink-0">
          <div className="flex flex-col lg:flex-row gap-gutter">
            
            {/* Left Tabbed Details (Transporter / Payment / AddOns) */}
            <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded flex flex-col shadow-xs overflow-hidden">
              <div className="flex border-b border-outline-variant bg-surface-container-low font-label-caps text-label-caps">
                <button
                  type="button"
                  onClick={() => setActiveFooterTab("transporter")}
                  className={`px-4 py-2 border-r border-outline-variant font-bold transition-colors cursor-pointer ${
                    activeFooterTab === "transporter"
                      ? "bg-surface-container-lowest text-primary border-t-2 border-t-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  Transporter Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFooterTab("payment")}
                  className={`px-4 py-2 border-r border-outline-variant font-bold transition-colors cursor-pointer ${
                    activeFooterTab === "payment"
                      ? "bg-surface-container-lowest text-primary border-t-2 border-t-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  Payment Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFooterTab("addons")}
                  className={`px-4 py-2 border-r border-outline-variant font-bold transition-colors cursor-pointer ${
                    activeFooterTab === "addons"
                      ? "bg-surface-container-lowest text-primary border-t-2 border-t-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  AddOns And Deductions
                </button>
              </div>

              {/* Tab 1: Transporter Details */}
              {activeFooterTab === "transporter" && (
                <div className="p-2 overflow-x-auto flex-1 max-h-36">
                  <table className="w-full text-left border border-outline-variant text-xs">
                    <thead className="bg-surface-container-high border-b border-outline-variant font-label-caps text-label-caps text-on-surface-variant font-bold">
                      <tr>
                        <th className="px-2 py-1 w-10 border-r border-outline-variant text-center">S.No</th>
                        <th className="px-2 py-1 w-28 border-r border-outline-variant">Type</th>
                        <th className="px-2 py-1 w-20 border-r border-outline-variant">Code</th>
                        <th className="px-2 py-1 border-r border-outline-variant">Description</th>
                        <th className="px-2 py-1 w-24 border-r border-outline-variant">(Fixed/Variable)</th>
                        <th className="px-2 py-1 w-20 border-r border-outline-variant text-right">Rate/Amt</th>
                        <th className="px-2 py-1 w-20 border-r border-outline-variant text-right">Rate</th>
                        <th className="px-2 py-1 w-24 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="font-code-md text-xs text-on-surface-variant">
                      {transporterRows.map((t, idx) => (
                        <tr key={idx} className="border-b border-outline-variant">
                          <td className="px-2 py-1 border-r border-outline-variant text-center bg-surface-container-low">{t.sNo}</td>
                          <td className="px-2 py-1 border-r border-outline-variant">
                            <input
                              type="text"
                              value={t.type}
                              onChange={e => {
                                const val = e.target.value;
                                setTransporterRows(prev => prev.map((r, i) => i === idx ? { ...r, type: val } : r));
                              }}
                              className="w-full bg-transparent border-none p-0 text-xs font-sans outline-none"
                            />
                          </td>
                          <td className="px-2 py-1 border-r border-outline-variant">{t.code}</td>
                          <td className="px-2 py-1 border-r border-outline-variant">{t.description}</td>
                          <td className="px-2 py-1 border-r border-outline-variant">{t.rateType}</td>
                          <td className="px-2 py-1 border-r border-outline-variant text-right">{t.rateAmt}</td>
                          <td className="px-2 py-1 border-r border-outline-variant text-right">{t.rate}</td>
                          <td className="px-2 py-1 text-right font-bold text-primary">
                            <input
                              type="number"
                              value={t.amount || ""}
                              placeholder="0.00"
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setTransporterRows(prev => prev.map((r, i) => i === idx ? { ...r, amount: val } : r));
                              }}
                              className="w-full bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-right font-code-md text-xs font-bold outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Payment Details */}
              {activeFooterTab === "payment" && (
                <div className="p-3 flex-1 flex flex-col justify-center items-center gap-2 max-h-36 bg-surface-container-low">
                  <p className="text-xs text-on-surface-variant font-medium">Payment Mode: <strong>{headerState.transaction}</strong></p>
                  <button
                    type="button"
                    onClick={() => {
                      if (items.length > 0) setShowSettlementModal(true);
                      else alert("Add items before opening settlement.");
                    }}
                    className="bg-primary hover:bg-primary-container text-on-primary px-4 py-1.5 rounded text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    Open Multi-Tender Settlement Studio (F8)
                  </button>
                </div>
              )}

              {/* Tab 3: Addons & Deductions */}
              {activeFooterTab === "addons" && (
                <div className="p-2 overflow-x-auto flex-1 max-h-36">
                  <table className="w-full text-left border border-outline-variant text-xs">
                    <thead className="bg-surface-container-high border-b border-outline-variant font-label-caps text-label-caps text-on-surface-variant font-bold">
                      <tr>
                        <th className="px-2 py-1 w-10 border-r border-outline-variant text-center">S.No</th>
                        <th className="px-2 py-1 w-24 border-r border-outline-variant">Type</th>
                        <th className="px-2 py-1 w-20 border-r border-outline-variant">Code</th>
                        <th className="px-2 py-1 border-r border-outline-variant">Description</th>
                        <th className="px-2 py-1 w-24 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="font-code-md text-xs">
                      {addonRows.map((a, idx) => (
                        <tr key={idx} className="border-b border-outline-variant">
                          <td className="px-2 py-1 border-r border-outline-variant text-center bg-surface-container-low">{a.sNo}</td>
                          <td className="px-2 py-1 border-r border-outline-variant">
                            <select
                              value={a.type}
                              onChange={e => {
                                const val = e.target.value as "Addon" | "Deduction";
                                setAddonRows(prev => prev.map((r, i) => i === idx ? { ...r, type: val } : r));
                              }}
                              className="bg-transparent border-none text-xs p-0 outline-none"
                            >
                              <option value="Addon">Addon (+)</option>
                              <option value="Deduction">Deduction (-)</option>
                            </select>
                          </td>
                          <td className="px-2 py-1 border-r border-outline-variant">{a.code}</td>
                          <td className="px-2 py-1 border-r border-outline-variant">{a.description}</td>
                          <td className="px-2 py-1 text-right font-bold text-primary">
                            <input
                              type="number"
                              value={a.amount || ""}
                              placeholder="0.00"
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setAddonRows(prev => prev.map((r, i) => i === idx ? { ...r, amount: val } : r));
                              }}
                              className="w-full bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-right font-code-md text-xs font-bold outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Document Remarks Input */}
              <div className="p-2 border-t border-outline-variant bg-surface-container-low shrink-0">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold mb-1 block">
                  Document Remarks
                </label>
                <input
                  type="text"
                  value={headerState.remarks}
                  onChange={e => setHeaderState({ ...headerState, remarks: e.target.value })}
                  placeholder="e.g. Dispatched via Express logistics, Fragile handling requested"
                  className="w-full border border-outline-variant rounded h-7 text-xs px-2 bg-surface focus:border-secondary outline-none font-medium"
                />
              </div>
            </div>

            {/* Right Totals Grid */}
            <div className="w-full lg:w-80 bg-surface-container-lowest border border-outline-variant rounded flex flex-col p-2 shadow-xs">
              <table className="w-full text-left font-body-sm text-xs">
                <thead className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant uppercase font-bold">
                  <tr>
                    <th className="pb-1.5 w-28">Description</th>
                    <th className="pb-1.5 text-right">Net Values</th>
                  </tr>
                </thead>
                <tbody className="font-code-md text-xs divide-y divide-outline-variant/30">
                  <tr>
                    <td className="py-1.5 text-on-surface-variant font-medium">Sales</td>
                    <td className="py-1.5">
                      <input
                        type="text"
                        value={summaryTotals.salesValue.toFixed(2)}
                        readOnly
                        className="w-full h-6 text-right bg-surface-variant border border-outline-variant rounded px-1.5 font-bold text-on-surface"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-on-surface-variant font-medium">Discounts</td>
                    <td className="py-1.5">
                      <input
                        type="text"
                        value={summaryTotals.itemDiscount.toFixed(2)}
                        readOnly
                        className="w-full h-6 text-right bg-surface-variant border border-outline-variant rounded px-1.5 font-bold text-on-surface"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-on-surface-variant font-medium">Sales Tax</td>
                    <td className="py-1.5">
                      <input
                        type="text"
                        value={summaryTotals.totalTax.toFixed(2)}
                        readOnly
                        className="w-full h-6 text-right bg-surface-variant border border-outline-variant rounded px-1.5 font-bold text-on-surface"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-on-surface-variant font-medium">Add-ons</td>
                    <td className="py-1.5">
                      <input
                        type="text"
                        value={summaryTotals.totalAddons.toFixed(2)}
                        readOnly
                        className="w-full h-6 text-right bg-surface-variant border border-outline-variant rounded px-1.5 font-bold text-on-surface"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-on-surface-variant font-medium">Deductions</td>
                    <td className="py-1.5">
                      <input
                        type="text"
                        value={summaryTotals.totalDeductions.toFixed(2)}
                        readOnly
                        className="w-full h-6 text-right bg-surface-variant border border-outline-variant rounded px-1.5 font-bold text-on-surface"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          {/* Bottom High-Visibility Status Bar */}
          <div className="bg-primary-container text-on-primary border border-outline-variant rounded flex font-label-caps text-[10px] sm:text-label-caps overflow-hidden shadow-sm shrink-0">
            <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
              <span className="opacity-70 uppercase tracking-wider">No. of Items</span>
              <span className="font-code-md font-bold text-base text-white">{summaryTotals.itemCount}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
              <span className="opacity-70 uppercase tracking-wider">Total Qty.</span>
              <span className="font-code-md font-bold text-base text-white">{summaryTotals.totalQty.toFixed(2)}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
              <span className="opacity-70 uppercase tracking-wider">Sales Value</span>
              <span className="font-code-md font-bold text-base text-white">₹{summaryTotals.salesValue.toFixed(2)}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
              <span className="opacity-70 uppercase tracking-wider">Item Lvl. Discount</span>
              <span className="font-code-md font-bold text-base text-white">₹{summaryTotals.itemDiscount.toFixed(2)}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
              <span className="opacity-70 uppercase tracking-wider">Bill Discount</span>
              <span className="font-code-md font-bold text-base text-white">₹{summaryTotals.billDiscount.toFixed(2)}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
              <span className="opacity-70 uppercase tracking-wider">Total Tax</span>
              <span className="font-code-md font-bold text-base text-white">₹{summaryTotals.totalTax.toFixed(2)}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
              <span className="opacity-70 uppercase tracking-wider">Total Addons</span>
              <span className="font-code-md font-bold text-base text-white">₹{summaryTotals.totalAddons.toFixed(2)}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
              <span className="opacity-70 uppercase tracking-wider">Total Deductions</span>
              <span className="font-code-md font-bold text-base text-white">₹{summaryTotals.totalDeductions.toFixed(2)}</span>
            </div>

            <div className="flex-[1.5] bg-[#315384] text-white flex flex-col justify-center items-end p-2 px-4">
              <span className="opacity-80 font-bold uppercase tracking-wider">Net Amount</span>
              <span className="font-code-md font-bold text-2xl text-white">₹{summaryTotals.netAmount.toFixed(2)}</span>
            </div>
          </div>

        </section>

      </main>

      {/* Attachments Panel (Collapsible) */}
      {showAttachmentPanel && (
        <div className="bg-surface-container-lowest border-t border-outline-variant px-margin-page py-3">
          <TransactionAttachmentPanel
            documentType="billing"
            documentId={`${headerState.docPrefix}-${headerState.docNo}` || "new-bill"}
            onAttachmentAdded={(att: TransactionAttachment) => {
              onNotification?.("Success", `✓ ${att.fileName} attached`, "success");
            }}
            readOnly={false}
            maxFiles={5}
            allowedExtensions="PDF, Word, Excel, CSV, Images (JPG, PNG, GIF), ZIP"
          />
        </div>
      )}

      {/* Persistent Bottom Shortcut Footer */}
      <footer className="bg-surface-container-highest border-t border-outline-variant mt-auto w-full flex justify-between items-center px-margin-page py-2 shrink-0 z-30 font-label-caps text-label-caps">
        <span className="text-on-surface-variant font-medium">
          Ready... <strong className="text-primary">F2:</strong> Search | <strong className="text-primary">F11:</strong> Direct Entry | <strong className="text-primary">F6:</strong> Discounts | <strong className="text-primary">F7/F8:</strong> Settlement | <strong className="text-primary">F12:</strong> Suspend | <strong className="text-primary">Ctrl+4:</strong> AddOns
        </span>
        <span className="text-primary font-bold">© 2026 smritisys.com</span>
      </footer>

      {/* MODALS */}

      {/* 1. Settlement Modal */}
      <SmritiInvoiceSettlementModal
        isOpen={showSettlementModal}
        billNo={`${headerState.docPrefix}-${headerState.docNo}`}
        billDate={headerState.billDate}
        customer={headerState.customer}
        netAmount={summaryTotals.netAmount}
        transaction={headerState.transaction}
        onCompleteSettlement={handleCompleteSettlement}
        onSuspendBill={handleSuspendInvoice}
        onClose={() => setShowSettlementModal(false)}
      />

      {/* 2. PDT Import Modal */}
      <PdtImportModal
        isOpen={showPdtImportModal}
        products={liveProducts}
        onImportItems={handleImportPdtItems}
        onClose={() => setShowPdtImportModal(false)}
      />

      {/* 3. Product Search / Catalog F2 Browser */}
      <ProductSearchBrowserModal
        isOpen={showProductSearchModal}
        products={liveProducts}
        onSelectProduct={product => {
          setDirectEntry({
            ...directEntry,
            stockNo: product.code,
            itemDescription: product.name,
            rate: String((product as any).sellingPrice || product.price || product.mrp || 0)
          });
          setShowProductSearchModal(false);
          directStockNoRef.current?.focus();
        }}
        onClose={() => setShowProductSearchModal(false)}
      />

      {/* 4. Recall Suspended Invoices Modal */}
      {showRecallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-surface rounded-lg shadow-2xl w-full max-w-xl border border-outline-variant overflow-hidden flex flex-col">
            <div className="bg-surface-container-lowest px-5 py-3 border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-title-sm text-sm font-bold text-primary flex items-center gap-2">
                <History size={16} className="text-secondary" />
                <span>Held / Suspended Invoices Queue</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRecallModal(false)}
                className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 max-h-72 overflow-y-auto">
              {suspendedBills.length === 0 ? (
                <p className="text-center py-6 text-xs text-on-surface-variant">No suspended invoices currently on hold.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {suspendedBills.map((bill, idx) => (
                    <div
                      key={bill.id}
                      className="bg-surface-container-low border border-outline-variant p-3 rounded flex justify-between items-center hover:bg-secondary-fixed/30 transition"
                    >
                      <div>
                        <p className="font-code-md text-xs font-bold text-primary">
                          {bill.header.docPrefix}-{bill.header.docNo}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          {bill.header.customer?.name || "Counter Cash"} • {bill.items.length} items • Held at {bill.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-code-md text-xs font-bold text-primary">₹{bill.netAmount.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => handleRecallInvoice(bill)}
                          className="bg-primary hover:bg-primary-container text-on-primary px-3 py-1 rounded text-xs font-bold transition"
                        >
                          Recall
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-surface-container-low px-5 py-2.5 border-t border-outline-variant flex justify-end">
              <button
                type="button"
                onClick={() => setShowRecallModal(false)}
                className="bg-surface-container border border-outline-variant px-4 py-1.5 rounded text-xs font-semibold text-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-surface rounded-lg shadow-2xl w-full max-w-md border border-outline-variant overflow-hidden flex flex-col">
            <div className="bg-surface-container-lowest px-5 py-3 border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-title-sm text-sm font-bold text-primary flex items-center gap-2">
                <UserPlus size={16} className="text-secondary" />
                <span>Quick Add Customer</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <div>
                <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1 font-bold uppercase">Customer Name *</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="e.g. Modern Enterprises Pvt Ltd"
                  className="w-full border border-outline-variant rounded h-8 px-2.5 text-xs bg-surface focus:border-secondary outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1 font-bold uppercase">Mobile Number</label>
                <input
                  type="text"
                  value={newCustMobile}
                  onChange={e => setNewCustMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full border border-outline-variant rounded h-8 px-2.5 text-xs font-code-md bg-surface focus:border-secondary outline-none"
                />
              </div>

              <div>
                <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1 font-bold uppercase">GSTIN / Tax ID</label>
                <input
                  type="text"
                  value={newCustGstin}
                  onChange={e => setNewCustGstin(e.target.value)}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  className="w-full border border-outline-variant rounded h-8 px-2.5 text-xs font-code-md bg-surface focus:border-secondary outline-none font-bold"
                />
              </div>
            </div>

            <div className="bg-surface-container-low px-5 py-3 border-t border-outline-variant flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="bg-surface-container border border-outline-variant px-4 py-1.5 rounded text-xs font-semibold text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={!newCustName}
                className="bg-primary hover:bg-primary-container text-on-primary px-5 py-1.5 rounded text-xs font-bold transition disabled:opacity-40"
              >
                Save &amp; Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tax Invoice Print Modal */}
      {showPrintModal && lastCompletedInvoice && (
        <PrintPreviewModal
          isOpen={showPrintModal}
          data={{
            companyName: "SMRITI Retail OS",
            companyAddress: "Central Warehouse, Distribution Center",
            invoiceNumber: lastCompletedInvoice.invoiceNumber,
            date: lastCompletedInvoice.date,
            customerName: lastCompletedInvoice.customerName,
            customerPhone: "",
            customerGstin: lastCompletedInvoice.customerGstin,
            items: lastCompletedInvoice.items,
            subtotal: lastCompletedInvoice.subtotal,
            discount: lastCompletedInvoice.discount,
            tax: lastCompletedInvoice.tax,
            total: lastCompletedInvoice.total,
            paymentMode: lastCompletedInvoice.paymentMode,
            terms: "Subject to local jurisdiction. Goods once sold will not be taken back without valid invoice."
          }}
          onClose={() => setShowPrintModal(false)}
        />
      )}

    </div>
  );
};

export default BillingTerm;
