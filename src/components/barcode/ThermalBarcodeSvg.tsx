/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.2.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useMemo } from "react";

interface ThermalBarcodeSvgProps {
  value: string;
  widthMm?: number;
  heightMm?: number;
  showText?: boolean;
}

export const ThermalBarcodeSvg: React.FC<ThermalBarcodeSvgProps> = ({
  value,
  widthMm = 44,
  heightMm = 12,
  showText = true
}) => {
  const bars = useMemo(() => {
    let result: { width: number; isBar: boolean }[] = [];
    const valStr = value || "890100000001";
    
    // Start code pattern
    result.push({ width: 2, isBar: true });
    result.push({ width: 1, isBar: false });
    result.push({ width: 2, isBar: true });
    result.push({ width: 1, isBar: false });

    // Deterministic bar widths based on ASCII char codes
    for (let i = 0; i < valStr.length; i++) {
      const code = valStr.charCodeAt(i);
      const hash = (code * 11 + i * 17) % 128;
      const bStr = hash.toString(2).padStart(6, "0");
      for (let bit of bStr) {
        result.push({ width: bit === "1" ? 1.8 : 0.9, isBar: bit === "1" });
      }
      result.push({ width: 0.9, isBar: false });
    }

    // Stop code pattern
    result.push({ width: 2, isBar: true });
    result.push({ width: 1, isBar: false });
    result.push({ width: 2.5, isBar: true });
    return result;
  }, [value]);

  let currentX = 0;

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <svg
        viewBox="0 0 160 28"
        className="w-full object-contain"
        style={{ maxHeight: `${heightMm}mm` }}
      >
        <rect x="0" y="0" width="160" height="28" fill="#ffffff" />
        {bars.map((bar, idx) => {
          const x = currentX;
          currentX += bar.width;
          if (!bar.isBar) return null;
          return (
            <rect
              key={idx}
              x={x * 1.3}
              y="1"
              width={bar.width * 1.3}
              height="26"
              fill="#000000"
            />
          );
        })}
      </svg>
      {showText && (
        <span className="font-mono text-[9px] font-bold text-black tracking-widest leading-none mt-0.5">
          {value}
        </span>
      )}
    </div>
  );
};
