/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Security Management — Menu Access Control View
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  MenuAccessSubjectType,
  MenuItemPermission,
  MenuOperationType,
  SecurityUserEntry,
  SecurityGroupEntry,
  SecurityNodeEntry,
} from "./types";
import {
  initialSecurityUsers,
  initialSecurityGroups,
  initialSecurityNodes,
  getPermissionsForSubject,
  savePermissionsForSubject,
  syncPermissionsWithBackend,
  persistPermissionsToBackend,
  getHousekeepingSecurityConfig,
} from "../../services/securityStore";

interface SmritiMenuAccessViewiewProps {
  onClose: () => void;
}

export const MenuAccessView: React.FC<SmritiMenuAccessViewiewProps> = ({
  onClose,
}) => {
  const [subjectType, setSubjectType] = useState<MenuAccessSubjectType>("User");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("002");
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

  const hkConfig = useMemo(() => getHousekeepingSecurityConfig(), []);

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
      const u = initialSecurityUsers.find((x) => x.id === selectedSubjectId);
      return { id: u?.id || selectedSubjectId, name: u?.name || "Ram" };
    } else if (subjectType === "Group") {
      const g = initialSecurityGroups.find((x) => x.id === selectedSubjectId);
      return { id: g?.id || selectedSubjectId, name: g?.name || "Counters" };
    } else {
      const n = initialSecurityNodes.find((x) => x.id === selectedSubjectId);
      return { id: n?.id || selectedSubjectId, name: n?.name || "Billing Counter 1" };
    }
  }, [subjectType, selectedSubjectId]);

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
    await persistPermissionsToBackend(subjectType, selectedSubjectId, companyCode, menuTree);
    setSaveFeedback("Menu restrictions saved successfully.");
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleCancel = () => {
    const loaded = getPermissionsForSubject(subjectType, selectedSubjectId);
    setMenuTree(loaded);
    setSaveFeedback("Changes reverted.");
    setTimeout(() => setSaveFeedback(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f0f0] text-[#000000] text-xs font-sans select-none border border-[#808080]">
      {/* Scope Controls */}
      <div className="p-3 bg-[#e4e4e4] border-b border-[#a0a0a0] flex flex-col gap-2.5">
        {/* Subject Radio Selector */}
        <div className="flex items-center gap-6 font-semibold">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="subjectType"
              checked={subjectType === "User"}
              onChange={() => {
                setSubjectType("User");
                setSelectedSubjectId("002");
              }}
              className="accent-[#003399]"
            />
            <span>User</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="subjectType"
              checked={subjectType === "Group"}
              onChange={() => {
                setSubjectType("Group");
                setSelectedSubjectId("002");
              }}
              className="accent-[#003399]"
            />
            <span>Group</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="subjectType"
              checked={subjectType === "Node"}
              onChange={() => {
                setSubjectType("Node");
                setSelectedSubjectId("NODE-POS-01");
              }}
              className="accent-[#003399]"
            />
            <span>Node</span>
          </label>
        </div>

        {/* Identity Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span className="w-24 text-right font-medium">
              {subjectType} ID:
            </span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-28 px-2 py-0.5 bg-white border border-[#7f9db9] shadow-inner text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowBrowseModal(true)}
                title={`Browse ${subjectType} List`}
                className="px-2 py-0.5 bg-[#ece9d8] hover:bg-[#e0ded0] border border-[#7f9db9] shadow-xs active:bg-[#d0cebf] cursor-pointer font-bold"
              >
                ...
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-24 text-right font-medium">
              {subjectType} Name:
            </span>
            <input
              type="text"
              readOnly
              value={activeSubjectMeta.name}
              className="flex-1 px-2 py-0.5 bg-[#f5f5f5] border border-[#a0a0a0] text-xs text-[#333333]"
            />
          </div>
        </div>

        {/* Company Scope Inputs */}
        {hkConfig.activateCompanyWiseRestrictions && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="w-24 text-right font-medium">Company Code:</span>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  className="w-28 px-2 py-0.5 bg-white border border-[#7f9db9] shadow-inner text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (companyCode === "All") {
                      setCompanyCode("COMP-001");
                      setCompanyName("Smriti Retail Mumbai");
                    } else {
                      setCompanyCode("All");
                      setCompanyName("All Companies");
                    }
                  }}
                  className="px-2 py-0.5 bg-[#ece9d8] hover:bg-[#e0ded0] border border-[#7f9db9] shadow-xs cursor-pointer font-bold"
                >
                  ...
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-24 text-right font-medium">Company Name:</span>
              <input
                type="text"
                readOnly
                value={companyName}
                className="flex-1 px-2 py-0.5 bg-[#f5f5f5] border border-[#a0a0a0] text-xs text-[#333333]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Menu Tree Grid Area */}
      <div className="flex-1 p-2 flex flex-col min-h-0">
        <div className="flex items-center justify-between pb-1.5 px-1 text-[11px] text-[#444]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-2 py-0.5 bg-white border border-[#a0a0a0] shadow-2xs hover:bg-[#e8e8e8] font-bold"
            >
              + Expand All
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-2 py-0.5 bg-white border border-[#a0a0a0] shadow-2xs hover:bg-[#e8e8e8] font-bold"
            >
              - Collapse All
            </button>
          </div>
          {saveFeedback && (
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 border border-emerald-300">
              {saveFeedback}
            </span>
          )}
        </div>

        {/* Tree Table Header */}
        <div className="flex-1 overflow-auto bg-white border border-[#7f9db9] shadow-inner">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#ece9d8] border-b border-[#a0a0a0] sticky top-0 z-10 text-[11px]">
                <th className="w-8 p-1 text-center border-r border-[#d4d0c8]">+/-</th>
                <th className="p-1 border-r border-[#d4d0c8] font-bold min-w-[240px]">
                  Menu Descriptions
                </th>
                <th className="p-1 font-bold">Operations</th>
              </tr>
            </thead>
            <tbody>
              {menuTree.map((rootMenu) => {
                const isExpanded = !!expandedMenus[rootMenu.menuId];
                return (
                  <React.Fragment key={rootMenu.menuId}>
                    {/* Root Level Row */}
                    <tr className="bg-[#f9f9f9] hover:bg-[#eef3fb] border-b border-[#e0e0e0] font-bold">
                      <td className="p-1 text-center border-r border-[#e0e0e0]">
                        {rootMenu.children && rootMenu.children.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(rootMenu.menuId)}
                            className="w-4 h-4 leading-none bg-white border border-[#808080] font-mono text-center flex items-center justify-center cursor-pointer hover:bg-slate-100"
                          >
                            {isExpanded ? "-" : "+"}
                          </button>
                        )}
                      </td>
                      <td className="p-1 border-r border-[#e0e0e0]">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rootMenu.isAccessible}
                            onChange={() => handleToggleParent(rootMenu.menuId)}
                            className="accent-[#003399]"
                          />
                          <span>{rootMenu.menuName}</span>
                        </label>
                      </td>
                      <td className="p-1">
                        {/* Root operations if applicable */}
                      </td>
                    </tr>

                    {/* Children Sub-Rows */}
                    {isExpanded &&
                      rootMenu.children?.map((child) => (
                        <tr
                          key={child.menuId}
                          className="hover:bg-[#f0f4fc] border-b border-[#f0f0f0] text-[11px]"
                        >
                          <td className="p-1 text-center border-r border-[#e8e8e8]" />
                          <td className="p-1 pl-8 border-r border-[#e8e8e8]">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={child.isAccessible}
                                onChange={() =>
                                  handleToggleChild(rootMenu.menuId, child.menuId)
                                }
                                className="accent-[#003399]"
                              />
                              <span className={child.isAccessible ? "text-[#000]" : "text-[#888]"}>
                                {child.menuName}
                              </span>
                            </label>
                          </td>
                          <td className="p-1">
                            {child.supportedOperations && (
                              <div className="flex items-center gap-4 flex-wrap">
                                {child.supportedOperations.map((op) => {
                                  const isAllowed = child.allowedOperations?.[op] ?? false;
                                  return (
                                    <label
                                      key={op}
                                      className="flex items-center gap-1 cursor-pointer"
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
                                        className="accent-[#003399]"
                                      />
                                      <span
                                        className={`font-mono text-[10px] ${
                                          !child.isAccessible
                                            ? "text-[#aaa]"
                                            : isAllowed
                                            ? "font-bold text-[#003399]"
                                            : "text-[#555]"
                                        }`}
                                      >
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

      {/* Footer Action Buttons */}
      <div className="p-2 bg-[#e4e4e4] border-t border-[#a0a0a0] flex items-center justify-between">
        <div className="text-[11px] text-[#555]">
          Target: <strong className="text-[#000]">{subjectType}: {activeSubjectMeta.id} ({activeSubjectMeta.name})</strong>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="w-20 py-1 bg-[#ece9d8] hover:bg-[#e0ded0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] active:border-[#808080] active:border-t-[#808080] text-center font-bold cursor-pointer"
          >
            Ok
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="w-20 py-1 bg-[#ece9d8] hover:bg-[#e0ded0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] active:border-[#808080] text-center font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-20 py-1 bg-[#ece9d8] hover:bg-[#e0ded0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] active:border-[#808080] text-center font-bold cursor-pointer"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Browse Modal */}
      {showBrowseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] shadow-2xl p-4 w-96 font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-[#a0a0a0] font-bold text-xs">
              <span>Select {subjectType}</span>
              <button
                type="button"
                onClick={() => setShowBrowseModal(false)}
                className="px-1.5 bg-red-600 text-white font-bold"
              >
                X
              </button>
            </div>
            <div className="py-3 max-h-60 overflow-y-auto bg-white border border-[#7f9db9] my-2">
              {subjectType === "User" &&
                initialSecurityUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedSubjectId(u.id);
                      setShowBrowseModal(false);
                    }}
                    className="px-3 py-1.5 hover:bg-[#3366cc] hover:text-white cursor-pointer flex justify-between text-xs"
                  >
                    <span className="font-mono">{u.id}</span>
                    <span className="font-bold">{u.name}</span>
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
                    className="px-3 py-1.5 hover:bg-[#3366cc] hover:text-white cursor-pointer flex justify-between text-xs"
                  >
                    <span className="font-mono">{g.id}</span>
                    <span className="font-bold">{g.name}</span>
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
                    className="px-3 py-1.5 hover:bg-[#3366cc] hover:text-white cursor-pointer flex justify-between text-xs"
                  >
                    <span className="font-mono">{n.id}</span>
                    <span className="font-bold">{n.name}</span>
                  </div>
                ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowBrowseModal(false)}
                className="px-4 py-1 bg-[#e0ded0] border border-[#808080] font-bold text-xs"
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
