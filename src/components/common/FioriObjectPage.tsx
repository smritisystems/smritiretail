/**
 * Project      : SMRITI Retail OS
 * Module       : SEEF Object Page Pattern Component (WNG-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.2.0  (SEEF Phase 5 — Token Upgrade)
 * Modified     : 2026-07-26
 * Note         : FioriObjectPage is preserved as a backward-compatible alias
 *                for SEEFObjectPage. All new code should use SEEFObjectPage.
 */

import React, { useState } from "react";
import { ArrowLeft, Save, Trash2, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useSEEF } from "../../layout_engine/SEEFContext.tsx";
import { FeatureKey, adaptiveWorkspaceStore } from "../../layout_engine/adaptive_workspace_store.js";

export interface ObjectPageTab {
  id: string;
  label: string;
  content: React.ReactNode;
  /**
   * SXP v1.0 — AdaptiveVisibilityRegistry gate.
   * If set, this tab is auto-hidden below its canRender() threshold.
   * Studios MUST NOT write if(mode==='ADVANCED') guards — set featureKey instead.
   */
  featureKey?: FeatureKey;
}

export interface ObjectPageMetric {
  label: string;
  value: string | number;
  highlight?: boolean;
}

interface FioriObjectPageProps {
  title: string;
  subtitle?: string;
  badgeStatus?: { label: string; type: "success" | "warning" | "info" | "error" };
  metrics?: ObjectPageMetric[];
  tabs: ObjectPageTab[];
  onBack?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  isSaving?: boolean;
  headerActions?: React.ReactNode;
}

export const FioriObjectPage: React.FC<FioriObjectPageProps> = ({
  title,
  subtitle,
  badgeStatus,
  metrics = [],
  tabs,
  onBack,
  onSave,
  onDelete,
  isSaving = false,
  headerActions,
}) => {
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || "");
  const { config } = useSEEF();

  // SXP v1.0 — Filter tabs via AdaptiveVisibilityRegistry (no inline mode checks)
  const visibleTabs = tabs.filter(
    (t) => !t.featureKey || adaptiveWorkspaceStore.canRender(t.featureKey)
  );
  // If current active tab was filtered out, default to first visible tab
  const resolvedTabId = visibleTabs.find((t) => t.id === activeTabId)
    ? activeTabId
    : (visibleTabs[0]?.id ?? "");

  const activeTabContent = visibleTabs.find((t) => t.id === resolvedTabId)?.content;

  const badgeColorMap = {
    success: { color: "var(--c-seef-success)", bg: "rgba(24,128,56,0.10)", border: "rgba(24,128,56,0.25)" },
    warning: { color: "var(--c-seef-warning)", bg: "rgba(242,153,0,0.10)", border: "rgba(242,153,0,0.25)" },
    info:    { color: "var(--c-seef-info)",    bg: "rgba(8,84,160,0.10)",  border: "rgba(8,84,160,0.25)" },
    error:   { color: "var(--c-seef-error)",   bg: "rgba(187,0,0,0.10)",   border: "rgba(187,0,0,0.25)" },
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "var(--c-theme-surface-1)",
      color: "var(--c-theme-body)",
      borderRadius: "var(--seef-radius-active-xl)",
      border: "var(--seef-card-border)",
      overflow: "hidden",
      boxShadow: "var(--seef-elevation-2)",
    }}>
      {/* 1. Object Page Summary Header */}
      <div style={{
        padding: "var(--seef-space-xl)",
        background: "var(--c-theme-surface-2)",
        borderBottom: "1px solid var(--c-theme-divider)",
      }}>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--seef-space-md)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--seef-space-md)" }}>
            {onBack && (
              <button
                onClick={onBack}
                className="seef-interactive seef-focus-ring"
                style={{
                  padding: "6px",
                  borderRadius: "var(--seef-radius-active-md)",
                  background: "var(--c-theme-surface-hover)",
                  border: "none",
                  color: "var(--c-theme-muted)",
                  cursor: "pointer",
                  display: "flex",
                }}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--seef-space-sm)" }}>
                <h1 style={{
                  margin: 0,
                  fontSize: "var(--seef-font-size-xl)",
                  fontWeight: 700,
                  color: "var(--c-theme-body)",
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.02em",
                }}>
                  {title}
                </h1>
                {badgeStatus && (() => {
                  const bc = badgeColorMap[badgeStatus.type];
                  return (
                    <span style={{
                      padding: "2px 10px",
                      fontSize: "var(--seef-font-size-xs)",
                      fontWeight: 600,
                      borderRadius: "var(--seef-radius-active-full)",
                      background: bc.bg,
                      color: bc.color,
                      border: `1px solid ${bc.border}`,
                    }}>
                      {badgeStatus.label}
                    </span>
                  );
                })()}
              </div>
              {subtitle && (
                <p style={{
                  margin: "2px 0 0",
                  fontSize: "var(--seef-font-size-xs)",
                  color: "var(--c-theme-muted)",
                }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--seef-space-sm)" }}>
            {headerActions}
            {onDelete && (
              <button
                onClick={onDelete}
                className="seef-interactive seef-focus-ring"
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--seef-radius-active-md)",
                  fontSize: "var(--seef-font-size-sm)",
                  fontWeight: 600,
                  background: "rgba(187,0,0,0.08)",
                  color: "var(--c-seef-error)",
                  border: "1px solid rgba(187,0,0,0.25)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
            {onSave && (
              <button
                onClick={onSave}
                disabled={isSaving}
                className="seef-interactive seef-focus-ring"
                style={{
                  padding: "6px 16px",
                  borderRadius: "var(--seef-radius-active-md)",
                  fontSize: "var(--seef-font-size-sm)",
                  fontWeight: 600,
                  background: "var(--c-seef-accent)",
                  color: "#fff",
                  border: "none",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  boxShadow: "var(--seef-elevation-1)",
                }}
              >
                <Save size={13} />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>

        {/* Key Metrics Bar */}
        {metrics.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(120px, 1fr))`,
            gap: "var(--seef-space-md)",
            marginTop: "var(--seef-space-lg)",
            paddingTop: "var(--seef-space-lg)",
            borderTop: "1px solid var(--c-theme-divider)",
          }}>
            {metrics.map((m, idx) => (
              <div
                key={idx}
                style={{
                  padding: "var(--seef-space-md)",
                  borderRadius: "var(--seef-radius-active-md)",
                  background: "var(--c-theme-surface-1)",
                  border: "1px solid var(--c-theme-divider)",
                }}
              >
                <span style={{
                  fontSize: "var(--seef-font-size-xs)",
                  color: "var(--c-theme-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "block",
                }}>
                  {m.label}
                </span>
                <span style={{
                  fontSize: "var(--seef-font-size-lg)",
                  fontWeight: 700,
                  color: m.highlight ? "var(--c-seef-accent)" : "var(--c-theme-body)",
                  fontFamily: m.highlight ? "var(--font-mono)" : "var(--font-display)",
                  display: "block",
                  marginTop: "2px",
                }}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Horizontal Tab Navigation */}
      <div style={{
        display: "flex",
        background: "var(--c-theme-surface-2)",
        borderBottom: "1px solid var(--c-theme-divider)",
        overflowX: "auto",
        flexShrink: 0,
      }}>
        {visibleTabs.map((tab) => {
          const active = resolvedTabId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className="seef-interactive seef-focus-ring"
              style={{
                padding: "var(--seef-space-md) var(--seef-space-lg)",
                border: "none",
                borderBottom: active
                  ? "2px solid var(--c-seef-accent)"
                  : "2px solid transparent",
                background: "none",
                color: active ? "var(--c-seef-accent)" : "var(--c-theme-muted)",
                fontSize: "var(--seef-font-size-sm)",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all var(--seef-motion-fast) var(--seef-ease-standard)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. Active Tab Content */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "var(--seef-space-xl)",
        background: "var(--c-theme-surface-1)",
      }}>
        {activeTabContent}
      </div>
    </div>
  );
};

// Backward-compatible alias — FioriObjectPage is now SEEFObjectPage & SEDSObjectPage
export const SEEFObjectPage = FioriObjectPage;
export const SEDSObjectPage = FioriObjectPage;

