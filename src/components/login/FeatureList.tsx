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
import {
  LucideIcon,
  ShoppingCart,
  Boxes,
  Truck,
  Warehouse,
  Users,
  BarChart3,
} from "lucide-react";

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export const RETAIL_FEATURES: FeatureItem[] = [
  { icon: ShoppingCart, title: "Sales & Billing",       desc: "Fast & Easy Checkout" },
  { icon: Boxes,        title: "Inventory Management",  desc: "Real-Time Stock Visibility" },
  { icon: Truck,        title: "Distribution",          desc: "Smarter Supply Chain" },
  { icon: Warehouse,    title: "Warehouse",             desc: "Better Stock Control" },
  { icon: Users,        title: "Customer Management",   desc: "Stronger Relationships" },
  { icon: BarChart3,    title: "Reports & Analytics",   desc: "Data Driven Growth" },
];

interface FeatureListProps {
  className?: string;
  maxCols?: 1 | 2;
}

export const FeatureList: React.FC<FeatureListProps> = ({
  className = "",
  maxCols = 1,
}) => {
  return (
    <div
      className={`grid gap-2 ${
        maxCols === 2 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-1" : "grid-cols-1"
      } ${className}`}
      aria-label="Retail OS feature pillars"
    >
      {RETAIL_FEATURES.map((pillar, idx) => {
        const Icon = pillar.icon;
        return (
          <motion.div
            key={pillar.title}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.04 * idx }}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white/85 hover:bg-white/95 backdrop-blur-md border border-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 cursor-default"
          >
            <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-full bg-blue-50 border border-blue-100 flex-shrink-0 flex items-center justify-center text-blue-600 shadow-sm" aria-hidden="true">
              <Icon size={16} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs xl:text-[12.5px] font-bold text-slate-900 leading-tight">
                {pillar.title}
              </div>
              <div className="text-[10px] xl:text-[10.5px] font-medium text-slate-500 leading-tight mt-0.5">
                {pillar.desc}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
