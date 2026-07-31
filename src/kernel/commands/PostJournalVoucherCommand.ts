/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : PostJournalVoucherCommand & Handler
 * Standard     : SMAP Constitution v1.0 & Rule 18 (Simplified Accounting Policy)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ICommand, ICommandHandler, ITenantContext, SPK } from "../SPK.js";
import { IAccountingService, JournalVoucherRecord } from "../public/IAccountingService.js";

export class PostJournalVoucherCommand implements ICommand {
  public readonly type = "POST_JOURNAL_VOUCHER";
  constructor(public readonly payload: Partial<JournalVoucherRecord>) {}
}

export class PostJournalVoucherCommandHandler implements ICommandHandler<PostJournalVoucherCommand, JournalVoucherRecord> {
  async execute(command: PostJournalVoucherCommand, context: ITenantContext): Promise<JournalVoucherRecord> {
    const data = command.payload;

    console.log(`[SPK Command] Executing PostJournalVoucherCommand for tenant: ${context.tenantId}, operator: ${context.userName}`);

    const accountingService = SPK.services.resolve<IAccountingService>("ACCOUNTING");
    const saved = await accountingService.postJournalVoucher(data);

    return saved;
  }
}
