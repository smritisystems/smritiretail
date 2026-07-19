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
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { Plus, ShoppingCart, Users, FileText, Zap, X, Box } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLayoutEngine } from "../layout_engine/layout_store.tsx";

export const QuickActionsMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { addToRecentlyUsed } = useLayoutEngine();

  const setActiveTab = (tab: string) => {
    addToRecentlyUsed(tab);
    setIsOpen(false);
  };

  const actions = [
    { label: "Quick Sale", icon: ShoppingCart, color: "text-emerald-400", bg: "bg-emerald-500/10", action: () => setActiveTab("pos") },
    { label: "New Product", icon: Box, color: "text-blue-400", bg: "bg-blue-500/10", action: () => setActiveTab("item-master") },
    { label: "Add Customer", icon: Users, color: "text-purple-400", bg: "bg-purple-500/10", action: () => setActiveTab("crm") },
    { label: "Create Quote", icon: FileText, color: "text-amber-400", bg: "bg-amber-500/10", action: () => setActiveTab("sales") }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="mb-4 bg-theme-surface-1 border border-theme-divider shadow-2xl rounded-2xl p-2 flex flex-col space-y-1 w-48 overflow-hidden"
          >
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.action}
                className="flex items-center space-x-3 w-full p-2.5 rounded-xl hover:bg-theme-surface-2 transition-colors group text-left"
              >
                <div className={`p-1.5 rounded-lg ${action.bg} ${action.color}`}>
                  <action.icon size={16} />
                </div>
                <span className="text-xs font-semibold text-theme-body group-hover:text-theme-primary transition-colors">
                  {action.label}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-transform transform hover:scale-105"
      >
        {isOpen ? <X size={24} /> : <Zap size={24} />}
      </button>
    </div>
  );
};
