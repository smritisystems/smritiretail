import { StockLedgerEntry } from '../../stock-ledger/domain/stockLedger';

export class ReservationEngine {
  public reserve(entry: StockLedgerEntry, quantity: number): StockLedgerEntry {
    if (quantity <= 0) {
      throw new Error('Reservation quantity must be greater than zero');
    }

    const reserved = entry.reserved ?? 0;
    const onHand = entry.onHand ?? entry.quantity;
    const available = Number((onHand - reserved).toFixed(2));

    if (quantity > available && !entry.allowNegative) {
      throw new Error('Insufficient available stock to reserve');
    }

    const updatedReserved = Number((reserved + quantity).toFixed(2));
    return {
      ...entry,
      onHand: Number(onHand.toFixed(2)),
      reserved: updatedReserved,
      quantity: Number((onHand - updatedReserved).toFixed(2)),
    };
  }

  public release(entry: StockLedgerEntry, quantity: number): StockLedgerEntry {
    if (quantity <= 0) {
      throw new Error('Release quantity must be greater than zero');
    }

    const reserved = entry.reserved ?? 0;
    if (quantity > reserved) {
      throw new Error('Cannot release more stock than is reserved');
    }

    const onHand = entry.onHand ?? entry.quantity;
    const updatedReserved = Number((reserved - quantity).toFixed(2));

    return {
      ...entry,
      onHand: Number(onHand.toFixed(2)),
      reserved: updatedReserved,
      quantity: Number((onHand - updatedReserved).toFixed(2)),
    };
  }
}
