/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : AuditLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — Rule 18 (DCP-001)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, LookupManifest, SPK } from "../SPK.js";
import { IAuditService, AuditLogRecord } from "../public/IAuditService.js";

export class AuditLookupProvider implements ILookupProvider {
  public readonly domain = "AUDIT";
  public readonly state = "ACTIVE";

  public readonly manifest: LookupManifest = {
    manifestVersion: "2.3.0",
    schemaVersion: "1.0.0",
    minimumKernelVersion: "1.0.0",
    domain: "AUDIT",
    title: "Platform Audit Log Register",
    icon: "shield-check",
    defaultColumns: [
      { key: "code", label: "Audit / Event ID", type: "text" },
      { key: "action", label: "Action Executed", type: "text" },
      { key: "user", label: "Executed By", type: "text" },
      { key: "timestamp", label: "Timestamp", type: "date" }
    ],
    searchFields: ["code", "action", "user", "targetEntity"],
    filterGroups: [],
    sortOptions: [{ label: "Timestamp", key: "timestamp", order: "desc" }],
    savedViews: [],
    permissions: {
      readScope: "audit:read",
      costScope: "audit:read_sensitive"
    },
    quickActions: [],
    keyboardShortcuts: { universalSearch: "F2" },
    defaultLayout: "table",
    supportedModes: ["workspace", "global"],
    capabilities: {
      barcode: false,
      qr: false,
      voice: false,
      ai: true,
      bulkSelection: true,
      quickCreate: false
    }
  };

  async search(query: string): Promise<ILookupItem[]> {
    const auditService = SPK.services.resolve<IAuditService>("AUDIT");
    const list: AuditLogRecord[] = typeof auditService.queryLogs === "function"
      ? await auditService.queryLogs(query)
      : typeof (auditService as any).getAllLogs === "function"
      ? await (auditService as any).getAllLogs()
      : [];

    return list.map((a: AuditLogRecord) => ({
      id: a.id,
      code: a.id,
      name: `[${a.action || "EVENT"}] by ${a.userName || "SYSTEM"}`,
      title: `Event #${a.id}`,
      subtitle: `Action: ${a.action || "LOG"} • User: ${a.userName || "SYSTEM"}`,
      badge: `Module: ${a.module || "SYSTEM"}`,
      type: "AUDIT",
      columns: { code: a.id, action: a.action, user: a.userName, timestamp: a.timestamp },
      metadata: {
        eventId: a.id,
        action: a.action,
        module: a.module,
        userName: a.userName,
        userRole: a.userRole,
        details: a.details,
        timestamp: a.timestamp
      }
    }));
  }

  async getById(id: string): Promise<ILookupItem | null> {
    const auditService = SPK.services.resolve<IAuditService>("AUDIT");
    const a: AuditLogRecord | null = typeof auditService.getLogById === "function"
      ? await auditService.getLogById(id)
      : typeof (auditService as any).getById === "function"
      ? await (auditService as any).getById(id)
      : null;
    if (!a) return null;

    return {
      id: a.id,
      code: a.id,
      name: `[${a.action || "EVENT"}] by ${a.userName || "SYSTEM"}`,
      title: `Event #${a.id}`,
      subtitle: `Action: ${a.action || "LOG"} • User: ${a.userName || "SYSTEM"}`,
      badge: `Module: ${a.module || "SYSTEM"}`,
      type: "AUDIT",
      columns: { code: a.id, action: a.action, user: a.userName, timestamp: a.timestamp },
      metadata: {
        eventId: a.id,
        action: a.action,
        module: a.module,
        userName: a.userName,
        userRole: a.userRole,
        details: a.details,
        timestamp: a.timestamp
      }
    };
  }
}
