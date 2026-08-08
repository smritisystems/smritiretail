/**
 * Project      : SMRITI Retail OS
 * Module       : AI Configuration Settings Tab (Rule AI-001 / AOP-001 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Bot,
  Key,
  Sliders,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Cpu,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

interface AIConfigState {
  enabled: boolean;
  provider: string;
  apiKey: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  timeoutSeconds: number;
}

interface AIConfigurationTabProps {
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

const PROVIDERS = [
  { id: "none", name: "None (Disabled)", requiresKey: false },
  { id: "gemini", name: "Google Gemini", requiresKey: true },
  { id: "openai", name: "OpenAI (GPT-4o / GPT-5)", requiresKey: true },
  { id: "claude", name: "Anthropic Claude", requiresKey: true },
  { id: "ollama", name: "Ollama (Local / Offline)", requiresKey: false },
  { id: "lmstudio", name: "LM Studio (Local / Offline)", requiresKey: false },
  { id: "azure", name: "Azure OpenAI Service", requiresKey: true },
  { id: "openrouter", name: "OpenRouter Unified API", requiresKey: true },
  { id: "custom", name: "Custom API Endpoint", requiresKey: false }
];

export const AIConfigurationTab: React.FC<AIConfigurationTabProps> = ({ onNotification }) => {
  const [config, setConfig] = useState<AIConfigState>({
    enabled: false,
    provider: "none",
    apiKey: "",
    defaultModel: "gemini-1.5-flash",
    temperature: 0.3,
    maxTokens: 4096,
    timeoutSeconds: 30
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await apiFetchV1("/ai/config");
      if (data) {
        setConfig({
          enabled: Boolean(data.enabled),
          provider: data.provider || "none",
          apiKey: data.apiKey || "",
          defaultModel: data.defaultModel || "gemini-1.5-flash",
          temperature: typeof data.temperature === "number" ? data.temperature : 0.3,
          maxTokens: data.maxTokens || 4096,
          timeoutSeconds: data.timeoutSeconds || 30
        });
      }
    } catch (err: any) {
      console.warn("Failed to fetch AI configuration, using defaults:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetchV1("/ai/config", {
        method: "POST",
        body: JSON.stringify(config)
      });
      onNotification(
        "AI Governance Config Saved",
        config.enabled
          ? `AI Features enabled with provider: ${config.provider.toUpperCase()}`
          : "AI Features disabled per Rule AI-001 (AOP-001). Core business workflows operate 100% offline.",
        "success"
      );
    } catch (err: any) {
      onNotification("Save Error", err?.message || "Failed to update AI Configuration.", "error");
    } finally {
      setSaving(false);
    }
  };

  const selectedProviderInfo = PROVIDERS.find((p) => p.id === config.provider) || PROVIDERS[0];

  return (
    <div className="w-full h-full overflow-y-auto bg-theme-base text-theme-body p-6 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Banner Header */}
        <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 text-xs font-mono rounded bg-[#354a5e] text-white border border-[#4c6680] flex items-center gap-1.5 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[var(--c-seef-accent)]" /> Rule AI-001 / AOP-001 Certified
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-theme-heading flex items-center gap-2">
              <Bot className="w-6 h-6 text-[var(--c-seef-accent)]" /> AI Engine Configuration
            </h1>
            <p className="text-sm text-theme-muted">
              SMRITI Retail OS operates <strong>100% standalone</strong>. AI is strictly optional and advisory.
            </p>
          </div>

          {/* Current Status Pill */}
          <div className="flex items-center gap-3">
            <div
              className={`px-4 py-2 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                config.enabled
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-theme-surface-2 border-theme-divider text-theme-muted"
              }`}
            >
              {config.enabled ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>AI Active: {config.provider.toUpperCase()}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-theme-muted" />
                  <span>AI Disabled (Default)</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Governance Principle Alert */}
        <div className="bg-[var(--c-seef-accent)]/10 border border-[var(--c-seef-accent)]/30 rounded-lg p-4 text-xs leading-relaxed text-theme-heading flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[var(--c-seef-accent)] shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold text-[var(--c-seef-accent)]">Product Governance Rule AI-001:</strong>
            <p className="mt-0.5 text-theme-muted">
              "AI is Optional. Business Operations are Mandatory." Disabling AI will cleanly remove AI Assistant, Prompt Studio, and AI buttons from the UI without affecting POS billing, inventory management, reports, or accounting.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-12 text-center text-sm text-theme-muted flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[var(--c-seef-accent)]" /> Loading configuration...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. Toggle AI Enablement */}
            <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-theme-muted flex items-center gap-2 border-b border-theme-divider pb-2">
                <Cpu className="w-4 h-4 text-[var(--c-seef-accent)]" /> Activation & Master Switch
              </h2>

              <label className="flex items-center justify-between p-4 rounded-lg bg-theme-surface-2 border border-theme-divider cursor-pointer hover:border-[var(--c-seef-accent)] transition-all">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-theme-heading block">Enable AI Features</span>
                  <span className="text-xs text-theme-muted block">
                    When switched OFF, all AI menus, assistants, and external API requests are blocked.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                      provider: e.target.checked && prev.provider === "none" ? "gemini" : prev.provider
                    }))
                  }
                  className="w-5 h-5 rounded border-theme-divider text-[var(--c-seef-accent)] focus:ring-[var(--c-seef-accent)] accent-[#0a6ed1] cursor-pointer"
                />
              </label>
            </div>

            {/* 2. Provider & Model Settings (Visible when enabled or configuring) */}
            <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-6 shadow-xs space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-theme-muted flex items-center gap-2 border-b border-theme-divider pb-2">
                <Bot className="w-4 h-4 text-[var(--c-seef-accent)]" /> AI Provider & Credentials
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-theme-heading block">AI Provider</label>
                  <select
                    value={config.provider}
                    disabled={!config.enabled}
                    onChange={(e) => setConfig((prev) => ({ ...prev, provider: e.target.value }))}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-heading focus:ring-2 focus:ring-[var(--c-seef-accent)] disabled:opacity-50"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Default Model */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-theme-heading block">Default Model Name</label>
                  <input
                    type="text"
                    disabled={!config.enabled}
                    value={config.defaultModel}
                    onChange={(e) => setConfig((prev) => ({ ...prev, defaultModel: e.target.value }))}
                    placeholder="e.g. gemini-1.5-flash, gpt-4o, llama3"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-heading focus:ring-2 focus:ring-[var(--c-seef-accent)] disabled:opacity-50 font-mono"
                  />
                </div>
              </div>

              {/* API Key Field */}
              {selectedProviderInfo.requiresKey && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-theme-heading flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-[var(--c-seef-accent)]" /> API Key ({selectedProviderInfo.name})
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      disabled={!config.enabled}
                      value={config.apiKey}
                      onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="Enter provider API key..."
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-theme-heading focus:ring-2 focus:ring-[var(--c-seef-accent)] disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-2.5 text-theme-muted hover:text-theme-heading"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Performance & Safety Parameters */}
            <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-6 shadow-xs space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-theme-muted flex items-center gap-2 border-b border-theme-divider pb-2">
                <Sliders className="w-4 h-4 text-[var(--c-seef-accent)]" /> Execution & Safety Limits
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Temperature */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-theme-heading block">
                    Temperature ({config.temperature})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    disabled={!config.enabled}
                    value={config.temperature}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-[#0a6ed1] disabled:opacity-50"
                  />
                  <span className="text-[10px] text-theme-muted block">0.0 = Deterministic, 1.0 = Creative</span>
                </div>

                {/* Max Tokens */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-theme-heading block">Max Tokens</label>
                  <input
                    type="number"
                    disabled={!config.enabled}
                    value={config.maxTokens}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, maxTokens: parseInt(e.target.value) || 4096 }))
                    }
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-mono text-theme-heading focus:ring-2 focus:ring-[var(--c-seef-accent)] disabled:opacity-50"
                  />
                </div>

                {/* Timeout */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-theme-heading flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[var(--c-seef-accent)]" /> Timeout (Seconds)
                  </label>
                  <input
                    type="number"
                    disabled={!config.enabled}
                    value={config.timeoutSeconds}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, timeoutSeconds: parseInt(e.target.value) || 30 }))
                    }
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-mono text-theme-heading focus:ring-2 focus:ring-[var(--c-seef-accent)] disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-theme-divider">
              <span className="text-xs font-mono text-theme-muted">
                System Governance: Rule AI-001 (AOP-001) Enforced
              </span>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-[var(--c-seef-accent)] hover:bg-[var(--c-seef-accent)]/90 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save AI Configuration
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
