import { ReservationEngine } from '../domain/reservation';
import { StockLedgerEntry } from '../../stock-ledger/domain/stockLedger';

export class ReservationService {
  private readonly engine = new ReservationEngine();

  public reserve(entry: StockLedgerEntry, quantity: number): StockLedgerEntry {
    return this.engine.reserve(entry, quantity);
  }

  public release(entry: StockLedgerEntry, quantity: number): StockLedgerEntry {
    return this.engine.release(entry, quantity);
  }
}
