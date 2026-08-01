import { InvoiceEngine, InvoiceLine, InvoiceDocument } from '../domain/invoice';

export class PrintService {
  private readonly engine = new InvoiceEngine();

  public createInvoiceDocument(
    invoiceId: string,
    customerId: string,
    lines: InvoiceLine[],
    taxBreakdown: { cgst: number; sgst: number; igst: number; totalTax: number },
    documentTitle?: string
  ): InvoiceDocument {
    return this.engine.generateInvoice(invoiceId, customerId, lines, taxBreakdown, documentTitle);
  }
}
