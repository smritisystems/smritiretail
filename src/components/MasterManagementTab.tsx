/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MASTER_REGISTRY,
  MasterConfig,
  GLOBAL_AUDIT_FIELDS,
} from "../masters_registry.ts";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

interface MasterManagementTabProps {
  onNotification: (
    title: string,
    message: string,
    type?: "success" | "error",
  ) => void;
}

const getPlural = (id: string) => {
  if (id === "company") return "companies";
  if (id === "branch") return "branches";
  return id + "s";
};

export const MasterManagementTab: React.FC<MasterManagementTabProps> = ({
  onNotification,
}) => {
  const [selectedMasterId, setSelectedMasterId] = useState<string>("company");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewState, setViewState] = useState<"list" | "form">("list");
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [mastersList, setMastersList] = useState<MasterConfig[]>(MASTER_REGISTRY);

  const selectedMaster =
    mastersList.find((m) => m.id === selectedMasterId) ||
    mastersList[0] ||
    MASTER_REGISTRY[0];

  const categories = Array.from(
    new Set(mastersList.map((m) => m.category)),
  );

  const [masterData, setMasterData] = useState<any[]>([]);
  const [mastersOptions, setMastersOptions] = useState<Record<string, any[]>>({
    companies: [],
    branches: [],
    stores: [],
    warehouses: [],
    departments: [],
    designations: []
  });

  const fetchLookupTypes = async () => {
    try {
      const lookupTypes = await apiFetchV1("/masters/lookup-types");
        
        const LOOKUP_METADATA: Record<string, { category: string; icon: string }> = {
          department: { category: "Organization", icon: "groups" },
          designation: { category: "Organization", icon: "work" },
          bank: { category: "Finance", icon: "account_balance" },
          payment_mode: { category: "Finance", icon: "payments" },
          currency: { category: "Finance", icon: "currency_exchange" },
          expense_category: { category: "Finance", icon: "money_off" }
        };

        const getFieldLabel = (name: string) => {
          if (name === "account_no") return "Account Number";
          if (name === "ifsc") return "IFSC Code";
          if (name === "type") return "Type";
          if (name === "symbol") return "Symbol";
          return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        };

        const dynamicMasters = lookupTypes.map((type: any) => {
          const meta = LOOKUP_METADATA[type.code] || { category: "System Master", icon: "database" };
          const fields: any[] = [];
          
          const showCode = !["bank", "payment_mode", "expense_category"].includes(type.code);
          const showName = type.code !== "currency";
          
          if (showCode) {
            fields.push({ name: "code", label: type.code === "currency" ? "Currency Code" : "Code", type: "text", required: true });
          }
          if (showName) {
            fields.push({ name: "name", label: `${type.label} Name`, type: "text", required: true });
          }
          
          const props = type.field_schema?.properties || {};
          Object.keys(props).forEach(propName => {
            const prop = props[propName];
            const fieldLabel = getFieldLabel(propName);
            if (prop.enum) {
              fields.push({
                name: propName,
                label: fieldLabel,
                type: "select",
                options: prop.enum
              });
            } else if (prop.type === "boolean") {
              fields.push({
                name: propName,
                label: fieldLabel,
                type: "checkbox"
              });
            } else {
              fields.push({
                name: propName,
                label: fieldLabel,
                type: "text"
              });
            }
          });

          return {
            id: type.code,
            name: type.label,
            category: meta.category,
            icon: meta.icon,
            status: "live",
            fields,
            isLookup: true
          };
        });

        setMastersList([...MASTER_REGISTRY, ...dynamicMasters]);
    } catch (err) {
      console.error("Failed to load dynamic lookup types:", err);
    }
  };

  const fetchMastersOptions = async () => {
    try {
      const keys = ["companies", "branches", "stores", "warehouses"];
      const results = await Promise.all(
        keys.map(k => apiFetchV1(`/masters/${k}`).catch(() => []))
      );
      const newOpts: Record<string, any[]> = {};
      keys.forEach((k, idx) => {
        newOpts[k] = results[idx];
      });

      const [deptRes, desigRes] = await Promise.all([
        apiFetchV1("/masters/lookup/department/values").catch(() => []),
        apiFetchV1("/masters/lookup/designation/values").catch(() => [])
      ]);
      newOpts["departments"] = deptRes;
      newOpts["designations"] = desigRes;

      setMastersOptions(newOpts);
    } catch (err) {
      console.error("Failed to load master dropdown options:", err);
    }
  };

  const fetchCurrentMasterData = async () => {
    if (selectedMaster?.status === "planned") return;
    try {
      let endpoint = "";
      if (selectedMaster?.isLookup) {
        endpoint = `/masters/lookup/${selectedMasterId}/values`;
      } else {
        const plural = getPlural(selectedMasterId);
        endpoint = `/masters/${plural}`;
      }
      const data = await apiFetchV1(endpoint);
      setMasterData(data);
    } catch (err) {
      console.error(err);
      onNotification("Fetch Error", "Failed to load master data.", "error");
    }
  };

  useEffect(() => {
    fetchLookupTypes();
    fetchMastersOptions();
  }, []);

  useEffect(() => {
    fetchCurrentMasterData();
    setViewState("list");
    setEditingItem(null);
  }, [selectedMasterId, mastersList]);

  const handleSelectMaster = (id: string) => {
    setSelectedMasterId(id);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        if (selectedMaster.status !== "planned") {
          setEditingItem(null);
          setViewState("form");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMaster]);

  const handleSave = async (data: any) => {
    try {
      const isEdit = !!editingItem;
      let endpoint = "";
      let bodyData = data;
      
      if (selectedMaster?.isLookup) {
        endpoint = isEdit
          ? `/masters/lookup/${selectedMasterId}/values/${editingItem.id}`
          : `/masters/lookup/${selectedMasterId}/values`;
        
        const customData: Record<string, any> = {};
        selectedMaster.fields.forEach(f => {
          if (f.name !== "code" && f.name !== "name" && f.name !== "status") {
            customData[f.name] = data[f.name];
          }
        });
        const mergedData = { ...(data.data || {}), ...customData };

        bodyData = {
          code: data.code || data.name?.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6) || `VAL-${Date.now()}`,
          name: data.name || data.code || "",
          active: data.status === undefined || data.status === "Active",
          data: mergedData
        };
      } else {
        const plural = getPlural(selectedMasterId);
        endpoint = isEdit ? `/masters/${plural}/${editingItem.id}` : `/masters/${plural}`;
      }
      
      const method = isEdit ? "PUT" : "POST";

      await apiFetchV1(endpoint, {
        method,
        body: JSON.stringify(bodyData)
      });

      onNotification(
        "Master Saved",
        `${selectedMaster.name} has been saved successfully.`,
        "success"
      );
      setViewState("list");
      setEditingItem(null);
      fetchCurrentMasterData();
      fetchMastersOptions();
    } catch (err: any) {
      onNotification("Save Error", err.message, "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      let endpoint = "";
      if (selectedMaster?.isLookup) {
        endpoint = `/masters/lookup/${selectedMasterId}/values/${id}`;
      } else {
        const plural = getPlural(selectedMasterId);
        endpoint = `/masters/${plural}/${id}`;
      }
      
      await apiFetchV1(endpoint, {
        method: "DELETE"
      });

      onNotification("Master Deleted", `${selectedMaster.name} deleted.`, "success");
      fetchCurrentMasterData();
      fetchMastersOptions();
    } catch (err: any) {
      onNotification("Delete Error", err.message, "error");
    }
  };

  const handleDuplicate = async (item: any) => {
    try {
      const { id, created_at, updated_at, ...dupeData } = item;
      if (dupeData.code) dupeData.code = dupeData.code + "-COPY";
      if (dupeData.name) dupeData.name = dupeData.name + " (Copy)";

      let endpoint = "";
      let bodyData = dupeData;
      
      if (selectedMaster?.isLookup) {
        endpoint = `/masters/lookup/${selectedMasterId}/values`;
        bodyData = {
          code: dupeData.code,
          name: dupeData.name || dupeData.code,
          active: dupeData.active !== undefined ? dupeData.active : true,
          data: dupeData.data || {}
        };
      } else {
        const plural = getPlural(selectedMasterId);
        endpoint = `/masters/${plural}`;
      }

      await apiFetchV1(endpoint, {
        method: "POST",
        body: JSON.stringify(bodyData)
      });

      onNotification("Master Duplicated", `${selectedMaster.name} duplicated.`, "success");
      fetchCurrentMasterData();
      fetchMastersOptions();
    } catch (err: any) {
      onNotification("Duplicate Error", err.message, "error");
    }
  };

  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setViewState("form");
  };

  // Filter list data based on visual search
  const filteredData = masterData.filter(row => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some(val => 
      val && val.toString().toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex h-[calc(100vh-120px)] bg-[#0a1122] rounded-xl overflow-hidden border border-theme-divider shadow-xl">
      {/* Sidebar - Master Types Navigation */}
      <div className="w-64 border-r border-theme-divider bg-theme-surface-2 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-theme-divider">
          <h2 className="text-sm font-bold font-display text-theme-body tracking-wide uppercase flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400">
              database
            </span>
            Master Framework
          </h2>
          <div className="mt-3 relative">
            <span className="material-symbols-outlined absolute left-2 top-2 text-sm text-theme-muted">
              search
            </span>
            <input
              type="text"
              placeholder="Search masters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-theme-surface-3 border border-theme-divider rounded pl-8 pr-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 placeholder-[#8892a4]"
            />
          </div>
        </div>

        <SmritiScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            {categories.map((category) => {
              const categoryMasters = mastersList.filter(
                (m) =>
                  m.category === category &&
                  m.name.toLowerCase().includes(searchTerm.toLowerCase()),
              );

              if (categoryMasters.length === 0) return null;

              return (
                <div key={category} className="space-y-1">
                  <div className="px-3 py-1 text-[10px] font-mono text-theme-muted font-bold uppercase tracking-wider">
                    {category}
                  </div>
                  <div className="space-y-0.5">
                    {categoryMasters.map((master) => (
                      <button
                        key={master.id}
                        onClick={() => handleSelectMaster(master.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                          selectedMasterId === master.id
                            ? "bg-blue-600/20 border border-blue-500/30 text-blue-400"
                            : "text-theme-muted hover:bg-theme-surface-3 hover:text-white border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <span className="material-symbols-outlined text-[18px]">
                            {master.icon}
                          </span>
                          <span className="text-xs font-medium truncate">
                            {master.name}
                          </span>
                        </div>
                        {master.status === "planned" && (
                          <span className="bg-yellow-500/15 text-yellow-400 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase font-mono tracking-widest shrink-0">
                            Planned
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SmritiScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-theme-surface-1">
        {/* Header */}
        <div className="h-16 border-b border-theme-divider px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span
              className={`material-symbols-outlined text-2xl text-theme-muted`}
            >
              {selectedMaster.icon}
            </span>
            <div>
              <h1 className="text-lg font-bold font-display text-theme-body flex items-center gap-2">
                {selectedMaster.name} Management
                {selectedMaster.status === "planned" && (
                  <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-bold uppercase font-mono tracking-wider ml-1">
                    Planned Pipeline
                  </span>
                )}
              </h1>
              <div className="text-xs text-theme-muted flex items-center gap-2 mt-0.5">
                <span className="font-mono">{selectedMaster.category}</span>
                <span>•</span>
                <span>{selectedMaster.status === "planned" ? "0" : filteredData.length} active records</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedMaster.status !== "planned" && (
              <>
                {viewState === "list" ? (
                  <>
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setViewState("form");
                      }}
                      className="h-8 px-4 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-2 ml-2 shadow-lg shadow-blue-900/30"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add {selectedMaster.name}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setViewState("list");
                      setEditingItem(null);
                    }}
                    className="h-8 px-4 rounded border border-theme-divider bg-theme-surface-3 text-theme-body text-xs font-medium transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">
                      arrow_back
                    </span>
                    Back to List
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {selectedMaster.status === "planned" ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20">
                <span className="material-symbols-outlined text-3xl">construction</span>
              </div>
              <h2 className="text-base font-bold text-theme-body font-display">
                Finance module - Planned for Phase 4
              </h2>
              <p className="text-xs text-theme-muted leading-relaxed">
                The master registers for Banks, Payment Modes, Currencies, and Expense Categories are currently planned. They are not yet connected to live database operations.
              </p>
              <div className="bg-theme-surface-2 border border-theme-divider/60 rounded-xl p-3 px-5 text-[11px] text-yellow-400/80 font-mono flex items-center gap-2">
                <span className="material-symbols-outlined text-sm shrink-0">info</span>
                No live data active for {selectedMaster.name} master.
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {viewState === "list" ? (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex flex-col"
                >
                  {/* Table */}
                  <SmritiScrollArea className="flex-1">
                    <div className="p-4">
                      <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-3">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-theme-surface-2 border-b border-theme-divider text-theme-muted text-xs font-mono uppercase tracking-wider">
                            <tr>
                              {selectedMaster.fields.slice(0, 3).map((f) => (
                                <th key={f.name} className="px-6 py-3 font-medium">
                                  {f.label}
                                </th>
                              ))}
                              <th className="px-6 py-3 font-medium">Status</th>
                              <th className="px-6 py-3 font-medium">Updated At</th>
                              <th className="px-6 py-3 font-medium text-right">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2a3a5c]">
                            {filteredData.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={selectedMaster.fields.slice(0, 3).length + 3}
                                  className="px-6 py-12 text-center text-theme-muted"
                                >
                                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">
                                    inbox
                                  </span>
                                  <p>No {selectedMaster.name}s found.</p>
                                  <button
                                    onClick={() => {
                                      setEditingItem(null);
                                      setViewState("form");
                                    }}
                                    className="mt-4 text-blue-400 hover:text-blue-300 font-medium text-xs"
                                  >
                                    Create the first one
                                  </button>
                                </td>
                              </tr>
                            ) : (
                              filteredData.map((row) => (
                                <tr
                                  key={row.id}
                                  className="hover:bg-[#202e50] transition-colors group"
                                >
                                  {selectedMaster.fields.slice(0, 3).map((field) => {
                                    const val = row[field.name] !== undefined
                                      ? row[field.name]
                                      : (row.data ? row.data[field.name] : undefined);
                                    let displayVal = val;
                                    if (field.name === "company") {
                                      const comp = mastersOptions.companies.find((c) => c.id === val);
                                      if (comp) displayVal = comp.name;
                                    } else if (field.name === "branch") {
                                      const br = mastersOptions.branches.find((b) => b.id === val);
                                      if (br) displayVal = br.name;
                                    } else if (typeof val === "boolean") {
                                      displayVal = val ? "Yes" : "No";
                                    }
                                    return (
                                      <td key={field.name} className="px-6 py-3 text-theme-body font-medium">
                                        {displayVal || "-"}
                                      </td>
                                    );
                                  })}
                                  <td className="px-6 py-3">
                                    {(() => {
                                      const statusVal = row.status !== undefined
                                        ? row.status
                                        : (row.active ? "Active" : "Inactive");
                                      const isActive = statusVal === "Active";
                                      return (
                                        <span
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
                                        >
                                          {statusVal}
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-3 text-theme-muted text-xs font-mono">
                                    {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : "-"}
                                  </td>
                                  <td className="px-6 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => handleEditClick(row)}
                                        className="p-1 rounded text-theme-muted hover:text-theme-body hover:bg-[#2a3a5c] transition-colors"
                                        title="Edit"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">
                                          edit
                                        </span>
                                      </button>
                                      <button
                                        onClick={() => handleDuplicate(row)}
                                        className="p-1 rounded text-theme-muted hover:text-theme-body hover:bg-[#2a3a5c] transition-colors"
                                        title="Duplicate"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">
                                          content_copy
                                        </span>
                                      </button>
                                      <button
                                        onClick={() => handleDelete(row.id)}
                                        className="p-1 rounded text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                        title="Delete"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">
                                          delete
                                        </span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </SmritiScrollArea>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  <SmritiScrollArea className="h-full">
                    <div className="p-6 max-w-3xl mx-auto">
                      <MasterForm
                        master={selectedMaster}
                        initialData={editingItem}
                        mastersOptions={mastersOptions}
                        onSave={handleSave}
                        onCancel={() => {
                          setViewState("list");
                          setEditingItem(null);
                        }}
                      />
                    </div>
                  </SmritiScrollArea>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};

interface MasterFormProps {
  master: MasterConfig;
  initialData?: any;
  mastersOptions: Record<string, any[]>;
  onSave: (data: any) => void;
  onCancel: () => void;
}

const MasterForm: React.FC<MasterFormProps> = ({
  master,
  initialData,
  mastersOptions,
  onSave,
  onCancel,
}) => {
  const getInitialFormData = () => {
    if (!initialData) return {};
    const base = { ...initialData };
    if (initialData.data) {
      Object.assign(base, initialData.data);
    }
    if (initialData.active !== undefined) {
      base.status = initialData.active ? "Active" : "Inactive";
    }
    return base;
  };

  const [formData, setFormData] = useState<Record<string, any>>(getInitialFormData());

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const getDynamicOptions = (fieldName: string, fieldOptions?: string[]) => {
    if (fieldName === "company") {
      return mastersOptions.companies.map((c) => ({ value: c.id, label: c.name }));
    }
    if (fieldName === "branch") {
      return mastersOptions.branches.map((b) => ({ value: b.id, label: b.name }));
    }
    return (fieldOptions || []).map((o) => ({ value: o, label: o }));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-theme-surface-3 border border-theme-divider rounded-xl overflow-hidden shadow-2xl animate-fade-in"
    >
      <div className="p-6 border-b border-theme-divider bg-theme-surface-2">
        <h2 className="text-lg font-bold text-theme-body font-display">
          {initialData ? "Edit" : "New"} {master.name}
        </h2>
        <p className="text-xs text-theme-muted mt-1">
          {initialData ? "Modify current record properties." : `Fill out the form below to create a new ${master.name.toLowerCase()} record.`}
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {master.fields.map((field) => (
            <div
              key={field.name}
              className={`${field.type === "textarea" ? "col-span-full" : ""}`}
            >
              <label className="block text-xs font-medium text-theme-muted mb-1.5 uppercase tracking-wider font-mono">
                {field.label}{" "}
                {field.required && <span className="text-rose-500">*</span>}
              </label>

              {field.type === "text" && (
                <input
                  type="text"
                  required={field.required}
                  value={formData[field.name] || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-blue-500"
                />
              )}

              {field.type === "number" && (
                <input
                  type="number"
                  required={field.required}
                  value={formData[field.name] || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-blue-500"
                />
              )}

              {field.type === "select" && (
                <select
                  required={field.required}
                  value={formData[field.name] || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-blue-500 appearance-none"
                >
                  <option value="">Select {field.label}...</option>
                  {getDynamicOptions(field.name, field.options).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {field.type === "textarea" && (
                <textarea
                  required={field.required}
                  value={formData[field.name] || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  rows={3}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-blue-500"
                />
              )}

              {field.type === "checkbox" && (
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={!!formData[field.name]}
                    onChange={(e) => handleChange(field.name, e.target.checked)}
                    className="rounded bg-theme-surface-2 border border-theme-divider text-blue-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-sm text-theme-body font-medium">{field.label}</span>
                </label>
              )}
            </div>
          ))}

          {/* Global Audit & Governance Fields */}
          {GLOBAL_AUDIT_FIELDS.map((field) => (
            <div
              key={field.name}
              className={`${field.type === "textarea" ? "col-span-full" : ""}`}
            >
              <label className="block text-xs font-medium text-theme-muted mb-1.5 uppercase tracking-wider font-mono">
                {field.label}{" "}
                {field.required && <span className="text-rose-500">*</span>}
              </label>

              {field.type === "text" && (
                <input
                  type="text"
                  required={field.required}
                  value={formData[field.name] || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  readOnly={
                    field.name.includes("created") ||
                    field.name.includes("updated") ||
                    field.name.includes("modified")
                  }
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-blue-500 read-only:opacity-50 read-only:cursor-not-allowed"
                />
              )}

              {field.type === "date" && (
                <input
                  type="date"
                  required={field.required}
                  value={formData[field.name] || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  readOnly={
                    field.name.includes("created") ||
                    field.name.includes("updated") ||
                    field.name.includes("modified")
                  }
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-blue-500 read-only:opacity-50 read-only:cursor-not-allowed"
                />
              )}

              {field.type === "select" && (
                <select
                  required={field.required}
                  value={
                    formData[field.name] ||
                    (field.name === "status" ? "Active" : "")
                  }
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-blue-500 appearance-none"
                >
                  <option value="">Select {field.label}...</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {field.type === "textarea" && (
                <textarea
                  required={field.required}
                  value={formData[field.name] || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  rows={2}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-theme-divider bg-theme-surface-2 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-theme-muted hover:text-theme-body transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-900/50 transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">save</span>
          Save Record
        </button>
      </div>
    </form>
  );
};
