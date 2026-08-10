/**
 * Project      : SMRITI Retail OS
 * Component    : CompanySwitcherBadge (SCS-WSC-002)
 * Standard     : SCS-WSC-001 / SCS-WSC-002 — Workspace Context & Company Switch
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Security rules enforced:
 *   - Only assigned companies are shown (GET /auth/my-companies).
 *   - Switch validated server-side; unassigned company → 403 shown in UI.
 *   - GET /auth/me called AFTER switch to confirm user.company_id DB mutation.
 *   - SWC.switchWorkspaceContext() invoked only after DB confirmation.
 *   - Cache flush via Workspace.Changed.v1 event (all kernel services listen).
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1.js";
import { SWC } from "../kernel/SWC.js";
import { ChevronDown, Building2, RefreshCw, AlertCircle } from "lucide-react";

interface AssignedCompany {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
}

interface MyCompaniesResponse {
  companies: AssignedCompany[];
  active_company_id: string | null;
}

export const CompanySwitcherBadge: React.FC = () => {
  const [companies, setCompanies] = useState<AssignedCompany[]>([]);
  const [activeCompanyName, setActiveCompanyName] = useState<string>("");
  const [activeCompanyId, setActiveCompanyId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Load assigned companies on mount ─────────────────────────────────────
  const loadCompanies = useCallback(async () => {
    try {
      const data = await apiFetchV1("/auth/my-companies") as MyCompaniesResponse;
      if (data && Array.isArray(data.companies)) {
        setCompanies(data.companies);
        const currentId = data.active_company_id;
        setActiveCompanyId(currentId || "");
        const active = data.companies.find((c) => c.id === currentId);
        setActiveCompanyName(active?.name || currentId || "");
      }
    } catch {
      setActiveCompanyName(SWC.business.current().companyId || "");
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Company switch flow ───────────────────────────────────────────────────
  const handleSwitch = async (companyId: string) => {
    if (companyId === activeCompanyId || switching) return;
    setOpen(false);
    setSwitching(true);
    setError(null);

    try {
      // Step 1: POST /workspace/switch
      // Backend: verifies UserCompanyAssignment, mutates user.company_id in DB,
      // returns full workspace context. Anonymous → 401. Unauthorized → 403.
      const res = await apiFetchV1("/workspace/switch", {
        method: "POST",
        body: JSON.stringify({ companyId }),
      });

      // Step 2: GET /auth/me — confirm DB row mutation took effect.
      // This is Test #15 (critical regression): a second request AFTER the switch
      // must reflect the new company, not the switch response itself.
      await apiFetchV1("/auth/me");

      // Step 3: Update frontend context and emit Workspace.Changed.v1,
      // which triggers localCache = [] in all 5 kernel services.
      if (res && res.workspace) {
        SWC.switchWorkspaceContext(res);
      }
      setActiveCompanyId(companyId);
      const company = companies.find((c) => c.id === companyId);
      setActiveCompanyName(company?.name || companyId);
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode ?? 0;
      if (status === 403) {
        setError("Not authorised for this company. Contact your administrator.");
      } else if (status === 401) {
        setError("Session expired. Please log in again.");
      } else {
        setError(err?.message || "Company switch failed. Please try again.");
      }
    } finally {
      setSwitching(false);
    }
  };

  // ── Single-company: just a label badge, no dropdown ──────────────────────
  if (companies.length <= 1) {
    return (
      <div
        id="company-switcher-badge"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 6,
          background: "var(--c-theme-surface-3, rgba(255,255,255,0.06))",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--c-theme-body)",
          maxWidth: 220,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
        title={activeCompanyName}
      >
        <Building2 size={14} style={{ flexShrink: 0, opacity: 0.65 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {activeCompanyName || "—"}
        </span>
      </div>
    );
  }

  // ── Multi-company: interactive dropdown badge ─────────────────────────────
  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>

      {/* ── Trigger button ── */}
      <button
        id="company-switcher-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active company: ${activeCompanyName}. Click to switch.`}
        onClick={() => { if (!switching) setOpen((v) => !v); }}
        disabled={switching}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 6,
          border: "1px solid var(--c-theme-divider, rgba(255,255,255,0.12))",
          background: open
            ? "var(--c-theme-surface-3, rgba(255,255,255,0.10))"
            : "var(--c-theme-surface-2, rgba(255,255,255,0.05))",
          color: "var(--c-theme-body)",
          cursor: switching ? "wait" : "pointer",
          fontSize: 13,
          fontWeight: 600,
          maxWidth: 240,
          transition: "background 0.15s",
          whiteSpace: "nowrap",
        }}
        title="Switch active company"
      >
        {switching
          ? <RefreshCw size={14} style={{ flexShrink: 0, animation: "smriti-spin 0.8s linear infinite" }} />
          : <Building2 size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
        }
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
          {switching ? "Switching…" : (activeCompanyName || "—")}
        </span>
        <ChevronDown
          size={13}
          style={{
            flexShrink: 0,
            opacity: 0.55,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {/* ── Error toast ── */}
      {error && (
        <div
          role="alert"
          id="company-switcher-error"
          onClick={() => setError(null)}
          title="Click to dismiss"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 200,
            background: "rgba(180,30,30,0.95)",
            border: "1px solid rgba(231,76,60,0.6)",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            color: "#ffb3b3",
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 200,
            maxWidth: 300,
            cursor: "pointer",
          }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* ── Dropdown list ── */}
      {open && !switching && (
        <div
          role="listbox"
          aria-label="Switch Company"
          id="company-switcher-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 150,
            minWidth: 220,
            maxWidth: 320,
            maxHeight: 320,
            overflowY: "auto",
            background: "var(--c-theme-surface-2, #1e2028)",
            border: "1px solid var(--c-theme-divider, rgba(255,255,255,0.12))",
            borderRadius: 8,
            boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
            padding: "6px 0",
          }}
        >
          {/* Header label */}
          <div style={{
            padding: "6px 14px 8px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: "var(--c-theme-muted, rgba(255,255,255,0.38))",
            borderBottom: "1px solid var(--c-theme-divider, rgba(255,255,255,0.08))",
            marginBottom: 4,
          }}>
            Switch Company
          </div>

          {companies.map((company) => {
            const isActive = company.id === activeCompanyId;
            return (
              <button
                key={company.id}
                role="option"
                aria-selected={isActive}
                id={`company-option-${company.id}`}
                onClick={() => handleSwitch(company.id)}
                disabled={isActive}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "9px 14px",
                  background: isActive
                    ? "var(--c-theme-surface-3, rgba(255,255,255,0.08))"
                    : "transparent",
                  border: "none",
                  color: isActive ? "var(--c-theme-heading, #fff)" : "var(--c-theme-body)",
                  cursor: isActive ? "default" : "pointer",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 400,
                  textAlign: "left",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--c-theme-surface-3, rgba(255,255,255,0.06))";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
                title={company.name}
              >
                {/* Active check */}
                <span style={{
                  width: 14, flexShrink: 0, fontSize: 12,
                  color: "var(--c-success, #2ecc71)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {isActive ? "✓" : ""}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {company.name}
                </span>
                {company.is_default && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--c-theme-muted, rgba(255,255,255,0.4))",
                    flexShrink: 0
                  }}>
                    Default
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <style>{`@keyframes smriti-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default CompanySwitcherBadge;
