/**
 * Project      : SMRITI Retail OS
 * Kernel Facade: SMRITI Workspace Context (SWC)
 * Standard     : SCS-WSC-001 — Workspace Context & Resolver
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Responsibilities:
 *   - Implements immutable SPK.platform.current(), SPK.business.current(), SPK.ui.current()
 *   - Manages active workspace context derived from Tenant -> Company -> Branch -> Warehouse hierarchy
 *   - Emits Workspace.Changed.v1 events when workspace context is switched
 */

import { SPK } from "./SPK.js";
import { CapabilityRegistry } from "./registries/CapabilityRegistry.js";
import { FeatureFlagRegistry } from "./registries/FeatureFlagRegistry.js";
import { PolicyRegistry, WorkspaceOperationalPolicies } from "./registries/PolicyRegistry.js";

// ── Context Types (Immutable Readonly) ────────────────────────────────────────

export interface IPlatformContext {
  readonly userId: string;
  readonly username: string;
  readonly roleIds: readonly string[];
  readonly language: string;
  readonly theme: string;
  readonly deviceId?: string;
  readonly terminalId?: string;
  readonly licenseTier: string;
}

export interface IBusinessContext {
  readonly tenantId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly warehouseId?: string;
  readonly financialYearId: string;
  readonly priceListId?: string;
  readonly currency: string;
  readonly timezone: string;
}

export interface IUIContext {
  activeWorkspaceId: string;
  activeModule: string;
  activeScreen: string;
  keyboardMode: "STANDARD" | "ACCESSIBLE" | "TERMINAL";
  filters: Record<string, any>;
}

export interface RichWorkspaceSwitchPayload {
  workspace: {
    tenantId: string;
    companyId: string;
    branchId: string;
    warehouseId?: string;
    financialYearId: string;
    currency: string;
    timezone: string;
    language: string;
  };
  permissions: string[];
  features: Record<string, boolean>;
  policies: Partial<WorkspaceOperationalPolicies>;
  industryPack?: { id: string; name: string };
  branding?: { companyName: string; logoUrl?: string };
}

// ── Default Fallback Contexts ─────────────────────────────────────────────────

const DEFAULT_PLATFORM_CONTEXT: IPlatformContext = Object.freeze({
  userId: "usr-super-01",
  username: "super",
  roleIds: Object.freeze(["SYSADMIN", "MANAGER"]),
  language: "en-IN",
  theme: "dark",
  licenseTier: "Enterprise",
});

const DEFAULT_BUSINESS_CONTEXT: IBusinessContext = Object.freeze({
  tenantId: "tent-default",
  companyId: "comp-default",
  branchId: "br-01",
  warehouseId: "wh-01",
  financialYearId: "cfy-2026-2027",
  currency: "INR",
  timezone: "Asia/Kolkata",
});

class SWCFacadeService {
  private platformCtx: IPlatformContext = Object.freeze({ ...DEFAULT_PLATFORM_CONTEXT });
  private businessCtx: IBusinessContext = Object.freeze({ ...DEFAULT_BUSINESS_CONTEXT });
  private uiCtx: IUIContext = {
    activeWorkspaceId: "ws-main",
    activeModule: "pos",
    activeScreen: "billing",
    keyboardMode: "STANDARD",
    filters: {},
  };

  public get platform(): { current(): IPlatformContext } {
    return {
      current: () => this.platformCtx,
    };
  }

  public get business(): { current(): IBusinessContext } {
    return {
      current: () => this.businessCtx,
    };
  }

  public get ui(): { current(): IUIContext; update(patch: Partial<IUIContext>): void } {
    return {
      current: () => this.uiCtx,
      update: (patch: Partial<IUIContext>) => {
        this.uiCtx = { ...this.uiCtx, ...patch };
      },
    };
  }

  public switchWorkspaceContext(payload: RichWorkspaceSwitchPayload): void {
    // 1. Update Business Context (Immutable freeze)
    this.businessCtx = Object.freeze({
      tenantId: payload.workspace.tenantId,
      companyId: payload.workspace.companyId,
      branchId: payload.workspace.branchId,
      warehouseId: payload.workspace.warehouseId,
      financialYearId: payload.workspace.financialYearId,
      currency: payload.workspace.currency || "INR",
      timezone: payload.workspace.timezone || "Asia/Kolkata",
    });

    // 2. Update Feature Flags & Policies
    if (payload.features) {
      FeatureFlagRegistry.setFlags(payload.features);
    }
    if (payload.policies) {
      PolicyRegistry.setPolicies(payload.policies);
    }

    // 3. Emit Workspace.Changed.v1 event across SPK EventBus
    SPK.events.emit("Workspace.Changed.v1", payload.workspace.companyId, {
      workspace: this.businessCtx,
      permissions: payload.permissions,
      features: payload.features,
      industryPack: payload.industryPack,
      branding: payload.branding,
      timestamp: new Date().toISOString(),
    });
  }

  public setPlatformContext(ctx: Partial<IPlatformContext>): void {
    this.platformCtx = Object.freeze({
      ...this.platformCtx,
      ...ctx,
    });
  }
}

export const SWC = new SWCFacadeService();
