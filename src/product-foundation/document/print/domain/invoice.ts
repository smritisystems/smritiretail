export interface InvoiceLine {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  netAmount: number;
}

export interface InvoiceDocument {
  invoiceId: string;
  customerId: string;
  date: string;
  lines: InvoiceLine[];
  netAmount: number;
  taxBreakdown: {
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  };
  totalAmount: number;
  receiptText: string;
  documentTitle: string;
}

export class InvoiceEngine {
  public generateInvoice(
    invoiceId: string,
    customerId: string,
    lines: InvoiceLine[],
    taxBreakdown: { cgst: number; sgst: number; igst: number; totalTax: number },
    documentTitle = 'SMRITI RETAIL INVOICE'
  ): InvoiceDocument {
    const netAmount = Number(lines.reduce((sum, line) => sum + line.netAmount, 0).toFixed(2));
    const totalAmount = Number((netAmount + taxBreakdown.totalTax).toFixed(2));
    const receiptText = this.renderReceipt(invoiceId, customerId, lines, netAmount, taxBreakdown, totalAmount, documentTitle);

    return {
      invoiceId,
      customerId,
      date: new Date().toISOString(),
      lines,
      netAmount,
      taxBreakdown,
      totalAmount,
      receiptText,
      documentTitle,
    };
  }

  private renderReceipt(
    invoiceId: string,
    customerId: string,
    lines: InvoiceLine[],
    netAmount: number,
    taxBreakdown: { cgst: number; sgst: number; igst: number; totalTax: number },
    totalAmount: number,
    documentTitle: string
  ) {
    const lineText = lines.map((line) => `${line.quantity} x ${line.description} @ ${line.unitPrice.toFixed(2)} = ${line.netAmount.toFixed(2)}`).join('\n');
    return `${documentTitle}\nInvoice: ${invoiceId}\nCustomer: ${customerId}\n\n${lineText}\n\nNet Amount: ${netAmount.toFixed(2)}\nCGST: ${taxBreakdown.cgst.toFixed(2)}\nSGST: ${taxBreakdown.sgst.toFixed(2)}\nIGST: ${taxBreakdown.igst.toFixed(2)}\nTax Total: ${taxBreakdown.totalTax.toFixed(2)}\nTotal Amount: ${totalAmount.toFixed(2)}`;
  }
}
