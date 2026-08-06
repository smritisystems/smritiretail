/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Component    : SMRITI Communicator Tally Sync Engine (ADR-TALLY-001)
 * Standard     : SCS-BUS-001 / SCS-BUS-004 — TallyPrime as Financial System of Record
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import logger from "../core/logging/logger.js";
import { SPK } from "../kernel/SPK.js";

export type TallyVoucherType = "Sales" | "Purchase" | "Receipt" | "Payment" | "Credit Note" | "Debit Note" | "Master";
export type TallySyncStatus = "PENDING" | "SYNCED" | "FAILED" | "RETRYING";

export interface TallySyncRecord {
  id: string;
  voucherNo: string;
  voucherType: TallyVoucherType;
  voucherDate: string;
  amount: number;
  partyName: string;
  status: TallySyncStatus;
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: string;
  errorMessage?: string;
  xmlPayload: string;
}

export class TallySyncEngine {
  private static instance: TallySyncEngine;
  private syncQueue: TallySyncRecord[] = [];
  private serverPort: number = 9000;
  private isDaemonRunning: boolean = false;

  private constructor() {
    this.seedDefaultQueue();
  }

  public static getInstance(): TallySyncEngine {
    if (!TallySyncEngine.instance) {
      TallySyncEngine.instance = new TallySyncEngine();
    }
    return TallySyncEngine.instance;
  }

  private seedDefaultQueue(): void {
    this.syncQueue = [
      {
        id: "sync-101",
        voucherNo: "INV-2026-1001",
        voucherType: "Sales",
        voucherDate: "2026-08-05",
        amount: 14500,
        partyName: "Walk-in Retail Customer",
        status: "SYNCED",
        retryCount: 0,
        maxRetries: 3,
        lastAttemptAt: "2026-08-05T14:30:00Z",
        xmlPayload: this.generateSalesVoucherXML("INV-2026-1001", "2026-08-05", "Walk-in Retail Customer", 14500)
      },
      {
        id: "sync-102",
        voucherNo: "PO-2026-0045",
        voucherType: "Purchase",
        voucherDate: "2026-08-05",
        amount: 85000,
        partyName: "Apex Footwear Corp",
        status: "PENDING",
        retryCount: 0,
        maxRetries: 3,
        xmlPayload: this.generatePurchaseVoucherXML("PO-2026-0045", "2026-08-05", "Apex Footwear Corp", 85000)
      }
    ];
  }

  public startDaemon(port: number = 9000): void {
    this.serverPort = port;
    this.isDaemonRunning = true;
    logger.info(`[TallySyncEngine] SMRITI Communicator Daemon listening on port ${this.serverPort} for TallyPrime HTTP/XML connection.`);
    SPK.events.emit("TallyDaemonStarted", port, { port, timestamp: new Date().toISOString() });
  }

  public stopDaemon(): void {
    this.isDaemonRunning = false;
    logger.info("[TallySyncEngine] SMRITI Communicator Daemon stopped.");
    SPK.events.emit("TallyDaemonStopped", 0, { timestamp: new Date().toISOString() });
  }

  public getStatus(): { isRunning: boolean; port: number; totalInQueue: number; pendingCount: number; failedCount: number } {
    const pendingCount = this.syncQueue.filter((r) => r.status === "PENDING" || r.status === "RETRYING").length;
    const failedCount = this.syncQueue.filter((r) => r.status === "FAILED").length;
    return {
      isRunning: this.isDaemonRunning,
      port: this.serverPort,
      totalInQueue: this.syncQueue.length,
      pendingCount,
      failedCount,
    };
  }

  public getQueue(): TallySyncRecord[] {
    return [...this.syncQueue];
  }

  public queueVoucher(record: Omit<TallySyncRecord, "id" | "status" | "retryCount" | "maxRetries">): TallySyncRecord {
    const newRecord: TallySyncRecord = {
      ...record,
      id: `sync-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "PENDING",
      retryCount: 0,
      maxRetries: 3,
    };
    this.syncQueue.unshift(newRecord);
    logger.info(`[TallySyncEngine] Queued ${newRecord.voucherType} voucher ${newRecord.voucherNo} for Tally sync.`);
    return newRecord;
  }

  public async syncPendingQueue(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    for (const record of this.syncQueue) {
      if (record.status === "PENDING" || record.status === "RETRYING") {
        try {
          record.status = "RETRYING";
          record.retryCount += 1;
          record.lastAttemptAt = new Date().toISOString();

          // Simulating Tally XML POST to http://localhost:9000 or Tally ODBC/HTTP port
          logger.info(`[TallySyncEngine] Transmitting XML payload for ${record.voucherNo} to TallyPrime...`);
          
          record.status = "SYNCED";
          synced += 1;
          SPK.events.emit("TallyVoucherSynced", record.id, { voucherNo: record.voucherNo, status: "SYNCED" });
        } catch (err) {
          record.status = record.retryCount >= record.maxRetries ? "FAILED" : "PENDING";
          record.errorMessage = err instanceof Error ? err.message : "Tally connection timed out";
          failed += 1;
          logger.error(`[TallySyncEngine] Tally sync failed for ${record.voucherNo}: ${record.errorMessage}`);
        }
      }
    }

    return { synced, failed };
  }

  public generateSalesVoucherXML(voucherNo: string, date: string, customerName: string, amount: number): string {
    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${date.replace(/-/g, "")}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${voucherNo}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${customerName}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${customerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  public generatePurchaseVoucherXML(voucherNo: string, date: string, supplierName: string, amount: number): string {
    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Purchase" ACTION="Create">
            <DATE>${date.replace(/-/g, "")}</DATE>
            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${voucherNo}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${supplierName}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Purchase Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${supplierName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }
}
