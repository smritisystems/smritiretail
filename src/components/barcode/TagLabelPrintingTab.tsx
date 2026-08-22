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
 * Source Module: Stitch Barcode Label Designer & Printer (Industrial Logic)
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Product } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import {
  LabelPrintRow,
  LabelPrintSettings,
  SelectionCriteriaRange,
  PortType,
  LabelSourceOption
} from "./types.ts";
import { EditQuantityDetailsModal } from "./EditQuantityDetailsModal.tsx";
import { BarcodeScriptGenerationView } from "./BarcodeScriptGenerationView.tsx";
import { BarcodePrinterSelectModal } from "./BarcodePrinterSelectModal.tsx";
import { PurchaseProductBrowseModal } from "../purchase/PurchaseProductBrowseModal.tsx";
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
  LogOut, 
  Eye, 
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileUp,
  CheckCircle2
} from "lucide-react";

interface TagLabelPrintingTabProps {
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
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
  const [filterSearch, setFilterSearch] = useState<string>("");
  
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
    targetPrinterName: "IMPACT by Honeywell IH-2 (300 dpi) - DPL"
  });

  // 1. Selection Criteria Ranges (Manual Mode)
  const [criteria, setCriteria] = useState<SelectionCriteriaRange>({
    stockNoFrom: "000006",
    stockNoTo: "000008",
    brandFrom: "",
    brandTo: "",
    productFrom: "",
    productTo: "",
    colourFrom: "",
    colourTo: "",
    styleFrom: "",
    styleTo: "",
    sizeFrom: "",
    sizeTo: ""
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
      // F8 -> Print All
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
        { id: "6", code: "000012", name: "Trouser", category: "Apparel", brand: "Beanstalk", color: "Olive", styleCode: "Cargo", size: "36", mrp: 1899, price: 1499, stock: 6, barcode: "890100000012" }
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
  };

  // Distinct options for dropdown lists in Manual mode
  const uniqueBrands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))), [products]);
  const uniqueProducts = useMemo(() => Array.from(new Set(products.map(p => p.name || p.category).filter(Boolean))), [products]);
  const uniqueColours = useMemo(() => Array.from(new Set(products.map(p => p.color).filter(Boolean))), [products]);
  const uniqueStyles = useMemo(() => Array.from(new Set(products.map(p => p.styleCode).filter(Boolean))), [products]);
  const uniqueSizes = useMemo(() => Array.from(new Set(products.map(p => p.size).filter(Boolean))), [products]);

  // Mode Determinations
  const isManualMode = settings.sourceOption === "Manual Selection";
  const isPtFileMode = settings.sourceOption === "Against Purchase (PT File)";
  const isTxMode = settings.sourceOption === "Against Transactions";
  const isPoMode = settings.sourceOption === "Against Purchase Order";
  const isMasterMode = settings.sourceOption === "Against Masters";
  const isDirectScanMode = settings.sourceOption === "Against Direct Scan";
  const isPdtFileMode = settings.sourceOption === "Against PDT File";

  const isFixedQuantitySource = isPtFileMode || isTxMode || isPoMode;

  // Active Dataset Resolution
  const rawDataset: LabelPrintRow[] = useMemo(() => {
    if (isPtFileMode) return ptRows;
    if (isTxMode) return txRows;
    if (isPoMode) return poRows;
    if (isMasterMode) return masterRows;
    if (isDirectScanMode) return scannedRows;
    if (isPdtFileMode) return pdtRows;

    return gridRows.filter(row => {
      if (criteria.stockNoFrom && row.stockNo < criteria.stockNoFrom) return false;
      if (criteria.stockNoTo && row.stockNo > criteria.stockNoTo) return false;
      if (criteria.brandFrom && row.brand < criteria.brandFrom) return false;
      if (criteria.brandTo && row.brand > criteria.brandTo) return false;
      if (criteria.productFrom && row.product < criteria.productFrom) return false;
      if (criteria.productTo && row.product > criteria.productTo) return false;
      if (criteria.colourFrom && row.colour < criteria.colourFrom) return false;
      if (criteria.colourTo && row.colour > criteria.colourTo) return false;
      if (criteria.styleFrom && row.style < criteria.styleFrom) return false;
      if (criteria.styleTo && row.style > criteria.styleTo) return false;
      if (criteria.sizeFrom && row.size < criteria.sizeFrom) return false;
      if (criteria.sizeTo && row.size > criteria.sizeTo) return false;
      return true;
    });
  }, [
    isPtFileMode, isTxMode, isPoMode, isMasterMode, isDirectScanMode, isPdtFileMode,
    ptRows, txRows, poRows, masterRows, scannedRows, pdtRows,
    gridRows, criteria
  ]);

  // Filtered by Search input & Sorted
  const activeDataset = useMemo(() => {
    let list = rawDataset;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
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

    if (sortField) {
      list = [...list].sort((a, b) => {
        const valA = a[sortField] ?? "";
        const valB = b[sortField] ?? "";
        if (typeof valA === "number" && typeof valB === "number") {
          return sortDirection === "asc" ? valA - valB : valB - valA;
        }
        return sortDirection === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return list;
  }, [rawDataset, filterSearch, sortField, sortDirection]);

  const currentSelectedItem: LabelPrintRow | undefined = activeDataset[selectedPreviewIndex] || activeDataset[0];

  const totalLoadedItems = activeDataset.length;
  const totalLabelsSum = useMemo(() => {
    return activeDataset.reduce((sum, r) => sum + (Number(r.labelCount) || 0), 0);
  }, [activeDataset]);

  // Sort Toggle Handler
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

  // Load Results Handler (Primary Button in Selection Criteria Card)
  const handleLoadResults = () => {
    if (isTxMode) {
      const results = queryTransactionItems(txDocType, txDocPrefix, txDocFrom, txDocTo);
      setTxRows(results);
      setSelectedPreviewIndex(0);
      onNotification?.("Transactions Loaded", `Loaded ${results.length} items from ${txDocType} [${txDocPrefix}${txDocFrom}–${txDocTo}]`, "success");
    } else if (isPoMode) {
      const results = queryPurchaseOrderItems(poPrefix, poNoFrom, poNoTo);
      setPoRows(results);
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
      setSelectedPreviewIndex(0);
      onNotification?.("PDT Loaded", `Loaded ${pdtRows.length} items from PDT file.`, "success");
    } else {
      setSelectedPreviewIndex(0);
      onNotification?.("Results Loaded", `Loaded ${activeDataset.length} item(s) in grid.`, "success");
    }

    if (settings.scriptFileName.toLowerCase().endsWith(".blf")) {
      setIsPrinterSelectModalOpen(true);
    }
  };

  // Master Filter Dialog Responses (Yes / No / Cancel)
  const handleMasterFilterResponse = (unprintedOnly: boolean) => {
    setShowMasterFilterDialog(false);
    const results = queryMasterItemsByDate(masterDateFrom, masterDateTo, unprintedOnly);
    setMasterRows(results);
    setSelectedPreviewIndex(0);
    onNotification?.(
      "Masters Loaded", 
      `Loaded ${results.length} items from master file (${unprintedOnly ? "Unprinted only" : "All records in period"}).`, 
      "success"
    );
    if (settings.scriptFileName.toLowerCase().endsWith(".blf")) {
      setIsPrinterSelectModalOpen(true);
    }
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
        setSelectedPreviewIndex(0);
        onNotification?.("PDT File Loaded", `Parsed ${rows.length} records from ${file.name}`, "success");
      }
    };
    reader.readAsText(file);
  };

  // Clear Session
  const handleClear = () => {
    setCriteria({
      stockNoFrom: "",
      stockNoTo: "",
      brandFrom: "",
      brandTo: "",
      productFrom: "",
      productTo: "",
      colourFrom: "",
      colourTo: "",
      styleFrom: "",
      styleTo: "",
      sizeFrom: "",
      sizeTo: ""
    });
    setFilterSearch("");
    setSortField(null);
    setSortDirection("asc");
    setSelectedPreviewIndex(0);
    setGridRows(prev => prev.map(r => ({ ...r, labelCount: 1 })));
    setScannedRows([]);
    setPdtRows([]);
    onNotification?.("Session Cleared", "Reset selection criteria and label quantities.", "success");
  };

  // Print Current (Single Item)
  const handlePrintCurrent = () => {
    if (!currentSelectedItem) {
      onNotification?.("No Item Selected", "Please select an item from the grid to print.", "error");
      return;
    }
    setIsSinglePrintMode(true);
    setShowDispatchModal(true);
  };

  // Print All (Batch)
  const handlePrintAll = () => {
    const validCount = activeDataset.filter(r => r.labelCount > 0);
    if (validCount.length === 0) {
      onNotification?.("No Labels Specified", "No items have label quantity greater than 0 to print.", "error");
      return;
    }
    setIsSinglePrintMode(false);
    setShowDispatchModal(true);
  };

  const activePrintItems = useMemo(() => {
    if (isSinglePrintMode && currentSelectedItem) {
      return [{ ...currentSelectedItem, labelCount: Math.max(1, currentSelectedItem.labelCount) }];
    }
    return activeDataset.filter(r => r.labelCount > 0);
  }, [isSinglePrintMode, currentSelectedItem, activeDataset]);

  const activePrintTotalLabels = useMemo(() => {
    return activePrintItems.reduce((sum, r) => sum + r.labelCount, 0);
  }, [activePrintItems]);

  // Browser Print Trigger
  const handleBrowserPrint = () => {
    setShowDispatchModal(false);
    setTimeout(() => {
      window.print();
      onNotification?.("Print Dispatched", `Sent ${activePrintTotalLabels} label(s) to Windows print queue.`, "success");
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
    if (isPtFileMode) return "Ready to print labels based on purchase transaction records.";
    if (isTxMode) return "Ready to print labels based on transaction records.";
    if (isPoMode) return "Ready to print labels based on purchase order records.";
    if (isMasterMode) return "Ready to print labels based on master file records.";
    if (isDirectScanMode) return "Ready to print labels based on real-time scanner input.";
    if (isPdtFileMode) return "Ready to print labels based on portable data terminal records.";
    return "Ready to print labels based on manual selection.";
  }, [isPtFileMode, isTxMode, isPoMode, isMasterMode, isDirectScanMode, isPdtFileMode]);

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

      {/* Top Application Header Bar */}
      <header className="h-14 border-b border-outline-variant bg-surface-container flex justify-between items-center px-margin-page shrink-0 shadow-xs z-20 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-primary font-bold font-title-sm text-title-sm">
            <Printer size={20} className="text-secondary" />
            <span>Tag &amp; Barcode Label Printing</span>
            <span className="text-label-caps font-label-caps bg-primary-container text-on-primary-container px-2.5 py-0.5 rounded-full ml-2">
              {settings.sourceOption}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditQtyModalOpen(true)}
            className="px-3.5 py-1.5 bg-surface border border-outline-variant hover:bg-surface-variant text-on-surface rounded font-body-sm font-semibold transition flex items-center gap-2 shadow-xs"
            title="Open Batch Quantity Editor (F11)"
          >
            <Edit3 size={15} className="text-secondary" />
            <span>Edit Quantities</span>
            <span className="text-[10px] font-code-md text-on-surface-variant bg-surface-container px-1 rounded">[F11]</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPrinterSelectModalOpen(true)}
            className="px-3.5 py-1.5 bg-surface border border-outline-variant hover:bg-surface-variant text-on-surface rounded font-body-sm font-medium transition flex items-center gap-2 shadow-xs"
          >
            <Printer size={15} className="text-secondary" />
            <span className="truncate max-w-[200px]">{settings.targetPrinterName || "Configure Printer"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("designer")}
            className="px-3.5 py-1.5 bg-primary text-on-primary hover:bg-primary-container rounded font-body-sm font-semibold transition flex items-center gap-2 shadow-xs"
          >
            <Code size={15} />
            <span>Barcode Script Designer</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Frame: Left Sidebar + Main Content */}
      <div className="flex-1 flex overflow-hidden print:hidden pb-16">
        
        {/* Left Sidebar: Fixed Width (280px), Scrollable Configuration */}
        <aside className="w-72 bg-surface-container-low border-r border-outline-variant flex flex-col p-4 gap-4 overflow-y-auto shrink-0 z-10">
          
          {/* 1. Label Printing Parameters Card */}
          <section className="bg-surface border border-outline-variant rounded-lg p-3.5 flex flex-col gap-3 shadow-xs border-t-2 border-t-secondary">
            <h3 className="font-title-sm text-xs font-bold text-primary flex items-center gap-1.5 border-b border-surface-variant pb-1.5 uppercase tracking-wider">
              <Sliders size={14} className="text-secondary" />
              Label Printing Parameters
            </h3>

            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-[11px] text-on-surface-variant">Script File Name</label>
              <div className="flex">
                <input
                  type="text"
                  value={settings.scriptFileName}
                  onChange={e => setSettings({ ...settings, scriptFileName: e.target.value })}
                  className="flex-1 bg-surface border border-outline-variant border-r-0 rounded-l px-2.5 py-1 text-xs font-code-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-surface-variant border border-outline-variant rounded-r px-2 py-1 hover:bg-surface-dim transition-colors text-xs font-medium"
                >
                  Browse...
                </button>
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
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-[11px] text-on-surface-variant">Labels Per Row</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={settings.labelsPerRow}
                  onChange={e => setSettings({ ...settings, labelsPerRow: parseInt(e.target.value) || 1 })}
                  className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-xs font-code-md text-center focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-[11px] text-on-surface-variant">Target Port</label>
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
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-on-surface">
                <input
                  type="checkbox"
                  checked={settings.outputToPort}
                  onChange={e => setSettings({ ...settings, outputToPort: e.target.checked })}
                  className="text-secondary focus:ring-secondary rounded h-3.5 w-3.5"
                />
                <span>Output to Port</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-on-surface">
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

          {/* 2. Source Option Card */}
          <section className="bg-surface border border-outline-variant rounded-lg p-3.5 flex flex-col gap-2.5 shadow-xs border-t-2 border-t-primary">
            <h3 className="font-title-sm text-xs font-bold text-primary flex items-center gap-1.5 border-b border-surface-variant pb-1.5 uppercase tracking-wider">
              <Layers size={14} className="text-secondary" />
              Option
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
                      ? "bg-secondary-fixed/40 text-primary font-bold" 
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

          {/* 3. Labels to Print Summary Card */}
          <section className="bg-surface border border-outline-variant rounded-lg p-3.5 flex flex-col gap-2.5 shadow-xs border-t-2 border-t-secondary">
            <h3 className="font-title-sm text-xs font-bold text-primary flex items-center gap-1.5 border-b border-surface-variant pb-1.5 uppercase tracking-wider">
              <Printer size={14} className="text-secondary" />
              Labels to Print
            </h3>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex gap-4">
                <label
                  className={`flex items-center gap-1.5 font-medium ${isFixedQuantitySource ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  title={isFixedQuantitySource ? "This option is not available as we cannot specify a quantity in this case." : ""}
                >
                  <input
                    type="radio"
                    name="qtyMode"
                    disabled={isFixedQuantitySource}
                    checked={!isFixedQuantitySource && settings.quantityMode === "Specified Quantity"}
                    onChange={() => setSettings({ ...settings, quantityMode: "Specified Quantity" })}
                    className="text-secondary"
                  />
                  <span>Specified Quantity</span>
                </label>
                <label
                  className="flex items-center gap-1.5 font-medium opacity-40 cursor-not-allowed"
                  title="This option is not available in HO."
                >
                  <input
                    type="radio"
                    name="qtyMode"
                    disabled={true}
                    checked={false}
                    className="text-secondary"
                  />
                  <span>Present Stock (N/A in HO)</span>
                </label>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-on-surface-variant text-xs">Total Records:</span>
                <input
                  type="text"
                  readOnly
                  value={totalLoadedItems}
                  className="w-24 text-right bg-surface-container border border-outline-variant rounded px-2 py-0.5 font-code-md font-bold text-on-surface text-xs"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant text-xs">Current Stock:</span>
                <input
                  type="text"
                  readOnly
                  disabled={isFixedQuantitySource}
                  value={isFixedQuantitySource ? "N/A in HO" : activeDataset.reduce((s, r) => s + r.currentStock, 0)}
                  className="w-24 text-right bg-surface-container border border-outline-variant rounded px-2 py-0.5 font-code-md text-on-surface-variant text-xs disabled:opacity-60"
                />
              </div>

              <div className="flex justify-between items-center border-t border-outline-variant pt-2">
                <span className="text-primary font-bold text-xs">Total Labels to Print:</span>
                <div className="font-code-md font-bold text-secondary text-sm px-2 py-0.5 bg-secondary-fixed/50 rounded border border-secondary/30">
                  {totalLabelsSum}
                </div>
              </div>
            </div>
          </section>

        </aside>

        {/* Main Content Area: Top Selection Criteria + Bottom Results Grid */}
        <main className="flex-1 flex flex-col p-margin-page gap-stack-gap overflow-y-auto bg-surface-container-lowest">
          
          {/* Top Card: Selection Criteria / Ingestion Panel */}
          <section className="bg-surface border border-outline-variant rounded-lg p-4 flex flex-col gap-3 shadow-xs border-t-4 border-t-primary shrink-0">
            <div className="flex justify-between items-center border-b border-surface-variant pb-2">
              <h3 className="font-title-sm text-sm font-bold text-primary flex items-center gap-2">
                <Filter size={16} className="text-secondary" />
                <span>
                  {isPtFileMode && "Purchase Transaction (PT) File Selection"}
                  {isTxMode && "Transaction Selection Criteria"}
                  {isPoMode && "Purchase Order Selection Criteria"}
                  {isMasterMode && "Master Records Period Filter"}
                  {isDirectScanMode && "Direct Barcode Scanning Input"}
                  {isPdtFileMode && "PDT Ingestion File Selection"}
                  {isManualMode && "Selection Criteria"}
                </span>
              </h3>

              {/* 4-Way Record Navigator Bar */}
              {totalLoadedItems > 0 && (
                <div className="flex items-center gap-1 text-xs bg-surface-container-low px-2 py-1 rounded border border-outline-variant">
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
                    <ChevronsLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavPrev}
                    disabled={selectedPreviewIndex === 0}
                    className="p-1 rounded hover:bg-surface-variant disabled:opacity-30 text-primary transition"
                    title="Previous Record (<)"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavNext}
                    disabled={selectedPreviewIndex >= totalLoadedItems - 1}
                    className="p-1 rounded hover:bg-surface-variant disabled:opacity-30 text-primary transition"
                    title="Next Record (>)"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavLast}
                    disabled={selectedPreviewIndex >= totalLoadedItems - 1}
                    className="p-1 rounded hover:bg-surface-variant disabled:opacity-30 text-primary transition"
                    title="Last Record (>>|)"
                  >
                    <ChevronsRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* A. Manual Mode Criteria */}
            {isManualMode && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="font-label-caps text-on-surface-variant">Stock No From</label>
                      <span className="text-[9px] font-code-md text-secondary font-bold cursor-pointer" onClick={() => { setF2BrowseTarget("stockNoFrom"); setIsF2BrowseModalOpen(true); }}>[F2 Browse]</span>
                    </div>
                    <input
                      type="text"
                      value={criteria.stockNoFrom}
                      onChange={e => setCriteria({ ...criteria, stockNoFrom: e.target.value })}
                      placeholder="e.g. 000006"
                      className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-body-sm font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="font-label-caps text-on-surface-variant">Stock No To</label>
                      <span className="text-[9px] font-code-md text-secondary font-bold cursor-pointer" onClick={() => { setF2BrowseTarget("stockNoTo"); setIsF2BrowseModalOpen(true); }}>[F2 Browse]</span>
                    </div>
                    <input
                      type="text"
                      value={criteria.stockNoTo}
                      onChange={e => setCriteria({ ...criteria, stockNoTo: e.target.value })}
                      placeholder="e.g. 000008"
                      className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-body-sm font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-label-caps text-on-surface-variant">Product Filter</label>
                    <select
                      value={criteria.productFrom}
                      onChange={e => setCriteria({ ...criteria, productFrom: e.target.value, productTo: e.target.value })}
                      className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-body-sm font-medium focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                    >
                      <option value="">(All Products)</option>
                      {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div className="flex">
                    <button
                      type="button"
                      onClick={handleLoadResults}
                      className="w-full bg-primary-container text-on-primary px-4 py-2 rounded font-body-sm font-medium hover:bg-primary transition-colors flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Download size={16} />
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
                      className="flex-1 bg-surface border border-outline-variant border-r-0 rounded-l px-3 py-1.5 text-body-sm font-code-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => ptFileInputRef.current?.click()}
                      className="bg-surface-variant border border-outline-variant rounded-r px-3 py-1.5 hover:bg-surface-dim transition-colors text-body-sm font-medium"
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
                  <p className="text-[10px] text-on-surface-variant mt-0.5">Select a valid purchase transaction file to load item quantities.</p>
                </div>
                <div className="flex shrink-0 pb-4">
                  <button
                    type="button"
                    onClick={handleLoadResults}
                    className="bg-primary-container text-on-primary px-5 py-2 rounded font-body-sm font-medium hover:bg-primary transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <Download size={16} />
                    <span>Load Results</span>
                  </button>
                </div>
              </div>
            )}

            {/* C. Transactions Ingestion */}
            {isTxMode && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                  <label className="font-label-caps text-on-surface-variant">Transaction Type</label>
                  <select
                    value={txDocType}
                    onChange={e => setTxDocType(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-body-sm font-medium focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  >
                    <option value="Purchase Inward (GRN)">Purchase Inward (GRN)</option>
                    <option value="Sales Return Inward">Sales Return Inward</option>
                    <option value="Stock Transfer Inward">Stock Transfer Inward</option>
                    <option value="POS Exchange">POS Exchange</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                  <label className="font-label-caps text-on-surface-variant">Doc No Prefix</label>
                  <input
                    type="text"
                    value={txDocPrefix}
                    onChange={e => setTxDocPrefix(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-body-sm font-code-md uppercase focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                  <label className="font-label-caps text-on-surface-variant">Doc No From</label>
                  <input
                    type="text"
                    value={txDocFrom}
                    onChange={e => setTxDocFrom(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-body-sm font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                  <label className="font-label-caps text-on-surface-variant">Doc No To</label>
                  <input
                    type="text"
                    value={txDocTo}
                    onChange={e => setTxDocTo(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-body-sm font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={handleLoadResults}
                    className="bg-primary-container text-on-primary px-5 py-2 rounded font-body-sm font-medium hover:bg-primary transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <Download size={16} />
                    <span>Load Results</span>
                  </button>
                </div>
              </div>
            )}

            {/* D. Purchase Order Ingestion */}
            {isPoMode && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                  <label className="font-label-caps text-on-surface-variant">PO Prefix</label>
                  <input
                    type="text"
                    value={poPrefix}
                    onChange={e => setPoPrefix(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-body-sm font-code-md uppercase focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                  <label className="font-label-caps text-on-surface-variant">PO No From</label>
                  <input
                    type="text"
                    value={poNoFrom}
                    onChange={e => setPoNoFrom(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-body-sm font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                  <label className="font-label-caps text-on-surface-variant">PO No To</label>
                  <input
                    type="text"
                    value={poNoTo}
                    onChange={e => setPoNoTo(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-body-sm font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={handleLoadResults}
                    className="bg-primary-container text-on-primary px-5 py-2 rounded font-body-sm font-medium hover:bg-primary transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <Download size={16} />
                    <span>Load Results</span>
                  </button>
                </div>
              </div>
            )}

            {/* E. Master Period Ingestion */}
            {isMasterMode && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                  <label className="font-label-caps text-on-surface-variant">Date From</label>
                  <input
                    type="date"
                    value={masterDateFrom}
                    onChange={e => setMasterDateFrom(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-body-sm font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                  <label className="font-label-caps text-on-surface-variant">Date To</label>
                  <input
                    type="date"
                    value={masterDateTo}
                    onChange={e => setMasterDateTo(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-3 py-1.5 text-body-sm font-code-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={handleLoadResults}
                    className="bg-primary-container text-on-primary px-5 py-2 rounded font-body-sm font-medium hover:bg-primary transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <Download size={16} />
                    <span>Load Results</span>
                  </button>
                </div>
              </div>
            )}

            {/* F. Direct Scan Ingestion */}
            {isDirectScanMode && (
              <form onSubmit={handleDirectScanSubmit} className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="font-label-caps text-on-surface-variant flex items-center gap-1">
                    <Zap size={14} className="text-secondary" />
                    <span>Stock No. / Barcode Scanner</span>
                  </label>
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={directScanInput}
                    onChange={e => setDirectScanInput(e.target.value)}
                    placeholder="Scan or enter Stock No..."
                    className="w-full bg-surface border-2 border-secondary rounded px-3 py-1.5 text-body-sm font-code-md font-bold focus:ring-1 focus:ring-secondary outline-none"
                  />
                </div>
                <div className="flex items-center gap-3 pb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-body-sm text-primary">
                    <input
                      type="checkbox"
                      checked={autoPrintOneLabel}
                      onChange={e => setAutoPrintOneLabel(e.target.checked)}
                      className="text-secondary rounded"
                    />
                    <span>Automatically Print One Label on Scan</span>
                  </label>
                  {!autoPrintOneLabel && (
                    <input
                      type="number"
                      min="1"
                      value={directScanLabelCount}
                      onChange={e => setDirectScanLabelCount(parseInt(e.target.value) || 1)}
                      className="w-20 text-center bg-surface border border-outline-variant rounded py-1 text-body-sm font-code-md"
                    />
                  )}
                </div>
                <div className="flex shrink-0">
                  <button
                    type="submit"
                    className="bg-primary text-on-primary px-5 py-2 rounded font-body-sm font-bold hover:bg-primary-container transition-colors shadow-xs"
                  >
                    Enter
                  </button>
                </div>
              </form>
            )}

            {/* G. PDT Ingestion */}
            {isPdtFileMode && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
                  <label className="font-label-caps text-on-surface-variant">PDT Delimited File</label>
                  <div className="flex">
                    <input
                      type="text"
                      value={pdtFileName}
                      onChange={e => setPdtFileName(e.target.value)}
                      placeholder="Select .pdt or .csv file"
                      className="flex-1 bg-surface border border-outline-variant border-r-0 rounded-l px-3 py-1.5 text-body-sm font-code-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => pdtFileInputRef.current?.click()}
                      className="bg-surface-variant border border-outline-variant rounded-r px-3 py-1.5 hover:bg-surface-dim transition-colors text-body-sm font-medium"
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
                  <p className="text-[10px] text-on-surface-variant mt-0.5">Ingest barcodes &amp; quantities directly from hand-held terminal exports.</p>
                </div>
                <div className="flex shrink-0 pb-4">
                  <button
                    type="button"
                    onClick={handleLoadResults}
                    className="bg-primary-container text-on-primary px-5 py-2 rounded font-body-sm font-medium hover:bg-primary transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <Download size={16} />
                    <span>Load Results</span>
                  </button>
                </div>
              </div>
            )}

          </section>

          {/* Bottom Card: Item Preview & Results Grid View (Full Stitch Data Grid) */}
          <section className="bg-surface border border-outline-variant rounded-lg p-0 flex flex-col flex-1 shadow-sm overflow-hidden min-h-[300px]">
            
            {/* Data Grid Header Bar */}
            <div className="bg-surface-container-low border-b border-outline-variant px-4 py-2 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4 flex-1">
                <span className="font-label-caps text-label-caps text-secondary font-bold shrink-0">
                  Loaded Items ({totalLoadedItems})
                </span>
                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    placeholder="Filter results..."
                    className="w-full pl-8 pr-3 py-1 bg-surface border border-outline-variant rounded text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                  />
                </div>
              </div>
              <span className="text-body-sm text-on-surface-variant ml-4 font-medium">Click headers to sort • Click row to select</span>
            </div>

            {/* Grid Table Container */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse font-sans">
                <thead className="sticky top-0 bg-surface-container-high z-10 shadow-xs">
                  <tr className="border-b border-outline-variant">
                    <th 
                      onClick={() => handleSortToggle("stockNo")}
                      className="px-3 py-2 font-label-caps text-label-caps text-on-surface-variant bg-surface-container-high cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Stock No</span>
                        {sortField === "stockNo" ? (
                          sortDirection === "asc" ? <ArrowUp size={13} className="text-secondary font-bold" /> : <ArrowDown size={13} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={13} className="opacity-50" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSortToggle("product")}
                      className="px-3 py-2 font-label-caps text-label-caps text-on-surface-variant bg-surface-container-high cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Product</span>
                        {sortField === "product" ? (
                          sortDirection === "asc" ? <ArrowUp size={13} className="text-secondary font-bold" /> : <ArrowDown size={13} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={13} className="opacity-50" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSortToggle("brand")}
                      className="px-3 py-2 font-label-caps text-label-caps text-on-surface-variant bg-surface-container-high cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Brand</span>
                        {sortField === "brand" ? (
                          sortDirection === "asc" ? <ArrowUp size={13} className="text-secondary font-bold" /> : <ArrowDown size={13} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={13} className="opacity-50" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSortToggle("style")}
                      className="px-3 py-2 font-label-caps text-label-caps text-on-surface-variant bg-surface-container-high cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Style</span>
                        {sortField === "style" ? (
                          sortDirection === "asc" ? <ArrowUp size={13} className="text-secondary font-bold" /> : <ArrowDown size={13} className="text-secondary font-bold" />
                        ) : (
                          <ArrowUpDown size={13} className="opacity-50" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSortToggle("colour")}
                      className="px-3 py-2 font-label-caps text-label-caps text-on-surface-variant bg-surface-container-high cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Shade</span>
                        {sortField === "colour" && (sortDirection === "asc" ? <ArrowUp size={13} className="text-secondary" /> : <ArrowDown size={13} className="text-secondary" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSortToggle("size")}
                      className="px-3 py-2 font-label-caps text-label-caps text-on-surface-variant bg-surface-container-high cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Size</span>
                        {sortField === "size" && (sortDirection === "asc" ? <ArrowUp size={13} className="text-secondary" /> : <ArrowDown size={13} className="text-secondary" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSortToggle("sellingPrice")}
                      className="px-3 py-2 font-label-caps text-label-caps text-on-surface-variant bg-surface-container-high cursor-pointer hover:text-primary transition-colors select-none text-right"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Price</span>
                        {sortField === "sellingPrice" && (sortDirection === "asc" ? <ArrowUp size={13} className="text-secondary" /> : <ArrowDown size={13} className="text-secondary" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSortToggle("labelCount")}
                      className="px-3 py-2 font-label-caps text-label-caps text-on-surface-variant w-28 bg-surface-container-high text-center cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span># Labels</span>
                        {sortField === "labelCount" && (sortDirection === "asc" ? <ArrowUp size={13} className="text-secondary" /> : <ArrowDown size={13} className="text-secondary" />)}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant bg-surface font-body-sm">
                  {activeDataset.map((row, idx) => {
                    const isSelected = selectedPreviewIndex === idx;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedPreviewIndex(idx)}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? "bg-secondary-fixed/40 font-semibold" : "hover:bg-surface-container-low"
                        }`}
                      >
                        <td className="px-3 py-2 font-code-md text-body-sm text-on-surface">{row.stockNo}</td>
                        <td className="px-3 py-2 text-body-sm text-on-surface truncate max-w-[150px]" title={row.product}>{row.product}</td>
                        <td className="px-3 py-2 text-body-sm text-on-surface">{row.brand}</td>
                        <td className="px-3 py-2 text-body-sm text-on-surface">{row.style}</td>
                        <td className="px-3 py-2 text-body-sm text-on-surface">{row.colour}</td>
                        <td className="px-3 py-2 text-body-sm text-on-surface">{row.size}</td>
                        <td className="px-3 py-2 text-right font-mono text-body-sm">₹{row.sellingPrice || row.mrp}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={row.labelCount}
                            onChange={e => handleInlineLabelChange(row.id, parseInt(e.target.value) || 0)}
                            onClick={e => e.stopPropagation()}
                            className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-body-sm font-code-md text-center focus:ring-1 focus:ring-secondary focus:border-secondary outline-none font-bold"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {activeDataset.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-on-surface-variant italic">
                        No items match the current selection. Adjust criteria and click 'Load Results'.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Footer Bar */}
            <div className="p-4 bg-surface-container-low border-t border-outline-variant flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-label-caps text-label-caps text-secondary font-bold shrink-0">
                  Loaded Items ({totalLoadedItems})
                </span>
                {currentSelectedItem && (
                  <span className="text-xs text-on-surface-variant font-mono">
                    • Selected: <strong>{currentSelectedItem.stockNo}</strong> ({currentSelectedItem.product} - {currentSelectedItem.colour}/{currentSelectedItem.size})
                  </span>
                )}
              </div>
              <div className="flex gap-6 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-on-surface-variant">Current Stock:</span>
                  <span className="font-code-md text-body-sm font-bold text-on-surface">
                    {isFixedQuantitySource ? "N/A" : activeDataset.reduce((s, r) => s + r.currentStock, 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-on-surface-variant">Total Labels to Print:</span>
                  <span className="font-code-md text-body-sm font-bold text-secondary text-sm">
                    {totalLabelsSum}
                  </span>
                </div>
              </div>
            </div>

          </section>

        </main>

      </div>

      {/* Bottom Fixed Action Bar / Footer (Stitch Enterprise Specification) */}
      <footer className="fixed bottom-0 right-0 left-0 h-16 bg-surface-container-highest border-t border-outline-variant flex justify-between items-center px-margin-page z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] print:hidden">
        <div className="flex items-center gap-2 text-on-surface-variant text-sm font-medium">
          <Info size={16} className="text-secondary shrink-0" />
          <span>{bottomStatusText}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 rounded border border-error text-error hover:bg-error-container transition-colors font-body-sm font-medium shadow-xs"
            title="Reset selection criteria and quantities"
          >
            Clear
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-surface border border-outline-variant hover:bg-surface-variant text-on-surface transition-colors font-body-sm font-medium shadow-xs"
            title="Exit Tag Printing"
          >
            Exit
          </button>
          
          <button
            type="button"
            onClick={handlePrintCurrent}
            className="px-4 py-2 rounded bg-secondary-fixed/50 text-on-secondary-fixed hover:bg-secondary-fixed transition-colors font-body-sm font-medium shadow-xs"
            title="Print labels for current selected record"
          >
            Print Current ({currentSelectedItem?.labelCount || 1})
          </button>
          
          <button
            type="button"
            onClick={handlePrintAll}
            className="px-6 py-2 rounded bg-primary text-on-primary hover:bg-primary-container shadow-md transition-all font-body-sm font-bold flex items-center gap-2"
            title="Print all items in queue (F8)"
          >
            <Printer size={16} />
            <span>Print All ({totalLabelsSum})</span>
          </button>
        </div>
      </footer>

      {/* Master Date Filter Dialog */}
      {showMasterFilterDialog && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150 font-sans">
          <div className="bg-surface text-on-surface rounded-xl border border-outline-variant w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-primary text-on-primary flex items-center gap-2 font-title-sm font-bold">
              <HelpCircle size={18} className="text-amber-300" />
              <span>Print Status Filter Confirmation</span>
            </div>

            <div className="p-6 space-y-3 bg-surface text-body-sm">
              <p className="font-semibold text-sm leading-relaxed text-primary">
                Do you want to display only those item details, entered in the date range ({masterDateFrom} to {masterDateTo}), for which labels are not printed?
              </p>
              <div className="text-body-sm text-on-surface-variant space-y-1 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                <div>• <strong>Yes:</strong> Display only unprinted items entered in the period.</div>
                <div>• <strong>No:</strong> Display all items entered in the period (irrespective of print status).</div>
                <div>• <strong>Cancel:</strong> Abort selection process.</div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-outline-variant bg-surface-container flex justify-end gap-2 text-body-sm font-medium">
              <button
                type="button"
                onClick={() => setShowMasterFilterDialog(false)}
                className="px-4 py-1.5 border border-outline-variant rounded font-semibold text-on-surface hover:bg-surface-variant"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMasterFilterResponse(false)}
                className="px-4 py-1.5 border border-secondary text-secondary bg-surface rounded font-bold hover:bg-secondary-fixed"
              >
                No (All Items)
              </button>
              <button
                type="button"
                onClick={() => handleMasterFilterResponse(true)}
                className="px-5 py-1.5 bg-primary text-on-primary rounded font-bold hover:bg-primary-container"
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
            targetPrinterName: cfg.printerName
          }));
          onNotification?.("Printer Configured", `Target set to ${cfg.printerName} (${cfg.portType})`, "success");
        }}
      />

      {/* F2 Product Browse Modal */}
      <PurchaseProductBrowseModal
        products={products}
        isOpen={isF2BrowseModalOpen}
        onClose={() => setIsF2BrowseModalOpen(false)}
        onSelectProduct={(prod) => {
          if (f2BrowseTarget === "stockNoFrom") {
            setCriteria(prev => ({ ...prev, stockNoFrom: prod.code || "" }));
          } else {
            setCriteria(prev => ({ ...prev, stockNoTo: prod.code || "" }));
          }
          setIsF2BrowseModalOpen(false);
        }}
      />

      {/* Live Thermal Sticker Preview & Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150 print:hidden font-sans">
          <div className="bg-surface text-on-surface rounded-xl border border-outline-variant w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-3.5 bg-primary text-on-primary flex justify-between items-center font-title-sm font-bold">
              <span className="flex items-center gap-2">
                <Printer size={18} />
                Thermal Barcode Print Dispatch — [{settings.sourceOption}]
              </span>
              <button type="button" onClick={() => setShowDispatchModal(false)} className="text-on-primary hover:opacity-80">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-body-sm bg-surface overflow-y-auto">
              
              <div className="bg-surface-container p-3.5 rounded-lg border border-outline-variant flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-primary flex items-center gap-1.5">
                    <Printer size={16} className="text-secondary" />
                    <span>{settings.targetPrinterName}</span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant mt-0.5">
                    Format: 50mm x 25mm Thermal Roll • Port: {settings.portSetting} • Mode: {settings.sourceOption}
                  </div>
                </div>
                <div className="bg-primary text-on-primary px-3.5 py-1.5 rounded-lg font-code-md font-bold text-sm shadow-xs">
                  {activePrintTotalLabels} {activePrintTotalLabels === 1 ? "Label" : "Labels"}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-label-caps text-[10px] text-primary">
                    Live Thermal Sticker Preview (50mm x 25mm Roll)
                  </span>
                  <span className="text-[10px] font-code-md text-on-surface-variant">300 DPI Rendering</span>
                </div>
                
                {activePrintItems.length > 0 && (
                  <div className="flex items-center justify-center p-4 bg-surface-container-low border border-outline-variant rounded-lg">
                    <div className="w-[60mm] h-[30mm] bg-white text-black p-2 rounded shadow-md border border-gray-300 flex flex-col justify-between select-none">
                      <div className="flex justify-between items-center border-b border-black/30 pb-0.5 leading-none">
                        <span className="font-extrabold text-[9px] uppercase tracking-wide truncate max-w-[34mm]">
                          {activePrintItems[0].brand || "SMRITI RETAIL"}
                        </span>
                        <span className="font-mono font-bold text-[10px]">
                          ₹{activePrintItems[0].sellingPrice || activePrintItems[0].mrp}
                        </span>
                      </div>

                      <div className="text-[8px] font-semibold truncate leading-tight my-0.5">
                        <span>{activePrintItems[0].product}</span>
                        <span className="text-[7.5px] text-gray-700 ml-1">({activePrintItems[0].style})</span>
                      </div>

                      <div className="w-full flex justify-center py-0.5">
                        <ThermalBarcodeSvg
                          value={activePrintItems[0].barcode || activePrintItems[0].stockNo}
                          widthMm={50}
                          heightMm={10}
                          showText={true}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[7.5px] font-mono leading-none border-t border-black/30 pt-0.5">
                        <span>{activePrintItems[0].colour} / S:{activePrintItems[0].size}</span>
                        <span className="font-semibold text-[7px] text-gray-600">MRP: ₹{activePrintItems[0].mrp}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="max-h-36 overflow-y-auto border border-outline-variant rounded-lg bg-surface-container-lowest p-2.5 space-y-1 font-code-md text-xs">
                <span className="font-bold text-on-surface-variant text-[11px] block font-sans">
                  Items in Print Queue:
                </span>
                {activePrintItems.map(r => (
                  <div key={r.id} className="flex justify-between items-center py-1 border-b border-outline-variant/30">
                    <span>{r.stockNo} - {r.product} ({r.colour}/{r.size})</span>
                    <span className="font-bold text-primary bg-secondary-fixed px-2 py-0.5 rounded">
                      {r.labelCount} {r.labelCount === 1 ? "label" : "labels"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-secondary-fixed/30 border border-secondary/30 rounded-lg p-3 flex items-start gap-2.5 text-primary">
                <Info size={16} className="text-secondary shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Honeywell IH-2 (300 dpi):</strong> Click <strong>"Print from Browser"</strong> and select <strong>"IMPACT by Honeywell IH-2 (300 dpi) - DPL"</strong> in the destination list.
                </div>
              </div>

            </div>

            <div className="px-6 py-3.5 border-t border-outline-variant bg-surface-container flex flex-wrap justify-between items-center gap-2">
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
                    URL.revokeObjectURL(a);
                    onNotification?.("File Downloaded", "Downloaded raw PRN script for Honeywell IH-2.", "success");
                  }}
                  className="px-3 py-1.5 bg-surface border border-outline-variant hover:bg-surface-variant rounded font-body-sm font-semibold flex items-center gap-1.5 text-on-surface"
                >
                  <Download size={13} />
                  <span>Download PRN</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generateRawDplScript());
                    onNotification?.("Copied", "Copied raw DPL script commands to clipboard.", "success");
                  }}
                  className="px-3 py-1.5 bg-surface border border-outline-variant hover:bg-surface-variant rounded font-body-sm font-semibold flex items-center gap-1.5 text-on-surface"
                >
                  <Copy size={13} />
                  <span>Copy DPL</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-1.5 border border-outline-variant rounded text-on-surface font-semibold hover:bg-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className="px-6 py-1.5 bg-primary text-on-primary rounded font-bold hover:bg-primary-container transition shadow-md flex items-center gap-2 font-body-sm"
                >
                  <Printer size={15} />
                  <span>Print from Browser ({activePrintTotalLabels})</span>
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
