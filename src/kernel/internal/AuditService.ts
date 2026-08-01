/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : AuditService Core Domain Implementation
 * Standard     : SMAP Constitution v1.0 — Internal Domain Engine
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import logger from "../../core/logging/logger.js";
import { AuditLogRecord, IAuditService } from "../public/IAuditService.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import { SPK } from "../SPK.js";

export class AuditService implements IAuditService {
  private localCache: AuditLogRecord[] = [
    {
      id: "aud-1001",
      action: "SYSTEM",
      module: "system",
      entityId: "SPK_KERNEL",
      details: "SMRITI Platform Kernel (SPK) v1.0 Bootstrapped cleanly",
      userName: "super",
      userRole: "SUPER_ADMIN",
      ipAddress: "127.0.0.1",
      timestamp: new Date().toISOString()
    }
  ];

  public async getAllLogs(): Promise<AuditLogRecord[]> {
    try {
      const data = await apiFetchV1("/audit/logs/");
      if (Array.isArray(data) && data.length > 0) {
        this.localCache = data.map((log: any) => this.normalizeBackendLog(log));
        return this.localCache;
      }
    } catch (e) {
      logger.warn("[AuditService] API unreachable. Serving cached audit logs.", e as unknown);
    }
    return this.localCache;
  }

  public async getLogById(id: string): Promise<AuditLogRecord | null> {
    const list = await this.getAllLogs();
    return list.find((l) => l.id === id) || null;
  }

  public async queryLogs(module?: string, action?: string, limit = 100): Promise<AuditLogRecord[]> {
    const list = await this.getAllLogs();
    const mod = module ? module.trim().toLowerCase() : "";
    const act = action ? action.trim().toLowerCase() : "";

    return list
      .filter((l) => {
        const matchesMod = !mod || mod === "all" || l.module.toLowerCase() === mod;
        const matchesAct = !act || act === "all" || l.action.toLowerCase() === act;
        return matchesMod && matchesAct;
      })
      .slice(0, limit);
  }

  public async recordLog(logData: Partial<AuditLogRecord>): Promise<AuditLogRecord> {
    const id = logData.id || `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const record: AuditLogRecord = {
      id,
      action: logData.action || "UPDATE",
      module: logData.module || "system",
      entityId: logData.entityId || "",
      details: logData.details || "Activity performed",
      userName: logData.userName || "super",
      userRole: logData.userRole || "ADMIN",
      ipAddress: logData.ipAddress || "127.0.0.1",
      timestamp: logData.timestamp || new Date().toISOString()
    };

    try {
      const savedResponse = await apiFetchV1("/audit/logs/", {
        method: "POST",
        body: JSON.stringify(record)
      });

      const normalized = this.normalizeBackendLog(savedResponse || record);
      this.upsertLocalCache(normalized);
      SPK.events.emit("AuditLogged", normalized.id, normalized);
      return normalized;
    } catch (err) {
      logger.warn("[AuditService] Backend audit save warning, caching locally.", err as unknown);
      this.upsertLocalCache(record);
      SPK.events.emit("AuditLogged", record.id, record);
      return record;
    }
  }

  private upsertLocalCache(log: AuditLogRecord): void {
    const idx = this.localCache.findIndex((l) => l.id === log.id);
    if (idx >= 0) {
      this.localCache[idx] = log;
    } else {
      this.localCache.unshift(log);
    }
  }

  private normalizeBackendLog(l: any): AuditLogRecord {
    return {
      id: l.id,
      action: l.action || "UPDATE",
      module: l.module || "system",
      entityId: l.entity_id || l.entityId || "",
      details: l.details || l.message || "",
      userName: l.user_name || l.userName || "user",
      userRole: l.user_role || l.userRole || "OPERATOR",
      ipAddress: l.ip_address || l.ipAddress || "127.0.0.1",
      timestamp: l.timestamp || l.created_at || new Date().toISOString()
    };
  }
}
