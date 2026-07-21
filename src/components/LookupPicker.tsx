/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.1.0
 * Created      : 2026-07-21
 * Modified     : 2026-07-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal Architecture Standard
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetchV1 } from '../lib/apiFetchV1';

export interface LookupValue {
  id: string;
  master_type_id: string;
  code: string;
  name: string;
  parent_value_id?: string;
  supersedes_id?: string;
  data: Record<string, any>;
  active: boolean;
  sort_order: number;
}

export interface LookupPickerProps {
  typeCode: string;
  value?: string;
  onChange: (val: LookupValue | null) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  allowInlineCreate?: boolean;
}

export const LookupPicker: React.FC<LookupPickerProps> = ({
  typeCode,
  value,
  onChange,
  placeholder = "Select value... (F2 to search, Ctrl+N for quick add)",
  label,
  disabled = false,
  className = "",
  allowInlineCreate = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LookupValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showInlineModal, setShowInlineModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch lookups from FastAPI backend
  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await apiFetchV1<LookupValue[]>(`/api/v1/master-lookups/values/${typeCode}?active_only=true`);
      if (res && Array.isArray(res)) {
        setItems(res);
      }
    } catch (err) {
      console.warn(`[LookupPicker] Error fetching lookups for '${typeCode}':`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeCode) {
      fetchItems();
    }
  }, [typeCode]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (it) => it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q)
    );
  }, [items, query]);

  const selectedItem = useMemo(() => {
    return items.find((it) => it.code === value || it.id === value) || null;
  }, [items, value]);

  // Global & local keyboard shortcuts (F2, Ctrl+F, Ctrl+N, Arrow keys, Enter, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      if (e.key === "F2" || (e.ctrlKey && e.key.toLowerCase() === "f")) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.ctrlKey && e.key.toLowerCase() === "n" && allowInlineCreate) {
        e.preventDefault();
        setShowInlineModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, allowInlineCreate]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const handleSelect = (item: LookupValue) => {
    onChange(item);
    setIsOpen(false);
  };

  const handleCreateNew = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    setCreating(true);
    try {
      const created = await apiFetchV1<LookupValue>(`/api/v1/master-lookups/values/${typeCode}`, {
        method: "POST",
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          name: newName.trim(),
          active: true
        })
      });
      if (created) {
        await fetchItems();
        onChange(created);
        setShowInlineModal(false);
        setNewCode("");
        setNewName("");
      }
    } catch (err) {
      alert(`Error creating lookup: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</label>}

      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`flex items-center justify-between px-3 py-2 border rounded-md cursor-pointer transition-all bg-white dark:bg-slate-900 ${
          isOpen ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900" : "border-slate-300 dark:border-slate-700"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-slate-400"}`}
      >
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {selectedItem ? `${selectedItem.name} (${selectedItem.code})` : placeholder}
        </span>
        <span className="text-xs text-slate-400 font-mono ml-2">F2</span>
      </div>

      {/* Dropdown overlay */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-indigo-500 dark:text-slate-100"
              placeholder="Filter lookup values..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleInputKeyDown}
            />
            {allowInlineCreate && (
              <button
                type="button"
                onClick={() => setShowInlineModal(true)}
                title="Quick Add (Ctrl+N)"
                className="px-2.5 py-1.5 text-xs bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 shrink-0"
              >
                + Add
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <div className="p-4 text-center text-xs text-slate-400">Loading...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">No lookup entries found.</div>
            ) : (
              filteredItems.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`px-3 py-2 text-sm cursor-pointer flex justify-between items-center transition-colors ${
                    idx === selectedIndex ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-200 font-semibold" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span>{item.name}</span>
                  <span className="text-xs font-mono text-slate-400">{item.code}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Inline Create Modal (Ctrl+N) */}
      {showInlineModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              Quick Add Lookup — <span className="text-indigo-600 dark:text-indigo-400">{typeCode.toUpperCase()}</span>
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Code</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg dark:text-slate-100"
                  placeholder="e.g., UPI_HDFC"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg dark:text-slate-100"
                  placeholder="e.g., UPI HDFC Merchant"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowInlineModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating || !newCode || !newName}
                onClick={handleCreateNew}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
