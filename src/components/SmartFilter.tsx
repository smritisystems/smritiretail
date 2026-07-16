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
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState } from 'react';
import { Filter, X, ChevronDown, Check, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type FilterType = 'date-range' | 'multi-select' | 'text';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDefinition {
  id: string;
  type: FilterType;
  label: string;
  options?: FilterOption[]; // For multi-select
  placeholder?: string;
}

export interface SmartFilterProps {
  filters: FilterDefinition[];
  onApply: (filterValues: Record<string, any>) => void;
  onClear?: () => void;
  initialValues?: Record<string, any>;
}

export const SmartFilter: React.FC<SmartFilterProps> = ({
  filters,
  onApply,
  onClear,
  initialValues = {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, any>>(initialValues);

  const handleApply = () => {
    onApply(filterValues);
    setIsOpen(false);
  };

  const handleClear = () => {
    setFilterValues({});
    if (onClear) onClear();
    else onApply({});
    setIsOpen(false);
  };

  const updateFilter = (id: string, value: any) => {
    setFilterValues(prev => ({ ...prev, [id]: value }));
  };

  const toggleMultiSelect = (id: string, value: string) => {
    setFilterValues(prev => {
      const current = prev[id] || [];
      const updated = current.includes(value) 
        ? current.filter((v: string) => v !== value)
        : [...current, value];
      return { ...prev, [id]: updated };
    });
  };

  const activeFilterCount = Object.keys(filterValues).filter(k => {
    const val = filterValues[k];
    if (Array.isArray(val)) return val.length > 0;
    if (val && typeof val === 'object') return val.start || val.end; // date range
    return val !== undefined && val !== '';
  }).length;

  return (
    <div className="relative inline-block text-left">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors border ${
          activeFilterCount > 0 
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
            : 'bg-theme-surface-1 border-theme-divider text-theme-body hover:bg-theme-surface-2'
        }`}
      >
        <Filter size={16} />
        Smart Filters
        {activeFilterCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-indigo-500 text-white text-[10px] rounded-full">
            {activeFilterCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/10"
              onClick={() => setIsOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-theme-surface-1 border border-theme-divider rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-3 border-b border-theme-divider flex justify-between items-center bg-theme-surface-2">
                <h3 className="font-bold text-sm text-theme-body flex items-center gap-2">
                  <Filter size={14} className="text-indigo-500" />
                  Filter Data
                </h3>
                <button onClick={() => setIsOpen(false)} className="text-theme-muted hover:text-theme-body">
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-5 overflow-y-auto flex-1">
                {filters.map(filter => (
                  <div key={filter.id} className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">
                      {filter.label}
                    </label>

                    {filter.type === 'text' && (
                      <input 
                        type="text"
                        placeholder={filter.placeholder || `Filter by ${filter.label}...`}
                        value={filterValues[filter.id] || ''}
                        onChange={(e) => updateFilter(filter.id, e.target.value)}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-indigo-500"
                      />
                    )}

                    {filter.type === 'date-range' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <input 
                            type="date"
                            value={filterValues[filter.id]?.start || ''}
                            onChange={(e) => updateFilter(filter.id, { ...filterValues[filter.id], start: e.target.value })}
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-8 pr-2 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                          />
                          <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                        </div>
                        <div className="relative">
                          <input 
                            type="date"
                            value={filterValues[filter.id]?.end || ''}
                            onChange={(e) => updateFilter(filter.id, { ...filterValues[filter.id], end: e.target.value })}
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-8 pr-2 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                          />
                          <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                        </div>
                      </div>
                    )}

                    {filter.type === 'multi-select' && (
                      <div className="border border-theme-divider rounded-lg bg-theme-surface-2 max-h-40 overflow-y-auto p-1">
                        {filter.options?.map(opt => {
                          const isSelected = (filterValues[filter.id] || []).includes(opt.value);
                          return (
                            <div 
                              key={opt.value}
                              onClick={() => toggleMultiSelect(filter.id, opt.value)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-theme-surface-hover rounded cursor-pointer text-sm"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isSelected 
                                  ? 'bg-indigo-500 border-indigo-500 text-white' 
                                  : 'border-theme-divider bg-theme-surface-1'
                              }`}>
                                {isSelected && <Check size={10} strokeWidth={3} />}
                              </div>
                              <span className={isSelected ? "font-medium text-theme-body" : "text-theme-muted"}>
                                {opt.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-theme-divider bg-theme-surface-2 flex gap-2">
                <button 
                  onClick={handleClear}
                  className="flex-1 px-4 py-2 bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg text-xs font-semibold hover:bg-theme-surface-hover transition-colors"
                >
                  Clear All
                </button>
                <button 
                  onClick={handleApply}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
