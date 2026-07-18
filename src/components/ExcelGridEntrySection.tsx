/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { 
  FileSpreadsheet, Plus, Trash2, CheckCircle2, Keyboard,
  ClipboardCopy, ChevronDown, ChevronUp, Info
} from "lucide-react";
import { AttributeGroup, AttributeDefinition } from "../types.js";

interface ExcelGridEntrySectionProps {
  onRefreshProducts: () => Promise<void>;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

interface GridRow {
  code: string;
  name: string;
  barcode: string;
  costPrice: string;
  price: string;
  mrp: string;
  gstPercentage: string;
  stock: string;
  brand: string;
  styleCode: string;
  category: string;
  hsnCode: string;
  vendorCode: string;
  purchaseClass: string;
  department: string;
  merchandiseCategory: string;
  subCategory: string;
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
  {
    key: "code",
    label: "SKU Code",
    required: true,
    aliases: ["Product Style Code", "Style Code", "SKU Code", "SKU", "Code", "Product Code", "Product Style"],
    editable: false,
  },
  {
    key: "name",
    label: "Item Name",
    required: true,
    aliases: ["Item Name", "Description", "Item Description", "Name", "Product Name"],
    editable: false,
  },
  {
    key: "barcode",
    label: "Barcode",
    required: true,
    aliases: ["Barcode", "Barcode No", "Barcode Number", "UPC", "EAN"],
    editable: false,
  },
  {
    key: "costPrice",
    label: "Buy Cost",
    required: false,
    aliases: ["Buy Cost", "Cost Price", "Buying Price", "Cost", "Buy"],
    editable: true,
  },
  {
    key: "price",
    label: "Selling Price",
    required: false,
    aliases: ["Selling Price", "Selling", "Price", "Plate Rate"],
    editable: true,
  },
  {
    key: "mrp",
    label: "MRP",
    required: false,
    aliases: ["MRP", "Max Retail Price", "MRP Price", "Plate Rate or MRP"],
    editable: true,
  },
  {
    key: "gstPercentage",
    label: "GST %",
    required: false,
    aliases: ["GST %", "GST Percentage", "Tax", "Product Tax", "GST"],
    editable: true,
  },
  {
    key: "stock",
    label: "Stock",
    required: false,
    aliases: ["Initial Stock", "Stock", "Qty", "Quantity"],
    editable: true,
  },
  {
    key: "brand",
    label: "Brand Name",
    required: false,
    aliases: ["Brand", "Brand Name", "Manufacturer", "Label"],
    editable: true,
  },
  {
    key: "styleCode",
    label: "Product Style Code",
    required: false,
    aliases: ["Product Style Code", "Style Code", "StyleCode", "Product Code"],
    editable: true,
  },
  {
    key: "category",
    label: "Category",
    required: false,
    aliases: ["Category", "Merchandise Category", "Product Category", "Department"],
    editable: true,
  },
  {
    key: "hsnCode",
    label: "HSN Code",
    required: false,
    aliases: ["HSN Code", "HSN", "HSN/SAC", "HSNCode"],
    editable: true,
  },
  {
    key: "vendorCode",
    label: "Vendor Code",
    required: false,
    aliases: ["Vendor Code", "Vendor", "Supplier Code", "VendorID"],
    editable: true,
  },
  {
    key: "purchaseClass",
    label: "Purchase Class",
    required: false,
    aliases: ["Purchase Class", "PurchaseType", "Buying Class", "Purchase Category"],
    editable: true,
  },
  {
    key: "department",
    label: "Department",
    required: false,
    aliases: ["Department", "Division", "Store Department"],
    editable: true,
  },
  {
    key: "merchandiseCategory",
    label: "Merchandise Category",
    required: false,
    aliases: ["Merchandise Category", "Merchandise", "Merch Category", "Sub Category"],
    editable: true,
  },
  {
    key: "subCategory",
    label: "Sub Category",
    required: false,
    aliases: ["Sub Category", "Sub-category", "Subcategory", "Segment"],
    editable: true,
  },
  {
    key: "gender",
    label: "Gender",
    required: false,
    aliases: ["Gender", "Gender Code", "Sex"],
    editable: true,
  },
  {
    key: "heels",
    label: "Heels",
    required: false,
    aliases: ["Heels", "Heel Type", "Heel"],
    editable: true,
  },
  {
    key: "upperMaterial",
    label: "Upper Material",
    required: false,
    aliases: ["Upper Material", "UpperMaterial", "Upper", "Upper Shoe Material"],
    editable: true,
  },
  {
    key: "outsole",
    label: "Outsole",
    required: false,
    aliases: ["Outsole", "Outer Sole", "Sole", "Out Sole"],
    editable: true,
  },
  {
    key: "imageLink",
    label: "Image Link",
    required: false,
    aliases: ["Image Link", "Image URL", "Picture", "Image", "ImagePath"],
    editable: true,
  },
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

  // Core columns
  const coreCols = fieldConfigs;

  // Fetch groups and definitions on mount
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

  const activeGroup = groups.find(g => g.id === selectedGroupId);
  const activeAttrs = activeGroup 
    ? activeGroup.attributeIds.map(aid => definitions.find(d => d.id === aid)).filter((d): d is AttributeDefinition => !!d)
    : [];

  const allFieldKeys = [
    ...coreCols.map(c => c.key),
    ...activeAttrs.map(a => `attr_${a.name}`)
  ];

  // Initialize spreadsheet with blank rows
  useEffect(() => {
    resetGrid();
  }, [selectedGroupId]);

  const resetGrid = () => {
    const initialRows: GridRow[] = Array.from({ length: 5 }, () => createBlankRow());
    setRows(initialRows);
    setFocusedCell(null);
  };

  const createBlankRow = (): GridRow => {
    return {
      code: "",
      name: "",
      barcode: "",
      costPrice: "",
      price: "",
      mrp: "",
      gstPercentage: "18",
      stock: "",
      brand: "",
      styleCode: "",
      category: "",
      hsnCode: "",
      vendorCode: "",
      purchaseClass: "",
      department: "",
      merchandiseCategory: "",
      subCategory: "",
      gender: "",
      heels: "",
      upperMaterial: "",
      outsole: "",
      imageLink: "",
      attributes: {}
    };
  };

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

  const handleCellChange = (rowIndex: number, field: string, val: string) => {
    setRows(prev => {
      const updated = prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        if (field.startsWith("attr_")) {
          const attrName = field.substring(5);
          return {
            ...row,
            attributes: {
              ...row.attributes,
              [attrName]: val
            }
          };
        }
        return {
          ...row,
          [field]: val
        };
      });

      // Auto-create row if typing in the last row
      if (rowIndex === prev.length - 1 && val.trim() !== "") {
        return [...updated, createBlankRow()];
      }
      return updated;
    });
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, field: string) => {
    const colIndex = allFieldKeys.indexOf(field);

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        focusCell(rowIndex - 1, field);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < rows.length - 1) {
        focusCell(rowIndex + 1, field);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rowIndex < rows.length - 1) {
        focusCell(rowIndex + 1, field);
      } else {
        // Last row - add new row
        handleAddRow();
        setTimeout(() => focusCell(rowIndex + 1, field), 50);
      }
    } else if (e.key === "Tab") {
      if (e.shiftKey) {
        // Shift+Tab
        if (colIndex > 0) {
          e.preventDefault();
          focusCell(rowIndex, allFieldKeys[colIndex - 1]);
        } else if (rowIndex > 0) {
          e.preventDefault();
          focusCell(rowIndex - 1, allFieldKeys[allFieldKeys.length - 1]);
        }
      } else {
        // Tab
        if (colIndex < allFieldKeys.length - 1) {
          e.preventDefault();
          focusCell(rowIndex, allFieldKeys[colIndex + 1]);
        } else if (rowIndex < rows.length - 1) {
          e.preventDefault();
          focusCell(rowIndex + 1, allFieldKeys[0]);
        } else {
          // Last cell - add new row
          e.preventDefault();
          handleAddRow();
          setTimeout(() => focusCell(rowIndex + 1, allFieldKeys[0]), 50);
        }
      }
    }
  };

  const focusCell = (rowIndex: number, field: string) => {
    setFocusedCell({ rowIndex, field });
    const cellId = `cell-${rowIndex}-${field}`;
    document.getElementById(cellId)?.focus();
  };

  const normalizeHeader = (text: string) =>
    text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  const findFieldKeys = (headerText: string, attrs: typeof activeAttrs): string[] => {
    const normalized = normalizeHeader(headerText);
    const keys: string[] = [];

    // Check core columns using configured aliases
    for (const config of fieldConfigs) {
      if (
        config.aliases.some(
          (alias) => normalizeHeader(alias) === normalized
        )
      ) {
        keys.push(config.key);
      }
    }

    // Check active attributes
    for (const attr of attrs) {
      const attrNameClean = normalizeHeader(attr.name);
      const attrLabelClean = normalizeHeader(attr.label);
      if (normalized === attrNameClean || normalized === attrLabelClean) {
        keys.push(`attr_${attr.name}`);
      }
    }

    // Unknown headers are treated as custom attribute names
    if (keys.length === 0 && normalized) {
      keys.push(`attr_${normalized}`);
    }

    return keys;
  };

  // Clipboard Paste support
  const handlePaste = (e: React.ClipboardEvent<HTMLTableSectionElement>) => {
    if (!focusedCell) return;
    
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text");
    const pastedRows = pasteData
      .split(/\r?\n/)
      .map(row => row.split("\t"))
      .filter(row => row.length > 0 && row.some(cell => cell.trim() !== ""));

    if (pastedRows.length === 0) return;

    const startRowIdx = focusedCell.rowIndex;

    // Detect if first row is a header row
    const firstRow = pastedRows[0];
    let matchedHeadersCount = 0;
    const headerKeysList = firstRow.map(cell => {
      const keys = findFieldKeys(cell, activeAttrs);
      if (keys.length > 0) matchedHeadersCount++;
      return keys;
    });

    const isHeaderRow = matchedHeadersCount >= 2;

    if (isHeaderRow) {
      const dataRows = pastedRows.slice(1);
      setRows(prev => {
        const copy = [...prev];
        dataRows.forEach((pastedRow, rOffset) => {
          const targetRowIdx = startRowIdx + rOffset;
          
          while (targetRowIdx >= copy.length) {
            copy.push(createBlankRow());
          }

          const updatedRow = { ...copy[targetRowIdx], attributes: { ...copy[targetRowIdx].attributes } };

          pastedRow.forEach((val, cOffset) => {
            const fields = headerKeysList[cOffset];
            if (fields && fields.length > 0) {
              fields.forEach(field => {
                if (field.startsWith("attr_")) {
                  const attrName = field.substring(5);
                  updatedRow.attributes[attrName] = val.trim();
                } else {
                  (updatedRow as any)[field] = val.trim();
                }
              });
            }
          });

          copy[targetRowIdx] = updatedRow;
        });

        // Ensure last row is blank for typing expansion
        if (copy[copy.length - 1].code !== "" || copy[copy.length - 1].name !== "") {
          copy.push(createBlankRow());
        }
        
        return copy;
      });

      onNotification("Header Paste Mapping Completed", `Mapped and pasted ${dataRows.length} rows using column headers.`, "success");
      return;
    }

    // Fallback: positional paste relative to the focused cell
    const startColIdx = allFieldKeys.indexOf(focusedCell.field);

    setRows(prev => {
      const copy = [...prev];
      pastedRows.forEach((pastedRow, rOffset) => {
        const targetRowIdx = startRowIdx + rOffset;
        
        while (targetRowIdx >= copy.length) {
          copy.push(createBlankRow());
        }

        pastedRow.forEach((val, cOffset) => {
          const targetColIdx = startColIdx + cOffset;
          if (targetColIdx < allFieldKeys.length) {
            const field = allFieldKeys[targetColIdx];
            if (field.startsWith("attr_")) {
              const attrName = field.substring(5);
              copy[targetRowIdx] = {
                ...copy[targetRowIdx],
                attributes: {
                  ...copy[targetRowIdx].attributes,
                  [attrName]: val.trim()
                }
              };
            } else {
              copy[targetRowIdx] = {
                ...copy[targetRowIdx],
                [field]: val.trim()
              };
            }
          }
        });
      });

      // Ensure last row is blank for typing expansion
      if (copy[copy.length - 1].code !== "" || copy[copy.length - 1].name !== "") {
        copy.push(createBlankRow());
      }
      
      return copy;
    });

    onNotification("Grid Paste Completed", `Pasted ${pastedRows.length} rows from clipboard.`, "success");
  };

  const handleSaveGrid = async () => {
    // Filter out completely blank rows
    const validRows = rows.filter(r => 
      r.code.trim() !== "" || r.name.trim() !== "" || r.barcode.trim() !== ""
    );

    if (validRows.length === 0) {
      onNotification("Blank Sheet", "Please enter at least one item details in the grid.", "error");
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failCount = 0;
    
    try {
      // Validate mandatory custom attributes
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        
        if (!row.code.trim() || !row.name.trim() || !row.barcode.trim()) {
          onNotification("Validation Failed", `Row ${i + 1} requires SKU Code, Item Name and Barcode.`, "error");
          setLoading(false);
          return;
        }

        for (const config of fieldConfigs) {
          if (config.editable && config.required) {
            const value = (row as any)[config.key];
            if (!value || value.toString().trim() === "") {
              onNotification(
                "Validation Failed",
                `Row ${i + 1} requires ${config.label} because it is configured as required.`,
                "error"
              );
              setLoading(false);
              return;
            }
          }
        }

        for (const attr of activeAttrs) {
          const val = row.attributes[attr.name];
          if (attr.isMandatory && (!val || val.trim() === "")) {
            onNotification("Mandatory Field", `Row ${i + 1}: Attribute "${attr.label}" is mandatory.`, "error");
            setLoading(false);
            return;
          }
        }
      }

      // Submit items sequentially
      for (const row of validRows) {
        try {
          // Construct unique SKU code by suffixing color/size to the base style code
          const variantSuffix = [row.attributes.color, row.attributes.size]
            .filter(v => v && v.trim() !== "")
            .map(v => v.trim().toUpperCase())
            .join("-");
          
          const uniqueSku = variantSuffix ? `${row.code.trim()}-${variantSuffix}` : row.code.trim();

          const payload = {
            id: `p-grid-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            code: uniqueSku,
            name: row.name,
            price: parseFloat(row.price) || 0,
            stock: parseInt(row.stock) || 0,
            category: row.category.trim() || activeGroup?.name || "General",
            barcode: row.barcode,
            cost_price: parseFloat(row.costPrice) || Math.round((parseFloat(row.price) || 0) * 0.6),
            mrp: parseFloat(row.mrp) || parseFloat(row.price) || 0,
            gst_percentage: parseFloat(row.gstPercentage) || 18.00,
            sku: uniqueSku,
            style_code: row.styleCode.trim() || row.code.trim(),
            brand: row.brand.trim() || row.attributes.brand || "SMRITI",
            hsn_code: row.hsnCode.trim() || row.attributes.hsnCode || row.attributes.HSN || row.attributes.hsn || "61091000",
            primary_image_url: row.imageLink.trim() || undefined,
            attributes: {
              ...row.attributes,
              ...(row.brand.trim() ? { brand: row.brand.trim() } : {}),
              ...(row.styleCode.trim() ? { styleCode: row.styleCode.trim() } : {}),
              ...(row.category.trim() ? { category: row.category.trim() } : {}),
              ...(row.hsnCode.trim() ? { hsnCode: row.hsnCode.trim() } : {}),
              ...(row.vendorCode.trim() ? { vendorCode: row.vendorCode.trim() } : {}),
              ...(row.purchaseClass.trim() ? { purchaseClass: row.purchaseClass.trim() } : {}),
                ...(row.department.trim() ? { department: row.department.trim() } : {}),
              ...(row.merchandiseCategory.trim() ? { merchandiseCategory: row.merchandiseCategory.trim() } : {}),
              ...(row.subCategory.trim() ? { subCategory: row.subCategory.trim() } : {}),
              ...(row.gender.trim() ? { gender: row.gender.trim() } : {}),
              ...(row.heels.trim() ? { heels: row.heels.trim() } : {}),
              ...(row.upperMaterial.trim() ? { upperMaterial: row.upperMaterial.trim() } : {}),
              ...(row.outsole.trim() ? { outsole: row.outsole.trim() } : {}),
            },
          };

          try {
            const response = await apiFetchV1("/products", {
              method: "POST",
              body: JSON.stringify(payload),
            });

            if (response && response.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (err) {
            console.error("Product save failed", err);
            failCount++;
          }
        } catch (err: any) {
          console.error("Row save error", err);
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

  // Build template header string from current grid columns + active attributes
  const copyTemplateHeaders = () => {
    const coreLabels = fieldConfigs.map((config) => config.label);
    const attrLabels = activeAttrs.map((a) => a.label);
    const allHeaders = [...coreLabels, ...attrLabels].join("\t");
    navigator.clipboard.writeText(allHeaders).then(() => {
      onNotification("Headers Copied", "Paste this header row into your Excel sheet as the first row, then fill data below it.", "success");
    });
  };

  const copyTemplateSample = () => {
    const coreLabels = fieldConfigs.map((config) => config.label);
    const attrLabels = activeAttrs.map((a) => a.label);
    const allHeaders = [...coreLabels, ...attrLabels].join("\t");
    const sampleValues = [
      "700070007001",
      "CH-01-A",
      "TATTLY THREADS CHIKKU",
      "TATTLY THREADS",
      "CH-01-A",
      "LADIES",
      "61091000",
      "SIS",
      "LADIES FTW",
      "LADIES FTW",
      "CHAPPAL",
      "FLAT",
      "LADIES",
      "FLAT",
      "SYNTHETIC",
      "TPR",
      "https://example.com/image.jpg",
      "179",
      "299",
      "375",
      "5",
      "5"
    ];
    const sampleRow = [...sampleValues, ...activeAttrs.map(() => "")].join("\t");
    navigator.clipboard.writeText(`${allHeaders}\n${sampleRow}`).then(() => {
      onNotification("Template & Sample Copied", "Copied headers and a sample row to the clipboard.", "success");
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Selector Toolbar */}
      <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="font-display font-bold text-sm text-theme-body flex items-center space-x-2">
            <FileSpreadsheet size={16} className="text-emerald-400" />
            <span>Excel-Style Manual Data Entry Workspace</span>
          </h4>
          <p className="text-[11px] text-theme-muted mt-0.5">Type directly, use Tab / Arrow Keys to navigate, or <strong className="text-emerald-400">paste directly from Excel</strong> — column headers are detected automatically.</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-theme-muted whitespace-nowrap">Business Class:</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={resetGrid}
            className="px-3 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-body text-xs rounded-lg transition-colors cursor-pointer"
          >
            Clear Grid
          </button>
        </div>
      </div>

      {/* ── How-to-Paste Guide (collapsible) ─────────────────────────────────── */}
      <div className="bg-blue-950/20 border border-blue-500/25 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowGuide(g => !g)}
          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-blue-950/30 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Info size={14} className="text-blue-400" />
            <span className="text-xs font-bold text-blue-300 uppercase tracking-wider font-mono">
              How to Copy-Paste from Excel / Google Sheets
            </span>
            <span className="bg-blue-500/20 text-blue-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-blue-500/30">
              Header Auto-Detection
            </span>
          </div>
          {showGuide
            ? <ChevronUp size={14} className="text-blue-400" />
            : <ChevronDown size={14} className="text-blue-400" />}
        </button>

        {showGuide && (
          <div className="px-5 pb-5 space-y-4">
            {/* Step-by-step instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { step: "1", icon: "📋", title: "Prepare your Excel", body: "Make sure your Excel sheet has a header row as the FIRST row. Column names do not need to match exactly — see the table below for accepted names." },
                { step: "2", icon: "📌", title: "Click a cell in Row 1", body: "Click on any cell in the first data row of this grid (e.g. Row 1 under 'SKU Code'). This tells SMRITI where to start pasting." },
                { step: "3", icon: "✅", title: "Paste with Ctrl+V", body: "Select your Excel data including the header row, copy it (Ctrl+C), then press Ctrl+V here. SMRITI will match columns automatically." },
              ].map(s => (
                <div key={s.step} className="bg-theme-surface-2/60 border border-blue-500/15 rounded-xl p-4 space-y-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider font-mono">Step {s.step}</span>
                  </div>
                  <div className="text-xs font-bold text-theme-body font-display">{s.title}</div>
                  <div className="text-[11px] text-theme-muted leading-relaxed">{s.body}</div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="bg-theme-surface-2 border border-blue-500/10 rounded-xl p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                  <div>
                    <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider font-mono">Optional Field Configuration</div>
                    <div className="text-[11px] text-theme-muted mt-1">
                      Make optional import fields required or customize accepted Excel header aliases.
                    </div>
                  </div>
                  <button
                    onClick={resetFieldConfigs}
                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold rounded-lg transition-colors"
                  >
                    Reset to defaults
                  </button>
                </div>

                <div className="grid gap-4">
                  {fieldConfigs.filter((config) => config.editable).map((config) => (
                    <div key={config.key} className="grid gap-2 md:grid-cols-[160px_1fr_96px] items-center">
                      <div className="text-[10px] font-bold text-theme-body uppercase tracking-wider">{config.label}</div>
                      <input
                        type="text"
                        value={config.aliases.join(" · ")}
                        onChange={(e) =>
                          updateFieldConfig(config.key, {
                            aliases: e.target.value
                              .split(/·|,|;/)
                              .map((alias) => alias.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full min-w-0 bg-theme-surface-1 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                      />
                      <label className="inline-flex items-center gap-2 text-[10px] text-theme-muted">
                        <input
                          type="checkbox"
                          checked={config.required}
                          onChange={(e) => updateFieldConfig(config.key, { required: e.target.checked })}
                          className="h-4 w-4 rounded border-theme-divider text-blue-500 focus:ring-blue-500"
                        />
                        Required
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono">Accepted Column Header Names (any of these will be recognised)</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={copyTemplateHeaders}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <ClipboardCopy size={11} />
                    <span>Copy Header Row</span>
                  </button>
                  <button
                    onClick={copyTemplateSample}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <ClipboardCopy size={11} />
                    <span>Copy Sample Template</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto border border-blue-500/15 rounded-xl">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-blue-950/40 border-b border-blue-500/20 text-blue-300 font-mono uppercase tracking-wider">
                      <th className="px-4 py-2.5 font-semibold border-r border-blue-500/15">SMRITI Field</th>
                      <th className="px-4 py-2.5 font-semibold border-r border-blue-500/15">Required?</th>
                      <th className="px-4 py-2.5 font-semibold">Accepted Excel Column Names</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/10">
                    {[
                      { field: "SKU Code",      req: true,  aliases: "Product Style Code · Style Code · SKU Code · SKU · Code · Product Code" },
                      { field: "Item Name",     req: true,  aliases: "Item Name · Name · Description · Item Description · Product Name" },
                      { field: "Barcode",       req: true,  aliases: "Barcode · Barcode No · Barcode Number · UPC · EAN" },
                      { field: "Buy Cost",      req: false, aliases: "Buy Cost · Cost Price · Buying Price · Cost · Buy" },
                      { field: "Selling Price", req: false, aliases: "Selling Price · Selling · Price · Plate Rate" },
                      { field: "MRP",           req: false, aliases: "MRP · Max Retail Price · MRP Price · Plate Rate or MRP" },
                      { field: "GST %",         req: false, aliases: "GST % · GST Percentage · Tax · Product Tax · GST" },
                      { field: "Stock",         req: false, aliases: "Initial Stock · Stock · Qty · Quantity" },
                      { field: "Brand Name",    req: false, aliases: "Brand · Brand Name · Manufacturer · Label" },
                      { field: "Product Style Code", req: false, aliases: "Product Style Code · Style Code · StyleCode · Product Code" },
                      { field: "Category",      req: false, aliases: "Category · Merchandise Category · Product Category · Department" },
                      { field: "HSN Code",     req: false, aliases: "HSN Code · HSN · HSN/SAC · HSNCode" },
                      { field: "Vendor Code",   req: false, aliases: "Vendor Code · Vendor · Supplier Code · VendorID" },
                      { field: "Purchase Class", req: false, aliases: "Purchase Class · PurchaseType · Buying Class · Purchase Category" },
                      { field: "Department",   req: false, aliases: "Department · Division · Store Department" },
                      { field: "Merchandise Category", req: false, aliases: "Merchandise Category · Merchandise · Merch Category · Sub Category" },
                      { field: "Sub Category", req: false, aliases: "Sub Category · Sub-category · Subcategory · Segment" },
                      { field: "Gender",       req: false, aliases: "Gender · Gender Code · Sex" },
                      { field: "Heels",        req: false, aliases: "Heels · Heel Type · Heel" },
                      { field: "Upper Material", req: false, aliases: "Upper Material · UpperMaterial · Upper · Upper Shoe Material" },
                      { field: "Outsole",      req: false, aliases: "Outsole · Outer Sole · Sole · Out Sole" },
                      { field: "Image Link",   req: false, aliases: "Image Link · Image URL · Picture · Image · ImagePath" },
                      ...activeAttrs.map(a => ({
                        field: a.label,
                        req: a.isMandatory,
                        aliases: `${a.label} · ${a.name}`
                      }))
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-blue-950/20 transition-colors">
                        <td className="px-4 py-2 border-r border-blue-500/10 font-bold font-mono text-theme-body">{row.field}</td>
                        <td className="px-4 py-2 border-r border-blue-500/10">
                          {row.req
                            ? <span className="text-rose-400 font-bold">Required</span>
                            : <span className="text-theme-muted">Optional</span>}
                        </td>
                        <td className="px-4 py-2 text-theme-muted font-mono">{row.aliases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-theme-muted font-mono">
                ✦ Column names are matched case-insensitively. Extra spaces and special characters are ignored.
                ✦ Columns that don't match any known header are silently skipped.
              </p>
              <div className="bg-theme-surface-1 border border-blue-500/10 rounded-xl p-3 text-[10px] font-mono text-theme-muted">
                <div className="font-semibold text-theme-body mb-2">Exact Excel header row for the current Item Master import template:</div>
                <pre className="whitespace-pre-wrap break-all bg-theme-surface-2 rounded-xl p-3 text-[10px] text-theme-body">
SKU Code	Item Name	Barcode	Buy Cost	Selling Price	MRP	GST %	Stock	Brand Name	Product Style Code	Category	HSN Code	Vendor Code	Purchase Class	Department	Merchandise Category	Sub Category	Gender	Heels	Upper Material	Outsole	Image Link
                </pre>
                <div className="font-semibold text-theme-body mt-2">Sample row values for a matching import row:</div>
                <pre className="whitespace-pre-wrap break-all bg-theme-surface-2 rounded-xl p-3 text-[10px] text-theme-body">
SNE-001	Vintage Trainer	8901234567890	1200	1500	1750	18	10	TATTLY THREADS	CH-01-A	Footwear	61091000	VEND-1001	Retail	Footwear	Ladies Footwear	Ladies Footwear	Women	Flat	Synthetic	TPR	https://example.com/image.jpg
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid Sheet Container */}
      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-4">
        <div className="overflow-x-auto border border-theme-divider/70 rounded-xl max-h-96">
          <table className="w-full text-left border-collapse text-xs table-fixed">
            <thead>
              <tr className="bg-theme-surface-2 border-b border-theme-divider text-theme-muted font-mono text-[9px] tracking-wider uppercase">
                <th className="p-3 text-center w-12 border-r border-theme-divider/40">Row</th>
                {coreCols.map(c => (
                  <th key={c.key} className="p-3 border-r border-theme-divider/40 min-w-[130px]">{c.label}</th>
                ))}
                {activeAttrs.map(attr => (
                  <th key={attr.id} className="p-3 border-r border-theme-divider/40 min-w-[130px] text-indigo-300">
                    {attr.label} {attr.isMandatory && "*"}
                  </th>
                ))}
                <th className="p-3 text-center w-16">Action</th>
              </tr>
            </thead>
            <tbody onPaste={handlePaste}>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-theme-divider/40 hover:bg-theme-surface-2/10">
                  <td className="p-3 text-center border-r border-theme-divider/40 bg-theme-surface-2/15 font-mono text-[10px] text-theme-muted">
                    {rowIndex + 1}
                  </td>
                  
                  {/* SKU Code */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-code`}
                      type="text"
                      placeholder="e.g. SNE-001"
                      value={row.code}
                      onChange={(e) => handleCellChange(rowIndex, "code", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "code")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "code" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Item Name */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-name`}
                      type="text"
                      placeholder="Vintage Trainer"
                      value={row.name}
                      onChange={(e) => handleCellChange(rowIndex, "name", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "name")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "name" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white"
                    />
                  </td>

                  {/* Barcode */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-barcode`}
                      type="text"
                      placeholder="8901234567"
                      value={row.barcode}
                      onChange={(e) => handleCellChange(rowIndex, "barcode", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "barcode")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "barcode" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Buy Cost */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-costPrice`}
                      type="number"
                      placeholder="0.00"
                      value={row.costPrice}
                      onChange={(e) => handleCellChange(rowIndex, "costPrice", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "costPrice")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "costPrice" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono text-right"
                    />
                  </td>

                  {/* Selling Price */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-price`}
                      type="number"
                      placeholder="0.00"
                      value={row.price}
                      onChange={(e) => handleCellChange(rowIndex, "price", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "price")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "price" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono text-right"
                    />
                  </td>

                  {/* MRP */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-mrp`}
                      type="number"
                      placeholder="0.00"
                      value={row.mrp}
                      onChange={(e) => handleCellChange(rowIndex, "mrp", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "mrp")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "mrp" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono text-right"
                    />
                  </td>

                  {/* GST */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-gstPercentage`}
                      type="number"
                      placeholder="18"
                      value={row.gstPercentage}
                      onChange={(e) => handleCellChange(rowIndex, "gstPercentage", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "gstPercentage")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "gstPercentage" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono text-right"
                    />
                  </td>

                  {/* Stock */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-stock`}
                      type="number"
                      placeholder="0"
                      value={row.stock}
                      onChange={(e) => handleCellChange(rowIndex, "stock", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "stock")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "stock" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono text-right"
                    />
                  </td>

                  {/* Brand */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-brand`}
                      type="text"
                      placeholder="SMRITI"
                      value={row.brand}
                      onChange={(e) => handleCellChange(rowIndex, "brand", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "brand")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "brand" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Product Style Code */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-styleCode`}
                      type="text"
                      placeholder="STYLE-001"
                      value={row.styleCode}
                      onChange={(e) => handleCellChange(rowIndex, "styleCode", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "styleCode")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "styleCode" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Category */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-category`}
                      type="text"
                      placeholder="Apparel"
                      value={row.category}
                      onChange={(e) => handleCellChange(rowIndex, "category", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "category")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "category" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* HSN Code */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-hsnCode`}
                      type="text"
                      placeholder="61091000"
                      value={row.hsnCode}
                      onChange={(e) => handleCellChange(rowIndex, "hsnCode", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "hsnCode")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "hsnCode" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Vendor Code */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-vendorCode`}
                      type="text"
                      placeholder="VND-12345"
                      value={row.vendorCode}
                      onChange={(e) => handleCellChange(rowIndex, "vendorCode", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "vendorCode")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "vendorCode" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Purchase Class */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-purchaseClass`}
                      type="text"
                      placeholder="Standard"
                      value={row.purchaseClass}
                      onChange={(e) => handleCellChange(rowIndex, "purchaseClass", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "purchaseClass")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "purchaseClass" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Department */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-department`}
                      type="text"
                      placeholder="Ladies FTW"
                      value={row.department}
                      onChange={(e) => handleCellChange(rowIndex, "department", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "department")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "department" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Merchandise Category */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-merchandiseCategory`}
                      type="text"
                      placeholder="Chappal"
                      value={row.merchandiseCategory}
                      onChange={(e) => handleCellChange(rowIndex, "merchandiseCategory", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "merchandiseCategory")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "merchandiseCategory" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Sub Category */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-subCategory`}
                      type="text"
                      placeholder="Flat"
                      value={row.subCategory}
                      onChange={(e) => handleCellChange(rowIndex, "subCategory", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "subCategory")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "subCategory" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Gender */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-gender`}
                      type="text"
                      placeholder="LADIES"
                      value={row.gender}
                      onChange={(e) => handleCellChange(rowIndex, "gender", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "gender")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "gender" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Heels */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-heels`}
                      type="text"
                      placeholder="Flat"
                      value={row.heels}
                      onChange={(e) => handleCellChange(rowIndex, "heels", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "heels")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "heels" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Upper Material */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-upperMaterial`}
                      type="text"
                      placeholder="Synthetic"
                      value={row.upperMaterial}
                      onChange={(e) => handleCellChange(rowIndex, "upperMaterial", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "upperMaterial")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "upperMaterial" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Outsole */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-outsole`}
                      type="text"
                      placeholder="TPR"
                      value={row.outsole}
                      onChange={(e) => handleCellChange(rowIndex, "outsole", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "outsole")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "outsole" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Image Link */}
                  <td className="p-1 border-r border-theme-divider/40">
                    <input
                      id={`cell-${rowIndex}-imageLink`}
                      type="text"
                      placeholder="https://..."
                      value={row.imageLink}
                      onChange={(e) => handleCellChange(rowIndex, "imageLink", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "imageLink")}
                      onFocus={() => setFocusedCell({ rowIndex, field: "imageLink" })}
                      className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                    />
                  </td>

                  {/* Dynamic Custom Attributes */}
                  {activeAttrs.map(attr => {
                    const fieldKey = `attr_${attr.name}`;
                    const val = row.attributes[attr.name] || "";
                    
                    return (
                      <td key={attr.id} className="p-1 border-r border-theme-divider/40">
                        {attr.dataType === "select" ? (
                          <select
                            id={`cell-${rowIndex}-${fieldKey}`}
                            value={val}
                            onChange={(e) => handleCellChange(rowIndex, fieldKey, e.target.value)}
                            onFocus={() => setFocusedCell({ rowIndex, field: fieldKey })}
                            className="w-full bg-transparent border-0 outline-none text-xs px-2 py-0.5 text-white"
                          >
                            <option value="" className="bg-theme-surface-2">-- Option --</option>
                            {attr.validValues.map(opt => (
                              <option key={opt} value={opt} className="bg-theme-surface-2">{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={`cell-${rowIndex}-${fieldKey}`}
                            type={attr.dataType === "number" ? "number" : "text"}
                            placeholder={`Enter ${attr.label}`}
                            value={val}
                            onChange={(e) => handleCellChange(rowIndex, fieldKey, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, fieldKey)}
                            onFocus={() => setFocusedCell({ rowIndex, field: fieldKey })}
                            className="w-full bg-transparent border-0 outline-none text-xs px-2 py-1 text-white font-mono"
                          />
                        )}
                      </td>
                    );
                  })}

                  {/* Action Delete row */}
                  <td className="p-1.5 text-center">
                    <button
                      onClick={() => handleRemoveRow(rowIndex)}
                      className="p-1 hover:bg-rose-950/40 text-rose-400 rounded transition-colors"
                      title="Delete Row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Keyboard Helper Tips Banner */}
        <div className="flex flex-col md:flex-row items-center justify-between border-t border-theme-divider/40 pt-4 gap-4">
          <div className="flex items-center space-x-2 text-theme-muted text-[10px] font-mono">
            <Keyboard size={13} className="text-blue-400" />
            <span>Tab: Next cell&nbsp;|&nbsp;Shift+Tab: Prev&nbsp;|&nbsp;Enter: Next row&nbsp;|&nbsp;Arrows: Navigate&nbsp;|&nbsp;<span className="text-emerald-400 font-bold">Ctrl+V with headers: auto-maps columns</span></span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleAddRow}
              className="px-4 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-body font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <Plus size={12} />
              <span>Add Empty Row</span>
            </button>
            <button
              onClick={handleSaveGrid}
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow-lg flex items-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 size={12} />
              <span>{loading ? "Writing SKU Catalog..." : "Commit Grid to SMRITI DB"}</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
