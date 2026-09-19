/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.28.0
 * Created      : 2026-09-16
 * Modified     : 2026-09-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState, useEffect, useRef } from "react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import { clearAuthSession } from "../../lib/apiFetchV1.ts";
import {
  ReceiptText,
  Boxes,
  BarChart3,
  Users,
  Settings2,
  Search,
  History,
  Settings,
  CheckCircle2,
  X,
  FileUp,
  Plus,
  LogOut,
  UserRoundSearch,
} from "lucide-react";
import {
  normalizeUniversalImport,
  UNIVERSAL_IMPORT_TEMPLATES,
  type UniversalImportInputRow,
} from "../../services/universalImportEngine.ts";

export interface StandaloneWindowViewProps {
  registeredWorkspaces: Array<{ id: string; label: string; icon: string }>;
  renderTabSafe: (id: string) => React.ReactNode;
}

export const StandaloneWindowView: React.FC<StandaloneWindowViewProps> = ({
  registeredWorkspaces,
  renderTabSafe,
}) => {
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
  const [importResolution, setImportResolution] = useState<{
    counts: { total: number; matched: number; ambiguous: number; not_found: number };
    rows: Array<{
      row_number: number;
      status: string;
      match?: {
        item_id?: string;
        variant_id?: string;
        item_name?: string;
        item_code?: string;
        variant_sku?: string;
        selling_price?: number;
        mrp?: number;
        barcode?: string;
      };
      candidates?: Array<{
        item_name?: string;
        item_code?: string;
        variant_sku?: string;
        selling_price?: number;
        mrp?: number;
        barcode?: string;
      }>;
    }>;
  } | null>(null);
  const [importTemplateId, setImportTemplateId] = useState("BARCODE_QTY");
  const [importTarget, setImportTarget] = useState<"SALES_ORDER" | "ITEM_MASTER" | "PRICE_BOOK" | "PURCHASE_INWARD" | "STOCK_ADJUSTMENT" | "SALES_RETURN" | "LABEL_PRINT">("SALES_ORDER");
  const [importCommitFields, setImportCommitFields] = useState({
    priceBookId: "",
    supplierId: "",
    warehouseId: "",
    reason: "",
    originalInvoiceId: "",
    returnNo: "",
  });
  const [importFieldMap, setImportFieldMap] = useState<Record<"barcode" | "sku" | "styleArticle" | "name" | "size" | "color" | "brand" | "qty" | "mrp" | "sellingPrice" | "costPrice" | "discAmt" | "discPct", string>>({
    barcode: "",
    sku: "",
    styleArticle: "",
    name: "",
    size: "",
    color: "",
    brand: "",
    qty: "",
    mrp: "",
    sellingPrice: "",
    costPrice: "",
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
      sku: ["sku", "sku code", "variant sku", "stock no", "stockno"],
      styleArticle: ["style", "style no", "style code", "article", "article no", "style article"],
      name: ["name", "item name", "product name", "description", "item description"],
      size: ["size", "size name", "waist"],
      color: ["color", "colour", "shade", "colorway"],
      brand: ["brand", "brand name", "manufacturer", "make"],
      qty: ["qty", "quantity", "qnty", "qty sold", "sales qty"],
      mrp: ["mrp", "rate", "selling price", "sale price", "price", "unit price"],
      sellingPrice: ["selling price", "sale price", "unit selling price", "sell price"],
      costPrice: ["cost price", "buying price", "purchase price", "cost"],
      discAmt: ["disc amt", "discount amount", "discount amt", "disc amount", "amount discount", "discount"],
      discPct: ["disc %", "disc pct", "discount %", "discount pct", "discount percent", "discpercent"],
    };

    const nextMap: Record<"barcode" | "sku" | "styleArticle" | "name" | "size" | "color" | "brand" | "qty" | "mrp" | "sellingPrice" | "costPrice" | "discAmt" | "discPct", string> = {
      barcode: "",
      sku: "",
      styleArticle: "",
      name: "",
      size: "",
      color: "",
      brand: "",
      qty: "",
      mrp: "",
      sellingPrice: "",
      costPrice: "",
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
    const headerRowIndex = parsedRows.some((row) => row.some((cell) => /barcode|sku|style|article|size|color|colour|brand|qty|quantity|mrp|price|discount|disc/i.test(cell))) ? 0 : -1;

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

  const addImportedLineToSalesOrder = async (row: Record<string, string>, resolvedProduct?: any) => {
    const barcode = row[importFieldMap.barcode] || "";
    const quantity = Number(row[importFieldMap.qty] || "1");
    const mrp = Number(row[importFieldMap.mrp] || "0");
    const discAmt = Number(row[importFieldMap.discAmt] || "0");
    const discPct = Number(row[importFieldMap.discPct] || "0");

    if (!barcode) return;

    try {
      let product = resolvedProduct;
      if (!product) {
        const data = await apiFetchV1("/products/search", {
          params: { q: barcode, limit: 10 },
        });
        const productList = Array.isArray(data) ? data : data?.data || [];
        product = productList.find((item: any) =>
          String(item.barcode || "").toLowerCase() === String(barcode).toLowerCase() ||
          String(item.code || "").toLowerCase() === String(barcode).toLowerCase() ||
          String(item.sku || "").toLowerCase() === String(barcode).toLowerCase()
        ) || productList[0];
      }

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
        description: String(product.name || product.item_name || product.description || "Product"),
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

  const isAuditBillingMode = true;

  const handleStandaloneScanBarcode = async () => {
    if (isAuditBillingMode) {
      setStandaloneScannerStatus("Audit view only");
      return;
    }

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
    if (isAuditBillingMode) {
      event.target.value = "";
      setStandaloneScannerStatus("Audit view only");
      return;
    }

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
    setImportResolution(null);
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

    const inputRows: UniversalImportInputRow[] = importPreviewRows.map((row, index) => ({
      rowNumber: index + 2,
      barcode: importFieldMap.barcode ? row[importFieldMap.barcode] : undefined,
      sku: importFieldMap.sku ? row[importFieldMap.sku] : undefined,
      styleArticle: importFieldMap.styleArticle ? row[importFieldMap.styleArticle] : undefined,
      name: importFieldMap.name ? row[importFieldMap.name] : undefined,
      size: importFieldMap.size ? row[importFieldMap.size] : undefined,
      color: importFieldMap.color ? row[importFieldMap.color] : undefined,
      brand: importFieldMap.brand ? row[importFieldMap.brand] : undefined,
      quantity: importFieldMap.qty ? row[importFieldMap.qty] : undefined,
      mrp: importFieldMap.mrp ? row[importFieldMap.mrp] : undefined,
      sellingPrice: importFieldMap.sellingPrice ? row[importFieldMap.sellingPrice] : undefined,
      costPrice: importFieldMap.costPrice ? row[importFieldMap.costPrice] : undefined,
    }));
    const normalized = normalizeUniversalImport(inputRows, importTarget);
    if (normalized.issues.length > 0) {
      setStandaloneScannerStatus(`${normalized.issues.length} row(s) need correction`);
      return;
    }

    const hasCompleteResolution = Boolean(
      importResolution &&
      importResolution.rows.length === inputRows.length &&
      importResolution.rows.every((row) => row.status === "MATCHED"),
    );

    if (!hasCompleteResolution) {
      try {
        const preview = await apiFetchV1("/import/preview", {
          method: "POST",
          body: {
            target: importTarget,
            rows: inputRows,
          },
        });
        setImportResolution(preview);
        const unresolved = importTarget === "ITEM_MASTER"
          ? Number(preview?.counts?.ambiguous || 0)
          : Number(preview?.counts?.not_found || 0) + Number(preview?.counts?.ambiguous || 0);
        if (unresolved > 0) {
          setStandaloneScannerStatus(`${unresolved} row(s) need product matching`);
          return;
        }
      } catch (error: any) {
        console.error("Universal import preview failed:", error);
        setImportResolution(null);
        setStandaloneScannerStatus(error?.message || "Import preview failed");
        return;
      }
    }

    if (importTarget !== "SALES_ORDER") {
      try {
        const commitRows = inputRows.map((row, index) => {
          const selected = importResolution?.rows.find((item) => item.row_number === index + 2)?.match;
          return {
            ...row,
            selected_item_id: selected?.item_id,
            selected_variant_id: selected?.variant_id,
          };
        });
        const commitResponse = await apiFetchV1("/import/commit", {
          method: "POST",
          body: {
            target: importTarget,
            rows: commitRows,
            idempotency_key: `ui-${importTarget}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            price_book_id: importCommitFields.priceBookId || undefined,
            supplier_id: importCommitFields.supplierId || undefined,
            warehouse_id: importCommitFields.warehouseId || undefined,
            reason: importCommitFields.reason || undefined,
            original_invoice_id: importCommitFields.originalInvoiceId || undefined,
            return_no: importCommitFields.returnNo || undefined,
          },
        });
        setImportDialogOpen(false);
        setStandaloneScannerStatus(`Committed ${commitResponse?.results?.length || normalized.rows.length} row(s)`);
        return;
      } catch (error: any) {
        console.error("Universal import commit failed:", error);
        setStandaloneScannerStatus(error?.message || "Import commit failed");
        return;
      }
    }

    setImportDialogOpen(false);
    setStandaloneScannerStatus("Importing rows...");

    for (const row of normalized.rows) {
      const compositeIdentifier = [
        row.identity.styleArticle,
        row.identity.size,
        row.identity.color,
        row.identity.brand,
      ].filter(Boolean).join(" ");
      const previewRow = importResolution?.rows.find((item) => item.row_number === row.rowNumber);
      const resolvedProduct = previewRow?.match
        ? {
            ...previewRow.match,
            code: previewRow.match.item_code,
            sku: previewRow.match.variant_sku || previewRow.match.item_code,
            name: previewRow.match.item_name,
            price: previewRow.match.selling_price,
            mrp: previewRow.match.mrp,
            barcode: row.identifierType === "BARCODE" ? row.identifier : undefined,
          }
        : undefined;
      await addImportedLineToSalesOrder({
        barcode: row.identifierType === "BARCODE" ? row.identifier : compositeIdentifier,
        qty: String(row.quantity),
        mrp: row.mrp === undefined ? "" : String(row.mrp),
        sellingPrice: row.sellingPrice === undefined ? "" : String(row.sellingPrice),
      }, resolvedProduct);
    }

    setStandaloneScannerStatus("Imported from file");
  };

  const handleStandaloneSaveOrder = async () => {
    if (isAuditBillingMode) {
      setStandaloneScannerStatus("Audit view only");
      return;
    }

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
                disabled={isAuditBillingMode || standaloneSaving || standaloneRows.length === 0}
                className="rounded-lg bg-[#003ec7] px-3 py-1 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#0038b6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAuditBillingMode ? "Audit View" : standaloneSaving ? "Saving..." : "Save"}
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
                      if (isAuditBillingMode) return;
                      setStandaloneRows([]);
                      setStandaloneScannerStatus("Ready");
                      setStandaloneScanValue("");
                    }}
                    disabled={isAuditBillingMode}
                    className={`flex items-center gap-1 rounded-lg border border-[#c3c5d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#003ec7] transition hover:bg-[#eff4ff] ${isAuditBillingMode ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <Plus className="h-4 w-4" />
                    New Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isAuditBillingMode) return;
                      setImportDialogOpen(true);
                      if (fileInputRef.current) fileInputRef.current.click();
                    }}
                    disabled={isAuditBillingMode}
                    className={`flex items-center gap-1 rounded-lg border border-[#c3c5d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#003ec7] transition hover:bg-[#eff4ff] ${isAuditBillingMode ? "cursor-not-allowed opacity-50" : ""}`}
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
                  placeholder={isAuditBillingMode ? "Audit billing is read-only" : "Scan or type barcode / stock no..."}
                  readOnly={isAuditBillingMode}
                  disabled={isAuditBillingMode}
                  className={`flex-1 rounded-lg border border-[#c3c5d9] bg-white px-2 py-1.5 text-[13px] outline-none transition focus:border-[#003ec7] focus:ring-1 focus:ring-[#003ec7] ${isAuditBillingMode ? "cursor-not-allowed bg-[#eef2f7] text-[#434656]" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => void handleStandaloneScanBarcode()}
                  disabled={isAuditBillingMode}
                  className={`rounded-lg bg-[#006c4a] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#005137] ${isAuditBillingMode ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  {isAuditBillingMode ? "View Only" : "Scan"}
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
                      className={`w-full rounded-lg border border-[#c3c5d9] bg-[#eff4ff] py-1.5 pl-7 pr-2 text-[13px] outline-none transition focus:border-[#003ec7] focus:ring-1 focus:ring-[#003ec7] ${isAuditBillingMode ? "cursor-not-allowed bg-[#eef2f7] text-[#434656]" : ""}`}
                      type="text"
                      value={standaloneCustomerName}
                      onChange={(e) => {
                        if (isAuditBillingMode) return;
                        setStandaloneCustomerName(e.target.value);
                        setStandaloneCustomerQuery(e.target.value);
                      }}
                      placeholder={isAuditBillingMode ? "Audit billing details" : "Select or type customer"}
                      readOnly={isAuditBillingMode}
                      disabled={isAuditBillingMode}
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
                  <select disabled={isAuditBillingMode} className={`w-full rounded-lg border border-[#c3c5d9] bg-[#eff4ff] px-2 py-1.5 text-[13px] text-[#0d1c2e] outline-none transition focus:border-[#003ec7] focus:ring-1 focus:ring-[#003ec7] ${isAuditBillingMode ? "cursor-not-allowed bg-[#eef2f7] text-[#434656]" : ""}`}>
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
                    <p className="text-[12px] text-[#434656]">Import by barcode, SKU, or Style/Article + Size + Color. Optional quantity and prices are supported.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImportDialogOpen(false)}
                    className="rounded-lg border border-[#c3c5d9] px-2 py-1 text-[12px] font-semibold text-[#434656]"
                  >
                    Close
                  </button>
                </div>

                {importResolution && (
                  <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {[
                      { label: "Matched", value: importResolution.counts.matched, className: "text-[#006c4a]" },
                      { label: "Not found", value: importResolution.counts.not_found, className: "text-[#b42318]" },
                      { label: "Needs selection", value: importResolution.counts.ambiguous, className: "text-[#9a6700]" },
                      { label: "Total rows", value: importResolution.counts.total, className: "text-[#003ec7]" },
                    ].map((summary) => (
                      <div key={summary.label} className="rounded-lg border border-[#c3c5d9] bg-[#f8f9ff] px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#434656]">{summary.label}</div>
                        <div className={`font-mono text-[18px] font-bold ${summary.className}`}>{summary.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mb-3 flex items-center gap-3 rounded-lg border border-[#d5e3fc] bg-[#f4f8ff] p-3">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Create / Update</label>
                  <select
                    value={importTarget}
                    onChange={(event) => {
                      setImportResolution(null);
                      setImportTarget(event.target.value as typeof importTarget);
                    }}
                    className="rounded-lg border border-[#c3c5d9] bg-white px-2 py-1.5 text-[12px] text-[#0d1c2e] outline-none"
                  >
                    <option value="SALES_ORDER">Sales Order</option>
                    <option value="ITEM_MASTER">Item Master</option>
                    <option value="PRICE_BOOK">Price Book</option>
                    <option value="PURCHASE_INWARD">Purchase Inward</option>
                    <option value="STOCK_ADJUSTMENT">Stock Adjustment</option>
                    <option value="SALES_RETURN">Sales Return</option>
                    <option value="LABEL_PRINT">Label Printing</option>
                  </select>
                  <span className="text-[11px] text-[#434656]">The same file can be used for different activities.</span>
                </div>

                {importTarget !== "SALES_ORDER" && (
                  <div className="mb-3 grid grid-cols-1 gap-3 rounded-lg border border-[#c3c5d9] bg-[#fffdf5] p-3 md:grid-cols-3">
                    {(importTarget === "PRICE_BOOK" ? [{ key: "priceBookId", label: "Price Book ID" }] : []).map(({ key, label }) => (
                      <label key={key} className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">
                        {label}
                        <input value={importCommitFields[key as "priceBookId"]} onChange={(event) => setImportCommitFields((prev) => ({ ...prev, [key]: event.target.value }))} className="rounded-lg border border-[#c3c5d9] bg-white px-2 py-1.5 text-[12px] outline-none" />
                      </label>
                    ))}
                    {importTarget === "PURCHASE_INWARD" && [
                      { key: "supplierId", label: "Supplier ID" },
                      { key: "warehouseId", label: "Warehouse ID" },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">
                        {label}
                        <input value={importCommitFields[key as "supplierId" | "warehouseId"]} onChange={(event) => setImportCommitFields((prev) => ({ ...prev, [key]: event.target.value }))} className="rounded-lg border border-[#c3c5d9] bg-white px-2 py-1.5 text-[12px] outline-none" />
                      </label>
                    ))}
                    {(importTarget === "STOCK_ADJUSTMENT" || importTarget === "SALES_RETURN") && (
                      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">
                        Reason
                        <input value={importCommitFields.reason} onChange={(event) => setImportCommitFields((prev) => ({ ...prev, reason: event.target.value }))} className="rounded-lg border border-[#c3c5d9] bg-white px-2 py-1.5 text-[12px] outline-none" />
                      </label>
                    )}
                    {importTarget === "SALES_RETURN" && [
                      { key: "originalInvoiceId", label: "Original Invoice ID" },
                      { key: "returnNo", label: "Return No" },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">
                        {label}
                        <input value={importCommitFields[key as "originalInvoiceId" | "returnNo"]} onChange={(event) => setImportCommitFields((prev) => ({ ...prev, [key]: event.target.value }))} className="rounded-lg border border-[#c3c5d9] bg-white px-2 py-1.5 text-[12px] outline-none" />
                      </label>
                    ))}
                  </div>
                )}

                <div className="mb-3 flex items-center gap-3 rounded-lg border border-[#d5e3fc] bg-[#f4f8ff] p-3">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">Template</label>
                  <select
                    value={importTemplateId}
                    onChange={(event) => setImportTemplateId(event.target.value)}
                    className="flex-1 rounded-lg border border-[#c3c5d9] bg-white px-2 py-1.5 text-[12px] text-[#0d1c2e] outline-none"
                  >
                    {UNIVERSAL_IMPORT_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>{template.label} - {template.description}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  {[
                    { key: "barcode", label: "Barcode" },
                    { key: "sku", label: "SKU / Item Code" },
                    { key: "styleArticle", label: "Style / Article" },
                    { key: "name", label: "Product Name" },
                    { key: "size", label: "Size" },
                    { key: "color", label: "Color" },
                    { key: "brand", label: "Brand" },
                    { key: "qty", label: "Qty" },
                    { key: "mrp", label: "MRP" },
                    { key: "sellingPrice", label: "Selling Price" },
                    { key: "costPrice", label: "Cost Price" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#434656]">
                      {label}
                      <select
                        value={importFieldMap[key as keyof typeof importFieldMap]}
                        onChange={(e) => {
                          setImportResolution(null);
                          setImportFieldMap((prev) => ({ ...prev, [key]: e.target.value }));
                        }}
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
                          <th className="border-b border-[#c3c5d9] px-2 py-2 font-semibold uppercase tracking-[0.05em]">Resolution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreviewRows.slice(0, 8).map((row, idx) => {
                          const resolution = importResolution?.rows.find((item) => item.row_number === idx + 2);
                          const status = resolution?.status || "PENDING";
                          return (
                          <tr key={`${idx}-${Object.values(row).join('-')}`} className="border-b border-[#c3c5d9] last:border-b-0">
                            {importHeaders.map((header) => (
                              <td key={`${idx}-${header}`} className="px-2 py-2 text-[#0d1c2e]">{row[header] || ""}</td>
                            ))}
                            <td className={`px-2 py-2 text-[10px] font-bold ${status === "MATCHED" ? "text-[#006c4a]" : status === "AMBIGUOUS" ? "text-[#9a6700]" : status === "NOT_FOUND" ? "text-[#b42318]" : "text-[#434656]"}`}>
                              {status === "MATCHED" ? resolution?.match?.item_name || "MATCHED" : status}
                              {status === "AMBIGUOUS" && resolution?.candidates && (
                                <div className="mt-1 flex flex-col gap-1">
                                  {resolution.candidates.map((candidate, candidateIndex) => (
                                    <button
                                      key={`${candidate.item_code || candidate.variant_sku || candidateIndex}`}
                                      type="button"
                                      onClick={() => {
                                        if (!importResolution) return;
                                        setImportResolution({
                                          ...importResolution,
                                          rows: importResolution.rows.map((item) => item.row_number === resolution.row_number
                                            ? { ...item, status: "MATCHED", match: candidate }
                                            : item),
                                          counts: {
                                            ...importResolution.counts,
                                            ambiguous: Math.max(0, importResolution.counts.ambiguous - 1),
                                            matched: importResolution.counts.matched + 1,
                                          },
                                        });
                                      }}
                                      className="rounded border border-[#d8b24c] bg-[#fff8df] px-1.5 py-1 text-left text-[10px] font-semibold text-[#6b4f00] hover:bg-[#ffefb0]"
                                    >
                                      {candidate.item_name || candidate.item_code || candidate.variant_sku || "Select match"}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                          );
                        })}
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
