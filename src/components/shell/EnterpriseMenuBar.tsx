/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-22
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Classic Enterprise ERP Menu Bar & Portal-Anchored Submenus
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { filterNavigationTree } from "./navigationAccess";

export interface MenuItemDef {
  id: string;
  label: string;
  icon?: string;
  moduleId?: string;
  children?: MenuItemDef[];
}

export const ENTERPRISE_MENU_ITEMS: MenuItemDef[] = [
  { id: "home", label: "Home", icon: "home", moduleId: "launchpad" },
  {
    id: "master",
    label: "Master",
    moduleId: "item-master",
    children: [
      {
        id: "items-group",
        label: "Items & Catalog",
        icon: "category",
        children: [
          { id: "item-master", label: "Item Master Catalog", moduleId: "item-master", icon: "inventory" },
          { id: "price-revision", label: "Price List & Revisions", moduleId: "price-revision", icon: "sell" },
          { id: "ufe", label: "UOM & Tax Formulas", moduleId: "ufe", icon: "percent" },
        ],
      },
      {
        id: "parties-group",
        label: "Parties & Entities",
        icon: "group",
        children: [
          { id: "customer-master", label: "Customers 360", moduleId: "customer-master", icon: "person" },
          { id: "vendor-360", label: "Suppliers 360", moduleId: "vendor-360", icon: "local_shipping" },
          { id: "store-directory", label: "Stores & Branches", moduleId: "store-directory", icon: "store" },
        ],
      },
    ],
  },
  {
    id: "transactions",
    label: "Transactions",
    moduleId: "billing-workspace",
    children: [
      {
        id: "sales-desk",
        label: "Sales Desks",
        icon: "point_of_sale",
        children: [
          { id: "billing-workspace", label: "Billing & Sales", moduleId: "billing-workspace", icon: "point_of_sale" },
          { id: "sales-promotions", label: "Promotions & Offers", moduleId: "sales-promotions", icon: "loyalty" },
        ],
      },
      {
        id: "procurement-desk",
        label: "Procurement & Inward",
        icon: "shopping_cart",
        children: [
          { id: "purchase", label: "Purchase Orders", moduleId: "purchase", icon: "shopping_bag" },
          { id: "grn-studio", label: "Goods Receipt Note (GRN)", moduleId: "grn-studio", icon: "inbox" },
          { id: "approval-matrix", label: "PO Approval Matrix", moduleId: "approval-matrix", icon: "verified" },
        ],
      },
      { id: "day-close", label: "Day End / Shift Close", moduleId: "day-close", icon: "lock_clock" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    moduleId: "stock-ledger",
    children: [
      { id: "stock-ledger", label: "Stock Ledger & Movements", moduleId: "stock-ledger", icon: "inventory_2" },
      { id: "barcode", label: "Barcode Studio & Labels", moduleId: "barcode", icon: "barcode_scanner" },
      { id: "physical-stock", label: "Physical Stock Audit", moduleId: "physical-stock", icon: "fact_check" },
      { id: "inventory", label: "Inventory Analytics Dashboard", moduleId: "inventory", icon: "warehouse" },
    ],
  },
  {
    id: "purchase",
    label: "Purchase",
    moduleId: "purchase",
    children: [
      { id: "purchase", label: "Purchase Studio", moduleId: "purchase", icon: "shopping_bag" },
      { id: "grn-studio", label: "Goods Receipt (GRN)", moduleId: "grn-studio", icon: "inbox" },
      { id: "procurement-visual-reports", label: "Procurement Visual Reports", moduleId: "procurement-visual-reports", icon: "query_stats" },
      { id: "approval-matrix", label: "Approval Matrix", moduleId: "approval-matrix", icon: "verified" },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    moduleId: "business-ledger",
    children: [
      { id: "business-ledger", label: "Business Ledger", moduleId: "business-ledger", icon: "menu_book" },
      { id: "ewaybill-management", label: "GST & E-Way Compliance", moduleId: "ewaybill-management", icon: "verified_user" },
      { id: "accounting-sync", label: "Tally / ERP Sync", moduleId: "accounting-sync", icon: "sync_alt" },
      { id: "cost-truth", label: "Cost Truth Dashboard", moduleId: "cost-truth", icon: "insights" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    moduleId: "customer-master",
    children: [
      { id: "customer-master", label: "Customer Master 360°", moduleId: "customer-master", icon: "contacts" },
      { id: "vendor-360", label: "Supplier Master 360°", moduleId: "vendor-360", icon: "badge" },
      { id: "corporate-360", label: "Corporate Account Groups", moduleId: "corporate-360", icon: "domain" },
      { id: "crm", label: "CRM Engagement Studio", moduleId: "crm", icon: "hub" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    moduleId: "report-designer",
    children: [
      { id: "report-designer", label: "BI Report Designer", moduleId: "report-designer", icon: "analytics" },
      { id: "visual-reports", label: "BI Visual Dashboards", moduleId: "visual-reports", icon: "bar_chart" },
      { id: "procurement-visual-reports", label: "Procurement Analytics", moduleId: "procurement-visual-reports", icon: "pie_chart" },
      { id: "audit-logs", label: "Immutable Audit Logs", moduleId: "audit-logs", icon: "history" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    moduleId: "system-parameters",
    children: [
      { id: "data-exchange", label: "Data Management", moduleId: "data-exchange", icon: "swap_horiz" },
      { id: "bulk-import-sheet", label: "Bulk Import / Export", moduleId: "bulk-import-sheet", icon: "upload_file" },
      { id: "system-parameters", label: "System Parameters", moduleId: "system-parameters", icon: "build" },
      { id: "backup-restore", label: "Backup & Recovery Hub", moduleId: "backup-restore", icon: "settings_backup_restore" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    moduleId: "company-profile",
    children: [
      { id: "company-profile", label: "Company Profile Studio", moduleId: "company-profile", icon: "business" },
      { id: "profiles", label: "Store & POS Profiles", moduleId: "profiles", icon: "settings_applications" },
      { id: "staff-management", label: "Staff & Role Hierarchy", moduleId: "staff-management", icon: "badge" },
      { id: "security-management", label: "Security & Permissions", moduleId: "security-management", icon: "security" },
    ],
  },
  {
    id: "help",
    label: "Help",
    moduleId: "wiki",
    children: [
      { id: "wiki", label: "SMRITI Wiki Documentation", moduleId: "wiki", icon: "auto_stories" },
      { id: "training", label: "Staff Training Academy", moduleId: "training", icon: "school" },
      { id: "about-smriti", label: "About SMRITI Retail OS", moduleId: "about-smriti", icon: "info" },
    ],
  },
];

interface EnterpriseMenuBarProps {
  activeModuleId: string;
  onNavigateHome: () => void;
  onSelectModule?: (moduleId: string) => void;
  resolvedNavigationIds: string[] | null;
}

export const EnterpriseMenuBar: React.FC<EnterpriseMenuBarProps> = ({
  activeModuleId,
  onNavigateHome,
  onSelectModule,
  resolvedNavigationIds,
}) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [visibleCount, setVisibleCount] = useState(ENTERPRISE_MENU_ITEMS.length);
  const menuItems = useMemo(
    () => filterNavigationTree(ENTERPRISE_MENU_ITEMS, resolvedNavigationIds),
    [resolvedNavigationIds],
  );

  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const measurementRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const moreMeasurementRef = useRef<HTMLButtonElement | null>(null);
  const childItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);

  // Measure the space left in the header after brand and account controls.
  useEffect(() => {
    const container = menuContainerRef.current;
    if (!container) return;

    const measureMenu = () => {
      const width = container.clientWidth;
      setAvailableWidth(width);

      const moreWidth = moreMeasurementRef.current?.getBoundingClientRect().width ?? 72;
      const itemWidths = menuItems.map(
        (item) => measurementRefs.current[item.id]?.getBoundingClientRect().width ?? 0,
      );
      let nextCount = 0;
      let occupied = 0;

      for (let index = 0; index < itemWidths.length; index += 1) {
        const gap = nextCount > 0 ? 2 : 0;
        const moreReserve = index < itemWidths.length - 1 ? moreWidth + 2 : 0;
        if (occupied + gap + itemWidths[index] + moreReserve > width) break;
        occupied += gap + itemWidths[index];
        nextCount += 1;
      }

      setVisibleCount((current) => current === nextCount ? current : nextCount);
    };

    measureMenu();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureMenu);
      return () => window.removeEventListener("resize", measureMenu);
    }

    const observer = new ResizeObserver(measureMenu);
    observer.observe(container);
    void document.fonts?.ready.then(measureMenu);
    return () => observer.disconnect();
  }, [menuItems]);

  useEffect(() => {
    if (!activeDropdown || activeDropdown === "overflow") return;
    if (!menuItems.some((item) => item.id === activeDropdown)) {
      setActiveDropdown(null);
      setActiveSubmenu(null);
    }
  }, [activeDropdown, menuItems]);

  // Close menus on outside click or escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveDropdown(null);
        setActiveSubmenu(null);
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // If clicking inside active trigger button, ignore (handled by onClick)
      const clickedTrigger = Object.values(triggerRefs.current).some(
        (el) => el && el.contains(target)
      );
      if (clickedTrigger) return;

      // If clicking inside dropdown or submenu, ignore
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      if (submenuRef.current && submenuRef.current.contains(target)) return;

      setActiveDropdown(null);
      setActiveSubmenu(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  // Determine active category highlighting
  const isCategoryActive = useCallback(
    (item: MenuItemDef): boolean => {
      if (item.moduleId === activeModuleId) return true;
      if (item.id === "home" && (activeModuleId === "launchpad" || activeModuleId === "workspaces")) {
        return true;
      }
      const checkChildren = (children?: MenuItemDef[]): boolean => {
        if (!children) return false;
        return children.some(
          (c) => c.moduleId === activeModuleId || checkChildren(c.children)
        );
      };
      return checkChildren(item.children);
    },
    [activeModuleId]
  );

  const visibleItems = menuItems.slice(0, visibleCount);
  const overflowItems = menuItems.slice(visibleCount);
  const hasOverflow = overflowItems.length > 0;

  // Handle trigger button click
  const handleTriggerClick = (item: MenuItemDef) => {
    const hasChildren = Boolean(item.children && item.children.length > 0);
    if (!hasChildren) {
      setActiveDropdown(null);
      setActiveSubmenu(null);
      if (item.moduleId === "launchpad") {
        onNavigateHome();
      } else if (item.moduleId && onSelectModule) {
        onSelectModule(item.moduleId);
      }
      return;
    }

    if (activeDropdown === item.id) {
      setActiveDropdown(null);
      setActiveSubmenu(null);
    } else {
      setActiveDropdown(item.id);
      setActiveSubmenu(null);
    }
  };

  // Hover switching between open menu items (standard desktop ERP behavior)
  const handleTriggerHover = (item: MenuItemDef) => {
    if (activeDropdown && activeDropdown !== item.id) {
      const hasChildren = Boolean(item.children && item.children.length > 0);
      if (hasChildren) {
        setActiveDropdown(item.id);
        setActiveSubmenu(null);
      }
    }
  };

  // Get active menu definition (either from visible items or overflow menu)
  const currentActiveItem =
    activeDropdown === "overflow"
      ? { id: "overflow", label: "More", children: overflowItems }
      : menuItems.find((item) => item.id === activeDropdown);

  // Calculate dropdown positioning coordinates from trigger button
  const getDropdownCoords = () => {
    if (!activeDropdown) return null;
    const triggerEl = triggerRefs.current[activeDropdown];
    if (!triggerEl) return null;

    const rect = triggerEl.getBoundingClientRect();
    const dropdownWidth = 240;
    let left = rect.left;

    // Boundary protection: avoid clipping off right edge
    if (typeof window !== "undefined" && left + dropdownWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - dropdownWidth - 12);
    }

    return {
      top: rect.bottom + 2,
      left,
    };
  };

  // Calculate nested submenu flyout coordinates
  const getSubmenuCoords = () => {
    if (!activeSubmenu) return null;
    const childEl = childItemRefs.current[activeSubmenu];
    if (!childEl) return null;

    const rect = childEl.getBoundingClientRect();
    const submenuWidth = 220;
    let left = rect.right + 2;

    // Flip to left if overflowing right edge
    if (typeof window !== "undefined" && left + submenuWidth > window.innerWidth - 12) {
      left = Math.max(12, rect.left - submenuWidth - 2);
    }

    let top = rect.top;
    if (typeof window !== "undefined" && top + 260 > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - 272);
    }

    return {
      top,
      left,
    };
  };

  const dropdownCoords = getDropdownCoords();
  const submenuCoords = getSubmenuCoords();

  // Find active child for flyout submenu
  const activeSubmenuDef = currentActiveItem?.children?.find(
    (c) => c.id === activeSubmenu
  );

  return (
    <>
      <div ref={menuContainerRef} className="relative min-w-0 flex-1 mx-2">
      <nav
        aria-label="Enterprise Main Menu"
        className="flex min-w-0 items-center gap-0.5 overflow-visible py-0.5 select-none"
      >
        {visibleItems.map((item) => {
          const isActive = isCategoryActive(item);
          const isOpen = activeDropdown === item.id;
          const hasChildren = Boolean(item.children && item.children.length > 0);

          return (
            <button
              key={item.id}
              ref={(el) => {
                triggerRefs.current[item.id] = el;
              }}
              type="button"
              onClick={() => handleTriggerClick(item)}
              onMouseEnter={() => handleTriggerHover(item)}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
                isActive || isOpen
                  ? "bg-[#1a2b7b] text-white font-bold shadow-2xs"
                  : "text-indigo-100 hover:text-white hover:bg-[#3f51b5]/80"
              }`}
              aria-expanded={isOpen}
              aria-haspopup={hasChildren ? "menu" : undefined}
            >
              {item.icon && (
                <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
              )}
              <span>{item.label}</span>
              {hasChildren && (
                <span className="material-symbols-outlined text-[13px] opacity-70">
                  arrow_drop_down
                </span>
              )}
            </button>
          );
        })}

        {/* Responsive Overflow "More ▾" Menu */}
        {hasOverflow && (
          <button
            ref={(el) => {
              triggerRefs.current["overflow"] = el;
            }}
            type="button"
            onClick={() => {
              if (activeDropdown === "overflow") {
                setActiveDropdown(null);
                setActiveSubmenu(null);
              } else {
                setActiveDropdown("overflow");
                setActiveSubmenu(null);
              }
            }}
            onMouseEnter={() => {
              if (activeDropdown && activeDropdown !== "overflow") {
                setActiveDropdown("overflow");
                setActiveSubmenu(null);
              }
            }}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
              activeDropdown === "overflow" || overflowItems.some(isCategoryActive)
                ? "bg-[#1a2b7b] text-white font-bold shadow-2xs"
                : "text-indigo-100 hover:text-white hover:bg-[#3f51b5]/80"
            }`}
            aria-expanded={activeDropdown === "overflow"}
            aria-haspopup="menu"
            aria-label="More navigation modules"
            title="More Modules"
          >
            <span className="material-symbols-outlined text-[15px]">more_horiz</span>
            <span className={availableWidth < 96 ? "sr-only" : undefined}>More</span>
            <span className="material-symbols-outlined text-[13px] opacity-70">
              arrow_drop_down
            </span>
          </button>
        )}
      </nav>

      <div aria-hidden="true" className="absolute left-0 top-0 flex h-0 w-max gap-0.5 overflow-hidden invisible pointer-events-none">
        {menuItems.map((item) => (
          <button
            key={item.id}
            ref={(element) => { measurementRefs.current[item.id] = element; }}
            type="button"
            tabIndex={-1}
            className="px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 whitespace-nowrap"
          >
            {item.icon && <span className="material-symbols-outlined text-[15px]">{item.icon}</span>}
            <span>{item.label}</span>
            {item.children?.length ? <span className="material-symbols-outlined text-[13px]">arrow_drop_down</span> : null}
          </button>
        ))}
        <button
          ref={moreMeasurementRef}
          type="button"
          tabIndex={-1}
          className="px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[15px]">more_horiz</span>
          <span>More</span>
          <span className="material-symbols-outlined text-[13px]">arrow_drop_down</span>
        </button>
      </div>
      </div>

      {/* Portal-Anchored Primary Dropdown Menu (Guaranteed Zero Clipping) */}
      {typeof document !== "undefined" &&
        activeDropdown &&
        dropdownCoords &&
        currentActiveItem &&
        currentActiveItem.children &&
        createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            aria-label={`${currentActiveItem.label} Submenu`}
            style={{
              position: "fixed",
              top: `${dropdownCoords.top}px`,
              left: `${dropdownCoords.left}px`,
              zIndex: 9999,
            }}
            className="w-60 max-h-[calc(100vh-60px)] overflow-y-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            {/* Header label for overflow menu */}
            {activeDropdown === "overflow" && (
              <div className="px-3 py-1 mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                Additional Modules
              </div>
            )}

            {currentActiveItem.children.map((child) => {
              const hasSubChildren = Boolean(child.children && child.children.length > 0);
              const isChildActive =
                activeModuleId === child.moduleId ||
                Boolean(child.children?.some((sc) => sc.moduleId === activeModuleId));
              const isSubOpen = activeSubmenu === child.id;

              return (
                <div key={child.id} className="relative">
                  <button
                    ref={(el) => {
                      childItemRefs.current[child.id] = el;
                    }}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (hasSubChildren) {
                        setActiveSubmenu(isSubOpen ? null : child.id);
                      } else {
                        setActiveDropdown(null);
                        setActiveSubmenu(null);
                        if (child.moduleId === "launchpad") {
                          onNavigateHome();
                        } else if (child.moduleId && onSelectModule) {
                          onSelectModule(child.moduleId);
                        }
                      }
                    }}
                    onMouseEnter={() => {
                      if (hasSubChildren) {
                        setActiveSubmenu(child.id);
                      } else {
                        setActiveSubmenu(null);
                      }
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isChildActive || isSubOpen
                        ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 font-semibold"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-blue-600 dark:hover:text-blue-400"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {child.icon && (
                        <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500 shrink-0">
                          {child.icon}
                        </span>
                      )}
                      <span className="truncate">{child.label}</span>
                    </div>
                    {hasSubChildren && (
                      <span className="material-symbols-outlined text-[15px] text-slate-400 dark:text-slate-500">
                        chevron_right
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}

      {/* Portal-Anchored Nested Secondary Submenu (Flyout to the right) */}
      {typeof document !== "undefined" &&
        activeSubmenu &&
        submenuCoords &&
        activeSubmenuDef &&
        activeSubmenuDef.children &&
        createPortal(
          <div
            ref={submenuRef}
            role="menu"
            aria-label={`${activeSubmenuDef.label} Submenu`}
            style={{
              position: "fixed",
              top: `${submenuCoords.top}px`,
              left: `${submenuCoords.left}px`,
              zIndex: 10000,
            }}
            className="w-56 max-h-[calc(100vh-60px)] overflow-y-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            <div className="px-3 py-1 mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
              {activeSubmenuDef.label}
            </div>
            {activeSubmenuDef.children.map((leaf) => {
              const isLeafActive = activeModuleId === leaf.moduleId;

              return (
                <button
                  key={leaf.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActiveDropdown(null);
                    setActiveSubmenu(null);
                    if (leaf.moduleId === "launchpad") {
                      onNavigateHome();
                    } else if (leaf.moduleId && onSelectModule) {
                      onSelectModule(leaf.moduleId);
                    }
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                    isLeafActive
                      ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 font-semibold"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-blue-600 dark:hover:text-blue-400"
                  }`}
                >
                  {leaf.icon && (
                    <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500 shrink-0">
                      {leaf.icon}
                    </span>
                  )}
                  <span className="truncate">{leaf.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
};
