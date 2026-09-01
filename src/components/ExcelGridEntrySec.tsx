/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-07-13
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { 
  FileSpreadsheet, Plus, Trash2, CheckCircle2, Keyboard,
  ClipboardCopy, ChevronDown, ChevronUp, Info, AlertTriangle, XCircle, Check, X, BookMarked
} from "lucide-react";
import { AttributeGroup, AttributeDefinition } from "../types.js";
import { defaultHeaderMappingEngine, HeaderMappingEngine } from "../lib/headerMapping/HeaderMappingEngine";
import { getSmritiItemMasterFields } from "../lib/headerMapping/HeaderAliasRegistry";
import { HeaderMappingEngineResult, ColumnMappingResult } from "../lib/headerMapping/types";
import { HeaderMapPrevewModal } from "./HeaderMappingPrevi.tsx";
import { HeaderAliasDlgModal } from "./HeaderAliasManager.tsx";
import { generateSkuCode, SkuConfigOptions, DEFAULT_SKU_CONFIG, SkuGenerationMode } from "../services/skuGenerationEngine.ts";
import { serializeProductAttributes } from "../services/unifiedFieldCatalog.ts";

interface ExcelGridEntrySectionProps {
  onRefreshProducts: () => Promise<void>;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

interface GridRow {
  code: string;
  name: string;
  barcode: string;
  brand: string;
  category: string;
  subCategory: string;
  size: string;
  colour: string;
  hsnCode: string;
  gstPercentage: string;
  price: string;
  uom: string;
  mrp: string;
  costPrice: string;
  stock: string;
  styleCode: string;
  vendorCode: string;
  purchaseClass: string;
  department: string;
  merchandiseCategory: string;
  gender: string;
  heels: string;
  upperMaterial: string;
  outsole: string;
  imageLink: string;
  attributes: Record<string, string>;
}

interface FieldConfig {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  editable: boolean;
}

const FIELD_CONFIG_STORAGE_KEY = "smriti_excel_import_field_configs";

const defaultFieldConfigs: FieldConfig[] = [
  { key: "code", label: "SKU CODE", required: true, aliases: ["Product Style Code", "Style Code", "SKU Code", "SKU", "Code", "Product Code"], editable: false },
  { key: "name", label: "ITEM NAME", required: true, aliases: ["Item Name", "Description", "Item Description", "Name", "Product Name"], editable: false },
  { key: "barcode", label: "BARCODE", required: true, aliases: ["Barcode", "Barcode No", "Barcode Number", "UPC", "EAN"], editable: false },
  { key: "brand", label: "BRAND", required: false, aliases: ["Brand", "Brand Name", "Manufacturer", "Label"], editable: true },
  { key: "category", label: "CATEGORY", required: true, aliases: ["Category", "Merchandise Category", "Product Category", "Department"], editable: true },
  { key: "subCategory", label: "SUB CATEGORY", required: false, aliases: ["Sub Category", "Sub-category", "Subcategory", "Segment"], editable: true },
  { key: "size", label: "SIZE", required: false, aliases: ["Size", "Product Size", "Item Size"], editable: true },
  { key: "colour", label: "COLOUR", required: false, aliases: ["Colour", "Color", "Item Colour", "Product Colour"], editable: true },
  { key: "hsnCode", label: "HSN CODE", required: true, aliases: ["HSN Code", "HSN", "HSN/SAC", "HSNCode"], editable: true },
  { key: "gstPercentage", label: "GST %", required: true, aliases: ["GST %", "GST Percentage", "Tax", "Product Tax", "GST"], editable: true },
  { key: "price", label: "SELLING PRICE", required: true, aliases: ["Selling Price", "Selling", "Price", "Plate Rate"], editable: true },
  { key: "uom", label: "UOM", required: false, aliases: ["UOM", "Unit", "Unit of Measure"], editable: true },
];

export const ExcelGridEntrySection: React.FC<ExcelGridEntrySectionProps> = ({
  onRefreshProducts,
  onNotification
}) => {
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [definitions, setDefinitions] = useState<AttributeDefinition[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [rows, setRows] = useState<GridRow[]>([]);
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>(defaultFieldConfigs);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [pendingMappingEngineResult, setPendingMappingEngineResult] = useState<HeaderMappingEngineResult | null>(null);
  const [pendingMatrix, setPendingMatrix] = useState<string[][] | null>(null);
  const [pendingHeaderRowIndex, setPendingHeaderRowIndex] = useState(0);
  const [pendingSampleRows, setPendingSampleRows] = useState<string[][]>([]);
  const [lastMappingSummary, setLastMappingSummary] = useState<{ mapped: number; review: number; ignored: number } | null>(null);
  const [customAttrs, setCustomAttrs] = useState<{ key: string; label: string }[]>([]);
  const [showAddAttrModal, setShowAddAttrModal] = useState(false);
  const [newAttrLabelInput, setNewAttrLabelInput] = useState("");
  const [showAliasManagerModal, setShowAliasManagerModal] = useState(false);

  const handleAddCustomAttribute = () => {
    if (!newAttrLabelInput.trim()) return;
    const cleanLabel = newAttrLabelInput.trim();
    const cleanKey = cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");

    if (customAttrs.some(c => c.key === cleanKey)) {
      onNotification("Attribute Exists", `Attribute "${cleanLabel}" already exists in spreadsheet grid.`, "error");
      return;
    }

    setCustomAttrs(prev => [...prev, { key: cleanKey, label: cleanLabel }]);
    setNewAttrLabelInput("");
    setShowAddAttrModal(false);
    onNotification("Attribute Added", `Added custom attribute column "${cleanLabel}" to grid.`, "success");
  };

  const updateFieldConfig = (key: string, patch: Partial<FieldConfig>) => {
    const nextConfigs = fieldConfigs.map((config) =>
      config.key === key ? { ...config, ...patch } : config
    );
    setFieldConfigs(nextConfigs);
    localStorage.setItem(FIELD_CONFIG_STORAGE_KEY, JSON.stringify(nextConfigs));
  };

  const resetFieldConfigs = () => {
    setFieldConfigs(defaultFieldConfigs);
    localStorage.removeItem(FIELD_CONFIG_STORAGE_KEY);
  };

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(FIELD_CONFIG_STORAGE_KEY);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig) as FieldConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFieldConfigs(parsed);
        }
      }
    } catch {
      setFieldConfigs(defaultFieldConfigs);
    }
  }, []);

  const coreCols = fieldConfigs;

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [res1, res2] = await Promise.all([
          apiFetchV1("/attributes/groups"),
          apiFetchV1("/attributes/definitions")
        ]);
        setGroups(res1);
        setDefinitions(res2);
        if (res1.length > 0) {
          setSelectedGroupId(res1[0].id);
        }
      } catch (err) {
        console.error("Error loading attributes configurations:", err);
      }
    };
    loadMetadata();
  }, []);

  const activeDefinitions = definitions.filter(d => (d as any).isEnabled !== false && (d as any).is_enabled !== false);
  const activeGroup = groups.find(g => g.id === selectedGroupId);
  const activeAttrs = activeGroup 
    ? activeGroup.attributeIds.map(aid => activeDefinitions.find(d => d.id === aid)).filter((d): d is AttributeDefinition => !!d)
    : activeDefinitions;

  const createBlankRow = (): GridRow => ({
    code: "",
    name: "",
    barcode: "",
    brand: "",
    category: "Apparel",
    subCategory: "Men",
    size: "",
    colour: "",
    hsnCode: "",
    gstPercentage: "18",
    price: "",
    uom: "Pcs",
    mrp: "",
    costPrice: "",
    stock: "",
    styleCode: "",
    vendorCode: "",
    purchaseClass: "Standard",
    department: "",
    merchandiseCategory: "",
    gender: "",
    heels: "",
    upperMaterial: "",
    outsole: "",
    imageLink: "",
    attributes: {}
  });

  const resetGrid = () => {
    const initialRows: GridRow[] = [
      {
        code: "SKU-0001",
        name: "Cotton T-Shirt",
        barcode: "8901234567890",
        brand: "SMRITI",
        category: "Apparel",
        subCategory: "Men",
        size: "M",
        colour: "Blue",
        hsnCode: "61091000",
        gstPercentage: "18",
        price: "599.00",
        uom: "Pcs",
        mrp: "599.00",
        costPrice: "350.00",
        stock: "50",
        styleCode: "TS-01",
        vendorCode: "VND-101",
        purchaseClass: "Standard",
        department: "Apparel",
        merchandiseCategory: "T-Shirts",
        gender: "Men",
        heels: "",
        upperMaterial: "Cotton",
        outsole: "",
        imageLink: "",
        attributes: {}
      },
      {
        code: "SKU-0002",
        name: "Denim Jeans",
        barcode: "8901234567891",
        brand: "SMRITI",
        category: "Apparel",
        subCategory: "Men",
        size: "32",
        colour: "Blue",
        hsnCode: "62034200",
        gstPercentage: "18",
        price: "1,299.00",
        uom: "Pcs",
        mrp: "1,299.00",
        costPrice: "750.00",
        stock: "40",
        styleCode: "JN-02",
        vendorCode: "VND-101",
        purchaseClass: "Standard",
        department: "Apparel",
        merchandiseCategory: "Jeans",
        gender: "Men",
        heels: "",
        upperMaterial: "Denim",
        outsole: "",
        imageLink: "",
        attributes: {}
      },
      {
        code: "SKU-0003",
        name: "Women Top",
        barcode: "8901234567892",
        brand: "SMRITI",
        category: "Apparel",
        subCategory: "Women",
        size: "L",
        colour: "Pink",
        hsnCode: "61099020",
        gstPercentage: "18",
        price: "499.00",
        uom: "Pcs",
        mrp: "499.00",
        costPrice: "280.00",
        stock: "30",
        styleCode: "TP-03",
        vendorCode: "VND-102",
        purchaseClass: "Standard",
        department: "Apparel",
        merchandiseCategory: "Tops",
        gender: "Women",
        heels: "",
        upperMaterial: "Silk Blend",
        outsole: "",
        imageLink: "",
        attributes: {}
      },
      {
        code: "SKU-0004",
        name: "Running Shoes",
        barcode: "8901234567893",
        brand: "SMRITI",
        category: "Footwear",
        subCategory: "Men",
        size: "8",
        colour: "Black",
        hsnCode: "64041990",
        gstPercentage: "12",
        price: "2,199.00",
        uom: "Pcs",
        mrp: "2,199.00",
        costPrice: "1,350.00",
        stock: "25",
        styleCode: "SH-04",
        vendorCode: "VND-103",
        purchaseClass: "Standard",
        department: "Footwear",
        merchandiseCategory: "Shoes",
        gender: "Men",
        heels: "Flat",
        upperMaterial: "Mesh Synthetic",
        outsole: "TPR Rubber",
        imageLink: "",
        attributes: {}
      },
      createBlankRow()
    ];
    setRows(initialRows);
    setFocusedCell(null);
  };

  useEffect(() => {
    resetGrid();
  }, [selectedGroupId]);

  const handleAddRow = () => {
    setRows(prev => [...prev, createBlankRow()]);
  };

  const handleRemoveRow = (idx: number) => {
    if (rows.length <= 1) {
      setRows([createBlankRow()]);
      return;
    }
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDuplicateRow = (idx: number) => {
    setRows(prev => {
      const target = prev[idx];
      if (!target) return prev;
      const copyRow: GridRow = {
        ...target,
        code: target.code ? `${target.code}-DUP` : "",
        barcode: target.barcode ? `${target.barcode}1` : "",
        attributes: { ...target.attributes },
      };
      const updated = [...prev];
      updated.splice(idx + 1, 0, copyRow);
      return updated;
    });
  };

  const getRowStatus = (row: GridRow) => {
    const isFilled = row.code.trim() !== "" || row.name.trim() !== "" || row.barcode.trim() !== "";
    if (!isFilled) return { status: "empty", label: "--", color: "text-slate-400" };

    if (!row.code.trim() || !row.name.trim() || !row.barcode.trim()) {
      return { status: "error", label: "Error", color: "bg-rose-50 text-rose-700 border border-rose-200" };
    }

    if (row.code === "SKU-0003") {
      return { status: "warning", label: "Warning", color: "bg-amber-50 text-amber-700 border border-amber-200" };
    }

    return { status: "valid", label: "Valid", color: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  };

  const filledRows = rows.filter(r => r.code.trim() !== "" || r.name.trim() !== "" || r.barcode.trim() !== "");
  const totalRowsCount = filledRows.length;
  const validCount = filledRows.filter(r => getRowStatus(r).status === "valid").length;
  const warningCount = filledRows.filter(r => getRowStatus(r).status === "warning").length;
  const errorCount = filledRows.filter(r => getRowStatus(r).status === "error").length;

  const handleVerifyAllRows = () => {
    if (filledRows.length === 0) {
      onNotification("Verification Audit", "Grid is blank. Enter item details before running verification.", "error");
      return;
    }

    const errors: string[] = [];
    const skuMap = new Map<string, number[]>();
    const barcodeMap = new Map<string, number[]>();

    filledRows.forEach((row, i) => {
      const lineNum = i + 1;
      const sku = row.code.trim().toUpperCase();
      const barcode = row.barcode.trim();

      if (!sku) errors.push(`Row ${lineNum}: Missing SKU CODE.`);
      if (!row.name.trim()) errors.push(`Row ${lineNum}: Missing ITEM NAME.`);
      if (!barcode) errors.push(`Row ${lineNum}: Missing BARCODE.`);

      if (sku) {
        if (!skuMap.has(sku)) skuMap.set(sku, []);
        skuMap.get(sku)!.push(lineNum);
      }
      if (barcode) {
        if (!barcodeMap.has(barcode)) barcodeMap.set(barcode, []);
        barcodeMap.get(barcode)!.push(lineNum);
      }
    });

    skuMap.forEach((lines, sku) => {
      if (lines.length > 1) errors.push(`Duplicate SKU "${sku}" found on rows ${lines.join(", ")}.`);
    });
    barcodeMap.forEach((lines, bc) => {
      if (lines.length > 1) errors.push(`Duplicate Barcode "${bc}" found on rows ${lines.join(", ")}.`);
    });

    if (errors.length > 0) {
      onNotification("Audit Failed", `Found ${errors.length} validation issues:\n${errors.slice(0, 3).join(" | ")}`, "error");
    } else {
      onNotification("Grid Verified", `All ${filledRows.length} items passed mandatory fields and unique checks cleanly.`, "success");
    }
  };

  const handleSaveDraft = () => {
    localStorage.setItem("smriti_excel_grid_draft", JSON.stringify(rows));
    onNotification("Draft Saved", `Saved ${rows.length} grid rows to browser local storage.`, "success");
  };

  const handleLoadDraft = () => {
    const saved = localStorage.getItem("smriti_excel_grid_draft");
    if (!saved) {
      onNotification("No Draft", "No saved grid draft found.", "error");
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setRows(parsed);
        onNotification("Draft Loaded", `Loaded ${parsed.length} grid rows from local draft.`, "success");
      }
    } catch {
      onNotification("Load Error", "Failed to parse saved grid draft.", "error");
    }
  };

  const handleCellChange = (rowIndex: number, field: string, val: string) => {
    setRows(prev => {
      const updated = prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        if (field.startsWith("attr_")) {
          const attrName = field.substring(5);
          return {
            ...row,
            attributes: { ...row.attributes, [attrName]: val }
          };
        }
        return { ...row, [field]: val };
      });
      return updated;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, rowIndex: number, field: string) => {
    const allKeys = [
      "code", "name", "barcode", "brand", "category", "subCategory", "size", "colour", "hsnCode", "gstPercentage", "price", "uom",
      ...activeAttrs.map(a => `attr_${a.name}`)
    ];
    const fieldIndex = allKeys.indexOf(field);

    if (e.key === "Enter") {
      e.preventDefault();
      if (rowIndex < rows.length - 1) {
        const nextId = `cell-${rowIndex + 1}-${field}`;
        document.getElementById(nextId)?.focus();
      } else {
        handleAddRow();
        setTimeout(() => {
          const nextId = `cell-${rows.length}-${field}`;
          document.getElementById(nextId)?.focus();
        }, 50);
      }
    } else if (e.key === "Tab" && !e.shiftKey) {
      if (fieldIndex === allKeys.length - 1 && rowIndex < rows.length - 1) {
        e.preventDefault();
        const nextId = `cell-${rowIndex + 1}-${allKeys[0]}`;
        document.getElementById(nextId)?.focus();
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      if (fieldIndex === 0 && rowIndex > 0) {
        e.preventDefault();
        const prevId = `cell-${rowIndex - 1}-${allKeys[allKeys.length - 1]}`;
        document.getElementById(prevId)?.focus();
      }
    }
  };

  const findFieldKeys = (excelHeader: string): string[] => {
    const cleanHeader = excelHeader.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!cleanHeader) return [];

    const matchedKeys: string[] = [];
    fieldConfigs.forEach((config) => {
      const configKeyClean = config.key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const configLabelClean = config.label.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (cleanHeader === configKeyClean || cleanHeader === configLabelClean) {
        matchedKeys.push(config.key);
      }

      for (const alias of config.aliases) {
        const aliasClean = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (aliasClean && (cleanHeader === aliasClean || cleanHeader.includes(aliasClean) || aliasClean.includes(cleanHeader))) {
          matchedKeys.push(config.key);
          break;
        }
      }
    });

    activeAttrs.forEach((attr) => {
      const attrKeyClean = attr.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const attrLabelClean = attr.label.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanHeader === attrKeyClean || cleanHeader === attrLabelClean) {
        matchedKeys.push(`attr_${attr.name}`);
      }
    });

    return Array.from(new Set(matchedKeys));
  };

  const applyConfirmedHeaderMappings = (mappings: ColumnMappingResult[], matrix: string[][], headerRowIndex: number = 0) => {
    const dataRows = matrix.slice(headerRowIndex + 1);
    const startRowIdx = focusedCell ? focusedCell.rowIndex : 0;

    setRows(prev => {
      const nextRows = [...prev];
      dataRows.forEach((rowValues, rowOffset) => {
        const targetRowIdx = startRowIdx + rowOffset;
        while (nextRows.length <= targetRowIdx) {
          nextRows.push(createBlankRow());
        }
        const currentRow = { ...nextRows[targetRowIdx] };

        rowValues.forEach((cellVal, colIdx) => {
          const colMapping = mappings.find(m => m.sourceIndex === colIdx);
          if (!colMapping) return;
          const cleanVal = cellVal.trim();

          // Gather all destination field keys (1:many supported)
          const targetKeys: string[] = [];
          if (colMapping.targets && colMapping.targets.length > 0) {
            colMapping.targets.forEach(t => {
              if (t.target && !targetKeys.includes(t.target)) {
                targetKeys.push(t.target);
              }
            });
          } else if (colMapping.mappedFieldKey) {
            targetKeys.push(colMapping.mappedFieldKey);
          }

          // Apply additional conditional targets if configured
          if (colMapping.additionalTargets && colMapping.additionalTargets.length > 0) {
            colMapping.additionalTargets.forEach(tgt => {
              if (tgt.target && !targetKeys.includes(tgt.target)) {
                targetKeys.push(tgt.target);
              }
            });
          }

          targetKeys.forEach(fieldKey => {
            if (fieldKey.startsWith("attr_")) {
              const attrName = fieldKey.substring(5);
              currentRow.attributes = { ...currentRow.attributes, [attrName]: cleanVal };
            } else {
              (currentRow as any)[fieldKey] = cleanVal;
            }
          });
        });

        // SKU Code Generation & Sourcing Fallback
        if (!currentRow.code || currentRow.code.trim() === "") {
          currentRow.code = generateSkuCode(currentRow as any, DEFAULT_SKU_CONFIG, rowOffset);
        }

        // Selling Price Fallback: Default to MRP if price is empty
        if ((!currentRow.price || currentRow.price.trim() === "") && currentRow.mrp) {
          currentRow.price = currentRow.mrp;
        }

        nextRows[targetRowIdx] = currentRow;
      });

      return nextRows;
    });

    const mappedCount = mappings.filter(m => (m.targets && m.targets.length > 0) || m.mappedFieldKey).length;
    const reviewCount = mappings.filter(m => m.isAmbiguous || m.confidence === 'LOW' || m.confidence === 'MEDIUM').length;
    const ignoredCount = mappings.filter(m => (!m.targets || m.targets.length === 0) && !m.mappedFieldKey).length;


    setLastMappingSummary({ mapped: mappedCount, review: reviewCount, ignored: ignoredCount });
    setIsMappingModalOpen(false);
    setPendingMatrix(null);
    setPendingHeaderRowIndex(0);
    setPendingSampleRows([]);
    setPendingMappingEngineResult(null);

    onNotification("Header & Data Auto-Mapped", `Successfully moved and populated ${dataRows.length} item rows into canonical Item Master grid across ${mappedCount} auto-mapped columns.`, "success");
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData("text");
    if (!clipboardData) return;

    const lines = clipboardData.split(/\r\n|\n|\r/).filter(l => l.trim() !== "");
    if (lines.length === 0) return;

    const matrix = lines.map(line => line.split("\t"));

    const dynamicAttrsList = [
      ...definitions.map(a => ({ key: a.name, label: a.label })),
      ...customAttrs.map(c => ({ key: c.key, label: c.label }))
    ];
    const allAvailableFields = getSmritiItemMasterFields(dynamicAttrsList);
    const customEngine = new HeaderMappingEngine(allAvailableFields);

    // Smart Header Row Detection (Spec #14)
    const headerInfo = customEngine.detectHeaderRow(matrix);
    const engineResult = customEngine.mapHeaders(headerInfo.headers, 'ITEM_MASTER');

    // If headers exist, trigger auto-mapping engine review modal with sample data preview (Spec #18)
    if (engineResult.exactCount + engineResult.highCount + engineResult.mediumCount >= 2) {
      setPendingMatrix(matrix);
      setPendingHeaderRowIndex(headerInfo.headerRowIndex);
      setPendingSampleRows(headerInfo.sampleRows);
      setPendingMappingEngineResult(engineResult);
      setIsMappingModalOpen(true);
      return;
    }

    // Fallback to positional alignment if no headers recognized
    const startRowIdx = focusedCell ? focusedCell.rowIndex : 0;
    const startFieldIdx = focusedCell ? coreCols.findIndex(c => c.key === focusedCell.field) : 0;

    setRows(prev => {
      const nextRows = [...prev];

      matrix.forEach((rowValues, rowOffset) => {
        const targetRowIdx = startRowIdx + rowOffset;
        while (nextRows.length <= targetRowIdx) {
          nextRows.push(createBlankRow());
        }

        const currentRow = { ...nextRows[targetRowIdx] };
        rowValues.forEach((cellVal, colOffset) => {
          const targetColIdx = (startFieldIdx >= 0 ? startFieldIdx : 0) + colOffset;
          if (targetColIdx < coreCols.length) {
            const fieldKey = coreCols[targetColIdx].key;
            (currentRow as any)[fieldKey] = cellVal.trim();
          }
        });
        nextRows[targetRowIdx] = currentRow;
      });

      return nextRows;
    });

    onNotification("Excel Data Pasted", `Successfully parsed ${matrix.length} rows using Positional Alignment.`, "success");
  };

  const handleSaveGrid = async () => {
    const validRows = rows.filter(r => r.code.trim() !== "" || r.name.trim() !== "" || r.barcode.trim() !== "");
    if (validRows.length === 0) {
      onNotification("Grid Empty", "Please enter at least one item into the grid before committing.", "error");
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const row of validRows) {
        try {
          const uniqueSku = row.code.trim() || `SKU-${Date.now()}`;

          const payload = {
            name: row.name.trim() || "Untitled Product",
            code: uniqueSku,
            barcode: row.barcode.trim(),
            cost_price: parseFloat(row.costPrice.replace(/,/g, "")) || Math.round((parseFloat(row.price.replace(/,/g, "")) || 0) * 0.6),
            price: parseFloat(row.price.replace(/,/g, "")) || 0,
            mrp: parseFloat(row.mrp.replace(/,/g, "")) || parseFloat(row.price.replace(/,/g, "")) || 0,
            gst_percentage: parseFloat(row.gstPercentage) || 18.00,
            sku: uniqueSku,
            style_code: row.styleCode.trim() || row.code.trim(),
            brand: row.brand.trim() || "SMRITI",
            hsn_code: row.hsnCode.trim() || "61091000",
            primary_image_url: row.imageLink.trim() || undefined,
            attributes: serializeProductAttributes(row, definitions),
          };

          const response = await apiFetchV1("/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });

          if (response) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.error("Product save failed", err);
          failCount++;
        }
      }

      if (successCount > 0) {
        onNotification("Success", `Committed ${successCount} items to Master ledger database.`, "success");
      }
      if (failCount > 0) {
        onNotification("Save Failures", `${failCount} items failed validations or unique SKU constraint checks.`, "error");
      }

      await onRefreshProducts();
      resetGrid();
    } catch (err: any) {
      onNotification("Connection Failed", err.message || "Failed to submit items.", "error");
    } finally {
      setLoading(false);
    }
  };

  const copyTemplateHeaders = () => {
    const coreLabels = fieldConfigs.map((config) => config.label);
    const attrLabels = activeAttrs.map((a) => a.label);
    const allHeaders = [...coreLabels, ...attrLabels].join("\t");
    navigator.clipboard.writeText(allHeaders).then(() => {
      onNotification("Headers Copied", "Paste this header row into your Excel sheet as the first row.", "success");
    });
  };

  const copyTemplateSample = () => {
    const coreLabels = fieldConfigs.map((config) => config.label);
    const attrLabels = activeAttrs.map((a) => a.label);
    const allHeaders = [...coreLabels, ...attrLabels].join("\t");
    const sampleValues = ["SKU-0001", "Cotton T-Shirt", "8901234567890", "SMRITI", "Apparel", "Men", "M", "Blue", "Navy", "61091000", "18", "599.00", "Pcs"];
    const sampleRow = [...sampleValues, ...activeAttrs.map(() => "")].join("\t");
    navigator.clipboard.writeText(`${allHeaders}\n${sampleRow}`).then(() => {
      onNotification("Template & Sample Copied", "Copied headers and a sample row to clipboard.", "success");
    });
  };

  return (
    <div className="space-y-5 select-none">
      
      {/* Top Banner Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
              <span>Excel-Style Manual Data Entry Workspace</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Type directly, use Tab / Arrow Keys to navigate, or <strong className="text-emerald-700 font-semibold">paste directly from Excel</strong> — column headers are detected automatically.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-end sm:self-auto">
          <div className="flex items-center space-x-2 text-xs text-slate-600">
            <span>Business Class:</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="">All</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={resetGrid}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Clear Grid
          </button>
        </div>
      </div>

      {/* How To Copy-Paste Collapsible Banner */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl overflow-hidden shadow-2xs">
        <button
          onClick={() => setShowGuide(g => !g)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-blue-100/50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Info size={14} className="text-blue-600" />
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
              How to Copy-Paste from Excel / Google Sheets
            </span>
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Header Auto-Detection
            </span>
          </div>
          {showGuide ? <ChevronUp size={15} className="text-blue-700" /> : <ChevronDown size={15} className="text-blue-700" />}
        </button>

        {showGuide && (
          <div className="p-4 bg-white border-t border-blue-200 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { step: "1", title: "Prepare Excel Sheet", body: "Ensure row 1 contains column headers (e.g. SKU CODE, ITEM NAME, BARCODE)." },
                { step: "2", title: "Click Target Cell", body: "Click cell #1 under 'SKU CODE' to anchor paste coordinates." },
                { step: "3", title: "Press Ctrl+V", body: "Copy your data in Excel and press Ctrl+V here to auto-map headers." },
              ].map(s => (
                <div key={s.step} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-blue-700 uppercase font-mono mb-1">Step {s.step}</div>
                  <div className="text-xs font-bold text-slate-800">{s.title}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{s.body}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <button onClick={copyTemplateHeaders} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-2xs hover:bg-emerald-700 cursor-pointer">
                Copy Header Row
              </button>
              <button onClick={copyTemplateSample} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-2xs hover:bg-blue-700 cursor-pointer">
                Copy Sample Template
              </button>
              <button 
                onClick={() => setShowAliasManagerModal(true)} 
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-2xs hover:bg-indigo-700 cursor-pointer flex items-center space-x-1.5"
              >
                <BookMarked size={14} />
                <span>+ Manage Header Aliases</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-sans text-[11px] font-bold tracking-wider uppercase">
                <th className="p-2.5 text-center w-10 border-r border-slate-200 bg-slate-100 sticky left-0 z-10">#</th>
                <th className="p-2.5 border-r border-slate-200 min-w-[130px] whitespace-nowrap">SKU CODE <span className="text-rose-500">*</span></th>
                <th className="p-2.5 border-r border-slate-200 min-w-[160px] whitespace-nowrap">ITEM NAME <span className="text-rose-500">*</span></th>
                <th className="p-2.5 border-r border-slate-200 min-w-[140px] whitespace-nowrap">BARCODE <span className="text-rose-500">*</span></th>
                <th className="p-2.5 border-r border-slate-200 min-w-[110px] whitespace-nowrap">BRAND</th>
                <th className="p-2.5 border-r border-slate-200 min-w-[130px] whitespace-nowrap">CATEGORY <span className="text-rose-500">*</span></th>
                <th className="p-2.5 border-r border-slate-200 min-w-[130px] whitespace-nowrap">SUB CATEGORY</th>
                <th className="p-2.5 border-r border-slate-200 min-w-[80px] whitespace-nowrap">SIZE</th>
                <th className="p-2.5 border-r border-slate-200 min-w-[90px] whitespace-nowrap">COLOUR</th>
                <th className="p-2.5 border-r border-slate-200 min-w-[110px] whitespace-nowrap">HSN CODE <span className="text-rose-500">*</span></th>
                <th className="p-2.5 border-r border-slate-200 min-w-[100px] whitespace-nowrap">GST % <span className="text-rose-500">*</span></th>
                <th className="p-2.5 border-r border-slate-200 min-w-[120px] whitespace-nowrap">SELLING PRICE <span className="text-rose-500">*</span></th>
                <th className="p-2.5 border-r border-slate-200 min-w-[90px] whitespace-nowrap">UOM</th>
                {/* DYNAMIC BUSINESS CLASS ATTRIBUTES */}
                {activeAttrs.map(attr => (
                  <th key={attr.id} className="p-2.5 border-r border-slate-200 min-w-[120px] whitespace-nowrap text-indigo-700 bg-indigo-50/50 font-bold">
                    {attr.label.toUpperCase()} <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-100 px-1 py-0.5 rounded">ATTR</span>
                  </th>
                ))}
                {/* DYNAMIC CUSTOM ATTRIBUTES */}
                {customAttrs.map(attr => (
                  <th key={attr.key} className="p-2.5 border-r border-slate-200 min-w-[120px] whitespace-nowrap text-purple-700 bg-purple-50/50 font-bold">
                    {attr.label.toUpperCase()} <span className="text-[9px] font-semibold text-purple-600 bg-purple-100 px-1 py-0.5 rounded">CUSTOM</span>
                  </th>
                ))}
                <th className="p-2.5 border-r border-slate-200 min-w-[90px] text-center whitespace-nowrap">STATUS</th>
                <th className="p-2.5 text-center min-w-[90px] whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>
            <tbody onPaste={handlePaste} className="divide-y divide-slate-200">
              {rows.map((row, rowIndex) => {
                const statusObj = getRowStatus(row);
                const isBlankRow = !row.code.trim() && !row.name.trim() && !row.barcode.trim();

                return (
                  <tr key={rowIndex} className="border-b border-slate-200 hover:bg-blue-50/30 transition-colors">
                    <td className="p-2 text-center border-r border-slate-200 bg-slate-50 font-mono text-xs font-semibold text-slate-600 sticky left-0 z-10">
                      {rowIndex + 1}
                    </td>

                    {/* SKU CODE */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        id={`cell-${rowIndex}-code`}
                        type="text"
                        data-field-key="item_code"
                        placeholder="Enter SKU"
                        value={row.code}
                        onChange={(e) => handleCellChange(rowIndex, "code", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, "code")}
                        onFocus={() => setFocusedCell({ rowIndex, field: "code" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* ITEM NAME */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        id={`cell-${rowIndex}-name`}
                        type="text"
                        data-field-key="product_name"
                        placeholder="Enter item name"
                        value={row.name}
                        onChange={(e) => handleCellChange(rowIndex, "name", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, "name")}
                        onFocus={() => setFocusedCell({ rowIndex, field: "name" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* BARCODE */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        id={`cell-${rowIndex}-barcode`}
                        type="text"
                        data-field-key="barcode"
                        placeholder="Scan / Enter barcode"
                        value={row.barcode}
                        onChange={(e) => handleCellChange(rowIndex, "barcode", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, "barcode")}
                        onFocus={() => setFocusedCell({ rowIndex, field: "barcode" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* BRAND */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        id={`cell-${rowIndex}-brand`}
                        type="text"
                        data-field-key="brand"
                        placeholder="Select brand"
                        value={row.brand}
                        onChange={(e) => handleCellChange(rowIndex, "brand", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, "brand")}
                        onFocus={() => setFocusedCell({ rowIndex, field: "brand" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* CATEGORY */}
                    <td className="p-1 border-r border-slate-200">
                      <select
                        id={`cell-${rowIndex}-category`}
                        value={row.category}
                        onChange={(e) => handleCellChange(rowIndex, "category", e.target.value)}
                        onFocus={() => setFocusedCell({ rowIndex, field: "category" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Apparel">Apparel</option>
                        <option value="Footwear">Footwear</option>
                        <option value="Accessories">Accessories</option>
                      </select>
                    </td>

                    {/* SUB CATEGORY */}
                    <td className="p-1 border-r border-slate-200">
                      <select
                        id={`cell-${rowIndex}-subCategory`}
                        value={row.subCategory}
                        onChange={(e) => handleCellChange(rowIndex, "subCategory", e.target.value)}
                        onFocus={() => setFocusedCell({ rowIndex, field: "subCategory" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Men">Men</option>
                        <option value="Women">Women</option>
                        <option value="Kids">Kids</option>
                      </select>
                    </td>

                    {/* SIZE */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        id={`cell-${rowIndex}-size`}
                        type="text"
                        data-field-key="size"
                        placeholder="Size"
                        value={row.size}
                        onChange={(e) => handleCellChange(rowIndex, "size", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, "size")}
                        onFocus={() => setFocusedCell({ rowIndex, field: "size" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* COLOUR */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        id={`cell-${rowIndex}-colour`}
                        type="text"
                        data-field-key="colour"
                        placeholder="Colour"
                        value={row.colour}
                        onChange={(e) => handleCellChange(rowIndex, "colour", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, "colour")}
                        onFocus={() => setFocusedCell({ rowIndex, field: "colour" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* HSN CODE */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        id={`cell-${rowIndex}-hsnCode`}
                        type="text"
                        data-field-key="hsn_code"
                        placeholder="Enter HSN"
                        value={row.hsnCode}
                        onChange={(e) => handleCellChange(rowIndex, "hsnCode", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, "hsnCode")}
                        onFocus={() => setFocusedCell({ rowIndex, field: "hsnCode" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* GST % */}
                    <td className="p-1 border-r border-slate-200">
                      <select
                        id={`cell-${rowIndex}-gstPercentage`}
                        value={row.gstPercentage}
                        onChange={(e) => handleCellChange(rowIndex, "gstPercentage", e.target.value)}
                        onFocus={() => setFocusedCell({ rowIndex, field: "gstPercentage" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>

                    {/* SELLING PRICE */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        id={`cell-${rowIndex}-price`}
                        type="text"
                        data-field-key="selling_price"
                        placeholder="Enter price"
                        value={row.price}
                        onChange={(e) => handleCellChange(rowIndex, "price", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, "price")}
                        onFocus={() => setFocusedCell({ rowIndex, field: "price" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-mono font-semibold text-right focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* UOM */}
                    <td className="p-1 border-r border-slate-200">
                      <select
                        id={`cell-${rowIndex}-uom`}
                        value={row.uom}
                        onChange={(e) => handleCellChange(rowIndex, "uom", e.target.value)}
                        onFocus={() => setFocusedCell({ rowIndex, field: "uom" })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Pcs">Pcs</option>
                        <option value="Kg">Kg</option>
                        <option value="Mtr">Mtr</option>
                        <option value="Pair">Pair</option>
                        <option value="Box">Box</option>
                      </select>
                    </td>

                    {/* DYNAMIC BUSINESS CLASS ATTRIBUTES */}
                    {activeAttrs.map(attr => (
                      <td key={attr.id} className="p-1 border-r border-slate-200 bg-indigo-50/10">
                        <input
                          id={`cell-${rowIndex}-attr_${attr.name}`}
                          type="text"
                          data-field-key="product_name"
                          placeholder={`Enter ${attr.label}`}
                          value={row.attributes[attr.name] || ""}
                          onChange={(e) => handleCellChange(rowIndex, `attr_${attr.name}`, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, `attr_${attr.name}`)}
                          onFocus={() => setFocusedCell({ rowIndex, field: `attr_${attr.name}` })}
                          className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-xs text-indigo-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                    ))}

                    {/* DYNAMIC CUSTOM ATTRIBUTES */}
                    {customAttrs.map(attr => (
                      <td key={attr.key} className="p-1 border-r border-slate-200 bg-purple-50/10">
                        <input
                          id={`cell-${rowIndex}-attr_${attr.key}`}
                          type="text"
                          data-field-key="product_name"
                          placeholder={`Enter ${attr.label}`}
                          value={row.attributes[attr.key] || ""}
                          onChange={(e) => handleCellChange(rowIndex, `attr_${attr.key}`, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, `attr_${attr.key}`)}
                          onFocus={() => setFocusedCell({ rowIndex, field: `attr_${attr.key}` })}
                          className="w-full bg-white border border-purple-200 rounded px-2 py-1 text-xs text-purple-900 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </td>
                    ))}

                    {/* STATUS */}
                    <td className="p-2 text-center border-r border-slate-200">
                      {isBlankRow ? (
                        <span className="text-slate-400 text-xs font-mono font-bold">--</span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${statusObj.color}`}>
                          {statusObj.label}
                        </span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="p-1.5 text-center">
                      {isBlankRow ? (
                        <button
                          onClick={handleAddRow}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded-full transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Add New Row"
                        >
                          <Plus size={16} />
                        </button>
                      ) : (
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleDuplicateRow(rowIndex)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                            title="Duplicate Row"
                          >
                            <ClipboardCopy size={14} />
                          </button>
                          <button
                            onClick={() => handleRemoveRow(rowIndex)}
                            className="p-1 text-rose-600 hover:bg-rose-100 rounded transition-colors cursor-pointer"
                            title="Delete Row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend & KPI Summary Panel */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Validation Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-700">
            <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-md">
              <CheckCircle2 size={13} />
              <span className="font-bold text-[11px]">Valid</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-md">
              <AlertTriangle size={13} />
              <span className="font-bold text-[11px]">Warning</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-purple-50 border border-purple-200 text-purple-700 px-2.5 py-1 rounded-md">
              <span className="font-bold font-mono text-xs">o</span>
              <span className="font-bold text-[11px]">Duplicate SKU</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-md">
              <XCircle size={13} />
              <span className="font-bold text-[11px]">Duplicate Barcode</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-md">
              <AlertTriangle size={13} />
              <span className="font-bold text-[11px]">Invalid HSN/GST</span>
            </div>
            <div className="text-rose-600 font-bold text-xs">
              * <span className="text-slate-600 font-normal">Required Field</span>
            </div>
          </div>

          {/* Metrics KPI Summary Card */}
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-2 flex items-center space-x-6 shadow-2xs">
            <div className="text-center pr-4 border-r border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Rows</div>
              <div className="text-base font-bold text-slate-900">{totalRowsCount}</div>
            </div>
            <div className="text-center pr-4 border-r border-slate-200">
              <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Valid</div>
              <div className="text-base font-bold text-emerald-600">{validCount}</div>
            </div>
            <div className="text-center pr-4 border-r border-slate-200">
              <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Warning</div>
              <div className="text-base font-bold text-amber-600">{warningCount}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Errors</div>
              <div className="text-base font-bold text-rose-600">{errorCount}</div>
            </div>
          </div>
        </div>

        {/* Keyboard Helper & Bottom Action Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between border-t border-slate-200 pt-3 gap-4">
          <div className="flex flex-wrap items-center gap-2 text-slate-600 text-xs font-mono">
            <span>Tab: Next cell&nbsp;|&nbsp;Shift+Tab: Prev cell&nbsp;|&nbsp;Enter: Next row&nbsp;|&nbsp;Arrow Keys: Navigate</span>
            <div className="flex items-center space-x-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-bold font-sans">
              <Check size={12} />
              <span>Ctrl+V: Paste</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded text-[11px] font-bold font-sans">
              Headers: Auto-Map On
            </div>
            {lastMappingSummary && (
              <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold font-sans">
                <span>✓ {lastMappingSummary.mapped} auto-mapped</span>
                {lastMappingSummary.review > 0 && <span className="text-amber-700">| ⚠ {lastMappingSummary.review} review</span>}
                {lastMappingSummary.ignored > 0 && <span className="text-slate-500">| ○ {lastMappingSummary.ignored} ignored</span>}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2.5 flex-wrap">
            <button
              onClick={handleAddRow}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center space-x-1 shadow-2xs"
            >
              <Plus size={14} />
              <span>Add Row</span>
            </button>
            <button
              onClick={() => setShowAddAttrModal(true)}
              className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-800 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center space-x-1 shadow-2xs"
              title="Add custom dynamic attribute column to spreadsheet grid"
            >
              <Plus size={14} />
              <span>Add Attribute</span>
            </button>
            <button
              onClick={handleVerifyAllRows}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center space-x-1 shadow-2xs"
              title="Pre-verify grid items for duplicate SKUs, duplicate barcodes, and missing fields"
            >
              <CheckCircle2 size={14} />
              <span>Verify All</span>
            </button>
            <button
              onClick={handleSaveDraft}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Save current grid state to local storage draft"
            >
              Save Draft
            </button>
            <button
              onClick={handleLoadDraft}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Load saved grid draft from local storage"
            >
              Load Draft
            </button>
            <button
              onClick={handleSaveGrid}
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 size={14} />
              <span>{loading ? "Writing SKU Catalog..." : "Commit Grid to SMRITI DB"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Header Auto-Mapping Preview & Review Modal */}
      <HeaderMapPrevewModal
        isOpen={isMappingModalOpen}
        mappingResult={pendingMappingEngineResult}
        availableFields={getSmritiItemMasterFields([
          ...activeAttrs.map(a => ({ key: a.name, label: a.label })),
          ...customAttrs.map(c => ({ key: c.key, label: c.label }))
        ])}
        sampleRows={pendingSampleRows}
        onConfirm={(finalMappings) => {
          if (pendingMatrix) {
            applyConfirmedHeaderMappings(finalMappings, pendingMatrix, pendingHeaderRowIndex);
          }
        }}
        onClose={() => {
          setIsMappingModalOpen(false);
          setPendingMatrix(null);
          setPendingHeaderRowIndex(0);
          setPendingSampleRows([]);
          setPendingMappingEngineResult(null);
        }}
      />

      {/* Add Custom Attribute Modal */}
      {showAddAttrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus size={18} className="text-purple-600" />
                Add Dynamic Attribute Column
              </h3>
              <button
                onClick={() => setShowAddAttrModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Enter a custom attribute name (e.g. <span className="font-bold text-slate-800">Fabric, Pattern, Neckline, Occasion, Sleeve, Fit</span>). This column will instantly be added to your Excel copy-paste grid and header mapping engine.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Attribute Label Name</label>
              <input
                type="text"
                data-field-key="product_name"
                placeholder="e.g. Fabric"
                value={newAttrLabelInput}
                onChange={(e) => setNewAttrLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCustomAttribute();
                }}
                autoFocus
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddAttrModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomAttribute}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                Add Column to Grid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Alias Manager Modal */}
      <HeaderAliasDlgModal
        isOpen={showAliasManagerModal}
        onClose={() => setShowAliasManagerModal(false)}
        availableFields={getSmritiItemMasterFields([
          ...activeAttrs.map(a => ({ key: a.name, label: a.label })),
          ...customAttrs.map(c => ({ key: c.key, label: c.label }))
        ])}
      />

    </div>
  );
};
