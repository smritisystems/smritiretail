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
import { motion } from "motion/react";
import { SmritiBrandLogo } from "./SmritiBrandLogo";
import { FeatureList } from "./FeatureList";

interface BrandPanelProps {
  className?: string;
}

export const BrandPanel: React.FC<BrandPanelProps> = ({ className = "" }) => {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`flex flex-col gap-4 sm:gap-5 ${className}`}
      aria-label="SMRITI Retail OS feature highlights"
    >
      {/* Desktop Brand Header */}
      <SmritiBrandLogo size="lg" />

      {/* 6 Floating Frosted Feature Cards */}
      <div className="w-full max-w-[325px]">
        <FeatureList />
      </div>

      {/* Handwritten cursive script with artistic blue wave accent */}
      <div className="flex flex-col items-start pt-0.5 relative">
        <span
          className="inline-block text-2xl xl:text-3xl text-slate-800 font-bold -rotate-3 select-none"
          style={{ fontFamily: "'Caveat', cursive, serif" }}
          aria-hidden="true"
        >
          Built for Modern Retail
        </span>
        <svg
          className="w-56 h-7 text-blue-600 -mt-1.5 ml-2 pointer-events-none"
          viewBox="0 0 220 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M4 16C50 4 95 24 150 12C180 6 205 10 216 18"
            stroke="url(#brand_accent_wave_grad)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="brand_accent_wave_grad" x1="4" y1="14" x2="216" y2="14" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2563EB" />
              <stop offset="0.6" stopColor="#0284C7" />
              <stop offset="1" stopColor="#38BDF8" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </motion.aside>
  );
};
