/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : AuditLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — ULE Integration
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, SPK } from "../SPK.js";
import { IAuditService } from "../public/IAuditService.js";

export class AuditLookupProvider implements ILookupProvider {
  public readonly domain = "AUDIT_LOG";

  async search(query: string): Promise<ILookupItem[]> {
    const auditService = SPK.services.resolve<IAuditService>("AUDIT");
    const list = await auditService.queryLogs();
    const q = query.trim().toLowerCase();

    return list
      .filter((l) => {
        if (!q) return true;
        return (
          l.details.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.module.toLowerCase().includes(q) ||
          l.userName.toLowerCase().includes(q)
        );
      })
      .map((l) => ({
        id: l.id,
        code: l.action,
        name: `[${l.module.toUpperCase()}] ${l.details}`,
        badge: `User: ${l.userName} (${l.userRole}) | ${new Date(l.timestamp).toLocaleTimeString()}`,
        type: "AUDIT_LOG",
        metadata: {
          action: l.action,
          module: l.module,
          entityId: l.entityId,
          userName: l.userName,
          userRole: l.userRole,
          timestamp: l.timestamp
        }
      }));
  }

  async getById(id: string): Promise<ILookupItem | null> {
    const auditService = SPK.services.resolve<IAuditService>("AUDIT");
    const l = await auditService.getLogById(id);
    if (!l) return null;

    return {
      id: l.id,
      code: l.action,
      name: `[${l.module.toUpperCase()}] ${l.details}`,
      badge: `User: ${l.userName} (${l.userRole}) | ${new Date(l.timestamp).toLocaleTimeString()}`,
      type: "AUDIT_LOG",
      metadata: {
        action: l.action,
        module: l.module,
        entityId: l.entityId,
        userName: l.userName,
        userRole: l.userRole,
        timestamp: l.timestamp
      }
    };
  }
}
