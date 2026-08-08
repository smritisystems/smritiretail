import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetchV1 } from '../lib/apiFetchV1.js';
import { SPK, NormalizedLookupItem, LookupManifest, PlatformSavedView } from '../kernel/SPK.js';
import { Search, X, Star, Clock, Filter, Check, ChevronRight, Maximize2, Plus } from 'lucide-react';
import { UniversalLookupRenderer } from './common/renderers/ILookupRenderer.tsx';

export interface LookupValue {
  id: string;
  master_type_id?: string;
  code: string;
  name: string;
  parent_value_id?: string;
  supersedes_id?: string;
  data?: Record<string, any>;
  active?: boolean;
  sort_order?: number;
  badge?: string;
  metadata?: Record<string, any>;
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
  mode?: "inline" | "modal";
  onCloseModal?: () => void;
}

export const LookupPicker: React.FC<LookupPickerProps> = ({
  typeCode,
  value,
  onChange,
  placeholder = "Select value... (F2 for discovery, Ctrl+N for quick add)",
  label,
  disabled = false,
  className = "",
  allowInlineCreate = true,
  mode = "inline",
  onCloseModal,
}) => {
  const [isOpen, setIsOpen] = useState(mode === "modal");
  const [isModalDiscovery, setIsModalDiscovery] = useState(mode === "modal");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LookupValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showInlineModal, setShowInlineModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [executionTimeMs, setExecutionTimeMs] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ULE Manifest resolution
  const manifest: LookupManifest | undefined = useMemo(() => {
    return SPK.ule.getManifest(typeCode);
  }, [typeCode]);

  const savedViews: PlatformSavedView[] = useMemo(() => {
    return SPK.ule.getSavedViews(typeCode);
  }, [typeCode]);

  const history = useMemo(() => {
    return SPK.ule.getHistory(typeCode);
  }, [typeCode]);

  // Primary ULE Search Execution
  const fetchItems = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      // 1. Attempt kernel SPK.ule search
      const uleResult = await SPK.ule.searchAdvanced({
        domain: typeCode,
        query,
        filters: activeFilters,
        limit: 50,
      });

      if (uleResult.items && uleResult.items.length > 0) {
        const mapped: LookupValue[] = uleResult.items.map((it: NormalizedLookupItem) => ({
          id: it.id,
          code: (it as any).code || it.id,
          name: it.title || (it as any).name || it.id,
          badge: typeof it.badge === "string" ? it.badge : it.badge?.label,
          metadata: it.metadata,
        }));
        setItems(mapped);
        setExecutionTimeMs(uleResult.executionTimeMs || Math.round(performance.now() - start));
        return;
      }

      // 2. Fallback to SPK.ule.search simple
      const simpleUle = await SPK.ule.search(typeCode, query);
      if (simpleUle && simpleUle.length > 0) {
        const mapped: LookupValue[] = simpleUle.map((it) => ({
          id: it.id,
          code: it.code || it.id,
          name: it.name || it.id,
          badge: typeof it.badge === "string" ? it.badge : it.badge?.label,
          metadata: it.metadata,
        }));
        setItems(mapped);
        setExecutionTimeMs(Math.round(performance.now() - start));
        return;
      }

      // 3. Fallback to API lookup endpoint
      const res = await apiFetchV1<LookupValue[]>(`/api/v1/master-lookups/values/${typeCode}?active_only=true`);
      if (res && Array.isArray(res)) {
        setItems(res);
      } else {
        setItems([]);
      }
      setExecutionTimeMs(Math.round(performance.now() - start));
    } catch (err) {
      console.warn(`[LookupPicker/ULE] Error fetching lookups for '${typeCode}':`, err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeCode) {
      fetchItems();
    }
  }, [typeCode, query, activeFilters]);

  useEffect(() => {
    setIsModalDiscovery(mode === "modal");
    if (mode === "modal") {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [mode]);

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

  // Global & local keyboard shortcuts (SCS-UIX Lookup Rule-001: F2, Ctrl+F2, Ctrl+F, Ctrl+N, Arrow keys, Enter, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      const activeEl = document.activeElement;
      const isCurrentInput = inputRef.current && (activeEl === inputRef.current || containerRef.current?.contains(activeEl));

      // Rule 1 & 2 & 4: F2 on empty or text field opens lookup dialog
      if (e.key === "F2" || (e.ctrlKey && e.key.toLowerCase() === "f")) {
        e.preventDefault();
        setIsModalDiscovery(true);
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === "F3" && allowInlineCreate && isCurrentInput) {
        e.preventDefault();
        setShowInlineModal(true);
      } else if (e.ctrlKey && e.key.toLowerCase() === "n" && allowInlineCreate) {
        e.preventDefault();
        setShowInlineModal(true);
      } else if (e.key === "Escape") {
        if (showInlineModal) {
          setShowInlineModal(false);
        } else if (isOpen) {
          setIsOpen(false);
          if (onCloseModal) onCloseModal();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, allowInlineCreate, isOpen, showInlineModal, onCloseModal]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "F2") {
      // SCS-UIX Lookup Rule-001: F2 always opens lookup dialog unconditionally
      e.preventDefault();
      setIsModalDiscovery(true);
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      if (onCloseModal) onCloseModal();
    }
  };

  const handleSelect = (item: LookupValue) => {
    onChange(item);
    setIsOpen(false);
    setIsModalDiscovery(false);
    if (onCloseModal) onCloseModal();
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

  // ── Render Universal Discovery Modal Mode ──
  if (isModalDiscovery && isOpen) {
    const modalTitle = manifest?.title || `${typeCode.toUpperCase()} Discovery`;
    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans">
        <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-4xl w-full h-[580px] shadow-2xl flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="p-4 bg-theme-surface-2 border-b border-theme-divider flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[var(--c-seef-accent)]/10 text-[var(--c-seef-accent)] border border-[var(--c-seef-accent)]/20">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-theme-heading text-sm">{modalTitle}</h3>
                  <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-[var(--c-seef-accent)]/10 text-[var(--c-seef-accent)] border border-[var(--c-seef-accent)]/30 uppercase font-mono">
                    SMRITI Discovery (F2)
                  </span>
                </div>
                <p className="text-[11px] text-theme-muted font-mono">SPK.ule Engine • Context Domain: {typeCode.toUpperCase()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-theme-muted bg-theme-surface-1 px-2 py-1 rounded border border-theme-divider">
                {executionTimeMs}ms
              </span>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsModalDiscovery(false);
                  if (onCloseModal) onCloseModal();
                }}
                className="p-1.5 rounded-lg text-theme-muted hover:text-theme-heading hover:bg-theme-surface-hover transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="p-3 bg-theme-surface-1 border-b border-theme-divider flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={`Search ${typeCode.toUpperCase()} by code, name, barcode… (F2 / Enter to select)`}
                className="w-full pl-9 pr-3 py-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-xl text-theme-heading placeholder:text-theme-muted focus:outline-none focus:border-[var(--c-seef-accent)] transition-all font-medium"
              />
            </div>
            {allowInlineCreate && (
              <button
                type="button"
                onClick={() => setShowInlineModal(true)}
                className="px-3 py-2 text-xs font-bold bg-[var(--c-seef-accent)] text-white rounded-xl hover:bg-[var(--c-seef-accent)]/90 transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Quick Add
              </button>
            )}
          </div>

          {/* Discovery Body (Left Facets | Right Results) */}
          <div className="flex-1 flex min-h-0">
            {/* Left Column: Saved Views & History */}
            <div className="w-60 border-r border-theme-divider bg-theme-surface-2 p-3 space-y-4 overflow-y-auto text-xs font-mono">
              <div>
                <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Saved Views
                </span>
                <div className="space-y-1">
                  {savedViews.length === 0 ? (
                    <span className="text-[10px] text-theme-muted italic block px-2">No saved views.</span>
                  ) : (
                    savedViews.map((sv) => (
                      <button
                        key={sv.id}
                        onClick={() => setActiveFilters(sv.filters)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-theme-heading hover:bg-theme-surface-hover transition-colors font-bold truncate block"
                      >
                        {sv.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {history.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-400" /> Recent Queries
                  </span>
                  <div className="space-y-1">
                    {history.slice(0, 5).map((h, i) => (
                      <button
                        key={i}
                        onClick={() => setQuery(h.query)}
                        className="w-full text-left px-2.5 py-1 rounded text-[11px] text-theme-muted hover:text-theme-heading hover:bg-theme-surface-hover transition-colors truncate block"
                      >
                        {h.query}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Discovery Results */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {loading ? (
                <div className="p-12 text-center text-xs text-theme-muted font-mono">
                  Loading {typeCode.toUpperCase()} discovery entries…
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-12 text-center text-xs text-theme-muted font-mono border border-dashed border-theme-divider rounded-xl">
                  No records found matching query.
                </div>
              ) : (
                <UniversalLookupRenderer
                  layout={manifest?.defaultLayout || "table"}
                  items={filteredItems.map((it) => ({
                    id: it.id,
                    title: it.name,
                    subtitle: it.code,
                    badge: it.badge ? { label: it.badge } : undefined,
                    columns: it.metadata || { code: it.code, name: it.name },
                    metadata: it.metadata || {}
                  }))}
                  columns={manifest?.defaultColumns}
                  selectedIndex={selectedIndex}
                  onSelect={(selected) => {
                    const raw = filteredItems.find((it) => it.id === selected.id);
                    if (raw) handleSelect(raw);
                  }}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-theme-surface-2 border-t border-theme-divider flex items-center justify-between text-[11px] font-mono text-theme-muted">
            <span>{filteredItems.length} records discovered</span>
            <span>↑ ↓ Navigate • Enter Select • Esc Close • Ctrl+N Add</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Render Standard Inline Input Mode ──
  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && <label className="block text-xs font-semibold text-theme-muted mb-1">{label}</label>}

      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`flex items-center justify-between px-3 py-2 border rounded-md cursor-pointer transition-all bg-theme-surface-1 ${
          isOpen ? "border-[var(--c-seef-accent)] ring-2 ring-[var(--c-seef-accent)]/20" : "border-theme-divider"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-theme-muted"}`}
      >
        <span className="text-sm font-medium text-theme-heading truncate">
          {selectedItem ? `${selectedItem.name} (${selectedItem.code})` : placeholder}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalDiscovery(true);
              setIsOpen(true);
            }}
            className="p-1 text-theme-muted hover:text-theme-heading transition-colors"
            title="Expand Universal Discovery (F2)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-theme-muted font-mono">F2</span>
        </div>
      </div>

      {/* Inline Dropdown overlay */}
      {isOpen && !isModalDiscovery && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-theme-surface-1 border border-theme-divider rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-theme-divider flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              className="w-full px-3 py-1.5 text-sm bg-theme-surface-2 border border-theme-divider rounded-md focus:outline-none focus:border-[var(--c-seef-accent)] text-theme-heading"
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
                className="px-2.5 py-1.5 text-xs bg-[var(--c-seef-accent)] text-white rounded font-medium hover:bg-[var(--c-seef-accent)]/90 shrink-0"
              >
                + Add
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-theme-divider">
            {loading ? (
              <div className="p-4 text-center text-xs text-theme-muted font-mono">Loading...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-4 text-center text-xs text-theme-muted font-mono">No lookup entries found.</div>
            ) : (
              filteredItems.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`px-3 py-2 text-sm cursor-pointer flex justify-between items-center transition-colors ${
                    idx === selectedIndex ? "bg-[var(--c-seef-accent)]/20 text-[var(--c-seef-accent)] font-semibold" : "hover:bg-theme-surface-2 text-theme-body"
                  }`}
                >
                  <span>{item.name}</span>
                  <span className="text-xs font-mono text-theme-muted">{item.code}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Inline Create Modal (Ctrl+N) */}
      {showInlineModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-theme-heading mb-4">
              Quick Add Lookup — <span className="text-[var(--c-seef-accent)]">{typeCode.toUpperCase()}</span>
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-theme-muted mb-1">Code</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading focus:outline-none focus:border-[var(--c-seef-accent)]"
                  placeholder="e.g., CODE_001"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-theme-muted mb-1">Display Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading focus:outline-none focus:border-[var(--c-seef-accent)]"
                  placeholder="e.g., Display Entry Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowInlineModal(false)}
                className="px-4 py-2 text-xs font-medium text-theme-muted hover:text-theme-heading"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating || !newCode || !newName}
                onClick={handleCreateNew}
                className="px-4 py-2 text-xs font-semibold bg-[var(--c-seef-accent)] text-white rounded-lg hover:bg-[var(--c-seef-accent)]/90 disabled:opacity-50 shadow-md"
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
