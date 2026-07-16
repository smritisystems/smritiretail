/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 2.1.3
 * Created      : 2026-07-10
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { Printer, MessageCircle, Mail,
  ShoppingCart,
  Plus,
  Search,
  Grid,
  Trash2,
  Edit,
  RefreshCw,
  User,
  Calendar,
  DollarSign,
  Percent,
  ArrowRight,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  FileText,
  Truck,
  Shield,
  Layers,
  Sparkles,
  Info,
  Sliders,
  TrendingDown,
  Award
} from "lucide-react";
import { Product } from "../types.js";
import { SmartFilter, FilterDefinition } from "./SmartFilter.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { ProductImage } from "./common/ProductImage.tsx";

interface PurchaseStudioTabProps {
  products: Product[];
  onRefreshProducts: () => void;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
}

export const PurchaseStudioTab: React.FC<PurchaseStudioTabProps> = ({
  products,
  onRefreshProducts,
  onNotification,
  currentUser
}) => {
  const isReadOnly = currentUser?.role === "Report User";
  // Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<"create" | "suppliers" | "reorder" | "receive" | "reports">("create");
  
  // Role selector
  const userRole = (currentUser?.role as "Store Manager" | "Cashier") || "Store Manager";
  
  // Configured Company State Jurisdiction
  const [companyState, setCompanyState] = useState<string | null>("DL");
  const [updatingJurisdiction, setUpdatingJurisdiction] = useState(false);

  // General State
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [reorderSuggestions, setReorderSuggestions] = useState<any[]>([]);
  const [outstandingReport, setOutstandingReport] = useState<any[]>([]);
  const [pendingDeliveryReport, setPendingDeliveryReport] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Selected details
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [supplierDetails, setSupplierDetails] = useState<any>(null);
  const [selectedPO, setSelectedPO] = useState<any>(null);

  // Supplier Search & Creation Form state
  const [supplierSearchQuery, setSupplierSearchQuery] = useState<string>("");
  const [isEditingSupplier, setIsEditingSupplier] = useState<boolean>(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    vendorCode: "",
    taxRegistrationNumber: "",
    category: "Apparel",
    address: "",
    contactDetails: ""
  });

  // Audit logging effects
  useEffect(() => {
    if (!supplierSearchQuery.trim()) return;
    const timer = setTimeout(() => {
      recordAuditAction("SEARCH", "suppliers", "search", `Search performed for supplier: "${supplierSearchQuery}"`);
    }, 1200);
    return () => clearTimeout(timer);
  }, [supplierSearchQuery]);

  useEffect(() => {
    if (selectedPO) {
      recordAuditAction("TRANSACTION_VIEW", "purchase_orders", selectedPO.id, `Viewed purchase order details: ${selectedPO.orderNo}`);
    }
  }, [selectedPO]);

  useEffect(() => {
    if (supplierDetails) {
      recordAuditAction("TRANSACTION_VIEW", "suppliers", supplierDetails.id, `Viewed supplier details: ${supplierDetails.name}`);
    }
  }, [supplierDetails]);

  // Reorder suggestion selection
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, boolean>>({});
  const [reorderSupplierFilter, setReorderSupplierFilter] = useState<string>("");

  // Create Order Draft state
  const [draftItems, setDraftItems] = useState<any[]>([]);
  const [draftRemarks, setDraftRemarks] = useState<string>("");
  const [expectedDate, setExpectedDate] = useState<string>(
    new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split("T")[0]
  );
  const [entryMode, setEntryMode] = useState<"manual" | "matrix">("manual");

  // Create Order - Manual Item mode state
  const [manualProduct, setManualProduct] = useState<string>("");
  const [manualQty, setManualQty] = useState<number>(10);
  const [manualPrice, setManualPrice] = useState<number>(0);
  const [manualPriceSource, setManualPriceSource] = useState<string>("");

  // Create Order - Matrix Size Grid mode state
  const [matrixArticle, setMatrixArticle] = useState<string>("");
  const [matrixColor, setMatrixColor] = useState<string>("");
  const [matrixQuantities, setMatrixQuantities] = useState<Record<string, number>>({});
  const [matrixPrices, setMatrixPrices] = useState<Record<string, number>>({});
  const [matrixSources, setMatrixSources] = useState<Record<string, string>>({});

  // Receipt form input state
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, number>>({});

  // Payment popup modal state
  const [payModalPO, setPayModalPO] = useState<any>(null);
  const [payAmount, setPayAmount] = useState<string>("");

  // Amendment modal state
  const [amendPO, setAmendPO] = useState<any>(null);
  const [amendQuantities, setAmendQuantities] = useState<Record<string, number>>({});
  const [amendReason, setAmendReason] = useState<string>("");

  // Report filters
  const [reportSupplierFilter, setReportSupplierFilter] = useState<string>("");
  const [reportStatusFilter, setReportStatusFilter] = useState<string>("");
  const [reportStartDate, setReportStartDate] = useState<string>("");
  const [reportEndDate, setReportEndDate] = useState<string>("");

  // Initial fetches
  useEffect(() => {
    fetchJurisdiction();
    fetchSuppliers();
    fetchPurchaseOrders();
    fetchReorderSuggestions();
  }, []);

  // Fetch when subtab changes to load dynamically
  useEffect(() => {
    if (activeSubTab === "suppliers") {
      fetchSuppliers();
    } else if (activeSubTab === "reorder") {
      fetchReorderSuggestions();
    } else if (activeSubTab === "receive") {
      fetchPurchaseOrders("Approved");
    } else if (activeSubTab === "reports") {
      fetchOutstandingReport();
      fetchPendingDeliveryReport();
      fetchPurchaseOrders();
    }
  }, [activeSubTab]);

  const fetchJurisdiction = async () => {
    try {
      const data = await apiFetchV1("/purchase/config");
      setCompanyState(data.companyState);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleJurisdiction = async () => {
    const targetState = companyState ? null : "DL";
    setUpdatingJurisdiction(true);
    try {
      const data = await apiFetchV1("/purchase/config/jurisdiction", {
        method: "POST",
        body: JSON.stringify({ state: targetState })
      });
      setCompanyState(data.companyState);
      onNotification(
        "Config Synchronized",
        targetState 
          ? "Corporate Tax Jurisdiction configured to Delhi (DL)." 
          : "Tax Jurisdiction UNCONFIGURED. Creating orders will block.",
        targetState ? "success" : "error"
      );
    } catch (e: any) {
      onNotification("Network Error", e.message || "Failed to contact corporate registry.", "error");
    } finally {
      setUpdatingJurisdiction(false);
    }
  };

  const fetchSuppliers = async (query = "") => {
    setLoading(true);
    try {
      const data = await apiFetchV1(`/purchase/suppliers?q=${encodeURIComponent(query)}`);
      setSuppliersList(data);
    } catch (e: any) {
      onNotification("Error", e.message || "Failed to retrieve suppliers list.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierDetails = async (id: string) => {
    try {
      const data = await apiFetchV1(`/purchase/suppliers/${id}`);
      setSupplierDetails(data);
    } catch (e: any) {
      onNotification("Error", e.message || "Failed to retrieve supplier analytics.", "error");
    }
  };

  const fetchPurchaseOrders = async (status = "", overrides?: { supplier?: string, statusFilter?: string, start?: string, end?: string }) => {
    try {
      const supplier = overrides?.supplier !== undefined ? overrides.supplier : reportSupplierFilter;
      const statusF = overrides?.statusFilter !== undefined ? overrides.statusFilter : reportStatusFilter;
      const sDate = overrides?.start !== undefined ? overrides.start : reportStartDate;
      const eDate = overrides?.end !== undefined ? overrides.end : reportEndDate;

      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (supplier) params.append("supplierId", supplier);
      if (statusF && !status) params.append("status", statusF);
      if (sDate) params.append("startDate", sDate);
      if (eDate) params.append("endDate", eDate);
      const query = params.toString();

      const data = await apiFetchV1(`/purchase/orders${query ? `?${query}` : ""}`);
      setPurchaseOrders(data);
    } catch (e: any) {
      onNotification("Error", e.message || "Failed to load purchase orders registry.", "error");
    }
  };

  const fetchReorderSuggestions = async () => {
    try {
      const url = reorderSupplierFilter 
        ? `/purchase/reorder-suggestions?supplierId=${reorderSupplierFilter}`
        : "/purchase/reorder-suggestions";
      
      const data = await apiFetchV1(url);
      setReorderSuggestions(data);
    } catch (e: any) {
      onNotification("Error", e.message || "Failed to load stock trigger suggestions.", "error");
    }
  };

  const fetchOutstandingReport = async () => {
    try {
      const data = await apiFetchV1("/purchase/reports/outstanding");
      setOutstandingReport(data);
    } catch (e: any) {
      onNotification("Error", e.message || "Failed to generate outstanding balances summary.", "error");
    }
  };

  const fetchPendingDeliveryReport = async () => {
    try {
      const data = await apiFetchV1("/purchase/reports/pending-delivery");
      setPendingDeliveryReport(data);
    } catch (e: any) {
      onNotification("Error", e.message || "Failed to generate pending items delivery ledger.", "error");
    }
  };

  // Fetch Default purchase rate for a single variant
  const handleProductSelection = async (productId: string) => {
    setManualProduct(productId);
    if (!productId) return;
    try {
      const data = await apiFetchV1(`/purchase/default-rate?productId=${productId}&supplierId=${selectedSupplierId}`);
      setManualPrice(data.rate);
      setManualPriceSource(data.source);
    } catch (e) {
      const prod = products.find(p => p.id === productId);
      if (prod) setManualPrice(Math.round(prod.price * 0.6));
      setManualPriceSource("Local Fallback");
    }
  };

  // Matrix Article selection fetches default rates for all sizes in one shot
  const handleMatrixArticleSelection = async (articleName: string) => {
    setMatrixArticle(articleName);
    setMatrixColor("");
    setMatrixQuantities({});
    setMatrixPrices({});
    setMatrixSources({});
  };

  const handleMatrixColorSelection = async (color: string) => {
    setMatrixColor(color);
    setMatrixQuantities({});

    // Fetch default rates for all filtered variants
    const variants = products.filter(p => p.name === matrixArticle && (p.color || "N/A") === color);
    const newPrices: Record<string, number> = {};
    const newSources: Record<string, string> = {};

    for (const v of variants) {
      try {
        const data = await apiFetchV1(`/purchase/default-rate?productId=${v.id}&supplierId=${selectedSupplierId}`);
        newPrices[v.id] = data.rate;
        newSources[v.id] = data.source;
      } catch (e) {
        newPrices[v.id] = Math.round(v.price * 0.6);
        newSources[v.id] = "Cost Fallback";
      }
    }

    setMatrixPrices(newPrices);
    setMatrixSources(newSources);
  };

  // â”€â”€ OPERATIONS â”€â”€

  // Save/Update Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      return;
    }
    if (!supplierForm.name || !supplierForm.vendorCode) {
      onNotification("Missing Fields", "Supplier Name and Vendor Code are mandatory.", "error");
      return;
    }

    try {
      const data = await apiFetchV1("/purchase/suppliers", {
        method: "POST",
        body: JSON.stringify(supplierForm)
      });
      onNotification(
        "Supplier Saved",
        data.updated 
          ? `Supplier "${supplierForm.name}" was successfully updated in-place.` 
          : `Supplier "${supplierForm.name}" created with vendor code ${supplierForm.vendorCode}.`,
        "success"
      );
      setIsEditingSupplier(false);
      setSupplierForm({ name: "", vendorCode: "", taxRegistrationNumber: "", category: "Apparel", address: "", contactDetails: "" });
      fetchSuppliers(supplierSearchQuery);
    } catch (error: any) {
      onNotification("System Error", error.message || "Connection lost during supplier transmission.", "error");
    }
  };

  // Add manual line item to draft
  const handleAddManualItem = () => {
    const prod = products.find(p => p.id === manualProduct);
    if (!prod) {
      onNotification("Product Required", "Please select a product variant to add.", "error");
      return;
    }
    if (manualQty <= 0) {
      onNotification("Invalid Quantity", "Sourcing quantity must be positive.", "error");
      return;
    }

    const categoryTaxRate = prod.category === "Apparel" ? 12 : 18; // Derived tax rate
    const netAmt = manualQty * manualPrice;
    const taxAmt = Math.round((netAmt * (categoryTaxRate / 100)) * 100) / 100;
    const totalAmt = netAmt + taxAmt;

    const existingIndex = draftItems.findIndex(i => i.productId === prod.id);
    if (existingIndex !== -1) {
      const updated = [...draftItems];
      updated[existingIndex].quantity += manualQty;
      updated[existingIndex].taxAmount = Math.round((updated[existingIndex].quantity * updated[existingIndex].price * (categoryTaxRate / 100)) * 100) / 100;
      updated[existingIndex].totalAmount = (updated[existingIndex].quantity * updated[existingIndex].price) + updated[existingIndex].taxAmount;
      setDraftItems(updated);
    } else {
      setDraftItems([
        ...draftItems,
        {
          productId: prod.id,
          code: prod.code,
          name: prod.name,
          color: prod.color,
          size: prod.size,
          quantity: manualQty,
          price: manualPrice,
          taxRate: categoryTaxRate,
          taxAmount: taxAmt,
          totalAmount: totalAmt,
          rateSource: manualPriceSource
        }
      ]);
    }

    setManualProduct("");
    onNotification("Variant Linked", `${prod.name} (${prod.size}) added to purchase draft.`, "success");
  };

  // Add matrix sizes to draft
  const handleAddMatrixItems = () => {
    const variants = products.filter(p => p.name === matrixArticle && (p.color || "N/A") === matrixColor);
    const addedList: any[] = [];

    variants.forEach(v => {
      const qty = matrixQuantities[v.id] || 0;
      if (qty > 0) {
        const rate = matrixPrices[v.id] || Math.round(v.price * 0.6);
        const taxRate = v.category === "Apparel" ? 12 : 18;
        const net = qty * rate;
        const tax = Math.round((net * (taxRate / 100)) * 100) / 100;
        
        addedList.push({
          productId: v.id,
          code: v.code,
          name: v.name,
          color: v.color,
          size: v.size,
          quantity: qty,
          price: rate,
          taxRate,
          taxAmount: tax,
          totalAmount: net + tax,
          rateSource: matrixSources[v.id] || "Size Matrix Default"
        });
      }
    });

    if (addedList.length === 0) {
      onNotification("Quantities Empty", "Please specify quantities for at least one size variant.", "error");
      return;
    }

    // Merge into draftItems
    const updated = [...draftItems];
    addedList.forEach(item => {
      const idx = updated.findIndex(u => u.productId === item.productId);
      if (idx !== -1) {
        updated[idx].quantity += item.quantity;
        updated[idx].taxAmount = Math.round((updated[idx].quantity * updated[idx].price * (item.taxRate / 100)) * 100) / 100;
        updated[idx].totalAmount = (updated[idx].quantity * updated[idx].price) + updated[idx].taxAmount;
      } else {
        updated.push(item);
      }
    });

    setDraftItems(updated);
    setMatrixQuantities({});
    onNotification("Matrix Added", `Successfully merged horizontal sizing matrix into purchase draft.`, "success");
  };

  // Save/Submit Purchase Order Draft
  const handleSavePurchaseOrder = async () => {
    if (isReadOnly) {
      onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      return;
    }
    if (!selectedSupplierId) {
      onNotification("Supplier Required", "Select a target supplier first.", "error");
      return;
    }
    if (draftItems.length === 0) {
      onNotification("Items Empty", "A purchase order must include at least one item line.", "error");
      return;
    }

    try {
      const data = await apiFetchV1("/purchase/orders", {
        method: "POST",
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          expectedDeliveryDate: expectedDate,
          remarks: draftRemarks,
          items: draftItems
        })
      });
      onNotification(
        "Draft Generated",
        `Draft Purchase Order ${data.order.orderNo} initialized successfully!`,
        "success"
      );
      // Clear draft state
      setDraftItems([]);
      setDraftRemarks("");
      fetchPurchaseOrders();
      // Redirect to reports / register
      setActiveSubTab("reports");
    } catch (e: any) {
      onNotification("Connection Failed", e.message || "Unable to transmit purchase order draft.", "error");
    }
  };

  // Submit Draft to Confirmed PO
  
  const handleWorkflowAction = async (id: string, action: string) => {
    try {
      await apiFetchV1(`/workflow/PurchaseOrder/${id}/${action}`, {
        method: "POST"
      });
      onNotification("Success", `Order successfully ${action}ed.`, "success");
      fetchPurchaseOrders();
    } catch (e: any) {
      console.error(e);
      onNotification("Error", e.message || "Network or server error", "error");
    }
  };

  const handleSubmitPO = async (id: string) => {
    try {
      const data = await apiFetchV1(`/purchase/orders/${id}/submit`, {
        method: "POST"
      });
      onNotification(
        "PO Submitted",
        `Purchase Order ${data.order.orderNo} is now CONFIRMED and legally committed to supplier.`,
        "success"
      );
      fetchPurchaseOrders();
      if (selectedPO?.id === id) {
        setSelectedPO(data.order);
      }
    } catch (e: any) {
      onNotification("System Error", e.message || "Failed to submit purchase order.", "error");
    }
  };

  // Convert Low-Stock Suggestions to PO
  const handleConvertSuggestions = async () => {
    if (isReadOnly) {
      onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      return;
    }
    const selectedIds = Object.keys(selectedSuggestions).filter(id => selectedSuggestions[id]);
    if (selectedIds.length === 0) {
      onNotification("Selection Empty", "Select at least one low-stock variant suggestion to order.", "error");
      return;
    }
    if (!reorderSupplierFilter) {
      onNotification("Supplier Required", "Select a supplier to convert low-stock alerts to a PO draft.", "error");
      return;
    }

    try {
      const data = await apiFetchV1("/purchase/reorder-suggestions/convert", {
        method: "POST",
        body: JSON.stringify({
          supplierId: reorderSupplierFilter,
          selectedProductIds: selectedIds
        })
      });
      onNotification(
        "Suggestions Converted",
        `Draft Purchase Order ${data.order.orderNo} created with suggested replenishment quantities!`,
        "success"
      );
      setSelectedSuggestions({});
      fetchPurchaseOrders();
      setSelectedSupplierId(reorderSupplierFilter);
      setDraftItems(data.order.items);
      setDraftRemarks("Replenishment order converted from automated low-stock suggestions.");
      setActiveSubTab("create");
    } catch (e: any) {
      onNotification("Error", e.message || "Failed to convert items due to connection error.", "error");
    }
  };

  // Goods receipt submission
  const handleConfirmReceipt = async () => {
    if (isReadOnly) {
      onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      return;
    }
    if (!selectedPO) return;

    const receivedItems = Object.keys(receiptQuantities)
      .map(pid => ({
        productId: pid,
        quantityReceived: receiptQuantities[pid] || 0
      }))
      .filter(item => item.quantityReceived > 0);

    if (receivedItems.length === 0) {
      onNotification("Quantities Empty", "Specify physical arrival quantities for at least one item.", "error");
      return;
    }

    try {
      const data = await apiFetchV1(`/purchase/orders/${selectedPO.id}/receive`, {
        method: "POST",
        body: JSON.stringify({ receivedItems })
      });
      onNotification(
        "Receipt Logged",
        `GRN Goods Receipt recorded! Product inventories updated automatically.`,
        "success"
      );
      setReceiptQuantities({});
      setSelectedPO(data.order);
      onRefreshProducts();
      fetchPurchaseOrders("Approved");
    } catch (e: any) {
      onNotification("Connection Lost", e.message || "Failed to record physical goods receipt.", "error");
    }
  };

  // Outstanding payment registration
  const handleRecordPayment = async () => {
    if (isReadOnly) {
      onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      return;
    }
    if (!payModalPO) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) {
      onNotification("Invalid Amount", "Payment value must be positive.", "error");
      return;
    }

    try {
      await apiFetchV1(`/purchase/orders/${payModalPO.id}/pay`, {
        method: "POST",
        body: JSON.stringify({ amount })
      });
      onNotification("Payment Settled", `Registered payment of â‚¹${amount} against ${payModalPO.orderNo}.`, "success");
      setPayModalPO(null);
      setPayAmount("");
      fetchOutstandingReport();
      fetchPurchaseOrders();
    } catch (e: any) {
      onNotification("Error", e.message || "Connection error processing supplier invoice ledger.", "error");
    }
  };

  // Amend Confirmed Order
  const handleAmendPO = async () => {
    if (isReadOnly) {
      onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      return;
    }
    if (!amendPO) return;
    if (!amendReason.trim()) {
      onNotification("Reason Mandated", "Specify an official amendment reason for corporate log integrity.", "error");
      return;
    }

    const items = Object.keys(amendQuantities).map(pid => ({
      productId: pid,
      quantity: amendQuantities[pid]
    }));

    try {
      const data = await apiFetchV1(`/purchase/orders/${amendPO.id}/amend`, {
        method: "POST",
        body: JSON.stringify({
          items,
          reason: amendReason
        })
      });
      onNotification(
        "Amendment Authorized",
        `Superseded ${amendPO.orderNo}. New Draft ${data.amendment.orderNo} is active for review.`,
        "success"
      );
      setSelectedSupplierId(data.amendment.supplierId);
      setDraftItems(data.amendment.items);
      setDraftRemarks(data.amendment.remarks);
      setAmendPO(null);
      setAmendQuantities({});
      setAmendReason("");
      fetchPurchaseOrders();
      setActiveSubTab("create");
    } catch (e: any) {
      onNotification("Error", e.message || "Network connection failed during amendment negotiations.", "error");
    }
  };

  // Calculated totals for current draft PO
  const draftSubtotal = draftItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
  const draftTaxTotal = draftItems.reduce((acc, item) => acc + item.taxAmount, 0);
  const draftGrandTotal = draftSubtotal + draftTaxTotal;

  // Group products for horizontal size matrix mode
  const baseArticles = Array.from(new Set(products.map(p => p.name)));
  const availableColors = matrixArticle
    ? Array.from(new Set(products.filter(p => p.name === matrixArticle).map(p => p.color || "N/A")))
    : [];
  const matrixVariants = products.filter(
    p => p.name === matrixArticle && (p.color || "N/A") === matrixColor
  );

  return (
    <div id="smriti-purchase-studio-root" className="space-y-6">
      {isReadOnly && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center space-x-2 text-amber-400 text-xs shadow-lg">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Purchase updates and supplier edits are locked.</span>
        </div>
      )}
      
      {/* Dynamic Sourcing Control Header */}
      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold font-display text-theme-body tracking-wide">SMRITI Purchase Studio</h2>
              <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-500/30 rounded px-2 py-0.5 font-mono font-bold">REPLENISHMENT DESK</span>
            </div>
            <p className="text-xs text-theme-muted mt-0.5">Procure inventory, analyze trigger reorders, receive goods and manage suppliers dynamically.</p>
          </div>
        </div>

        {/* Security / Simulation Hub Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Active SMRITI Role Badge */}
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-1.5 px-3 flex items-center space-x-2.5">
            <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider font-bold">DESK ROLE:</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
              userRole === "Store Manager"
                ? "bg-indigo-950 text-indigo-300 border border-indigo-500/30"
                : "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
            }`}>
              {userRole === "Store Manager" ? "Store Manager (Admin)" : "Cashier (Read-Only View)"}
            </span>
          </div>

          {/* Simulate Tax Jurisdiction Setting */}
          <button
            onClick={toggleJurisdiction}
            disabled={updatingJurisdiction}
            className={`px-3 py-2 rounded-xl border text-[11px] font-mono font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
              companyState 
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/60" 
                : "bg-rose-950/40 border-rose-500/30 text-rose-300 hover:bg-rose-950/60"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Tax Config: {companyState ? "DL (Delhi)" : "UNCONFIGURED"}</span>
          </button>
        </div>
      </div>

      {/* Five Studio Sub-Tabs Grid Selector */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <button
          onClick={() => setActiveSubTab("create")}
          className={`px-4 py-3 rounded-xl border text-xs font-semibold font-display tracking-wider flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer ${
            activeSubTab === "create"
              ? "bg-[#2563EB] text-theme-body border-transparent shadow-md"
              : "bg-theme-surface-1 text-theme-muted border-theme-divider hover:bg-theme-surface-3 hover:text-theme-primary"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Create Order</span>
        </button>

        <button
          onClick={() => setActiveSubTab("suppliers")}
          className={`px-4 py-3 rounded-xl border text-xs font-semibold font-display tracking-wider flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer ${
            activeSubTab === "suppliers"
              ? "bg-[#2563EB] text-theme-body border-transparent shadow-md"
              : "bg-theme-surface-1 text-theme-muted border-theme-divider hover:bg-theme-surface-3 hover:text-theme-primary"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Suppliers</span>
        </button>

        <button
          onClick={() => setActiveSubTab("reorder")}
          className={`px-4 py-3 rounded-xl border text-xs font-semibold font-display tracking-wider flex flex-col items-center justify-center space-y-1.5 transition-all relative cursor-pointer ${
            activeSubTab === "reorder"
              ? "bg-[#2563EB] text-theme-body border-transparent shadow-md"
              : "bg-theme-surface-1 text-theme-muted border-theme-divider hover:bg-theme-surface-3 hover:text-theme-primary"
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Reorder Suggestions</span>
          {reorderSuggestions.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-mono font-bold text-[9px] w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-pulse">
              {reorderSuggestions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("receive")}
          className={`px-4 py-3 rounded-xl border text-xs font-semibold font-display tracking-wider flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer ${
            activeSubTab === "receive"
              ? "bg-[#2563EB] text-theme-body border-transparent shadow-md"
              : "bg-theme-surface-1 text-theme-muted border-theme-divider hover:bg-theme-surface-3 hover:text-theme-primary"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Receive Goods</span>
        </button>

        <button
          onClick={() => setActiveSubTab("reports")}
          className={`px-4 py-3 rounded-xl border text-xs font-semibold font-display tracking-wider flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer ${
            activeSubTab === "reports"
              ? "bg-[#2563EB] text-theme-body border-transparent shadow-md"
              : "bg-theme-surface-1 text-theme-muted border-theme-divider hover:bg-theme-surface-3 hover:text-theme-primary"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Reports & Registers</span>
        </button>
      </div>

      {/* Tax Jurisdiction Warning Indicator */}
      {!companyState && (
        <div className="bg-rose-950/80 border border-rose-500/40 rounded-2xl p-4 flex items-start space-x-3 text-rose-200">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider font-display text-rose-300">CORPORATE WARNING: Tax Jurisdiction Missing</h4>
            <p className="text-[11px] mt-1 leading-relaxed opacity-90">
              The company's state is not configured in the system. SMRITI Purchase Studio has locked down order creations to prevent illegal blank-jurisdiction transactions. Configure the Corporate state (using the toggle above) to resume operations.
            </p>
          </div>
        </div>
      )}

      {/* Dynamic Sourcing Workspace Content */}
      <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl p-6 shadow-xl min-h-[450px]">

        {/* â”€â”€ SUB-TAB 1: CREATE PURCHASE ORDER â”€â”€ */}
        {activeSubTab === "create" && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-6">
              
              {/* Sourcing Header: Pick Supplier & Sourcing Analytics */}
              <div className="w-full lg:w-1/3 bg-theme-surface-1 p-5 rounded-xl border border-theme-divider space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400">1. SOURCING VENDOR IDENTIFICATION</h3>
                <div>
                  <label className="text-[10px] font-mono text-theme-muted block mb-1.5">CHOOSE REGISTERED SUPPLIER</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => {
                      setSelectedSupplierId(e.target.value);
                      if (e.target.value) {
                        fetchSupplierDetails(e.target.value);
                        setDraftItems([]); // clean slate for different supplier
                      } else {
                        setSupplierDetails(null);
                      }
                    }}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="">-- Choose registered vendor --</option>
                    {suppliersList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.vendorCode})</option>
                    ))}
                  </select>
                </div>

                {supplierDetails && (
                  <div className="bg-theme-surface-2 p-4 rounded-lg border border-theme-divider/40 space-y-3.5">
                    <h4 className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider">HISTORICAL SOURCING PROFILE</h4>
                    
                    <div className="grid grid-cols-2 gap-3 text-left">
                      <div className="bg-theme-surface-1 p-2.5 rounded border border-theme-divider/30">
                        <span className="text-[9px] font-mono text-theme-muted block">ORDERS PLACED</span>
                        <span className="text-sm font-bold text-theme-body font-mono mt-0.5">{supplierDetails.summary.totalOrders}</span>
                      </div>
                      <div className="bg-theme-surface-1 p-2.5 rounded border border-theme-divider/30">
                        <span className="text-[9px] font-mono text-theme-muted block">CONFIRMED VALUE</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5">â‚¹{supplierDetails.summary.totalValue}</span>
                      </div>
                    </div>

                    <div className="border-t border-theme-divider/40 pt-2 text-[10px] text-theme-muted space-y-1.5 leading-relaxed font-sans">
                      <div><strong className="text-[#cbd5e1]">GSTIN:</strong> {supplierDetails.taxRegistrationNumber || "N/A"}</div>
                      <div><strong className="text-[#cbd5e1]">Contact Person:</strong> {supplierDetails.contactDetails || "N/A"}</div>
                      <div><strong className="text-[#cbd5e1]">Sourcing Address:</strong> {supplierDetails.address || "N/A"}</div>
                      <div><strong className="text-[#cbd5e1]">Last Order Date:</strong> {supplierDetails.summary.lastOrderDate === "-" ? "-" : new Date(supplierDetails.summary.lastOrderDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sourcing Core: Build Items Grid/Matrix */}
              <div className="w-full lg:w-2/3 bg-theme-surface-1 p-5 rounded-xl border border-theme-divider space-y-6">
                
                <div className="flex items-center justify-between border-b border-theme-divider/60 pb-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400">2. SECURE COMPLIANT PRODUCT ENTRY</h3>
                  
                  {/* Sourcing input entry modes toggler */}
                  <div className="bg-theme-surface-2 rounded-lg p-0.5 flex space-x-1 border border-theme-divider/60">
                    <button
                      onClick={() => setEntryMode("manual")}
                      className={`px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-md transition-all cursor-pointer ${
                        entryMode === "manual" 
                          ? "bg-indigo-600 text-white" 
                          : "text-theme-muted hover:text-white"
                      }`}
                    >
                      Barcode/Manual Variant
                    </button>
                    <button
                      onClick={() => setEntryMode("matrix")}
                      className={`px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-md transition-all cursor-pointer ${
                        entryMode === "matrix" 
                          ? "bg-indigo-600 text-white" 
                          : "text-theme-muted hover:text-white"
                      }`}
                    >
                      Horizontal Size Matrix
                    </button>
                  </div>
                </div>

                {!selectedSupplierId ? (
                  <div className="p-8 text-center bg-theme-surface-2 border border-dashed border-theme-divider rounded-xl text-theme-muted text-xs">
                    Please identify a registered supplier from the left panel to begin compiling product purchase rows.
                  </div>
                ) : (
                  <div>
                    {/* BARCODE / MANUAL ENTRY MODE */}
                    {entryMode === "manual" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[9px] font-mono text-theme-muted block mb-1">SELECT VARIANT</label>
                            <select
                              value={manualProduct}
                              onChange={(e) => handleProductSelection(e.target.value)}
                              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                            >
                              <option value="">-- Choose item variant --</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} [{p.code}] - Color: {p.color || "N/A"}, Size: {p.size || "N/A"}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-mono text-theme-muted block mb-1">QUANTITY</label>
                            <input
                              type="number"
                              min="1"
                              value={manualQty}
                              onChange={(e) => setManualQty(Math.max(1, parseInt(e.target.value) || 0))}
                              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-mono text-theme-muted block mb-1">UNIT PURCHASE RATE (â‚¹)</label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                value={manualPrice}
                                onChange={(e) => {
                                  setManualPrice(Math.max(0, parseFloat(e.target.value) || 0));
                                  setManualPriceSource("Manual Override");
                                }}
                                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            {manualPriceSource && (
                              <span className="text-[9px] text-indigo-300 font-mono mt-1 block tracking-tight uppercase">
                                Rate Source: {manualPriceSource}
                              </span>
                            )}
                          </div>
                        </div>

                        {manualProduct && (
                          <div className="bg-theme-surface-2 p-3 rounded-lg border border-theme-divider/60 flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-indigo-300 text-[11px] font-mono">
                              <Info className="w-4 h-4 text-indigo-400" />
                              <span>Derived Tax Rate: <strong>{products.find(p => p.id === manualProduct)?.category === "Apparel" ? "12%" : "18%"} GST</strong></span>
                              <span className="text-theme-muted">| Tax derives dynamically from product classification (Apparel/Footwear).</span>
                            </div>
                            <button
                              onClick={handleAddManualItem}
                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Add row
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* HORIZONTAL SIZE MATRIX ENTRY MODE */}
                    {entryMode === "matrix" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-mono text-theme-muted block mb-1">BASE ARTICLE</label>
                            <select
                              value={matrixArticle}
                              onChange={(e) => handleMatrixArticleSelection(e.target.value)}
                              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                            >
                              <option value="">-- Choose Base Article --</option>
                              {baseArticles.map(art => (
                                <option key={art} value={art}>{art}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-mono text-theme-muted block mb-1">COLOR</label>
                            <select
                              value={matrixColor}
                              onChange={(e) => handleMatrixColorSelection(e.target.value)}
                              disabled={!matrixArticle}
                              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                              <option value="">-- Choose Color --</option>
                              {availableColors.map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {matrixArticle && matrixColor && (
                          <div className="space-y-4 pt-2 border-t border-theme-divider/50">
                            <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider">
                              <h4 className="text-[9px] font-mono text-indigo-300 uppercase tracking-wider mb-3">VARIANT SIZE ALLOCATIONS MATRIX</h4>
                              
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                {matrixVariants.map(variant => (
                                  <div key={variant.id} className="bg-theme-surface-1 p-2.5 rounded border border-theme-divider/60 flex flex-col items-center text-center">
                                    <span className="text-[10px] font-mono text-theme-muted">Size {variant.size || "OS"}</span>
                                    
                                    {/* Calculated auto-price field */}
                                    <input
                                      type="number"
                                      value={matrixPrices[variant.id] || ""}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                                        setMatrixPrices({ ...matrixPrices, [variant.id]: val });
                                        setMatrixSources({ ...matrixSources, [variant.id]: "Manual Override" });
                                      }}
                                      className="w-full text-center bg-theme-surface-2 border border-theme-divider/60 rounded py-0.5 mt-1 text-[10px] text-indigo-200 focus:outline-none"
                                      placeholder="â‚¹ Price"
                                      title={`Tax derived: ${variant.category === "Apparel" ? "12%" : "18%"} GST`}
                                    />
                                    <span className="text-[8px] text-theme-muted mt-0.5 block font-mono truncate max-w-full">
                                      {matrixSources[variant.id] || "Calculating..."}
                                    </span>

                                    {/* Quantity field */}
                                    <input
                                      type="number"
                                      min="0"
                                      value={matrixQuantities[variant.id] || ""}
                                      placeholder="0"
                                      onChange={(e) => {
                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                        setMatrixQuantities({
                                          ...matrixQuantities,
                                          [variant.id]: val
                                        });
                                      }}
                                      className="w-full text-center bg-theme-surface-2 border border-emerald-500/40 rounded mt-2 py-1 text-xs text-theme-body focus:outline-none font-bold"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={handleAddMatrixItems}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Merge Matrix Allocations to Purchase Order
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Current Sourcing Order Draft Ledger */}
            {selectedSupplierId && (
              <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-theme-divider/60 pb-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400">3. DRAFT PURCHASE ORDER CONTRACT LINES</h4>
                  <span className="text-[10px] text-theme-muted font-mono">Lines Count: {draftItems.length}</span>
                </div>

                {draftItems.length === 0 ? (
                  <div className="p-12 text-center text-theme-muted text-xs">
                    Draft items lines list is empty. Use the manual entry or horizontal size matrix above to populate order rows.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-xl border border-theme-divider">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                            <th className="px-4 py-3">Variant / Code</th>
                            <th className="px-4 py-3">Color/Size</th>
                            <th className="px-4 py-3 text-right">Quantity</th>
                            <th className="px-4 py-3 text-right">Purchase Price</th>
                            <th className="px-4 py-3 text-right">GST %</th>
                            <th className="px-4 py-3 text-right">GST Amount</th>
                            <th className="px-4 py-3 text-right">Gross Total</th>
                            <th className="px-4 py-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a3a5c]/40">
                          {draftItems.map((item, index) => {
                            const relatedProd = products.find(p => p.id === item.productId || p.code === item.code);
                            const policyStr = localStorage.getItem("smriti_spif_display_policy");
                            const showImage = policyStr ? JSON.parse(policyStr).showInPurchase : true;
                            const hoverZoom = policyStr ? JSON.parse(policyStr).hoverZoom : true;
                            const imageSize = (policyStr ? JSON.parse(policyStr).purchaseSize : "small") as "small" | "medium";

                            return (
                              <tr key={`${item.productId}-${index}`} className="hover:bg-theme-surface-3/20">
                                <td className="px-4 py-3 font-semibold text-theme-body">
                                  <div className="flex items-center space-x-3">
                                    {showImage && relatedProd?.primaryImageUrl && (
                                      <ProductImage
                                        src={relatedProd.primaryImageUrl}
                                        alt={item.name}
                                        size={imageSize}
                                        hoverZoom={hoverZoom}
                                      />
                                    )}
                                    <div>
                                      {item.name}
                                      <span className="block text-[10px] text-theme-muted font-mono mt-0.5">{item.code}</span>
                                    </div>
                                  </div>
                                </td>
                              <td className="px-4 py-3">
                                <span className="text-slate-300">{item.color || "N/A"}</span> â€¢ <span className="font-semibold text-theme-muted">{item.size || "OS"}</span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-theme-body">{item.quantity}</td>
                              <td className="px-4 py-3 text-right font-mono text-[#cbd5e1]">â‚¹{item.price}</td>
                              <td className="px-4 py-3 text-right">
                                <span className="bg-indigo-950/60 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold">
                                  {item.taxRate}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-theme-muted">â‚¹{item.taxAmount}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">â‚¹{item.totalAmount}</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => {
                                    const updated = draftItems.filter((_, idx) => idx !== index);
                                    setDraftItems(updated);
                                    onNotification("Row Removed", "Deleted line item from order draft.", "success");
                                  }}
                                  className="p-1 text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>

                    {/* Sourcing Contract Properties & Execution */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-theme-surface-2 p-5 rounded-xl border border-theme-divider items-start">
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-mono text-theme-muted block mb-1">EXPECTED DELIVERY DATE</label>
                          <input
                            type="date"
                            value={expectedDate}
                            onChange={(e) => setExpectedDate(e.target.value)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-mono text-theme-muted block mb-1">REMARKS & PROCUREMENT NOTE</label>
                          <textarea
                            value={draftRemarks}
                            onChange={(e) => setDraftRemarks(e.target.value)}
                            placeholder="Type any contract terms or reference notations..."
                            rows={2}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 resize-none"
                          />
                        </div>
                      </div>

                      <div className="bg-theme-surface-1 p-4 rounded-lg border border-theme-divider/60 space-y-2.5 font-mono text-xs">
                        <h5 className="text-[10px] text-theme-muted uppercase font-bold tracking-wider mb-2">SUMMARY LEDGER METRICS</h5>
                        <div className="flex justify-between">
                          <span>Net Sourcing Total:</span>
                          <span className="text-theme-body">â‚¹{Math.round(draftSubtotal * 100) / 100}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Corporate GST Total:</span>
                          <span className="text-theme-muted">â‚¹{Math.round(draftTaxTotal * 100) / 100}</span>
                        </div>
                        <div className="border-t border-theme-divider/60 my-2 pt-2 flex justify-between text-sm font-bold">
                          <span className="text-theme-body">Contract Grand Total:</span>
                          <span className="text-emerald-400">â‚¹{Math.round(draftGrandTotal * 100) / 100}</span>
                        </div>
                      </div>

                      <div className="h-full flex flex-col justify-end">
                        <button
                          onClick={handleSavePurchaseOrder}
                          disabled={!companyState}
                          className={`w-full py-3.5 rounded-xl font-bold font-display text-sm flex items-center justify-center space-x-2 shadow-lg transition-colors cursor-pointer ${
                            companyState 
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white" 
                              : "bg-[#2a3a5c] text-theme-muted cursor-not-allowed"
                          }`}
                        >
                          <FileCheck className="w-5 h-5" />
                          <span>Generate & Save Draft Contract</span>
                        </button>
                        <p className="text-[9px] text-theme-muted text-center mt-2 leading-relaxed">
                          Saves as a Draft contract. Submitting the contract becomes a legally committed binding obligation with the supplier.
                        </p>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}


        {/* â”€â”€ SUB-TAB 2: SUPPLIERS LEDGER â”€â”€ */}
        {activeSubTab === "suppliers" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Suppliers Left: list & search */}
            <div className="lg:col-span-1 bg-theme-surface-1 border border-theme-divider rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-theme-divider/60 pb-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400">REGISTERED SUPPLIERS LIST</h3>
                <button
                  onClick={() => {
                    setSupplierForm({ name: "", vendorCode: "", taxRegistrationNumber: "", category: "Apparel", address: "", contactDetails: "" });
                    setIsEditingSupplier(true);
                    setSupplierDetails(null);
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold font-mono transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>ADD VENDOR</span>
                </button>
              </div>

              {/* Supplier Search box */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-theme-muted" />
                <input
                  type="text"
                  placeholder="Search by vendor name or code..."
                  value={supplierSearchQuery}
                  onChange={(e) => {
                    setSupplierSearchQuery(e.target.value);
                    fetchSuppliers(e.target.value);
                  }}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl pl-9 pr-4 py-2 text-xs text-theme-body placeholder-[#8892a4] focus:outline-none focus:border-blue-500"
                />
              </div>

              {loading ? (
                <div className="p-8 text-center text-theme-muted text-xs">Retrieving supplier records...</div>
              ) : suppliersList.length === 0 ? (
                <div className="p-8 text-center text-theme-muted text-xs">No matching suppliers found.</div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {suppliersList.map(sup => (
                    <div
                      key={sup.id}
                      onClick={() => {
                        setIsEditingSupplier(false);
                        fetchSupplierDetails(sup.id);
                      }}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        supplierDetails?.id === sup.id
                          ? "bg-indigo-950/40 border-indigo-500/50"
                          : "bg-theme-surface-2 border-theme-divider/60 hover:border-theme-divider hover:bg-theme-surface-1"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-bold text-theme-body">{sup.name}</h4>
                        <span className="text-[9px] bg-theme-surface-3 border border-theme-divider text-indigo-300 rounded px-1.5 py-0.2 font-mono font-bold">
                          {sup.vendorCode}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-theme-muted mt-2 font-mono">
                        <span>Cat: {sup.category}</span>
                        <span>GSTIN: {sup.taxRegistrationNumber || "N/A"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suppliers Right: View Detail or Form */}
            <div className="lg:col-span-2 bg-theme-surface-1 border border-theme-divider rounded-xl p-5">
              
              {!isEditingSupplier && !supplierDetails && (
                <div className="p-12 text-center text-theme-muted text-xs h-full flex flex-col items-center justify-center">
                  <User className="w-12 h-12 text-[#2a3a5c] mb-3" />
                  Select a supplier variant from the registry to inspect profile metrics, historical summaries and outstanding bounds, or click "Add Vendor" to onboard a new sourcing partner.
                </div>
              )}

              {/* SUPPLIER DETAILS VIEW */}
              {supplierDetails && !isEditingSupplier && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-theme-divider/60 pb-4 gap-2">
                    <div>
                      <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-500/20 rounded px-2 py-0.5 font-mono font-bold uppercase tracking-wider">
                        {supplierDetails.category} supplier
                      </span>
                      <h3 className="text-base font-bold text-theme-body mt-1.5">{supplierDetails.name}</h3>
                      <p className="text-xs text-theme-muted font-mono mt-0.5">Corporate Code: {supplierDetails.vendorCode}</p>
                    </div>

                    <button
                      onClick={() => {
                        setSupplierForm({
                          name: supplierDetails.name,
                          vendorCode: supplierDetails.vendorCode,
                          taxRegistrationNumber: supplierDetails.taxRegistrationNumber,
                          category: supplierDetails.category,
                          address: supplierDetails.address,
                          contactDetails: supplierDetails.contactDetails
                        });
                        setIsEditingSupplier(true);
                      }}
                      className="px-3.5 py-1.5 bg-theme-surface-2 border border-theme-divider hover:border-blue-500 rounded-lg text-xs font-semibold text-theme-body transition-all flex items-center space-x-1 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5 text-blue-400" />
                      <span>Edit Master Record</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/40 text-left">
                      <span className="text-[10px] font-mono text-theme-muted block">SOURCING TRANSACTIONS</span>
                      <span className="text-lg font-bold text-theme-body font-mono mt-1 block">{supplierDetails.summary.totalOrders} POs</span>
                      <span className="text-[9px] text-theme-muted mt-1 block">Cumulative purchase volume</span>
                    </div>

                    <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/40 text-left">
                      <span className="text-[10px] font-mono text-theme-muted block">AGGREGATE VALUE BOUGHT</span>
                      <span className="text-lg font-bold text-emerald-400 font-mono mt-1 block">â‚¹{supplierDetails.summary.totalValue}</span>
                      <span className="text-[9px] text-emerald-500 mt-1 block">Fully Confirmed contracts value</span>
                    </div>

                    <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/40 text-left">
                      <span className="text-[10px] font-mono text-theme-muted block">LAST CONTRACT DATE</span>
                      <span className="text-sm font-bold text-slate-200 mt-1 block">
                        {supplierDetails.summary.lastOrderDate === "-" ? "-" : new Date(supplierDetails.summary.lastOrderDate).toLocaleDateString()}
                      </span>
                      <span className="text-[9px] text-theme-muted mt-1.5 block">Most recent dispatch log</span>
                    </div>
                  </div>

                  <div className="bg-theme-surface-2 p-5 rounded-xl border border-theme-divider space-y-4">
                    <h4 className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider border-b border-theme-divider/60 pb-2">VENDOR MASTER METRIC RECORDS</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-theme-muted block">TAX REGISTRATION NUMBER (GSTIN)</span>
                        <span className="text-theme-body font-semibold font-mono text-xs">{supplierDetails.taxRegistrationNumber || "N/A"}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-theme-muted block">CONTACT DIRECTORY DETAILS</span>
                        <span className="text-theme-body font-semibold text-xs">{supplierDetails.contactDetails || "N/A"}</span>
                      </div>
                      <div className="space-y-1 md:col-span-2 pt-2 border-t border-theme-divider/30">
                        <span className="text-[10px] font-mono text-theme-muted block">LINKED CORPORATE ADDRESS</span>
                        <span className="text-slate-300 text-xs leading-relaxed block mt-1">{supplierDetails.address || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUPPLIER FORM (CREATE/UPDATE) */}
              {isEditingSupplier && (
                <form onSubmit={handleSaveSupplier} className="space-y-5">
                  <div className="flex justify-between items-center border-b border-theme-divider/60 pb-3">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400">
                      {supplierForm.vendorCode ? "EDIT SUPPLIER MASTER DATA" : "ONBOARD NEW VENDORPARTNER"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditingSupplier(false)}
                      className="p-1 text-theme-muted hover:text-theme-body rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-mono text-theme-muted block mb-1">SUPPLIER CORPORATE NAME *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Acme Textiles Ltd"
                        value={supplierForm.name}
                        onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-theme-muted block mb-1">VENDOR CODE (UNIQUE) *</label>
                      <input
                        type="text"
                        required
                        disabled={!!supplierForm.vendorCode && suppliersList.some(s => s.vendorCode === supplierForm.vendorCode)}
                        placeholder="e.g. VND-ACME"
                        value={supplierForm.vendorCode}
                        onChange={(e) => setSupplierForm({ ...supplierForm, vendorCode: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                      <span className="text-[8px] text-theme-muted mt-1 block">In-place update is triggered if vendor code matches an existing supplier.</span>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-theme-muted block mb-1">TAX REGISTRATION NUMBER (GSTIN)</label>
                      <input
                        type="text"
                        placeholder="e.g. 07AAAAA1111A1Z1"
                        value={supplierForm.taxRegistrationNumber}
                        onChange={(e) => setSupplierForm({ ...supplierForm, taxRegistrationNumber: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-theme-muted block mb-1">PRIMARY PRODUCTS CLASSIFICATION</label>
                      <select
                        value={supplierForm.category}
                        onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                      >
                        <option value="Apparel">Apparel (12% tax code)</option>
                        <option value="Footwear">Footwear (18% tax code)</option>
                        <option value="Accessories">Accessories (18% tax code)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-mono text-theme-muted block mb-1">CONTACT PERSON DETAILS</label>
                      <input
                        type="text"
                        placeholder="e.g. Suresh Kumar, Phone: +91 9911000111, Email: suresh@acme.com"
                        value={supplierForm.contactDetails}
                        onChange={(e) => setSupplierForm({ ...supplierForm, contactDetails: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-mono text-theme-muted block mb-1">LINKED REGISTERED ADDRESS</label>
                      <textarea
                        rows={2}
                        placeholder="Type full physical shipping / billing address..."
                        value={supplierForm.address}
                        onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      Save Supplier Record
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}


        {/* â”€â”€ SUB-TAB 3: REORDER SUGGESTIONS â”€â”€ */}
        {activeSubTab === "reorder" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-theme-divider/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-theme-body font-display">Dynamic Reorder Suggestions Analysis</h3>
                <p className="text-xs text-theme-muted mt-0.5">System scans active stock across all warehouses and triggers replenishment orders for variants falling below target levels.</p>
              </div>

              {/* Suggestions filters */}
              <div className="bg-theme-surface-1 p-1.5 border border-theme-divider rounded-xl flex items-center space-x-2">
                <span className="text-[9px] text-theme-muted font-mono pl-2">FILTER PREFERRED SUPPLIER:</span>
                <select
                  value={reorderSupplierFilter}
                  onChange={(e) => {
                    setReorderSupplierFilter(e.target.value);
                    setSelectedSuggestions({});
                  }}
                  className="bg-theme-surface-2 border border-theme-divider/60 rounded-lg px-2.5 py-1 text-xs text-theme-body focus:outline-none cursor-pointer"
                >
                  <option value="">-- All Suppliers --</option>
                  {suppliersList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {reorderSuggestions.length === 0 ? (
              <div className="p-16 text-center text-theme-muted text-xs bg-theme-surface-1/40 border border-dashed border-theme-divider rounded-2xl flex flex-col items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                SMRITI Inventory Alert: All product stock balances are currently compliant with standard thresholds. No trigger suggestions required.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-theme-divider">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-theme-surface-1 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                        <th className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={reorderSuggestions.length > 0 && reorderSuggestions.every(s => selectedSuggestions[s.productId])}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const newSelections: Record<string, boolean> = {};
                              reorderSuggestions.forEach(s => {
                                newSelections[s.productId] = checked;
                              });
                              setSelectedSuggestions(newSelections);
                            }}
                            className="rounded bg-theme-surface-2"
                          />
                        </th>
                        <th className="px-4 py-3">Low-Stock Product variant</th>
                        <th className="px-4 py-3">Color/Size</th>
                        <th className="px-4 py-3 text-right">Stock On-Hand</th>
                        <th className="px-4 py-3 text-right">Reorder Level</th>
                        <th className="px-4 py-3 text-right">Reorder Target</th>
                        <th className="px-4 py-3 text-right">Suggested Order Qty</th>
                        <th className="px-4 py-3">Preferred Supplier</th>
                        <th className="px-4 py-3 text-right">Est Purchase Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a3a5c]/40">
                      {reorderSuggestions.map(s => (
                        <tr
                          key={s.productId}
                          className={`hover:bg-theme-surface-3/20 ${
                            selectedSuggestions[s.productId] ? "bg-indigo-950/20" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!selectedSuggestions[s.productId]}
                              onChange={(e) => {
                                setSelectedSuggestions({
                                  ...selectedSuggestions,
                                  [s.productId]: e.target.checked
                                });
                              }}
                              className="rounded bg-theme-surface-2"
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-theme-body">
                            {s.name}
                            <span className="block text-[10px] text-theme-muted font-mono mt-0.5">{s.code}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-300">{s.color || "N/A"}</span> â€¢ <span className="font-semibold text-theme-muted">{s.size || "OS"}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-400">{s.currentStock} units</td>
                          <td className="px-4 py-3 text-right font-mono text-theme-muted">{s.reorderLevel} units</td>
                          <td className="px-4 py-3 text-right font-mono text-theme-body">{s.reorderQty} units</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-300">+{s.suggestedQty} units</td>
                          <td className="px-4 py-3">
                            <span className="text-slate-200 text-xs font-semibold">{s.preferredSupplierName}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-theme-primary">â‚¹{s.lastPurchaseRate}</span>
                            <span className="block text-[8px] text-theme-muted font-mono truncate">{s.rateSource}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Suggestions bulk execution panel */}
                <div className="bg-theme-surface-1 p-5 rounded-xl border border-theme-divider flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-theme-body uppercase tracking-wider font-mono">Convert triggers to procurement draft</h4>
                    <p className="text-[11px] text-theme-muted mt-0.5">
                      Select suggestions, assign to target supplier, and batch create the draft PO.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="bg-theme-surface-2 p-2.5 rounded-lg border border-theme-divider/60 flex items-center space-x-2">
                      <span className="text-[10px] text-theme-muted font-mono pl-1">CONFIRM SOURCING SUPPLIER:</span>
                      <select
                        value={reorderSupplierFilter}
                        onChange={(e) => setReorderSupplierFilter(e.target.value)}
                        className="bg-theme-surface-1 border border-theme-divider/40 rounded-lg px-2 py-0.5 text-xs text-indigo-300 font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="">-- Pick registered vendor --</option>
                        {suppliersList.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleConvertSuggestions}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      Convert Suggestions to PO Draft ({Object.values(selectedSuggestions).filter(Boolean).length} selected)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}


        {/* â”€â”€ SUB-TAB 4: GOODS RECEIPT (GRN) â”€â”€ */}
        {activeSubTab === "receive" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* GRN Left: pending orders list */}
            <div className="lg:col-span-1 bg-theme-surface-1 border border-theme-divider rounded-xl p-5 space-y-4">
              <div className="border-b border-theme-divider/60 pb-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400">PENDING CONFIRMED ORDERS</h3>
                <p className="text-[10px] text-theme-muted mt-0.5">Select a confirmed order awaiting stock physical arrivals.</p>
              </div>

              {purchaseOrders.length === 0 ? (
                <div className="p-8 text-center text-theme-muted text-xs">No active confirmed orders awaiting physical dispatches.</div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {purchaseOrders.map(po => {
                    if (po.status !== "Confirmed") return null;
                    return (
                      <div
                        key={po.id}
                        onClick={() => {
                          setSelectedPO(po);
                          setReceiptQuantities({});
                        }}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                          selectedPO?.id === po.id
                            ? "bg-indigo-950/40 border-indigo-500/50"
                            : "bg-theme-surface-2 border-theme-divider/60 hover:border-theme-divider hover:bg-theme-surface-1"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold text-theme-body">{po.orderNo}</h4>
                          <span className="text-[9px] bg-indigo-950 text-indigo-400 border border-indigo-500/20 rounded px-1.5 py-0.2 font-mono font-bold">
                            {po.receivedPercentage}% RECEIVED
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-theme-muted mt-2 font-mono">
                          <span>{po.supplierName}</span>
                          <span>Value: â‚¹{po.grandTotal}</span>
                        </div>
                        <span className="block text-[8px] text-theme-muted font-mono mt-1.5">Expected: {new Date(po.expectedDeliveryDate).toLocaleDateString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* GRN Right: physical arrival verification form */}
            <div className="lg:col-span-2 bg-theme-surface-1 border border-theme-divider rounded-xl p-5">
              
              {!selectedPO ? (
                <div className="p-12 text-center text-theme-muted text-xs h-full flex flex-col items-center justify-center">
                  <Truck className="w-12 h-12 text-[#2a3a5c] mb-3" />
                  Identify a confirmed PO on the left panel to register physical stock dispatches and reconcile arrivals into SMRITI inventories.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex justify-between items-center border-b border-theme-divider/60 pb-3">
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400">PHYSICAL ARRIVALS RECONCILIATION FOR {selectedPO.orderNo}</h3>
                      <p className="text-[10px] text-theme-muted mt-0.5">Supplier: {selectedPO.supplierName} | Date: {new Date(selectedPO.date).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => setSelectedPO(null)}
                      className="p-1 text-theme-muted hover:text-theme-body rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Receipt Items Grid */}
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-xl border border-theme-divider">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                            <th className="px-4 py-3">Variant / Code</th>
                            <th className="px-4 py-3 text-right">Ordered Qty</th>
                            <th className="px-4 py-3 text-right">Already Received</th>
                            <th className="px-4 py-3 text-right">Pending Outstanding</th>
                            <th className="px-4 py-3 text-right w-36">Arrived Today Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a3a5c]/40">
                          {selectedPO.items.map((item: any) => {
                            const pending = item.quantity - item.receivedQuantity;
                            return (
                              <tr key={item.productId} className="hover:bg-theme-surface-3/20">
                                <td className="px-4 py-3 font-semibold text-theme-body">
                                  {item.name}
                                  <span className="block text-[10px] text-theme-muted font-mono mt-0.5">{item.code}</span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-[#cbd5e1]">{item.quantity} units</td>
                                <td className="px-4 py-3 text-right font-mono text-emerald-400">{item.receivedQuantity} units</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-amber-300">{pending} units</td>
                                <td className="px-4 py-3 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    max={pending}
                                    placeholder="0"
                                    value={receiptQuantities[item.productId] || ""}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      setReceiptQuantities({
                                        ...receiptQuantities,
                                        [item.productId]: val
                                      });
                                    }}
                                    disabled={pending <= 0}
                                    className="w-full bg-theme-surface-2 border border-emerald-500/40 focus:border-emerald-500 disabled:opacity-45 rounded px-2.5 py-1.5 text-xs text-theme-body text-right font-mono font-bold focus:outline-none"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleConfirmReceipt}
                        className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center space-x-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Log reconciled GRN & update inventory</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        )}


        {/* â”€â”€ SUB-TAB 5: REPORTS & REGISTERS â”€â”€ */}
        {activeSubTab === "reports" && (
          <div className="space-y-8">
            
            {/* Row 1: Order Register filtering */}
            <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-5 space-y-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-theme-divider/60 pb-3">
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400">OFFICIAL PURCHASE ORDER REGISTERS</h3>
                  <p className="text-[10px] text-theme-muted mt-0.5">Filter the complete purchase records ledger dynamically at server database layer.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <SmartFilter 
                    filters={[
                      {
                        id: "supplier",
                        label: "Supplier",
                        type: "multi-select",
                        options: suppliersList.map(s => ({ value: s.id, label: s.name }))
                      },
                      {
                        id: "status",
                        label: "Status",
                        type: "multi-select",
                        options: [
                          { value: "Draft", label: "Draft" },
                          { value: "Confirmed", label: "Confirmed" },
                          { value: "Cancelled", label: "Cancelled" },
                          { value: "Complete", label: "Complete" }
                        ]
                      },
                      {
                        id: "date",
                        label: "Date Range",
                        type: "date-range"
                      }
                    ]}
                    onApply={(filters) => {
                      setReportSupplierFilter(filters.supplier || "");
                      setReportStatusFilter(filters.status || "");
                      setReportStartDate(filters.date?.start || "");
                      setReportEndDate(filters.date?.end || "");
                      
                      fetchPurchaseOrders("", {
                        supplier: filters.supplier || "",
                        statusFilter: filters.status || "",
                        start: filters.date?.start || "",
                        end: filters.date?.end || ""
                      });
                    }}
                  />
                  <button
                    onClick={() => fetchPurchaseOrders()}
                    className="p-1.5 bg-theme-surface-2 border border-theme-divider hover:border-blue-500 rounded text-xs text-theme-body transition-all cursor-pointer"
                    title="Refresh Register"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {purchaseOrders.length === 0 ? (
                <div className="p-8 text-center text-theme-muted text-xs">No purchase contracts matching defined filter constraints.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-theme-divider">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                        <th className="px-4 py-3">Order Number</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3">Expected Date</th>
                        <th className="px-4 py-3 text-right">Contract Value</th>
                        <th className="px-4 py-3 text-right">Corporate Paid</th>
                        <th className="px-4 py-3 text-right">Received %</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Authorized Sourcing Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a3a5c]/40">
                      {purchaseOrders.map(po => (
                        <tr key={po.id} className="hover:bg-theme-surface-3/20">
                          <td className="px-4 py-3 font-bold font-mono text-theme-body">{po.orderNo}</td>
                          <td className="px-4 py-3 text-theme-muted font-mono">{new Date(po.date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-semibold text-theme-body">{po.supplierName}</td>
                          <td className="px-4 py-3 font-mono">{po.expectedDeliveryDate}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">â‚¹{po.grandTotal}</td>
                          <td className="px-4 py-3 text-right font-mono text-theme-muted">â‚¹{po.paidAmount || 0}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-indigo-300 font-mono text-xs">{po.receivedPercentage}%</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono border ${
                              po.status === "Draft" ? "bg-amber-950/40 border-amber-500/30 text-amber-300" : po.status === "Submitted" ? "bg-blue-950/40 border-blue-500/30 text-blue-300" : po.status === "Approved" ? "bg-indigo-950/40 border-indigo-500/30 text-indigo-300" : po.status === "Rejected" || po.status === "Cancelled" ? "bg-rose-950/40 border-rose-500/30 text-rose-300" : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                            }`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center flex items-center justify-center space-x-2">
                            
                            {po.status === "Draft" && (
                              <button
                                onClick={() => handleWorkflowAction(po.id, "submit")}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-mono text-[9px] font-bold transition-all cursor-pointer"
                              >
                                SUBMIT
                              </button>
                            )}
                            {po.status === "Submitted" && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleWorkflowAction(po.id, "approve")}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-mono text-[9px] font-bold transition-all cursor-pointer"
                                >
                                  APPROVE
                                </button>
                                <button
                                  onClick={() => handleWorkflowAction(po.id, "reject")}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-mono text-[9px] font-bold transition-all cursor-pointer"
                                >
                                  REJECT
                                </button>
                              </div>
                            )}
                            {po.status === "Approved" && (

                              <button
                                onClick={() => {
                                  const initialQ: Record<string, number> = {};
                                  po.items.forEach((item: any) => {
                                    initialQ[item.productId] = item.quantity;
                                  });
                                  setAmendPO(po);
                                  setAmendQuantities(initialQ);
                                  setAmendReason("");
                                }}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-mono text-[9px] font-bold transition-all cursor-pointer"
                              >
                                AMEND ORDER
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedPO(po);
                                setReceiptQuantities({});
                                setActiveSubTab("receive");
                              }}
                              className="p-1 text-theme-muted hover:text-theme-body rounded transition-colors cursor-pointer"
                              title="Inspect contract"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                              <button onClick={(e) => { e.stopPropagation(); onNotification("Print", "Printing Voucher " + po.orderNo, "success"); window.print(); }} className="p-1 rounded text-theme-muted hover:text-slate-400" title="Print"><Printer className="w-4 h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); onNotification("WhatsApp", "Generating PDF for WhatsApp", "success"); window.open('https://wa.me/?text=Voucher%20' + po.orderNo); }} className="p-1 rounded text-theme-muted hover:text-emerald-400" title="WhatsApp"><MessageCircle className="w-4 h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); onNotification("Email", "Drafting Email with PDF", "success"); window.open('mailto:?subject=Voucher%20' + po.orderNo); }} className="p-1 rounded text-theme-muted hover:text-blue-400" title="Email"><Mail className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Report 2: Supplier Outstanding */}
              <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-theme-divider/60 pb-3">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400">SUPPLIER OUTSTANDING LEDGER</h3>
                    <p className="text-[10px] text-theme-muted mt-0.5">Summed liabilities (Confirmed Grand Total minus Billed payments).</p>
                  </div>
                  <button
                    onClick={fetchOutstandingReport}
                    className="p-1 text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {outstandingReport.length === 0 ? (
                  <div className="p-8 text-center text-theme-muted text-xs bg-theme-surface-2 border border-dashed border-theme-divider/60 rounded-lg">
                    Corporate audit log clean. Zero outstanding liabilities currently owed.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-theme-divider">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                          <th className="px-3 py-2.5">Supplier Name</th>
                          <th className="px-3 py-2.5 text-right">Liabilities Owed</th>
                          <th className="px-3 py-2.5">Oldest Outstanding Date</th>
                          <th className="px-3 py-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a3a5c]/40 font-mono">
                        {outstandingReport.map(r => (
                          <tr key={r.supplierId} className="hover:bg-theme-surface-3/20">
                            <td className="px-3 py-2.5 font-sans font-bold text-theme-body text-xs">{r.name}</td>
                            <td className="px-3 py-2.5 text-right text-rose-400 font-bold">â‚¹{r.totalOwed}</td>
                            <td className="px-3 py-2.5 text-theme-muted">
                              {r.oldestOrderDate === "-" ? "-" : new Date(r.oldestOrderDate).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => {
                                  // Find the confirmed PO from register for this supplier with outstanding dues
                                  const po = purchaseOrders.find(p => p.supplierId === r.supplierId && (p.grandTotal - p.paidAmount) > 0);
                                  if (po) {
                                    setPayModalPO(po);
                                    setPayAmount(String(po.grandTotal - po.paidAmount));
                                  } else {
                                    onNotification("No specific PO found", "Outstanding balance is consolidated. Apply via invoice register payments.", "error");
                                  }
                                }}
                                className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-500/20 rounded text-[9px] font-bold hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
                              >
                                REGISTER PAYMENT
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Report 3: Item Pending Delivery */}
              <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-theme-divider/60 pb-3">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400">ITEM PENDING DELIVERY LEDGER</h3>
                    <p className="text-[10px] text-theme-muted mt-0.5">Variants currently outstanding in open dispatch dispatches.</p>
                  </div>
                  <button
                    onClick={fetchPendingDeliveryReport}
                    className="p-1 text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {pendingDeliveryReport.length === 0 ? (
                  <div className="p-8 text-center text-theme-muted text-xs bg-theme-surface-2 border border-dashed border-theme-divider/60 rounded-lg">
                    Reconciliation clear. Zero items pending physical dispatches.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-theme-divider">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                          <th className="px-3 py-2.5">Product variant</th>
                          <th className="px-3 py-2.5 text-right">Ordered</th>
                          <th className="px-3 py-2.5 text-right">Received</th>
                          <th className="px-3 py-2.5 text-right">Outstanding</th>
                          <th className="px-3 py-2.5 text-center">Suppliers</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a3a5c]/40 font-mono text-[11px]">
                        {pendingDeliveryReport.map(item => (
                          <tr key={item.productId} className="hover:bg-theme-surface-3/20">
                            <td className="px-3 py-2.5 font-sans font-semibold text-theme-body">
                              {item.name}
                              <span className="block text-[9px] text-theme-muted mt-0.5">{item.color || "N/A"} â€¢ {item.size || "OS"}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-300">{item.totalOrdered}</td>
                            <td className="px-3 py-2.5 text-right text-emerald-400">{item.totalReceived}</td>
                            <td className="px-3 py-2.5 text-right text-amber-300 font-bold">{item.pendingQty}</td>
                            <td className="px-3 py-2.5 text-center font-sans font-semibold text-white bg-indigo-950/20">{item.supplierCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>

      {/* AMENDMENT POPUP MODAL */}
      {amendPO && (
        <div className="fixed inset-0 bg-[#070b19]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="bg-theme-surface-2 p-5 border-b border-theme-divider flex justify-between items-center">
              <div>
                <h3 className="font-bold font-display text-theme-body text-sm">AMEND CONFIRMED SOURCING CONTRACT</h3>
                <p className="text-[10px] text-theme-muted mt-0.5">Supersedes and cancels active confirmed PO: {amendPO.orderNo}</p>
              </div>
              <button
                onClick={() => setAmendPO(null)}
                className="p-1 text-theme-muted hover:text-theme-body rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[350px] overflow-y-auto">
              <div className="space-y-3">
                <label className="text-[10px] font-mono text-theme-muted block">AMENDMENT MOTIVATION / REASON *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supplier confirmed stock short-dispatches in sizing allocations..."
                  value={amendReason}
                  onChange={(e) => setAmendReason(e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-[10px] font-mono text-theme-muted block uppercase">Adjust Line quantities</label>
                <div className="overflow-x-auto rounded-xl border border-theme-divider/60">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-theme-surface-2 text-theme-muted font-mono uppercase text-[9px] tracking-wider border-b border-theme-divider/60">
                        <th className="px-4 py-2.5">Variant</th>
                        <th className="px-4 py-2.5 text-right">Original Qty</th>
                        <th className="px-4 py-2.5 text-right w-40">Amended Target Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a3a5c]/40">
                      {amendPO.items.map((item: any) => (
                        <tr key={item.productId} className="hover:bg-theme-surface-3/20">
                          <td className="px-4 py-2.5 font-semibold text-theme-body">
                            {item.name}
                            <span className="block text-[9px] text-theme-muted font-mono">{item.color || "N/A"} â€¢ Size: {item.size || "OS"}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-theme-muted">{item.quantity} units</td>
                          <td className="px-4 py-2.5 text-right">
                            <input
                              type="number"
                              min="1"
                              value={amendQuantities[item.productId] || ""}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 0);
                                setAmendQuantities({
                                  ...amendQuantities,
                                  [item.productId]: val
                                });
                              }}
                              className="w-full bg-theme-surface-2 border border-amber-500/40 text-right px-2.5 py-1.5 rounded text-xs text-theme-body font-mono font-bold"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-theme-surface-2 p-4 border-t border-theme-divider flex justify-end space-x-3">
              <button
                onClick={() => setAmendPO(null)}
                className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
              >
                Discard changes
              </button>
              <button
                onClick={handleAmendPO}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Supersede & Generate Draft Amendment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {payModalPO && (
        <div className="fixed inset-0 bg-[#070b19]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="bg-theme-surface-2 p-5 border-b border-theme-divider flex justify-between items-center">
              <div>
                <h3 className="font-bold font-display text-theme-body text-sm">REGISTER SUPPLIER PAYMENT</h3>
                <p className="text-[10px] text-theme-muted mt-0.5">Record payment transaction details against {payModalPO.orderNo}</p>
              </div>
              <button
                onClick={() => setPayModalPO(null)}
                className="p-1 text-theme-muted hover:text-theme-body rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 font-sans text-xs">
              <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/60 space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span>Supplier:</span>
                  <strong className="text-theme-body">{payModalPO.supplierName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Grand Total:</span>
                  <span className="font-mono text-emerald-400">â‚¹{payModalPO.grandTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid Balance already:</span>
                  <span className="font-mono text-theme-muted">â‚¹{payModalPO.paidAmount || 0}</span>
                </div>
                <div className="border-t border-theme-divider/40 my-2 pt-2 flex justify-between font-bold text-theme-body">
                  <span>Remaining Outstanding:</span>
                  <span className="font-mono text-rose-400">â‚¹{payModalPO.grandTotal - (payModalPO.paidAmount || 0)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono text-theme-muted block">PAYMENT SETTLEMENT AMOUNT (â‚¹)</label>
                <input
                  type="number"
                  min="1"
                  max={payModalPO.grandTotal - (payModalPO.paidAmount || 0)}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none font-mono font-bold"
                />
              </div>
            </div>

            <div className="bg-theme-surface-2 p-4 border-t border-theme-divider flex justify-end space-x-3">
              <button
                onClick={() => setPayModalPO(null)}
                className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Log corporate payment
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
