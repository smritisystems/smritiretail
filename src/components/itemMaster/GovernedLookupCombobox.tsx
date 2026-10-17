/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 1.0.0
 * * Created    : 2026-10-13
 * * Modified   : 2026-10-13
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, X } from "lucide-react";

export interface LookupItem {
  code: string;
  name: string;
}

export interface GovernedLookupComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: LookupItem[] | string[];
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

/**
 * GovernedLookupCombobox
 *
 * A hybrid typeahead and dropdown combobox for Master Lookup governed fields
 * (Brand, Category, Sub-Category, Department, Size Group).
 *
 * Combines high-velocity keyboard entry, real-time filtering, and a visible
 * interactive dropdown chevron menu showing all master options.
 */
export const GovernedLookupCombobox: React.FC<GovernedLookupComboboxProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder,
  hasError = false,
  disabled = false,
  className = "",
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Normalize options into LookupItem[] format
  const normalizedOptions = useMemo<LookupItem[]>(() => {
    if (!Array.isArray(options)) return [];
    return options.map((opt) => {
      if (typeof opt === "string") {
        return { code: opt, name: opt };
      }
      return {
        code: String(opt.code ?? opt.name ?? ""),
        name: String(opt.name ?? opt.code ?? ""),
      };
    });
  }, [options]);

  // Filter options based on typed input
  const filteredOptions = useMemo(() => {
    const query = (value || "").trim().toLowerCase();
    if (!query) return normalizedOptions;
    return normalizedOptions.filter((opt) =>
      opt.name.toLowerCase().includes(query) || opt.code.toLowerCase().includes(query)
    );
  }, [normalizedOptions, value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("li");
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelectOption = (item: LookupItem) => {
    onChange(item.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(true);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(filteredOptions.length - 1);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
      }
    } else if (e.key === "Enter") {
      if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault();
        handleSelectOption(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${isOpen ? "z-40" : "z-0"}`}
    >
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={`w-full text-xs pr-14 pl-3 py-2 rounded-lg border bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden transition ${
            hasError
              ? "border-red-500 ring-1 ring-red-500"
              : "border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
          } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-800" : ""} ${className}`}
        />

        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              title="Clear input"
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition"
            >
              <X size={12} />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setIsOpen((prev) => !prev);
                inputRef.current?.focus();
              }
            }}
            title="Toggle options"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition focus:outline-hidden"
          >
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : ""}`}
            />
          </button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2234] shadow-xl z-50 py-1 text-xs animate-in fade-in-50 duration-100">
          {filteredOptions.length > 0 ? (
            <ul ref={listRef} className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {filteredOptions.map((opt, idx) => {
                const isSelected =
                  opt.name.trim().toLowerCase() === (value || "").trim().toLowerCase();
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={`${opt.code}-${idx}`}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelectOption(opt)}
                    className={`px-3 py-2 flex items-center justify-between cursor-pointer select-none transition ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold"
                        : isHighlighted
                        ? "bg-slate-100 dark:bg-slate-800/70 text-slate-900 dark:text-white"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <span className="truncate">{opt.name}</span>
                    {isSelected && (
                      <Check size={13} className="text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-3 py-2.5 text-center text-[11px] text-slate-400 dark:text-slate-500">
              {normalizedOptions.length === 0 ? (
                <span>No master lookup options configured.</span>
              ) : (
                <span>No matching options (custom value allowed).</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
