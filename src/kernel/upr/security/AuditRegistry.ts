/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Security Audit Registry (USR-006)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & USR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface SecurityAuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  roleId: string;
  action: string;
  permissionId: string;
  isAllowed: boolean;
  reason: string;
  details?: Record<string, any>;
}

export class AuditRegistryService {
  private auditLogs: SecurityAuditEvent[] = [];
  private listeners: Set<() => void> = new Set();

  public logEvent(event: Omit<SecurityAuditEvent, "id" | "timestamp">): SecurityAuditEvent {
    const fullEvent: SecurityAuditEvent = {
      ...event,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString()
    };

    this.auditLogs.unshift(fullEvent);
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop(); // Retain last 500 security events in-memory
    }

    this.emitChange();
    return fullEvent;
  }

  public getAuditLogs(): ReadonlyArray<Readonly<SecurityAuditEvent>> {
    return this.auditLogs;
  }

  public getAuditLogsByUser(userId: string): ReadonlyArray<Readonly<SecurityAuditEvent>> {
    return this.auditLogs.filter((log) => log.userId === userId);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.auditLogs = [];
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const AuditRegistry = new AuditRegistryService();
