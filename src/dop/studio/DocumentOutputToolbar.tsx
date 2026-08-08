/**
 * Project      : SMRITI Retail OS
 * Component    : DocumentOutputToolbar (DXP-DOC-001 Standard)
 * Description  : Output channel execution bar (PRINT, PDF, EMAIL, WHATSAPP)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React from "react";
import { Printer, Download, Send, Clock, CheckCircle2, ShieldCheck } from "lucide-react";
import { RegisteredDocumentDescriptor } from "../core/DocumentRegistry.ts";
import { DxpOutputChannel } from "../models/DxpTypes.ts";

interface DocumentOutputToolbarProps {
  descriptor: RegisteredDocumentDescriptor;
  outputStatus: string | null;
  onExecuteChannel: (channel: DxpOutputChannel) => void;
  onViewSpoolLogs: () => void;
}

export const DocumentOutputToolbar: React.FC<DocumentOutputToolbarProps> = ({
  descriptor,
  outputStatus,
  onExecuteChannel,
  onViewSpoolLogs,
}) => {
  return (
    <div className="h-14 border-b border-theme-divider bg-theme-surface-1 flex justify-between items-center px-6 shrink-0 z-10 shadow-sm font-sans">
      <div className="flex items-center gap-3">
        <span className="px-2.5 py-1 text-xs font-bold font-mono tracking-wider uppercase bg-theme-surface-3 rounded border border-theme-divider text-theme-muted">
          {descriptor.format || "A4"} FORMAT
        </span>
        <span className="text-xs font-semibold text-theme-primary">{descriptor.title}</span>
        {descriptor.requiresSecuritySignature && (
          <span className="text-[10px] text-blue-400 font-mono flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
            <ShieldCheck size={12} /> SECURE SIGNED
          </span>
        )}
        {outputStatus && (
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20">
            <CheckCircle2 size={13} /> {outputStatus}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onViewSpoolLogs}
          className="flex items-center gap-2 px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider text-theme-primary rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
        >
          <Clock size={14} className="text-theme-muted" /> Spool Logs
        </button>

        {descriptor.supportedChannels.includes("PDF") && (
          <button
            onClick={() => onExecuteChannel("PDF")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-primary rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Download size={14} /> PDF
          </button>
        )}

        {descriptor.supportedChannels.includes("EMAIL") && (
          <button
            onClick={() => onExecuteChannel("EMAIL")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-primary rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Send size={14} /> Email
          </button>
        )}

        {descriptor.supportedChannels.includes("PRINT") && (
          <button
            onClick={() => onExecuteChannel("PRINT")}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Printer size={14} /> Print Document
          </button>
        )}
      </div>
    </div>
  );
};
