/**
 * Project      : SMRITI Retail OS
 * Component    : Universal Data Binding Engine & Importer Wizard (DXP-UDBE-001)
 * Standard     : SIF-001 & SCS-DXP-001 (Consumes SEEFDialog mode="centered")
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 *
 * SIF Compliance Declaration
 * SIF Compatible : Yes
 * Surface        : Centered Dialog (SEEFDialog mode="centered", width=896)
 * Interaction    : InteractionService.wizard()
 * Accessibility  : PASS
 * Keyboard       : PASS
 */

import React, { useState } from "react";
import { FileCode, Upload, Sparkles, CheckCircle2, ShieldCheck, AlertCircle, Library } from "lucide-react";
import { SEEFDialog } from "../common/SEEFDialog.tsx";
import {
  RawTemplateEngine,
  CATEGORIZED_MAPPING_TREE,
  INDUSTRY_TEMPLATE_LIBRARY,
  IndustryTemplatePreset,
} from "../../dop/core/RawTemplateEngine.ts";

interface RawTemplateImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTemplate: (templateData: {
    templateName: string;
    language: string;
    rawContent: string;
    mappings: Record<string, string>;
  }) => void;
}

export const RawTemplateImporterModal: React.FC<RawTemplateImporterModalProps> = ({
  isOpen,
  onClose,
  onSaveTemplate,
}) => {
  const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");
  const [templateName, setTemplateName] = useState("");
  const [fileName, setFileName] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [language, setLanguage] = useState<"ZPL" | "TSPL" | "EPL" | "ESC_POS" | "RAW">("ZPL");
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});

  const sampleProducts = [
    { name: "Classic Denim Jacket", code: "DENIM-001", barcode: "8901234567890", price: 1499, mrp: 1999, size: "L", color: "Blue", brand: "SMRITI Apparel" }
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setTemplateName(file.name.replace(/\.[^/.]+$/, ""));

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawContent(text);

      const analysis = RawTemplateEngine.analyzeTemplate(text);
      setLanguage(analysis.language);
      setDetectedVariables(analysis.variables);
      setMappings(analysis.suggestedMappings);
      setStep("mapping");
    };
    reader.readAsText(file);
  };

  const handleSelectPreset = (preset: IndustryTemplatePreset) => {
    setFileName(`${preset.id}.zpl`);
    setTemplateName(preset.name);
    setRawContent(preset.script);

    const analysis = RawTemplateEngine.analyzeTemplate(preset.script);
    setLanguage(preset.language);
    setDetectedVariables(analysis.variables);
    setMappings(preset.defaultMappings);
    setStep("mapping");
  };

  const handleMappingChange = (variable: string, field: string) => {
    setMappings((prev) => ({ ...prev, [variable]: field }));
  };

  const validationReport = RawTemplateEngine.validateTemplate(rawContent, mappings);

  const handleSave = () => {
    onSaveTemplate({
      templateName: templateName || fileName || "Imported Template",
      language,
      rawContent,
      mappings,
    });
    onClose();
  };

  const resolvedPreviewScript = RawTemplateEngine.renderTemplate(rawContent, mappings, sampleProducts[0]);

  const footerActions = (
    <div className="w-full flex items-center justify-between">
      {step !== "upload" ? (
        <button
          onClick={() => setStep(step === "preview" ? "mapping" : "upload")}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-theme-surface-2 hover:bg-theme-surface-3 text-theme-body"
        >
          Back
        </button>
      ) : <div />}

      <div className="flex items-center gap-2">
        <button onClick={onClose} className="px-4 py-1.5 text-xs font-semibold text-theme-muted hover:text-theme-body">
          Cancel
        </button>
        {step === "mapping" && (
          <button
            onClick={() => setStep("preview")}
            className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow"
          >
            Review Mapping & Live Preview
          </button>
        )}
        {step === "preview" && (
          <button
            onClick={handleSave}
            className="px-5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" /> Save & Activate Template
          </button>
        )}
      </div>
    </div>
  );

  return (
    <SEEFDialog
      open={isOpen}
      onClose={onClose}
      title="Universal Data Binding & Template Engine (DXP-UDBE-001)"
      subtitle="Import existing BarTender / Zebra (.PRN / .ZPL / .TSPL) templates or select SMRITI Industry Presets"
      icon={FileCode}
      mode="centered"
      width={896}
      footer={footerActions}
    >
      <div className="space-y-4">
        {/* STEP 1: UPLOAD OR PRESET */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed border-theme-divider rounded-xl bg-theme-surface-2/30 text-center p-6 space-y-3">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-full">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-theme-heading">Upload Existing Retailer Template</h3>
                <p className="text-xs text-theme-muted mt-1">Supports Zebra ZPL, TSC TSPL, Eltron EPL, or Raw PRN text files</p>
              </div>
              <label className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow cursor-pointer">
                Browse .PRN / .ZPL / .TSPL File
                <input type="file" accept=".prn,.zpl,.tspl,.tpl,.epl,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-theme-heading">
                <Library className="w-4 h-4 text-emerald-400" />
                <span>Or Select from SMRITI Industry Template Library</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {INDUSTRY_TEMPLATE_LIBRARY.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className="p-3 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider rounded-xl text-left transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold text-theme-heading">{preset.name}</div>
                    <div className="text-[10px] text-theme-muted mt-0.5">{preset.industry} • {preset.language} Syntax</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: MAPPING WIZARD */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-theme-muted block mb-1">Template Name *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-body font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-theme-muted block mb-1">Detected Language</label>
                <div className="px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs font-bold text-blue-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> {language} Command Syntax
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-theme-heading mb-2">Universal Data Binding Engine ({detectedVariables.length} Placeholders Detected)</h4>
              <div className="max-h-60 overflow-y-auto border border-theme-divider rounded-xl divide-y divide-theme-divider bg-theme-surface-2/20">
                {detectedVariables.length === 0 ? (
                  <div className="p-4 text-xs text-theme-muted text-center">No variables detected. Standard static script template.</div>
                ) : (
                  detectedVariables.map((variable) => (
                    <div key={variable} className="p-3 flex items-center justify-between text-xs">
                      <span className="font-mono text-amber-400 font-bold">{"{" + variable + "}"}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-theme-muted">→ Maps to:</span>
                        <select
                          value={mappings[variable] || "Item.name"}
                          onChange={(e) => handleMappingChange(variable, e.target.value)}
                          className="bg-theme-surface-1 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-theme-body font-semibold"
                        >
                          {CATEGORIZED_MAPPING_TREE.map((cat) => (
                            <optgroup key={cat.category} label={cat.category}>
                              {cat.fields.map((f) => (
                                <option key={f.key} value={f.key}>{f.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: LIVE PREVIEW & VALIDATION REPORT */}
        {step === "preview" && (
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-theme-surface-2/40 border border-theme-divider rounded-xl flex items-center justify-between text-xs font-bold">
              <span className="text-theme-heading flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Validation Pre-check
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${validationReport.isValid ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                {validationReport.isValid ? "✓ Template Validated" : "⚠ Pre-check Warnings"}
              </span>
            </div>

            <div className="p-4 bg-black text-emerald-400 rounded-xl overflow-x-auto max-h-64 whitespace-pre-wrap font-mono text-xs border border-theme-divider shadow-inner">
              {resolvedPreviewScript}
            </div>
          </div>
        )}
      </div>
    </SEEFDialog>
  );
};
