/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.82.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export type StoreBroadcastEventType =
  | "MANAGER_OVERRIDE_REQUEST"
  | "PRICE_UPDATE_BROADCAST"
  | "STOCK_OUT_ALERT"
  | "SYSTEM_LOCKOUT_NOTICE"
  | "EMERGENCY_ANNOUNCEMENT";

export interface StoreBroadcastMessage {
  id: string;
  eventType: StoreBroadcastEventType;
  senderTerminalId: string;
  senderName: string;
  targetTerminalId?: string; // If undefined, broadcast to ALL terminals in branch
  branchId: string;
  title: string;
  body: string;
  payload?: Record<string, any>;
  timestamp: string;
  acknowledged?: boolean;
}

export type BroadcastListener = (msg: StoreBroadcastMessage) => void;

export class StoreTerminalBroadcastHub {
  private static instance: StoreTerminalBroadcastHub;
  private currentTerminalId: string = "POS-01";
  private currentBranchId: string = "BR-MAIN-01";
  private currentUserName: string = "Cashier On-Duty";
  private listeners: Set<BroadcastListener> = new Set();
  private messageHistory: StoreBroadcastMessage[] = [];
  private isConnected: boolean = false;
  private socket: WebSocket | null = null;

  private constructor() {
    // Singleton
  }

  public static getInstance(): StoreTerminalBroadcastHub {
    if (!StoreTerminalBroadcastHub.instance) {
      StoreTerminalBroadcastHub.instance = new StoreTerminalBroadcastHub();
    }
    return StoreTerminalBroadcastHub.instance;
  }

  public init(terminalId: string, branchId: string, userName: string): void {
    this.currentTerminalId = terminalId;
    this.currentBranchId = branchId;
    this.currentUserName = userName;
    this.connect();
  }

  public connect(): void {
    try {
      const protocol = window.location?.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location?.host || "localhost:8000";
      const wsUrl = `${protocol}//${host}/api/v1/ws/store-terminals/${this.currentBranchId}/${this.currentTerminalId}`;
      
      this.socket = new WebSocket(wsUrl);
      this.socket.onopen = () => {
        this.isConnected = true;
      };
      this.socket.onmessage = (event) => {
        try {
          const msg: StoreBroadcastMessage = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch {
          // Ignore parse errors
        }
      };
      this.socket.onerror = () => {
        this.isConnected = false;
      };
      this.socket.onclose = () => {
        this.isConnected = false;
      };
    } catch {
      // Local fallback / mock mode when running in unit test or offline
      this.isConnected = true;
    }
  }

  public subscribe(listener: BroadcastListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public broadcast(
    eventType: StoreBroadcastEventType,
    title: string,
    body: string,
    payload?: Record<string, any>,
    targetTerminalId?: string
  ): StoreBroadcastMessage {
    const msg: StoreBroadcastMessage = {
      id: `bc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      senderTerminalId: this.currentTerminalId,
      senderName: this.currentUserName,
      targetTerminalId,
      branchId: this.currentBranchId,
      title,
      body,
      payload,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }

    // Local bus delivery
    this.handleIncomingMessage(msg);
    return msg;
  }

  public handleIncomingMessage(msg: StoreBroadcastMessage): void {
    // If target is specified and not for this terminal, ignore
    if (msg.targetTerminalId && msg.targetTerminalId !== this.currentTerminalId) {
      return;
    }

    this.messageHistory.unshift(msg);
    if (this.messageHistory.length > 50) {
      this.messageHistory.pop();
    }

    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error("Error invoking broadcast listener", err);
      }
    });
  }

  public getRecentHistory(): StoreBroadcastMessage[] {
    return [...this.messageHistory];
  }

  public getStatus(): { isConnected: boolean; terminalId: string; branchId: string } {
    return {
      isConnected: this.isConnected,
      terminalId: this.currentTerminalId,
      branchId: this.currentBranchId,
    };
  }
}

export default StoreTerminalBroadcastHub;
