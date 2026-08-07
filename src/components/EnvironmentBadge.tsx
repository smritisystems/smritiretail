/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : Environment Badge Component (PROD-004 Compliant)
 * Standard     : SMAP Constitution v1.0 — Rule 24 (PROD-004 Persistent Environment Isolation)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 4.0.0
 */

import React, { useEffect, useState } from "react";
import { ShieldCheck, Database, FlaskConical, Code2, AlertTriangle } from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { OfflineSessionBadge } from "./OfflineSessionBadge.tsx";

export type EnvironmentType = "PRODUCTION" | "DEMO" | "TRAINING" | "TEST" | "DEVELOPMENT" | string;

interface EnvironmentBadgeProps {
  className?: string;
  showDetails?: boolean;
}

export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = ({ className = "", showDetails = false }) => {
  const [envType, setEnvType] = useState<EnvironmentType>("PRODUCTION");
  const [dbName, setDbName] = useState<string>("smriti_prod");

  useEffect(() => {
    let isMounted = true;
    apiFetchV1<{ environment_type?: string; database_name?: string }>("admin/environment/profile")
      .then((res) => {
        if (isMounted && res) {
          if (res.environment_type) setEnvType(res.environment_type.toUpperCase());
          if (res.database_name) setDbName(res.database_name);
        }
      })
      .catch(() => {
        // Fallback default is clean PRODUCTION per Rule PROD-003
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getStyle = () => {
    switch (envType) {
      case "PRODUCTION":
        return {
          bg: "rgba(16, 185, 129, 0.12)",
          color: "#10b981",
          borderColor: "rgba(16, 185, 129, 0.35)",
          icon: ShieldCheck,
          label: "PRODUCTION",
          badgeDot: "#10b981"
        };
      case "DEMO":
        return {
          bg: "rgba(245, 158, 11, 0.15)",
          color: "#f59e0b",
          borderColor: "rgba(245, 158, 11, 0.40)",
          icon: AlertTriangle,
          label: "DEMO ENVIRONMENT",
          badgeDot: "#f59e0b"
        };
      case "TRAINING":
        return {
          bg: "rgba(59, 130, 246, 0.12)",
          color: "#3b82f6",
          borderColor: "rgba(59, 130, 246, 0.35)",
          icon: Database,
          label: "TRAINING ENVIRONMENT",
          badgeDot: "#3b82f6"
        };
      case "DEVELOPMENT":
        return {
          bg: "rgba(168, 85, 247, 0.12)",
          color: "#a855f7",
          borderColor: "rgba(168, 85, 247, 0.35)",
          icon: Code2,
          label: "DEV ENVIRONMENT",
          badgeDot: "#a855f7"
        };
      default:
        return {
          bg: "rgba(99, 102, 241, 0.12)",
          color: "#6366f1",
          borderColor: "rgba(99, 102, 241, 0.35)",
          icon: FlaskConical,
          label: envType,
          badgeDot: "#6366f1"
        };
    }
  };

  const style = getStyle();
  const Icon = style.icon;

  return (
    <div className="inline-flex items-center gap-2">
      <OfflineSessionBadge />
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-semibold select-none transition-all ${className}`}
        style={{
          background: style.bg,
          color: style.color,
          borderColor: style.borderColor
        }}
        title={`Database: ${dbName} (${style.label})`}
      >
        <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: style.badgeDot }} />
        <Icon size={13} className="shrink-0" />
        <span>{style.label}</span>
        {showDetails && <span className="opacity-70 text-[10px]">({dbName})</span>}
      </div>
    </div>
  );
};
