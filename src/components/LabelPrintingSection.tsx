/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { 
  Printer, Upload, CheckCircle2, AlertTriangle, RefreshCw, 
  Trash2, Sliders, Settings, List, Clipboard, Eye
} from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1";

export interface BarcodeLayoutElement {
  type: "text" | "barcode";
  x: number;
  y: number;
  field?: string;
  staticText?: string;
  label?: string;
}

export interface BarcodeLayout {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  columns: number;
  isDefault: boolean;
  elements: BarcodeLayoutElement[];
}


interface LabelPrintingSectionProps {
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
}

interface PrintableItem {
  code: string;
  name: string;
  barcode: string;
  price: string;
  mrp: string;
  size: string;
  color: string;
  qty: number;
  [key: string]: any;
}

interface PrintHistoryLog {
  id: string;
  user: string;
  itemCode: string;
  itemName: string;
  barcode: string;
  quantity: number;
  status: string;
  errorMessage?: string;
  createdAt: string;
}

export const LabelPrintingSection: React.FC<LabelPrintingSectionProps> = ({ 
  onNotification,
  currentUser
}) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [layouts, setLayouts] = useState<BarcodeLayout[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [items, setItems] = useState<PrintableItem[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  
  // Printer config
  const [connectionType, setConnectionType] = useState<"TCP" | "USB">("TCP");
  const [printerIp, setPrinterIp] = useState("192.168.1.200");
  const [printerPort, setPrinterPort] = useState(9100);
  const [usbTarget, setUsbTarget] = useState("LPT1");
  const [savingSettings, setSavingSettings] = useState(false);

  // Custom PRN/ZPL script template creation state
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateWidth, setNewTemplateWidth] = useState(100);
  const [newTemplateHeight, setNewTemplateHeight] = useState(50);
  const [newTemplateScript, setNewTemplateScript] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // History logs
  const [history, setHistory] = useState<PrintHistoryLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadLayouts();
    loadPrinterSettings();
    loadHistory();
  }, []);

  const loadLayouts = async () => {
    try {
      const res = await apiFetchV1("/barcode/layouts");
      setLayouts(res);
      if (res.length > 0) {
        const def = res.find((l: any) => l.isDefault) || res[0];
        setSelectedLayoutId(def.id);
      }
    } catch (err) {
      console.error("Failed to load layouts:", err);
    }
  };

  const loadPrinterSettings = async () => {
    try {
      const res = await apiFetchV1("/barcode/printer-settings");
      setConnectionType(res.connection_type || "TCP");
      setPrinterIp(res.ip || "192.168.1.200");
      setPrinterPort(res.port || 9100);
      setUsbTarget(res.usb_target || "LPT1");
    } catch (err) {
      console.error("Failed to load printer settings:", err);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetchV1("/barcode/print-history");
      setHistory(res);
    } catch (err) {
      console.error("Failed to load print history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiFetchV1("/barcode/printer-settings", {
        method: "POST",
        body: JSON.stringify({
          connection_type: connectionType,
          ip: printerIp,
          port: printerPort,
          usb_target: usbTarget
        })
      });
      onNotification("Saved", "Printer settings updated successfully.", "success");
    } catch (err: any) {
      onNotification("Settings Error", err.message || "Failed to update settings.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.getElementById("template-script-textarea") as HTMLTextAreaElement;
    if (!textarea) {
      setNewTemplateScript(prev => prev + placeholder);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    setNewTemplateScript(before + placeholder + after);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 10);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      return;
    }
    if (!newTemplateName.trim() || !newTemplateScript.trim()) {
      onNotification("Validation Error", "Template name and PRN script content are required.", "error");
      return;
    }
    setCreatingTemplate(true);
    try {
      const res = await apiFetchV1("/barcode/layouts", {
        method: "POST",
        body: JSON.stringify({
          name: newTemplateName,
          widthMm: newTemplateWidth,
          heightMm: newTemplateHeight,
          columns: 1,
          isDefault: false,
          elements: [],
          prnTemplate: newTemplateScript
        })
      });
      onNotification("Success", `Custom script template "${newTemplateName}" created.`, "success");
      setNewTemplateName("");
      setNewTemplateScript("");
      // Refresh layouts
      const resLayouts = await apiFetchV1("/barcode/layouts");
      setLayouts(resLayouts);
      // Select the new layout
      if (res && res.id) {
        setSelectedLayoutId(res.id);
      }
    } catch (err: any) {
      onNotification("Error", err.message || "Failed to create custom template.", "error");
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleDeleteLayout = async (layoutId: string) => {
    if (isReadOnly) {
      onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      return;
    }
    if (!confirm("Are you sure you want to delete this custom template?")) return;
    try {
      await apiFetchV1(`/barcode/layouts/${layoutId}`, {
        method: "DELETE"
      });
      onNotification("Success", "Custom template deleted.", "success");
      // Refresh layouts
      const resLayouts = await apiFetchV1("/barcode/layouts");
      setLayouts(resLayouts);
      if (selectedLayoutId === layoutId) {
        setSelectedLayoutId(resLayouts[0]?.id || "");
      }
    } catch (err: any) {
      onNotification("Error", err.message || "Failed to delete template.", "error");
    }
  };

  // Case & whitespace tolerant column matching
  const parseCsv = () => {
    if (!csvText.trim()) {
      onNotification("Empty Clipboard", "Please paste CSV or Tab-separated values first.", "error");
      return;
    }

    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      onNotification("Invalid Format", "Requires header row and at least one data row.", "error");
      return;
    }

    // Detect delimiter: Comma or Tab
    const headerLine = lines[0];
    const delimiter = headerLine.includes("\t") ? "\t" : ",";
    const rawHeaders = headerLine.split(delimiter).map(h => h.trim());
    setParsedHeaders(rawHeaders);

    const headers = rawHeaders.map(h => h.toLowerCase().replace(/[\s_-]/g, ""));

    const codeIdx = headers.findIndex(h => h === "sku" || h === "code" || h === "itemcode" || h === "id" || h === "productstylecode");
    const nameIdx = headers.findIndex(h => h === "name" || h === "itemname" || h === "title" || h === "item" || h === "itemdescription");
    const barcodeIdx = headers.findIndex(h => h === "barcode" || h === "barcodeno");
    const priceIdx = headers.findIndex(h => h === "price" || h === "sellingprice" || h === "rate" || h === "costprice");
    const mrpIdx = headers.findIndex(h => h === "mrp" || h === "plannedmrp");
    const sizeIdx = headers.findIndex(h => h === "size" || h === "dimension");
    const colorIdx = headers.findIndex(h => h === "color" || h === "shade");
    const qtyIdx = headers.findIndex(h => h === "qty" || h === "quantity" || h === "copies" || h === "count");

    if (codeIdx === -1 || nameIdx === -1 || barcodeIdx === -1) {
      onNotification("Headers Match Failure", "Required headers not found (SKU/Code, Item Name, Barcode).", "error");
      return;
    }

    const parsed: PrintableItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter).map(p => p.trim());
      if (parts.length < headers.length) continue;

      const code = parts[codeIdx];
      const name = parts[nameIdx];
      const barcode = parts[barcodeIdx];
      const price = priceIdx !== -1 ? parts[priceIdx] : "0.00";
      const mrp = mrpIdx !== -1 ? parts[mrpIdx] : price;
      const size = sizeIdx !== -1 ? parts[sizeIdx] : "";
      const color = colorIdx !== -1 ? parts[colorIdx] : "";
      const qty = qtyIdx !== -1 ? parseInt(parts[qtyIdx]) || 1 : 1;

      if (code && name && barcode) {
        const itemObj: PrintableItem = { 
          code, 
          name, 
          barcode, 
          price, 
          mrp: mrpIdx !== -1 ? parts[mrpIdx] : price, 
          size, 
          color, 
          qty 
        };
        
        // Dynamic column mapping preservation
        rawHeaders.forEach((h, index) => {
          itemObj[h] = parts[index];
          itemObj[h.toLowerCase().replace(/[\s_-]/g, "")] = parts[index];
        });
        
        parsed.push(itemObj);
      }
    }

    if (parsed.length === 0) {
      onNotification("Import Failure", "No valid rows could be parsed.", "error");
      return;
    }

    setItems(parsed);
    setPreviewIdx(0);
    onNotification("Success", `Loaded ${parsed.length} items from CSV worksheet.`, "success");
  };

  const handleRemoveItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    if (previewIdx >= items.length - 1 && previewIdx > 0) {
      setPreviewIdx(previewIdx - 1);
    }
  };

  const handleQtyChange = (idx: number, val: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, qty: Math.max(0, val) } : item));
  };

  const handlePrint = async () => {
    const printItems = items.filter(item => item.qty > 0);
    if (printItems.length === 0) {
      onNotification("Nothing to Print", "Ensure at least one row has quantity > 0.", "error");
      return;
    }

    setPrinting(true);
    try {
      const res = await apiFetchV1("/barcode/print", {
        method: "POST",
        body: JSON.stringify({
          layoutId: selectedLayoutId,
          items: printItems
        })
      });
      onNotification("Printing Completed", res.message || "Printed batch successfully.", "success");
      loadHistory();
    } catch (err: any) {
      onNotification("Printer Connection Error", err.message || "Printer is offline or connection refused.", "error");
      loadHistory();
    } finally {
      setPrinting(false);
    }
  };

  const handleSaveAsPrn = async () => {
    const printItems = items.filter(item => item.qty > 0);
    if (printItems.length === 0) {
      onNotification("Nothing to Print", "Ensure at least one row has quantity > 0.", "error");
      return;
    }

    setPrinting(true);
    try {
      const res = await apiFetchV1("/barcode/print", {
        method: "POST",
        body: JSON.stringify({
          layoutId: selectedLayoutId,
          items: printItems,
          saveAsPrn: true
        })
      });

      if (res.prn_content) {
        // Trigger file download on client browser
        const blob = new Blob([res.prn_content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `SMRITI_labels_batch_${Date.now()}.prn`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        onNotification("PRN Saved", "PRN command file downloaded successfully.", "success");
      } else {
        onNotification("Error", "Failed to retrieve ZPL/PRN script contents.", "error");
      }
      loadHistory();
    } catch (err: any) {
      onNotification("Generation Error", err.message || "Failed to compile PRN script.", "error");
      loadHistory();
    } finally {
      setPrinting(false);
    }
  };

  const activeLayout = layouts.find(l => l.id === selectedLayoutId);
  const activeItem = items[previewIdx];

  // Visual label representation mapping elements
  const renderVisualPreview = () => {
    if (!activeLayout || !activeItem) {
      return (
        <div className="h-44 w-72 bg-theme-surface-2 border border-dashed border-theme-divider rounded-xl flex items-center justify-center text-xs text-theme-muted">
          No preview loaded. Paste CSV and click parser.
        </div>
      );
    }

    const w = activeLayout.widthMm ? activeLayout.widthMm * 6 : 300;
    const h = activeLayout.heightMm ? activeLayout.heightMm * 6 : 150;

    return (
      <div 
        className="bg-white border-2 border-slate-350 shadow-inner relative overflow-hidden rounded-md text-black"
        style={{ width: `${w}px`, height: `${h}px` }}
      >
        <span className="absolute top-1 right-2 text-[6px] font-mono text-slate-400">Preview (50x25mm)</span>
        
        {activeLayout.elements.map((el: BarcodeLayoutElement, i: number) => {
          const x = el.x * 6;
          const y = el.y * 6;
          
          let text = "";
          if (el.field === "name") text = activeItem.name;
          else if (el.field === "code") text = activeItem.code;
          else if (el.field === "price") text = `Rs.${parseFloat(activeItem.price).toFixed(2)}`;
          else if (el.field === "mrp") text = `MRP: Rs.${parseFloat(activeItem.mrp).toFixed(2)}`;
          else if (el.field === "size") text = activeItem.size ? `Size: ${activeItem.size}` : "";
          else if (el.field === "color") text = activeItem.color ? `Color: ${activeItem.color}` : "";
          else text = el.staticText || "";

          if (el.type === "barcode") {
            return (
              <div 
                key={i}
                className="absolute flex flex-col items-center select-none"
                style={{ top: `${y}px`, left: `${x}px` }}
              >
                {/* Barcode line mock rendering */}
                <div className="h-6 w-32 border-x border-b border-black flex justify-between px-1">
                  {Array.from({ length: 15 }).map((_, idx) => (
                    <div key={idx} className="h-full bg-black" style={{ width: idx % 3 === 0 ? "2px" : "1px" }}></div>
                  ))}
                </div>
                <span className="text-[6px] font-mono tracking-widest leading-none mt-0.5">{activeItem.barcode}</span>
              </div>
            );
          }

          return (
            <div 
              key={i} 
              className="absolute text-[8px] font-sans leading-none font-bold uppercase truncate"
              style={{ top: `${y}px`, left: `${x}px`, maxWidth: `${w - x - 5}px` }}
            >
              {text}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center space-x-2 text-amber-400 text-xs shadow-lg">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Layout design creations and deletions are restricted.</span>
        </div>
      )}
      
      {/* 3-Step printing flow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Step 1: Upload / CSV Worksheet */}
        <div className="bg-theme-surface-1 border border-theme-divider p-5 rounded-2xl space-y-4">
          <div className="flex items-center space-x-2 border-b border-theme-divider/50 pb-3">
            <span className="h-6 w-6 rounded-full bg-blue-600/20 text-blue-400 font-mono text-xs font-bold flex items-center justify-center">1</span>
            <h3 className="font-display font-bold text-xs text-theme-body uppercase">Load Spreadsheet Worksheet</h3>
          </div>
          
          <div className="space-y-3">
            <p className="text-[11px] text-theme-muted leading-relaxed">
              Paste catalog worksheets directly from Microsoft Excel (comma or tab delimited). Ensure columns for SKU/Code, Item Name, and Barcode are present.
            </p>
            <textarea
              rows={6}
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder="SKU Code,Item Name,Barcode,Price,MRP,Size,Color,Qty&#10;SNE-001,Vintage Trainer,89012015,1200,1500,8,Black,10&#10;SNE-002,Runner Sneaker,89012022,1400,1800,9,White,5"
              className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl p-3 text-xs text-white placeholder-theme-muted font-mono focus:outline-none focus:border-blue-500 resize-none"
            />
            <button
              onClick={parseCsv}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
            >
              <Clipboard size={13} />
              <span>Parse pasted worksheet</span>
            </button>
          </div>
        </div>

        {/* Step 2: Interactive HTML rendered labels preview */}
        <div className="bg-theme-surface-1 border border-theme-divider p-5 rounded-2xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 border-b border-theme-divider/50 pb-3">
              <span className="h-6 w-6 rounded-full bg-indigo-650/20 text-indigo-400 font-mono text-xs font-bold flex items-center justify-center">2</span>
              <h3 className="font-display font-bold text-xs text-theme-body uppercase">Live rendered label preview</h3>
            </div>
            
            <div className="flex justify-center items-center py-6">
              {renderVisualPreview()}
            </div>
          </div>

          {items.length > 0 && (
            <div className="flex items-center justify-between bg-theme-surface-2/60 border border-theme-divider px-3 py-2 rounded-xl text-xs">
              <span className="text-[10px] text-theme-muted font-mono">Row {previewIdx + 1} of {items.length}</span>
              <div className="flex items-center space-x-1">
                <button 
                  disabled={previewIdx === 0} 
                  onClick={() => setPreviewIdx(p => p - 1)} 
                  className="px-2 py-0.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider rounded text-[10px] text-white disabled:opacity-30 cursor-pointer"
                >
                  Prev
                </button>
                <button 
                  disabled={previewIdx === items.length - 1} 
                  onClick={() => setPreviewIdx(p => p + 1)} 
                  className="px-2 py-0.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider rounded text-[10px] text-white disabled:opacity-30 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Print Dispatch & Configs */}
        <div className="bg-theme-surface-1 border border-theme-divider p-5 rounded-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-theme-divider/50 pb-3">
              <span className="h-6 w-6 rounded-full bg-emerald-600/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center">3</span>
              <h3 className="font-display font-bold text-xs text-theme-body uppercase">Dispatched Print Run</h3>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-mono text-theme-muted uppercase block">Choose Label template</label>
              <select
                value={selectedLayoutId}
                onChange={e => setSelectedLayoutId(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body focus:outline-none"
              >
                {layouts.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.widthMm}x{l.heightMm}mm)</option>
                ))}
              </select>
            </div>

            {/* Configured printer display */}
            <div className="bg-theme-surface-2 p-3 border border-theme-divider rounded-xl space-y-1">
              <div className="flex items-center space-x-1.5">
                <Printer size={13} className="text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white">TCP Thermal Printer</span>
              </div>
              <span className="text-[10px] font-mono text-theme-muted block">{printerIp}:{printerPort} (Raw port stream)</span>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              disabled={printing || items.length === 0}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-lg cursor-pointer transition-all"
            >
              <Printer size={14} />
              <span>{printing ? "Printing..." : "Batch Print"}</span>
            </button>
            <button
              onClick={handleSaveAsPrn}
              disabled={printing || items.length === 0}
              className="px-4 py-3 bg-indigo-650 hover:bg-indigo-650 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-lg cursor-pointer transition-all border border-indigo-500/30"
              title="Download raw ZPL/PRN script commands file"
            >
              <Upload size={14} />
              <span>Save PRN File</span>
            </button>
          </div>
        </div>

      </div>

      {/* Editable Print List Grid & Printer Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Printable Items Grid List */}
        <div className="lg:col-span-2 bg-theme-surface-1 border border-theme-divider p-5 rounded-2xl space-y-4">
          <h4 className="font-display font-bold text-xs text-theme-body uppercase border-b border-theme-divider/50 pb-3 flex items-center justify-between">
            <span>Worksheet Items Queue</span>
            <span className="text-[10px] font-mono text-theme-muted">{items.length} Loaded</span>
          </h4>

          {items.length === 0 ? (
            <p className="text-xs text-theme-muted text-center py-10 font-mono">No items in queue. Load a CSV worksheet above to initialize.</p>
          ) : (
            <div className="overflow-x-auto max-h-72 border border-theme-divider/70 rounded-xl">
              <table className="w-full text-left text-xs table-fixed border-collapse">
                <thead>
                  <tr className="bg-theme-surface-2 border-b border-theme-divider text-theme-muted font-mono text-[9px] tracking-wider uppercase">
                    <th className="p-3 w-28">SKU Code</th>
                    <th className="p-3 w-40">Item Name</th>
                    <th className="p-3 w-28">Barcode</th>
                    <th className="p-3 w-16 text-center">Size</th>
                    <th className="p-3 w-20 text-center">Color</th>
                    <th className="p-3 w-20 text-right">Copies</th>
                    <th className="p-3 w-12 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-theme-divider/40 hover:bg-theme-surface-2/10">
                      <td className="p-2 font-mono truncate">{item.code}</td>
                      <td className="p-2 truncate font-bold">{item.name}</td>
                      <td className="p-2 font-mono text-indigo-300 truncate">{item.barcode}</td>
                      <td className="p-2 text-center font-mono">{item.size || "-"}</td>
                      <td className="p-2 text-center">{item.color || "-"}</td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          value={item.qty}
                          min="0"
                          onChange={e => handleQtyChange(idx, parseInt(e.target.value) || 0)}
                          className="w-16 text-right bg-theme-surface-2 border border-theme-divider rounded px-2 py-0.5 font-mono text-xs text-white focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => handleRemoveItem(idx)} className="p-0.5 hover:bg-rose-950/40 text-rose-400 rounded transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Connection Setup Configuration Panel */}
        <div className="lg:col-span-1 bg-theme-surface-1 border border-theme-divider p-5 rounded-2xl space-y-4">
          <h4 className="font-display font-bold text-xs text-theme-body uppercase border-b border-theme-divider/50 pb-3 flex items-center space-x-1.5">
            <Settings size={13} className="text-indigo-400" />
            <span>Printer Connection setup</span>
          </h4>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-mono text-theme-muted uppercase block">Connection Type</label>
              <select
                value={connectionType}
                onChange={e => setConnectionType(e.target.value as "TCP" | "USB")}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="TCP" className="bg-theme-surface-2 text-white">TCP Network Connection</option>
                <option value="USB" className="bg-theme-surface-2 text-white">Local USB / Port Connection</option>
              </select>
            </div>

            {connectionType === "TCP" ? (
              <>
                <div className="space-y-2">
                  <label className="text-[9px] font-mono text-theme-muted uppercase block">Printer IP Address</label>
                  <input
                    type="text"
                    required
                    value={printerIp}
                    onChange={e => setPrinterIp(e.target.value)}
                    placeholder="e.g. 192.168.1.200"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-theme-muted font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-mono text-theme-muted uppercase block">Raw TCP Port</label>
                  <input
                    type="number"
                    required
                    value={printerPort}
                    onChange={e => setPrinterPort(parseInt(e.target.value) || 9100)}
                    placeholder="e.g. 9100"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-theme-muted font-mono"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-[9px] font-mono text-theme-muted uppercase block">USB Printer / Port Path</label>
                <input
                  type="text"
                  required
                  value={usbTarget}
                  onChange={e => setUsbTarget(e.target.value)}
                  placeholder="e.g. Zebra_ZD220 or COM3 or LPT1"
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-theme-muted font-mono"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-body font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span>{savingSettings ? "Updating Settings..." : "Save Printer parameters"}</span>
            </button>
          </form>
        </div>

        {/* Custom PRN/ZPL Script Template Manager */}
        <div className="lg:col-span-1 bg-theme-surface-1 border border-theme-divider p-5 rounded-2xl space-y-4">
          <h4 className="font-display font-bold text-xs text-theme-body uppercase border-b border-theme-divider/50 pb-3 flex items-center space-x-1.5">
            <Sliders size={13} className="text-blue-400" />
            <span>Manage Custom PRN / ZPL Scripts</span>
          </h4>

          <form onSubmit={handleCreateTemplate} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-theme-muted uppercase block">Template Name</label>
              <input
                type="text"
                required
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder="e.g. Footwear Box ZPL"
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-theme-muted font-sans"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-theme-muted uppercase block">Width (mm)</label>
                <input
                  type="number"
                  required
                  value={newTemplateWidth}
                  onChange={e => setNewTemplateWidth(parseInt(e.target.value) || 100)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-theme-muted uppercase block">Height (mm)</label>
                <input
                  type="number"
                  required
                  value={newTemplateHeight}
                  onChange={e => setNewTemplateHeight(parseInt(e.target.value) || 50)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-mono text-theme-muted uppercase block">PRN / ZPL Script Code</label>
              <textarea
                id="template-script-textarea"
                rows={5}
                required
                value={newTemplateScript}
                onChange={e => setNewTemplateScript(e.target.value)}
                placeholder="Paste raw ZPL/PRN template here..."
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2.5 text-xs text-white placeholder-theme-muted font-mono focus:outline-none resize-none animate-none"
              />
            </div>

            {/* Clickable Variable Insertion Helper */}
            <div className="bg-theme-surface-2/40 border border-theme-divider/50 rounded-xl p-3 space-y-2">
              <span className="text-[9px] font-mono text-theme-muted uppercase block">Click variables to map into PRN script</span>
              
              <div className="space-y-2">
                <div>
                  <span className="text-[8px] font-mono text-theme-muted uppercase block mb-1">Standard Item Master fields:</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: "Code", val: "{code}" },
                      { label: "Name", val: "{name}" },
                      { label: "Barcode", val: "{barcode}" },
                      { label: "Price", val: "{price}" },
                      { label: "MRP", val: "{mrp}" },
                      { label: "Size", val: "{size}" },
                      { label: "Color", val: "{color}" },
                      { label: "Brand", val: "{brand}" },
                      { label: "HSN", val: "{hsn_code}" },
                      { label: "SKU", val: "{sku}" }
                    ].map(item => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => insertPlaceholder(item.val)}
                        className="px-2 py-0.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider rounded font-mono text-[9px] text-indigo-300 cursor-pointer"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {parsedHeaders.length > 0 && (
                  <div>
                    <span className="text-[8px] font-mono text-theme-muted uppercase block mb-1">Pasted Worksheet fields:</span>
                    <div className="flex flex-wrap gap-1">
                      {parsedHeaders.map(header => (
                        <button
                          key={header}
                          type="button"
                          onClick={() => insertPlaceholder(`{${header}}`)}
                          className="px-2 py-0.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider rounded font-mono text-[9px] text-emerald-400 cursor-pointer"
                        >
                          {header}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingTemplate}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Upload size={12} />
              <span>{creatingTemplate ? "Adding Template..." : "Add Template Script"}</span>
            </button>
          </form>

          {/* List of custom templates */}
          <div className="space-y-2 border-t border-theme-divider/50 pt-3">
            <label className="text-[9px] font-mono text-theme-muted uppercase block">Active Custom Templates</label>
            {layouts.filter(l => l.id !== "lay-default-1" && l.id !== "lay-premium-zpl").length === 0 ? (
              <p className="text-[10px] text-theme-muted italic">No custom uploaded script templates yet.</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {layouts.filter(l => l.id !== "lay-default-1" && l.id !== "lay-premium-zpl").map(l => (
                  <div key={l.id} className="flex items-center justify-between bg-theme-surface-2 p-2 border border-theme-divider/50 rounded-lg text-xs">
                    <span className="font-sans truncate text-white max-w-[140px]">{l.name}</span>
                    <button 
                      onClick={() => handleDeleteLayout(l.id)}
                      className="p-1 hover:bg-rose-950/40 text-rose-400 rounded transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Print History Logs */}
      <div className="bg-theme-surface-1 border border-theme-divider p-5 rounded-2xl space-y-4">
        <h4 className="font-display font-bold text-xs text-theme-body uppercase border-b border-theme-divider/50 pb-3 flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <List size={13} className="text-blue-400" />
            <span>Audit Print Logs</span>
          </span>
          <button 
            onClick={loadHistory} 
            disabled={loadingHistory}
            className="p-1 hover:bg-theme-surface-2 text-theme-muted hover:text-white rounded transition-colors"
          >
            <RefreshCw size={12} className={loadingHistory ? "animate-spin" : ""} />
          </button>
        </h4>

        {history.length === 0 ? (
          <p className="text-xs text-theme-muted text-center py-10 font-mono">No printing logs recorded yet in Postgres ledger.</p>
        ) : (
          <div className="overflow-x-auto max-h-56 border border-theme-divider/70 rounded-xl">
            <table className="w-full text-left text-xs table-fixed border-collapse">
              <thead>
                <tr className="bg-theme-surface-2 border-b border-theme-divider text-theme-muted font-mono text-[9px] tracking-wider uppercase">
                  <th className="p-3 w-36">Time</th>
                  <th className="p-3 w-28">Operator</th>
                  <th className="p-3 w-28">SKU Code</th>
                  <th className="p-3 w-40">Item Name</th>
                  <th className="p-3 w-28">Barcode</th>
                  <th className="p-3 w-16 text-right">Qty</th>
                  <th className="p-3 w-24 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log.id} className="border-b border-theme-divider/40 hover:bg-theme-surface-2/10">
                    <td className="p-2 font-mono text-theme-muted">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="p-2 truncate">{log.user}</td>
                    <td className="p-2 font-mono truncate">{log.itemCode}</td>
                    <td className="p-2 truncate font-bold">{log.itemName}</td>
                    <td className="p-2 font-mono text-indigo-300 truncate">{log.barcode}</td>
                    <td className="p-2 text-right font-mono font-bold">{log.quantity}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded border ${
                        log.status === "Success"
                          ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/50"
                          : "bg-rose-950/40 text-rose-400 border-rose-900/50 cursor-help"
                      }`} title={log.errorMessage}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
