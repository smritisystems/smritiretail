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

interface SmritiBrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
}

export const SmritiBrandLogo: React.FC<SmritiBrandLogoProps> = ({
  size = "md",
  showTagline = true,
  className = "",
}) => {
  const isSm = size === "sm";
  const isMd = size === "md";
  const isLg = size === "lg";

  return (
    <div className={`flex flex-col gap-0.5 select-none ${className}`}>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`font-display font-black tracking-tight text-slate-900 leading-none ${
            isSm
              ? "text-2xl"
              : isMd
              ? "text-3xl"
              : isLg
              ? "text-4xl lg:text-5xl"
              : "text-5xl xl:text-6xl"
          }`}
        >
          SM<span className="text-blue-600 font-extrabold">&#8377;</span>ITI
        </span>
        <span
          className={`font-mono text-slate-400 self-start ${
            isSm ? "text-[8px] mt-0.5" : "text-xs mt-1"
          }`}
          aria-hidden="true"
        >
          &#174;
        </span>
        {isSm && (
          <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full ml-1">
            Retail OS
          </span>
        )}
      </div>

      {!isSm && (
        <div
          className={`font-display font-extrabold text-slate-900 tracking-tight leading-tight ${
            isMd ? "text-xl" : isLg ? "text-2xl" : "text-2xl xl:text-3xl"
          }`}
        >
          Retail OS
        </div>
      )}

      {showTagline && (
        <div
          className={`font-mono tracking-[0.2em] text-slate-500 uppercase font-bold ${
            isSm ? "text-[8px] mt-0.5" : "text-[10px] xl:text-[11px] mt-1"
          }`}
        >
          SIMPLE RETAIL. SMARTER BUSINESS.
        </div>
      )}
    </div>
  );
};
