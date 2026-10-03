/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.45.2
 * Created      : 2026-09-27
 * Modified     : 2026-09-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { ShieldCheck } from "lucide-react";
import { APP_VERSION_LABEL } from "../../config/version";

interface SecurityFooterProps {
  className?: string;
}

export const SecurityFooter: React.FC<SecurityFooterProps> = ({ className = "" }) => {
  return (
    <footer
      className={`pt-3 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-500 font-medium ${className}`}
      aria-label="Security and system metadata"
    >
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">AES-256 Secure Authentication</span>
      </div>
      <span className="font-mono text-slate-500 shrink-0 ml-2">{APP_VERSION_LABEL}</span>
    </footer>
  );
};
