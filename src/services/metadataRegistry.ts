/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

export interface ModuleMetadata {
  id: string;
  name: string;
  version: string;
  owner: string;
  description: string;
  dependencies?: string[];
  relatedModules?: string[];
  apiEndpoints?: string[];
  databaseTables?: string[];
  permissions?: string[];
  lastUpdated?: string;
}

// Scope narrowed to module metadata only per ADR-002 (docs/architecture/decisions/ADR-002-SMRITI-METADATA-ARCHITECTURE.md), disposition (a).
class MetadataRegistryService {
  private modules: Map<string, Readonly<ModuleMetadata>> = new Map();
  private listeners: Set<() => void> = new Set();

  registerModule(metadata: ModuleMetadata) {
    const existing = this.modules.get(metadata.id);
    const payload = Object.freeze({ ...metadata });

    if (existing) {
      const existingJson = JSON.stringify(existing);
      const payloadJson = JSON.stringify(payload);
      if (existingJson !== payloadJson) {
        throw new Error(`Module '${metadata.id}' is already registered with different metadata.`);
      }
      return;
    }

    this.modules.set(payload.id, payload);
    this.emitChange();
  }

  getModule(id: string): Readonly<ModuleMetadata> | undefined {
    return this.modules.get(id);
  }

  getModules(): ReadonlyArray<Readonly<ModuleMetadata>> {
    return Array.from(this.modules.values());
  }

  getAllMetadata() {
    return {
      modules: this.getModules(),
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear() {
    this.modules.clear();
    this.emitChange();
  }

  private emitChange() {
    this.listeners.forEach((listener) => listener());
  }
}

export const MetadataRegistry = new MetadataRegistryService();
