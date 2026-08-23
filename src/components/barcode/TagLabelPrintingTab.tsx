/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.8.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: SMRITI Enterprise Barcode Label Studio & Printer Engine
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Product } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import {
  LabelPrintRow,
  LabelPrintSettings,
  ItemMasterSelectionCriteria,
  PortType,
  LabelSourceOption,
  PrintSafetyValidation
} from "./types.ts";
import { EditQuantityDetailsModal } from "./EditQuantityDetailsModal.tsx";
import { BarcodeScriptGenerationView } from "./BarcodeScriptGenerationView.tsx";
import { BarcodePrinterSelectModal } from "./BarcodePrinterSelectModal.tsx";
import { PurchaseProductBrowseModal } from "../purchase/PurchaseProductBrowseModal.tsx";
import { SearchableMultiSelect } from "./SearchableMultiSelect.tsx";
import { ThermalBarcodeSvg } from "./ThermalBarcodeSvg.tsx";
import { parsePTFileContent, SAMPLE_PT_FILE_RECORDS } from "./ptFileParser.ts";
import { 
  queryTransactionItems, 
  queryPurchaseOrderItems, 
  queryMasterItemsByDate
} from "./barcodeTransactionStore.ts";
import { 
  Printer, 
  Sliders, 
  Layers, 
  Code, 
  Download, 
  Filter, 
  Search, 
  Info, 
  HelpCircle, 
  ArrowUpDown, 
  ArrowUp,
  ArrowDown,
  UploadCloud, 
  Zap, 
  Edit3, 
  FileSpreadsheet, 
  RotateCcw, 
  Eye, 
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  X,
  Check,
  FileCheck,
  Activity
} from "lucide-react";

interface TagLabelPrintingTabProps {
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info") => void;
  onClose?: () => void;
}

export const TagLabelPrintingTab: React.FC<TagLabelPrintingTabProps> = ({
  products: initialProducts = [],
  currentUser,
  onNotification,
  onClose
}) => {
  const [activeView, setActiveView] = useState<"printing" | "designer">("printing");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [gridRows, setGridRows] = useState<LabelPrintRow[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number>(0);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Global & Per-Column Grid Search / Filters
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  
  // Table Column Sorting State
  const [sortField, setSortField] = useState<keyof LabelPrintRow | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Settings
  const [settings, setSettings] = useState<LabelPrintSettings>({
    scriptFileName: "C:\\SMRITI\\Barcode\\ModernLabelDesign_TE244.blf",
    labelsPerRow: 1,
    outputToPort: true,
    outputToFile: false,
    portSetting: "USB",
    sourceOption: "Manual Selection",
    piPdtFileName: "",
    quantityMode: "Specified Quantity",
    targetPrinterName: "IMPACT by Honeywell IH-2 (300 dpi) - DPL",
    resolutionDpi: 300
  });

  // 1. Selection Criteria (Item Master Mode: 7 Criteria + Barcode)
  const [itemCriteria, setItemCriteria] = useState<ItemMasterSelectionCriteria>({
    stockNoFrom: "000006",
    stockNoTo: "000008",
    barcode: "",
    productNames: [],
    brands: [],
    categories: [],
    styleCodes: [],
    colours: [],
    sizes: []
  });

  // 2. PT File State (Against Purchase PT File)
  const [ptFileName, setPtFileName] = useState<string>("C:\\shoper9R13\\PT_20101005.pt");
  const [ptRows, setPtRows] = useState<LabelPrintRow[]>(() => {
    return SAMPLE_PT_FILE_RECORDS.map((rec, idx) => ({
      id: `pt-row-${idx + 1}`,
      sNo: idx + 1,
      stockNo: rec.stockNo,
      barcode: rec.barcode,
      brand: rec.brand,
      product: rec.product,
      colour: rec.colour,
      style: rec.style,
      size: rec.size,
      mrp: rec.mrp,
      sellingPrice: rec.sellingPrice,
      currentStock: 0,
      labelCount: rec.purchaseQty
    }));
  });

  // 3. Transactions State (Against Transactions)
  const [txDocType, setTxDocType] = useState<string>("Purchase Inward (GRN)");
  const [txDocPrefix, setTxDocPrefix] = useState<string>("GRN-24");
  const [txDocFrom, setTxDocFrom] = useState<string>("0010");
  const [txDocTo, setTxDocTo] = useState<string>("0015");
  const [txRows, setTxRows] = useState<LabelPrintRow[]>(() => queryTransactionItems("Purchase Inward (GRN)", "GRN-2026-", "001", "010"));

  // 4. Purchase Order State (Against Purchase Order)
  const [poPrefix, setPoPrefix] = useState<string>("PO-2024");
  const [poNoFrom, setPoNoFrom] = useState<string>("10050");
  const [poNoTo, setPoNoTo] = useState<string>("10065");
  const [poRows, setPoRows] = useState<LabelPrintRow[]>(() => queryPurchaseOrderItems("PO-2026-", "001", "005"));

  // 5. Masters by Date State (Against Masters)
  const [masterDateFrom, setMasterDateFrom] = useState<string>("2026-08-01");
  const [masterDateTo, setMasterDateTo] = useState<string>("2026-08-22");
  const [masterRows, setMasterRows] = useState<LabelPrintRow[]>(() => queryMasterItemsByDate("2026-08-01", "2026-08-22", false));
  const [showMasterFilterDialog, setShowMasterFilterDialog] = useState<boolean>(false);

  // 6. Direct Scan State (Against Direct Scan)
  const [directScanInput, setDirectScanInput] = useState<string>("");
  const [autoPrintOneLabel, setAutoPrintOneLabel] = useState<boolean>(true);
  const [directScanLabelCount, setDirectScanLabelCount] = useState<number>(1);
  const [scannedRows, setScannedRows] = useState<LabelPrintRow[]>([]);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // 7. PDT File State (Against PDT File)
  const [pdtFileName, setPdtFileName] = useState<string>("PDT_IMPORT_2026.csv");
  const [pdtRows, setPdtRows] = useState<LabelPrintRow[]>([]);
  const pdtFileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [isEditQtyModalOpen, setIsEditQtyModalOpen] = useState<boolean>(false);
  const [isPrinterSelectModalOpen, setIsPrinterSelectModalOpen] = useState<boolean>(false);
  const [isF2BrowseModalOpen, setIsF2BrowseModalOpen] = useState<boolean>(false);
  const [f2BrowseTarget, setF2BrowseTarget] = useState<"stockNoFrom" | "stockNoTo">("stockNoFrom");
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(false);
  const [showTestPrintModal, setShowTestPrintModal] = useState<boolean>(false);
  const [isSinglePrintMode, setIsSinglePrintMode] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ptFileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 -> Product Browse
      if (e.key === "F2") {
        e.preventDefault();
        setF2BrowseTarget("stockNoFrom");
        setIsF2BrowseModalOpen(true);
      }
      // F11 -> Edit Quantities Modal
      if (e.key === "F11") {
        e.preventDefault();
        setIsEditQtyModalOpen(true);
      }
      // F8 -> Print Selected / All
      if (e.key === "F8") {
        e.preventDefault();
        handlePrintAll();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch products from backend if empty
  useEffect(() => {
    if (products.length === 0) {
      loadProducts();
    } else {
      populateGrid(products);
    }
  }, [initialProducts]);

  const loadProducts = async () => {
    try {
      const res = await apiFetchV1("/products");
      const list = Array.isArray(res) ? res : res?.items || [];
      if (list.length > 0) {
        setProducts(list);
        populateGrid(list);
      }
    } catch {
      const sampleList: Product[] = [
        { id: "1", code: "000006", name: "Shirt", category: "Apparel", brand: "Beanstalk", color: "Ecru", styleCode: "BeeLine", size: "34", mrp: 1299, price: 999, stock: 12, barcode: "890100000006" },
        { id: "2", code: "000007", name: "Shirt", category: "Apparel", brand: "Beanstalk", color: "Ecru", styleCode: "BeeLine", size: "36", mrp: 1299, price: 999, stock: 15, barcode: "890100000007" },
        { id: "3", code: "000008", name: "Shirt", category: "Apparel", brand: "Beanstalk", color: "Ecru", styleCode: "BeeLine", size: "38", mrp: 1299, price: 999, stock: 8, barcode: "890100000008" },
        { id: "4", code: "000010", name: "Trouser", category: "Apparel", brand: "Beanstalk", color: "Olive", styleCode: "Cargo", size: "32", mrp: 1899, price: 1499, stock: 24, barcode: "890100000010" },
        { id: "5", code: "000011", name: "Trouser", category: "Apparel", brand: "Beanstalk", color: "Olive", styleCode: "Cargo", size: "34", mrp: 1899, price: 1499, stock: 18, barcode: "890100000011" },
        { id: "6", code: "000012", name: "Trouser", category: "Apparel", brand: "Beanstalk", color: "Olive", styleCode: "Cargo", size: "36", mrp: 1899, price: 1499, stock: 6, barcode: "890100000012" },
        { id: "7", code: "000020", name: "Sneakers Pro", category: "Footwear", brand: "Nike", color: "White", styleCode: "HighTop", size: "9", mrp: 4999, price: 3999, stock: 10, barcode: "890100000020" },
        { id: "8", code: "000021", name: "Casual Slip-On", category: "Footwear", brand: "Puma", color: "Grey", styleCode: "Flat", size: "8", mrp: 2499, price: 1999, stock: 14, barcode: "890100000021" }
      ];
      setProducts(sampleList);
      populateGrid(sampleList);
    }
  };

  const populateGrid = (itemsList: Product[]) => {
    const rows: LabelPrintRow[] = itemsList.map((p, idx) => ({
      id: p.id || `row-${idx}`,
      sNo: idx + 1,
      stockNo: p.code || String(idx + 1).padStart(6, "0"),
      barcode: p.barcode || p.code || "",
      brand: p.brand || "Beanstalk",
      product: p.name || p.category || "Item",
      category: p.category || "General",
      colour: p.color || "Ecru",
      style: p.styleCode || "BeeLine",
      size: p.size || "34",
      mrp: p.mrp || p.price || 0,
      sellingPrice: p.price || 0,
      currentStock: p.stock ?? 0,
      labelCount: 1,
      originalProduct: p
    }));
    setGridRows(rows);
    // Initialize all rows as selected by default
    setSelectedRowIds(new Set(rows.map(r => r.id)));
  };

  // Distinct options derived dynamically from actual product inventory
  const uniqueBrands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))) as string[], [products]);
  const uniqueProducts = useMemo(() => Array.from(new Set(products.map(p => p.name).filter(Boolean))) as string[], [products]);
  const uniqueCategories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[], [products]);
  const uniqueColours = useMemo(() => Array.from(new Set(products.map(p => p.color).filter(Boolean))) as string[], [products]);
  const uniqueStyles = useMemo(() => Array.from(new Set(products.map(p => p.styleCode).filter(Boolean))) as string[], [products]);
  const uniqueSizes = useMemo(() => Array.from(new Set(products.map(p => p.size).filter(Boolean))) as string[], [products]);

  // Mode Determinations
  const isManualMode = settings.sourceOption === "Manual Selection";
  const isPtFileMode = settings.sourceOption === "Against Purchase (PT File)";
  const isTxMode = settings.sourceOption === "Against Transactions";
  const isPoMode = settings.sourceOption === "Against Purchase Order";
  const isMasterMode = settings.sourceOption === "Against Masters";
  const isDirectScanMode = settings.sourceOption === "Against Direct Scan";
  const isPdtFileMode = settings.sourceOption === "Against PDT File";

  const isFixedQuantitySource = isPtFileMode || isTxMode || isPoMode;

  // Active Filter Chips calculation for Item Master mode
  const activeFilterChips = useMemo(() => {
    if (!isManualMode) return [];
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (itemCriteria.stockNoFrom || itemCriteria.stockNoTo) {
      chips.push({
        key: "skuRange",
        label: `SKU: ${itemCriteria.stockNoFrom || "Start"} → ${itemCriteria.stockNoTo || "End"}`,
        onRemove: () => setItemCriteria(prev => ({ ...prev, stockNoFrom: "", stockNoTo: "" }))
      });
    }
    if (itemCriteria.barcode.trim()) {
      chips.push({
        key: "barcode",
        label: `Barcode: ${itemCriteria.barcode.trim()}`,
        onRemove: () => setItemCriteria(prev => ({ ...prev, barcode: "" }))
      });
    }
    if (itemCriteria.productNames.length > 0) {
      chips.push({
        key: "productNames",
        label: `Product: ${itemCriteria.productNames.join(", ")}`,
        onRemove: () => setItemCriteria(prev => ({ ...prev, productNames: [] }))
      });
    }
    if (itemCriteria.brands.length > 0) {
      chips.push({
        key: "brands",
        label: `Brand: ${itemCriteria.brands.join(", ")}`,
        onRemove: () => setItemCriteria(prev => ({ ...prev, brands: [] }))
      });
    }
    if (itemCriteria.categories.length > 0) {
      chips.push({
        key: "categories",
        label: `Category: ${itemCriteria.categories.join(", ")}`,
        onRemove: () => setItemCriteria(prev => ({ ...prev, categories: [] }))
      });
    }
    if (itemCriteria.styleCodes.length > 0) {
      chips.push({
        key: "styleCodes",
        label: `Style: ${itemCriteria.styleCodes.join(", ")}`,
        onRemove: () => setItemCriteria(prev => ({ ...prev, styleCodes: [] }))
      });
    }
    if (itemCriteria.colours.length > 0) {
      chips.push({
        key: "colours",
        label: `Shade: ${itemCriteria.colours.join(", ")}`,
        onRemove: () => setItemCriteria(prev => ({ ...prev, colours: [] }))
      });
    }
    if (itemCriteria.sizes.length > 0) {
      chips.push({
        key: "sizes",
        label: `Size: ${itemCriteria.sizes.join(", ")}`,
        onRemove: () => setItemCriteria(prev => ({ ...prev, sizes: [] }))
      });
    }

    return chips;
  }, [isManualMode, itemCriteria]);

  // Active Dataset Resolution (Combining Source with Item Master Criteria via AND logic)
  const rawDataset: LabelPrintRow[] = useMemo(() => {
    if (isPtFileMode) return ptRows;
    if (isTxMode) return txRows;
    if (isPoMode) return poRows;
    if (isMasterMode) return masterRows;
    if (isDirectScanMode) return scannedRows;
    if (isPdtFileMode) return pdtRows;

    // Manual / Item Master Criteria Filtering (AND logic across all 7 criteria + barcode)
    return gridRows.filter(row => {
      // 1. Stock No / SKU Range
      if (itemCriteria.stockNoFrom && row.stockNo < itemCriteria.stockNoFrom) return false;
      if (itemCriteria.stockNoTo && row.stockNo > itemCriteria.stockNoTo) return false;

      // 2. Barcode Exact Match
      if (itemCriteria.barcode.trim()) {
        const b = itemCriteria.barcode.trim().toLowerCase();
        if (row.barcode.toLowerCase() !== b && row.stockNo.toLowerCase() !== b) return false;
      }

      // 3. Product Names (Multi-select)
      if (itemCriteria.productNames.length > 0 && !itemCriteria.productNames.includes(row.product)) {
        return false;
      }

      // 4. Brands (Multi-select)
      if (itemCriteria.brands.length > 0 && !itemCriteria.brands.includes(row.brand)) {
        return false;
      }

      // 5. Categories (Multi-select)
      if (itemCriteria.categories.length > 0 && (!row.category || !itemCriteria.categories.includes(row.category))) {
        return false;
      }

      // 6. Style Codes (Multi-select)
      if (itemCriteria.styleCodes.length > 0 && !itemCriteria.styleCodes.includes(row.style)) {
        return false;
      }

      // 7. Colours / Shades (Multi-select)
      if (itemCriteria.colours.length > 0 && !itemCriteria.colours.includes(row.colour)) {
        return false;
      }

      // 8. Sizes (Multi-select)
      if (itemCriteria.sizes.length > 0 && !itemCriteria.sizes.includes(row.size)) {
        return false;
      }

      return true;
    });
  }, [
    isPtFileMode, isTxMode, isPoMode, isMasterMode, isDirectScanMode, isPdtFileMode,
    ptRows, txRows, poRows, masterRows, scannedRows, pdtRows,
    gridRows, itemCriteria
  ]);

  // Comparator for sorting with empty-values-last invariant
  const compareRowValues = (a: any, b: any, key: keyof LabelPrintRow, direction: "asc" | "desc"): number => {
    const isAEmpty = a === null || a === undefined || a === "";
    const isBEmpty = b === null || b === undefined || b === "";

    if (isAEmpty && isBEmpty) return 0;
    if (isAEmpty) return 1;
    if (isBEmpty) return -1;

    let comparison = 0;
    const isNumeric = key === "sellingPrice" || key === "mrp" || key === "labelCount" || key === "currentStock" || key === "sNo";

    if (isNumeric) {
      const numA = typeof a === "number" ? a : parseFloat(String(a)) || 0;
      const numB = typeof b === "number" ? b : parseFloat(String(b)) || 0;
      comparison = numA - numB;
    } else {
      const strA = String(a).toLowerCase();
      const strB = String(b).toLowerCase();
      comparison = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
    }

    return direction === "asc" ? comparison : -comparison;
  };

  // Filtered by Search input, Per-Column Filters, and Sorted
  const activeDataset = useMemo(() => {
    let list = rawDataset;

    // 1. Global Search Filter
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      list = list.filter(r =>
        r.stockNo.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.style.toLowerCase().includes(q) ||
        r.colour.toLowerCase().includes(q) ||
        r.size.toLowerCase().includes(q) ||
        r.barcode.toLowerCase().includes(q)
      );
    }

    // 2. Per-Column Header Filters
    const activeColFilters = Object.entries(columnFilters).filter(([_, val]) => Boolean(val && val.trim()));
    if (activeColFilters.length > 0) {
      list = list.filter(row => {
        return activeColFilters.every(([colKey, filterVal]) => {
          const targetVal = String((row as any)[colKey] ?? "").toLowerCase();
          return targetVal.includes(filterVal.trim().toLowerCase());
        });
      });
    }

    // 3. Sorting
    if (sortField) {
      list = [...list].sort((a, b) => {
        return compareRowValues(a[sortField], b[sortField], sortField, sortDirection);
      });
    }

    return list;
  }, [rawDataset, filterSearch, columnFilters, sortField, sortDirection]);

  // Keep selected preview within bounds
  const currentSelectedItem: LabelPrintRow | undefined = activeDataset[selectedPreviewIndex] || activeDataset[0];

  // Selection Metrics
  const totalLoadedItems = activeDataset.length;
  const selectedItemsCount = useMemo(() => {
    return activeDataset.filter(r => selectedRowIds.has(r.id)).length;
  }, [activeDataset, selectedRowIds]);

  const totalCurrentStockSum = useMemo(() => {
    return activeDataset.reduce((s, r) => s + (Number(r.currentStock) || 0), 0);
  }, [activeDataset]);

  const selectedTotalLabels = useMemo(() => {
    return activeDataset
      .filter(r => selectedRowIds.has(r.id))
      .reduce((sum, r) => sum + (Number(r.labelCount) || 0), 0);
  }, [activeDataset, selectedRowIds]);

  // Select-All Checkbox State
  const isAllVisibleSelected = activeDataset.length > 0 && activeDataset.every(r => selectedRowIds.has(r.id));
  const isSomeVisibleSelected = activeDataset.some(r => selectedRowIds.has(r.id)) && !isAllVisibleSelected;

  const handleToggleSelectAll = () => {
    if (isAllVisibleSelected) {
      setSelectedRowIds(prev => {
        const next = new Set(prev);
        activeDataset.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRowIds(prev => {
        const next = new Set(prev);
        activeDataset.forEach(r => next.add(r.id));
        return next;
      });
    }
  };

  const handleToggleRowSelect = (rowId: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  // Sort Toggle Handler (Cycle: none -> asc -> desc -> none)
  const handleSortToggle = (field: keyof LabelPrintRow) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Per-Column Filter Change Handler
  const handleColumnFilterChange = (colKey: string, val: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (!val || !val.trim()) {
        delete next[colKey];
      } else {
        next[colKey] = val;
      }
      return next;
    });
  };

  // 4-Way Item Navigator Handlers
  const handleNavFirst = () => setSelectedPreviewIndex(0);
  const handleNavPrev = () => setSelectedPreviewIndex(prev => Math.max(0, prev - 1));
  const handleNavNext = () => setSelectedPreviewIndex(prev => Math.min(activeDataset.length - 1, prev + 1));
  const handleNavLast = () => setSelectedPreviewIndex(Math.max(0, activeDataset.length - 1));

  // Inline Label Count Editor on the Results Grid
  const handleInlineLabelChange = (rowId: string, count: number) => {
    const val = isNaN(count) ? 0 : Math.max(0, count);
    if (isPtFileMode) {
      setPtRows(prev => prev.map(r => r.id === rowId ? { ...r, labelCount: val } : r));
    } else if (isTxMode) {
      setTxRows(prev => prev.map(r => r.id === rowId ? { ...r, labelCount: val } : r));
    } else if (isPoMode) {
      setPoRows(prev => prev.map(r => r.id === rowId ? { ...r, labelCount: val } : r));
    } else if (isMasterMode) {
      setMasterRows(prev => prev.map(r => r.id === rowId ? { ...r, labelCount: val } : r));
    } else if (isDirectScanMode) {
      setScannedRows(prev => prev.map(r => r.id === rowId ? { ...r, labelCount: val } : r));
    } else if (isPdtFileMode) {
      setPdtRows(prev => prev.map(r => r.id === rowId ? { ...r, labelCount: val } : r));
    } else {
      setGridRows(prev => prev.map(r => r.id === rowId ? { ...r, labelCount: val } : r));
    }
  };

  // Bulk Label Count Presets
  const handleSetAllLabels = (target: "one" | "stock") => {
    const updateFn = (r: LabelPrintRow) => ({
      ...r,
      labelCount: target === "one" ? 1 : Math.max(1, r.currentStock || 1)
    });

    if (isPtFileMode) setPtRows(prev => prev.map(updateFn));
    else if (isTxMode) setTxRows(prev => prev.map(updateFn));
    else if (isPoMode) setPoRows(prev => prev.map(updateFn));
    else if (isMasterMode) setMasterRows(prev => prev.map(updateFn));
    else if (isDirectScanMode) setScannedRows(prev => prev.map(updateFn));
    else if (isPdtFileMode) setPdtRows(prev => prev.map(updateFn));
    else setGridRows(prev => prev.map(updateFn));

    onNotification?.("Quantities Updated", `Set label quantity to ${target === "one" ? "1" : "current stock"} for all items.`, "info");
  };

  // Load Results Handler (Primary Button in Selection Criteria Card)
  const handleLoadResults = () => {
    if (isTxMode) {
      const results = queryTransactionItems(txDocType, txDocPrefix, txDocFrom, txDocTo);
      setTxRows(results);
      setSelectedRowIds(new Set(results.map(r => r.id)));
      setSelectedPreviewIndex(0);
      onNotification?.("Transactions Loaded", `Loaded ${results.length} items from ${txDocType} [${txDocPrefix}${txDocFrom}–${txDocTo}]`, "success");
    } else if (isPoMode) {
      const results = queryPurchaseOrderItems(poPrefix, poNoFrom, poNoTo);
      setPoRows(results);
      setSelectedRowIds(new Set(results.map(r => r.id)));
      setSelectedPreviewIndex(0);
      onNotification?.("Purchase Orders Loaded", `Loaded ${results.length} items from POs [${poPrefix}${poNoFrom}–${poNoTo}]`, "success");
    } else if (isMasterMode) {
      setShowMasterFilterDialog(true);
      return;
    } else if (isPdtFileMode) {
      if (pdtRows.length === 0) {
        onNotification?.("PDT File Notice", "Please browse and select a PDT file to load records.", "error");
        return;
      }
      setSelectedRowIds(new Set(pdtRows.map(r => r.id)));
      setSelectedPreviewIndex(0);
      onNotification?.("PDT Loaded", `Loaded ${pdtRows.length} items from PDT file.`, "success");
    } else {
      setSelectedRowIds(new Set(rawDataset.map(r => r.id)));
      setSelectedPreviewIndex(0);
      onNotification?.("Results Loaded", `Matched ${rawDataset.length} item(s) against active criteria.`, "success");
    }
  };

  // Master Filter Dialog Responses (Yes / No / Cancel)
  const handleMasterFilterResponse = (unprintedOnly: boolean) => {
    setShowMasterFilterDialog(false);
    const results = queryMasterItemsByDate(masterDateFrom, masterDateTo, unprintedOnly);
    setMasterRows(results);
    setSelectedRowIds(new Set(results.map(r => r.id)));
    setSelectedPreviewIndex(0);
    onNotification?.(
      "Masters Loaded", 
      `Loaded ${results.length} items from master file (${unprintedOnly ? "Unprinted only" : "All records in period"}).`, 
      "success"
    );
  };

  // Direct Scan Enter Handler
  const handleDirectScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directScanInput.trim()) return;

    const query = directScanInput.trim().toLowerCase();
    const matchedProduct = products.find(p => 
      p.code?.toLowerCase() === query || 
      p.barcode?.toLowerCase() === query || 
      p.id?.toLowerCase() === query
    ) || {
      id: `scanned-${Date.now()}`,
      code: directScanInput.trim(),
      name: `Direct Scanned Item (${directScanInput.trim()})`,
      category: "General",
      brand: "Beanstalk",
      color: "Ecru",
      styleCode: "BeeLine",
      size: "34",
      mrp: 999,
      price: 799,
      stock: 1,
      barcode: directScanInput.trim()
    };

    const count = autoPrintOneLabel ? 1 : Math.max(1, directScanLabelCount);
    const newScannedRow: LabelPrintRow = {
      id: `scan-${Date.now()}`,
      sNo: scannedRows.length + 1,
      stockNo: matchedProduct.code || directScanInput.trim(),
      barcode: matchedProduct.barcode || directScanInput.trim(),
      brand: matchedProduct.brand || "Beanstalk",
      product: matchedProduct.name || "Scanned Item",
      colour: matchedProduct.color || "Ecru",
      style: matchedProduct.styleCode || "BeeLine",
      size: matchedProduct.size || "34",
      mrp: matchedProduct.mrp || matchedProduct.price || 0,
      sellingPrice: matchedProduct.price || 0,
      currentStock: matchedProduct.stock || 0,
      labelCount: count,
      originalProduct: matchedProduct
    };

    setScannedRows(prev => [newScannedRow, ...prev]);
    setSelectedRowIds(prev => new Set([...prev, newScannedRow.id]));
    setSelectedPreviewIndex(0);
    setDirectScanInput("");

    if (autoPrintOneLabel) {
      onNotification?.("Scan Registered", `Auto-queued 1 label for SKU ${newScannedRow.stockNo}`, "success");
    } else {
      onNotification?.("Scan Registered", `Queued ${count} labels for SKU ${newScannedRow.stockNo}`, "success");
    }
  };

  // PT File Upload Handler
  const handlePtFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPtFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parsePTFileContent(text);
        setPtRows(parsed);
        setSelectedRowIds(new Set(parsed.map(r => r.id)));
        setSelectedPreviewIndex(0);
        onNotification?.("PT File Loaded", `Loaded ${parsed.length} purchase records from ${file.name}`, "success");
      }
    };
    reader.readAsText(file);
  };

  // PDT File Upload Handler
  const handlePdtFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdtFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const lines = text.split("\n").filter(l => l.trim().length > 0);
        const rows: LabelPrintRow[] = [];
        let sNo = 1;
        lines.forEach((l, idx) => {
          const parts = l.split(/[,;\t]/).map(p => p.trim());
          if (parts.length >= 2) {
            const barcode = parts[0];
            const qty = parseFloat(parts[1]) || 1;
            const rate = parseFloat(parts[2]) || 999;
            const matched = products.find(p => p.barcode === barcode || p.code === barcode);

            rows.push({
              id: `pdt-row-${idx}`,
              sNo: sNo++,
              stockNo: matched?.code || barcode,
              barcode: barcode,
              brand: matched?.brand || "Beanstalk",
              product: matched?.name || "PDT Item",
              colour: matched?.color || "Standard",
              style: matched?.styleCode || "Standard",
              size: matched?.size || "Free",
              mrp: matched?.mrp || rate,
              sellingPrice: matched?.price || rate,
              currentStock: matched?.stock || 0,
              labelCount: qty
            });
          }
        });
        setPdtRows(rows);
        setSelectedRowIds(new Set(rows.map(r => r.id)));
        setSelectedPreviewIndex(0);
        onNotification?.("PDT File Loaded", `Parsed ${rows.length} records from ${file.name}`, "success");
      }
    };
    reader.readAsText(file);
  };

  // Clear Session & Criteria
  const handleClear = () => {
    setItemCriteria({
      stockNoFrom: "",
      stockNoTo: "",
      barcode: "",
      productNames: [],
      brands: [],
      categories: [],
      styleCodes: [],
      colours: [],
      sizes: []
    });
    setFilterSearch("");
    setColumnFilters({});
    setSortField(null);
    setSortDirection("asc");
    setSelectedPreviewIndex(0);
    setGridRows(prev => prev.map(r => ({ ...r, labelCount: 1 })));
    setScannedRows([]);
    setPdtRows([]);
    setSelectedRowIds(new Set(gridRows.map(r => r.id)));
    onNotification?.("Session Cleared", "Reset selection criteria, filters, and label quantities.", "info");
  };

  // PRINT SAFETY RULES VALIDATION (Strict Multi-Constraint Check)
  const safetyValidation: PrintSafetyValidation = useMemo(() => {
    const hasLoadedItems = totalLoadedItems > 0;
    const hasSelectedItems = selectedItemsCount > 0;
    const hasPositiveQuantity = selectedTotalLabels > 0;
    const hasValidTemplate = Boolean(settings.scriptFileName?.trim());
    const hasValidPrinter = Boolean(settings.targetPrinterName?.trim() || settings.outputToFile);

    const missingReasons: string[] = [];
    if (!hasLoadedItems) missingReasons.push("No items loaded in grid matching criteria");
    if (!hasSelectedItems) missingReasons.push("No items selected in grid (check at least 1 row)");
    if (!hasPositiveQuantity) missingReasons.push("Total label quantity must be greater than 0");
    if (!hasValidTemplate) missingReasons.push("No label script / template configured");
    if (!hasValidPrinter) missingReasons.push("No printer configured and file output is disabled");

    return {
      canPrint: hasLoadedItems && hasSelectedItems && hasPositiveQuantity && hasValidTemplate && hasValidPrinter,
      hasLoadedItems,
      hasSelectedItems,
      hasPositiveQuantity,
      hasValidTemplate,
      hasValidPrinter,
      missingReasons
    };
  }, [totalLoadedItems, selectedItemsCount, selectedTotalLabels, settings.scriptFileName, settings.targetPrinterName, settings.outputToFile]);

  // Print Handlers
  const handlePrintCurrent = () => {
    if (!currentSelectedItem) {
      onNotification?.("No Item Selected", "Please select an item from the grid to print.", "error");
      return;
    }
    if (!safetyValidation.hasValidTemplate || !safetyValidation.hasValidPrinter) {
      onNotification?.("Print Blocked", safetyValidation.missingReasons[0] || "Printer or template invalid.", "error");
      return;
    }
    setIsSinglePrintMode(true);
    setShowDispatchModal(true);
  };

  const handlePrintAll = () => {
    if (!safetyValidation.canPrint) {
      onNotification?.("Print Blocked", safetyValidation.missingReasons[0] || "Safety conditions not met.", "error");
      return;
    }
    setIsSinglePrintMode(false);
    setShowDispatchModal(true);
  };

  const activePrintItems = useMemo(() => {
    if (isSinglePrintMode && currentSelectedItem) {
      return [{ ...currentSelectedItem, labelCount: Math.max(1, currentSelectedItem.labelCount) }];
    }
    return activeDataset.filter(r => selectedRowIds.has(r.id) && r.labelCount > 0);
  }, [isSinglePrintMode, currentSelectedItem, activeDataset, selectedRowIds]);

  const activePrintTotalLabels = useMemo(() => {
    return activePrintItems.reduce((sum, r) => sum + r.labelCount, 0);
  }, [activePrintItems]);

  // Browser Print Trigger (Dispatches to Windows print preview dialog)
  const handleBrowserPrint = () => {
    setShowDispatchModal(false);
    setTimeout(() => {
      window.print();
      onNotification?.("Print Dispatched", `Dispatched ${activePrintTotalLabels} label(s) to Windows print queue.`, "success");
    }, 150);
  };

  // Generate Raw DPL / PRN Script for Honeywell IH-2
  const generateRawDplScript = () => {
    let script = "\x02L\nD11\n";
    activePrintItems.forEach(item => {
      for (let i = 0; i < item.labelCount; i++) {
        script += `191100000200020${item.brand}\n`;
        script += `191100000500020${item.product} - ${item.style}\n`;
        script += `191100000800020Shade: ${item.colour}  Size: ${item.size}\n`;
        script += `1e4202001100020${item.barcode || item.stockNo}\n`;
        script += `191100001500020MRP: Rs. ${item.mrp}  SP: Rs. ${item.sellingPrice}\n`;
        script += "E\n";
      }
    });
    return script;
  };

  // Status text for bottom action bar
  const bottomStatusText = useMemo(() => {
    if (!safetyValidation.canPrint) {
      return `Safety Gate: ${safetyValidation.missingReasons[0]}`;
    }
    if (isPtFileMode) return "Ready to print labels based on purchase transaction records.";
    if (isTxMode) return "Ready to print labels based on transaction records.";
    if (isPoMode) return "Ready to print labels based on purchase order records.";
    if (isMasterMode) return "Ready to print labels based on master file records.";
    if (isDirectScanMode) return "Ready to print labels based on real-time scanner input.";
    if (isPdtFileMode) return "Ready to print labels based on portable data terminal records.";
    return "Ready to print labels based on Item Master criteria.";
  }, [safetyValidation, isPtFileMode, isTxMode, isPoMode, isMasterMode, isDirectScanMode, isPdtFileMode]);

  if (activeView === "designer") {
    return (
      <BarcodeScriptGenerationView
        onBackToPrinting={() => setActiveView("printing")}
        onNotification={onNotification}
      />
    );
  }

  return (
    <div className="bg-surface text-on-surface font-sans h-full flex flex-col antialiased select-none overflow-hidden">
      
      {/* 
        Thermal Label Printable Container (Visible ONLY during window.print())
        Exact 50mm x 25mm thermal roll stickers
      */}
      <div id="smriti-barcode-printable-area" className="hidden print:block bg-white text-black font-sans">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden !important; }
            #smriti-barcode-printable-area, #smriti-barcode-printable-area * { visibility: visible !important; }
            #smriti-barcode-printable-area {
              display: block !important;
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 50mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            .thermal-label-page {
              width: 50mm !important;
              height: 25mm !important;
              max-height: 25mm !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              padding: 1.5mm 2mm !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              overflow: hidden !important;
              border: none !important;
            }
            @page {
              size: 50mm 25mm;
              margin: 0;
            }
          }
        `}} />
        
        {activePrintItems.map(item => {
          const copies = Array.from({ length: Math.max(1, item.labelCount) });
          return copies.map((_, copyIdx) => (
            <div key={`${item.id}-copy-${copyIdx}`} className="thermal-label-page text-black bg-white">
              <div className="flex justify-between items-center border-b border-black/30 pb-0.5 leading-none">
                <span className="font-extrabold text-[9px] uppercase tracking-wide truncate max-w-[28mm]">
                  {item.brand || "SMRITI RETAIL"}
                </span>
                <span className="font-mono font-bold text-[10px]">
                  ₹{item.sellingPrice || item.mrp}
                </span>
              </div>

              <div className="text-[8px] font-semibold truncate leading-tight my-0.5">
                <span>{item.product}</span>
                <span className="text-[7.5px] text-gray-700 ml-1">({item.style})</span>
              </div>

              <div className="w-full flex justify-center py-0.5">
                <ThermalBarcodeSvg
                  value={item.barcode || item.stockNo}
                  widthMm={44}
                  heightMm={10}
                  showText={true}
                />
              </div>

              <div className="flex justify-between items-center text-[7.5px] font-mono leading-none border-t border-black/30 pt-0.5">
                <span>{item.colour} / S:{item.size}</span>
                <span className="font-semibold text-[7px] text-gray-600">MRP: ₹{item.mrp}</span>
              </div>
            </div>
          ));
        })}
      </div>

      {/* 5-Step Workflow Header Banner */}
      <header className="h-14 border-b border-outline-variant bg-surface-container flex justify-between items-center px-4 shrink-0 shadow-xs z-20 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-primary font-bold font-title-sm text-sm">
            <Printer size={18} className="text-secondary" />
            <span>Tag &amp; Barcode Label Printing</span>
            <span className="text-[11px] font-bold bg-primary-container text-on-primary-container px-2.5 py-0.5 rounded-full ml-1 font-mono">
              {settings.sourceOption}
            </span>
          </div>

          {/* 5-Step Workflow Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 ml-4 pl-4 border-l border-outline-variant/60 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-bold">1. Source</span>
            <span className="text-on-surface-variant">→</span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold">2. Criteria</span>
            <span className="text-on-surface-variant">→</span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold">3. Review Grid</span>
            <span className="text-on-surface-variant">→</span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold">4. Printer &amp; Template</span>
            <span className="text-on-surface-variant">→</span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold">5. Validate &amp; Print</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTestPrintModal(true)}
            className="px-3 py-1.5 bg-surface border border-secondary text-secondary hover:bg-secondary-fixed/30 rounded font-body-sm font-semibold transition flex items-center gap-1.5 shadow-xs text-xs"
            title="Perform Safe Calibration / Diagnostic Test Print"
          >
            <CheckCircle2 size={14} />
            <span>Test Print</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditQtyModalOpen(true)}
            className="px-3 py-1.5 bg-surface border border-outline-variant hover:bg-surface-variant text-on-surface rounded font-body-sm font-semibold transition flex items-center gap-1.5 shadow-xs text-xs"
            title="Open Batch Quantity Editor (F11)"
          >
            <Edit3 size={14} className="text-secondary" />
            <span>Edit Quantities</span>
            <span className="text-[9px] font-code-md text-on-surface-variant bg-surface-container px-1 rounded">[F11]</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPrinterSelectModalOpen(true)}
            className="px-3 py-1.5 bg-surface border border-outline-variant hover:bg-surface-variant text-on-surface rounded font-body-sm font-medium transition flex items-center gap-1.5 shadow-xs text-xs"
            title="Configure Target Hardware Printer"
          >
            <Printer size={14} className="text-secondary" />
            <span className="truncate max-w-[180px]">{settings.targetPrinterName || "Configure Printer"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("designer")}
            className="px-3 py-1.5 bg-primary text-on-primary hover:bg-primary-container rounded font-body-sm font-semibold transition flex items-center gap-1.5 shadow-xs text-xs"
          >
            <Code size={14} />
            <span>Script Designer</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Frame: Left Sidebar (Step 1 & 4) + Main Content (Step 2, 3, 5) */}
      <div className="flex-1 flex overflow-hidden print:hidden pb-16">
        
        {/* Left Sidebar: Fixed Width (280px), Scrollable Configuration */}
        <aside className="w-72 bg-surface-container-low border-r border-outline-variant flex flex-col p-3.5 gap-3.5 overflow-y-auto shrink-0 z-10">
          
          {/* STEP 1: Selection Source Option Card */}
          <section className="bg-surface border border-outline-variant rounded-lg p-3 flex flex-col gap-2 shadow-xs border-t-2 border-t-primary">
            <h3 className="font-title-sm text-xs font-bold text-primary flex items-center gap-1.5 border-b border-surface-variant pb-1.5 uppercase tracking-wider">
              <Layers size={14} className="text-secondary" />
              1. Selection Source
            </h3>

            <div className="flex flex-col gap-1 text-xs">
              {(
                [
                  "Manual Selection",
                  "Against Masters",
                  "Against Direct Scan",
                  "Against Purchase (PT File)",
                  "Against Transactions",
                  "Against Purchase Order",
                  "Against PDT File"
                ] as LabelSourceOption[]
              ).map(opt => (
                <label
                  key={opt}
                  className={`flex items-center gap-2 cursor-pointer p-1.5 rounded transition ${
                    settings.sourceOption === opt 
                      ? "bg-secondary-fixed/50 text-primary font-bold" 
                      : "hover:bg-surface-variant text-on-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name="sourceOption"
                    checked={settings.sourceOption === opt}
                    onChange={() => {
                      setSettings({ ...settings, sourceOption: opt });
                      setSelectedPreviewIndex(0);
                    }}
                    className="text-secondary focus:ring-secondary h-3.5 w-3.5"
                  />
                  <span className="truncate">{opt}</span>
                </label>
              ))}
            </div>
          </section>

          {/* STEP 4: Printer & Template Configuration Card */}
          <section className="bg-surface border border-outline-variant rounded-lg p-3 flex flex-col gap-2.5 shadow-xs border-t-2 border-t-secondary">
            <div className="flex justify-between items-center border-b border-surface-variant pb-1.5">
              <h3 className="font-title-sm text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                <Sliders size={14} className="text-secondary" />
                4. Printer &amp; Template
              </h3>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-1.5 py-0.2 rounded">
                Ready
              </span>
            </div>

            {/* Template script info */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="font-label-caps text-[10px] text-on-surface-variant">Label Template / Script</label>
                <span 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] text-secondary font-bold hover:underline cursor-pointer"
                >
                  Change...
                </span>
              </div>
              <div className="bg-surface-container border border-outline-variant rounded p-1.5 text-xs font-code-md text-on-surface flex justify-between items-center truncate">
                <span className="truncate text-[11px]" title={settings.scriptFileName}>
                  {settings.scriptFileName.split("\\").pop() || settings.scriptFileName}
                </span>
                <span className="text-[9px] bg-surface-variant px-1 rounded font-bold text-on-surface-variant ml-1">
                  {settings.resolutionDpi || 300} DPI
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".t,.blf,.prn,.zpl,.tspl,.txt"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) setSettings({ ...settings, scriptFileName: file.name });
                }}
              />
            </div>

            {/* Target Printer info */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="font-label-caps text-[10px] text-on-surface-variant">Target Printer</label>
                <span 
                  onClick={() => setIsPrinterSelectModalOpen(true)}
                  className="text-[10px] text-secondary font-bold hover:underline cursor-pointer"
                >
                  Configure...
                </span>
              </div>
              <div className="bg-surface-container border border-outline-variant rounded p-1.5 text-xs font-medium text-on-surface flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <Printer size={13} className="text-secondary shrink-0" />
                  <span className="truncate text-[11px]" title={settings.targetPrinterName}>
                    {settings.targetPrinterName}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-emerald-700 bg-emerald-100 font-bold px-1 rounded ml-1 shrink-0">
                  Online
                </span>
              </div>
            </div>

            {/* Port & Labels per row */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-[10px] text-on-surface-variant">Port Setting</label>
                <select
                  value={settings.portSetting}
                  onChange={e => setSettings({ ...settings, portSetting: e.target.value as any })}
                  className="w-full bg-surface border border-outline-variant rounded p-1 text-xs font-medium focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                >
                  <option value="USB">USB</option>
                  <option value="COM 1">COM 1</option>
                  <option value="COM 2">COM 2</option>
                  <option value="Network TCP/IP">Network TCP/IP</option>
                  <option value="QZ Tray Thermal">QZ Tray</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-[10px] text-on-surface-variant">Labels Per Row</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={settings.labelsPerRow}
                  onChange={e => setSettings({ ...settings, labelsPerRow: parseInt(e.target.value) || 1 })}
                  className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-xs font-code-md text-center focus:border-secondary focus:ring-1 focus:ring-secondary outline-none font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1 border-t border-outline-variant/40">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-on-surface">
                <input
                  type="checkbox"
                  checked={settings.outputToPort}
                  onChange={e => setSettings({ ...settings, outputToPort: e.target.checked })}
                  className="text-secondary focus:ring-secondary rounded h-3.5 w-3.5"
                />
                <span>Output to Port</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-on-surface">
                <input
                  type="checkbox"
                  checked={settings.outputToFile}
                  onChange={e => setSettings({ ...settings, outputToFile: e.target.checked })}
                  className="text-secondary focus:ring-secondary rounded h-3.5 w-3.5"
                />
                <span>Output to File</span>
              </label>
            </div>
          </section>

          {/* Quick Metrics Summary Card */}
          <section className="bg-surface border border-outline-variant rounded-lg p-3 flex flex-col gap-2 shadow-xs border-t-2 border-t-secondary">
            <h3 className="font-title-sm text-xs font-bold text-primary flex items-center gap-1.5 border-b border-surface-variant pb-1.5 uppercase tracking-wider">
              <Activity size={14} className="text-secondary" />
              Batch Metrics
            </h3>

            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant text-[11px]">Matching Records:</span>
                <span className="font-code-md font-bold text-on-surface">{totalLoadedItems}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant text-[11px]">Selected Records:</span>
                <span className="font-code-md font-bold text-primary">{selectedItemsCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant text-[11px]">Current Stock:</span>
                <span className="font-code-md text-on-surface-variant">{isFixedQuantitySource ? "N/A in HO" : totalCurrentStockSum}</span>
              </div>
              <div className="flex justify-between items-center border-t border-outline-variant pt-1.5">
                <span className="text-primary font-bold text-[11px]">Total Labels:</span>
                <span className="font-code-md font-extrabold text-secondary text-sm bg-secondary-fixed/50 px-2 py-0.5 rounded border border-secondary/30">
                  {selectedTotalLabels}
                </span>
              </div>
            </div>
          </section>

        </aside>

        {/* Main Content Area: Top Selection Criteria + Bottom Results Grid */}
        <main className="flex-1 flex flex-col p-3.5 gap-3 overflow-y-auto bg-surface-container-lowest">
          
          {/* STEP 2: Selection Criteria Panel */}
          <section className="bg-surface border border-outline-variant rounded-lg p-3.5 flex flex-col gap-2.5 shadow-xs border-t-4 border-t-primary shrink-0">
            <div className="flex justify-between items-center border-b border-surface-variant pb-2">
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-secondary" />
                <h3 className="font-title-sm text-xs font-bold text-primary uppercase tracking-wider">
                  2. {isManualMode ? "Item Master Selection Criteria (7 Filters + Barcode)" : "Selection Ingestion Criteria"}
                </h3>
              </div>

              {/* 4-Way Record Navigator Bar */}
              {totalLoadedItems > 0 && (
                <div className="flex items-center gap-1 text-xs bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant">
                  <span className="text-on-surface-variant font-mono text-[11px] mr-2">
                    Item {selectedPreviewIndex + 1} of {totalLoadedItems}
                  </span>
                  <button
                    type="button"
                    onClick={handleNavFirst}
                    disabled={selectedPreviewIndex === 0}
                    className="p-1 rounded hover:bg-surface-variant disabled:opacity-30 text-primary transition"
                    title="First Record (|<<)"
                  >
                    <ChevronsLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavPrev}
                    disabled={selectedPreviewIndex === 0}
                    className="p-1 rounded hover:bg-surface-variant disabled:opacity-30 text-primary transition"
                    title="Previous Record (<)"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavNext}
                    disabled={selectedPreviewIndex >= totalLoadedItems - 1}
                    className="p-1 rounded hover:bg-surface-variant disabled:opacity-30 text-primary transition"
                    title="Next Record (>)"
                  >
                    <ChevronRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavLast}
                    disabled={selectedPreviewIndex >= totalLoadedItems - 1}
                    className="p-1 rounded hover:bg-surface-variant disabled:opacity-30 text-primary transition"
                    title="Last Record (>>|)"
                  >
                    <ChevronsRight size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* A. Manual / Item Master 7 Criteria + Dedicated Barcode Input */}
            {isManualMode && (
              <div className="flex flex-col gap-2.5">
                
                {/* Row 1: SKU From | SKU To | Barcode Scan */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="font-label-caps text-[11px] text-on-surface-variant">Stock No From (SKU)</label>
                      <span 
                        className="text-[9px] font-code-md text-secondary font-bold cursor-pointer hover:underline"
                        onClick={() => { setF2BrowseTarget("stockNoFrom"); setIsF2BrowseModalOpen(true); }}
                      >
                        [F2 Browse]
                      </span>
                    </div>
                    <input
                      type="text"
                      value={itemCriteria.stockNoFrom}
                      onChange={e => setItemCriteria({ ...itemCriteria, stockNoFrom: e.target.value })}
                      placeholder="e.g. 000006"
                      className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="font-label-caps text-[11px] text-on-surface-variant">Stock No To (SKU)</label>
                      <span 
                        className="text-[9px] font-code-md text-secondary font-bold cursor-pointer hover:underline"
                        onClick={() => { setF2BrowseTarget("stockNoTo"); setIsF2BrowseModalOpen(true); }}
                      >
                        [F2 Browse]
                      </span>
                    </div>
                    <input
                      type="text"
                      value={itemCriteria.stockNoTo}
                      onChange={e => setItemCriteria({ ...itemCriteria, stockNoTo: e.target.value })}
                      placeholder="e.g. 000008"
                      className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-label-caps text-[11px] text-on-surface-variant flex items-center gap-1">
                      <Zap size={12} className="text-secondary" />
                      <span>Dedicated Barcode Scan (Exact Match)</span>
                    </label>
                    <input
                      type="text"
                      value={itemCriteria.barcode}
                      onChange={e => setItemCriteria({ ...itemCriteria, barcode: e.target.value })}
                      placeholder="Scan or enter exact barcode..."
                      className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Row 2: Product Name | Brand | Category */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <SearchableMultiSelect
                    label="Product Name"
                    placeholder="All Products"
                    options={uniqueProducts}
                    selectedValues={itemCriteria.productNames}
                    onChange={vals => setItemCriteria({ ...itemCriteria, productNames: vals })}
                  />

                  <SearchableMultiSelect
                    label="Brand"
                    placeholder="All Brands"
                    options={uniqueBrands}
                    selectedValues={itemCriteria.brands}
                    onChange={vals => setItemCriteria({ ...itemCriteria, brands: vals })}
                  />

                  <SearchableMultiSelect
                    label="Category"
                    placeholder="All Categories"
                    options={uniqueCategories}
                    selectedValues={itemCriteria.categories}
                    onChange={vals => setItemCriteria({ ...itemCriteria, categories: vals })}
                  />
                </div>

                {/* Row 3: Style Code | Colour / Shade | Size */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <SearchableMultiSelect
                    label="Style Code"
                    placeholder="All Styles"
                    options={uniqueStyles}
                    selectedValues={itemCriteria.styleCodes}
                    onChange={vals => setItemCriteria({ ...itemCriteria, styleCodes: vals })}
                  />

                  <SearchableMultiSelect
                    label="Colour / Shade"
                    placeholder="All Colours"
                    options={uniqueColours}
                    selectedValues={itemCriteria.colours}
                    onChange={vals => setItemCriteria({ ...itemCriteria, colours: vals })}
                  />

                  <SearchableMultiSelect
                    label="Size"
                    placeholder="All Sizes"
                    options={uniqueSizes}
                    selectedValues={itemCriteria.sizes}
                    onChange={vals => setItemCriteria({ ...itemCriteria, sizes: vals })}
                  />
                </div>

                {/* Row 4: Active filter chips | Clear All | Load Results */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/50">
                  <div className="flex flex-wrap items-center gap-1.5 flex-1">
                    <span className="text-[11px] font-bold text-on-surface-variant mr-1">Active Criteria:</span>
                    {activeFilterChips.length === 0 ? (
                      <span className="text-[11px] text-on-surface-variant italic">None (matching all catalog items)</span>
                    ) : (
                      activeFilterChips.map(chip => (
                        <span
                          key={chip.key}
                          className="inline-flex items-center gap-1 bg-secondary-fixed/60 text-primary border border-secondary/30 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        >
                          <span>{chip.label}</span>
                          <button
                            type="button"
                            onClick={chip.onRemove}
                            className="hover:text-error rounded-full p-0.5 transition"
                            title="Remove filter"
                            aria-label={`Remove ${chip.label}`}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-3 py-1.5 bg-surface border border-outline-variant hover:bg-surface-variant text-on-surface rounded text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <RotateCcw size={13} />
                      <span>Clear Criteria</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleLoadResults}
                      className="bg-primary text-on-primary px-4 py-1.5 rounded text-xs font-bold hover:bg-primary-container transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Download size={14} />
                      <span>Load Results</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* B. PT File Ingestion */}
            {isPtFileMode && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
                  <label className="font-label-caps text-on-surface-variant">PT File Selection</label>
                  <div className="flex">
                    <input
                      type="text"
                      value={ptFileName}
                      onChange={e => setPtFileName(e.target.value)}
                      placeholder="Enter file name or select .pt file"
                      className="flex-1 bg-surface border border-outline-variant border-r-0 rounded-l px-3 py-1.5 text-xs font-code-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => ptFileInputRef.current?.click()}
                      className="bg-surface-variant border border-outline-variant rounded-r px-3 py-1.5 hover:bg-surface-dim transition-colors text-xs font-medium"
                    >
                      Browse...
                    </button>
                    <input
                      ref={ptFileInputRef}
                      type="file"
                      accept=".pt,.txt,.csv,.tsv"
                      className="hidden"
                      onChange={handlePtFileUpload}
                    />
                  </div>
                </div>
                <div className="flex shrink-0 pb-1">
                  <button
                    type="button"
                    onClick={handleLoadResults}
                    className="bg-primary text-on-primary px-4 py-1.5 rounded text-xs font-bold hover:bg-primary-container transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Download size={14} />
                    <span>Load Results</span>
                  </button>
                </div>
              </div>
            )}

            {/* C. Transactions Ingestion */}
            {isTxMode && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                  <label className="font-label-caps text-[11px] text-on-surface-variant">Transaction Type</label>
                  <select
                    value={txDocType}
                    onChange={e => setTxDocType(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-medium focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  >
                    <option value="Purchase Inward (GRN)">Purchase Inward (GRN)</option>
                    <option value="Sales Return Inward">Sales Return Inward</option>
                    <option value="Stock Transfer Inward">Stock Transfer Inward</option>
                    <option value="POS Exchange">POS Exchange</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                  <label className="font-label-caps text-[11px] text-on-surface-variant">Doc Prefix</label>
                  <input
                    type="text"
                    value={txDocPrefix}
                    onChange={e => setTxDocPrefix(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-code-md uppercase focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                  <label className="font-label-caps text-[11px] text-on-surface-variant">Doc From</label>
                  <input
                    type="text"
                    value={txDocFrom}
                    onChange={e => setTxDocFrom(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                  <label className="font-label-caps text-[11px] text-on-surface-variant">Doc To</label>
                  <input
                    type="text"
                    value={txDocTo}
                    onChange={e => setTxDocTo(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={handleLoadResults}
                    className="bg-primary text-on-primary px-4 py-1.5 rounded text-xs font-bold hover:bg-primary-container transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Download size={14} />
                    <span>Load Results</span>
                  </button>
                </div>
              </div>
            )}

            {/* D. Purchase Order Ingestion */}
            {isPoMode && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                  <label className="font-label-caps text-[11px] text-on-surface-variant">PO Prefix</label>
                  <input
                    type="text"
                    value={poPrefix}
                    onChange={e => setPoPrefix(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-code-md uppercase focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                  <label className="font-label-caps text-[11px] text-on-surface-variant">PO No From</label>
                  <input
                    type="text"
                    value={poNoFrom}
                    onChange={e => setPoNoFrom(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                  <label className="font-label-caps text-[11px] text-on-surface-variant">PO No To</label>
                  <input
                    type="text"
                    value={poNoTo}
                    onChange={e => setPoNoTo(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={handleLoadResults}
                    className="bg-primary text-on-primary px-4 py-1.5 rounded text-xs font-bold hover:bg-primary-container transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Download size={14} />
                    <span>Load Results</span>
                  </button>
                </div>
              </div>
            )}

            {/* E. Master Period Ingestion */}
            {isMasterMode && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                  <label className="font-label-caps text-[11px] text-on-surface-variant">Date From</label>
                  <input
                    type="date"
                    value={masterDateFrom}
                    onChange={e => setMasterDateFrom(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                  <label className="font-label-caps text-[11px] text-on-surface-variant">Date To</label>
                  <input
                    type="date"
                    value={masterDateTo}
                    onChange={e => setMasterDateTo(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={handleLoadResults}
                    className="bg-primary text-on-primary px-4 py-1.5 rounded text-xs font-bold hover:bg-primary-container transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Download size={14} />
                    <span>Load Results</span>
                  </button>
                </div>
              </div>
            )}

            {/* F. Direct Scan Ingestion */}
            {isDirectScanMode && (
              <form onSubmit={handleDirectScanSubmit} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="font-label-caps text-[11px] text-on-surface-variant flex items-center gap-1">
                    <Zap size={13} className="text-secondary" />
                    <span>Stock No. / Barcode Scanner</span>
                  </label>
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={directScanInput}
                    onChange={e => setDirectScanInput(e.target.value)}
                    placeholder="Scan or enter Stock No..."
                    className="w-full bg-surface border-2 border-secondary rounded px-2.5 py-1.5 text-xs font-code-md font-bold focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex items-center gap-3 pb-1">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-xs text-primary">
                    <input
                      type="checkbox"
                      checked={autoPrintOneLabel}
                      onChange={e => setAutoPrintOneLabel(e.target.checked)}
                      className="text-secondary rounded h-3.5 w-3.5"
                    />
                    <span>Automatically Print One Label on Scan</span>
                  </label>
                  {!autoPrintOneLabel && (
                    <input
                      type="number"
                      min="1"
                      value={directScanLabelCount}
                      onChange={e => setDirectScanLabelCount(parseInt(e.target.value) || 1)}
                      className="w-16 text-center bg-surface border border-outline-variant rounded py-1 text-xs font-code-md font-bold"
                    />
                  )}
                </div>
                <div className="flex shrink-0">
                  <button
                    type="submit"
                    className="bg-primary text-on-primary px-4 py-1.5 rounded text-xs font-bold hover:bg-primary-container transition shadow-xs"
                  >
                    Enter
                  </button>
                </div>
              </form>
            )}

            {/* G. PDT Ingestion */}
            {isPdtFileMode && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
                  <label className="font-label-caps text-on-surface-variant">PDT Delimited File</label>
                  <div className="flex">
                    <input
                      type="text"
                      value={pdtFileName}
                      onChange={e => setPdtFileName(e.target.value)}
                      placeholder="Select .pdt or .csv file"
                      className="flex-1 bg-surface border border-outline-variant border-r-0 rounded-l px-3 py-1.5 text-xs font-code-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => pdtFileInputRef.current?.click()}
                      className="bg-surface-variant border border-outline-variant rounded-r px-3 py-1.5 hover:bg-surface-dim transition-colors text-xs font-medium"
                    >
                      Browse...
                    </button>
                    <input
                      ref={pdtFileInputRef}
                      type="file"
                      accept=".pdt,.csv,.txt,.tsv"
                      className="hidden"
                      onChange={handlePdtFileUpload}
                    />
                  </div>
                </div>
                <div className="flex shrink-0 pb-1">
                  <button
                    type="button"
                    onClick={handleLoadResults}
                    className="bg-primary text-on-primary px-4 py-1.5 rounded text-xs font-bold hover:bg-primary-container transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Download size={14} />
                    <span>Load Results</span>
                  </button>
                </div>
              </div>
            )}

          </section>

          {/* STEP 3: Loaded Items Data Grid */}
          <section className="bg-surface border border-outline-variant rounded-lg p-0 flex flex-col flex-1 shadow-sm overflow-hidden min-h-[340px]">
            
            {/* Data Grid Controls Bar */}
            <div className="bg-surface-container-low border-b border-outline-variant px-3.5 py-2 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <span className="font-label-caps text-xs text-primary font-bold shrink-0 uppercase tracking-wider">
                  3. Loaded Items ({totalLoadedItems})
                </span>
                <div className="relative flex-1 max-w-xs">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    placeholder="Filter results..."
                    className="w-full pl-7 pr-2.5 py-1 bg-surface border border-outline-variant rounded text-xs focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                    aria-label="Filter loaded results"
                  />
                </div>
                {Object.keys(columnFilters).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setColumnFilters({})}
                    className="text-[10px] text-error hover:underline font-semibold flex items-center gap-1"
                  >
                    <X size={11} />
                    <span>Clear Column Filters ({Object.keys(columnFilters).length})</span>
                  </button>
                )}
              </div>

              {/* Quick Batch Presets */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleSetAllLabels("one")}
                  className="px-2 py-0.5 bg-surface border border-outline-variant hover:bg-surface-variant rounded text-[11px] font-medium"
                  title="Set all item label counts to 1"
                >
                  Set All to 1
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllLabels("stock")}
                  className="px-2 py-0.5 bg-surface border border-outline-variant hover:bg-surface-variant rounded text-[11px] font-medium"
                  title="Set all item label counts to match stock"
                >
                  Set All to Stock
                </button>
                <span className="text-on-surface-variant text-[11px] hidden sm:inline ml-2">Click headers to sort</span>
              </div>
            </div>

            {/* Grid Table Container */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead className="sticky top-0 bg-surface-container-high z-10 shadow-xs">
                  <tr className="border-b border-outline-variant text-[11px]">
                    
                    {/* Row selection checkbox header */}
                    <th className="px-3 py-2 w-10 text-center bg-surface-container-high">
                      <input
                        type="checkbox"
                        checked={isAllVisibleSelected}
                        ref={el => {
                          if (el) el.indeterminate = isSomeVisibleSelected;
                        }}
                        onChange={handleToggleSelectAll}
                        className="rounded text-secondary focus:ring-secondary h-3.5 w-3.5 cursor-pointer"
                        aria-label="Select all visible items"
                      />
                    </th>

                    {/* Stock No Header */}
                    <th 
                      onClick={() => handleSortToggle("stockNo")}
                      className="px-3 py-2 font-label-caps text-on-surface-variant cursor-pointer hover:text-primary transition-colors select-none"
                      aria-sort={sortField === "stockNo" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <div className="flex items-center gap-1">
                        <span>Stock No</span>
                        {sortField === "stockNo" ? (
                          sortDirection === "asc" ? <ArrowUp size={12} className="text-secondary font-bold" /> : <ArrowDown size={12} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* Product Header */}
                    <th 
                      onClick={() => handleSortToggle("product")}
                      className="px-3 py-2 font-label-caps text-on-surface-variant cursor-pointer hover:text-primary transition-colors select-none"
                      aria-sort={sortField === "product" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <div className="flex items-center gap-1">
                        <span>Product</span>
                        {sortField === "product" ? (
                          sortDirection === "asc" ? <ArrowUp size={12} className="text-secondary font-bold" /> : <ArrowDown size={12} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* Brand Header */}
                    <th 
                      onClick={() => handleSortToggle("brand")}
                      className="px-3 py-2 font-label-caps text-on-surface-variant cursor-pointer hover:text-primary transition-colors select-none"
                      aria-sort={sortField === "brand" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <div className="flex items-center gap-1">
                        <span>Brand</span>
                        {sortField === "brand" ? (
                          sortDirection === "asc" ? <ArrowUp size={12} className="text-secondary font-bold" /> : <ArrowDown size={12} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* Style Header */}
                    <th 
                      onClick={() => handleSortToggle("style")}
                      className="px-3 py-2 font-label-caps text-on-surface-variant cursor-pointer hover:text-primary transition-colors select-none"
                      aria-sort={sortField === "style" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <div className="flex items-center gap-1">
                        <span>Style</span>
                        {sortField === "style" ? (
                          sortDirection === "asc" ? <ArrowUp size={12} className="text-secondary font-bold" /> : <ArrowDown size={12} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* Shade / Colour Header */}
                    <th 
                      onClick={() => handleSortToggle("colour")}
                      className="px-3 py-2 font-label-caps text-on-surface-variant cursor-pointer hover:text-primary transition-colors select-none"
                      aria-sort={sortField === "colour" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <div className="flex items-center gap-1">
                        <span>Shade</span>
                        {sortField === "colour" ? (
                          sortDirection === "asc" ? <ArrowUp size={12} className="text-secondary font-bold" /> : <ArrowDown size={12} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* Size Header */}
                    <th 
                      onClick={() => handleSortToggle("size")}
                      className="px-3 py-2 font-label-caps text-on-surface-variant cursor-pointer hover:text-primary transition-colors select-none"
                      aria-sort={sortField === "size" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <div className="flex items-center gap-1">
                        <span>Size</span>
                        {sortField === "size" ? (
                          sortDirection === "asc" ? <ArrowUp size={12} className="text-secondary font-bold" /> : <ArrowDown size={12} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* Price Header (Numeric) */}
                    <th 
                      onClick={() => handleSortToggle("sellingPrice")}
                      className="px-3 py-2 font-label-caps text-on-surface-variant cursor-pointer hover:text-primary transition-colors select-none text-right"
                      aria-sort={sortField === "sellingPrice" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Price</span>
                        {sortField === "sellingPrice" ? (
                          sortDirection === "asc" ? <ArrowUp size={12} className="text-secondary font-bold" /> : <ArrowDown size={12} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* # Labels Header (Numeric) */}
                    <th 
                      onClick={() => handleSortToggle("labelCount")}
                      className="px-3 py-2 font-label-caps text-on-surface-variant w-28 text-center cursor-pointer hover:text-primary transition-colors select-none"
                      aria-sort={sortField === "labelCount" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span># Labels</span>
                        {sortField === "labelCount" ? (
                          sortDirection === "asc" ? <ArrowUp size={12} className="text-secondary font-bold" /> : <ArrowDown size={12} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </div>
                    </th>
                  </tr>

                  {/* Per-Column Filter Input Row */}
                  <tr className="border-b border-outline-variant bg-surface-container/60">
                    <td className="p-1"></td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={columnFilters.stockNo || ""}
                        onChange={e => handleColumnFilterChange("stockNo", e.target.value)}
                        placeholder="Filter..."
                        className="w-full bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-[11px] font-code-md outline-none focus:border-secondary"
                        aria-label="Filter by Stock No"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={columnFilters.product || ""}
                        onChange={e => handleColumnFilterChange("product", e.target.value)}
                        placeholder="Filter..."
                        className="w-full bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-secondary"
                        aria-label="Filter by Product"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={columnFilters.brand || ""}
                        onChange={e => handleColumnFilterChange("brand", e.target.value)}
                        placeholder="Filter..."
                        className="w-full bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-secondary"
                        aria-label="Filter by Brand"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={columnFilters.style || ""}
                        onChange={e => handleColumnFilterChange("style", e.target.value)}
                        placeholder="Filter..."
                        className="w-full bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-secondary"
                        aria-label="Filter by Style"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={columnFilters.colour || ""}
                        onChange={e => handleColumnFilterChange("colour", e.target.value)}
                        placeholder="Filter..."
                        className="w-full bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-secondary"
                        aria-label="Filter by Shade"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={columnFilters.size || ""}
                        onChange={e => handleColumnFilterChange("size", e.target.value)}
                        placeholder="Filter..."
                        className="w-full bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-secondary"
                        aria-label="Filter by Size"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={columnFilters.sellingPrice || ""}
                        onChange={e => handleColumnFilterChange("sellingPrice", e.target.value)}
                        placeholder="Filter..."
                        className="w-full bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-[11px] text-right font-mono outline-none focus:border-secondary"
                        aria-label="Filter by Price"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={columnFilters.labelCount || ""}
                        onChange={e => handleColumnFilterChange("labelCount", e.target.value)}
                        placeholder="Filter..."
                        className="w-full bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-[11px] text-center font-mono outline-none focus:border-secondary"
                        aria-label="Filter by Label Count"
                      />
                    </td>
                  </tr>
                </thead>

                <tbody className="divide-y divide-outline-variant bg-surface font-body-sm">
                  {activeDataset.map((row, idx) => {
                    const isSelected = selectedRowIds.has(row.id);
                    const isPreviewRow = selectedPreviewIndex === idx;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedPreviewIndex(idx)}
                        className={`transition-colors cursor-pointer ${
                          isPreviewRow 
                            ? "bg-secondary-fixed/40 font-semibold" 
                            : isSelected 
                            ? "bg-surface-container-low hover:bg-surface-container" 
                            : "opacity-60 hover:opacity-100 hover:bg-surface-container-low"
                        }`}
                      >
                        {/* Row Selection Checkbox */}
                        <td className="px-3 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRowSelect(row.id)}
                            className="rounded text-secondary focus:ring-secondary h-3.5 w-3.5 cursor-pointer"
                            aria-label={`Select item ${row.stockNo}`}
                          />
                        </td>

                        <td className="px-3 py-1.5 font-code-md text-on-surface">{row.stockNo}</td>
                        <td className="px-3 py-1.5 text-on-surface truncate max-w-[160px]" title={row.product}>{row.product}</td>
                        <td className="px-3 py-1.5 text-on-surface">{row.brand}</td>
                        <td className="px-3 py-1.5 text-on-surface">{row.style}</td>
                        <td className="px-3 py-1.5 text-on-surface">{row.colour}</td>
                        <td className="px-3 py-1.5 text-on-surface">{row.size}</td>
                        <td className="px-3 py-1.5 text-right font-mono">₹{row.sellingPrice || row.mrp}</td>
                        
                        {/* Editable Label Quantity */}
                        <td className="px-3 py-1 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="number"
                            min="0"
                            value={row.labelCount}
                            onChange={e => handleInlineLabelChange(row.id, parseInt(e.target.value) || 0)}
                            className="w-20 text-center bg-surface border border-outline-variant rounded px-2 py-0.5 font-code-md font-bold focus:ring-1 focus:ring-secondary focus:border-secondary outline-none"
                            aria-label={`Label quantity for ${row.stockNo}`}
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {activeDataset.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-on-surface-variant">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Filter size={24} className="text-secondary opacity-60" />
                          <p className="font-semibold text-sm text-primary">No items match the active selection criteria.</p>
                          <p className="text-xs text-on-surface-variant max-w-md">
                            Adjust SKU ranges, product tags, or clear active filter chips above, then click <strong>"Load Results"</strong>.
                          </p>
                          <button
                            type="button"
                            onClick={handleClear}
                            className="mt-2 px-3 py-1.5 bg-secondary-fixed/50 hover:bg-secondary-fixed text-primary font-bold rounded text-xs transition"
                          >
                            Reset Selection Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Footer Bar (Matching items, selected items, stock, total labels) */}
            <div className="px-4 py-2.5 bg-surface-container-low border-t border-outline-variant flex flex-wrap justify-between items-center gap-3 shrink-0 text-xs">
              <div className="flex items-center gap-4">
                <span className="font-label-caps text-secondary font-bold">
                  Matched: <strong>{totalLoadedItems}</strong> items
                </span>
                <span className="font-label-caps text-primary font-bold">
                  Selected: <strong>{selectedItemsCount}</strong> items
                </span>
                {currentSelectedItem && (
                  <span className="text-[11px] text-on-surface-variant font-mono hidden md:inline">
                    • Previewing: <strong>{currentSelectedItem.stockNo}</strong> ({currentSelectedItem.product} - {currentSelectedItem.colour}/{currentSelectedItem.size})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5">
                  <span className="text-on-surface-variant">Current Stock:</span>
                  <span className="font-code-md font-bold text-on-surface">
                    {isFixedQuantitySource ? "N/A" : totalCurrentStockSum}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-on-surface-variant">Total Labels to Print:</span>
                  <span className="font-code-md font-extrabold text-secondary text-sm bg-secondary-fixed/50 px-2 py-0.5 rounded border border-secondary/30">
                    {selectedTotalLabels}
                  </span>
                </div>
              </div>
            </div>

          </section>

        </main>

      </div>

      {/* STEP 5: Bottom Fixed Action Bar / Safety Gate (Stitch Enterprise Specification) */}
      <footer className="fixed bottom-0 right-0 left-0 h-16 bg-surface-container-highest border-t border-outline-variant flex justify-between items-center px-4 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] print:hidden">
        
        {/* Safety Validation Status Indicator */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {safetyValidation.canPrint ? (
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
              <ShieldCheck size={14} className="text-emerald-700" />
              <span>Safety Gate Passed • Ready to print {selectedTotalLabels} label(s) across {selectedItemsCount} item(s)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-900 font-semibold bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300" title={safetyValidation.missingReasons.join(" • ")}>
              <ShieldAlert size={14} className="text-amber-800" />
              <span>Safety Gate Blocked: {safetyValidation.missingReasons[0]}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleClear}
            className="px-3.5 py-1.5 rounded border border-error text-error hover:bg-error-container transition-colors font-body-sm font-medium shadow-xs text-xs"
            title="Reset selection criteria and quantities"
          >
            Clear All
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-surface border border-outline-variant hover:bg-surface-variant text-on-surface transition-colors font-body-sm font-medium shadow-xs text-xs"
            title="Exit Tag Printing"
          >
            Exit
          </button>
          
          <button
            type="button"
            onClick={handlePrintCurrent}
            disabled={!currentSelectedItem || currentSelectedItem.labelCount <= 0}
            className="px-3.5 py-1.5 rounded bg-secondary-fixed/50 text-primary hover:bg-secondary-fixed disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-body-sm font-bold shadow-xs text-xs"
            title="Print label for current selected item"
          >
            Print Current ({currentSelectedItem?.labelCount || 1})
          </button>
          
          <button
            type="button"
            onClick={handlePrintAll}
            disabled={!safetyValidation.canPrint}
            className="px-5 py-2 rounded bg-primary text-on-primary hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all font-body-sm font-bold flex items-center gap-2 text-xs"
            title="Validate and print all selected labels (F8)"
          >
            <Printer size={15} />
            <span>Validate &amp; Print ({selectedTotalLabels})</span>
          </button>
        </div>
      </footer>

      {/* Safe Test Print Calibration Modal */}
      {showTestPrintModal && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150 font-sans">
          <div className="bg-surface text-on-surface rounded-xl border border-outline-variant w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3 bg-secondary text-on-secondary flex items-center justify-between font-title-sm font-bold text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} />
                <span>Safe Barcode Test Print &amp; Calibration</span>
              </div>
              <button type="button" onClick={() => setShowTestPrintModal(false)} className="hover:opacity-80">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 bg-surface text-body-sm text-xs">
              <p className="text-on-surface leading-relaxed">
                This will generate a single <strong>calibration test sticker</strong> to verify printer alignment, DPI density, and barcode readability without modifying or decrementing retail stock.
              </p>

              <div className="p-3 bg-surface-container rounded-lg border border-outline-variant space-y-1.5 font-code-md text-[11px]">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Printer:</span>
                  <span className="font-bold text-primary">{settings.targetPrinterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Port:</span>
                  <span className="font-bold text-primary">{settings.portSetting}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Resolution:</span>
                  <span className="font-bold text-primary">{settings.resolutionDpi || 300} DPI</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Format:</span>
                  <span className="font-bold text-primary">50mm x 25mm Thermal Sticker</span>
                </div>
              </div>

              {/* Sample Test Sticker Preview */}
              <div className="flex justify-center p-3 bg-surface-container-low border border-outline-variant rounded-lg">
                <div className="w-[50mm] h-[25mm] bg-white text-black p-1.5 rounded shadow-sm border border-gray-300 flex flex-col justify-between select-none">
                  <div className="flex justify-between items-center border-b border-black/30 pb-0.5 leading-none">
                    <span className="font-extrabold text-[8px] uppercase tracking-wide">TEST PRINT</span>
                    <span className="font-mono font-bold text-[9px]">₹999.00</span>
                  </div>
                  <div className="w-full flex justify-center py-0.5">
                    <ThermalBarcodeSvg
                      value="TEST-123456"
                      widthMm={40}
                      heightMm={9}
                      showText={true}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[7px] font-mono leading-none border-t border-black/30 pt-0.5">
                    <span>SMRITI 9 CALIBRATION</span>
                    <span>300 DPI</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-outline-variant bg-surface-container flex justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowTestPrintModal(false)}
                className="px-4 py-1.5 border border-outline-variant rounded hover:bg-surface-variant text-on-surface"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTestPrintModal(false);
                  onNotification?.("Test Print Complete", "Test calibration pattern rendered successfully.", "success");
                }}
                className="px-5 py-1.5 bg-secondary text-on-secondary rounded font-bold hover:bg-secondary/90 transition shadow-xs"
              >
                Dispatch Test Pattern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master Date Filter Dialog */}
      {showMasterFilterDialog && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150 font-sans">
          <div className="bg-surface text-on-surface rounded-xl border border-outline-variant w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3 bg-primary text-on-primary flex items-center gap-2 font-title-sm font-bold text-sm">
              <HelpCircle size={17} className="text-amber-300" />
              <span>Print Status Filter Confirmation</span>
            </div>

            <div className="p-5 space-y-3 bg-surface text-xs text-on-surface">
              <p className="font-semibold text-xs leading-relaxed text-primary">
                Do you want to display only those item details, entered in the date range ({masterDateFrom} to {masterDateTo}), for which labels are not printed?
              </p>
              <div className="text-on-surface-variant space-y-1 bg-surface-container-low p-2.5 rounded border border-outline-variant text-[11px]">
                <div>• <strong>Yes:</strong> Display only unprinted items entered in the period.</div>
                <div>• <strong>No:</strong> Display all items entered in the period (irrespective of print status).</div>
                <div>• <strong>Cancel:</strong> Abort selection process.</div>
              </div>
            </div>

            <div className="px-5 py-2.5 border-t border-outline-variant bg-surface-container flex justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowMasterFilterDialog(false)}
                className="px-3.5 py-1.5 border border-outline-variant rounded text-on-surface hover:bg-surface-variant"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMasterFilterResponse(false)}
                className="px-3.5 py-1.5 border border-secondary text-secondary bg-surface rounded font-bold hover:bg-secondary-fixed"
              >
                No (All Items)
              </button>
              <button
                type="button"
                onClick={() => handleMasterFilterResponse(true)}
                className="px-4 py-1.5 bg-primary text-on-primary rounded font-bold hover:bg-primary-container"
              >
                Yes (Unprinted Only)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Quantity Details Modal */}
      <EditQuantityDetailsModal
        isOpen={isEditQtyModalOpen}
        rows={activeDataset}
        onClose={() => setIsEditQtyModalOpen(false)}
        onSave={(updatedRows) => {
          if (isPtFileMode) {
            setPtRows(prev => prev.map(r => {
              const found = updatedRows.find(ur => ur.id === r.id);
              return found ? { ...r, labelCount: found.labelCount } : r;
            }));
          } else if (isTxMode) {
            setTxRows(prev => prev.map(r => {
              const found = updatedRows.find(ur => ur.id === r.id);
              return found ? { ...r, labelCount: found.labelCount } : r;
            }));
          } else if (isPoMode) {
            setPoRows(prev => prev.map(r => {
              const found = updatedRows.find(ur => ur.id === r.id);
              return found ? { ...r, labelCount: found.labelCount } : r;
            }));
          } else if (isMasterMode) {
            setMasterRows(prev => prev.map(r => {
              const found = updatedRows.find(ur => ur.id === r.id);
              return found ? { ...r, labelCount: found.labelCount } : r;
            }));
          } else if (isDirectScanMode) {
            setScannedRows(prev => prev.map(r => {
              const found = updatedRows.find(ur => ur.id === r.id);
              return found ? { ...r, labelCount: found.labelCount } : r;
            }));
          } else if (isPdtFileMode) {
            setPdtRows(prev => prev.map(r => {
              const found = updatedRows.find(ur => ur.id === r.id);
              return found ? { ...r, labelCount: found.labelCount } : r;
            }));
          } else {
            setGridRows(prev => prev.map(r => {
              const found = updatedRows.find(ur => ur.id === r.id);
              return found ? { ...r, labelCount: found.labelCount } : r;
            }));
          }
          onNotification?.("Quantities Updated", "Updated label print counts per item.", "success");
        }}
      />

      {/* Barcode Printer Select Modal */}
      <BarcodePrinterSelectModal
        isOpen={isPrinterSelectModalOpen}
        currentPort={settings.portSetting}
        scriptFileName={settings.scriptFileName}
        onClose={() => setIsPrinterSelectModalOpen(false)}
        onConfirm={(cfg) => {
          setSettings(prev => ({
            ...prev,
            portSetting: cfg.portType,
            targetPrinterName: cfg.printerName,
            resolutionDpi: cfg.dpi
          }));
          onNotification?.("Printer Configured", `Target set to ${cfg.printerName} (${cfg.portType}, ${cfg.dpi} DPI)`, "success");
        }}
      />

      {/* F2 Product Browse Modal */}
      <PurchaseProductBrowseModal
        products={products}
        isOpen={isF2BrowseModalOpen}
        onClose={() => setIsF2BrowseModalOpen(false)}
        onSelectProduct={(prod) => {
          if (f2BrowseTarget === "stockNoFrom") {
            setItemCriteria(prev => ({ ...prev, stockNoFrom: prod.code || "" }));
          } else {
            setItemCriteria(prev => ({ ...prev, stockNoTo: prod.code || "" }));
          }
          setIsF2BrowseModalOpen(false);
        }}
      />

      {/* STEP 5: Live Thermal Sticker Preview & Final Print Confirmation Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150 print:hidden font-sans">
          <div className="bg-surface text-on-surface rounded-xl border border-outline-variant w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-5 py-3 bg-primary text-on-primary flex justify-between items-center font-title-sm font-bold text-sm">
              <span className="flex items-center gap-2">
                <Printer size={17} />
                Final Barcode Print Confirmation Summary — [{settings.sourceOption}]
              </span>
              <button type="button" onClick={() => setShowDispatchModal(false)} className="text-on-primary hover:opacity-80">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs bg-surface overflow-y-auto">
              
              {/* Target & Batch Overview */}
              <div className="bg-surface-container p-3 rounded-lg border border-outline-variant grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <div className="text-[10px] text-on-surface-variant">Printer:</div>
                  <div className="font-bold text-primary truncate" title={settings.targetPrinterName}>
                    {settings.targetPrinterName}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-on-surface-variant">Port &amp; DPI:</div>
                  <div className="font-bold text-on-surface">{settings.portSetting} • {settings.resolutionDpi || 300} DPI</div>
                </div>
                <div>
                  <div className="text-[10px] text-on-surface-variant">Selected Items:</div>
                  <div className="font-bold text-primary">{activePrintItems.length} items</div>
                </div>
                <div>
                  <div className="text-[10px] text-on-surface-variant">Total Labels:</div>
                  <div className="font-extrabold text-secondary font-code-md text-sm">{activePrintTotalLabels} labels</div>
                </div>
              </div>

              {/* Live Thermal Sticker Preview */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-label-caps text-[10px] text-primary">
                    Live Sticker Preview (50mm x 25mm Roll)
                  </span>
                  <span className="text-[10px] font-code-md text-on-surface-variant">300 DPI Rendering</span>
                </div>
                
                {activePrintItems.length > 0 && (
                  <div className="flex items-center justify-center p-3 bg-surface-container-low border border-outline-variant rounded-lg">
                    <div className="w-[50mm] h-[25mm] bg-white text-black p-1.5 rounded shadow-md border border-gray-300 flex flex-col justify-between select-none">
                      <div className="flex justify-between items-center border-b border-black/30 pb-0.5 leading-none">
                        <span className="font-extrabold text-[8.5px] uppercase tracking-wide truncate max-w-[28mm]">
                          {activePrintItems[0].brand || "SMRITI RETAIL"}
                        </span>
                        <span className="font-mono font-bold text-[9.5px]">
                          ₹{activePrintItems[0].sellingPrice || activePrintItems[0].mrp}
                        </span>
                      </div>

                      <div className="text-[7.5px] font-semibold truncate leading-tight my-0.5">
                        <span>{activePrintItems[0].product}</span>
                        <span className="text-[7px] text-gray-700 ml-1">({activePrintItems[0].style})</span>
                      </div>

                      <div className="w-full flex justify-center py-0.5">
                        <ThermalBarcodeSvg
                          value={activePrintItems[0].barcode || activePrintItems[0].stockNo}
                          widthMm={44}
                          heightMm={9}
                          showText={true}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[7px] font-mono leading-none border-t border-black/30 pt-0.5">
                        <span>{activePrintItems[0].colour} / S:{activePrintItems[0].size}</span>
                        <span className="font-semibold text-[6.5px] text-gray-600">MRP: ₹{activePrintItems[0].mrp}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Items in Queue list */}
              <div className="max-h-32 overflow-y-auto border border-outline-variant rounded-lg bg-surface-container-lowest p-2 space-y-1 font-code-md text-[11px]">
                <span className="font-bold text-on-surface-variant text-[10px] block font-sans">
                  Active Dispatch Items ({activePrintItems.length}):
                </span>
                {activePrintItems.map(r => (
                  <div key={r.id} className="flex justify-between items-center py-0.5 border-b border-outline-variant/30">
                    <span className="truncate">{r.stockNo} - {r.product} ({r.colour}/{r.size})</span>
                    <span className="font-bold text-primary bg-secondary-fixed/50 px-1.5 py-0.2 rounded shrink-0">
                      {r.labelCount} {r.labelCount === 1 ? "lbl" : "lbls"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Safe Print Instructions */}
              <div className="bg-secondary-fixed/30 border border-secondary/30 rounded-lg p-2.5 flex items-start gap-2 text-primary">
                <Info size={15} className="text-secondary shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Print Dispatch Instructions:</strong> Click <strong>"Print from Browser"</strong> and select <strong>"IMPACT by Honeywell IH-2 (300 dpi) - DPL"</strong> (or thermal printer) in your system dialog.
                </div>
              </div>

            </div>

            <div className="px-5 py-3 border-t border-outline-variant bg-surface-container flex flex-wrap justify-between items-center gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const content = generateRawDplScript();
                    const blob = new Blob([content], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Honeywell_IH2_Labels_${Date.now()}.prn`;
                    a.click();
                    URL.revokeObjectURL(url);
                    onNotification?.("File Downloaded", "Downloaded raw PRN script for Honeywell IH-2.", "success");
                  }}
                  className="px-3 py-1.5 bg-surface border border-outline-variant hover:bg-surface-variant rounded text-xs font-semibold flex items-center gap-1.5 text-on-surface"
                >
                  <Download size={12} />
                  <span>Download PRN</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generateRawDplScript());
                    onNotification?.("Copied", "Copied raw DPL script commands to clipboard.", "success");
                  }}
                  className="px-3 py-1.5 bg-surface border border-outline-variant hover:bg-surface-variant rounded text-xs font-semibold flex items-center gap-1.5 text-on-surface"
                >
                  <Copy size={12} />
                  <span>Copy DPL</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-3.5 py-1.5 border border-outline-variant rounded text-on-surface text-xs font-semibold hover:bg-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className="px-5 py-1.5 bg-primary text-on-primary rounded font-bold hover:bg-primary-container transition shadow-md flex items-center gap-1.5 text-xs"
                >
                  <Printer size={14} />
                  <span>Confirm &amp; Print ({activePrintTotalLabels})</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default TagLabelPrintingTab;
