/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : Offline / Cached Session Indicator Badge (PROD-006 Compliant)
 * Standard     : Rule PROD-006 — Fallback Runtime Awareness & Offline Session Transparency
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 4.0.0
 */

import React, { useEffect, useState } from "react";
import { WifiOff, Database, AlertCircle } from "lucide-react";
import { isLocalMockToken } from "../lib/apiFetchV1.ts";

interface OfflineSessionBadgeProps {
  className?: string;
}

export const OfflineSessionBadge: React.FC<OfflineSessionBadgeProps> = ({ className = "" }) => {
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [tokenType, setTokenType] = useState<string>("");

  useEffect(() => {
    const checkTokenState = () => {
      const token = typeof localStorage !== "undefined"
        ? (localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token"))
        : null;

      const isMock = isLocalMockToken(token);
      setIsOfflineMode(isMock);
      if (token) {
        setTokenType(token.startsWith("demo_") ? "DEMO SESSION" : "CACHED OFFLINE");
      } else {
        setTokenType("LOCAL STANDALONE");
      }
    };

    checkTokenState();
    window.addEventListener("storage", checkTokenState);
    return () => window.removeEventListener("storage", checkTokenState);
  }, []);

  if (!isOfflineMode) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono select-none ${className}`}
      title="Rule PROD-006: Operating in offline/cached demo session mode."
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
      <WifiOff size={12} />
      <span className="font-semibold text-[11px] uppercase tracking-wider">{tokenType}</span>
    </div>
  );
};
