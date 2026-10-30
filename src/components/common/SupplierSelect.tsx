/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.76.0
 * Created      : 2026-10-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("SUPPLIER", "SUPPLIER_SELECT")
 * Description  : Enterprise Searchable Supplier / Vendor Selection Combobox
 */

import React, { useState, useRef, useEffect, useMemo } from "react";

export interface SupplierOption {
  id: string;
  name: string;
  code?: string;
  vendor_code?: string;
  gstin?: string;
  gst_number?: string;
  city?: string;
  state?: string;
  phone?: string;
  contact_number?: string;
  company_name?: string;
  [key: string]: any;
}

export interface SupplierSelectProps {
  suppliers: SupplierOption[];
  value: string;
  onChange: (supplierId: string, selectedSupplier?: SupplierOption) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  required?: boolean;
  compact?: boolean;
}

export const SupplierSelect: React.FC<SupplierSelectProps> = ({
  suppliers = [],
  value,
  onChange,
  placeholder = "Select supplier / vendor...",
  disabled = false,
  id = "supplier-select",
  className = "",
  required = false,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected supplier record
  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === value) || null;
  }, [suppliers, value]);

  // Real-time multi-field search: Name, Vendor Code, GSTIN, City
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return suppliers;
    const q = searchQuery.toLowerCase().trim();
    return suppliers.filter((s) => {
      const name = (s.name || s.company_name || "").toLowerCase();
      const code = (s.code || s.vendor_code || s.id || "").toLowerCase();
      const gst = (s.gst_number || s.gstin || "").toLowerCase();
      const city = (s.city || "").toLowerCase();
      return name.includes(q) || code.includes(q) || gst.includes(q) || city.includes(q);
    });
  }, [suppliers, searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutside);
      // Auto-focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  const handleSelect = (sup: SupplierOption) => {
    onChange(sup.id, sup);
    setIsOpen(false);
    setSearchQuery("");
  };

  const getCode = (s?: SupplierOption | null) => {
    if (!s) return "";
    return s.code || s.vendor_code || s.id;
  };

  const getGst = (s?: SupplierOption | null) => {
    if (!s) return "";
    return s.gst_number || s.gstin || "";
  };

  return (
    <div ref={containerRef} className={`relative w-full max-w-md ${className}`}>
      {/* Hidden standard select for form autofill and headless test compatibility */}
      <select
        id={id}
        name={id}
        value={value}
        required={required}
        disabled={disabled}
        onChange={(e) => {
          const s = suppliers.find((x) => x.id === e.target.value);
          onChange(e.target.value, s);
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        <option value="">{placeholder}</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name || s.company_name} ({getCode(s)})
          </option>
        ))}
      </select>

      {/* Trigger Button */}
      <button
        type="button"
        id={`${id}-trigger`}
        data-testid={`${id}-trigger`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full text-left border rounded-lg px-2.5 transition flex items-center justify-between gap-1.5 outline-none ${
          disabled
            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
            : isOpen
            ? "border-blue-600 ring-2 ring-blue-500/20 bg-white"
            : "border-slate-300 hover:border-slate-400 bg-white"
        } ${compact ? "h-7 text-xs" : "h-8 text-xs font-medium"}`}
      >
        <div className="truncate flex-1 flex items-center gap-1.5 min-w-0">
          {selectedSupplier ? (
            <>
              <span className="font-bold text-slate-900 truncate">
                {selectedSupplier.name || selectedSupplier.company_name}
              </span>
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                {getCode(selectedSupplier)}
              </span>
              {selectedSupplier.city && (
                <span className="hidden sm:inline text-[10px] text-slate-400 truncate">
                  • {selectedSupplier.city}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {selectedSupplier && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange("", undefined);
              }}
              className="hover:text-slate-600 p-0.5 cursor-pointer text-xs"
              title="Clear selection"
            >
              &times;
            </span>
          )}
          <span className="material-symbols-outlined text-[16px]">
            {isOpen ? "expand_less" : "expand_more"}
          </span>
        </div>
      </button>

      {/* Searchable Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[280px] sm:min-w-[340px] max-h-72 bg-white rounded-xl border border-slate-200 shadow-xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Live Search Input */}
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-slate-400 text-[16px] ml-1">search</span>
            <input
              ref={searchInputRef}
              type="text"
              id={`${id}-search-input`}
              data-testid={`${id}-search-input`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsOpen(false);
                } else if (e.key === "Enter" && filteredSuppliers.length > 0) {
                  e.preventDefault();
                  handleSelect(filteredSuppliers[0]);
                }
              }}
              placeholder="Search vendor name, code (V...), GST, city..."
              className="w-full bg-transparent border-none text-xs outline-none font-medium placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-slate-600 text-xs px-1"
              >
                &times;
              </button>
            )}
          </div>

          {/* Supplier List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-56 custom-scrollbar" role="listbox">
            {filteredSuppliers.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                No matching suppliers or vendor codes found.
              </div>
            ) : (
              filteredSuppliers.map((s) => {
                const isSelected = s.id === value;
                const code = getCode(s);
                const gst = getGst(s);
                return (
                  <div
                    key={s.id}
                    role="option"
                    aria-selected={isSelected}
                    data-testid={`${id}-option-${s.id}`}
                    onClick={() => handleSelect(s)}
                    className={`p-2 px-3 cursor-pointer transition flex items-center justify-between text-xs ${
                      isSelected
                        ? "bg-blue-50/80 text-blue-900 font-semibold"
                        : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 truncate">
                          {s.name || s.company_name}
                        </span>
                        {code && (
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-blue-700 border border-slate-200 shrink-0">
                            {code}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                        {s.city ? `${s.city}` : ""}
                        {gst ? `${s.city ? " • " : ""}GST: ${gst}` : ""}
                        {s.phone ? ` • ${s.phone}` : ""}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-blue-600 text-[16px] shrink-0 ml-2">
                        check
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Dropdown Footer Status */}
          <div className="p-1.5 px-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
            <span>
              {filteredSuppliers.length} of {suppliers.length} vendors
            </span>
            <span className="text-[9px] font-mono">Press ESC to close</span>
          </div>
        </div>
      )}
    </div>
  );
};
