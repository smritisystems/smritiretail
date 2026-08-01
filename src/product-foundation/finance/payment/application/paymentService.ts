import { PaymentChannel, PaymentEngine, PaymentRequest, PaymentResult } from '../domain/payment';
import { PostingService } from '../../posting/application/postingService';
import { LedgerService } from '../../ledger/application/ledgerService';

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

export class PaymentService {
  private readonly engine = new PaymentEngine();
  private readonly postingService?: PostingService;
  private readonly ledgerService?: LedgerService;

  constructor(postingService?: PostingService, ledgerService?: LedgerService) {
    this.postingService = postingService;
    this.ledgerService = ledgerService;
  }

  public processPayment(request: PaymentRequest): PaymentResult {
    const result = this.engine.processPayment(request);

    if (this.postingService && this.ledgerService) {
      const paymentLines = request.lines.map((line) => ({
        accountId: channelAccountMap[line.channel],
        amount: line.amount,
      }));

      if (request.partyType === 'customer') {
        this.postingService.postCustomerReceipt(
          request.paymentId,
          request.partyId,
          request.description,
          paymentLines,
          result.totalAmount
        );
      } else {
        this.postingService.postSupplierPayment(
          request.paymentId,
          request.partyId,
          request.description,
          paymentLines,
          result.totalAmount
        );
      }

      this.ledgerService.recordPayment(request.partyType, request.partyId, request.paymentId, result.totalAmount, request.description);
    }

    return result;
  }
}
