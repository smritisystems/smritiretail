/**
 * Project      : SMRITI Business OS
 * Component    : SEDSFilterBar (Smart Filter Bar)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SEDS Enterprise Core Component
 */

import React, { useState } from "react";
import { Filter, Search, X, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

export interface SEDSFilterField {
  id: string;
  label: string;
  type: "text" | "select" | "date" | "boolean";
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export interface SEDSFilterBarProps {
  fields: SEDSFilterField[];
  values: Record<string, any>;
  onChange: (newValues: Record<string, any>) => void;
  onSearch?: (searchTerm: string) => void;
  searchTerm?: string;
  onReset?: () => void;
  title?: string;
  compact?: boolean;
}

export const SEDSFilterBar: React.FC<SEDSFilterBarProps> = ({
  fields,
  values,
  onChange,
  onSearch,
  searchTerm = "",
  onReset,
  title = "Filter Records",
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(!compact);

  const activeFilterCount = Object.keys(values).filter(
    (k) => values[k] !== undefined && values[k] !== null && values[k] !== ""
  ).length;

  const handleFieldChange = (id: string, val: any) => {
    onChange({
      ...values,
      [id]: val,
    });
  };

  const handleClearField = (id: string) => {
    const next = { ...values };
    delete next[id];
    onChange(next);
  };

  return (
    <div className="w-full bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-md p-4 mb-4 font-sans transition-all">
      {/* Top Controls Header */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-theme-divider">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-950/40 border border-blue-500/30 text-blue-400">
            <Filter size={16} />
          </div>
          <span className="text-xs font-bold text-theme-body">{title}</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] font-mono font-bold text-blue-400">
              {activeFilterCount} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onReset && activeFilterCount > 0 && (
            <button
              onClick={onReset}
              className="text-xs text-theme-muted hover:text-theme-body flex items-center gap-1 font-medium transition"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg bg-theme-surface-2 border border-theme-divider text-theme-muted hover:text-theme-body transition flex items-center gap-1 text-xs"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span className="hidden sm:inline">{expanded ? "Collapse" : "Expand"}</span>
          </button>
        </div>
      </div>

      {/* Expanded Filter Form Inputs */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3 animate-in fade-in">
          {fields.map((field) => {
            const val = values[field.id] || "";

            return (
              <div key={field.id} className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
                  {field.label}
                </label>

                <div className="relative flex items-center">
                  {field.type === "select" ? (
                    <select
                      value={val}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-1.5 text-xs text-theme-body focus:border-blue-500 outline-none"
                    >
                      <option value="">All</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "date" ? (
                    <input
                      type="date"
                      value={val}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-1.5 text-xs text-theme-body focus:border-blue-500 outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.placeholder || `Filter ${field.label}...`}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-1.5 text-xs text-theme-body focus:border-blue-500 outline-none pr-7"
                    />
                  )}

                  {val && (
                    <button
                      onClick={() => handleClearField(field.id)}
                      className="absolute right-2 text-theme-muted hover:text-theme-body"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
