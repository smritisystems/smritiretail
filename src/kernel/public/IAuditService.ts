/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : IAuditService Public Interface Contract
 * Standard     : SMAP Constitution v1.0 — Public Contract (Level 2)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface AuditLogRecord {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "EXPORT" | "SYSTEM" | string;
  module: "items" | "customers" | "suppliers" | "sales" | "purchase" | "printing" | "system" | string;
  entityId?: string;
  details: string;
  userName: string;
  userRole: string;
  ipAddress?: string;
  timestamp: string; // ISO String
}

export interface IAuditService {
  /**
   * Resolve an audit record by primary ID
   */
  getLogById(id: string): Promise<AuditLogRecord | null>;

  /**
   * Query audit logs by module, action, user, or date range
   */
  queryLogs(module?: string, action?: string, limit?: number): Promise<AuditLogRecord[]>;

  /**
   * Record a new immutable audit trail entry through Command Bus
   */
  recordLog(log: Partial<AuditLogRecord>): Promise<AuditLogRecord>;

  /**
   * Fetch all audit logs from SSOT
   */
  getAllLogs(): Promise<AuditLogRecord[]>;
}
