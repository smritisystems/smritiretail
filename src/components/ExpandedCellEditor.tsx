/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-07-25
 * Modified     : 2026-07-25
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * ExpandedCellEditor â€” Universal floating cell expand panel for SMRITI data grids.
 * Mirrors the Microsoft Excel "F2 expand" UX. Renders as a fixed floating panel
 * anchored to the viewport bottom-right so the grid stays fully visible.
 *
 * Usage:
 *   <ExpandedCellEditor
 *     isOpen={!!expandedCell}
 *     rowIndex={expandedCell?.rowIndex ?? 0}
 *     fieldKey={expandedCell?.field ?? ""}
 *     fieldLabel={expandedCell?.label ?? ""}
 *     value={expandedCell?.value ?? ""}
 *     onConfirm={(newValue) => handleExpandConfirm(newValue)}
 *     onClose={() => setExpandedCell(null)}
 *   />
 *
 * Keyboard shortcuts (when panel is open):
 *   Ctrl+Enter   â€” Confirm & close
 *   Escape       â€” Cancel & close
 *   Ctrl+F       â€” Focus search bar
 *   Ctrl+A       â€” Select all in textarea
 *   Ctrl+C/V     â€” Native copy/paste
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  X,
  Check,
  Copy,
  Search,
  Trash2,
  Maximize2,
  ChevronUp,
  ChevronDown,
  Keyboard,
} from "lucide-react";

/* â”€â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export interface ExpandedCellEditorProps {
  isOpen?: boolean;
  rowIndex: number;
  fieldKey?: string;
  field?: string;
  fieldLabel?: string;
  label?: string;
  value: string;
  onConfirm: (newValue: string) => void | Promise<void>;
  onClose: () => void;
}

/* â”€â”€â”€ Search match highlight â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function buildHighlightedSegments(
  text: string,
  query: string
): Array<{ text: string; match: boolean }> {
  if (!query.trim()) return [{ text, match: false }];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "gi");
  const segments: Array<{ text: string; match: boolean }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), match: false });
    segments.push({ text: m[0], match: true });
    last = re.lastIndex;
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false });
  return segments;
}

/* â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const ExpandedCellEditor: React.FC<ExpandedCellEditorProps> = ({
  isOpen = true,
  rowIndex,
  fieldKey,
  field,
  fieldLabel,
  label,
  value,
  onConfirm,
  onClose,
}) => {
  const actualFieldKey = fieldKey || field || "";
  const actualFieldLabel = fieldLabel || label || actualFieldKey;
  const [draft, setDraft] = useState(value);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Sync draft when value/panel changes */
  useEffect(() => {
    if (isOpen) {
      setDraft(value);
      setSearchQuery("");
      setMatchIndex(0);
      setCopied(false);
      setShowShortcuts(false);
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
  }, [isOpen, value, fieldKey, rowIndex]);

  /* Global keyboard handler */
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Enter" && e.ctrlKey) { handleConfirm(); return; }
      if (e.key === "f" && e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, draft]);

  const handleConfirm = useCallback(() => {
    onConfirm(draft);
    onClose();
  }, [draft, onConfirm, onClose]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [draft]);

  const handleClear = useCallback(() => {
    setDraft("");
    textareaRef.current?.focus();
  }, []);

  /* Search match count */
  const matchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (draft.match(new RegExp(escaped, "gi")) || []).length;
  }, [draft, searchQuery]);

  const cycleMatch = (direction: "prev" | "next") => {
    if (!matchCount) return;
    setMatchIndex((i) =>
      direction === "next"
        ? (i + 1) % matchCount
        : (i - 1 + matchCount) % matchCount
    );
  };

  const segments = useMemo(
    () => buildHighlightedSegments(draft, searchQuery),
    [draft, searchQuery]
  );

  if (!isOpen) return null;

  /* â”€â”€ Panel size classes â”€â”€ */
  const panelClass = isFullscreen
    ? "fixed inset-4 z-[9999] flex flex-col"
    : "fixed bottom-4 right-4 z-[9999] flex flex-col w-[580px] h-[420px]";

  return (
    <>
      {/* Backdrop â€” semi-transparent, clicking it closes */}
      <div
        className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`${panelClass} rounded-2xl shadow-2xl border border-indigo-500/40 bg-theme-surface-1 overflow-hidden`}
        style={{
          animation: "smriti-expand-slide-in 180ms cubic-bezier(0.16,1,0.3,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Expanded cell editor â€” ${fieldLabel}, row ${rowIndex + 1}`}
        aria-modal="true"
      >
        {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex items-center justify-between px-4 py-3 bg-theme-surface-1 border-b border-indigo-500/20 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Maximize2 size={14} className="text-indigo-400" />
            <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest font-mono">
              Expand Cell
            </span>
            <span className="bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono px-2 py-0.5 rounded-full">
              {fieldLabel}
            </span>
            <span className="text-[10px] text-theme-muted font-mono">
              Row {rowIndex + 1} Â· {fieldKey}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Shortcuts toggle */}
            <button
              onClick={() => setShowShortcuts((s) => !s)}
              title="Keyboard shortcuts"
              className="p-1.5 rounded-lg text-theme-muted hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
            >
              <Keyboard size={13} />
            </button>
            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen((f) => !f)}
              title={isFullscreen ? "Restore size" : "Fullscreen"}
              className="p-1.5 rounded-lg text-theme-muted hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
            >
              <Maximize2 size={13} />
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 rounded-lg text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* â”€â”€ Shortcuts hint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {showShortcuts && (
          <div className="px-4 py-2.5 bg-indigo-950/30 border-b border-indigo-500/10 flex flex-wrap gap-3 text-[10px] font-mono text-theme-muted flex-shrink-0">
            {[
              ["Ctrl+Enter", "Confirm"],
              ["Escape", "Cancel"],
              ["Ctrl+F", "Search"],
              ["Ctrl+A", "Select All"],
              ["Ctrl+C", "Copy"],
            ].map(([key, desc]) => (
              <span key={key} className="flex items-center gap-1">
                <kbd className="bg-theme-surface-3 border border-theme-divider rounded px-1.5 py-0.5 text-[9px] text-theme-body">
                  {key}
                </kbd>
                <span>{desc}</span>
              </span>
            ))}
          </div>
        )}

        {/* â”€â”€ Search bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex items-center gap-2 px-3 py-2 bg-theme-surface-2 border-b border-theme-divider flex-shrink-0">
          <Search size={12} className="text-theme-muted flex-shrink-0" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setMatchIndex(0); }}
            placeholder="Search within cell contentâ€¦ (Ctrl+F)"
            className="flex-1 bg-transparent text-[11px] font-mono text-theme-body placeholder-theme-muted outline-none"
          />
          {searchQuery && (
            <span className="text-[10px] font-mono text-theme-muted flex-shrink-0">
              {matchCount > 0 ? `${matchIndex + 1}/${matchCount}` : "No match"}
            </span>
          )}
          {searchQuery && matchCount > 0 && (
            <>
              <button
                onClick={() => cycleMatch("prev")}
                className="p-0.5 rounded text-theme-muted hover:text-theme-heading transition-colors"
                title="Previous match"
              >
                <ChevronUp size={12} />
              </button>
              <button
                onClick={() => cycleMatch("next")}
                className="p-0.5 rounded text-theme-muted hover:text-theme-heading transition-colors"
                title="Next match"
              >
                <ChevronDown size={12} />
              </button>
            </>
          )}
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setMatchIndex(0); }}
              className="p-0.5 rounded text-theme-muted hover:text-theme-heading transition-colors"
              title="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* â”€â”€ Textarea / Preview pane â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex-1 relative overflow-hidden">
          {/* Highlight overlay (read-only, pointer-events-none) */}
          {searchQuery && (
            <div
              aria-hidden="true"
              className="absolute inset-0 p-3 text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words overflow-auto pointer-events-none select-none z-10"
              style={{ color: "transparent" }}
            >
              {segments.map((seg, i) =>
                seg.match ? (
                  <mark
                    key={i}
                    className="bg-amber-400/40 rounded-sm"
                    style={{ color: "transparent" }}
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                )
              )}
            </div>
          )}

          {/* Editable textarea */}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="absolute inset-0 w-full h-full resize-none bg-transparent border-0 outline-none p-3 text-[12px] font-mono leading-relaxed text-theme-heading placeholder-theme-muted z-20"
            placeholder={`Enter value for ${fieldLabel}â€¦`}
            style={{ caretColor: "#818cf8" }}
          />
        </div>

        {/* â”€â”€ Character / word count bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="px-4 py-1.5 bg-theme-surface-2 border-t border-theme-divider flex items-center justify-between flex-shrink-0">
          <span className="text-[10px] font-mono text-theme-muted">
            {draft.length} chars
            {draft.trim() && ` Â· ${draft.trim().split(/\s+/).length} words`}
            {draft !== value && (
              <span className="ml-2 text-amber-400/80">â— modified</span>
            )}
          </span>
          {searchQuery && matchCount > 0 && (
            <span className="text-[10px] font-mono text-amber-400/70">
              {matchCount} match{matchCount !== 1 ? "es" : ""}
            </span>
          )}
        </div>

        {/* â”€â”€ Footer toolbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex items-center justify-between px-4 py-3 bg-theme-surface-1 border-t border-indigo-500/15 flex-shrink-0 gap-2">
          {/* Left: destructive actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              title="Copy full content to clipboard"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-body hover:text-theme-heading border border-theme-divider transition-all"
            >
              <Copy size={11} />
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleClear}
              title="Clear cell content"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded-lg bg-theme-surface-3 hover:bg-rose-900/40 text-theme-muted hover:text-rose-300 border border-theme-divider hover:border-rose-700/50 transition-all"
            >
              <Trash2 size={11} />
              Clear
            </button>
          </div>

          {/* Right: primary actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-[11px] font-mono rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted hover:text-white border border-theme-divider transition-all"
            >
              Cancel <span className="text-[9px] opacity-50 ml-1">Esc</span>
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-mono font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/60 shadow-lg shadow-indigo-900/40 transition-all"
            >
              <Check size={11} />
              Confirm
              <span className="text-[9px] opacity-60 ml-1">Ctrl+â†µ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Slide-in animation keyframe */}
      <style>{`
        @keyframes smriti-expand-slide-in {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
        @keyframes smriti-context-fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
};

/* â”€â”€â”€ Context Menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export interface ExpandContextMenuProps {
  x: number;
  y: number;
  onExpand: () => void;
  onCopy?: () => void;
  onClear?: () => void;
  onClose: () => void;
}

export const ExpandContextMenu: React.FC<ExpandContextMenuProps> = ({
  x, y, onExpand, onCopy, onClear, onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const closeKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeKey);
    };
  }, [onClose]);

  /* Clamp to viewport */
  const safeX = Math.min(x, window.innerWidth - 220);
  const safeY = Math.min(y, window.innerHeight - 160);

  const items = [
    {
      icon: "â¤¢",
      label: "Expand Cell",
      sub: "F2 / Ctrl+Shift+E",
      action: () => { onExpand(); onClose(); },
      highlight: true,
    },
    {
      icon: "âŽ˜",
      label: "Copy Cell Value",
      sub: "Ctrl+C",
      action: () => { onCopy ? onCopy() : undefined; onClose(); },
    },
    {
      icon: "âœ•",
      label: "Clear Cell",
      sub: "Delete",
      action: () => { onClear ? onClear() : undefined; onClose(); },
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Cell context menu"
      className="fixed z-[10000] w-52 rounded-xl shadow-2xl border border-theme-divider bg-theme-surface-1 overflow-hidden py-1"
      style={{
        left: safeX,
        top: safeY,
        animation: "smriti-context-fade-in 100ms ease both",
      }}
    >
      <div className="px-3 py-1.5 text-[9px] font-mono text-theme-muted uppercase tracking-widest border-b border-theme-divider mb-1">
        Cell Actions
      </div>
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          onClick={item.action}
          className={`w-full text-left flex items-center justify-between px-3 py-2 text-[11px] font-mono transition-colors ${
            item.highlight
              ? "text-indigo-300 hover:bg-indigo-600/20"
              : item.danger
              ? "text-theme-muted hover:text-rose-400 hover:bg-rose-900/20"
              : "text-theme-body hover:bg-theme-surface-2"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="text-[13px] w-4 text-center">{item.icon}</span>
            {item.label}
          </span>
          <span className="text-[9px] text-theme-muted">{item.sub}</span>
        </button>
      ))}
      <style>{`
        @keyframes smriti-context-fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ExpandedCellEditor;
