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

interface ResponsiveBackgroundProps {
  className?: string;
}

export const ResponsiveBackground: React.FC<ResponsiveBackgroundProps> = ({
  className = "",
}) => {
  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden select-none z-0 ${className}`} aria-hidden="true">
      {/* 4K Boutique & Footwear Retail Showroom Backdrop (Desktop & Tablet) */}
      <div
        className="hidden sm:block absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat transition-opacity duration-300"
        style={{
          backgroundImage: "url('/assets/branding/retail_login_bg.jpg')",
          filter: "contrast(1.02) brightness(0.98)",
        }}
      />

      {/* Clean, high-readability ambient gradient for mobile viewports */}
      <div className="sm:hidden absolute inset-0 w-full h-full bg-gradient-to-b from-slate-50 via-blue-50/30 to-slate-100" />

      {/* Luminous daylight organic curved wash on left side (Desktop & Tablet) */}
      <div className="hidden lg:block absolute inset-y-0 left-0 w-full lg:w-[50%] xl:w-[45%] bg-gradient-to-r from-white/98 via-white/85 to-transparent backdrop-blur-[0.5px]" />

      {/* ── Layered Blue Flowing Wave Ribbon across lower screen (Desktop & Tablet) ── */}
      <div className="hidden sm:block absolute bottom-0 inset-x-0 h-40 sm:h-56 overflow-hidden">
        <svg viewBox="0 0 1440 240" preserveAspectRatio="none" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M-60,160 C260,80 540,220 920,110 C1200,10 1350,130 1500,80 L1500,240 L-60,240 Z" fill="url(#waveGrad1)" opacity="0.65" />
          <path d="M-60,125 C240,200 600,100 950,165 C1220,220 1370,65 1500,115 L1500,240 L-60,240 Z" fill="url(#waveGrad2)" opacity="0.88" />
          <defs>
            <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="45%" stopColor="#2563eb" />
              <stop offset="85%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="waveGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0a192f" />
              <stop offset="35%" stopColor="#1d4ed8" />
              <stop offset="70%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};
