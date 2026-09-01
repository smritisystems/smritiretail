/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import { apiFetch, apiFetchV1 } from "./lib/apiFetch.ts";
import { motion, AnimatePresence } from "motion/react";
import {
  Product,
  POSProfile,
  Shift,
  FieldInfo,
  Formula,
  PSVParty,
} from "./types.js";

// Import Layout Engine
import {
  LayoutEngineProvider,
  useLayoutEngine,
} from "./layout_engine/layout_store.tsx";
import { LayoutManager } from "./layout_engine/layout_manager.tsx";

// Synchronously imported (lightweight or frequently used)
import { DashboardTab } from "./components/DashboardTab.tsx";
import { PosTerminalTab } from "./components/PosTerminalTab.tsx";
import { FieldExplorerTab } from "./components/FieldExplorerTab.tsx";
import { FormulaRegistryTab } from "./components/FormulaRegistryTab.tsx";
import { PsvTab } from "./components/PsvTab.tsx";
import { PosProfilesTab } from "./components/PosProfilesTab.tsx";
import { AdvancedBillingEngine } from "./components/AdvancedBillingEng.tsx";
import { WikiTab } from "./components/WikiTab.tsx";
import { CustomerMasterTab } from "./components/CustomerMasterTab.tsx";
import { SupplierDashboardTab } from "./components/SupplierDashTab.tsx";
import { ExplainModal } from "./components/ExplainModal.tsx";
import { DrillDownProvider } from "./components/drilldown/drilldown_store.tsx";
import { DrillDownBreadcrumbs } from "./components/drilldown/DrillDownCrumbs.tsx";
import { DrillDownSidePanel } from "./components/drilldown/DrillDownSidePanel.tsx";
import { GlobalSearch } from "./components/drilldown/GlobalSearch.tsx";
import { GlobalF2BrowseModal } from "./components/drilldown/GlobalF2BrowseDlg.tsx";
import { QuickActionsMenu } from "./components/QuickActionsMenu.tsx";
import { DocumentSeriesTab } from "./components/DocumentSeriesTab.tsx";
import { UserProfileTab } from "./components/UserProfileTab.tsx";
import { NotificationProvider, useNotifications } from "./notifications/notification_store.tsx";
import { ActiveFieldProvider } from "./context/ActiveFieldContext.tsx";
import { ContextualInspectorHUD } from "./components/drilldown/CtxInspectorHUD.tsx";
import { ContextProvider } from "./context-actions/ContextProvider.tsx";
import { ContextRenderer } from "./context-actions/ContextRenderer.tsx";
import { registerAllDefaultActions } from "./context-actions/providers/SMRITIModuleActions.ts";
import { PrintProvider } from "./print_engine/print_store.tsx";
import { AboutSmritiTab } from "./components/AboutSmritiTab.tsx";
import { TaxInvoicePrintPage } from "./components/TaxInvoicePrintPag.tsx";
import { DevTrackerTab } from "./modules/dev_tracker/ui/DevTrackerTab.tsx";
import { useLayoutModuleRegistration } from "./components/SmritiBaseModule.tsx";
import { WorkspaceProvider, useWorkspace } from "./contexts/WorkspaceContext.tsx";
import { FloatingWindowHost } from "./components/FloatingWindowHost.tsx";
import { ShortcutProvider } from "./contexts/ShortcutContext.tsx";
import { ShortcutPalette } from "./components/ShortcutPalette.tsx";
import { PasswordReset } from "./components/PasswordReset.tsx";
import { LoginScreen } from "./components/LoginScreen.tsx";
import { CompanySelectionScreen } from "./components/CompanySelectScree.tsx";
import { SmritiErrorBoundary } from "./components/ErrorBoundary.tsx";
import { clearAuthSession, normalizeBranchId, normalizeCompanyId, persistTenantContext } from "./lib/apiFetchV1.ts";
import { AppShell } from "./components/shell/AppShell.tsx";
import { FioriLaunchpad } from "./components/launchpad/FioriLaunchpad.tsx";
import { SecManageDlg } from "./components/security/SecManageDlg.tsx";
import { SalesOrderFormPremium } from "./components/sales/SalesOrderFormPremium.tsx";
import { VendorReturnModal } from "./components/procurement/VendorReturnModal.tsx";
import {
  X,
  Search,
  History,
  Settings,
  Printer,
  Save,
  Plus,
  ReceiptText,
  Boxes,
  BarChart3,
  Users,
  Settings2,
  CircleHelp,
  LogOut,
  FileUp,
  UserRoundSearch,
  CheckCircle2,
} from "lucide-react";

// Lazy-loaded components (heavy feature modules)
const SalesStudioTab = lazy(() => import("./components/SalesStudioTab.tsx").then(m => ({ default: m.SalesStudioTab })));
const ReportDesignerTab = lazy(() => import("./components/ReportDesignerTab.tsx").then(m => ({ default: m.ReportDesignerTab })));
const PurchaseStudioTab = lazy(() => import("./components/PurchaseStudioTab.tsx").then(m => ({ default: m.PurchaseStudioTab })));
const ItemMasterTab = lazy(() => import("./components/ItemMasterTab.tsx").then(m => ({ default: m.ItemMasterTab })));
const BarcodeStudioTab = lazy(() => import("./components/BarcodeStudioTab.tsx").then(m => ({ default: m.BarcodeStudioTab })));
const MasterManagementTab = lazy(() => import("./components/MasterMgmtTab.tsx").then(m => ({ default: m.MasterManagementTab })));
const CrmStudioTab = lazy(() => import("./components/CrmStudioTab.tsx").then(m => ({ default: m.CrmStudioTab })));
const LoyaltyStudioTab = lazy(() => import("./components/LoyaltyStudioTab.tsx").then(m => ({ default: m.LoyaltyStudioTab })));
const ApprovalMatrixTab = lazy(() => import("./components/ApprovalMatrixTab.tsx").then(m => ({ default: m.ApprovalMatrixTab })));
const StaffManagementTab = lazy(() => import("./components/StaffManagementTab.tsx").then(m => ({ default: m.StaffManagementTab })));
const PrintStudioTab = lazy(() => import("./print_engine/PrintStudioTab.tsx").then(m => ({ default: m.PrintStudioTab })));
const PrintHistoryTab = lazy(() => import("./print_engine/PrintHistoryTab.tsx").then(m => ({ default: m.PrintHistoryTab })));
const DistTaxInvoice = lazy(() => import("./components/sales/DistTaxInvoice.tsx").then(m => ({ default: m.DistTaxInvoice })));
const TrainingAcademyTab = lazy(() => import("./components/training/TrainingAcademyTab.tsx").then(m => ({ default: m.TrainingAcademyTab })));
const AccountingSyncTab = lazy(() => import("./components/AccountingSyncTab.tsx").then(m => ({ default: m.AccountingSyncTab })));
const BusinessLedgerTab = lazy(() => import("./components/BusinessLedgerTab.tsx").then(m => ({ default: m.BusinessLedgerTab })));
const StockLedgerTab = lazy(() => import("./components/StockLedgerTab.tsx").then(m => ({ default: m.StockLedgerTab })));
const AuditLogsTab = lazy(() => import("./components/AuditLogsTab.tsx").then(m => ({ default: m.AuditLogsTab })));
const TermsEngineTab = lazy(() => import("./components/TermsEngineTab.tsx").then(m => ({ default: m.TermsEngineTab })));
const DataExchangeTab = lazy(() => import("./components/DataExchangeTab.tsx").then(m => ({ default: m.DataExchangeTab })));
const DatabaseManagerTab = lazy(() => import("./components/DatabaseManagerTab.tsx").then(m => ({ default: m.DatabaseManagerTab })));
const LegacyMigDashTab = lazy(() => import("./components/LegacyMigDashTab.tsx").then(m => ({ default: m.LegacyMigDashTab })));
const PhysicalStockTab = lazy(() => import("./components/PhysicalStockTab.tsx").then(m => ({ default: m.PhysicalStockTab })));
const StorePolicyStudio = lazy(() => import("./components/StorePolicyStudio.tsx").then(m => ({ default: m.StorePolicyStudio })));
const WmsStudioTab = lazy(() => import("./components/wms/WmsStudioTab.tsx").then(m => ({ default: m.WmsStudioTab })));
const SetupWizardTab = lazy(() => import("./components/SetupWizard/SetupWizardTab.tsx").then(m => ({ default: m.SetupWizardTab })));
const PrintPreviewModal = lazy(() => import("./components/PrintPreviewModal.tsx").then(m => ({ default: m.PrintPreviewModal })));
const MenuManagerStudioTab = lazy(() => import("./components/MenuManagerStudioTab.tsx").then(m => ({ default: m.MenuManagerStudioTab })));

// Tab loading fallback component
const TabLoadingFallback = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-theme-base text-theme-primary">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-theme-divider border-t-[#2563EB]" />
    <p className="mt-4 text-sm font-mono text-theme-muted">Loading module...</p>
  </div>
);

const StandaloneWindowView: React.FC<{ registeredWorkspaces: Array<{ id: string; label: string; icon: string; }>; renderTabSafe: (id: string) => React.ReactNode; }> = ({ registeredWorkspaces, renderTabSafe }) => {
  const standaloneTab = new URLSearchParams(window.location.search).get("standalone_tab");
  const standaloneSalesOrder = new URLSearchParams(window.location.search).get("standalone_sales_order") === "1";
  const [standaloneScanValue, setStandaloneScanValue] = useState("");
  const [standaloneScannerStatus, setStandaloneScannerStatus] = useState("Ready");
  const [standaloneRows, setStandaloneRows] = useState<Array<{
    no: number;
    stockNo: string;
    description: string;
    rate: string;
    qty: string;
    value: string;
    total: string;
    staff: string;
  }>>([]);
  const [standaloneCustomerName, setStandaloneCustomerName] = useState("Walk-in Customer");
  const [standaloneCustomerQuery, setStandaloneCustomerQuery] = useState("Walk-in Customer");
  const [standaloneCustomerOptions, setStandaloneCustomerOptions] = useState<Array<{ id: string; name: string; code?: string; phone?: string }>>([]);
  const [standaloneSaving, setStandaloneSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importPreviewRows, setImportPreviewRows] = useState<Array<Record<string, string>>>([]);
  const [importFieldMap, setImportFieldMap] = useState<Record<"barcode" | "qty" | "mrp" | "discAmt" | "discPct", string>>({
    barcode: "",
    qty: "",
    mrp: "",
    discAmt: "",
    discPct: "",
  });

  const filteredStandaloneCustomers = standaloneCustomerOptions.filter((customer) => {
    const query = (standaloneCustomerQuery || "").trim().toLowerCase();
    if (!query) return true;
    return (
      customer.name.toLowerCase().includes(query) ||
      (customer.code || "").toLowerCase().includes(query) ||
      (customer.phone || "").toLowerCase().includes(query)
    );
  });

  const normalizeImportHeader = (value: string) => (value || "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

  const detectImportFieldMap = (headers: string[]) => {
    const aliases: Record<string, string[]> = {
      barcode: ["barcode", "bar code", "code", "item code", "sku", "product code", "stock no", "stockno"],
      qty: ["qty", "quantity", "qnty", "qty sold", "sales qty"],
      mrp: ["mrp", "rate", "selling price", "sale price", "price", "unit price"],
      discAmt: ["disc amt", "discount amount", "discount amt", "disc amount", "amount discount", "discount"],
      discPct: ["disc %", "disc pct", "discount %", "discount pct", "discount percent", "discpercent"],
    };

    const nextMap: Record<"barcode" | "qty" | "mrp" | "discAmt" | "discPct", string> = {
      barcode: "",
      qty: "",
      mrp: "",
      discAmt: "",
      discPct: "",
    };

    Object.entries(aliases).forEach(([field, values]) => {
      const matchedHeader = headers.find((header) => {
        const normalized = normalizeImportHeader(header);
        return values.some((alias) => {
          const aliasNormalized = normalizeImportHeader(alias);
          return normalized === aliasNormalized || normalized.includes(aliasNormalized) || aliasNormalized.includes(normalized);
        });
      });
      if (matchedHeader) nextMap[field as keyof typeof nextMap] = matchedHeader;
    });

    return nextMap;
  };

  const parseImportLine = (line: string, delimiter: string) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const ch = line[index];
      if (ch === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }

    values.push(current.trim());
    return values.map((value) => value.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
  };

  const parseImportedText = (text: string) => {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!rows.length) return { headers: [], data: [] as Array<Record<string, string>> };

    const delimiterCandidates = ["\t", ";", ","];
    const delimiter = delimiterCandidates
      .map((candidate) => ({ candidate, count: rows[0].split(candidate).length - 1 }))
      .sort((a, b) => b.count - a.count)[0]?.candidate || ",";

    const parsedRows = rows.map((line) => parseImportLine(line, delimiter));
    const headerCandidates = parsedRows[0].map((header, index) => header || `Column ${index + 1}`);
    const headerRowIndex = parsedRows.some((row) => row.some((cell) => /barcode|qty|quantity|mrp|discount|disc/i.test(cell))) ? 0 : -1;

    const finalHeaders = headerRowIndex === 0 ? headerCandidates : Array.from({ length: Math.max(...parsedRows.map((row) => row.length)) }, (_, index) => `Column ${index + 1}`);
    const dataRows = headerRowIndex === 0 ? parsedRows.slice(1) : parsedRows;
    const normalizedData = dataRows.slice(0, 8).map((row) => {
      const item: Record<string, string> = {};
      finalHeaders.forEach((header, index) => {
        item[header] = row[index] ?? "";
      });
      return item;
    });

    return { headers: finalHeaders, data: normalizedData };
  };

  const addImportedLineToSalesOrder = async (row: Record<string, string>) => {
    const barcode = row[importFieldMap.barcode] || "";
    const quantity = Number(row[importFieldMap.qty] || "1");
    const mrp = Number(row[importFieldMap.mrp] || "0");
    const discAmt = Number(row[importFieldMap.discAmt] || "0");
    const discPct = Number(row[importFieldMap.discPct] || "0");

    if (!barcode) return;

    try {
      const data = await apiFetchV1("/products/search", {
        params: { q: barcode, limit: 10 },
      });
      const productList = Array.isArray(data) ? data : data?.data || [];
      const product = productList.find((item: any) =>
        String(item.barcode || "").toLowerCase() === String(barcode).toLowerCase() ||
        String(item.code || "").toLowerCase() === String(barcode).toLowerCase() ||
        String(item.sku || "").toLowerCase() === String(barcode).toLowerCase()
      ) || productList[0];

      if (!product) {
        setStandaloneScannerStatus(`Import skipped: ${barcode} not found`);
        return;
      }

      const rateValue = Number(mrp > 0 ? mrp : product.price ?? product.selling_price ?? product.rate ?? 0);
      const qtyValue = Number(quantity > 0 ? quantity : 1);
      const discountedRate = Math.max(0, rateValue - (discAmt / Math.max(qtyValue, 1)) - (rateValue * (discPct / 100)));
      const lineTotal = Number((discountedRate * qtyValue).toFixed(2));
      const nextRow = {
        no: standaloneRows.length + 1,
        stockNo: String(product.code || product.sku || product.barcode || barcode),
        description: String(product.name || product.description || "Product"),
        rate: rateValue.toFixed(2),
        qty: qtyValue.toFixed(2),
        value: Number((rateValue * qtyValue).toFixed(2)).toFixed(2),
        total: lineTotal.toFixed(2),
        staff: "SM",
      };

      setStandaloneRows((prevRows) => {
        const existingIndex = prevRows.findIndex((rowItem) => rowItem.stockNo === nextRow.stockNo);
        if (existingIndex >= 0) {
          const existing = prevRows[existingIndex];
          const currentQty = Number(existing.qty || 0);
          const nextQty = currentQty + qtyValue;
          const nextTotal = Number((nextQty * Number(existing.rate || 0)).toFixed(2));
          const copy = [...prevRows];
          copy[existingIndex] = {
            ...existing,
            qty: nextQty.toFixed(2),
            value: nextTotal.toFixed(2),
            total: nextTotal.toFixed(2),
          };
          return copy;
        }

        return [...prevRows, nextRow];
      });
    } catch (error: any) {
      console.error("Import row lookup failed:", error);
      setStandaloneScannerStatus(error?.message || "Import failed");
    }
  };

  useEffect(() => {
    const loadStandaloneCustomers = async () => {
      try {
        const data = await apiFetchV1("/crm/customers", {
          params: { skip: 0, limit: 50 },
        });
        const customerList = Array.isArray(data) ? data : data?.data || [];
        const mapped = customerList.map((customer: any) => ({
          id: String(customer.id || customer.customer_id || customer.code || customer.mobile || Math.random().toString(36).slice(2)),
          name: String(customer.name || customer.customer_name || "Walk-in Customer"),
          code: String(customer.code || customer.customer_code || ""),
          phone: String(customer.mobile || customer.phone || ""),
        }));
        setStandaloneCustomerOptions(mapped);
        if (mapped.length > 0 && standaloneCustomerName === "Walk-in Customer") {
          setStandaloneCustomerName(mapped[0].name);
          setStandaloneCustomerQuery(mapped[0].name);
        }
      } catch (error) {
        console.warn("Unable to load standalone customers:", error);
        setStandaloneCustomerOptions([]);
      }
    };

    void loadStandaloneCustomers();
  }, []);

  useEffect(() => {
    const loadStandaloneCatalog = async () => {
      try {
        const data = await apiFetchV1("/products/search", {
          params: { q: "", limit: 5 },
        });
        const productList = Array.isArray(data) ? data : data?.data || [];
        if (!productList.length) {
          setStandaloneScannerStatus("No live inventory loaded");
          return;
        }

        const preview = productList.slice(0, 3).map((product: any, index: number) => {
          const rate = Number(product.price ?? product.selling_price ?? product.rate ?? 0);
          return {
            no: index + 1,
            stockNo: String(product.code || product.sku || product.barcode || `SKU-${index + 1}`),
            description: String(product.name || product.description || "Product"),
            rate: rate.toFixed(2),
            qty: "1.00",
            value: rate.toFixed(2),
            total: rate.toFixed(2),
            staff: "SM",
          };
        });

        setStandaloneRows(preview);
        setStandaloneScannerStatus("Live inventory loaded");
      } catch (error: any) {
        console.error("Failed to load live inventory for standalone sales order:", error);
        setStandaloneScannerStatus(error?.message || "Live inventory unavailable");
      }
    };

    void loadStandaloneCatalog();
  }, []);

  const handleStandaloneScanBarcode = async () => {
    const clean = standaloneScanValue.trim();
    if (!clean) {
      setStandaloneScannerStatus("No barcode entered");
      return;
    }

    try {
      const data = await apiFetchV1("/products/search", {
        params: { q: clean, limit: 10 },
      });
      const productList = Array.isArray(data) ? data : data?.data || [];
      const product = productList.find((item: any) =>
        String(item.barcode || "").toLowerCase() === clean.toLowerCase() ||
        String(item.code || "").toLowerCase() === clean.toLowerCase() ||
        String(item.sku || "").toLowerCase() === clean.toLowerCase()
      ) || productList[0];

      if (!product) {
        setStandaloneScannerStatus(`No product for ${clean}`);
        setStandaloneScanValue("");
        return;
      }

      const rate = Number(product.price ?? product.selling_price ?? product.rate ?? 0);
      const qty = 1;
      const value = Number((rate * qty).toFixed(2));
      const stockNo = String(product.code || product.sku || product.barcode || clean);
      const description = String(product.name || product.description || "Product");

      setStandaloneRows((prevRows) => {
        const existingIndex = prevRows.findIndex((row) => row.stockNo === stockNo);
        if (existingIndex >= 0) {
          const existing = prevRows[existingIndex];
          const currentQty = Number(existing.qty || 0);
          const nextQty = currentQty + qty;
          const nextValue = Number((nextQty * Number(existing.rate || 0)).toFixed(2));
          const copy = [...prevRows];
          copy[existingIndex] = {
            ...existing,
            qty: nextQty.toFixed(2),
            value: nextValue.toFixed(2),
            total: nextValue.toFixed(2),
          };
          return copy;
        }

        const nextNo = prevRows.length + 1;
        const newItem = {
          no: nextNo,
          stockNo,
          description,
          rate: rate.toFixed(2),
          qty: qty.toFixed(2),
          value: value.toFixed(2),
          total: value.toFixed(2),
          staff: "SM",
        };
        return [...prevRows, newItem];
      });

      setStandaloneScannerStatus(`Scanned ${stockNo}`);
      setStandaloneScanValue("");
    } catch (error: any) {
      console.error("Standalone barcode lookup failed:", error);
      setStandaloneScannerStatus(error?.message || "Lookup failed");
      setStandaloneScanValue("");
    }
  };

  const handleStandaloneImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const { headers, data } = parseImportedText(text);

    if (!headers.length || !data.length) {
      setStandaloneScannerStatus("No usable data in file");
      event.target.value = "";
      return;
    }

    const mapped = detectImportFieldMap(headers);
    setImportHeaders(headers);
    setImportPreviewRows(data);
    setImportFieldMap((prev) => ({
      ...prev,
      ...mapped,
    }));
    setImportDialogOpen(true);
    event.target.value = "";
  };

  const handleApplyImportedRows = async () => {
    if (!importPreviewRows.length) {
      setStandaloneScannerStatus("No rows to import");
      return;
    }

    const selectedKeys = Object.values(importFieldMap).filter(Boolean);
    if (selectedKeys.length === 0 || !importFieldMap.barcode || !importFieldMap.qty || !importFieldMap.mrp) {
      setStandaloneScannerStatus("Map Barcode, Qty and MRP before import");
      return;
    }

    setImportDialogOpen(false);
    setStandaloneScannerStatus("Importing rows...");

    for (const row of importPreviewRows) {
      await addImportedLineToSalesOrder(row);
    }

    setStandaloneScannerStatus("Imported from file");
  };

  const handleStandaloneSaveOrder = async () => {
    if (standaloneRows.length === 0) {
      setStandaloneScannerStatus("No item lines to save");
      return;
    }

    const payload = {
      id: `so-${Date.now()}`,
      order_no: `SO-${Date.now()}`,
      customer_name: standaloneCustomerName || "Walk-in Customer",
      date: new Date().toISOString().slice(0, 10),
      status: "pending",
      items: standaloneRows.map((row) => ({
        product_id: String(row.stockNo || ""),
        code: String(row.stockNo || ""),
        name: String(row.description || "Item"),
        quantity: String(Number(row.qty || 0)),
        price: String(Number(row.rate || 0)),
        gst_rate: "18.00",
        total_amount: String(Number(row.total || row.value || 0)),
      })),
    };

    try {
      setStandaloneSaving(true);
      await apiFetchV1("/sales/orders", {
        method: "POST",
        body: payload,
      });
      setStandaloneScannerStatus("Saved to database");
    } catch (error: any) {
      console.error("Standalone sales order save failed:", error);
      setStandaloneScannerStatus(error?.message || "Save failed");
    } finally {
      setStandaloneSaving(false);
    }
  };

  const handleStandaloneRoute = (routeId: string) => {
    const params = new URLSearchParams(window.location.search);
    params.delete("standalone_sales_order");
    params.set("standalone_tab", routeId);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.location.href = nextUrl;
  };

  const handleStandaloneLogout = () => {
    clearAuthSession("standalone_logout");
    window.location.href = window.location.origin;
  };

  if (standaloneSalesOrder) {
    const leftNav = [
      { icon: ReceiptText, label: "Orders", routeId: "sales", active: true },
      { icon: Boxes, label: "Products", routeId: "inventory" },
      { icon: BarChart3, label: "Analytics", routeId: "report-designer" },
      { icon: Users, label: "Staff", routeId: "staff-management" },
      { icon: Settings2, label: "Setup", routeId: "company-setup" },
    ];

    return (
      <div className="fixed inset-0 z-[10000] flex h-screen w-screen overflow-hidden bg-[#f8f9ff] text-[#0d1c2e] font-sans select-none">
        <div className="flex h-full flex-1 flex-col bg-[#f8f9ff]">
          <header className="flex h-12 w-full shrink-0 items-center justify-between border-b border-[#c3c5d9] bg-white px-4 text-[#003ec7]">
            <div className="flex items-center gap-4">
              <h1 className="text-[16px] font-bold tracking-tight text-[#003ec7]">SM₹ITI Retail OS</h1>
              <nav className="hidden items-center gap-4 md:flex">
                {[
                  { label: 'Dashboard', routeId: 'dashboard' },
                  { label: 'Inventory', routeId: 'inventory' },
                  { label: 'Customers', routeId: 'customer-master' },
                  { label: 'Reports', routeId: 'report-designer' },
                ].map(({ label, routeId }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleStandaloneRoute(routeId)}
                    className="border-b-2 border-transparent text-[12px] text-[#434656] transition hover:border-[#c3c5d9] hover:text-[#003ec7]"
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative hidden lg:block">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737688]" />
                <input
                  type="text"
                  placeholder="Search items..."
                  className="w-56 rounded-lg border border-[#c3c5d9] bg-[#eff4ff] py-1 pl-7 pr-2 text-[13px] outline-none transition focus:border-[#003ec7] focus:ring-1 focus:ring-[#003ec7]"
                />
              </div>

              <div className="mr-1 flex items-center gap-1 border-r border-[#c3c5d9] pr-3">
                <button className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#d5e3fc]">
                  <History className="h-[18px] w-[18px] text-[#434656]" />
                </button>
                <button className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#d5e3fc]">
                  <Settings className="h-[18px] w-[18px] text-[#434656]" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg border border-[#c3c5d9] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#0d1c2e] transition hover:bg-[#eff4ff]"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => void handleStandaloneSaveOrder()}
                disabled={standaloneSaving || standaloneRows.length === 0}
                className="rounded-lg bg-[#003ec7] px-3 py-1 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#0038b6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {standaloneSaving ? "Saving..." : "Save"}
              </button>
              <div className="ml-1 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-[#c3c5d9] bg-[#eff4ff]">
                <img
                  alt="User profile"
                  className="h-full w-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDw7iKSsa2xjaRxfnIAq48U_FGEaD_STHEXy6nS31QBwugUVfrqR5mWwm93xABCH8WY8chvsxBSSYsrmmAVpzAW4N2yBTBUP_HXA7rXJFCi09PJXok6TrBjS41nRPaY4RnnTarS5rl4xcjeADJPAU25oVZYc8NJaE7326dOV7BCZNXkQN8l4oAlIq58Sb40o-e9eynWDAJDoWgUewUdut1Cg13DvFlrenniM5suR7s2O54d4OW70XIB"
                />
              </div>
            </div>
          </header>

          <main className="flex flex-1 flex-col gap-4 overflow-auto bg-[#f8f9ff] p-4">
            <div className="flex shrink-0 flex-col gap-4 rounded-xl border border-[#c3c5d9] bg-white p-4 shadow-sm">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <label className="w-20 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Doc Prefix</label>
                    <input className="w-32 rounded-lg border border-[#c3c5d9] bg-[#eff4ff] px-2 py-1.5 text-[13px] outline-none transition focus:border-[#003ec7] focus:ring-1 focus:ring-[#003ec7]" type="text" value="₹8" readOnly />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-12 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Date</label>
                    <input className="w-48 rounded-lg border border-[#c3c5d9] bg-[#eff4ff] px-2 py-1.5 text-[13px] outline-none transition focus:border-[#003ec7] focus:ring-1 focus:ring-[#003ec7]" type="text" value="10/27/2023 14:32" readOnly />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStandaloneRows([]);
                      setStandaloneScannerStatus("Ready");
                      setStandaloneScanValue("");
                    }}
                    className="flex items-center gap-1 rounded-lg border border-[#c3c5d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#003ec7] transition hover:bg-[#eff4ff]"
                  >
                    <Plus className="h-4 w-4" />
                    New Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportDialogOpen(true);
                      if (fileInputRef.current) fileInputRef.current.click();
                    }}
                    className="flex items-center gap-1 rounded-lg border border-[#c3c5d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#003ec7] transition hover:bg-[#eff4ff]"
                  >
                    <FileUp className="h-4 w-4" />
                    Import
                  </button>
                  <button
                    type="button"
                    onClick={handleStandaloneLogout}
                    className="flex items-center gap-1 rounded-lg border border-[#c3c5d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#434656] transition hover:bg-[#eff4ff]"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={handleStandaloneImportFile}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="flex w-full items-center gap-4 rounded-lg border border-[#d5e3fc] bg-[#f4f8ff] px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#003ec7] text-white">
                    <Search className="h-4 w-4" />
                  </div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Barcode Scanner</label>
                </div>
                <input
                  type="text"
                  value={standaloneScanValue}
                  onChange={(e) => setStandaloneScanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleStandaloneScanBarcode();
                    }
                  }}
                  placeholder="Scan or type barcode / stock no..."
                  className="flex-1 rounded-lg border border-[#c3c5d9] bg-white px-2 py-1.5 text-[13px] outline-none transition focus:border-[#003ec7] focus:ring-1 focus:ring-[#003ec7]"
                />
                <button
                  type="button"
                  onClick={() => void handleStandaloneScanBarcode()}
                  className="rounded-lg bg-[#006c4a] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#005137]"
                >
                  Scan
                </button>
                <span className="min-w-[110px] text-right text-[10px] font-semibold uppercase tracking-[0.05em] text-[#434656]">
                  {standaloneScannerStatus}
                </span>
              </div>

              <div className="flex w-full items-center gap-6">
                <div className="flex flex-1 items-center gap-2">
                  <label className="w-20 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Customer</label>
                  <div className="relative flex-1">
                    <UserRoundSearch className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737688]" />
                    <input
                      className="w-full rounded-lg border border-[#c3c5d9] bg-[#eff4ff] py-1.5 pl-7 pr-2 text-[13px] outline-none transition focus:border-[#003ec7] focus:ring-1 focus:ring-[#003ec7]"
                      type="text"
                      value={standaloneCustomerName}
                      onChange={(e) => {
                        setStandaloneCustomerName(e.target.value);
                        setStandaloneCustomerQuery(e.target.value);
                      }}
                      placeholder="Select or type customer"
                    />
                    {filteredStandaloneCustomers.length > 0 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-lg border border-[#c3c5d9] bg-white shadow-lg">
                        {filteredStandaloneCustomers.slice(0, 5).map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setStandaloneCustomerName(customer.name);
                              setStandaloneCustomerQuery(customer.name);
                            }}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] transition hover:bg-[#eff4ff]"
                          >
                            <span className="font-medium text-[#0d1c2e]">{customer.name}</span>
                            {customer.code && <span className="text-[#434656]">{customer.code}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex w-1/3 items-center gap-2">
                  <label className="w-24 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Sales Staff</label>
                  <select className="w-full rounded-lg border border-[#c3c5d9] bg-[#eff4ff] px-2 py-1.5 text-[13px] text-[#0d1c2e] outline-none transition focus:border-[#003ec7] focus:ring-1 focus:ring-[#003ec7]">
                    <option>SM</option>
                    <option>JD</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-xl border border-[#c3c5d9] bg-white shadow-sm">
              <div className="flex-1 overflow-auto bg-white">
                <table className="min-w-[800px] w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 border-b border-[#c3c5d9] bg-[#e6eeff] text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">
                    <tr>
                      {['S No.', 'Stock No', 'Item Description', 'Rate', 'Qty', 'Value', 'Disc Code', 'Disc Qty', 'Disc %', 'Disc Amt', 'Total', 'SalesStaff'].map((header) => (
                        <th key={header} className={`px-3 py-2 ${header === 'S No.' ? 'w-10 text-center' : header === 'Stock No' ? 'w-40' : header === 'Item Description' ? '' : header.includes('Rate') || header.includes('Qty') || header.includes('Value') || header.includes('Disc') || header.includes('Total') ? 'text-right' : ''}`}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c3c5d9]/30 text-[13px] text-[#0d1c2e]">
                    {standaloneRows.map((row) => (
                      <tr key={row.no} className="transition hover:bg-[#eff4ff]">
                        <td className="px-3 py-1.5 text-center text-[#434656]">{row.no}</td>
                        <td className="px-3 py-1.5">{row.stockNo}</td>
                        <td className="px-3 py-1.5">{row.description}</td>
                        <td className="px-3 py-1.5 text-right">{row.rate}</td>
                        <td className="px-3 py-1.5 text-right">{row.qty}</td>
                        <td className="px-3 py-1.5 text-right">{row.value}</td>
                        <td className="px-3 py-1.5"></td>
                        <td className="px-3 py-1.5 text-right"></td>
                        <td className="px-3 py-1.5 text-right"></td>
                        <td className="px-3 py-1.5 text-right"></td>
                        <td className="px-3 py-1.5 text-right font-medium">{row.total}</td>
                        <td className="px-3 py-1.5">{row.staff}</td>
                      </tr>
                    ))}
                    {standaloneRows.length === 0 && (
                      <tr>
                        <td colSpan={12} className="px-3 py-8 text-center text-[12px] text-[#434656]">
                          No live items loaded. Scan a barcode to add products.
                        </td>
                      </tr>
                    )}
                    {standaloneRows.length > 0 && [standaloneRows.length + 1, standaloneRows.length + 2, standaloneRows.length + 3].map((emptyRow) => (
                      <tr key={emptyRow} className="h-8">
                        <td className="px-3 py-1.5 text-center text-[#434656]">{emptyRow}</td>
                        <td colSpan={11}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-[#c3c5d9] bg-white shadow-sm">
              <div className="flex gap-6 p-4">
                <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4">
                  <div className="flex items-center gap-2">
                    <label className="w-28 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Import from</label>
                    <select className="flex-1 rounded-lg border border-[#c3c5d9] bg-[#eff4ff] px-2 py-1 text-[13px] outline-none shadow-sm">
                      <option></option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-16 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Path</label>
                    <input className="flex-1 rounded-lg border border-[#c3c5d9] bg-[#eff4ff] px-2 py-1 text-[13px] outline-none shadow-sm" type="text" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Field Template</label>
                    <select className="flex-1 rounded-lg border border-[#c3c5d9] bg-[#eff4ff] px-2 py-1 text-[13px] outline-none shadow-sm">
                      <option></option>
                    </select>
                  </div>
                  <div></div>

                  <fieldset className="relative col-span-2 mt-2 flex items-center gap-6 rounded-lg border border-[#c3c5d9] p-3 pt-4">
                    <legend className="-top-2 left-2 bg-white px-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Transaction</legend>
                    <div className="flex w-1/3 items-center gap-2">
                      <label className="w-12 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Type</label>
                      <select className="flex-1 rounded-lg border border-[#c3c5d9] bg-[#eff4ff] px-2 py-1 text-[13px] outline-none shadow-sm">
                        <option></option>
                      </select>
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <label className="w-20 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Bill Prefix</label>
                      <input className="w-24 rounded-lg border border-[#c3c5d9] bg-[#eff4ff] px-2 py-1 text-[13px] outline-none shadow-sm" type="text" />
                      <label className="ml-4 w-16 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Bill No.</label>
                      <input className="flex-1 rounded-lg border border-[#c3c5d9] bg-[#eff4ff] px-2 py-1 text-[13px] outline-none shadow-sm" type="text" />
                    </div>
                  </fieldset>
                </div>

                <div className="flex w-64 flex-col justify-end gap-2 border-l border-[#c3c5d9] pl-6">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStandaloneRows([])}
                      className="flex-1 rounded-lg border border-[#c3c5d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0d1c2e] transition hover:bg-[#eff4ff]"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStandaloneSaveOrder()}
                      disabled={standaloneSaving || standaloneRows.length === 0}
                      className="flex-1 rounded-lg bg-[#003ec7] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#0038b6] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {standaloneSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleStandaloneSaveOrder()}
                    disabled={standaloneSaving || standaloneRows.length === 0}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#006c4a] px-3 py-2 text-[12px] font-bold text-white transition hover:bg-[#005137] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-[18px] w-[18px]" />
                    {standaloneSaving ? "Saving..." : "Confirm Order"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-9 gap-1 divide-x divide-[#c3c5d9] rounded-b-xl border-t border-[#c3c5d9] bg-[#e6eeff] p-2 text-center">
                {[
                  { label: 'Total No. of Items', value: '3' },
                  { label: 'Total Qty.', value: '5.00' },
                  { label: 'Sales Value', value: '2555.00' },
                  { label: 'Item Level Discount', value: '0.00' },
                  { label: 'Bill Discount', value: '0.00' },
                  { label: 'Total Tax', value: '102.20' },
                  { label: 'Total Addons', value: '0.00' },
                  { label: 'Total Deductions', value: '0.00' },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col justify-center px-2">
                    <div className="mb-0.5 text-[10px] font-bold uppercase text-[#434656]">{item.label}</div>
                    <div className="font-mono text-[18px] font-bold text-[#0d1c2e]">{item.value}</div>
                  </div>
                ))}
                <div className="-my-2 flex flex-col justify-center border-l-2 border-[#003ec7]/20 bg-[#dde1ff] px-2 py-2">
                  <div className="mb-0.5 text-[11px] font-black uppercase text-[#003ec7]">Net Amount</div>
                  <div className="font-mono text-[20px] font-black text-[#003ec7]">
                    {standaloneRows.reduce((sum, row) => sum + Number(row.total || row.value || 0), 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </main>

          {importDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1c2e]/40 p-4 backdrop-blur-[1px]">
              <div className="w-full max-w-4xl rounded-2xl border border-[#c3c5d9] bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[18px] font-bold text-[#0d1c2e]">Import product file</h3>
                    <p className="text-[12px] text-[#434656]">CSV/TXT import with column mapping for Barcode, Qty, MRP, Disc Amt, and Disc %.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImportDialogOpen(false)}
                    className="rounded-lg border border-[#c3c5d9] px-2 py-1 text-[12px] font-semibold text-[#434656]"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  {[
                    { key: "barcode", label: "Barcode" },
                    { key: "qty", label: "Qty" },
                    { key: "mrp", label: "MRP" },
                    { key: "discAmt", label: "Disc Amt" },
                    { key: "discPct", label: "Disc %" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">
                      {label}
                      <select
                        value={importFieldMap[key as "barcode" | "qty" | "mrp" | "discAmt" | "discPct"]}
                        onChange={(e) => setImportFieldMap((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="rounded-lg border border-[#c3c5d9] bg-[#eff4ff] px-2 py-1.5 text-[12px] text-[#0d1c2e] outline-none"
                      >
                        <option value="">Select column</option>
                        {importHeaders.map((header) => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-[#c3c5d9]">
                  <div className="max-h-64 overflow-auto">
                    <table className="min-w-full border-collapse text-left text-[12px]">
                      <thead className="bg-[#e6eeff] text-[#434656]">
                        <tr>
                          {importHeaders.map((header) => (
                            <th key={header} className="border-b border-[#c3c5d9] px-2 py-2 font-semibold uppercase tracking-[0.05em]">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreviewRows.slice(0, 5).map((row, idx) => (
                          <tr key={`${idx}-${Object.values(row).join('-')}`} className="border-b border-[#c3c5d9] last:border-b-0">
                            {importHeaders.map((header) => (
                              <td key={`${idx}-${header}`} className="px-2 py-2 text-[#0d1c2e]">{row[header] || ""}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setImportDialogOpen(false)}
                    className="rounded-lg border border-[#c3c5d9] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0d1c2e]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApplyImportedRows()}
                    className="rounded-lg bg-[#003ec7] px-3 py-1.5 text-[12px] font-semibold text-white"
                  >
                    Import items
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!standaloneTab) return null;

  const tabMeta = registeredWorkspaces.find((w) => w.id === standaloneTab);
  const title = tabMeta ? tabMeta.label : standaloneTab;
  const icon = tabMeta ? tabMeta.icon : "description";
  const isStandaloneFullscreen = new URLSearchParams(window.location.search).get("fullscreen") === "1";

  useEffect(() => {
    if (!isStandaloneFullscreen) return;
    const request = () => {
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      } catch {
        // Ignore if fullscreen request is blocked.
      }
    };
    const timer = window.setTimeout(request, 200);
    return () => window.clearTimeout(timer);
  }, [isStandaloneFullscreen]);

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col overflow-hidden bg-theme-base text-theme-body font-sans select-none">
      <div className="h-10 px-4 bg-theme-surface-1 border-b border-theme-divider flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className="material-symbols-outlined text-indigo-500 text-lg shrink-0">{icon}</span>
          <span className="text-xs font-bold text-theme-text-primary tracking-wide truncate">{title}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20 shrink-0">
            Isolated Window
          </span>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              const hasFullscreen = params.get("fullscreen") === "1";
              if (hasFullscreen) {
                params.delete("fullscreen");
              } else {
                params.set("fullscreen", "1");
              }
              const nextUrl = `${window.location.pathname}?${params.toString()}`;
              window.location.href = nextUrl;
            }}
            className="px-2.5 py-1 rounded text-[11px] font-bold bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-divider transition-all cursor-pointer"
            title={isStandaloneFullscreen ? "Exit Fullscreen" : "Open in Fullscreen"}
          >
            {isStandaloneFullscreen ? "Exit Fullscreen" : "Full Screen"}
          </button>
          <button
            onClick={() => {
              window.location.href = window.location.origin + window.location.pathname;
            }}
            className="px-2.5 py-1 rounded text-[11px] font-bold bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-divider transition-all cursor-pointer"
            title="Return to Main Application Workspace Shell"
          >
            Dock Back
          </button>
          <button
            onClick={() => window.close()}
            className="p-1.5 rounded hover:bg-rose-500/10 text-theme-muted hover:text-rose-400 transition-colors cursor-pointer"
            title="Close Standalone Window"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 relative">
        {renderTabSafe(standaloneTab)}
      </div>
    </div>
  );
};

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

const AppContent: React.FC = () => {
  const toastIdRef = useRef(0);
  const { preferences, addToRecentlyUsed, registeredWorkspaces } = useLayoutEngine();
  useLayoutModuleRegistration();
  const { globalZoom, popOutTab } = useWorkspace();
  const { addNotification: addSystemNotification } = useNotifications();
  
  const [currentUser, setCurrentUser] = useState<{ role: string; name: string; passwordResetRequired?: boolean; companyId?: string; branchId?: string } | null>(null);
  const [companyContextResolved, setCompanyContextResolved] = useState<boolean>(() => {
    return Boolean(localStorage.getItem("smriti_company_id") && localStorage.getItem("smriti_jwt_token"));
  });
  const [checkingAuth, setCheckingAuth] = useState(true);
  const standaloneVendorReturn = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("standalone_vendor_return") === "1";

  const checkAuth = async () => {
    const token = localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token");
    if (!token) {
      setCurrentUser(null);
      setCompanyContextResolved(false);
      setCheckingAuth(false);
      return;
    }
    try {
      // Migrated: GET /api/auth/me (Express session) → GET /api/v1/auth/me (FastAPI JWT)
      const data = await apiFetchV1("/auth/me");
      if (data) {
        const normalizedCompanyId = normalizeCompanyId(data.company_id ?? localStorage.getItem("smriti_company_id"));
        const normalizedBranchId = normalizeBranchId(data.branch_id ?? localStorage.getItem("smriti_branch_id"));

        if (data.company_id) {
          persistTenantContext({
            companyId: data.company_id,
            companyCode: data.company_code ?? localStorage.getItem("smriti_company_code"),
            branchId: data.branch_id ?? localStorage.getItem("smriti_branch_id"),
            branchCode: data.branch_code ?? localStorage.getItem("smriti_branch_code"),
            companyName: data.company_name ?? localStorage.getItem("smriti_company_name"),
            branchName: data.branch_name ?? localStorage.getItem("smriti_branch_name"),
          });
        }

        setCurrentUser({
          role: data.role ?? "",
          name: data.display_name || data.full_name || data.username || "",
          companyId: normalizedCompanyId,
          branchId: normalizedBranchId,
          passwordResetRequired: data.password_reset_required ?? false,
        });
        setCompanyContextResolved(Boolean(normalizedCompanyId && normalizedBranchId && localStorage.getItem("smriti_company_id") && localStorage.getItem("smriti_branch_id")));
      } else {
        setCurrentUser(null);
        setCompanyContextResolved(false);
      }
    } catch {
      // apiFetchV1 throws on non-2xx (e.g. 401 expired) — clear token and treat as unauthenticated
      clearAuthSession("auth_check_failed");
      setCurrentUser(null);
      setCompanyContextResolved(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLoginSuccess = (user: { role: string; name: string; passwordResetRequired?: boolean; companyId?: string; branchId?: string }) => {
    setCurrentUser(user);
    setCompanyContextResolved(false);
  };

  const handleLogout = () => {
    clearAuthSession("manual_logout");
    setCurrentUser(null);
    setCompanyContextResolved(false);
  };



  useEffect(() => {
    if (!currentUser) return;
    import("./services/customerStore.js").then((m) => {
      m.syncCustomersWithBackend();
    });
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && !currentUser.passwordResetRequired) {
      refreshSetupStatus();
    }
  }, [currentUser]);

  // isSetupCompleted: null = checking, true = done, false = no company yet.
  // IMPORTANT: This flag NEVER auto-routes to the Setup Wizard.
  // The wizard is ONLY accessible via an explicit "Create New Company" action
  // (navigating to the company-setup tab intentionally).
  const [isSetupCompleted, setIsSetupCompleted] = useState<boolean | null>(null);

  const markSetupCompleted = () => {
    setIsSetupCompleted(true);
    if (preferences.lastWorkspace === "company-setup") {
      addToRecentlyUsed("dashboard");
    }
  };

  const refreshSetupStatus = async () => {
    try {
      const data = await apiFetchV1("/setup-status");
      setIsSetupCompleted(Boolean(data?.setupCompleted));
    } catch (error) {
      console.warn("Unable to refresh setup completion status:", error);
      // On error default to true — do NOT show wizard on connectivity failure.
      setIsSetupCompleted(true);
    }
  };

  // Active tab resolution — company-setup is only valid when navigated to explicitly.
  // Never resolve company-setup as the default landing tab from startup.
  const safeLastWorkspace =
    preferences.lastWorkspace === "company-setup"
      ? "dashboard"
      : preferences.lastWorkspace;

  const [activeTab, setActiveTabState] = useState(safeLastWorkspace || "dashboard");

  useEffect(() => {
    setActiveTabState(safeLastWorkspace || "dashboard");
  }, [safeLastWorkspace]);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    addToRecentlyUsed(tab);
  };

  useEffect(() => {
    if (preferences.lastWorkspace === "company-setup") {
      addToRecentlyUsed("dashboard");
    }
  }, [preferences.lastWorkspace, addToRecentlyUsed]);

  const [products, setProducts] = useState<Product[]>([]);
  const [profiles, setProfiles] = useState<POSProfile[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [psvParties, setPsvParties] = useState<PSVParty[]>([]);
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);

  // Print Preview Dialog State
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("print") === "true";
    } catch {
      return false;
    }
  });

  // Custom global event and keyboard shortcuts listeners for print preview
  useEffect(() => {
    const handleOpenPrintPreview = () => {
      setIsPrintPreviewOpen(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Directs Ctrl+P or Alt+P to custom preview modal
      if ((e.ctrlKey && e.key === "p") || (e.altKey && e.key === "p")) {
        e.preventDefault();
        setIsPrintPreviewOpen(true);
      }
    };

    window.addEventListener("smriti_open_print_preview", handleOpenPrintPreview);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("smriti_open_print_preview", handleOpenPrintPreview);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = (
    title: string,
    message: string,
    type: "success" | "error" | "info" | "warning" = "success",
  ) => {
    toastIdRef.current += 1;
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 10);
    const cleanMsg = message.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 10);
    const id = `toast-${toastIdRef.current}-${cleanTitle}-${cleanMsg}`;
    setNotifications((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);

    // Also add to the global notification system so it appears in real-time feeds
    addSystemNotification({
      title,
      message,
      type: "activity",
      priority: "low",
    });
  };

  useEffect(() => {
    registerAllDefaultActions((n: any) => {
      addNotification(n.title, n.message, n.type === "alert" || n.type === "error" ? "error" : "success");
    });
  }, []);

  // Fetch initial system state
  const fetchSystemState = async () => {
    try {
      // Migrated: /pos/registers/ → /pos/profiles/ (returns camelCase POSProfileResponse)
      // Migrated: /pos/shifts/ (FastAPI list endpoint — v3.22.0, replaces broken Express stub)
      const [profData, shiftsData] = await Promise.all([
        apiFetchV1("/pos/profiles/"),
        apiFetchV1("/pos/shifts/").catch(() => []),  // graceful fallback if no shifts yet
      ]);

      if (Array.isArray(profData)) setProfiles(profData);
      if (Array.isArray(shiftsData)) setShifts(shiftsData);

      // Legacy Express placeholder routes are currently not implemented on the backend.
      // Avoid calling them here so the page does not produce auth/501 errors during startup.
      setFields([]);
      setFormulas([]);
      setPsvParties([]);

      // Fetch products from FastAPI backend
      try {
        const prodData = await apiFetchV1("/inventory/?page=1&page_size=100");
        const rawList = Array.isArray(prodData) ? prodData : (Array.isArray(prodData?.items) ? prodData.items : []);
        const mappedProducts = rawList.map((p: any) => {
          const secBarcodes = Array.isArray(p.secondary_barcodes) ? p.secondary_barcodes : [];
          return {
            id: p.id,
            code: p.code,
            name: p.name,
            price: parseFloat(p.price || 0),
            stock: Number(p.stock || 0),
            category: p.category,
            isFavorite: Boolean(p.is_favorite),
            barcode: p.barcode,
            secondaryBarcodes: secBarcodes,
            barcodes: [
              { type: "Code128", value: p.barcode, isPrimary: true },
              ...secBarcodes.map((val: string) => ({ type: "Code128", value: val, isPrimary: false }))
            ],
            brand: p.brand,
            color: p.color,
            size: p.size,
            mrp: p.mrp ? parseFloat(p.mrp) : undefined,
            gstPercentage: p.gst_percentage ? parseFloat(p.gst_percentage) : 18,
            styleCode: p.style_code,
            costPrice: p.cost_price ? parseFloat(p.cost_price) : 0,
            sku: p.sku,
            hsnCode: p.hsn_code,
            attributes: p.attributes || {},
            pricingMode: p.pricing_mode,
            trackingMode: p.tracking_mode,
            variantTemplateId: p.variant_template_id,
            weightGrams: p.weight_grams ? parseFloat(p.weight_grams) : 0
          };
        });
        setProducts(mappedProducts);
      } catch (err) {
        console.error("Failed to load products from FastAPI:", err);
      }

      try {
        const psvData = await apiFetchV1("/psv/parties");
        if (Array.isArray(psvData)) {
          setPsvParties(psvData);
        }
      } catch (err) {
        console.error("Failed to load PSV parties from FastAPI:", err);
      }
    } catch (error) {
      console.error("Critical error syncing system data:", error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchSystemState();
    }
  }, [currentUser]);

  useEffect(() => {
    const handlePopoutEvent = () => {
      const tabConfig = registeredWorkspaces.find((w) => w.id === activeTab);
      const title = tabConfig ? tabConfig.label : "Workspace Document";
      const icon = tabConfig ? tabConfig.icon : "description";
      popOutTab(activeTab, title, icon);
    };
    window.addEventListener("smriti_popout_current_tab", handlePopoutEvent);
    return () => {
      window.removeEventListener("smriti_popout_current_tab", handlePopoutEvent);
    };
  }, [activeTab, registeredWorkspaces, popOutTab]);

  const mapModuleId = (id: string): string => {
    const map: Record<string, string> = {
      launchpad: "launchpad",
      item_master: "item-master",
      inventory: "stock-ledger",
      suppliers: "supplier-mgmt",
      reports: "report-designer",
      dev_tracker: "dev-tracker",
      system: "masters",
      settings: "profiles",
      about: "about-smriti",
      grn: "purchase",
      "menu-manager": "menu-manager",
      menu_manager: "menu-manager",
      menu_studio: "menu-manager",
      "menu-studio": "menu-manager",
      "day-close": "day-close",
      day_close: "day-close",
      "day-end": "day-close",
      day_end: "day-close",
      "eod-report": "day-close",
      security: "security-management",
      security_management: "security-management",
      menu_access: "security-management",
      "menu-dashboard": "dashboard",
      "menu-user-profile": "user-profile",
      "menu-pos": "pos",
      "menu-sales": "sales",
      "menu-customer-master": "customer-master",
      "menu-crm": "crm",
      "menu-loyalty": "loyalty",
      "menu-inventory": "inventory",
      "menu-item-master": "item-master",
      "menu-barcode": "barcode",
      "menu-stock-ledger": "stock-ledger",
      "menu-purchase": "purchase",
      "menu-supplier-mgmt": "supplier-mgmt",
      "menu-business-ledger": "business-ledger",
      "menu-accounting-sync": "accounting-sync",
      "menu-reports": "report-designer",
      "menu-report-designer": "report-designer",
      "menu-masters": "masters",
      "menu-ufe": "ufe",
      "menu-formulas": "formulas",
      "menu-psv": "psv",
      "menu-document-series": "document-series",
      "menu-print-studio": "print-studio",
      "menu-print-history": "print-history",
      "menu-terms-engine": "terms-engine",
      "menu-data-exchange": "data-exchange",
      "menu-staff-management": "staff-management",
      "menu-approval-matrix": "approval-matrix",
      "menu-company-setup": "company-setup",
      "menu-audit-logs": "audit-logs",
    };
    return map[id] || id;
  };

  useEffect(() => {
    const handleMenuSearchNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ moduleId?: string; searchQuery?: string }>).detail;
      const moduleId = detail?.moduleId;
      if (moduleId === "stock-ledger" && detail?.searchQuery) {
        sessionStorage.setItem("smriti_stock_ledger_search", detail.searchQuery);
      }
      if (moduleId) setActiveTab(mapModuleId(moduleId));
    };
    window.addEventListener("smriti_navigate_module", handleMenuSearchNavigation);
    return () => window.removeEventListener("smriti_navigate_module", handleMenuSearchNavigation);
  }, []);

  const renderTab = (tabId: string) => {
    switch (tabId) {
      case "dashboard":
        return (
          <DashboardTab
            products={products}
            formulas={formulas}
            psvParties={psvParties}
            onSelectFormula={(formula) => setSelectedFormula(formula)}
          />
        );
      case "launchpad":
        return (
          <FioriLaunchpad
            currentUser={currentUser}
            onSelectModule={(modId) => {
              setActiveTab(mapModuleId(modId));
            }}
          />
        );
      case "pos":
        return (
          <PosTerminalTab
            products={products}
            profiles={profiles}
            shifts={shifts}
            onRefreshData={fetchSystemState}
            onNotification={addNotification}
          />
        );
      case "day-close":
      case "day-end":
      case "eod-report":
        return (
          <PosTerminalTab
            products={products}
            profiles={profiles}
            shifts={shifts}
            onRefreshData={fetchSystemState}
            onNotification={addNotification}
            initialTab="EOD_Z_REPORT"
          />
        );
      case "crm":
        return <CrmStudioTab currentUser={currentUser} />;
      case "customer-master":
        return <CustomerMasterTab currentUser={currentUser} />;
      case "loyalty":
        return <LoyaltyStudioTab currentUser={currentUser} />;
      case "staff-management":
        return <StaffManagementTab currentUser={currentUser} />;
      case "user-profile":
        return <UserProfileTab />;
      case "ufe":
        return <FieldExplorerTab fields={fields} />;
      case "formulas":
        return (
          <FormulaRegistryTab
            formulas={formulas}
            onSelectFormula={(f) => setSelectedFormula(f)}
          />
        );
      case "psv":
        return <PsvTab psvParties={psvParties} currentUser={currentUser} />;
      case "sales":
        return (
          <SalesStudioTab
            products={products}
            onNotification={addNotification}
            currentUser={currentUser}
          />
        );
      case "create-tax-invoice":
        return (
          <PosTerminalTab
            products={products}
            profiles={profiles}
            shifts={shifts}
            onRefreshData={fetchSystemState}
            onNotification={addNotification}
          />
        );
      case "purchase":
        return (
          <PurchaseStudioTab
            products={products}
            onRefreshProducts={fetchSystemState}
            onNotification={addNotification}
            currentUser={currentUser}
          />
        );
      case "supplier-mgmt":
        return <SupplierDashboardTab currentUser={currentUser} />;
      case "report-designer":
        return <ReportDesignerTab currentUser={currentUser} />;
      case "item-master":
        return (
          <ItemMasterTab
            products={products}
            onRefreshProducts={fetchSystemState}
            onNotification={addNotification}
            currentUser={currentUser}
            initialSubTab="registry"
          />
        );
      case "item-create-grid":
        return (
          <ItemMasterTab
            products={products}
            onRefreshProducts={fetchSystemState}
            onNotification={addNotification}
            currentUser={currentUser}
            initialSubTab="excel-grid"
          />
        );
      case "profiles":
        return (
          <PosProfilesTab
            profiles={profiles}
            onRefreshData={fetchSystemState}
            onNotification={addNotification}
          />
        );
      case "wiki":
        return <WikiTab onNotification={addNotification} />;
      case "barcode":
        return (
          <BarcodeStudioTab
            currentUser={currentUser}
            products={products}
            onNotification={addNotification}
          />
        );
      case "masters":
        return <MasterManagementTab onNotification={addNotification} />;
      case "document-series":
        return <DocumentSeriesTab />;
      case "approval-matrix":
        return <ApprovalMatrixTab />;
      case "print-studio":
        return <PrintStudioTab />;
      case "print-history":
        return <PrintHistoryTab />;
      case "about-smriti":
        return <AboutSmritiTab />;
      case "tax-invoice":
      case "distributor-tax-invoice":
      case "tax-invoice-workspace":
        return (
          <DistTaxInvoice
            onNotification={addNotification}
            currentUser={currentUser}
          />
        );
      case "tax-invoice-print":
      case "statutory-a4":
        return <TaxInvoicePrintPage />;
      case "training-academy":
        return <TrainingAcademyTab />;
      case "dev-tracker":
        return <DevTrackerTab />;
      case "accounting-sync":
        return <AccountingSyncTab />;
      case "business-ledger":
        return <BusinessLedgerTab currentUser={currentUser} />;
      case "stock-ledger":
        return <StockLedgerTab currentUser={currentUser} />;
      case "audit-logs":
        return <AuditLogsTab />;
      case "terms-engine":
        return <TermsEngineTab />;
      case "data-exchange":
        return <DataExchangeTab onNotification={addNotification} />;
      case "database-manager":
        return <DatabaseManagerTab onNotification={addNotification} />;
      case "legacy-migration":
        return <LegacyMigDashTab />;

      case "physical-stock":
      case "stock-count":
      case "physical-inventory":
        return <PhysicalStockTab />;

      case "store-policies":
      case "governed-policies":
      case "policy-studio":
        return <StorePolicyStudio />;


      case "wms":
      case "wms-dashboard":
      case "stock-transfers":
      case "warehouse-management":
        return <WmsStudioTab currentUser={currentUser} onNotification={addNotification} />;
      case "company-setup":
        return (
          <SetupWizardTab 
            onComplete={() => {
              markSetupCompleted();
              addNotification("Setup Complete", "Welcome to SMRITI Retail OS dashboard!", "success");
              setActiveTab("dashboard");
            }} 
          />
        );
      case "menu-manager":
      case "menu-studio":
        return <MenuManagerStudioTab currentUser={currentUser} onNavigateTab={(t) => setActiveTab(t)} />;
      case "security-management":
      case "menu-access-control":
        return (
          <div className="w-full h-full flex items-center justify-center p-2">
            <SecManageDlg
              isOpen={true}
              onClose={() => setActiveTab("dashboard")}
              initialTab="Manage Menu Access"
            />
          </div>
        );
      case "security-configuration":
        return (
          <div className="w-full h-full flex items-center justify-center p-2">
            <SecManageDlg
              isOpen={true}
              onClose={() => setActiveTab("dashboard")}
              initialTab="Configuration"
            />
          </div>
        );
      default:
        return <div className="p-4 text-theme-muted font-mono text-xs">Tab {tabId} not found.</div>;
    }
  };

  // Wrap tab render in SmritiErrorBoundary to isolate module crashes, and Suspense for lazy-loaded modules
  const renderTabSafe = (tabId: string) => (
    <SmritiErrorBoundary key={tabId} tabId={tabId} onNotification={addNotification}>
      <Suspense fallback={<TabLoadingFallback />}>
        {renderTab(tabId)}
      </Suspense>
    </SmritiErrorBoundary>
  );

  if (standaloneVendorReturn) {
    return (
      <VendorReturnModal
        isOpen={true}
        onClose={() => {
          const params = new URLSearchParams(window.location.search);
          params.delete("standalone_vendor_return");
          const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
          window.location.href = nextUrl;
        }}
        onNotification={(title, message, type) => {
          addNotification(title, message, type);
        }}
      />
    );
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-theme-base text-theme-primary">
        <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center font-bold text-lg text-white border border-theme-divider shadow-lg animate-pulse">
          S
        </div>
        <p className="mt-4 text-[10px] font-mono text-theme-muted tracking-widest uppercase">
          Verifying Operator Authorization...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentUser.passwordResetRequired) {
    return (
      <PasswordReset
        onResetSuccess={() => {
          setCurrentUser((prev) => prev ? { ...prev, passwordResetRequired: false } : prev);
        }}
      />
    );
  }

  if (currentUser && !companyContextResolved) {
    return (
      <CompanySelectionScreen
        currentUser={currentUser}
        onCompanySelected={(ctx) => {
          setCurrentUser((prev) => prev ? { ...prev, companyId: ctx.companyId, branchId: ctx.branchId } : prev);
          setCompanyContextResolved(true);
          fetchSystemState();
        }}
        onLogout={handleLogout}
      />
    );
  }

  if (currentUser && isSetupCompleted === null) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-theme-base text-theme-primary">
        <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center font-bold text-lg text-white border border-theme-divider shadow-lg animate-pulse">
          S
        </div>
        <p className="mt-4 text-[10px] font-mono text-theme-muted tracking-widest uppercase">
          Verifying initialization state...
        </p>
      </div>
    );
  }


  // ROUTING BOUNDARY: If isSetupCompleted is false, the workspace has no configured company.
  // Do NOT auto-open the Setup Wizard — show a controlled empty state instead.
  // The wizard is only entered via an explicit "Create New Company" action (setActiveTab("company-setup")).
  // This block is intentionally removed: the full-screen wizard override is PROHIBITED on startup.

  const getTabLabel = (id: string): string => {
    const tabMeta = registeredWorkspaces.find((w) => w.id === id);
    if (tabMeta) return tabMeta.label;
    if (id === "dashboard" || id === "launchpad") return "Fiori Launchpad";
    return id.replace(/-/g, " ").toUpperCase();
  };

  return (
    <AppShell
      activeModuleId={activeTab}
      activeModuleTitle={getTabLabel(activeTab)}
      onSelectModule={(id) => setActiveTab(mapModuleId(id))}
      onNavigateHome={() => {
        addToRecentlyUsed("dashboard");
        setActiveTab("dashboard");
      }}
      onLogout={handleLogout}
      userName={currentUser?.name || "Operator"}
      userRole={currentUser?.role || "Operator"}
    >
      <div className="relative w-full h-full">
      {/* Toast Notification Stack */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto p-4 rounded-xl shadow-2xl border flex items-start space-x-3 max-w-sm backdrop-blur ${
                n.type === "success"
                  ? "bg-emerald-950 bg-opacity-95 border-emerald-500 text-emerald-200"
                  : "bg-rose-950 bg-opacity-95 border-rose-500 text-rose-200"
              }`}
            >
              <span className="material-symbols-outlined mt-0.5">
                {n.type === "success" ? "check_circle" : "error"}
              </span>
              <div>
                <h5 className="font-bold text-xs uppercase tracking-wide font-display">
                  {n.title}
                </h5>
                <p className="text-[11px] mt-0.5 leading-relaxed opacity-90">
                  {n.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <StandaloneWindowView registeredWorkspaces={registeredWorkspaces} renderTabSafe={renderTabSafe} />

      {/* Authoritative Single Application Workspace Canvas */}
      <div className="flex-1 flex flex-col h-full w-full min-w-0 max-w-full overflow-hidden relative">
        <DrillDownBreadcrumbs />
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 min-w-0 max-w-full relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full min-w-0 max-w-full"
              style={{
                transform: `scale(${globalZoom})`,
                transformOrigin: "top left",
                width: `${100 / globalZoom}%`,
                height: `${100 / globalZoom}%`,
              }}
            >
              {renderTabSafe(activeTab)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Workspace Windows Host */}
      <FloatingWindowHost renderTab={(id) => renderTabSafe(id)} />

      {/* Formula Explanation drawer portal overlay */}
      <ExplainModal
        formula={selectedFormula}
        onClose={() => setSelectedFormula(null)}
      />

      {/* SMRITI Global Interactive Print Preview Engine Modal — conditional mount only when active */}
      {isPrintPreviewOpen && (
        <PrintPreviewModal
          isOpen={isPrintPreviewOpen}
          onClose={() => setIsPrintPreviewOpen(false)}
          activeTabId={activeTab}
        />
      )}
    </div>
    </AppShell>
  );
};

const App: React.FC = () => {
  return (
    <PrintProvider>
      <NotificationProvider>
        <DrillDownProvider>
          <ActiveFieldProvider>
            <LayoutEngineProvider>
              <WorkspaceProvider>
                <ShortcutProvider>
                  <ContextProvider>
                    <AppContent />
                    <ContextRenderer />
                    <GlobalSearch />
                    <GlobalF2BrowseModal />
                    <ContextualInspectorHUD />
                    <DrillDownSidePanel />
                    <ShortcutPalette />
                  </ContextProvider>
                </ShortcutProvider>
              </WorkspaceProvider>
            </LayoutEngineProvider>
          </ActiveFieldProvider>
        </DrillDownProvider>
      </NotificationProvider>
    </PrintProvider>
  );
};

export default App;
