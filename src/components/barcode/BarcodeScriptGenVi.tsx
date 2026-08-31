/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.6.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Stitch Barcode Label Designer & Printer (Industrial Logic)
 */

import React, { useState, useRef } from "react";
import { 
  Code, 
  Save, 
  Upload, 
  Maximize2, 
  Minimize2, 
  ArrowLeft, 
  FileCode,
  Layers,
  LogOut,
  Sparkles,
  Sliders,
  CheckCircle
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
    a.download = "ModernLabelDesign_TE244.blf";
    a.click();
    URL.revokeObjectURL(url);
    onNotification?.("Script Saved", "Exported script to ModernLabelDesign_TE244.blf", "success");
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
    <div className={`h-full flex flex-col bg-surface text-on-surface font-sans select-none overflow-hidden ${
      isFullscreen ? "fixed inset-0 z-50 p-4 bg-slate-900" : ""
    }`}>
      
      {/* Top Application Bar */}
      <header className="h-14 border-b border-outline-variant bg-surface-container flex justify-between items-center px-margin-page shrink-0 shadow-xs z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToPrinting}
            className="p-1.5 hover:bg-surface-variant rounded text-primary flex items-center gap-1.5 text-xs font-bold transition"
            title="Back to Tag Printing Terminal"
          >
            <ArrowLeft size={16} />
            <span>Back to Printing</span>
          </button>
          <div className="h-4 w-px bg-outline-variant"></div>
          <div className="flex items-center gap-2 text-primary font-bold font-title-sm text-title-sm">
            <Code size={18} className="text-secondary" />
            <span>Barcode Script Generation &amp; Compiler Studio</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-label-caps text-[11px] bg-secondary-fixed text-on-secondary-fixed px-3 py-1 rounded-full font-bold">
            Industrial Script Compiler
          </span>
        </div>
      </header>

      {/* Main Studio Frame: Left Code Editor + Right Configuration Panel */}
      <main className="flex-1 flex flex-col lg:flex-row p-margin-page gap-stack-gap overflow-hidden bg-surface-container-lowest">
        
        {/* Left Column: Code Editor */}
        <div className="flex-1 flex flex-col bg-surface border border-outline-variant rounded-lg overflow-hidden shadow-xs">
          
          {/* Editor Header Bar */}
          <div className="bg-surface-container px-4 py-2.5 border-b border-outline-variant flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 text-primary font-bold text-xs">
              <FileCode size={16} className="text-secondary" />
              <span>ModernLabelDesign_TE244.blf</span>
              <span className="bg-secondary-fixed text-on-secondary-fixed text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
                BLF SCRIPT
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-code-md text-on-surface-variant">
              <span>{lines.length} lines</span>
              <span>•</span>
              <span>UTF-8</span>
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1 hover:bg-surface-variant rounded text-on-surface ml-2"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {/* Dark VS Code Style Monospaced Editor */}
          <div className="flex-1 relative bg-[#1E1E1E] text-[#D4D4D4] font-code-md text-code-md overflow-hidden flex">
            {/* Line Numbers Column */}
            <div className="w-12 bg-[#1E1E1E] border-r border-outline-variant/20 text-right pr-2.5 pt-4 select-none text-on-surface-variant/40 font-code-md text-[12px] leading-relaxed overflow-hidden">
              {lines.map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>

            {/* Code Content Textarea with Macro Highlighting */}
            <div className="flex-1 relative overflow-auto p-4 pt-4 leading-relaxed custom-scrollbar">
              <textarea
                value={scriptContent}
                onChange={e => setScriptContent(e.target.value)}
                spellCheck={false}
                className="w-full h-full bg-transparent text-[#D4D4D4] font-code-md text-xs leading-relaxed outline-none resize-none border-none selection:bg-secondary/40"
              />
            </div>
          </div>

          {/* Editor Action Footer */}
          <div className="bg-surface-container px-4 py-3 border-t border-outline-variant flex justify-start gap-3 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-surface-container-highest hover:bg-surface-variant text-on-surface border border-outline-variant px-5 py-2 rounded-lg font-title-sm text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs"
            >
              <Upload size={15} />
              <span>Load Script</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".t,.blf,.prn,.zpl,.tspl,.txt"
              className="hidden"
              onChange={handleLoadScriptFile}
            />

            <button
              type="button"
              onClick={handleSaveScript}
              className="bg-primary hover:bg-primary-container text-on-primary px-6 py-2 rounded-lg font-title-sm text-xs font-bold transition-colors shadow-md flex items-center gap-2"
            >
              <Save size={15} />
              <span>Save Changes</span>
            </button>

            <div className="flex-1"></div>

            <button
              type="button"
              onClick={onBackToPrinting}
              className="text-error border border-error hover:bg-error-container hover:text-on-error-container px-4 py-2 rounded-lg font-title-sm text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <LogOut size={15} />
              <span>Exit</span>
            </button>
          </div>

        </div>

        {/* Right Column: Configuration Panels (Identification & Values) */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-stack-gap overflow-y-auto">
          
          {/* Card 1: Identification Settings */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-xs">
            <h2 className="font-title-sm text-xs font-bold text-primary mb-3.5 flex items-center gap-2 border-b border-outline-variant pb-2 uppercase tracking-wider">
              <Sliders size={16} className="text-secondary" />
              <span>Identification</span>
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block font-body-sm text-xs font-semibold text-on-surface-variant mb-1">
                  Field Selection
                </label>
                <select
                  value={identConfig.field}
                  onChange={e => setIdentConfig({ ...identConfig, field: e.target.value as any })}
                  className="w-full bg-surface border border-outline-variant text-on-surface rounded focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-xs py-1.5 px-2.5 font-medium"
                >
                  <option value="Stock Number">Stock Number</option>
                  <option value="Retail Price">Retail Price</option>
                  <option value="Lot Code">Lot Code</option>
                  <option value="Barcode">Barcode</option>
                  <option value="Product Name">Product Name</option>
                  <option value="Brand">Brand</option>
                  <option value="Style">Style</option>
                  <option value="Size">Size</option>
                  <option value="Shade">Shade</option>
                </select>
              </div>

              <div className="border border-outline-variant rounded p-2.5 bg-surface-container-low">
                <label className="block font-label-caps text-[10px] text-on-surface-variant mb-1.5 uppercase tracking-wider">
                  String to be taken
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="direction"
                      checked={identConfig.direction === "From Right"}
                      onChange={() => setIdentConfig({ ...identConfig, direction: "From Right" })}
                      className="text-secondary focus:ring-secondary h-3.5 w-3.5"
                    />
                    <span className="text-xs text-on-surface">From Right</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="direction"
                      checked={identConfig.direction === "From Left"}
                      onChange={() => setIdentConfig({ ...identConfig, direction: "From Left" })}
                      className="text-secondary focus:ring-secondary h-3.5 w-3.5"
                    />
                    <span className="text-xs text-on-surface">From Left</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-body-sm text-xs text-on-surface-variant mb-1">
                    Starting Position
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={identConfig.startPosition}
                    onChange={e => setIdentConfig({ ...identConfig, startPosition: parseInt(e.target.value) || 1 })}
                    className="w-full bg-surface border border-outline-variant text-on-surface rounded focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors font-code-md text-xs py-1.5 px-2.5 text-right font-bold"
                  />
                </div>
                <div>
                  <label className="block font-body-sm text-xs text-on-surface-variant mb-1">
                    No. of Digits
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={identConfig.numDigits}
                    onChange={e => setIdentConfig({ ...identConfig, numDigits: parseInt(e.target.value) || 1 })}
                    className="w-full bg-surface border border-outline-variant text-on-surface rounded focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors font-code-md text-xs py-1.5 px-2.5 text-right font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Values */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-xs">
            <h2 className="font-title-sm text-xs font-bold text-primary mb-3 flex items-center gap-2 border-b border-outline-variant pb-2 uppercase tracking-wider">
              <Sparkles size={16} className="text-secondary" />
              <span>Values</span>
            </h2>

            <div className="flex flex-col gap-2.5">
              <div>
                <label className="block font-body-sm text-xs text-on-surface-variant mb-1">
                  Enter Text Value 1
                </label>
                <input
                  type="text"
                  value={identConfig.textValue1}
                  onChange={e => setIdentConfig({ ...identConfig, textValue1: e.target.value })}
                  placeholder="e.g. SMRITI RETAIL"
                  className="w-full bg-surface border border-outline-variant text-on-surface rounded focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-xs py-1.5 px-2.5"
                />
              </div>
              <div>
                <label className="block font-body-sm text-xs text-on-surface-variant mb-1">
                  Enter Text Value 2
                </label>
                <input
                  type="text"
                  value={identConfig.textValue2}
                  onChange={e => setIdentConfig({ ...identConfig, textValue2: e.target.value })}
                  placeholder="e.g. MRP INCL OF TAXES"
                  className="w-full bg-surface border border-outline-variant text-on-surface rounded focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-xs py-1.5 px-2.5"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-outline-variant">
              <button
                type="button"
                onClick={handleClearValues}
                className="bg-surface-container-highest hover:bg-surface-variant text-on-surface border border-outline-variant px-3.5 py-1.5 rounded font-body-sm text-xs font-semibold transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleApplyToken}
                className="bg-secondary hover:bg-opacity-90 text-on-secondary px-5 py-1.5 rounded font-body-sm text-xs font-bold transition-colors shadow-xs"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Status Info Card */}
          <div className="mt-auto bg-surface-container-low border border-outline-variant rounded-lg p-3 flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <div>
              <p className="font-label-caps text-[10px] text-on-surface-variant uppercase">Status</p>
              <p className="font-body-sm text-xs font-semibold text-on-surface truncate max-w-[200px]">{compilerStatus}</p>
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="bg-surface-container-low border-t border-outline-variant h-10 flex justify-between items-center px-margin-page z-30 font-label-caps text-[11px] shrink-0">
        <div className="text-secondary font-bold">© 2026 SMRITI Retail OS • Industrial Logic</div>
        <div className="flex gap-4 items-center text-on-surface-variant">
          <span>Target Script: <strong>ModernLabelDesign_TE244.blf</strong></span>
          <span>•</span>
          <span>DPI: <strong>300 DPI</strong></span>
        </div>
      </footer>

    </div>
  );
};

export default BarcodeScriptGenerationView;
