/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.8.0
 * Created      : 2026-08-23
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, Check, ChevronDown } from "lucide-react";

interface SearchableMultiSelectProps {
  label: string;
  placeholder?: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

export const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  label,
  placeholder = "Select options...",
  options,
  selectedValues,
  onChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const handleToggleOption = (option: string) => {
    if (selectedValues.includes(option)) {
      onChange(selectedValues.filter(v => v !== option));
    } else {
      onChange([...selectedValues, option]);
    }
  };

  const handleSelectAllFiltered = () => {
    const newSelected = Array.from(new Set([...selectedValues, ...filteredOptions]));
    onChange(newSelected);
  };

  const handleClearFiltered = () => {
    const filteredSet = new Set(filteredOptions);
    onChange(selectedValues.filter(v => !filteredSet.has(v)));
  };

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      <label className="font-label-caps text-[11px] text-on-surface-variant flex justify-between items-center">
        <span>{label}</span>
        {selectedValues.length > 0 && (
          <span className="text-[10px] font-bold text-secondary font-mono">
            {selectedValues.length} selected
          </span>
        )}
      </label>

      {/* Trigger button / input preview */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface flex items-center justify-between cursor-pointer transition select-none min-h-[32px] ${
          isOpen ? "border-secondary ring-1 ring-secondary" : "hover:border-outline"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 flex-1 overflow-hidden truncate">
          {selectedValues.length === 0 ? (
            <span className="text-on-surface-variant italic truncate">{placeholder}</span>
          ) : (
            <span className="font-medium text-primary truncate">
              {selectedValues.slice(0, 2).join(", ")}
              {selectedValues.length > 2 && (
                <span className="text-[10px] font-mono text-secondary ml-1 bg-secondary-fixed/50 px-1 py-0.5 rounded">
                  +{selectedValues.length - 2} more
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-1 text-on-surface-variant">
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="p-0.5 hover:text-error rounded transition"
              title="Clear selection"
              aria-label={`Clear ${label} selection`}
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown size={14} className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-outline-variant rounded-lg shadow-xl z-50 p-2 flex flex-col gap-2 max-h-64 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          
          {/* Search box inside popover */}
          <div className="relative shrink-0">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full bg-surface border border-outline-variant rounded pl-7 pr-2.5 py-1 text-xs text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
            />
          </div>

          {/* Quick bulk actions */}
          <div className="flex justify-between items-center px-1 text-[10px] font-medium text-on-surface-variant shrink-0 border-b border-outline-variant/40 pb-1">
            <span>{filteredOptions.length} available</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-secondary hover:underline font-semibold cursor-pointer"
              >
                Select All
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleClearFiltered}
                className="text-error hover:underline font-semibold cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Options list */}
          <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar pr-1 max-h-40">
            {filteredOptions.map((opt) => {
              const isChecked = selectedValues.includes(opt);
              return (
                <div
                  key={opt}
                  onClick={() => handleToggleOption(opt)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs transition ${
                    isChecked
                      ? "bg-secondary-fixed/50 text-primary font-bold"
                      : "hover:bg-surface-variant text-on-surface"
                  }`}
                  role="option"
                  aria-selected={isChecked}
                >
                  <div className="flex items-center gap-2 truncate">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by parent div
                      className="rounded text-secondary focus:ring-secondary h-3.5 w-3.5"
                    />
                    <span className="truncate">{opt}</span>
                  </div>
                  {isChecked && <Check size={13} className="text-secondary shrink-0" />}
                </div>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="text-center py-4 text-xs text-on-surface-variant italic">
                No matching {label.toLowerCase()} found.
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
