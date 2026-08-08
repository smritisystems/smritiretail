export type PaymentChannel =
  | 'CASH'
  | 'UPI'
  | 'CARD'
  | 'CREDIT'
  | 'GIFT_VOUCHER'
  | 'WALLET'
  | 'ADVANCE'
  | 'REFUND';

export interface PaymentLine {
  channel: PaymentChannel;
  amount: number;
  reference?: string;
}

export interface PaymentRequest {
  paymentId: string;
  partyId: string;
  partyType: 'customer' | 'supplier';
  invoiceId?: string;
  description: string;
  lines: PaymentLine[];
}

export interface PaymentResult {
  paymentId: string;
  partyId: string;
  partyType: 'customer' | 'supplier';
  invoiceId?: string;
  totalAmount: number;
  lines: PaymentLine[];
  receiptText: string;
}

const channelAccountMap: Record<PaymentChannel, string> = {
  CASH: 'Cash',
  UPI: 'UPI Account',
  CARD: 'Card Account',
  CREDIT: 'Customer Credit',
  GIFT_VOUCHER: 'Gift Voucher',
  WALLET: 'Wallet',
  ADVANCE: 'Advance Payment',
  REFUND: 'Refund Payment',
};

export class PaymentEngine {
  public processPayment(request: PaymentRequest): PaymentResult {
    if (!request.lines?.length) {
      throw new Error('Payment request must include at least one payment line');
    }

    const totalAmount = request.lines.reduce((sum, line) => sum + line.amount, 0);
    if (totalAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    for (const line of request.lines) {
      if (line.amount <= 0) {
        throw new Error('Each payment line must have a positive amount');
      }
      if (!channelAccountMap[line.channel]) {
        throw new Error(`Unsupported payment channel ${line.channel}`);
      }
    }

    const receiptText = this.renderReceipt(request, totalAmount);
    return {
      paymentId: request.paymentId,
      partyId: request.partyId,
      partyType: request.partyType,
      invoiceId: request.invoiceId,
      totalAmount: Number(totalAmount.toFixed(2)),
      lines: request.lines,
      receiptText,
    };
  }

  private renderReceipt(request: PaymentRequest, totalAmount: number): string {
    const linesText = request.lines
      .map((line) => `${line.channel}: ₹${line.amount.toFixed(2)}${line.reference ? ` (${line.reference})` : ''}`)
      .join('\n');

    return [`SMRITI PAYMENT RECEIPT`, `Payment: ${request.paymentId}`, `Party: ${request.partyId}`, `Type: ${request.partyType}`, `Description: ${request.description}`, `Invoice: ${request.invoiceId ?? 'N/A'}`, `Amount: ₹${totalAmount.toFixed(2)}`, `Details:`, linesText].join('\n');
  }
}
