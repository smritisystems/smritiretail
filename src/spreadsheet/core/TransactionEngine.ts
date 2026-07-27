/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Spreadsheet Platform (SSP)
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-07-27
 * Copyright    : © SmritiSys. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export interface PendingCellChange {
  rowIndex: number;
  colKey: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

/**
 * Enterprise Transaction Engine for SSP grid edits.
 * Buffers cell changes, creates version snapshots, and supports commit/rollback.
 */
export class TransactionEngine {
  private pendingChanges: PendingCellChange[] = [];
  private snapshots: Map<string, Record<string, any>[]> = new Map();

  public recordChange(change: PendingCellChange): void {
    this.pendingChanges.push(change);
  }

  public getPendingCount(): number {
    return this.pendingChanges.length;
  }

  public getPendingChanges(): PendingCellChange[] {
    return [...this.pendingChanges];
  }

  public createSnapshot(name: string, data: Record<string, any>[]): void {
    this.snapshots.set(name, JSON.parse(JSON.stringify(data)));
  }

  public restoreSnapshot(name: string): Record<string, any>[] | null {
    const snap = this.snapshots.get(name);
    return snap ? JSON.parse(JSON.stringify(snap)) : null;
  }

  public commit(): PendingCellChange[] {
    const committed = [...this.pendingChanges];
    this.pendingChanges = [];
    return committed;
  }

  public rollback(): void {
    this.pendingChanges = [];
  }
}
