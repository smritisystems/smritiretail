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
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type EntityType = "customer" | "item" | "supplier" | "invoice" | "warehouse" | "salesperson" | "report" | "dashboard" | "kpi";

export interface DrillContextData {
  entityType: EntityType;
  entityId: string;
  title: string;
  metadata?: any;
}

interface DrillDownState {
  breadcrumbs: DrillContextData[];
  activePanel: DrillContextData | null;
  searchOpen: boolean;
  pushContext: (context: DrillContextData) => void;
  popContext: () => void;
  jumpToContext: (index: number) => void;
  openPanel: (context: DrillContextData) => void;
  closePanel: () => void;
  setSearchOpen: (open: boolean) => void;
  clearBreadcrumbs: () => void;
}

const DrillDownContext = createContext<DrillDownState | undefined>(undefined);

export const useDrillDown = () => {
  const context = useContext(DrillDownContext);
  if (!context) throw new Error("useDrillDown must be used within a DrillDownProvider");
  return context;
};

export const DrillDownProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [breadcrumbs, setBreadcrumbs] = useState<DrillContextData[]>([]);
  const [activePanel, setActivePanel] = useState<DrillContextData | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Global Ctrl+K handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pushContext = (context: DrillContextData) => {
    setBreadcrumbs(prev => [...prev, context]);
  };

  const popContext = () => {
    setBreadcrumbs(prev => prev.slice(0, -1));
  };

  const jumpToContext = (index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const openPanel = (context: DrillContextData) => {
    setActivePanel(context);
  };

  const closePanel = () => {
    setActivePanel(null);
  };

  const clearBreadcrumbs = () => {
    setBreadcrumbs([]);
  };

  return (
    <DrillDownContext.Provider value={{
      breadcrumbs, activePanel, searchOpen,
      pushContext, popContext, jumpToContext,
      openPanel, closePanel, setSearchOpen, clearBreadcrumbs
    }}>
      {children}
    </DrillDownContext.Provider>
  );
};
