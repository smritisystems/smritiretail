/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.36.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { SmritiScrollArea } from "./SmritiScrollArea";
import { Key, Shield, Plus, Trash2, Copy, Check, Terminal, Activity, Eye, AlertTriangle, Lock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface APIKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  service_account_id: string;
  rate_limit_per_minute: number;
  allowed_ip_cidrs: string[] | null;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
}

interface APIKeyLog {
  id: string;
  ip_address: string;
  endpoint: string;
  http_method: string;
  status_code: number;
  response_time_ms: number;
  timestamp: string;
}

export const ApiKeyManagementSection: React.FC = () => {
  const [keys, setKeys] = useState<APIKeyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateSAModal, setShowCreateSAModal] = useState<boolean>(false);
  const [showGenKeyModal, setShowGenKeyModal] = useState<boolean>(false);
  const [showSecretModal, setShowSecretModal] = useState<boolean>(false);
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);

  // New Service Account state
  const [saCode, setSaCode] = useState<string>("");
  const [saName, setSaName] = useState<string>("");
  const [saDesc, setSaDesc] = useState<string>("");

  // New API Key state
  const [saIdForGen, setSaIdForGen] = useState<string>("");
  const [keyName, setKeyName] = useState<string>("");
  const [permissionSetId, setPermissionSetId] = useState<string>("pol-inventory-mgmt");
  const [ipCidrsInput, setIpCidrsInput] = useState<string>("");
  const [rateLimit, setRateLimit] = useState<number>(600);

  // Generated Raw Secret (Shown Once)
  const [generatedRawKey, setGeneratedRawKey] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Logs State
  const [selectedKeyForLogs, setSelectedKeyForLogs] = useState<string | null>(null);
  const [keyLogs, setKeyLogs] = useState<APIKeyLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const data = await apiFetchV1("/api-keys");
      if (Array.isArray(data)) {
        setKeys(data);
      }
    } catch (err) {
      console.error("Failed to fetch API keys", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateServiceAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetchV1("/api-keys/service-accounts", {
        method: "POST",
        body: JSON.stringify({
          code: saCode,
          name: saName,
          description: saDesc || undefined,
        }),
      });
      if (res && res.id) {
        setSaIdForGen(res.id);
        setShowCreateSAModal(false);
        setSaCode("");
        setSaName("");
        setSaDesc("");
        setShowGenKeyModal(true);
      }
    } catch (err) {
      alert("Failed to create service account: " + (err as Error).message);
    }
  };

  const handleGenerateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cidrs = ipCidrsInput ? ipCidrsInput.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      const res = await apiFetchV1("/api-keys/generate", {
        method: "POST",
        body: JSON.stringify({
          service_account_id: saIdForGen || "sa-dft-01",
          name: keyName,
          permission_set_ids: [permissionSetId],
          allowed_ip_cidrs: cidrs,
          rate_limit_per_minute: Number(rateLimit),
        }),
      });
      if (res && res.raw_key) {
        setGeneratedRawKey(res.raw_key);
        setShowGenKeyModal(false);
        setKeyName("");
        setIpCidrsInput("");
        setShowSecretModal(true);
        fetchApiKeys();
      }
    } catch (err) {
      alert("Failed to generate API Key: " + (err as Error).message);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!window.confirm("Are you sure you want to revoke this API key? External applications using it will be disconnected immediately.")) {
      return;
    }
    try {
      await apiFetchV1(`/api-keys/${keyId}`, { method: "DELETE" });
      fetchApiKeys();
    } catch (err) {
      alert("Failed to revoke API key: " + (err as Error).message);
    }
  };

  const handleViewLogs = async (keyId: string) => {
    setSelectedKeyForLogs(keyId);
    setLoadingLogs(true);
    setShowLogsModal(true);
    try {
      const logs = await apiFetchV1(`/api-keys/${keyId}/logs`);
      if (Array.isArray(logs)) {
        setKeyLogs(logs);
      }
    } catch (err) {
      console.error("Failed to fetch API key logs", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedRawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 text-slate-100 bg-slate-950/40 rounded-xl border border-slate-800/60 backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Key className="w-6 h-6 text-emerald-400" />
            Service Accounts & API Keys (v3.35.0)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Programmatic API security credentials with SHA-256 secret hashing, IP CIDR containment, and permission set scoping.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateSAModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-slate-400" />
            New Service Account
          </button>
          <button
            onClick={() => {
              setSaIdForGen("sa-dft-01");
              setShowGenKeyModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-900/30 transition flex items-center gap-2"
          >
            <Key className="w-4 h-4" />
            Generate API Key
          </button>
        </div>
      </div>

      {/* Keys List */}
      <SmritiScrollArea className="max-h-[500px] pr-2">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading API key credentials...</div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
            No API keys found. Create a Service Account and generate a key to enable external programmatic integrations.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {keys.map((k) => (
              <div
                key={k.id}
                className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-700 transition"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-white">{k.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                      prefix: {k.key_prefix}****
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md font-bold ${
                        k.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {k.is_active ? "Active" : "Revoked"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                    <span>Rate Limit: <strong className="text-slate-200">{k.rate_limit_per_minute} req/min</strong></span>
                    <span>IP CIDR: <strong className="text-slate-200">{k.allowed_ip_cidrs ? k.allowed_ip_cidrs.join(", ") : "Any (Unrestricted)"}</strong></span>
                    <span>Last Used: <strong className="text-slate-200">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  <button
                    onClick={() => handleViewLogs(k.id)}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                    title="View Usage Audit Logs"
                  >
                    <Activity className="w-4 h-4" />
                  </button>
                  {k.is_active && (
                    <button
                      onClick={() => handleRevokeKey(k.id)}
                      className="p-2 text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 rounded-lg transition"
                      title="Revoke Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SmritiScrollArea>

      {/* Modal: Create Service Account */}
      <AnimatePresence>
        {showCreateSAModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                Create Service Account
              </h3>
              <form onSubmit={handleCreateServiceAccount} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Service Account Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SA-WMS-PROD"
                    value={saCode}
                    onChange={(e) => setSaCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Service Account Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Warehouse Sync Service"
                    value={saName}
                    onChange={(e) => setSaName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Description (Optional)</label>
                  <textarea
                    placeholder="Integration scope details..."
                    value={saDesc}
                    onChange={(e) => setSaDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none h-20"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateSAModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-500 shadow-md shadow-emerald-900/40"
                  >
                    Save & Next
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Generate API Key */}
      <AnimatePresence>
        {showGenKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                Generate API Key Credential
              </h3>
              <form onSubmit={handleGenerateApiKey} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Key Name / Identifier</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WMS Live Production Key"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Attached Permission Set</label>
                  <select
                    value={permissionSetId}
                    onChange={(e) => setPermissionSetId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                  >
                    <option value="pol-inventory-mgmt">Inventory Management Policy</option>
                    <option value="pol-sales-mgmt">Sales Management Policy</option>
                    <option value="pol-purchase-mgmt">Purchase Management Policy</option>
                    <option value="pol-reporting">Reporting Policy</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Allowed IP CIDR Ranges (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.0/24, 10.0.5.10/32"
                    value={ipCidrsInput}
                    onChange={(e) => setIpCidrsInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Rate Limit (Requests per Minute)</label>
                  <input
                    type="number"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowGenKeyModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-500 shadow-md shadow-emerald-900/40"
                  >
                    Generate Credential
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Secret Display (Shown ONCE) */}
      <AnimatePresence>
        {showSecretModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-emerald-500/50 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Save Your API Key Secret</h3>
              <p className="text-xs text-amber-400 bg-amber-950/40 p-3 rounded-lg border border-amber-800/50 text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                This raw secret token will <strong>NEVER be shown again</strong>. SMRITI OS stores only the SHA-256 cryptographic hash. Copy and save it securely in your configuration vault now.
              </p>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-3 font-mono text-xs text-emerald-300 break-all select-all">
                <span>{generatedRawKey}</span>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-sans shrink-0 flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowSecretModal(false)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
                >
                  I Have Saved My Secret Token
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: API Key Usage Audit Logs */}
      <AnimatePresence>
        {showLogsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  API Key Usage Audit Trail
                </h3>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Close
                </button>
              </div>

              <SmritiScrollArea className="max-h-80 pr-2">
                {loadingLogs ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading audit logs...</div>
                ) : keyLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">No request audit logs recorded for this key yet.</div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="py-2">Timestamp</th>
                        <th className="py-2">IP Address</th>
                        <th className="py-2">Method</th>
                        <th className="py-2">Endpoint</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {keyLogs.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-800/30">
                          <td className="py-2 text-slate-400">{new Date(l.timestamp).toLocaleTimeString()}</td>
                          <td className="py-2 font-mono text-slate-300">{l.ip_address}</td>
                          <td className="py-2 font-bold text-emerald-400">{l.http_method}</td>
                          <td className="py-2 font-mono text-slate-300 truncate max-w-[150px]">{l.endpoint}</td>
                          <td className="py-2 font-semibold text-emerald-400">{l.status_code}</td>
                          <td className="py-2 text-slate-400">{l.response_time_ms} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </SmritiScrollArea>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
