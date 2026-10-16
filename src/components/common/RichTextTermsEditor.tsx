/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.85.0
 * Created      : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Supplier Commercial Terms Rich Text Paragraph Editor
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  Edit3,
  FileText,
  RotateCcw,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  sanitizeTermsHtml,
  cleanWordHtml,
  hasHtmlTags,
  STANDARD_COMMERCIAL_TERMS_HTML,
} from "../../utils/sanitizeTermsHtml";
import { SafeRichTermsRenderer } from "./SafeRichTermsRenderer";

export interface RichTextTermsEditorProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
}

export const RichTextTermsEditor: React.FC<RichTextTermsEditorProps> = ({
  value = "",
  onChange,
  disabled = false,
  placeholder = "Enter supplier-specific commercial terms, credit agreements, inspection clauses, and statutory conditions...",
  minHeight = "200px",
}) => {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);

  // Normalize initial value to valid HTML if plain text
  const getInitialHtml = useCallback((val?: string): string => {
    if (!val || !val.trim()) return "";
    if (hasHtmlTags(val)) {
      return sanitizeTermsHtml(val);
    }
    // Convert plain text newlines to paragraphs
    const paragraphs = val
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (paragraphs.length <= 1) {
      return `<p>${val.replace(/\n/g, "<br/>")}</p>`;
    }
    return paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("");
  }, []);

  // Sync external value changes to contenteditable innerHTML when not focused
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (editorRef.current) {
      const formatted = getInitialHtml(value);
      if (editorRef.current.innerHTML !== formatted) {
        editorRef.current.innerHTML = formatted;
      }
    }
  }, [value, getInitialHtml]);

  // Execute formatting commands
  const executeCommand = (command: string, arg?: string) => {
    if (disabled) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, arg);
    handleEditorInput();
  };

  // Handle input events in the editor
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const rawHtml = editorRef.current.innerHTML;
    const sanitized = sanitizeTermsHtml(rawHtml);
    isInternalUpdate.current = true;
    onChange(sanitized);
  };

  // Handle paste from Word or external sources
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();

    const clipboardData = e.clipboardData;
    const htmlData = clipboardData.getData("text/html");
    const textData = clipboardData.getData("text/plain");

    let cleanToInsert = "";

    if (htmlData && htmlData.trim()) {
      cleanToInsert = cleanWordHtml(htmlData);
      cleanToInsert = sanitizeTermsHtml(cleanToInsert);
    } else if (textData && textData.trim()) {
      // Split plain text by double newlines into paragraphs
      const paras = textData.split(/\r?\n\r?\n/).map((p) => p.trim()).filter(Boolean);
      if (paras.length > 1) {
        cleanToInsert = paras.map((p) => `<p>${p.replace(/\r?\n/g, "<br/>")}</p>`).join("");
      } else {
        cleanToInsert = textData.replace(/\r?\n/g, "<br/>");
      }
    }

    if (cleanToInsert) {
      document.execCommand("insertHTML", false, cleanToInsert);
      handleEditorInput();
    }
  };

  // Standard terms insertion with confirmation
  const handleInsertStandardTermsClick = () => {
    if (disabled) return;
    const current = (value || "").trim();
    if (current && current !== "<p></p>" && current !== "<p><br></p>") {
      setShowConfirmModal(true);
    } else {
      applyStandardTerms();
    }
  };

  const applyStandardTerms = () => {
    const standardHtml = STANDARD_COMMERCIAL_TERMS_HTML;
    if (editorRef.current) {
      editorRef.current.innerHTML = standardHtml;
    }
    onChange(standardHtml);
    setShowConfirmModal(false);
  };

  // Word & character stats
  const cleanText = (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const charCount = cleanText.length;
  const wordCount = cleanText ? cleanText.split(" ").length : 0;

  return (
    <div className="w-full flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
      {/* ── 1. Modern Toolbar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 text-xs">
        {/* Left Formatting Group */}
        <div className="flex flex-wrap items-center gap-1">
          {/* Heading / Paragraph Selector */}
          <select
            disabled={disabled || activeTab === "preview"}
            onChange={(e) => {
              const val = e.target.value;
              executeCommand("formatBlock", val);
              e.target.value = "";
            }}
            defaultValue=""
            className="h-7 text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 outline-none focus:border-indigo-500 disabled:opacity-50"
            title="Text Style"
          >
            <option value="" disabled>Style</option>
            <option value="<p>">Normal Paragraph</option>
            <option value="<h3>">Heading (Clause)</option>
            <option value="<h4>">Sub-Heading</option>
          </select>

          <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Bold */}
          <button
            type="button"
            disabled={disabled || activeTab === "preview"}
            onClick={() => executeCommand("bold")}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 transition"
            title="Bold (Ctrl+B)"
          >
            <Bold size={14} />
          </button>

          {/* Italic */}
          <button
            type="button"
            disabled={disabled || activeTab === "preview"}
            onClick={() => executeCommand("italic")}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 italic disabled:opacity-40 transition"
            title="Italic (Ctrl+I)"
          >
            <Italic size={14} />
          </button>

          <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Ordered / Numbered List */}
          <button
            type="button"
            disabled={disabled || activeTab === "preview"}
            onClick={() => executeCommand("insertOrderedList")}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition"
            title="Numbered List"
          >
            <ListOrdered size={14} />
          </button>

          {/* Unordered / Bulleted List */}
          <button
            type="button"
            disabled={disabled || activeTab === "preview"}
            onClick={() => executeCommand("insertUnorderedList")}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition"
            title="Bulleted List"
          >
            <List size={14} />
          </button>

          <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Alignment */}
          <button
            type="button"
            disabled={disabled || activeTab === "preview"}
            onClick={() => executeCommand("justifyLeft")}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition"
            title="Align Left"
          >
            <AlignLeft size={14} />
          </button>
          <button
            type="button"
            disabled={disabled || activeTab === "preview"}
            onClick={() => executeCommand("justifyCenter")}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition"
            title="Align Center"
          >
            <AlignCenter size={14} />
          </button>
          <button
            type="button"
            disabled={disabled || activeTab === "preview"}
            onClick={() => executeCommand("justifyRight")}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition"
            title="Align Right"
          >
            <AlignRight size={14} />
          </button>

          <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Insert Standard Terms Action */}
          <button
            type="button"
            disabled={disabled}
            onClick={handleInsertStandardTermsClick}
            className="h-7 px-2.5 flex items-center gap-1.5 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] border border-indigo-200 dark:border-indigo-800 disabled:opacity-40 transition shadow-2xs"
            title="Insert standard SMRITI 120-day commercial terms template"
          >
            <FileText size={13} />
            <span>Insert Standard Terms</span>
          </button>
        </div>

        {/* Right Mode Toggle & Actions */}
        <div className="flex items-center gap-1">
          {/* Mode Switcher: Edit vs Preview */}
          <div className="flex rounded-md p-0.5 bg-slate-200 dark:bg-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition ${
                activeTab === "edit"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Edit3 size={12} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition ${
                activeTab === "preview"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Editor Canvas / Preview ────────────────────────────────────── */}
      <div className="relative p-3.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm leading-relaxed overflow-y-auto" style={{ minHeight }}>
        {activeTab === "edit" ? (
          <div
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleEditorInput}
            onPaste={handlePaste}
            onBlur={handleEditorInput}
            className={`w-full h-full min-h-[160px] outline-none space-y-2 rich-terms-editor focus:ring-0 ${
              disabled ? "opacity-60 cursor-not-allowed" : ""
            }`}
            data-placeholder={placeholder}
          />
        ) : (
          <div className="min-h-[160px] p-2 bg-slate-50/70 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-[13px]">
            {value && value.trim() ? (
              <SafeRichTermsRenderer content={value} />
            ) : (
              <p className="italic text-slate-400">No commercial terms configured for this supplier.</p>
            )}
          </div>
        )}
      </div>

      {/* ── 3. Footer Stats & Formatting Guide ───────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 text-[10.5px] text-slate-400">
        <div className="flex items-center gap-1">
          <HelpCircle size={12} className="text-slate-400" />
          <span>Supports headings, lists, bold, and clean Word formatting. Prints verbatim on PO documents.</span>
        </div>
        <div className="font-mono text-slate-500">
          {wordCount} words • {charCount} chars
        </div>
      </div>

      {/* ── Confirmation Modal for Standard Terms Insertion ──────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                <AlertCircle size={22} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  Replace Existing Commercial Terms?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  This supplier currently has custom terms configured. Inserting the SMRITI Standard Terms template will replace the current content.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Keep Current Terms
              </button>
              <button
                type="button"
                onClick={applyStandardTerms}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-xs transition"
              >
                Insert Standard Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
