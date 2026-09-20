/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.43.5
 * Created      : 2026-09-14
 * Modified     : 2026-09-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  smritiSystemParameterService,
  SystemParameterDefinition,
} from "../../services/smritiSystemParameterService";
import {
  Settings,
  Shield,
  Lock,
  Search,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Layers,
  Database,
  Store,
  Terminal,
  EyeOff,
  Sliders,
  RefreshCw,
  FolderTree,
} from "lucide-react";

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

export const SmritiSystemParametersStudio: React.FC<Props> = ({ isOpen = true, onClose }) => {
  const [parameters, setParameters] = useState<SystemParameterDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("11. Billing");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mutabilityFilter, setMutabilityFilter] = useState<string>("ALL");
  const [profileFilter, setProfileFilter] = useState<string>("ALL");
  const [dirtyValues, setDirtyValues] = useState<Record<string, any>>({});
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchParameters = useCallback(async () => {
    setLoading(true);
    try {
      await smritiSystemParameterService.load(true);
      const list = await smritiSystemParameterService.listParameters();
      setParameters(list);
      setDirtyValues({});
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err?.message || "Failed to load system parameters.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParameters();
  }, [fetchParameters]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Categories extraction
  const categories = useMemo(() => {
    const map = new Map<string, { count: number; name: string }>();
    parameters.forEach((p) => {
      const cat = p.category || "01. General";
      const existing = map.get(cat) || { count: 0, name: p.category_name || cat };
      existing.count += 1;
      map.set(cat, existing);
    });

    return Array.from(map.entries())
      .map(([cat, info]) => ({ code: cat, name: info.name, count: info.count }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [parameters]);

  // Filtered parameters for active category and search query
  const filteredParameters = useMemo(() => {
    return parameters.filter((p) => {
      // If search query is present, search across all categories
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          p.param_code.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      } else {
        if (p.category !== selectedCategory) return false;
      }

      if (mutabilityFilter !== "ALL" && p.mutability !== mutabilityFilter) {
        return false;
      }

      if (profileFilter !== "ALL" && p.profile_type !== profileFilter && p.profile_type !== "COMMON") {
        return false;
      }

      return true;
    });
  }, [parameters, selectedCategory, searchQuery, mutabilityFilter, profileFilter]);

  const handleValueChange = (paramCode: string, newValue: any) => {
    setDirtyValues((prev) => ({
      ...prev,
      [paramCode]: newValue,
    }));
  };

  const handleSaveBatch = async () => {
    const dirtyKeys = Object.keys(dirtyValues);
    if (dirtyKeys.length === 0) return;

    setSaving(true);
    try {
      const items = dirtyKeys.map((code) => ({
        param_code: code,
        value: dirtyValues[code],
      }));

      const res = await smritiSystemParameterService.saveBatch(items);
      setToastMessage({
        type: "success",
        text: `Successfully updated ${res.count} parameters.`,
      });
      setDirtyValues({});
      await fetchParameters();
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err?.message || err?.detail?.explanation || "Error saving parameters.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async (profile: "RETAIL" | "DISTRIBUTOR") => {
    if (!window.confirm(`Initialize all 828 system parameters with ${profile} blueprint profile? Existing custom values will be preserved.`)) {
      return;
    }
    setSeeding(true);
    try {
      const res = await smritiSystemParameterService.seedProfile(profile, false);
      const msg = res.seeded_count > 0
        ? `Seeded ${res.seeded_count} ${res.profile} parameters.`
        : `All 828 ${res.profile} parameters are already initialized.`;
      setToastMessage({
        type: "success",
        text: msg,
      });
      await fetchParameters();
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err?.message || err?.detail?.explanation || "Failed to seed parameters.",
      });
    } finally {
      setSeeding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden animate-fadeIn">
      <div className="flex flex-col w-full max-w-7xl h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Top Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                  System Parameters Studio
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Tally Shoper 9 Parity
                </span>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  5-Tier Governed
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Configure 828 architectural system switches, profile variances, and hardware terminal overrides
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Seed Profile Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/50">
              <button
                onClick={() => handleSeed("RETAIL")}
                disabled={seeding}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-all flex items-center gap-1.5"
                title="Seed Tally Shoper 9 POS Retail Defaults"
              >
                <Store className="w-3.5 h-3.5" />
                Seed Retail (POS)
              </button>
              <button
                onClick={() => handleSeed("DISTRIBUTOR")}
                disabled={seeding}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-all flex items-center gap-1.5"
                title="Seed Tally Shoper 9 Distributor Defaults"
              >
                <Layers className="w-3.5 h-3.5" />
                Seed Distributor
              </button>
            </div>

            {/* Batch Save Button */}
            {Object.keys(dirtyValues).length > 0 && (
              <button
                onClick={handleSaveBatch}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all animate-pulse"
              >
                <Save className="w-4 h-4" />
                Save {Object.keys(dirtyValues).length} Changes
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-all"
              >
                ✕
              </button>
            )}
          </div>
        </header>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 flex-1 max-w-lg">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search across all 828 parameters by code or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Mutability:</span>
              <select
                value={mutabilityFilter}
                onChange={(e) => setMutabilityFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Mutabilities</option>
                <option value="Variable">Variable (Editable)</option>
                <option value="One Time">One Time</option>
                <option value="Installation">Installation</option>
                <option value="Fixed">Fixed (Locked)</option>
                <option value="Hidden">Hidden</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Profile:</span>
              <select
                value={profileFilter}
                onChange={(e) => setProfileFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Profiles</option>
                <option value="RETAIL">Retail Only</option>
                <option value="DISTRIBUTOR">Distributor Only</option>
                <option value="COMMON">Common</option>
              </select>
            </div>

            <button
              onClick={fetchParameters}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-all"
              title="Refresh Parameters"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`flex items-center justify-between px-6 py-2.5 text-xs ${
              toastMessage.type === "success"
                ? "bg-emerald-950/80 border-b border-emerald-800/80 text-emerald-200"
                : "bg-rose-950/80 border-b border-rose-800/80 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMessage.type === "success" ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-xs hover:underline ml-4 text-slate-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Category Sidebar */}
          {!searchQuery.trim() && (
            <aside className="w-72 border-r border-slate-800 bg-slate-950/50 flex flex-col overflow-y-auto">
              <div className="px-4 py-3 border-b border-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                Parameter Categories ({categories.length})
              </div>
              <nav className="p-2 space-y-1">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.code;
                  return (
                    <button
                      key={cat.code}
                      onClick={() => setSelectedCategory(cat.code)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                        isSelected
                          ? "bg-indigo-600 text-white font-medium shadow-md shadow-indigo-900/40"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
                      }`}
                    >
                      <span className="truncate mr-2">{cat.code}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                          isSelected ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </aside>
          )}

          {/* Right Parameters List */}
          <main className="flex-1 overflow-y-auto p-6 bg-slate-900/30">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-400" />
                <p className="text-sm">Loading governed system parameters...</p>
              </div>
            ) : filteredParameters.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <AlertCircle className="w-8 h-8 mb-3 text-amber-400" />
                <p className="text-sm font-medium">No parameters found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting your search query or mutability filter.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-slate-400">
                    Showing {filteredParameters.length} parameters
                    {searchQuery.trim() ? ` matching "${searchQuery}"` : ` in ${selectedCategory}`}
                  </span>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Variable (Editable)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span> Installation
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span> One Time
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-600"></span> Fixed (Locked)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {filteredParameters.map((param) => {
                    const isDirty = dirtyValues.hasOwnProperty(param.param_code);
                    const currentValue = isDirty ? dirtyValues[param.param_code] : param.effective_value;
                    const isLocked = param.is_locked || param.mutability === "Fixed";

                    return (
                      <div
                        key={param.id || param.param_code}
                        className={`p-4 rounded-xl border transition-all ${
                          isDirty
                            ? "bg-indigo-950/30 border-indigo-500/50 shadow-md shadow-indigo-900/20"
                            : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* Parameter Meta */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-mono text-sm font-bold text-slate-100 tracking-tight">
                                {param.param_code}
                              </span>

                              {/* Mutability Badge */}
                              <span
                                className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${
                                  param.mutability === "Fixed"
                                    ? "bg-slate-800 text-slate-300 border-slate-700"
                                    : param.mutability === "Installation"
                                    ? "bg-purple-900/30 text-purple-300 border-purple-700/50"
                                    : param.mutability === "One Time"
                                    ? "bg-amber-900/30 text-amber-300 border-amber-700/50"
                                    : param.mutability === "Hidden"
                                    ? "bg-slate-900 text-slate-400 border-slate-800"
                                    : "bg-emerald-900/30 text-emerald-300 border-emerald-700/50"
                                }`}
                              >
                                {param.mutability}
                              </span>

                              {/* Profile Badge */}
                              {param.profile_type !== "COMMON" && (
                                <span
                                  className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${
                                    param.profile_type === "RETAIL"
                                      ? "bg-blue-900/30 text-blue-300 border-blue-700/50"
                                      : "bg-purple-900/30 text-purple-300 border-purple-700/50"
                                  }`}
                                >
                                  {param.profile_type}
                                </span>
                              )}

                              {/* Data Type */}
                              <span className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-900 rounded">
                                {param.data_type}
                              </span>

                              {/* Locked Indicator */}
                              {isLocked && (
                                <span className="flex items-center gap-1 text-[11px] text-amber-400/80">
                                  <Lock className="w-3 h-3" /> Locked
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-400 mt-1">
                              {param.description || "System Parameter"}
                            </p>
                          </div>

                          {/* Interactive Value Input */}
                          <div className="flex items-center gap-3">
                            {param.data_type === "Boolean" ? (
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleValueChange(param.param_code, !currentValue)}
                                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                                  isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                                } ${currentValue ? "bg-indigo-600" : "bg-slate-800"}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    currentValue ? "translate-x-7" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            ) : param.data_type === "Integer" ? (
                              <input
                                type="number"
                                disabled={isLocked}
                                value={currentValue ?? 0}
                                onChange={(e) =>
                                  handleValueChange(param.param_code, parseInt(e.target.value) || 0)
                                }
                                className={`w-36 px-3 py-1.5 text-xs bg-slate-900 border rounded-xl font-mono text-slate-100 ${
                                  isLocked
                                    ? "opacity-50 cursor-not-allowed border-slate-800"
                                    : "border-slate-700 focus:border-indigo-500"
                                }`}
                              />
                            ) : param.data_type === "Decimal" ? (
                              <input
                                type="number"
                                step="0.01"
                                disabled={isLocked}
                                value={currentValue ?? 0.0}
                                onChange={(e) =>
                                  handleValueChange(param.param_code, parseFloat(e.target.value) || 0.0)
                                }
                                className={`w-36 px-3 py-1.5 text-xs bg-slate-900 border rounded-xl font-mono text-slate-100 ${
                                  isLocked
                                    ? "opacity-50 cursor-not-allowed border-slate-800"
                                    : "border-slate-700 focus:border-indigo-500"
                                }`}
                              />
                            ) : param.data_type === "Date" ? (
                              <input
                                type="date"
                                disabled={isLocked}
                                value={currentValue ? String(currentValue).slice(0, 10) : ""}
                                onChange={(e) =>
                                  handleValueChange(param.param_code, e.target.value)
                                }
                                className={`w-40 px-3 py-1.5 text-xs bg-slate-900 border rounded-xl font-mono text-slate-100 ${
                                  isLocked
                                    ? "opacity-50 cursor-not-allowed border-slate-800"
                                    : "border-slate-700 focus:border-indigo-500"
                                }`}
                              />
                            ) : (
                              <input
                                type="text"
                                disabled={isLocked}
                                value={currentValue ?? ""}
                                onChange={(e) =>
                                  handleValueChange(param.param_code, e.target.value)
                                }
                                className={`w-64 px-3 py-1.5 text-xs bg-slate-900 border rounded-xl font-mono text-slate-100 ${
                                  isLocked
                                    ? "opacity-50 cursor-not-allowed border-slate-800"
                                    : "border-slate-700 focus:border-indigo-500"
                                }`}
                              />
                            )}

                            {isDirty && (
                              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" title="Pending Save" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/70 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>Total Loaded: <strong className="text-slate-200">{parameters.length}</strong> parameters</span>
            <span>Pending Modifications: <strong className="text-indigo-300">{Object.keys(dirtyValues).length}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            {Object.keys(dirtyValues).length > 0 && (
              <button
                onClick={() => setDirtyValues({})}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
              >
                Discard Pending
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all font-medium"
            >
              Close
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
};
