/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.9.0
 * Created      : 2026-08-25
 * Modified     : 2026-08-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: SMRITI WYSIWYG Thermal Barcode Label Designer
 */

import React, { useState, useEffect, useRef } from "react";
import { Product } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { ThermalBarcodeSvg } from "./ThermalBarcodeSvg.tsx";
import {
  Sliders,
  Printer,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  Code,
  Download,
  CheckCircle2,
  AlertCircle,
  Move,
  Type,
  Barcode,
  Layers,
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { dispatchToQzTray, isQzTrayEnabled } from "../../utils/qzTrayClient.ts";

export interface VisualLabelElement {
  id: string;
  type: "text" | "barcode" | "badge" | "line";
  field:
    | "brand"
    | "product_name"
    | "style_code"
    | "barcode"
    | "mrp"
    | "selling_price"
    | "cost_mask"
    | "size_color"
    | "hsn_code"
    | "custom_text";
  label: string;
  xMm: number;
  yMm: number;
  widthMm?: number;
  heightMm?: number;
  fontSizePt: number;
  fontWeight: "normal" | "bold" | "extrabold";
  textAlign: "left" | "center" | "right";
  staticText?: string;
  prefix?: string;
  suffix?: string;
  isVisible: boolean;
}

export interface LabelSizePreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  columns: number;
  description: string;
}

const STANDARD_PRESETS: LabelSizePreset[] = [
  { id: "50x25", name: "50mm × 25mm (Standard 1-Up)", widthMm: 50, heightMm: 25, columns: 1, description: "Standard Apparel & Retail Barcode Tag" },
  { id: "38x25", name: "38mm × 25mm (Compact 2-Up)", widthMm: 38, heightMm: 25, columns: 2, description: "Supermarket & Grocery Shelf Sticker" },
  { id: "100x50", name: "100mm × 50mm (Shipping Dispatch)", widthMm: 100, heightMm: 50, columns: 1, description: "Master Carton & Logistics Label" },
  { id: "35x15", name: "35mm × 15mm (Jewelry Dumbbell)", widthMm: 35, heightMm: 15, columns: 1, description: "Jewelry, Optical & Watch Mini Tag" },
];

const DEFAULT_ELEMENTS: VisualLabelElement[] = [
  {
    id: "el_brand",
    type: "text",
    field: "brand",
    label: "Brand Header",
    xMm: 2,
    yMm: 2,
    fontSizePt: 8,
    fontWeight: "extrabold",
    textAlign: "left",
    prefix: "",
    suffix: "",
    isVisible: true
  },
  {
    id: "el_cost_mask",
    type: "text",
    field: "cost_mask",
    label: "Cost Cipher Code",
    xMm: 36,
    yMm: 2,
    fontSizePt: 7,
    fontWeight: "bold",
    textAlign: "right",
    prefix: "C:",
    suffix: "",
    isVisible: true
  },
  {
    id: "el_product",
    type: "text",
    field: "product_name",
    label: "Product Name & Style",
    xMm: 2,
    yMm: 6,
    fontSizePt: 7.5,
    fontWeight: "bold",
    textAlign: "left",
    prefix: "",
    suffix: "",
    isVisible: true
  },
  {
    id: "el_barcode",
    type: "barcode",
    field: "barcode",
    label: "Barcode Symbol",
    xMm: 3,
    yMm: 10,
    widthMm: 44,
    heightMm: 9,
    fontSizePt: 7,
    fontWeight: "normal",
    textAlign: "center",
    isVisible: true
  },
  {
    id: "el_size_color",
    type: "text",
    field: "size_color",
    label: "Size & Colour Attributes",
    xMm: 2,
    yMm: 20,
    fontSizePt: 6.5,
    fontWeight: "bold",
    textAlign: "left",
    prefix: "",
    suffix: "",
    isVisible: true
  },
  {
    id: "el_mrp",
    type: "text",
    field: "mrp",
    label: "MRP Price (Incl Taxes)",
    xMm: 28,
    yMm: 20,
    fontSizePt: 7.5,
    fontWeight: "extrabold",
    textAlign: "right",
    prefix: "MRP: ₹",
    suffix: "",
    isVisible: true
  }
];

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: "prod_001",
    code: "TSH-NAV-001",
    name: "Classic Cotton Polo T-Shirt",
    brand: "SMRITI LUXE",
    styleCode: "PL-NAVY-L",
    color: "Navy Blue",
    size: "L",
    category: "Apparel",
    mrp: 799.00,
    price: 699.00,
    costPrice: 350.00,
    barcode: "8901234567890",
    hsnCode: "61091000",
    stock: 45
  },
  {
    id: "prod_002",
    code: "DNM-SLM-002",
    name: "Slim Fit Stretch Denim Jeans",
    brand: "DENIM CO",
    styleCode: "SLIM-32-BLU",
    color: "Indigo Wash",
    size: "32",
    category: "Apparel",
    mrp: 1999.00,
    price: 1699.00,
    costPrice: 850.00,
    barcode: "8909876543210",
    hsnCode: "62034200",
    stock: 28
  },
  {
    id: "prod_003",
    code: "SHR-FRM-003",
    name: "Executive Formal Cotton Shirt",
    brand: "RAYMOND",
    styleCode: "EXE-WHT-40",
    color: "White",
    size: "40",
    category: "Apparel",
    mrp: 1499.00,
    price: 1299.00,
    costPrice: 620.00,
    barcode: "8901122334455",
    hsnCode: "62052000",
    stock: 19
  }
];

interface VisualLabelDesignerProps {
  onBackToPrinting?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info") => void;
}

export const VisualLabelDesigner: React.FC<VisualLabelDesignerProps> = ({
  onBackToPrinting,
  onNotification
}) => {
  const [selectedPreset, setSelectedPreset] = useState<LabelSizePreset>(STANDARD_PRESETS[0]);
  const [labelWidthMm, setLabelWidthMm] = useState<number>(50);
  const [labelHeightMm, setLabelHeightMm] = useState<number>(25);
  const [elements, setElements] = useState<VisualLabelElement[]>(DEFAULT_ELEMENTS);
  const [selectedElementId, setSelectedElementId] = useState<string>("el_brand");
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [layoutName, setLayoutName] = useState<string>("Standard Retail Tag 50x25");
  const [showZplCode, setShowZplCode] = useState<boolean>(false);

  // Cipher map for Cost Mask preview (0->A, 1->B... 9->J)
  const [cipherMap, setCipherMap] = useState<Record<string, string>>({
    "0": "A", "1": "B", "2": "C", "3": "D", "4": "E",
    "5": "F", "6": "G", "7": "H", "8": "I", "9": "J"
  });

  const activeProduct = SAMPLE_PRODUCTS[selectedSampleIndex] || SAMPLE_PRODUCTS[0];

  // Fetch governed cipher policy on mount
  useEffect(() => {
    const fetchCipherPolicy = async () => {
      try {
        const res = await apiFetchV1("/api/v1/governed-logic/policies/POLICY_BARCODE_COST_MASK");
        if (res?.parameters?.encoding_map) {
          setCipherMap(res.parameters.encoding_map);
        }
      } catch (err) {
        // Fallback to default 0->A
      }
    };
    fetchCipherPolicy();
  }, []);

  const selectedElement = elements.find(el => el.id === selectedElementId) || elements[0];

  const handleSelectPreset = (preset: LabelSizePreset) => {
    setSelectedPreset(preset);
    setLabelWidthMm(preset.widthMm);
    setLabelHeightMm(preset.heightMm);
  };

  const handleUpdateSelectedElement = (updates: Partial<VisualLabelElement>) => {
    setElements(prev =>
      prev.map(el => (el.id === selectedElementId ? { ...el, ...updates } : el))
    );
  };

  const handleToggleVisibility = (id: string) => {
    setElements(prev =>
      prev.map(el => (el.id === id ? { ...el, isVisible: !el.isVisible } : el))
    );
  };

  // Convert cost price to cipher code
  const getEncodedCost = (costNum?: number) => {
    const num = Math.floor(costNum || 0).toString();
    return num.split("").map(d => cipherMap[d] || d).join("");
  };

  // Get dynamic element text
  const getElementValue = (el: VisualLabelElement): string => {
    let val = "";
    switch (el.field) {
      case "brand":
        val = activeProduct.brand || "SMRITI";
        break;
      case "product_name":
        val = activeProduct.name || "Item Description";
        break;
      case "style_code":
        val = activeProduct.styleCode || activeProduct.code || "";
        break;
      case "barcode":
        val = activeProduct.barcode || activeProduct.code || "8901234567890";
        break;
      case "mrp":
        val = (activeProduct.mrp ?? 0).toFixed(2);
        break;
      case "selling_price":
        val = (activeProduct.price ?? activeProduct.mrp ?? 0).toFixed(2);
        break;
      case "cost_mask":
        val = getEncodedCost(activeProduct.costPrice);
        break;
      case "size_color":
        val = `${activeProduct.size || "Free"} / ${activeProduct.color || "Standard"}`;
        break;
      case "hsn_code":
        val = activeProduct.hsnCode || "";
        break;
      case "custom_text":
        val = el.staticText || "SMRITI RETAIL OS";
        break;
      default:
        val = "";
    }
    return `${el.prefix || ""}${val}${el.suffix || ""}`;
  };

  // Generate ZPL Script
  const generateZpl = (): string => {
    const dpi = 203; // 8 dots/mm
    const lines: string[] = [
      "^XA",
      `^PW${Math.round(labelWidthMm * 8)}`,
      `^LL${Math.round(labelHeightMm * 8)}`,
      "^LH0,0"
    ];

    elements.filter(el => el.isVisible).forEach(el => {
      const dotX = Math.round(el.xMm * 8);
      const dotY = Math.round(el.yMm * 8);

      if (el.type === "barcode") {
        const bcHeight = Math.round((el.heightMm || 10) * 8);
        lines.push(`^FO${dotX},${dotY}^BY2,2,${bcHeight}^BCN,${bcHeight},Y,N,N^FD${activeProduct.barcode || activeProduct.code}^FS`);
      } else {
        const fontH = Math.round(el.fontSizePt * 2.8);
        const fontW = Math.round(fontH * 0.85);
        lines.push(`^FO${dotX},${dotY}^A0N,${fontH},${fontW}^FD${getElementValue(el)}^FS`);
      }
    });

    lines.push("^XZ");
    return lines.join("\n");
  };

  // Save layout template to backend
  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      await apiFetchV1("/api/v1/barcode/layouts", {
        method: "POST",
        body: JSON.stringify({
          name: layoutName,
          widthMm: labelWidthMm,
          heightMm: labelHeightMm,
          columns: selectedPreset.columns,
          isDefault: true,
          elements: elements,
          prnTemplate: generateZpl()
        })
      });
      onNotification?.("Layout Saved", `Successfully saved template "${layoutName}".`, "success");
    } catch (err: any) {
      onNotification?.("Save Error", err.message || "Failed to save layout.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Direct print test
  const handlePrintTest = async () => {
    if (isQzTrayEnabled()) {
      try {
        const zpl = generateZpl();
        const res = await dispatchToQzTray({
          job_id: `test-label-${Date.now()}`,
          payload: zpl,
          language: "zpl",
          encoding: "UTF-8"
        });
        if (res.success) {
          onNotification?.("QZ Tray Print", "Dispatched test label to thermal printer.", "success");
        } else {
          window.print();
        }
      } catch (err) {
        window.print();
      }
    } else {
      window.print();
    }
  };

  return (
    <div className="h-full flex flex-col bg-theme-base text-theme-body select-none overflow-hidden font-sans">
      {/* Top Application Bar */}
      <header className="h-14 border-b border-theme-divider bg-theme-surface-1 flex justify-between items-center px-4 shrink-0 shadow-xs z-20">
        <div className="flex items-center gap-3">
          {onBackToPrinting && (
            <button
              type="button"
              onClick={onBackToPrinting}
              className="p-1.5 hover:bg-theme-surface-2 rounded-lg text-theme-muted hover:text-theme-body flex items-center gap-1.5 text-xs font-semibold transition"
            >
              <ArrowLeft size={16} />
              <span>Back to Batch Terminal</span>
            </button>
          )}
          <div className="h-4 w-px bg-theme-divider"></div>
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-primary-500" />
            <h2 className="font-display font-bold text-sm text-theme-body">WYSIWYG Thermal Label Designer</h2>
            <span className="text-[10px] font-mono font-bold bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded border border-primary-500/20">
              {labelWidthMm}mm × {labelHeightMm}mm
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowZplCode(!showZplCode)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
              showZplCode
                ? "bg-primary-500 text-white border-primary-500 shadow-sm"
                : "bg-theme-surface-2 text-theme-body hover:bg-theme-surface-3 border-theme-divider"
            }`}
          >
            <Code size={14} />
            <span>{showZplCode ? "Hide ZPL Code" : "View ZPL Code"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintTest}
            className="px-3.5 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-3 text-theme-body border border-theme-divider rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Printer size={14} className="text-primary-500" />
            <span>Test Print</span>
          </button>

          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={saving}
            className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
          >
            <Save size={14} />
            <span>{saving ? "Saving..." : "Save Layout"}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Preset Sizes & Element Layer List */}
        <aside className="w-80 bg-theme-surface-1 border-r border-theme-divider flex flex-col p-4 gap-4 overflow-y-auto shrink-0">
          {/* Label Presets */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono font-bold text-theme-muted uppercase tracking-wider block">
              Label Size Preset
            </label>
            <div className="space-y-1.5">
              {STANDARD_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                    selectedPreset.id === preset.id
                      ? "bg-primary-500/10 border-primary-500 text-primary-400 font-bold"
                      : "bg-theme-surface-2 border-theme-divider text-theme-body hover:bg-theme-surface-3"
                  }`}
                >
                  <div className="text-xs font-semibold">{preset.name}</div>
                  <div className="text-[10px] text-theme-muted">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sample Product Switcher */}
          <div className="space-y-1.5 pt-2 border-t border-theme-divider">
            <label className="text-[11px] font-mono font-bold text-theme-muted uppercase tracking-wider block">
              Live Preview Product
            </label>
            <select
              value={selectedSampleIndex}
              onChange={e => setSelectedSampleIndex(parseInt(e.target.value) || 0)}
              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg text-xs py-2 px-2.5 text-theme-body focus:outline-none focus:border-primary-500"
            >
              {SAMPLE_PRODUCTS.map((p, idx) => (
                <option key={p.id} value={idx}>
                  {p.brand} - {p.name} (₹{p.mrp})
                </option>
              ))}
            </select>
          </div>

          {/* Elements & Layers List */}
          <div className="space-y-2 pt-2 border-t border-theme-divider flex-1">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-mono font-bold text-theme-muted uppercase tracking-wider">
                Visual Elements ({elements.filter(e => e.isVisible).length})
              </label>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {elements.map(el => (
                <div
                  key={el.id}
                  onClick={() => setSelectedElementId(el.id)}
                  className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                    selectedElementId === el.id
                      ? "bg-primary-500/15 border-primary-500 text-primary-300 font-semibold"
                      : "bg-theme-surface-2 border-theme-divider text-theme-body hover:bg-theme-surface-3"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    {el.type === "barcode" ? (
                      <Barcode size={14} className="text-primary-500 shrink-0" />
                    ) : (
                      <Type size={14} className="text-theme-muted shrink-0" />
                    )}
                    <span className="truncate max-w-[140px]">{el.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleToggleVisibility(el.id);
                    }}
                    className={`p-1 rounded text-xs ${
                      el.isVisible ? "text-primary-400" : "text-theme-muted opacity-40"
                    }`}
                  >
                    <Eye size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Column: Live Visual Canvas Preview */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 bg-theme-surface-2/40 overflow-auto relative">
          {/* Label Canvas Dimensions Badge */}
          <div className="mb-4 flex items-center gap-2 text-xs text-theme-muted font-mono">
            <span>Canvas: {labelWidthMm}mm × {labelHeightMm}mm (300 DPI Thermal Scale)</span>
          </div>

          {/* Interactive Thermal Sticker Canvas */}
          <div
            style={{
              width: `${labelWidthMm * 8.5}px`,
              height: `${labelHeightMm * 8.5}px`,
              maxWidth: "600px",
            }}
            className="bg-white text-black rounded-sm border-2 border-primary-500 shadow-2xl relative overflow-hidden transition-all select-none p-2"
          >
            {elements
              .filter(el => el.isVisible)
              .map(el => {
                const isSelected = el.id === selectedElementId;
                const leftPx = el.xMm * 8.5;
                const topPx = el.yMm * 8.5;

                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElementId(el.id)}
                    style={{
                      left: `${leftPx}px`,
                      top: `${topPx}px`,
                      fontSize: `${el.fontSizePt * 1.3}px`,
                      fontWeight: el.fontWeight === "extrabold" ? 900 : el.fontWeight === "bold" ? 700 : 400,
                      textAlign: el.textAlign,
                    }}
                    className={`absolute cursor-pointer leading-tight transition-all ${
                      isSelected
                        ? "outline-2 outline-dashed outline-primary-500 bg-primary-500/10 z-10"
                        : "hover:outline-1 hover:outline-dashed hover:outline-gray-400"
                    }`}
                  >
                    {el.type === "barcode" ? (
                      <div className="flex flex-col items-center">
                        <ThermalBarcodeSvg
                          value={activeProduct.barcode || activeProduct.code}
                          widthMm={el.widthMm || 44}
                          heightMm={el.heightMm || 9}
                          showText={true}
                        />
                      </div>
                    ) : (
                      <span>{getElementValue(el)}</span>
                    )}
                  </div>
                );
              })}
          </div>

          {/* ZPL Raw Script Modal / Drawer */}
          {showZplCode && (
            <div className="absolute inset-x-4 bottom-4 h-64 bg-slate-900 text-slate-200 rounded-xl p-4 border border-slate-700 shadow-2xl font-mono text-xs overflow-auto flex flex-col">
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
                <span className="font-bold text-emerald-400">Generated ZPL Industrial Script</span>
                <span className="text-slate-400 text-[11px]">{labelWidthMm}mm × {labelHeightMm}mm (203 DPI)</span>
              </div>
              <pre className="flex-1 overflow-auto text-emerald-300 select-text leading-relaxed">
                {generateZpl()}
              </pre>
            </div>
          )}
        </main>

        {/* Right Column: Element Property Inspector */}
        <aside className="w-80 bg-theme-surface-1 border-l border-theme-divider flex flex-col p-4 gap-4 overflow-y-auto shrink-0">
          <div className="flex items-center gap-2 border-b border-theme-divider pb-2">
            <Sliders size={16} className="text-primary-500" />
            <h3 className="font-display font-bold text-xs text-theme-body uppercase tracking-wider">
              Element Inspector
            </h3>
          </div>

          {selectedElement && (
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                  Element Name
                </label>
                <div className="p-2 bg-theme-surface-2 rounded-lg font-semibold text-theme-body border border-theme-divider">
                  {selectedElement.label} ({selectedElement.field})
                </div>
              </div>

              {/* Position Coordinates (mm) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                    X Position (mm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={labelWidthMm}
                    step="0.5"
                    value={selectedElement.xMm}
                    onChange={e => handleUpdateSelectedElement({ xMm: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg py-1.5 px-2.5 font-mono text-theme-body text-center focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                    Y Position (mm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={labelHeightMm}
                    step="0.5"
                    value={selectedElement.yMm}
                    onChange={e => handleUpdateSelectedElement({ yMm: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg py-1.5 px-2.5 font-mono text-theme-body text-center focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Typography */}
              {selectedElement.type !== "barcode" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                        Font Size (pt)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="24"
                        value={selectedElement.fontSizePt}
                        onChange={e => handleUpdateSelectedElement({ fontSizePt: parseFloat(e.target.value) || 8 })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg py-1.5 px-2.5 font-mono text-theme-body text-center focus:outline-none focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                        Font Weight
                      </label>
                      <select
                        value={selectedElement.fontWeight}
                        onChange={e => handleUpdateSelectedElement({ fontWeight: e.target.value as any })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg py-1.5 px-2 text-theme-body focus:outline-none focus:border-primary-500"
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                        <option value="extrabold">Extra Bold</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                      Prefix & Suffix
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Prefix (e.g. MRP: ₹)"
                        value={selectedElement.prefix || ""}
                        onChange={e => handleUpdateSelectedElement({ prefix: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg py-1.5 px-2 text-theme-body focus:outline-none focus:border-primary-500 text-[11px]"
                      />
                      <input
                        type="text"
                        placeholder="Suffix"
                        value={selectedElement.suffix || ""}
                        onChange={e => handleUpdateSelectedElement({ suffix: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg py-1.5 px-2 text-theme-body focus:outline-none focus:border-primary-500 text-[11px]"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Barcode Dimensions */}
              {selectedElement.type === "barcode" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                      Width (mm)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max={labelWidthMm}
                      value={selectedElement.widthMm || 44}
                      onChange={e => handleUpdateSelectedElement({ widthMm: parseFloat(e.target.value) || 44 })}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg py-1.5 px-2.5 font-mono text-theme-body text-center focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                      Height (mm)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max={labelHeightMm}
                      value={selectedElement.heightMm || 9}
                      onChange={e => handleUpdateSelectedElement({ heightMm: parseFloat(e.target.value) || 9 })}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg py-1.5 px-2.5 font-mono text-theme-body text-center focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default VisualLabelDesigner;
