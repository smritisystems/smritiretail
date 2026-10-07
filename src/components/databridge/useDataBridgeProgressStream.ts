/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-07
 * Modified     : 2026-10-07
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal — DataBridge WebSocket Streaming Hook
 * Capability    : databridge.workspace_ux (@SmritiCapability / smriti_capability)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { DataBridgeProgressFrame } from "./databridgeTypes.ts";
import { DataBridgeClientService } from "./databridgeService.ts";

interface UseDataBridgeProgressStreamOptions {
  companyId?: string;
  enablePollingFallback?: boolean;
  onCompleted?: (frame: DataBridgeProgressFrame) => void;
  onError?: (error: Error | string) => void;
}

export function useDataBridgeProgressStream(
  jobId: string | null,
  options: UseDataBridgeProgressStreamOptions = {}
) {
  const {
    companyId = "smriti001",
    enablePollingFallback = true,
    onCompleted,
    onError,
  } = options;

  const [frame, setFrame] = useState<DataBridgeProgressFrame | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  // Polling fallback mechanism
  const startPolling = useCallback(() => {
    if (!jobId || !enablePollingFallback || isCompleted) return;
    if (pollTimerRef.current !== null) return;

    pollTimerRef.current = window.setInterval(async () => {
      try {
        const res = await DataBridgeClientService.getAsyncJobStatus(jobId);
        const polledFrame: DataBridgeProgressFrame = {
          job_id: res.job_id,
          tenant_id: companyId,
          entity_type: res.entity_type,
          status: res.status,
          total_rows: res.total_rows,
          processed_rows: res.processed_rows,
          committed_count: res.committed_count,
          error_count: res.error_count,
          progress_percent: res.progress_percent,
          current_chunk_index: res.current_chunk,
          total_chunks: res.total_chunks,
          latest_error_summary: res.error_message,
          timestamp: new Date().toISOString(),
        };

        setFrame(polledFrame);

        if (res.status === "COMPLETED") {
          setIsCompleted(true);
          clearTimers();
          onCompleted?.(polledFrame);
        } else if (res.status === "FAILED") {
          setIsCompleted(true);
          clearTimers();
          setError(res.error_message || "Async execution failed.");
          onError?.(res.error_message || "Async execution failed.");
        }
      } catch (err: any) {
        setError(err.message || "Failed polling job status.");
      }
    }, 2000);
  }, [jobId, enablePollingFallback, isCompleted, companyId, clearTimers, onCompleted, onError]);

  useEffect(() => {
    if (!jobId) {
      setFrame(null);
      setIsConnected(false);
      setIsCompleted(false);
      setError(null);
      clearTimers();
      return;
    }

    setIsCompleted(false);
    setError(null);

    // Build WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/databridge/ws/progress/${encodeURIComponent(jobId)}?company_id=${encodeURIComponent(companyId)}`;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Start ping heartbeat every 15s
        heartbeatTimerRef.current = window.setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw.type === "pong") return;

          const progressData = raw as DataBridgeProgressFrame;
          setFrame(progressData);

          if (progressData.status === "COMPLETED") {
            setIsCompleted(true);
            clearTimers();
            onCompleted?.(progressData);
          } else if (progressData.status === "FAILED") {
            setIsCompleted(true);
            clearTimers();
            setError(progressData.latest_error_summary || "Job processing failed.");
            onError?.(progressData.latest_error_summary || "Job processing failed.");
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        startPolling();
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (!isCompleted) {
          startPolling();
        }
      };
    } catch {
      setIsConnected(false);
      startPolling();
    }

    return () => {
      clearTimers();
      if (ws) {
        ws.close();
      }
      socketRef.current = null;
    };
  }, [jobId, companyId, clearTimers, startPolling, onCompleted, onError, isCompleted]);

  return {
    frame,
    isConnected,
    isCompleted,
    error,
    progressPercent: frame?.progress_percent ?? 0,
    processedRows: frame?.processed_rows ?? 0,
    totalRows: frame?.total_rows ?? 0,
    status: frame?.status ?? "PENDING",
  };
}
