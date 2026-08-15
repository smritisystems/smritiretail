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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-08-15
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { ShoppingCart, Users, FileText, Zap, X, Box } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLayoutEngine } from "../layout_engine/layout_store.js";
import { useResponsiveLayout } from "../layout_engine/responsive_manager.js";
import { useWorkspace } from "../contexts/WorkspaceContext.tsx";

export const QuickActionsMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { preferences, addToRecentlyUsed } = useLayoutEngine();
  const { effectivePosition } = useResponsiveLayout(preferences.position);
  const { focusMode } = useWorkspace();

  const setActiveTab = (tab: string) => {
    addToRecentlyUsed(tab);
    setIsOpen(false);
  };

  const actions = [
    { label: "Quick Sale", icon: ShoppingCart, color: "text-emerald-700", bg: "bg-emerald-50", action: () => setActiveTab("pos") },
    { label: "New Product", icon: Box, color: "text-blue-700", bg: "bg-blue-50", action: () => setActiveTab("item-master") },
    { label: "Add Customer", icon: Users, color: "text-purple-700", bg: "bg-purple-50", action: () => setActiveTab("crm") },
    { label: "Create Quote", icon: FileText, color: "text-amber-700", bg: "bg-amber-50", action: () => setActiveTab("sales") }
  ];

  // Dynamic Dock-aware offset computation
  const getContainerStyle = (): React.CSSProperties => {
    if (focusMode) return { bottom: "1.5rem", right: "1.5rem" };

    const isCollapsed = preferences.collapsed || preferences.iconOnly;
    const sidebarW = isCollapsed ? 72 : preferences.sidebarWidth;

    if (effectivePosition === "right") {
      return { bottom: "1.5rem", right: `${sidebarW + 24}px` };
    }
    if (effectivePosition === "bottom") {
      return { bottom: "5.5rem", right: "1.5rem" };
    }
    return { bottom: "1.5rem", right: "1.5rem" };
  };

  return (
    <div
      className="fixed z-40 flex flex-col items-end transition-all duration-200"
      style={getContainerStyle()}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="mb-3 bg-theme-surface-1 border border-theme-divider shadow-xl rounded-xl p-1.5 flex flex-col space-y-1 w-48 overflow-hidden"
          >
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.action}
                className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-theme-surface-hover transition-colors group text-left cursor-pointer"
              >
                <div className={`p-1.5 rounded-md ${action.bg} ${action.color}`}>
                  <action.icon size={15} />
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
        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full flex items-center justify-center shadow-md transition-all transform hover:scale-105 cursor-pointer border border-blue-500"
        title="Quick Actions Palette"
      >
        {isOpen ? <X size={20} /> : <Zap size={20} />}
      </button>
    </div>
  );
};
