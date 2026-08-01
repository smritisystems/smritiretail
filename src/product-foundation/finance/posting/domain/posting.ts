export interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
  reference?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  lines: JournalLine[];
}

export interface TaxBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

export interface SalesPostingContext {
  saleId: string;
  customerId: string;
  description: string;
  netAmount: number;
  totalAmount: number;
  taxBreakdown: TaxBreakdown;
}

export interface PurchasePostingContext {
  purchaseId: string;
  supplierId: string;
  description: string;
  netAmount: number;
  totalAmount: number;
  taxBreakdown: TaxBreakdown;
}

export interface SalesReturnPostingContext {
  returnId: string;
  customerId: string;
  description: string;
  netAmount: number;
  totalAmount: number;
  taxBreakdown: TaxBreakdown;
}

export interface PurchaseReturnPostingContext {
  returnId: string;
  supplierId: string;
  description: string;
  netAmount: number;
  totalAmount: number;
  taxBreakdown: TaxBreakdown;
}

export interface StockTransferPostingContext {
  transferId: string;
  fromLocation: string;
  toLocation: string;
  amount: number;
}

export interface InventoryAdjustmentPostingContext {
  adjustmentId: string;
  description: string;
  variance: number;
}

export interface PaymentPostingLine {
  accountId: string;
  amount: number;
}

export interface CustomerReceiptPostingContext {
  paymentId: string;
  customerId: string;
  description: string;
  paymentLines: PaymentPostingLine[];
  totalAmount: number;
}

export interface SupplierPaymentPostingContext {
  paymentId: string;
  supplierId: string;
  description: string;
  paymentLines: PaymentPostingLine[];
  totalAmount: number;
}

function roundToTwo(amount: number): number {
  return Number(amount.toFixed(2));
}

export class AccountingEngine {
  private journalEntries: JournalEntry[] = [];
  private balances = new Map<string, number>();

  public postJournalEntry(entry: JournalEntry): JournalEntry {
    const debitTotal = roundToTwo(entry.lines.reduce((sum, line) => sum + line.debit, 0));
    const creditTotal = roundToTwo(entry.lines.reduce((sum, line) => sum + line.credit, 0));

    if (debitTotal !== creditTotal) {
      throw new Error(`Journal entry is unbalanced: debit=${debitTotal} credit=${creditTotal}`);
    }

    this.journalEntries.push(entry);

    for (const line of entry.lines) {
      const existing = this.balances.get(line.accountId) ?? 0;
      this.balances.set(line.accountId, roundToTwo(existing + line.debit - line.credit));
    }

    return entry;
  }

  public getAccountBalance(accountId: string): number {
    return this.balances.get(accountId) ?? 0;
  }

  public getJournalEntries(): JournalEntry[] {
    return [...this.journalEntries];
  }

  public createSalesJournal(context: SalesPostingContext): JournalEntry {
    const { saleId, customerId, description, netAmount, totalAmount, taxBreakdown } = context;
    const lines: JournalLine[] = [];

    lines.push({
      accountId: 'AccountsReceivable',
      debit: totalAmount,
      credit: 0,
      description: `Sale receivable for ${saleId}`,
      reference: customerId,
    });

    lines.push({
      accountId: 'SalesRevenue',
      debit: 0,
      credit: netAmount,
      description,
      reference: saleId,
    });

    if (taxBreakdown.cgst > 0) {
      lines.push({
        accountId: 'CGST Payable',
        debit: 0,
        credit: taxBreakdown.cgst,
        description: `CGST for ${saleId}`,
        reference: saleId,
      });
    }

    if (taxBreakdown.sgst > 0) {
      lines.push({
        accountId: 'SGST Payable',
        debit: 0,
        credit: taxBreakdown.sgst,
        description: `SGST for ${saleId}`,
        reference: saleId,
      });
    }

    if (taxBreakdown.igst > 0) {
      lines.push({
        accountId: 'IGST Payable',
        debit: 0,
        credit: taxBreakdown.igst,
        description: `IGST for ${saleId}`,
        reference: saleId,
      });
    }

    const entry: JournalEntry = {
      id: `JE-${saleId}`,
      date: new Date().toISOString(),
      description,
      lines,
    };

    return this.postJournalEntry(entry);
  }

  public createPurchaseJournal(context: PurchasePostingContext): JournalEntry {
    const { purchaseId, supplierId, description, netAmount, totalAmount, taxBreakdown } = context;
    const lines: JournalLine[] = [];

    lines.push({
      accountId: 'Inventory',
      debit: netAmount,
      credit: 0,
      description: `Inventory purchase for ${purchaseId}`,
      reference: supplierId,
    });

    lines.push({
      accountId: 'CGST Input',
      debit: taxBreakdown.cgst,
      credit: 0,
      description: `CGST ITC for ${purchaseId}`,
      reference: purchaseId,
    });

    lines.push({
      accountId: 'SGST Input',
      debit: taxBreakdown.sgst,
      credit: 0,
      description: `SGST ITC for ${purchaseId}`,
      reference: purchaseId,
    });

    if (taxBreakdown.igst > 0) {
      lines.push({
        accountId: 'IGST Input',
        debit: taxBreakdown.igst,
        credit: 0,
        description: `IGST ITC for ${purchaseId}`,
        reference: purchaseId,
      });
    }

    lines.push({
      accountId: 'AccountsPayable',
      debit: 0,
      credit: totalAmount,
      description,
      reference: purchaseId,
    });

    const entry: JournalEntry = {
      id: `JE-PUR-${purchaseId}`,
      date: new Date().toISOString(),
      description,
      lines,
    };

    return this.postJournalEntry(entry);
  }

  public createSalesReturnJournal(context: SalesReturnPostingContext): JournalEntry {
    const { returnId, customerId, description, netAmount, totalAmount, taxBreakdown } = context;
    const lines: JournalLine[] = [];

    lines.push({
      accountId: 'SalesReturns',
      debit: netAmount,
      credit: 0,
      description,
      reference: returnId,
    });

    if (taxBreakdown.cgst > 0) {
      lines.push({
        accountId: 'CGST Payable',
        debit: taxBreakdown.cgst,
        credit: 0,
        description: `CGST reversal for ${returnId}`,
        reference: returnId,
      });
    }

    if (taxBreakdown.sgst > 0) {
      lines.push({
        accountId: 'SGST Payable',
        debit: taxBreakdown.sgst,
        credit: 0,
        description: `SGST reversal for ${returnId}`,
        reference: returnId,
      });
    }

    if (taxBreakdown.igst > 0) {
      lines.push({
        accountId: 'IGST Payable',
        debit: taxBreakdown.igst,
        credit: 0,
        description: `IGST reversal for ${returnId}`,
        reference: returnId,
      });
    }

    lines.push({
      accountId: 'AccountsReceivable',
      debit: 0,
      credit: totalAmount,
      description: `Customer credit for ${returnId}`,
      reference: customerId,
    });

    const entry: JournalEntry = {
      id: `JE-CRN-${returnId}`,
      date: new Date().toISOString(),
      description,
      lines,
    };

    return this.postJournalEntry(entry);
  }

  public createPurchaseReturnJournal(context: PurchaseReturnPostingContext): JournalEntry {
    const { returnId, supplierId, description, netAmount, totalAmount, taxBreakdown } = context;
    const lines: JournalLine[] = [];

    lines.push({
      accountId: 'AccountsPayable',
      debit: totalAmount,
      credit: 0,
      description,
      reference: returnId,
    });

    lines.push({
      accountId: 'Inventory',
      debit: 0,
      credit: netAmount,
      description: `Inventory return for ${returnId}`,
      reference: supplierId,
    });

    if (taxBreakdown.cgst > 0) {
      lines.push({
        accountId: 'CGST Input',
        debit: 0,
        credit: taxBreakdown.cgst,
        description: `CGST reversal for ${returnId}`,
        reference: returnId,
      });
    }

    if (taxBreakdown.sgst > 0) {
      lines.push({
        accountId: 'SGST Input',
        debit: 0,
        credit: taxBreakdown.sgst,
        description: `SGST reversal for ${returnId}`,
        reference: returnId,
      });
    }

    if (taxBreakdown.igst > 0) {
      lines.push({
        accountId: 'IGST Input',
        debit: 0,
        credit: taxBreakdown.igst,
        description: `IGST reversal for ${returnId}`,
        reference: returnId,
      });
    }

    const entry: JournalEntry = {
      id: `JE-DBN-${returnId}`,
      date: new Date().toISOString(),
      description,
      lines,
    };

    return this.postJournalEntry(entry);
  }

  public createStockTransferJournal(context: StockTransferPostingContext): JournalEntry {
    const { transferId, fromLocation, toLocation, amount } = context;
    const lines: JournalLine[] = [
      {
        accountId: 'Inventory',
        debit: amount,
        credit: 0,
        description: `Stock transfer inbound to ${toLocation}`,
        reference: transferId,
      },
      {
        accountId: 'Inventory',
        debit: 0,
        credit: amount,
        description: `Stock transfer outbound from ${fromLocation}`,
        reference: transferId,
      },
    ];

    const entry: JournalEntry = {
      id: `JE-TRF-${transferId}`,
      date: new Date().toISOString(),
      description: `Stock transfer ${transferId} from ${fromLocation} to ${toLocation}`,
      lines,
    };

    return this.postJournalEntry(entry);
  }

  public createInventoryAdjustmentJournal(context: InventoryAdjustmentPostingContext): JournalEntry {
    const { adjustmentId, description, variance } = context;
    const lines: JournalLine[] = [];

    if (variance > 0) {
      lines.push({
        accountId: 'Inventory',
        debit: variance,
        credit: 0,
        description,
        reference: adjustmentId,
      });
      lines.push({
        accountId: 'InventoryAdjustmentGain',
        debit: 0,
        credit: variance,
        description: `Inventory gain variance for ${adjustmentId}`,
        reference: adjustmentId,
      });
    } else if (variance < 0) {
      const absVariance = Math.abs(variance);
      lines.push({
        accountId: 'InventoryAdjustmentLoss',
        debit: absVariance,
        credit: 0,
        description: `Inventory loss variance for ${adjustmentId}`,
        reference: adjustmentId,
      });
      lines.push({
        accountId: 'Inventory',
        debit: 0,
        credit: absVariance,
        description,
        reference: adjustmentId,
      });
    } else {
      const entry: JournalEntry = {
        id: `JE-ADJ-${adjustmentId}`,
        date: new Date().toISOString(),
        description: `${description} (no variance)`,
        lines: [],
      };
      return entry;
    }

    const entry: JournalEntry = {
      id: `JE-ADJ-${adjustmentId}`,
      date: new Date().toISOString(),
      description,
      lines,
    };

    return this.postJournalEntry(entry);
  }

  public createCustomerReceiptJournal(context: CustomerReceiptPostingContext): JournalEntry {
    const { paymentId, customerId, description, paymentLines, totalAmount } = context;
    const lines: JournalLine[] = [];

    lines.push({
      accountId: 'Cash',
      debit: totalAmount,
      credit: 0,
      description: `Receipt for ${paymentId}`,
      reference: customerId,
    });

    for (const paymentLine of paymentLines) {
      lines.push({
        accountId: paymentLine.accountId,
        debit: 0,
        credit: paymentLine.amount,
        description: `${paymentLine.accountId} clearing for ${paymentId}`,
        reference: paymentId,
      });
    }

    const entry: JournalEntry = {
      id: `JE-RCT-${paymentId}`,
      date: new Date().toISOString(),
      description,
      lines,
    };

    return this.postJournalEntry(entry);
  }

  public createSupplierPaymentJournal(context: SupplierPaymentPostingContext): JournalEntry {
    const { paymentId, supplierId, description, paymentLines, totalAmount } = context;
    const lines: JournalLine[] = [];

    lines.push({
      accountId: 'AccountsPayable',
      debit: totalAmount,
      credit: 0,
      description: `Payment to ${supplierId}`,
      reference: paymentId,
    });

    for (const paymentLine of paymentLines) {
      lines.push({
        accountId: paymentLine.accountId,
        debit: 0,
        credit: paymentLine.amount,
        description: `${paymentLine.accountId} settlement for ${paymentId}`,
        reference: paymentId,
      });
    }

    const entry: JournalEntry = {
      id: `JE-PMT-${paymentId}`,
      date: new Date().toISOString(),
      description,
      lines,
    };

    return this.postJournalEntry(entry);
  }
}
