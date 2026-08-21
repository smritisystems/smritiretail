/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.2.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useRef } from "react";
import { 
  Code, 
  Save, 
  Upload, 
  Sliders, 
  Play, 
  CheckCircle, 
  Maximize2, 
  Minimize2, 
  ArrowLeft, 
  Sparkles,
  FileCode,
  Layers,
  HelpCircle
} from "lucide-react";
import { ScriptFieldIdentification } from "./types.ts";

interface BarcodeScriptGenerationViewProps {
  onBackToPrinting: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

const DEFAULT_SAMPLE_SCRIPT = `@@@01;02;02;03;04@@@^XA
^PRB
^LH0,0^FS
^LL200
^MD8
^MNY
^LH0,0^FS
^CWI,T0NPJYZV.FNT^FS
^FO107,81^AJN,27,0^CI0^FR^FD@@@02;02;02;01;16@@@^FS
^CWJ,P0NPJYZV.FNT^FS
^FO102,111^AJN,24,0^CI0^FR^FD@@@04;02;02;01;16@@@^FS
^CWJ,P0NPJYZV.FNT^FS
^FO102,136^AJN,24,0^CI0^FR^FD@@@06;02;02;01;16@@@^FS
^CWJ,P0NPJYZV.FNT^FS
^FO102,160^AJN,24,0^CI0^FR^FD@@@08;02;02;01;16@@@^FS
^CWJ,P0NPJYZV.FNT^FS
^FO142,187^AJN,24,0^CI0^FR^FD@@@01;01;02;10;02@@@^FS
^CWJ,P0NPJYZV.FNT^FS
^FO101,187^AJN,24,0^CI0^FR^FD@@@01;02;02;01;16@@@^FS
^FO11,21^FR^XGXTXJFPOS,1,1^FS
^CWK,T0NPJYZV.FNT^FS
^XZ`;

export const BarcodeScriptGenerationView: React.FC<BarcodeScriptGenerationViewProps> = ({
  onBackToPrinting,
  onNotification
}) => {
  const [scriptContent, setScriptContent] = useState<string>(DEFAULT_SAMPLE_SCRIPT);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [identConfig, setIdentConfig] = useState<ScriptFieldIdentification>({
    field: "Stock Number",
    direction: "From Left",
    startPosition: 3,
    numDigits: 4,
    textValue1: "",
    textValue2: ""
  });
  const [compilerStatus, setCompilerStatus] = useState<string>("Compiler Ready");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lines = scriptContent.split("\n");

  const handleApplyToken = () => {
    const fieldCode = identConfig.field === "Stock Number" ? "01" :
      identConfig.field === "Retail Price" ? "02" :
      identConfig.field === "Lot Code" ? "03" :
      identConfig.field === "Barcode" ? "04" :
      identConfig.field === "Product Name" ? "05" :
      identConfig.field === "Brand" ? "06" :
      identConfig.field === "Style" ? "07" :
      identConfig.field === "Size" ? "08" : "09";

    const dirCode = identConfig.direction === "From Left" ? "01" : "02";
    const startStr = String(identConfig.startPosition).padStart(2, "0");
    const numStr = String(identConfig.numDigits).padStart(2, "0");

    const token = `@@@${fieldCode};${dirCode};02;${startStr};${numStr}@@@`;
    const lineToInsert = `^FO100,100^AJN,24,0^CI0^FR^FD${token}^FS`;

    setScriptContent(prev => prev.trim() + "\n" + lineToInsert + "\n");
    setCompilerStatus("Token Injected: " + token);
    onNotification?.("Token Applied", `Generated macro placeholder ${token}`, "success");
  };

  const handleClearValues = () => {
    setIdentConfig({
      ...identConfig,
      textValue1: "",
      textValue2: "",
      startPosition: 1,
      numDigits: 6
    });
  };

  const handleSaveScript = () => {
    const blob = new Blob([scriptContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "BarcodeScript_SMRITI.t";
    a.click();
    URL.revokeObjectURL(a);
    onNotification?.("Script Saved", "Exported script to BarcodeScript_SMRITI.t", "success");
  };

  const handleLoadScriptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setScriptContent(content);
        setCompilerStatus("Loaded file: " + file.name);
        onNotification?.("Script Loaded", `Successfully loaded ${file.name}`, "success");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`h-full flex flex-col bg-[#fbf8fb] text-[#1b1b1e] font-sans select-none overflow-hidden ${
      isFullscreen ? "fixed inset-0 z-50 p-4 bg-slate-900" : ""
    }`}>
      
      {/* Top Studio Header */}
      <header className="h-12 border-b border-[#c5c6ce] bg-[#efedf0] flex justify-between items-center px-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToPrinting}
            className="p-1.5 hover:bg-[#eae7ea] rounded text-[#041632] flex items-center gap-1 text-xs font-bold transition"
            title="Back to Tag Printing Terminal"
          >
            <ArrowLeft size={16} />
            <span>Tag Printing Terminal</span>
          </button>
          <div className="h-4 w-px bg-[#c5c6ce]"></div>
          <div className="flex items-center gap-2">
            <FileCode size={18} className="text-[#3e5f90]" />
            <h1 className="font-semibold text-sm text-[#041632]">Barcode Script Generation &amp; Compiler</h1>
            <span className="text-[10px] bg-[#d7e2ff] text-[#041632] px-2 py-0.5 rounded font-mono font-bold">
              ZPL / TSPL / EPL
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-[#eae7ea] border border-[#c5c6ce] rounded text-[#44474d] transition"
            title="Toggle Fullscreen Editor"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </header>

      {/* Main Studio Body: Editor (Left) + Config (Right) */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        
        {/* Left: Code Editor Container */}
        <div className="flex-1 bg-[#1e1e1e] text-[#d4d4d4] rounded-lg border border-[#303033] shadow-lg flex flex-col overflow-hidden">
          
          {/* Editor Sub-header */}
          <div className="h-8 bg-[#252526] px-3 border-b border-[#303033] flex justify-between items-center text-xs text-[#8d939b] shrink-0 font-mono">
            <div className="flex items-center gap-2">
              <span className="text-[#d7e2ff] font-bold">BarcodeScript_Acme.t</span>
              <span>•</span>
              <span>{lines.length} lines</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-emerald-400">● Syntax Highlighting Active</span>
            </div>
          </div>

          {/* Code Textarea with Line Numbers */}
          <div className="flex-1 flex overflow-hidden font-mono text-xs">
            {/* Line Numbers Column */}
            <div className="w-12 bg-[#1e1e1e] border-r border-[#333338] text-[#858585] text-right pr-2 py-3 select-none leading-relaxed">
              {lines.map((_, idx) => (
                <div key={idx} className="h-5 leading-5">{idx + 1}</div>
              ))}
            </div>

            {/* Editable Text Area */}
            <div className="flex-1 p-3 overflow-auto">
              <textarea
                value={scriptContent}
                onChange={e => setScriptContent(e.target.value)}
                spellCheck={false}
                className="w-full h-full bg-transparent text-[#9cdcfe] font-mono text-xs leading-5 outline-none resize-none border-none custom-scrollbar whitespace-pre"
              />
            </div>
          </div>

          {/* Editor Action Bar */}
          <div className="p-2.5 bg-[#252526] border-t border-[#303033] flex justify-between items-center shrink-0">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-[#333338] hover:bg-[#3e3e42] text-white rounded text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Upload size={14} />
                Load Script
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".t,.prn,.zpl,.tspl,.txt"
                className="hidden"
                onChange={handleLoadScriptFile}
              />
              <button
                type="button"
                onClick={handleSaveScript}
                className="px-4 py-1.5 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded text-xs font-bold flex items-center gap-1.5 shadow transition"
              >
                <Save size={14} />
                Save Changes
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBackToPrinting}
                className="px-3 py-1.5 text-[#ffb4ab] hover:bg-[#93000a]/20 border border-[#ba1a1a]/40 rounded text-xs font-semibold transition"
              >
                Exit
              </button>
            </div>
          </div>
        </div>

        {/* Right Configuration Panel */}
        <div className="w-80 flex flex-col gap-4 overflow-y-auto shrink-0 text-xs">
          
          {/* Card 1: Identification Settings */}
          <div className="bg-white border border-[#c5c6ce] rounded-lg p-4 shadow-xs space-y-3">
            <h2 className="font-bold text-xs text-[#041632] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#c5c6ce] pb-2">
              <Sliders size={14} className="text-[#3e5f90]" />
              Identification Settings
            </h2>

            <div>
              <label className="block text-[#44474d] font-semibold text-[11px] mb-1">Field Selection</label>
              <select
                value={identConfig.field}
                onChange={e => setIdentConfig({ ...identConfig, field: e.target.value as any })}
                className="w-full bg-[#fbf8fb] border border-[#c5c6ce] rounded p-1.5 text-xs text-[#1b1b1e] outline-none focus:border-[#3e5f90]"
              >
                <option value="Stock Number">Stock Number</option>
                <option value="Retail Price">Retail Price (MRP)</option>
                <option value="Lot Code">Lot Code / Batch</option>
                <option value="Barcode">Barcode (EAN-13)</option>
                <option value="Product Name">Product Name</option>
                <option value="Brand">Brand</option>
                <option value="Style">Style</option>
                <option value="Size">Size</option>
                <option value="Shade">Shade / Colour</option>
                <option value="Custom Text">Custom Text</option>
              </select>
            </div>

            <div className="border border-[#c5c6ce] rounded p-2.5 bg-[#fbf8fb] space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#44474d]">
                String to be taken
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dir"
                    checked={identConfig.direction === "From Left"}
                    onChange={() => setIdentConfig({ ...identConfig, direction: "From Left" })}
                    className="text-[#3e5f90]"
                  />
                  <span>From Left</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dir"
                    checked={identConfig.direction === "From Right"}
                    onChange={() => setIdentConfig({ ...identConfig, direction: "From Right" })}
                    className="text-[#3e5f90]"
                  />
                  <span>From Right</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#44474d] font-semibold text-[11px] mb-1">Starting Position</label>
                <input
                  type="number"
                  min="1"
                  value={identConfig.startPosition}
                  onChange={e => setIdentConfig({ ...identConfig, startPosition: parseInt(e.target.value) || 1 })}
                  className="w-full bg-[#fbf8fb] border border-[#c5c6ce] rounded p-1 text-xs text-right font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[#44474d] font-semibold text-[11px] mb-1">No. of Digits</label>
                <input
                  type="number"
                  min="1"
                  value={identConfig.numDigits}
                  onChange={e => setIdentConfig({ ...identConfig, numDigits: parseInt(e.target.value) || 1 })}
                  className="w-full bg-[#fbf8fb] border border-[#c5c6ce] rounded p-1 text-xs text-right font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Values & Macro Insertion */}
          <div className="bg-white border border-[#c5c6ce] rounded-lg p-4 shadow-xs space-y-3">
            <h2 className="font-bold text-xs text-[#041632] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#c5c6ce] pb-2">
              <Sparkles size={14} className="text-[#3e5f90]" />
              Values &amp; Injection
            </h2>

            <div>
              <label className="block text-[#44474d] font-semibold text-[11px] mb-1">Enter Text Value 1</label>
              <input
                type="text"
                value={identConfig.textValue1}
                onChange={e => setIdentConfig({ ...identConfig, textValue1: e.target.value })}
                placeholder="Prefix / Header text..."
                className="w-full bg-[#fbf8fb] border border-[#c5c6ce] rounded p-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-[#44474d] font-semibold text-[11px] mb-1">Enter Text Value 2</label>
              <input
                type="text"
                value={identConfig.textValue2}
                onChange={e => setIdentConfig({ ...identConfig, textValue2: e.target.value })}
                placeholder="Suffix / Static text..."
                className="w-full bg-[#fbf8fb] border border-[#c5c6ce] rounded p-1.5 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#c5c6ce]">
              <button
                type="button"
                onClick={handleClearValues}
                className="px-3 py-1.5 border border-[#75777e] rounded text-[#041632] font-semibold hover:bg-[#eae7ea]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleApplyToken}
                className="px-4 py-1.5 bg-[#3e5f90] hover:bg-[#315384] text-white rounded font-bold shadow-xs"
              >
                Apply Token
              </button>
            </div>
          </div>

          {/* Card 3: Compiler Status */}
          <div className="mt-auto bg-[#efedf0] border border-[#c5c6ce] rounded-lg p-3 flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#44474d]">Compiler Status</p>
              <p className="font-semibold text-xs text-[#041632]">{compilerStatus}</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
