/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : Environment Resolver Engine (PROD-004 & PROD-005 Compliant)
 * Standard     : Rule PROD-004 — Persistent Environment Isolation & Environment Context Authority
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 4.1.0
 */

export type EnvironmentCategory = "UNKNOWN" | "LOCAL" | "DEVELOPMENT" | "STAGING" | "PRODUCTION";

export interface EnvironmentInfo {
  mode: EnvironmentCategory;
  databaseName: string;
  badgeLabel: string;
  isDemo: boolean;
  showDevCredentials: boolean;
  isProduction: boolean;
}

export class EnvironmentResolver {
  public static unresolved(): EnvironmentInfo {
    return {
      mode: "UNKNOWN",
      databaseName: "smriti_prod",
      badgeLabel: "RESOLVING...",
      isDemo: false,
      showDevCredentials: false,
      isProduction: false,
    };
  }

  public static resolve(params?: {
    hostname?: string;
    backendEnvType?: string;
    backendDbName?: string;
    viteEnv?: string;
    localOverride?: string;
  }): EnvironmentInfo {
    const hostname = params?.hostname ?? (typeof window !== "undefined" && window.location?.hostname ? window.location.hostname : "localhost");
    const rawVite = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_ENVIRONMENT : "";
    const viteEnv = ((params?.viteEnv ?? rawVite) || "").toLowerCase();
    const backendEnv = (params?.backendEnvType ?? "").toUpperCase();
    const backendDb = params?.backendDbName;

    // 1. Explicit Backend Response has highest authority if available
    if (backendEnv === "PRODUCTION") {
      return {
        mode: "PRODUCTION",
        databaseName: backendDb || "smriti_prod",
        badgeLabel: "PRODUCTION",
        isDemo: false,
        showDevCredentials: false,
        isProduction: true,
      };
    }
    if (backendEnv === "STAGING") {
      return {
        mode: "STAGING",
        databaseName: backendDb || "smriti_staging",
        badgeLabel: "STAGING",
        isDemo: false,
        showDevCredentials: false,
        isProduction: false,
      };
    }
    if (backendEnv === "DEVELOPMENT" || backendEnv === "DEV" || backendEnv === "DEMO" || backendEnv === "TRAINING") {
      return {
        mode: "DEVELOPMENT",
        databaseName: backendDb || (backendEnv === "DEMO" ? "smriti_demo" : "smriti_dev"),
        badgeLabel: backendEnv === "DEMO" ? "DEMO ENVIRONMENT" : "DEVELOPMENT",
        isDemo: backendEnv === "DEMO",
        showDevCredentials: true,
        isProduction: false,
      };
    }

    // 2. Client-side Environment Configuration & Hostname Heuristic (Post-Resolution Fallback)
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local") || hostname.endsWith(".test");
    const isStagingDomain = hostname.includes("staging") || hostname.includes("preview");
    const isExplicitProd = viteEnv === "production" || params?.localOverride === "production";

    if (isLocalHost) {
      if (isExplicitProd) {
        return {
          mode: "PRODUCTION",
          databaseName: backendDb || "smriti_prod",
          badgeLabel: "PRODUCTION (Local Conn)",
          isDemo: false,
          showDevCredentials: false,
          isProduction: true,
        };
      }
      return {
        mode: "DEVELOPMENT",
        databaseName: backendDb || "smriti_dev",
        badgeLabel: "LOCAL STANDALONE",
        isDemo: true,
        showDevCredentials: true,
        isProduction: false,
      };
    }

    if (isStagingDomain) {
      return {
        mode: "STAGING",
        databaseName: backendDb || "smriti_staging",
        badgeLabel: "STAGING",
        isDemo: false,
        showDevCredentials: false,
        isProduction: false,
      };
    }

    if (isExplicitProd) {
      return {
        mode: "PRODUCTION",
        databaseName: backendDb || "smriti_prod",
        badgeLabel: "PRODUCTION",
        isDemo: false,
        showDevCredentials: false,
        isProduction: true,
      };
    }

    // Default Fallback
    return {
      mode: "PRODUCTION",
      databaseName: backendDb || "smriti_prod",
      badgeLabel: "PRODUCTION",
      isDemo: false,
      showDevCredentials: false,
      isProduction: true,
    };
  }

  public static shouldShowDevCredentials(envInfo?: EnvironmentInfo | null): boolean {
    if (!envInfo) return false;
    if (envInfo.mode === "UNKNOWN") return false; // Strict Fail-Closed Rule: Never expose during UNKNOWN/RESOLVING!
    if (envInfo.isProduction || envInfo.mode === "PRODUCTION" || envInfo.mode === "STAGING") {
      return false;
    }
    if (envInfo.mode !== "DEVELOPMENT" && envInfo.mode !== "LOCAL") {
      return false;
    }
    return Boolean(envInfo.showDevCredentials);
  }
}
