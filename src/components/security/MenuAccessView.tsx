/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.17.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Security Management — Menu Access Control View (Modern Light Theme)
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  MenuAccessSubjectType,
  MenuItemPermission,
  MenuOperationType,
  SecurityUserEntry,
  SecurityGroupEntry,
  SecurityNodeEntry,
} from "./types.ts";
import {
  initialSecurityUsers,
  initialSecurityGroups,
  initialSecurityNodes,
  getPermissionsForSubject,
  savePermissionsForSubject,
  syncPermissionsWithBackend,
  persistPermissionsToBackend,
  getHousekeepingSecurityConfig,
} from "../../services/securityStore.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import {
  User,
  Users,
  Server,
  Search,
  Check,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  Plus,
  Minus,
  CheckCircle2,
  Shield,
  Layers,
  X,
} from "lucide-react";

interface SmritiMenuAccessViewProps {
  onClose: () => void;
}

export const MenuAccessView: React.FC<SmritiMenuAccessViewProps> = ({
  onClose,
}) => {
  const [subjectType, setSubjectType] = useState<MenuAccessSubjectType>("User");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("002");
  const [users, setUsers] = useState<SecurityUserEntry[]>(initialSecurityUsers);
  const [companyCode, setCompanyCode] = useState<string>("All");
  const [companyName, setCompanyName] = useState<string>("All Companies");
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    sales: true,
    cash: false,
    stock: true,
    reports: false,
    housekeeping: false,
    catalogue: false,
    setup: false,
    help: false,
  });
  const [menuTree, setMenuTree] = useState<MenuItemPermission[]>(() =>
    getPermissionsForSubject("User", "002")
  );
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hkConfig = useMemo(() => getHousekeepingSecurityConfig(), []);

  useEffect(() => {
    let isMounted = true;
    apiFetchV1("/users/?limit=200").then((response: any) => {
      if (!isMounted || !Array.isArray(response?.users) || response.users.length === 0) return;
      const databaseUsers = response.users.map((user: any) => ({
        id: user.id || user.userId,
        name: user.fullName || user.displayName || user.username,
        groupId: user.role || "",
        companyCode: user.companyId || "All",
        companyName: user.companyId || "All Companies",
        isLocked: user.status === "Inactive",
      }));
      setUsers(databaseUsers);
      setSelectedSubjectId((currentId) =>
        databaseUsers.some((user: SecurityUserEntry) => user.id === currentId)
          ? currentId
          : databaseUsers[0].id
      );
    }).catch(() => {
      // Keep the local seed list available when the control-plane request is unavailable.
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Reload tree when subject type or subject ID changes (with backend synchronization)
  useEffect(() => {
    const loaded = getPermissionsForSubject(subjectType, selectedSubjectId);
    setMenuTree(loaded);

    let isMounted = true;
    syncPermissionsWithBackend(subjectType, selectedSubjectId, companyCode).then((synced) => {
      if (isMounted && synced) {
        setMenuTree(synced);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [subjectType, selectedSubjectId, companyCode]);

  // Find active subject metadata
  const activeSubjectMeta = useMemo(() => {
    if (subjectType === "User") {
      const u = users.find((x) => x.id === selectedSubjectId);
      return { id: u?.id || selectedSubjectId, name: u?.name || "Ram" };
    } else if (subjectType === "Group") {
      const g = initialSecurityGroups.find((x) => x.id === selectedSubjectId);
      return { id: g?.id || selectedSubjectId, name: g?.name || "Counters" };
    } else {
      const n = initialSecurityNodes.find((x) => x.id === selectedSubjectId);
      return { id: n?.id || selectedSubjectId, name: n?.name || "Billing Counter 1" };
    }
  }, [subjectType, selectedSubjectId, users]);

  const handleToggleExpand = (menuId: string) => {
    setExpandedMenus((prev) => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    menuTree.forEach((m) => {
      next[m.menuId] = true;
    });
    setExpandedMenus(next);
  };

  const handleCollapseAll = () => {
    setExpandedMenus({});
  };

  // Toggle parent menu accessibility
  const handleToggleParent = (menuId: string) => {
    setMenuTree((prevTree) =>
      prevTree.map((item) => {
        if (item.menuId === menuId) {
          const nextVal = !item.isAccessible;
          const updatedChildren = item.children?.map((c) => ({
            ...c,
            isAccessible: nextVal,
          }));
          return {
            ...item,
            isAccessible: nextVal,
            children: updatedChildren,
          };
        }
        return item;
      })
    );
  };

  // Toggle child menu accessibility
  const handleToggleChild = (parentMenuId: string, childMenuId: string) => {
    setMenuTree((prevTree) =>
      prevTree.map((parent) => {
        if (parent.menuId === parentMenuId && parent.children) {
          const updatedChildren = parent.children.map((child) => {
            if (child.menuId === childMenuId) {
              return { ...child, isAccessible: !child.isAccessible };
            }
            return child;
          });
          const anyChildAccessible = updatedChildren.some((c) => c.isAccessible);
          return {
            ...parent,
            isAccessible: anyChildAccessible,
            children: updatedChildren,
          };
        }
        return parent;
      })
    );
  };

  // Toggle operation checkbox
  const handleToggleOperation = (
    parentMenuId: string,
    childMenuId: string,
    op: string
  ) => {
    setMenuTree((prevTree) =>
      prevTree.map((parent) => {
        if (parent.menuId === parentMenuId && parent.children) {
          const updatedChildren = parent.children.map((child) => {
            if (child.menuId === childMenuId) {
              const currentOps = child.allowedOperations || {};
              const nextOps = {
                ...currentOps,
                [op]: !currentOps[op],
              };
              return { ...child, allowedOperations: nextOps };
            }
            return child;
          });
          return { ...parent, children: updatedChildren };
        }
        return parent;
      })
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await persistPermissionsToBackend(subjectType, selectedSubjectId, companyCode, menuTree);
      setSaveFeedback("Menu access policies updated and audited successfully!");
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch {
      setSaveFeedback("Failed to save menu permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    const loaded = getPermissionsForSubject(subjectType, selectedSubjectId);
    setMenuTree(loaded);
    setSaveFeedback("Permissions reverted to saved state.");
    setTimeout(() => setSaveFeedback(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] text-[#0f172a] text-xs font-sans select-none overflow-hidden">
      {/* 1. Scope & Target Selector Bar */}
      <div className="p-4 bg-white border-b border-[#e2e8f0] flex flex-col gap-3 shadow-2xs">
        {/* Subject Type Segmented Control */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-[#f1f5f9] p-1 rounded-lg border border-[#e2e8f0]">
            {(["User", "Group", "Node"] as MenuAccessSubjectType[]).map((type) => {
              const isActive = subjectType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSubjectType(type);
                    setSelectedSubjectId(type === "Node" ? "NODE-POS-01" : "002");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                    isActive
                      ? "bg-white text-[#1e40af] shadow-xs font-bold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  {type === "User" && <User className="w-3.5 h-3.5" />}
                  {type === "Group" && <Users className="w-3.5 h-3.5" />}
                  {type === "Node" && <Server className="w-3.5 h-3.5" />}
                  <span>{type} Level</span>
                </button>
              );
            })}
          </div>

          {/* Quick Target Summary Badge */}
          <div className="flex items-center gap-2 bg-[#eff6ff] border border-[#bfdbfe] px-3 py-1 rounded-lg text-[11px] font-mono text-[#1e40af]">
            <Shield className="w-3.5 h-3.5 text-[#1e40af]" />
            <span>Target: <strong>{subjectType} {activeSubjectMeta.id} ({activeSubjectMeta.name})</strong></span>
          </div>
        </div>

        {/* Identity Inputs Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <label className="w-24 text-[#475569] font-medium shrink-0">
              {subjectType} ID:
            </label>
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="text"
                readOnly
                value={selectedSubjectId}
                className="w-24 px-3 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#0f172a]"
              />
              <button
                type="button"
                onClick={() => setShowBrowseModal(true)}
                className="px-3 py-1.5 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1e40af] border border-[#bfdbfe] rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <Search className="w-3.5 h-3.5" />
                Browse
              </button>
              <input
                type="text"
                readOnly
                value={activeSubjectMeta.name}
                className="flex-1 px-3 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-semibold text-[#0f172a] truncate"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="w-24 text-[#475569] font-medium shrink-0">Company:</label>
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="text"
                readOnly
                value={companyCode}
                className="w-20 px-3 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono text-[#64748b]"
              />
              <input
                type="text"
                readOnly
                value={companyName}
                className="flex-1 px-3 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-semibold text-[#0f172a] truncate"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Menu Permissions Matrix Grid */}
      <div className="flex-1 p-4 flex flex-col min-h-0">
        <div className="flex items-center justify-between pb-2 text-[11px] text-[#64748b]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-2.5 py-1 bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-md font-semibold text-xs text-[#334155] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <Plus className="w-3 h-3 text-[#1e40af]" /> Expand All
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-2.5 py-1 bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-md font-semibold text-xs text-[#334155] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <Minus className="w-3 h-3 text-[#1e40af]" /> Collapse All
            </button>
          </div>

          {saveFeedback && (
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-3 py-1 border border-emerald-200 rounded-lg animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{saveFeedback}</span>
            </div>
          )}
        </div>

        {/* Tree Table */}
        <div className="flex-1 overflow-auto bg-white border border-[#e2e8f0] rounded-xl shadow-xs">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] sticky top-0 z-10 text-[11px] font-mono text-[#475569]">
                <th className="w-10 p-2.5 text-center border-r border-[#e2e8f0]">Tree</th>
                <th className="p-2.5 border-r border-[#e2e8f0] font-bold min-w-[280px]">
                  Menu Description & Module
                </th>
                <th className="p-2.5 font-bold">Granular Operational Rights</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {menuTree.map((rootMenu) => {
                const isExpanded = !!expandedMenus[rootMenu.menuId];
                return (
                  <React.Fragment key={rootMenu.menuId}>
                    {/* Root Level Row */}
                    <tr className="bg-[#f8fafc]/60 hover:bg-[#eff6ff] font-bold transition-colors">
                      <td className="p-2 text-center border-r border-[#e2e8f0]">
                        {rootMenu.children && rootMenu.children.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(rootMenu.menuId)}
                            className="w-5 h-5 bg-white border border-[#cbd5e1] hover:border-[#1e40af] rounded text-center flex items-center justify-center cursor-pointer transition-colors mx-auto"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-[#1e40af]" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-[#64748b]" />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="p-2 border-r border-[#e2e8f0]">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rootMenu.isAccessible}
                            onChange={() => handleToggleParent(rootMenu.menuId)}
                            className="w-4 h-4 rounded text-[#1e40af] focus:ring-[#1e40af] cursor-pointer"
                          />
                          <span className="text-[#0f172a] font-semibold">{rootMenu.menuName}</span>
                        </label>
                      </td>
                      <td className="p-2 text-xs text-[#64748b] font-mono">
                        {rootMenu.isAccessible ? (
                          <span className="text-emerald-700 font-bold">Module Root Enabled</span>
                        ) : (
                          <span className="text-rose-600 font-medium">Restricted at Module Level</span>
                        )}
                      </td>
                    </tr>

                    {/* Children Sub-Rows */}
                    {isExpanded &&
                      rootMenu.children?.map((child) => (
                        <tr
                          key={child.menuId}
                          className="hover:bg-[#f8fafc] border-b border-[#f1f5f9] transition-colors"
                        >
                          <td className="p-2 text-center border-r border-[#e2e8f0]" />
                          <td className="p-2 pl-9 border-r border-[#e2e8f0]">
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={child.isAccessible}
                                onChange={() =>
                                  handleToggleChild(rootMenu.menuId, child.menuId)
                                }
                                className="w-4 h-4 rounded text-[#1e40af] focus:ring-[#1e40af] cursor-pointer"
                              />
                              <span className={child.isAccessible ? "text-[#0f172a] font-semibold" : "text-[#94a3b8]"}>
                                {child.menuName}
                              </span>
                            </label>
                          </td>
                          <td className="p-2">
                            {child.supportedOperations && (
                              <div className="flex items-center gap-4 flex-wrap">
                                {child.supportedOperations.map((op) => {
                                  const isAllowed = child.allowedOperations?.[op] ?? false;
                                  return (
                                    <label
                                      key={op}
                                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all cursor-pointer ${
                                        !child.isAccessible
                                          ? "opacity-40 border-transparent text-[#94a3b8]"
                                          : isAllowed
                                          ? "bg-[#eff6ff] border-[#bfdbfe] text-[#1e40af] font-bold"
                                          : "bg-white border-[#e2e8f0] text-[#64748b] hover:border-[#cbd5e1]"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        disabled={!child.isAccessible}
                                        checked={child.isAccessible && isAllowed}
                                        onChange={() =>
                                          handleToggleOperation(
                                            rootMenu.menuId,
                                            child.menuId,
                                            op
                                          )
                                        }
                                        className="w-3.5 h-3.5 rounded text-[#1e40af] focus:ring-[#1e40af] cursor-pointer"
                                      />
                                      <span className="font-mono text-[10px] uppercase">
                                        {op}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Footer Action Bar */}
      <div className="p-3 bg-white border-t border-[#e2e8f0] flex items-center justify-between shrink-0">
        <div className="text-[11px] font-mono text-[#64748b] flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[#1e40af]" />
          <span>Active Policy: <strong>Two-Pass Permission Cascade</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 bg-white hover:bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1] rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-[#1e40af] hover:bg-[#1d4ed8] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs active:scale-98"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "Saving Policy..." : "Save Restrictions"}
          </button>
        </div>
      </div>

      {/* Browse Modal */}
      {showBrowseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl p-5 w-96 font-sans space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] font-bold text-sm text-[#0f172a]">
              <span>Select {subjectType} Target</span>
              <button
                type="button"
                onClick={() => setShowBrowseModal(false)}
                className="p-1 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-1 max-h-64 overflow-y-auto divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-xl">
              {subjectType === "User" &&
                users.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedSubjectId(u.id);
                      setShowBrowseModal(false);
                    }}
                    className="px-4 py-2.5 hover:bg-[#eff6ff] cursor-pointer flex justify-between items-center text-xs transition-colors"
                  >
                    <span className="font-mono text-[#1e40af] font-bold">{u.id}</span>
                    <span className="font-semibold text-[#0f172a]">{u.name}</span>
                  </div>
                ))}
              {subjectType === "Group" &&
                initialSecurityGroups.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => {
                      setSelectedSubjectId(g.id);
                      setShowBrowseModal(false);
                    }}
                    className="px-4 py-2.5 hover:bg-[#eff6ff] cursor-pointer flex justify-between items-center text-xs transition-colors"
                  >
                    <span className="font-mono text-[#1e40af] font-bold">{g.id}</span>
                    <span className="font-semibold text-[#0f172a]">{g.name}</span>
                  </div>
                ))}
              {subjectType === "Node" &&
                initialSecurityNodes.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      setSelectedSubjectId(n.id);
                      setShowBrowseModal(false);
                    }}
                    className="px-4 py-2.5 hover:bg-[#eff6ff] cursor-pointer flex justify-between items-center text-xs transition-colors"
                  >
                    <span className="font-mono text-[#1e40af] font-bold">{n.id}</span>
                    <span className="font-semibold text-[#0f172a]">{n.name}</span>
                  </div>
                ))}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowBrowseModal(false)}
                className="px-4 py-2 bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-lg font-semibold text-xs text-[#334155] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
