/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP v1.0)
 * Component    : PRNTemplateStudio (Dedicated PRN/ZPL Template Mapping & Authoring Studio)
 * Description  : Enterprise Studio for creating, editing, mapping, and validating .prn files
 *                with 100% Item Master dynamic element bindings.
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 4.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useRef, useMemo } from "react";
import {
  FileCode,
  Plus,
  Save,
  Copy,
  Trash2,
  Download,
  Upload,
  Play,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Sliders,
  Tag,
  Sparkles,
  Layers,
  Search,
  Code2,
  Eye,
  RefreshCw,
  X,
  FileText,
  Building2,
  DollarSign,
  Box,
  Scale,
  Calendar,
} from "lucide-react";
import { PrintTemplateRegistry, PrintTemplateDefinition } from "../../core/printing/templates/PrintTemplateRegistry.js";
import { PrintTemplateValidator } from "../../core/printing/templates/PrintTemplateValidator.js";
import { PrintingService } from "../../core/printing/index.js";

// Comprehensive Item Master Element Definition Dictionary
export interface ItemMasterElement {
  key: string;
  label: string;
  category: "IDENTIFICATION" | "PRICING" | "APPAREL" | "PHARMA" | "JEWELLERY" | "SYSTEM";
  sampleValue: string;
  description: string;
}

export const ITEM_MASTER_ELEMENTS: ItemMasterElement[] = [
  // 1. IDENTIFICATION & BARCODE
  { key: "barcode", label: "Barcode (EAN/Code128)", category: "IDENTIFICATION", sampleValue: "8901234567890", description: "Primary barcode string" },
  { key: "itemCode", label: "Item Code / SKU", category: "IDENTIFICATION", sampleValue: "SHO-1001", description: "Unique article code" },
  { key: "itemName", label: "Item Name", category: "IDENTIFICATION", sampleValue: "Sports Shoes (Black)", description: "Full product title" },
  { key: "hsn", label: "HSN / SAC Code", category: "IDENTIFICATION", sampleValue: "64041190", description: "Harmonized tax code" },
  { key: "category", label: "Category", category: "IDENTIFICATION", sampleValue: "Footwear", description: "Product hierarchy group" },
  { key: "brand", label: "Brand Name", category: "IDENTIFICATION", sampleValue: "Tattly Threads", description: "Brand / Manufacturer" },
  { key: "department", label: "Department", category: "IDENTIFICATION", sampleValue: "Mens Fashion", description: "Store department" },

  // 2. PRICING & TAXATION
  { key: "mrp", label: "MRP (Max Retail Price)", category: "PRICING", sampleValue: "2,699.00", description: "Incl. of all taxes" },
  { key: "price", label: "Selling Price / Offer Rate", category: "PRICING", sampleValue: "1,999.00", description: "Effective store price" },
  { key: "costPrice", label: "Cost Price (Buying)", category: "PRICING", sampleValue: "1,250.00", description: "Vendor purchase rate" },
  { key: "gstRate", label: "GST Rate (%)", category: "PRICING", sampleValue: "18%", description: "Resolved GST tax rate" },
  { key: "taxType", label: "Tax Classification", category: "PRICING", sampleValue: "IGST", description: "IGST / CGST+SGST" },
  { key: "discountPercent", label: "Discount %", category: "PRICING", sampleValue: "10%", description: "Percentage markdown" },

  // 3. APPAREL & FOOTWEAR METADATA
  { key: "size", label: "Size (UK/US/EUR)", category: "APPAREL", sampleValue: "8", description: "Size code" },
  { key: "color", label: "Color Variant", category: "APPAREL", sampleValue: "Midnight Black", description: "Garment / Shoe shade" },
  { key: "style", label: "Style / Article No", category: "APPAREL", sampleValue: "ART-9921", description: "Designer style code" },
  { key: "gender", label: "Gender Target", category: "APPAREL", sampleValue: "Men", description: "Men / Women / Unisex / Kids" },
  { key: "season", label: "Season Pack", category: "APPAREL", sampleValue: "SS-2026", description: "Spring/Summer collection" },
  { key: "material", label: "Material Composition", category: "APPAREL", sampleValue: "100% Genuine Leather", description: "Fabric / Construction" },

  // 4. PHARMA / FMCG / GROCERY
  { key: "batchNo", label: "Batch Number", category: "PHARMA", sampleValue: "BAT-2026-09", description: "Manufacturing batch ID" },
  { key: "expDate", label: "Expiry Date", category: "PHARMA", sampleValue: "12/2028", description: "Product expiration date" },
  { key: "pkdDate", label: "Packaging Date", category: "PHARMA", sampleValue: "05/2026", description: "Date of packaging" },
  { key: "mfdDate", label: "Manufacturing Date", category: "PHARMA", sampleValue: "04/2026", description: "Date of production" },
  { key: "netWeight", label: "Net Weight / Vol", category: "PHARMA", sampleValue: "500 g", description: "Net package weight" },
  { key: "uom", label: "Unit of Measure", category: "PHARMA", sampleValue: "Pair", description: "Pcs / Pair / Kg / Ltr" },

  // 5. JEWELLERY & HARDWARE
  { key: "purity", label: "Gold / Metal Purity", category: "JEWELLERY", sampleValue: "22K (916)", description: "Hallmark purity grade" },
  { key: "goldWeight", label: "Gross / Net Weight", category: "JEWELLERY", sampleValue: "14.250 g", description: "Metal weight" },
  { key: "stoneWeight", label: "Stone Weight", category: "JEWELLERY", sampleValue: "0.450 g", description: "Gemstone weight" },
  { key: "voltage", label: "Voltage / Rating", category: "JEWELLERY", sampleValue: "220V - 50Hz", description: "Electrical specification" },
  { key: "serialNo", label: "Serial Number", category: "JEWELLERY", sampleValue: "SN-99821045", description: "Individual unit serial" },

  // 6. SYSTEM & STORE
  { key: "companyName", label: "Company / Store Name", category: "SYSTEM", sampleValue: "SMRITI Retail Store", description: "Registered merchant title" },
  { key: "storeBranch", label: "Store Branch", category: "SYSTEM", sampleValue: "Branch 01 - Mumbai", description: "Active outlet branch" },
  { key: "sysDate", label: "Print Date", category: "SYSTEM", sampleValue: "31/07/2026", description: "System generation date" },
  { key: "sysTime", label: "Print Time", category: "SYSTEM", sampleValue: "04:45 PM", description: "System generation timestamp" },
];

export interface PRNTemplateStudioProps {
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const PRNTemplateStudio: React.FC<PRNTemplateStudioProps> = ({ onNotification }) => {
  // Registered Templates List
  const [templateList, setTemplateList] = useState<PrintTemplateDefinition[]>(() =>
    PrintTemplateRegistry.getTemplates()
  );

  // Active Template State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templateList[0]?.id || "tattly_threads_dual_tag"
  );

  const activeTemplate = useMemo(() => {
    return templateList.find((t) => t.id === selectedTemplateId) || templateList[0];
  }, [selectedTemplateId, templateList]);

  // Template Form Fields
  const [templateName, setTemplateName] = useState<string>(activeTemplate?.name || "");
  const [driverId, setDriverId] = useState<"zpl" | "tspl" | "epl" | "esc_pos" | "raw">(activeTemplate?.driverId || "zpl");
  const [category, setCategory] = useState<"BARCODE_TAG" | "JEWELLERY_TAG" | "PHARMA_LABEL" | "RECEIPT" | "INVOICE">(
    activeTemplate?.category || "BARCODE_TAG"
  );
  const [widthMm, setWidthMm] = useState<number>(activeTemplate?.widthMm || 100);
  const [heightMm, setHeightMm] = useState<number>(activeTemplate?.heightMm || 50);
  const [script, setScript] = useState<string>(activeTemplate?.script || "");

  // Update Form when Selection Changes
  React.useEffect(() => {
    if (activeTemplate) {
      setTemplateName(activeTemplate.name);
      setDriverId(activeTemplate.driverId);
      setCategory(activeTemplate.category);
      setWidthMm(activeTemplate.widthMm);
      setHeightMm(activeTemplate.heightMm);
      setScript(activeTemplate.script);
    }
  }, [selectedTemplateId]);

  // Search Filter for Elements Toolbar
  const [elementSearch, setElementSearch] = useState<string>("");
  const [activeElementCategory, setActiveElementCategory] = useState<string>("ALL");

  // Code Editor Textarea Ref
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Insert Variable Placeholder into PRN Code Editor at Cursor Position
  const handleInsertElement = (key: string) => {
    const placeholder = `{${key}}`;
    if (editorRef.current) {
      const textarea = editorRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const textBefore = script.substring(0, start);
      const textAfter = script.substring(end);

      const nextScript = textBefore + placeholder + textAfter;
      setScript(nextScript);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 50);
    } else {
      setScript((prev) => prev + placeholder);
    }
  };

  // Validation Result (pass full partial template so the validator can inspect all fields)
  const validation = useMemo(() => {
    return PrintTemplateValidator.validate({ id: selectedTemplateId, name: templateName, driverId, widthMm, heightMm, script });
  }, [selectedTemplateId, templateName, driverId, widthMm, heightMm, script]);

  // Live Virtual Label Preview Interpolation
  const previewContent = useMemo(() => {
    let output = script;
    ITEM_MASTER_ELEMENTS.forEach((elem) => {
      const reg = new RegExp(`\\{${elem.key}\\}`, "g");
      output = output.replace(reg, elem.sampleValue);
    });
    return output;
  }, [script]);

  // Create New PRN Template
  const handleCreateNew = () => {
    const newId = `prn_custom_${Date.now()}`;
    const newDef: PrintTemplateDefinition = {
      id: newId,
      name: "New Custom Honeywell / Zebra PRN Tag",
      category: "BARCODE_TAG",
      driverId: "zpl",
      widthMm: 50,
      heightMm: 25,
      script: `^XA\n^FO20,20^A0N,28,28^FD{itemName}^FS\n^FO20,55^A0N,22,22^FDMRP: Rs {mrp}^FS\n^FO20,85^BY2^BCN,45,Y,N^FD{barcode}^FS\n^XZ`,
      industryPack: "Custom PRN Mapping",
    };

    PrintTemplateRegistry.registerTemplate(newDef);
    setTemplateList(PrintTemplateRegistry.getTemplates());
    setSelectedTemplateId(newId);
    if (onNotification) onNotification("PRN Created", "Started new .prn template draft", "success");
  };

  // Save / Save As PRN Template
  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      if (onNotification) onNotification("Validation Error", "Template name cannot be empty", "error");
      return;
    }

    const updatedDef: PrintTemplateDefinition = {
      id: selectedTemplateId,
      name: templateName,
      category,
      driverId,
      widthMm,
      heightMm,
      script,
      industryPack: "User Registered",
    };

    PrintTemplateRegistry.registerTemplate(updatedDef);
    setTemplateList(PrintTemplateRegistry.getTemplates());
    if (onNotification) onNotification("PRN Template Saved", `Saved "${templateName}" to SUPP Template Registry`, "success");
  };

  // Export .prn File Download
  const handleExportPRN = () => {
    const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${templateName.toLowerCase().replace(/[^a-z0-9]/g, "_")}.prn`;
    a.click();
    URL.revokeObjectURL(url);
    if (onNotification) onNotification("PRN Exported", `Downloaded ${a.download}`, "success");
  };

  // Import .prn File Reader
  const handleImportPRN = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setScript(text);
        setTemplateName(file.name.replace(/\.[^/.]+$/, ""));
        if (onNotification) onNotification("PRN Imported", `Loaded content from ${file.name}`, "success");
      }
    };
    reader.readAsText(file);
  };

  // Test Print via SUPP Facade
  const handleTestPrint = async () => {
    const res = await PrintingService.printDocument(
      {
        id: `TEST-PRN-${Date.now()}`,
        type: "BARCODE_TAG",
        title: `Test Print: ${templateName}`,
        content: previewContent,
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        driverId,
        providerId: "qz_tray",
      }
    );

    if (res.success) {
      if (onNotification) onNotification("Test Print Sent", `Dispatched ${templateName} to physical printer via SUPP`, "success");
    } else {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-4 space-y-4">
      {/* ================= HEADER TOOLBAR ================= */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              SUPP v1.0 / Print Template Studio
            </div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
              PRN / ZPL / TSPL Template Authoring & Item Master Mapping Studio
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center cursor-pointer">
            <Upload className="w-3.5 h-3.5 mr-1" />
            Import .prn
            <input type="file" accept=".prn,.txt,.zpl,.tspl" onChange={handleImportPRN} className="hidden" />
          </label>
          <button
            onClick={handleExportPRN}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Export .prn
          </button>
          <button
            onClick={handleCreateNew}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold flex items-center cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New PRN
          </button>
          <button
            onClick={handleSaveTemplate}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center cursor-pointer shadow-xs"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Save PRN Template
          </button>
        </div>
      </div>

      {/* ================= MAIN SPLIT CONTENT WORKSPACE ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ================= LEFT COLUMN (30% WIDTH): TEMPLATES & ITEM MASTER ELEMENTS ================= */}
        <div className="lg:col-span-4 space-y-4">
          {/* ----- 1. REGISTERED PRN TEMPLATES LIST ----- */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide">
                <Tag className="w-4 h-4" />
                <span>Registered PRN Templates ({templateList.length})</span>
              </div>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {templateList.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition flex items-center justify-between ${
                    selectedTemplateId === tpl.id
                      ? "bg-blue-50 border-blue-500 text-blue-900 shadow-2xs"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <div className="truncate">
                    <div className="font-bold truncate">{tpl.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Driver: <span className="uppercase font-bold text-blue-700">{tpl.driverId}</span> | {tpl.widthMm}x{tpl.heightMm} mm
                    </div>
                  </div>
                  {tpl.isDefault && (
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-300 text-[9px] font-bold rounded">
                      Default
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ----- 2. ITEM MASTER ELEMENTS INSERTION TOOLBAR ----- */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide">
                <Box className="w-4 h-4" />
                <span>Item Master Elements (Click to Insert)</span>
              </div>
            </div>

            {/* Element Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={elementSearch}
                onChange={(e) => setElementSearch(e.target.value)}
                placeholder="Search Item Master elements..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1 text-[10px] font-bold">
              {["ALL", "IDENTIFICATION", "PRICING", "APPAREL", "PHARMA", "JEWELLERY", "SYSTEM"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveElementCategory(cat)}
                  className={`px-2 py-0.5 rounded-md border cursor-pointer ${
                    activeElementCategory === cat
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Elements Grid */}
            <div className="grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto pr-1">
              {ITEM_MASTER_ELEMENTS.filter(
                (elem) =>
                  (activeElementCategory === "ALL" || elem.category === activeElementCategory) &&
                  (!elementSearch ||
                    elem.label.toLowerCase().includes(elementSearch.toLowerCase()) ||
                    elem.key.toLowerCase().includes(elementSearch.toLowerCase()))
              ).map((elem) => (
                <button
                  key={elem.key}
                  onClick={() => handleInsertElement(elem.key)}
                  className="w-full text-left p-2 bg-slate-50 hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 rounded-lg text-xs transition flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <div className="font-bold text-slate-800 group-hover:text-blue-900 flex items-center">
                      <span className="font-mono text-blue-600 mr-1.5">{`{${elem.key}}`}</span>
                      <span>{elem.label}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{elem.description}</div>
                  </div>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-mono font-bold rounded group-hover:bg-blue-600 group-hover:text-white">
                    + Insert
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN (70% WIDTH): EDITOR, CONFIG & LIVE PREVIEW ================= */}
        <div className="lg:col-span-8 space-y-4">
          {/* ----- TEMPLATE CONFIGURATION BAR ----- */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
              <div className="md:col-span-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">PRN Template Name *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Driver Language</label>
                <select
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 uppercase focus:outline-none"
                >
                  <option value="zpl">ZPL II (Zebra/Honeywell)</option>
                  <option value="tspl">TSPL (TSC/TVS)</option>
                  <option value="epl">EPL (Eltron)</option>
                  <option value="esc_pos">ESC/POS (Thermal Receipt)</option>
                  <option value="raw">RAW File</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="BARCODE_TAG">Barcode Tag / Label</option>
                  <option value="JEWELLERY_TAG">Jewellery Dumbbell Tag</option>
                  <option value="PHARMA_LABEL">Pharma Batch Label</option>
                  <option value="RECEIPT">POS Receipt</option>
                  <option value="INVOICE">Tax Invoice</option>
                </select>
              </div>

              <div className="md:col-span-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Width (mm)</label>
                <input
                  type="number"
                  value={widthMm}
                  onChange={(e) => setWidthMm(parseFloat(e.target.value) || 50)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-center font-bold text-slate-800"
                />
              </div>

              <div className="md:col-span-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Height (mm)</label>
                <input
                  type="number"
                  value={heightMm}
                  onChange={(e) => setHeightMm(parseFloat(e.target.value) || 25)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-center font-bold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* ----- LIVE PRN SCRIPT EDITOR ----- */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide">
                <Code2 className="w-4 h-4" />
                <span>Live .prn / ZPL / TSPL Code Editor</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                {validation.valid ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Valid PRN Syntax
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-bold flex items-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> {validation.issues[0]?.message}
                  </span>
                )}
              </div>
            </div>

            <textarea
              ref={editorRef}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Enter PRN / ZPL / TSPL printer commands here..."
              rows={12}
              className="w-full bg-slate-900 text-emerald-400 font-mono text-xs p-3.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner leading-relaxed"
            />
          </div>

          {/* ----- LIVE VIRTUAL LABEL PREVIEW ----- */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide">
                <Eye className="w-4 h-4" />
                <span>Live Virtual Label Preview & Item Master Interpolation</span>
              </div>
              <button
                onClick={handleTestPrint}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                Test Print (Ctrl+P)
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center min-h-[140px]">
              <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-md max-w-md w-full text-center space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b pb-1">
                  Virtual Rendered Tag ({widthMm} x {heightMm} mm)
                </div>
                <pre className="text-xs font-mono text-slate-800 text-left bg-slate-100 p-2.5 rounded border border-slate-200 overflow-x-auto whitespace-pre-wrap">
                  {previewContent}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
