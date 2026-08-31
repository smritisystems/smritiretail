/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.9.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Reusable Typeahead Suggestions Dropdown
 */

import React, { useEffect, useRef } from "react";
import { User, Package, Check, Tag, Phone, ShieldCheck } from "lucide-react";

export interface TypeaheadOption {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  metadata?: Record<string, any>;
  iconType?: "customer" | "product" | "hsn" | "general";
}

interface SmritiTypeaheadDropdownProps {
  isOpen: boolean;
  options: TypeaheadOption[];
  selectedIndex: number;
  onSelect: (option: TypeaheadOption) => void;
  onClose: () => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export const SmritiTypeaheadDropdown: React.FC<SmritiTypeaheadDropdownProps> = ({
  isOpen,
  options,
  selectedIndex,
  onSelect,
  onClose,
  isLoading = false,
  emptyMessage = "No matching records found"
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 top-full mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-[#1e293b] border border-[#94a3b8] dark:border-[#475569] rounded-md shadow-xl z-50 divide-y divide-gray-100 dark:divide-gray-800"
    >
      {isLoading ? (
        <div className="px-4 py-3 text-xs text-gray-500 flex items-center justify-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Searching backend records...</span>
        </div>
      ) : options.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 text-center font-medium">
          {emptyMessage}
        </div>
      ) : (
        options.map((opt, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={opt.id || idx}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(opt);
              }}
              className={`px-3 py-2 cursor-pointer transition flex items-center justify-between text-xs ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-cyan-200 font-semibold"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 text-gray-600 dark:text-gray-300">
                  {opt.iconType === "customer" ? (
                    <User size={13} />
                  ) : opt.iconType === "product" ? (
                    <Package size={13} />
                  ) : (
                    <Tag size={13} />
                  )}
                </div>

                <div className="min-w-0 truncate">
                  <div className="font-bold truncate flex items-center gap-1.5">
                    <span>{opt.title}</span>
                    {opt.metadata?.code && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                        {opt.metadata.code}
                      </span>
                    )}
                  </div>
                  {opt.subtitle && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {opt.subtitle}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                {opt.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    opt.badgeColor || "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  }`}>
                    {opt.badge}
                  </span>
                )}
                {isSelected && <Check size={13} className="text-blue-600 dark:text-cyan-400" />}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
export { SmritiTypeaheadDropdown as TypeaheadDrop };
