/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 12.1.0 (SMP-001 v1.0 Baseline Compliant)
 * Created      : 2026-07-21
 * Modified     : 2026-07-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Frontend Capability Store Gateway
 */

import { apiFetchV1 } from "./apiFetchV1";

export interface ModuleManifestDTO {
  id: string;
  uuid: string;
  name: string;
  display_name: string;
  category: string;
  module_type: string;
  version: string;
  stability: string;
  trust_tier: string;
  license_tier: string;
  critical: boolean;
  status: 'ENABLED' | 'DISABLED' | 'NOT_INSTALLED' | 'LOCKED';
  depends_on: string[];
  permissions: string[];
  routes: string[];
}

export interface DiagnosticsDTO {
  spk_version: string;
  smp_specification: string;
  lifecycle_state: string;
  startup_duration_ms: number;
  total_registered_modules: number;
  active_enabled_modules: number;
  active_api_routes: number;
  active_permissions: number;
  memory_footprint_mb: number;
  event_queue_depth: number;
}

export interface CapabilityStoreState {
  modules: ModuleManifestDTO[];
  diagnostics: DiagnosticsDTO | null;
  isLoading: boolean;
  error: string | null;
}

class CapabilityStoreManager {
  private state: CapabilityStoreState = {
    modules: [],
    diagnostics: null,
    isLoading: false,
    error: null,
  };

  private listeners: Set<() => void> = new Set();

  public getState(): CapabilityStoreState {
    return this.state;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public async fetchCapabilities(): Promise<void> {
    this.state = { ...this.state, isLoading: true, error: null };
    this.notify();
    try {
      const res = await apiFetchV1('capabilities');
      if (!res.ok) throw new Error('Failed to load capability matrix');
      const data = await res.json();

      const perfRes = await apiFetchV1('capabilities/performance');
      const perfData = perfRes.ok ? await perfRes.json() : null;

      this.state = {
        modules: data.modules || [],
        diagnostics: perfData,
        isLoading: false,
        error: null,
      };
    } catch (err: any) {
      this.state = { ...this.state, error: err.message || 'Capability matrix fetch error', isLoading: false };
    }
    this.notify();
  }

  public async toggleModule(moduleId: string, enable: boolean): Promise<void> {
    try {
      const res = await apiFetchV1(`capabilities/${moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enable }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || 'Failed to toggle module state');
      }
      await this.fetchCapabilities();
    } catch (err: any) {
      this.state = { ...this.state, error: err.message };
      this.notify();
      throw err;
    }
  }

  public async applyProfile(profileId: string): Promise<void> {
    try {
      const res = await apiFetchV1(`capabilities/profiles/${profileId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to apply profile');
      await this.fetchCapabilities();
    } catch (err: any) {
      this.state = { ...this.state, error: err.message };
      this.notify();
      throw err;
    }
  }

  public hasCapability(moduleId: string): boolean {
    const mod = this.state.modules.find((m: ModuleManifestDTO) => m.id === moduleId);
    if (!mod) return false;
    if (mod.critical) return true;
    return mod.status === 'ENABLED';
  }
}

export const capabilityStore = new CapabilityStoreManager();
