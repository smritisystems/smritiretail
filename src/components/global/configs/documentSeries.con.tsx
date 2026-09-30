/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.49.0
 * Created      : 2026-08-19
 * Modified     : 2026-09-30
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { FileDigit, Hash, ShieldCheck, Sparkles, Lock, Layers, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { MasterConfig } from "../master/types.ts";
import { DocumentSeries, NumberingEngine } from "../../../services/numberingEngine.ts";

/**
 * Live Preview Component for the Document Series Form Drawer
 */
const LiveSeriesPreview: React.FC<{ formState: any }> = ({ formState }) => {
  const prefix = formState.prefix || "";
  const suffix = formState.suffix || "";
  const runningLength = Number(formState.runningLength) || (formState.documentType === "ARTICLE" ? 5 : 6);
  const startNum = Number(formState.startNumber) || 1;
  const currentNum = formState.currentNumber !== undefined && formState.currentNumber !== null && formState.currentNumber !== ""
    ? Number(formState.currentNumber)
    : (startNum > 1 ? startNum - 1 : 0);
  
  const nextNum = currentNum + 1;
  const paddedNext = String(nextNum).padStart(runningLength, "0");
  const previewCode = `${prefix}${paddedNext}${suffix}`;

  const endNum = formState.endNumber ? Number(formState.endNumber) : null;
  const isArticle = formState.documentType === "ARTICLE";
  const category = formState.category ? String(formState.category).toUpperCase() : null;

  const remaining = endNum !== null ? Math.max(0, endNum - nextNum + 1) : null;
  const isNearExhaustion = remaining !== null && remaining < 100;
  const isExhausted = remaining !== null && remaining === 0;

  return (
    <div className="w-full rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs">
            <Sparkles size={14} />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Live Sequential Preview (Read-Only)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {category && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {category}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
            <Lock size={10} /> Auto-Generated
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-900/80 p-3 rounded-lg border border-blue-500/20 shadow-xs">
        <div>
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Next Allocated Number
          </div>
          <div className="font-mono text-base font-extrabold text-blue-600 dark:text-blue-400 tracking-wide mt-0.5">
            {previewCode}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-mono text-slate-400">
            Range Scope: <span className="font-bold text-slate-700 dark:text-slate-300">{startNum.toLocaleString("en-IN")}</span> ➔ <span className="font-bold text-slate-700 dark:text-slate-300">{endNum ? endNum.toLocaleString("en-IN") : "Continuous (∞)"}</span>
          </div>
          {remaining !== null && (
            <div className={`text-[10px] font-mono font-bold mt-0.5 ${isExhausted ? "text-rose-500" : isNearExhaustion ? "text-amber-500" : "text-emerald-500"}`}>
              {remaining.toLocaleString("en-IN")} allocations remaining
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        {isArticle ? (
          <>
            This series governs <strong>{category || "Unassigned"}</strong> Article creation.
            The sequence counter increments automatically inside PostgreSQL row-level locks on save with zero gap spillover.
          </>
        ) : (
          <>
            Automated statutory sequential numbering. Prefixes support fiscal year <code>{"{FY}"}</code> and store token interpolation.
          </>
        )}
      </p>
    </div>
  );
};

/**
 * Collapsible Advanced Options Accordion for MasterFormDrawer
 */
const AdvancedOptionsAccordion: React.FC<{
  formState: any;
  onChange: (field: string, val: any) => void;
}> = ({ formState, onChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full rounded-xl border border-theme-divider bg-theme-surface-2 overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-theme-surface-hover transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown size={16} className="text-blue-500" /> : <ChevronRight size={16} className="text-theme-muted" />}
          <span className="text-xs font-bold text-theme-primary">
            Advanced Numbering Options (Fiscal Year, Format & Terminal Scope)
          </span>
        </div>
        <span className="text-[10px] font-mono text-theme-muted">
          {isExpanded ? "Click to Collapse" : "Click to Expand"}
        </span>
      </button>

      {isExpanded && (
        <div className="p-4 pt-1 border-t border-theme-divider space-y-4 bg-theme-surface-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reset Rule */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-theme-muted font-mono">
                Sequence Reset Frequency
              </label>
              <select
                value={formState.resetRule || "Financial Year"}
                onChange={(e) => onChange("resetRule", e.target.value)}
                className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Financial Year">Financial Year (1-Apr)</option>
                <option value="Calendar Year">Calendar Year (1-Jan)</option>
                <option value="Monthly">Monthly</option>
                <option value="Never">Never (Continuous)</option>
              </select>
            </div>

            {/* Bill Number Arrangement Format */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-theme-muted font-mono">
                Number Segment Format
              </label>
              <select
                value={formState.numberFormat || "PREFIX_NUM_SUFFIX"}
                onChange={(e) => onChange("numberFormat", e.target.value)}
                className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="PREFIX_NUM_SUFFIX">Prefix + No. + Suffix (Default)</option>
                <option value="PREFIX_YEAR_SEP_NUM">Prefix / Year / No.</option>
                <option value="PREFIX_SEP_NUM">Prefix / No.</option>
                <option value="NUM_ONLY">No. Only</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2.5 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={formState.isCommonAcrossTerminals !== false}
                onChange={(e) => onChange("isCommonAcrossTerminals", e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-theme-divider bg-theme-surface-2"
              />
              <span className="text-xs text-theme-primary font-medium">
                Common Across All POS Terminals (Single Unified Sequence Pool)
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export const documentSeriesConfig: MasterConfig<DocumentSeries> = {
  entityName: "Document Series",
  entityNamePlural: "Document Series",
  title: "Document Series & Numbering Studio",
  subtitle: "Configure automated sequential numbering rules, category-aware ranges, branch-specific prefixes, and fiscal year resets",
  icon: <FileDigit size={20} />,
  apiEndpoint: "/api/v1/numbering/series",
  idKey: "id",

  responseTransform: (data) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return NumberingEngine.getAllSeries();
  },

  payloadTransform: (formData, mode) => {
    const isArticle = formData.documentType === "ARTICLE";
    const startNum = Number(formData.startNumber) || 1;
    let currNum = Number(formData.currentNumber);
    if (mode === "create" && (formData.currentNumber === undefined || formData.currentNumber === null || formData.currentNumber === "")) {
      currNum = startNum > 1 ? startNum - 1 : 0;
    }

    return {
      name: formData.name,
      documentType: formData.documentType,
      module: isArticle ? "INVENTORY" : (formData.module || "SALES"),
      prefix: formData.prefix || "",
      suffix: formData.suffix || "",
      runningLength: Number(formData.runningLength) || (isArticle ? 5 : 6),
      resetRule: formData.resetRule || (isArticle ? "Never" : "Financial Year"),
      currentNumber: currNum,
      startNumber: startNum,
      endNumber: formData.endNumber ? Number(formData.endNumber) : null,
      category: isArticle && formData.category ? String(formData.category).trim().toUpperCase() : null,
      isActive: formData.isActive !== false,
      numberFormat: formData.numberFormat || "PREFIX_NUM_SUFFIX",
      isCommonAcrossTerminals: formData.isCommonAcrossTerminals !== false,
      financialYear: formData.financialYear || "2026-2027",
      companyCode: formData.companyCode || "SMRITI_IND"
    };
  },

  searchPlaceholder: "Search by series name, document type, category, or prefix...",
  searchFields: ["name", "documentType", "category", "prefix", "suffix", "module"],

  columns: [
    {
      key: "name",
      fieldId: "document_series.name",
      label: "Series Name",
      width: "250px",
      sortable: true,
      render: (val, item) => (
        <div>
          <div className="font-bold text-theme-primary flex items-center gap-1.5 flex-wrap">
            <span>{val}</span>
            {item.category && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
                {item.category}
              </span>
            )}
          </div>
          <div className="text-[10px] text-theme-muted font-mono">
            {item.documentType} • {item.module || (item.documentType === "ARTICLE" ? "INVENTORY" : "SALES")}
          </div>
        </div>
      )
    },
    {
      key: "prefix",
      fieldId: "document_series.prefix",
      label: "Prefix / Pattern",
      width: "200px",
      render: (val, item) => (
        <div className="font-mono text-xs font-bold text-blue-500 dark:text-blue-400">
          {val || "—"}
          <span className="text-emerald-500 font-normal">
            {"0".repeat(item.runningLength || (item.documentType === "ARTICLE" ? 5 : 6))}
          </span>
          {item.suffix || ""}
        </div>
      )
    },
    {
      key: "range",
      label: "Range (Floor ➔ Ceiling)",
      width: "190px",
      render: (_, item) => {
        const start = item.startNumber ?? (item as any).start_number ?? 1;
        const end = item.endNumber ?? (item as any).end_number;
        return (
          <span className="font-mono text-xs font-semibold text-theme-primary">
            {Number(start).toLocaleString("en-IN")}
            <span className="text-theme-muted mx-1">➔</span>
            {end ? Number(end).toLocaleString("en-IN") : "Continuous (∞)"}
          </span>
        );
      }
    },
    {
      key: "currentNumber",
      fieldId: "document_series.current_number",
      label: "Current Sequence",
      width: "140px",
      align: "right",
      sortable: true,
      render: (val) => (
        <span className="font-mono font-bold text-xs text-theme-primary">
          {Number(val || 0).toLocaleString("en-IN")}
        </span>
      )
    },
    {
      key: "resetRule",
      fieldId: "document_series.reset_rule",
      label: "Reset Cycle",
      width: "140px",
      render: (val, item) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-theme-surface-2 border border-theme-divider text-theme-primary">
          {item.documentType === "ARTICLE" ? "Never (Continuous)" : (val || "Financial Year")}
        </span>
      )
    },
    {
      key: "isActive",
      fieldId: "document_series.is_active",
      label: "Status",
      width: "100px",
      render: (val) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
          val ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20"
        }`}>
          {val ? "Active" : "Inactive"}
        </span>
      )
    }
  ],

  fields: [
    {
      name: "documentType",
      label: "Document Type",
      type: "select",
      required: true,
      options: [
        { label: "Article / Design (Master)", value: "ARTICLE" },
        { label: "Retail Invoice", value: "Retail Invoice" },
        { label: "Tax Invoice (B2B)", value: "Tax Invoice" },
        { label: "Sales Order", value: "Sales Order" },
        { label: "Quotation", value: "Quotation" },
        { label: "Purchase Order", value: "Purchase Order" },
        { label: "Goods Receipt (GRN)", value: "Goods Receipt" },
        { label: "Sales Return / Credit Note", value: "Sales Return" },
        { label: "Debit Note", value: "Debit Note" },
        { label: "Delivery Challan", value: "Delivery Challan" }
      ],
      defaultValue: "ARTICLE",
      colSpan: 1
    },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      showWhen: (formState) => formState.documentType === "ARTICLE",
      optionsEndpoint: "/api/v1/masters/lookup/category/values",
      transformOptions: (data: any) => {
        if (Array.isArray(data) && data.length > 0) {
          return data.map((d: any) => ({
            label: d.name || d.code,
            value: String(d.code || d.name).trim().toUpperCase()
          }));
        }
        return [
          { label: "SANDAL", value: "SANDAL" },
          { label: "SHOES", value: "SHOES" },
          { label: "CHAPPAL", value: "CHAPPAL" },
          { label: "Footwear", value: "FOOTWEAR" },
          { label: "Apparel", value: "APPAREL" },
          { label: "Accessories", value: "ACCESSORIES" },
          { label: "General", value: "GENERAL" }
        ];
      },
      placeholder: "Select Category",
      colSpan: 1
    },
    {
      name: "name",
      fieldId: "document_series.name",
      label: "Series Name",
      type: "text",
      required: true,
      placeholder: "e.g. Article Series - Sandal",
      defaultValue: "Article Series - Sandal",
      colSpan: 1
    },
    {
      name: "prefix",
      fieldId: "document_series.prefix",
      label: "Prefix Format",
      type: "text",
      required: true,
      placeholder: "e.g. SND- or SH- or INV/{FY}/",
      defaultValue: "SND-",
      colSpan: 1
    },
    {
      name: "suffix",
      label: "Suffix Format",
      type: "text",
      placeholder: "e.g. -A (optional)",
      defaultValue: "-A",
      colSpan: 1
    },
    {
      name: "startNumber",
      label: "Start Number (Floor)",
      type: "number",
      required: true,
      defaultValue: 10000,
      min: 1,
      placeholder: "e.g. 10000",
      colSpan: 1
    },
    {
      name: "currentNumber",
      fieldId: "document_series.current_number",
      label: "Current Sequence Counter",
      type: "number",
      defaultValue: 9999,
      disabled: (_formState, isEdit) => Boolean(isEdit),
      description: "System-controlled sequence allocation counter. Increments automatically on save.",
      colSpan: 1
    },
    {
      name: "endNumber",
      label: "End Number (Ceiling)",
      type: "number",
      placeholder: "e.g. 19999 (optional range ceiling)",
      defaultValue: 19999,
      colSpan: 1
    },
    {
      name: "runningLength",
      label: "Padding Digit Length",
      type: "number",
      defaultValue: 5,
      min: 1,
      max: 10,
      colSpan: 1
    },
    {
      name: "livePreview",
      label: "Live Sequence Preview",
      type: "custom",
      colSpan: 2,
      renderCustom: (formState) => <LiveSeriesPreview formState={formState} />
    },
    {
      name: "isActive",
      label: "Active Series",
      type: "toggle",
      defaultValue: true,
      colSpan: 1
    }
  ],

  slots: {
    extraFields: (formState, setFormField) => (
      <AdvancedOptionsAccordion
        formState={formState}
        onChange={(field, val) => setFormField(field, val)}
      />
    )
  },

  customValidation: (formData, existingItems) => {
    const errors: string[] = [];
    const isArticle = formData.documentType === "ARTICLE";
    const startNum = Number(formData.startNumber);
    const endNum = formData.endNumber !== undefined && formData.endNumber !== null && formData.endNumber !== ""
      ? Number(formData.endNumber)
      : null;
    const currNum = Number(formData.currentNumber || 0);

    if (isNaN(startNum) || startNum < 1) {
      errors.push("Start Number must be a positive integer greater than or equal to 1.");
    }

    if (endNum !== null) {
      if (isNaN(endNum) || endNum < startNum) {
        errors.push(`End Number (${endNum}) must be greater than or equal to Start Number (${startNum}).`);
      }
      if (currNum >= endNum) {
        errors.push(`Current Counter (${currNum}) has already reached or exceeded the End Number (${endNum}).`);
      }
    }

    if (isArticle) {
      if (!formData.category || !String(formData.category).trim()) {
        errors.push("Category is required for ARTICLE series.");
      } else {
        const cat = String(formData.category).trim().toUpperCase();
        // Check active range overlap against existing series
        if (formData.isActive !== false && endNum !== null) {
          const activeOverlap = (existingItems || []).find((s: any) => {
            if (s.id && formData.id && s.id === formData.id) return false;
            const sType = s.documentType || s.document_type;
            const sCat = s.category ? String(s.category).trim().toUpperCase() : null;
            const sActive = s.isActive !== false && s.is_active !== false;

            if (sType === "ARTICLE" && sCat === cat && sActive) {
              const sStart = Number(s.startNumber ?? (s as any).start_number ?? 1);
              const sEnd = (s.endNumber !== undefined && s.endNumber !== null)
                ? Number(s.endNumber)
                : ((s as any).end_number !== undefined && (s as any).end_number !== null ? Number((s as any).end_number) : 999999999);
              // Check interval overlap: max(A_start, B_start) <= min(A_end, B_end)
              const overlaps = Math.max(startNum, sStart) <= Math.min(endNum, sEnd);
              return overlaps;
            }
            return false;
          });

          if (activeOverlap) {
            const oStart = activeOverlap.startNumber ?? (activeOverlap as any).start_number ?? 1;
            const oEnd = activeOverlap.endNumber ?? (activeOverlap as any).end_number ?? "∞";
            errors.push(
              `Range [${startNum.toLocaleString("en-IN")} - ${endNum.toLocaleString("en-IN")}] overlaps with active series '${activeOverlap.name}' [${Number(oStart).toLocaleString("en-IN")} - ${Number(oEnd).toLocaleString("en-IN")}] for category '${cat}'. Overlapping active ranges are prohibited.`
            );
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  },

  kpis: [
    {
      id: "total_series",
      label: "Configured Series",
      compute: (items) => items.length,
      color: "blue"
    },
    {
      id: "active_series",
      label: "Active Numbering Series",
      compute: (items) => items.filter((s) => s.isActive !== false).length,
      color: "emerald"
    },
    {
      id: "article_series",
      label: "Article Series Ranges",
      compute: (items) => items.filter((s) => (s.documentType === "ARTICLE" || (s as any).document_type === "ARTICLE")).length,
      color: "indigo"
    }
  ]
};
