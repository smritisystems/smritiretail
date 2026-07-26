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
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 4.1.0 (SEDS Print Preview Dialog Component)
 * * Created    : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React from "react";
import { Printer, X, Play, Code, FileText, CheckCircle2 } from "lucide-react";
import { PrinterSelector } from "./PrinterSelector";

export interface PrintPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPrint: () => Promise<void>;
  title?: string;
  previewType?: "prn" | "pdf" | "html";
  prnContent?: string;
  pdfUrl?: string;
  htmlContent?: string;
}

export const PrintPreviewDialog: React.FC<PrintPreviewDialogProps> = ({
  isOpen,
  onClose,
  onConfirmPrint,
  title = "Print Preview & Hardware Dispatch",
  previewType = "prn",
  prnContent = "",
  pdfUrl = "",
  htmlContent = ""
}) => {
  const [printing, setPrinting] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecutePrint = async () => {
    setPrinting(true);
    setSuccessMsg(null);
    try {
      await onConfirmPrint();
      setSuccessMsg("Print job dispatched to hardware queue successfully.");
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (e: any) {
      console.error("Print execution failed:", e);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-3xl w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-theme-surface-2 px-6 py-4 border-b border-theme-divider flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-theme-heading font-display">{title}</h3>
              <p className="text-[11px] text-theme-muted">Verify content and hardware output printer before printing</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 text-theme-muted hover:text-theme-heading rounded-lg hover:bg-theme-surface-hover border border-theme-divider">
            <X size={16} />
          </button>
        </div>

        {/* Body Container */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Printer Selector Component */}
          <PrinterSelector />

          {/* Preview Panel */}
          <div className="border border-theme-divider rounded-xl bg-theme-surface-3 p-4 overflow-hidden">
            <div className="flex items-center justify-between border-b border-theme-divider pb-2 mb-3 text-xs font-bold text-theme-muted uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                {previewType === "prn" ? <Code size={14} /> : <FileText size={14} />}
                <span>{previewType === "prn" ? "PRN / ZPL Script View" : "Document Render Preview"}</span>
              </span>
            </div>

            {previewType === "prn" && (
              <pre className="font-mono text-[11px] text-emerald-400 bg-black/60 p-3 rounded-lg overflow-x-auto max-h-60 whitespace-pre-wrap select-text">
                {prnContent || "^XA\n^FO30,30^A0N,30,30^FDSMRITI PRN TEST^FS\n^XZ"}
              </pre>
            )}

            {previewType === "pdf" && (
              <iframe
                src={pdfUrl}
                className="w-full h-72 rounded-lg border border-theme-divider bg-white"
                title="PDF Print Preview"
              />
            )}

            {previewType === "html" && (
              <div
                className="w-full h-72 rounded-lg border border-theme-divider bg-white p-4 overflow-y-auto text-black"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            )}
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-theme-surface-2 px-6 py-4 border-t border-theme-divider flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider rounded-xl text-xs font-bold text-theme-body transition-all"
          >
            Cancel
          </button>

          <button
            onClick={handleExecutePrint}
            disabled={printing}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Play size={14} className={printing ? "animate-spin" : ""} />
            <span>{printing ? "Transmitting..." : "Send to Hardware Printer"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
