/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : RecordAuditLogCommand & Handler
 * Standard     : SMAP Constitution v1.0 — Command Bus Pipeline
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ICommand, ICommandHandler, ITenantContext, SPK } from "../SPK.js";
import { AuditLogRecord, IAuditService } from "../public/IAuditService.js";

export class RecordAuditLogCommand implements ICommand {
  public readonly type = "RECORD_AUDIT_LOG";
  constructor(public readonly payload: Partial<AuditLogRecord>) {}
}

export class RecordAuditLogCommandHandler implements ICommandHandler<RecordAuditLogCommand, AuditLogRecord> {
  async execute(command: RecordAuditLogCommand, context: ITenantContext): Promise<AuditLogRecord> {
    const data = command.payload;

    if (!data.details || !data.details.trim()) {
      throw new Error("[UVE Validation Error] Audit log details message is required.");
    }

    const auditService = SPK.services.resolve<IAuditService>("AUDIT");
    const saved = await auditService.recordLog({
      ...data,
      userName: data.userName || context.userName,
      userRole: data.userRole || context.userRole || "ADMIN"
    });

    return saved;
  }
}
