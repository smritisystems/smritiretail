/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.7.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Stitch Distributor Invoicing Terminal
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Product, Customer, POSProfile, Shift } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { getCustomers, saveCustomers, initialCustomers } from "../../services/customerStore.ts";
import { 
  searchBackendCustomers, 
  searchBackendProducts, 
  AutoPopulateCustomerResult, 
  AutoPopulateProductResult 
} from "../../services/autoPopulateService.ts";
import { SmritiTypeaheadDropdown, TypeaheadOption } from "../common/SmritiTypeaheadDropdown.tsx";
import { SmritiItemTypeaheadDropdown } from "../common/SmritiItemTypeaheadDropdown.tsx";
import {
  BillingLineItem,
  BillType,
  TransactionType,
  BillingHeaderState,
  BillingSummaryTotals,
  TransporterRow,
  AddonDeductionRow,
  SettlementPaymentRow
} from "./types.ts";
import { ProductSearchBrowserModal } from "./ProductSearchBrowserModal.tsx";
import { ItemBrowseOverlayModal } from "./ItemBrowseOverlayModal.tsx";
import { PdtImportModal } from "./PdtImportModal.tsx";
import { SmritiInvoiceSettlementModal } from "./SmritiInvoiceSettlementModal.tsx";
import { PrintPreviewModal } from "../PrintPreviewModal.tsx";
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
  UserPlus
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

export const SmritiBillingTerminal: React.FC<SmritiBillingTerminalProps> = ({
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
    remarks: ""
  });

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
  const [customers, setCustomers] = useState<Customer[]>(() => {
    if (initialCustomersProp && initialCustomersProp.length > 0) return initialCustomersProp;
    const local = getCustomers();
    return (local && local.length > 0) ? local : initialCustomers;
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
  const [suspendedBills, setSuspendedBills] = useState<{ id: string; header: BillingHeaderState; items: BillingLineItem[]; date: string; netAmount: number }[]>([]);
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<any>(null);

  // References
  const directStockNoRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Focus direct entry row on mount & fetch customers
  useEffect(() => {
    fetchCustomers();
    directStockNoRef.current?.focus();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await apiFetchV1("/customers");
      if (Array.isArray(res)) {
        setCustomers(res);
        saveCustomers(res);
        return;
      }
    } catch {
      // Offline fallback
    }
    const local = getCustomers();
    setCustomers(local || []);
  };

  const handleSelectCustomer = (c: Customer | null) => {
    setHeaderState(prev => ({ ...prev, customer: c }));
    if (c) {
      setCustomerSearchInput(c.name);
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
      transaction: (r as any).allowCreditInvoice !== false ? prev.transaction : "Cash"
    }));

    setCustomerSearchInput(r.name);
    setShowCustomerDropdown(false);
    onNotification?.("Customer Auto-Populated", `Auto-populated ${r.name} from backend.`, "success");
  };

  const handleCustomerSearchChange = (val: string) => {
    setCustomerSearchInput(val);
    setShowCustomerDropdown(true);

    if (!val.trim()) {
      setHeaderState(prev => ({ ...prev, customer: null }));
      setCustomerSuggestions([]);
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

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside a popup modal
      if (showSettlementModal || showPdtImportModal || showProductSearchModal || showItemBrowseModal || showAddCustomerModal || showRecallModal || showPrintModal) {
        return;
      }

      if (e.key === "F2") {
        e.preventDefault();
        if (document.activeElement === customerInputRef.current) {
          setShowCustomerDropdown(true);
        } else {
          setShowProductSearchModal(true);
        }
      } else if (e.key === "F11") {
        e.preventDefault();
        directStockNoRef.current?.focus();
      } else if (e.key === "F7" || e.key === "F8") {
        e.preventDefault();
        if (items.length > 0) {
          setShowSettlementModal(true);
        } else {
          alert("Please add at least one item before opening settlement.");
        }
      } else if (e.key === "F12") {
        e.preventDefault();
        handleSuspendInvoice();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [items, headerState, showSettlementModal, showPdtImportModal, showProductSearchModal, showItemBrowseModal, showAddCustomerModal, showRecallModal, showPrintModal]);

  // Derived Direct Entry Calculations
  const directRateNum = parseFloat(directEntry.rate) || 0;
  const directQtyNum = parseFloat(directEntry.qty) || 0;
  const directGrossValue = directRateNum * directQtyNum;
  const directDiscPctNum = parseFloat(directEntry.discPercent) || 0;
  const directDiscAmt = directDiscPctNum > 0 ? (directGrossValue * directDiscPctNum) / 100 : (parseFloat(directEntry.discQty) || 0);
  const directLineTotal = Math.max(0, directGrossValue - directDiscAmt);

  // Recompute Summary Totals
  const summaryTotals: BillingSummaryTotals = useMemo(() => {
    let itemCount = items.length;
    let totalQty = 0;
    let salesValue = 0;
    let itemDiscount = 0;
    let totalTax = 0;

    items.forEach(it => {
      totalQty += Number(it.qty || 0);
      const gross = Number(it.rate || 0) * Number(it.qty || 0);
      salesValue += gross;
      itemDiscount += Number(it.discAmt || 0);
      totalTax += Number(it.taxAmount || 0);
    });

    const billDiscount = 0;
    const totalAddons = transporterRows.reduce((s, r) => s + (Number(r.amount) || 0), 0) + addonRows.filter(a => a.type === "Addon").reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const totalDeductions = addonRows.filter(a => a.type === "Deduction").reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const rawNet = salesValue - itemDiscount - billDiscount + totalTax + totalAddons - totalDeductions;
    const netAmount = Math.max(0, Math.round(rawNet * 100) / 100);

    return {
      itemCount,
      totalQty,
      salesValue,
      itemDiscount,
      billDiscount,
      totalTax,
      totalAddons,
      totalDeductions,
      roundOff: 0,
      netAmount
    };
  }, [items, transporterRows, addonRows]);

  const applyProductAutoPopulate = (p: AutoPopulateProductResult | Product) => {
    const rateVal = String((p as any).sellingPrice || (p as any).mrp || 0);
    const stockVal = (p as any).stockNo || (p as any).styleCode || (p as any).style_code || p.code || "";
    const barcodeVal = p.barcode || (p as any).code || "";
    setDirectEntry(prev => ({
      ...prev,
      stockNo: stockVal,
      barcode: barcodeVal,
      itemDescription: p.name || (p as any).itemDescription || "",
      rate: rateVal
    }));
    setSelectedItemProductMeta(p as AutoPopulateProductResult);
    setShowProductDropdown(false);
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
      return;
    }

    setShowProductDropdown(true);
    if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    setIsProductSearching(true);

    productDebounceRef.current = setTimeout(async () => {
      try {
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
    const value = rate * qty;
    const discAmt = directDiscAmt;
    const total = value - discAmt;

    const newLine: BillingLineItem = {
      id: "item-" + Date.now() + "-" + Math.random(),
      sNo: items.length + 1,
      stockNo: directEntry.stockNo || (matched as any)?.stockNo || (matched as any)?.code || "SKU-GEN",
      barcode: directEntry.barcode || (matched as any)?.barcode || directEntry.stockNo,
      itemDescription: directEntry.itemDescription || (matched as any)?.name || "Item " + (items.length + 1),
      rate,
      qty,
      value,
      discCode: directEntry.discCode,
      discQty: parseFloat(directEntry.discQty) || 0,
      discPercent: directDiscPctNum,
      discAmt,
      total,
      salesStaff: directEntry.staff,
      productId: (matched as any)?.id,
      hsnCode: (matched as any)?.hsnCode,
      gstPercentage: (matched as any)?.gstPercentage || 18,
      taxAmount: (total * ((matched as any)?.gstPercentage || 18)) / 100,
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

  // Suspend / Hold Invoice
  const handleSuspendInvoice = () => {
    if (items.length === 0) {
      alert("No items to suspend.");
      return;
    }
    const suspended = {
      id: "HOLD-" + Date.now(),
      header: { ...headerState },
      items: [...items],
      date: new Date().toLocaleTimeString(),
      netAmount: summaryTotals.netAmount
    };
    setSuspendedBills(prev => [suspended, ...prev]);
    setItems([]);
    setHeaderState(prev => ({
      ...prev,
      docNo: String(parseInt(prev.docNo) + 1 || 2),
      customer: null
    }));
    setCustomerSearchInput("");
    onNotification?.("Invoice Suspended", `Bill ${suspended.header.docPrefix}-${suspended.header.docNo} held in queue.`, "success");
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
  const handleCompleteSettlement = (payments: SettlementPaymentRow[], totalTendered: number, changeDue: number) => {
    const completedInvoice = {
      invoiceNumber: `${headerState.docPrefix}-${headerState.docNo}`,
      date: headerState.billDate,
      customerName: headerState.customer?.name || "Counter Cash Sale",
      customerGstin: headerState.customer?.gstNumber || "",
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
      totalTendered,
      changeDue,
      paymentMode: payments.map(p => p.mode).join(", ")
    };

    setLastCompletedInvoice(completedInvoice);
    setShowSettlementModal(false);
    setShowPrintModal(true);

    // Reset for next invoice
    setItems([]);
    setHeaderState(prev => ({
      ...prev,
      docNo: String(parseInt(prev.docNo) + 1 || 2),
      customer: null,
      remarks: ""
    }));
    setCustomerSearchInput("");
    onNotification?.("Settlement Complete", `Invoice ${completedInvoice.invoiceNumber} recorded successfully.`, "success");
  };

  // Add Quick Customer
  const handleCreateCustomer = () => {
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
    <div className="h-full flex flex-col bg-surface text-on-surface font-sans select-none overflow-hidden">
      
      {/* Top Application Bar */}
      <header className="bg-surface text-primary font-headline-md w-full sticky top-0 z-30 border-b border-outline-variant flex justify-between items-center px-margin-page py-2 h-14 shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <span className="font-headline-md text-base font-bold text-primary flex items-center gap-2">
            <Receipt size={20} className="text-secondary" />
            <span>smritiSystems Invoicing Terminal</span>
          </span>
          <span className="font-code-md text-xs bg-secondary-fixed text-on-secondary-fixed px-2.5 py-0.5 rounded-full font-bold">
            Distributor Terminal
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPdtImportModal(true)}
            className="h-8 px-3 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
            title="Import from PDT / File (Ctrl+I)"
          >
            <Download size={14} className="text-secondary" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRecallModal(true)}
            className="h-8 px-3 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
            title="Recall Held Invoice (Ctrl+R)"
          >
            <History size={14} className="text-secondary" />
            <span>Recall ({suspendedBills.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (items.length > 0) setShowSettlementModal(true);
              else alert("Add items before settlement.");
            }}
            className="h-8 px-4 bg-primary hover:bg-primary-container text-on-primary rounded font-title-sm text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <CreditCard size={14} />
            <span>Settlement (F8)</span>
          </button>
        </div>
      </header>

      {/* Main Invoicing Canvas */}
      <div className="flex-1 flex flex-col p-stack-gap gap-stack-gap overflow-y-auto max-w-container-max-width mx-auto w-full">
        
        {/* HEADER SECTION */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded p-3.5 flex flex-col gap-stack-gap shadow-xs">
          
          {/* Row 1: Bill Type, Transaction, Doc Prefix, Doc No, Action Buttons */}
          <div className="flex flex-wrap items-end gap-gutter">
            <div className="flex flex-col gap-unit w-44">
              <label className="font-label-caps text-[11px] text-on-surface-variant font-bold uppercase">Bill Type</label>
              <select
                value={headerState.billType}
                onChange={e => setHeaderState({ ...headerState, billType: e.target.value as BillType })}
                className="border border-outline-variant text-body-sm text-xs focus:border-secondary focus:ring-1 focus:ring-secondary rounded h-8 bg-surface px-2 font-medium"
              >
                <option value="Product">Product</option>
                <option value="Service">Service</option>
                <option value="Both">Both (Hybrid)</option>
              </select>
            </div>

            <div className="flex flex-col gap-unit w-44">
              <label className="font-label-caps text-[11px] text-on-surface-variant font-bold uppercase">Transaction</label>
              <select
                value={headerState.transaction}
                onChange={e => setHeaderState({ ...headerState, transaction: e.target.value as TransactionType })}
                className="border border-outline-variant text-body-sm text-xs focus:border-secondary focus:ring-1 focus:ring-secondary rounded h-8 bg-surface px-2 font-medium"
              >
                <option value="Credit">Credit Invoice</option>
                <option value="Cash">Cash Invoice</option>
                <option value="Retail">Retail Tax Bill</option>
              </select>
            </div>

            <div className="flex flex-col gap-unit w-32">
              <label className="font-label-caps text-[11px] text-on-surface-variant font-bold uppercase">Doc Prefix</label>
              <input
                type="text"
                value={headerState.docPrefix}
                onChange={e => setHeaderState({ ...headerState, docPrefix: e.target.value })}
                className="bg-surface-container-low border border-outline-variant text-body-sm font-code-md text-xs font-bold text-primary rounded h-8 px-2"
              />
            </div>

            <div className="flex flex-col gap-unit w-28">
              <label className="font-label-caps text-[11px] text-on-surface-variant font-bold uppercase">Doc No</label>
              <input
                type="text"
                value={headerState.docNo}
                onChange={e => setHeaderState({ ...headerState, docNo: e.target.value })}
                className="bg-surface-container-low border border-outline-variant text-body-sm font-code-md text-xs font-bold text-on-surface-variant rounded h-8 px-2"
              />
            </div>

            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setShowPdtImportModal(true)}
                className="h-8 px-3 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Download size={13} className="text-secondary" />
                <span>Import</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRecallModal(true)}
                className="h-8 px-3 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <History size={13} className="text-secondary" />
                <span>Recall</span>
              </button>
            </div>
          </div>

          {/* Row 2: Customer F2 search, Display, Add button, Sales Staff */}
          <div className="flex flex-wrap items-end gap-gutter">
            
            {/* Customer Search & Quick Add */}
            <div className="flex flex-col gap-unit flex-1 relative">
              <label className="font-label-caps text-[11px] text-on-surface-variant font-bold uppercase">
                Customer <span className="text-error">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={customerInputRef}
                    type="text"
                    name="customerSearch"
                    aria-label="Search customer (F2)"
                    data-f2-browse="customer"
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
                    className="w-full border border-outline-variant text-body-sm text-xs focus:border-secondary focus:ring-1 focus:ring-secondary rounded h-8 pl-8 pr-2 bg-surface font-medium"
                  />
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  
                  {/* Real-Time Backend Customer Typeahead Dropdown */}
                  <SmritiTypeaheadDropdown
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
                  value={headerState.customer?.name || "No Customer Selected"}
                  readOnly
                  placeholder="Customer Name Display"
                  className="flex-1 bg-surface-container-low border border-outline-variant text-body-sm text-xs font-semibold text-primary rounded h-8 px-2.5 truncate"
                />

                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="h-8 px-3.5 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-xs font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                >
                  <UserPlus size={13} className="text-secondary" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Sales Staff */}
            <div className="flex flex-col gap-unit w-64">
              <label className="font-label-caps text-[11px] text-on-surface-variant font-bold uppercase">Sales Staff</label>
              <select
                value={headerState.salesStaff}
                onChange={e => setHeaderState({ ...headerState, salesStaff: e.target.value })}
                className="border border-outline-variant text-body-sm text-xs focus:border-secondary focus:ring-1 focus:ring-secondary rounded h-8 bg-surface px-2 font-medium"
              >
                <option value="EMP001 - John Doe">EMP001 - John Doe</option>
                <option value="EMP002 - Jane Smith">EMP002 - Jane Smith</option>
                <option value="EMP003 - Rahul Sharma">EMP003 - Rahul Sharma</option>
              </select>
            </div>

          </div>

        </section>

        {/* DETAIL SECTION (MAIN WORKSPACE) */}
        <section className="flex-1 bg-surface-container-lowest border border-outline-variant rounded flex flex-col overflow-hidden min-h-[300px] shadow-xs">
          
          {/* Direct Entry Row (F11) */}
          <div className="bg-surface-container-low border-b border-outline-variant p-2 flex flex-col gap-1.5 shrink-0 relative">
            
            {/* Multi-attribute quick inspector ribbon */}
            {selectedItemProductMeta && (
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded px-2.5 py-1 text-[11px] flex items-center justify-between text-blue-900 dark:text-cyan-200">
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
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-1"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex gap-2 items-center">
              <span className="font-label-caps text-[11px] text-on-surface-variant bg-surface-variant px-2 py-1 rounded w-10 text-center font-bold">
                F11
              </span>

              <div className="flex-1 grid grid-cols-[120px_110px_1fr_80px_70px_80px_70px_70px_70px_90px_100px_40px] gap-2">
                
                {/* Barcode Field */}
                <div className="relative">
                  <input
                    ref={directBarcodeRef}
                    type="text"
                    value={directEntry.barcode}
                    onChange={e => handleItemSearchChange(e.target.value, "barcode")}
                    onFocus={() => {
                      setActiveItemSearchField("barcode");
                      if (productSuggestions.length > 0) setShowProductDropdown(true);
                    }}
                    onKeyDown={e => handleItemInputKeyDown(e, "barcode")}
                    placeholder="Scan Barcode"
                    className="border-2 border-blue-500/70 h-8 w-full text-xs font-code-md rounded px-2 bg-surface font-bold focus:border-secondary outline-none"
                  />
                  {activeItemSearchField === "barcode" && (
                    <SmritiItemTypeaheadDropdown
                      isOpen={showProductDropdown && (productSuggestions.length > 0 || isProductSearching)}
                      items={productSuggestions}
                      selectedIndex={productSelectedIndex}
                      isLoading={isProductSearching}
                      onSelect={(opt) => applyProductAutoPopulate(opt)}
                      onClose={() => setShowProductDropdown(false)}
                      searchFieldType="barcode"
                    />
                  )}
                </div>

                {/* Stock No Field */}
                <div className="relative">
                  <input
                    ref={directStockNoRef}
                    type="text"
                    value={directEntry.stockNo}
                    onChange={e => handleItemSearchChange(e.target.value, "stockNo")}
                    onFocus={() => {
                      setActiveItemSearchField("stockNo");
                      if (productSuggestions.length > 0) setShowProductDropdown(true);
                    }}
                    onKeyDown={e => handleItemInputKeyDown(e, "stockNo")}
                    placeholder="Stock No / SKU"
                    className="border border-outline-variant h-8 w-full text-xs font-code-md rounded px-2 bg-surface font-bold focus:border-secondary outline-none"
                  />
                  {activeItemSearchField === "stockNo" && (
                    <SmritiItemTypeaheadDropdown
                      isOpen={showProductDropdown && (productSuggestions.length > 0 || isProductSearching)}
                      items={productSuggestions}
                      selectedIndex={productSelectedIndex}
                      isLoading={isProductSearching}
                      onSelect={(opt) => applyProductAutoPopulate(opt)}
                      onClose={() => setShowProductDropdown(false)}
                      searchFieldType="stockNo"
                    />
                  )}
                </div>

              <input
                type="text"
                value={directEntry.itemDescription}
                onChange={e => setDirectEntry({ ...directEntry, itemDescription: e.target.value })}
                onKeyDown={e => e.key === "Enter" && handleCommitDirectEntry()}
                placeholder="Item Description"
                className="border border-outline-variant h-8 text-xs rounded px-2 bg-surface font-medium focus:border-secondary outline-none"
              />

              <input
                type="number"
                step="0.01"
                value={directEntry.rate}
                onChange={e => setDirectEntry({ ...directEntry, rate: e.target.value })}
                onKeyDown={e => e.key === "Enter" && handleCommitDirectEntry()}
                placeholder="Rate"
                className="border border-outline-variant h-8 text-xs font-code-md rounded px-2 text-right bg-surface font-bold focus:border-secondary outline-none"
              />

              <input
                type="number"
                min="1"
                value={directEntry.qty}
                onChange={e => setDirectEntry({ ...directEntry, qty: e.target.value })}
                onKeyDown={e => e.key === "Enter" && handleCommitDirectEntry()}
                placeholder="Qty"
                className="border border-outline-variant h-8 text-xs font-code-md rounded px-2 text-right bg-surface font-bold focus:border-secondary outline-none"
              />

              <input
                type="text"
                value={directGrossValue > 0 ? directGrossValue.toFixed(2) : ""}
                readOnly
                placeholder="Value"
                className="bg-surface-variant border border-outline-variant h-8 text-xs font-code-md rounded px-2 text-right font-bold text-on-surface"
              />

              <input
                type="text"
                value={directEntry.discCode}
                onChange={e => setDirectEntry({ ...directEntry, discCode: e.target.value })}
                placeholder="Disc Code"
                className="border border-outline-variant h-8 text-xs font-code-md rounded px-2 bg-surface focus:border-secondary outline-none"
              />

              <input
                type="number"
                value={directEntry.discQty}
                onChange={e => setDirectEntry({ ...directEntry, discQty: e.target.value })}
                placeholder="Disc Qty"
                className="border border-outline-variant h-8 text-xs font-code-md rounded px-2 text-right bg-surface focus:border-secondary outline-none"
              />

              <input
                type="number"
                value={directEntry.discPercent}
                onChange={e => setDirectEntry({ ...directEntry, discPercent: e.target.value })}
                placeholder="Disc %"
                className="border border-outline-variant h-8 text-xs font-code-md rounded px-2 text-right bg-surface focus:border-secondary outline-none"
              />

              <input
                type="text"
                value={directDiscAmt > 0 ? directDiscAmt.toFixed(2) : ""}
                readOnly
                placeholder="Disc Amt"
                className="bg-surface-variant border border-outline-variant h-8 text-xs font-code-md rounded px-2 text-right font-bold text-on-surface"
              />

              <input
                type="text"
                value={directLineTotal > 0 ? directLineTotal.toFixed(2) : ""}
                readOnly
                placeholder="Total"
                className="bg-surface-variant border border-outline-variant h-8 text-xs font-code-md rounded px-2 text-right font-bold text-primary"
              />

              <select
                value={directEntry.staff}
                onChange={e => setDirectEntry({ ...directEntry, staff: e.target.value })}
                className="border border-outline-variant h-8 text-xs rounded px-1 bg-surface"
              >
                <option value="Staff A">Staff A</option>
                <option value="Staff B">Staff B</option>
              </select>

                <button
                  type="button"
                  onClick={handleCommitDirectEntry}
                  className="h-8 bg-primary hover:bg-primary-container text-on-primary rounded flex items-center justify-center shadow-2xs"
                  title="Add Item (Enter)"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Main Line Items Table */}
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="bg-surface-container-high sticky top-0 z-10 border-b border-outline-variant font-label-caps text-[11px] text-on-surface-variant font-bold">
                <tr>
                  <th className="px-3 py-2 w-12 border-r border-outline-variant text-center">S.No</th>
                  <th className="px-3 py-2 w-28 border-r border-outline-variant">Stock No</th>
                  <th className="px-3 py-2 border-r border-outline-variant">Item Description</th>
                  <th className="px-3 py-2 w-24 text-right border-r border-outline-variant">Rate</th>
                  <th className="px-3 py-2 w-20 text-right border-r border-outline-variant">Qty</th>
                  <th className="px-3 py-2 w-24 text-right border-r border-outline-variant">Value</th>
                  <th className="px-3 py-2 w-24 border-r border-outline-variant">Disc Code</th>
                  <th className="px-3 py-2 w-20 text-right border-r border-outline-variant">Disc Qty</th>
                  <th className="px-3 py-2 w-20 text-right border-r border-outline-variant">Disc %</th>
                  <th className="px-3 py-2 w-24 text-right border-r border-outline-variant">Disc Amt</th>
                  <th className="px-3 py-2 w-28 text-right border-r border-outline-variant">Total</th>
                  <th className="px-3 py-2 w-28 border-r border-outline-variant">Staff</th>
                  <th className="px-2 py-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="font-body-sm text-xs divide-y divide-outline-variant/40">
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
                    <td className="px-3 py-2 text-center border-r border-outline-variant bg-surface-container-low font-code-md">
                      {item.sNo}
                    </td>
                    <td className="px-3 py-2 border-r border-outline-variant font-code-md font-bold text-primary">
                      {item.stockNo}
                    </td>
                    <td className="px-3 py-2 border-r border-outline-variant truncate max-w-xs font-medium">
                      {item.itemDescription}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant font-code-md">
                      {Number(item.rate).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant font-code-md font-bold">
                      {item.qty}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant font-code-md">
                      {Number(item.value).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 border-r border-outline-variant font-code-md text-on-surface-variant">
                      {item.discCode || "-"}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant font-code-md">
                      {item.discQty || "0"}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant font-code-md">
                      {item.discPercent ? `${item.discPercent}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant font-code-md">
                      {item.discAmt > 0 ? item.discAmt.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-outline-variant font-code-md font-bold text-primary">
                      {Number(item.total).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 border-r border-outline-variant truncate max-w-[100px] text-on-surface-variant">
                      {item.salesStaff}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleRemoveItem(item.id);
                        }}
                        className="text-on-surface-variant hover:text-error transition-colors p-1"
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
                    <td className="px-3 py-2 text-center border-r border-outline-variant bg-surface-container-low text-on-surface-variant/40 font-code-md">
                      {items.length + i + 1}
                    </td>
                    <td colSpan={12} className="px-3 py-2 text-on-surface-variant/20 italic"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </section>

        {/* FOOTER SECTION */}
        <section className="flex flex-col gap-stack-gap shrink-0">
          <div className="flex flex-col lg:flex-row gap-gutter">
            
            {/* Left Tabbed Details (Transporter / Payment / AddOns) */}
            <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded flex flex-col shadow-xs overflow-hidden">
              <div className="flex border-b border-outline-variant bg-surface-container-low font-label-caps text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveFooterTab("transporter")}
                  className={`px-4 py-2 border-r border-outline-variant font-bold transition-colors ${
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
                  className={`px-4 py-2 border-r border-outline-variant font-bold transition-colors ${
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
                  className={`px-4 py-2 border-r border-outline-variant font-bold transition-colors ${
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
                    <thead className="bg-surface-container-high border-b border-outline-variant font-label-caps text-[10px] text-on-surface-variant font-bold">
                      <tr>
                        <th className="px-2 py-1 w-10 border-r border-outline-variant">S.No</th>
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
                    className="bg-primary hover:bg-primary-container text-on-primary px-4 py-1.5 rounded text-xs font-bold transition shadow-2xs"
                  >
                    Open Multi-Tender Settlement Studio (F8)
                  </button>
                </div>
              )}

              {/* Tab 3: Addons & Deductions */}
              {activeFooterTab === "addons" && (
                <div className="p-2 overflow-x-auto flex-1 max-h-36">
                  <table className="w-full text-left border border-outline-variant text-xs">
                    <thead className="bg-surface-container-high border-b border-outline-variant font-label-caps text-[10px] text-on-surface-variant font-bold">
                      <tr>
                        <th className="px-2 py-1 w-10 border-r border-outline-variant">S.No</th>
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
                <label className="font-label-caps text-[10px] text-on-surface-variant uppercase font-bold mb-1 block">
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
            <div className="w-full lg:w-80 bg-surface-container-lowest border border-outline-variant rounded flex flex-col p-3 shadow-xs">
              <table className="w-full text-left font-body-sm text-xs">
                <thead className="font-label-caps text-[11px] text-on-surface-variant border-b border-outline-variant uppercase font-bold">
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
          <div className="bg-primary-container text-on-primary border border-outline-variant rounded flex font-label-caps text-[10px] sm:text-xs overflow-hidden shadow-sm shrink-0">
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

            <div className="flex-[1.5] bg-secondary-container text-on-secondary-container flex flex-col justify-center items-end p-2 px-4">
              <span className="opacity-80 font-bold uppercase tracking-wider">Net Amount</span>
              <span className="font-code-md font-bold text-2xl text-primary">₹{summaryTotals.netAmount.toFixed(2)}</span>
            </div>
          </div>

        </section>

      </div>

      {/* Persistent Bottom Shortcut Footer */}
      <footer className="bg-surface-container-highest border-t border-outline-variant mt-auto w-full flex justify-between items-center px-margin-page py-1.5 shrink-0 z-30 font-label-caps text-[11px]">
        <span className="text-on-surface-variant font-medium">
          Ready... <strong className="text-primary">F2:</strong> Search | <strong className="text-primary">F11:</strong> Direct Entry | <strong className="text-primary">F6:</strong> Discounts | <strong className="text-primary">F7/F8:</strong> Settlement | <strong className="text-primary">F12:</strong> Suspend | <strong className="text-primary">Ctrl+4:</strong> AddOns
        </span>
        <span className="text-primary font-bold">© 2026 smritiSystems</span>
      </footer>

      {/* MODALS */}

      {/* 1. Settlement Modal */}
      <SmritiInvoiceSettlementModal
        isOpen={showSettlementModal}
        billNo={`${headerState.docPrefix}-${headerState.docNo}`}
        billDate={headerState.billDate}
        customer={headerState.customer}
        netAmount={summaryTotals.netAmount}
        onCompleteSettlement={handleCompleteSettlement}
        onSuspendBill={handleSuspendInvoice}
        onClose={() => setShowSettlementModal(false)}
      />

      {/* 2. PDT Import Modal */}
      <PdtImportModal
        isOpen={showPdtImportModal}
        products={products}
        onImportItems={handleImportPdtItems}
        onClose={() => setShowPdtImportModal(false)}
      />

      {/* 3. Product Search / Catalog F2 Browser */}
      <ProductSearchBrowserModal
        isOpen={showProductSearchModal}
        products={products}
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

export default SmritiBillingTerminal;
