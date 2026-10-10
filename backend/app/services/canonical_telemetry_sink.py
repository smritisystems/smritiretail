"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-01
Modified     : 2026-09-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Durable Telemetry & Observability Sink (Gate 9.1)
"""

import os
import json
import time
import threading
import statistics
from typing import List, Dict, Any, Optional
from collections import Counter

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
TELEMETRY_LOG_FILE = os.path.join(LOG_DIR, "canonical_resolution_telemetry.jsonl")

_lock = threading.Lock()


class CanonicalTelemetrySink:
    """
    Production-grade durable telemetry sink for canonical item resolution.
    Appends events atomically to JSONL log file, guarantees persistence across process restarts,
    and provides statistical metric aggregation and real-time alert evaluation.
    """

    @classmethod
    def _ensure_log_dir(cls):
        if not os.path.exists(LOG_DIR):
            os.makedirs(LOG_DIR, exist_ok=True)

    @classmethod
    def record_event(cls, event: Dict[str, Any]) -> None:
        """
        Atomically records a resolution telemetry event to durable storage.
        """
        cls._ensure_log_dir()
        try:
            serialized = json.dumps(event, default=str) + "\n"
        except Exception:
            serialized = json.dumps({k: str(v) for k, v in event.items()}) + "\n"
        with _lock:
            with open(TELEMETRY_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(serialized)

    @classmethod
    def get_events(
        cls,
        limit: int = 5000,
        company_id: Optional[str] = None,
        since_timestamp: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Reads recorded events from durable storage.
        """
        cls._ensure_log_dir()
        if not os.path.exists(TELEMETRY_LOG_FILE):
            return []

        events: List[Dict[str, Any]] = []
        with _lock:
            with open(TELEMETRY_LOG_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        ev = json.loads(line)
                        if company_id and ev.get("company_id") != company_id:
                            continue
                        if since_timestamp and ev.get("timestamp", 0) < since_timestamp:
                            continue
                        events.append(ev)
                    except json.JSONDecodeError:
                        continue

        return events[-limit:]

    @classmethod
    def clear_durable_log(cls) -> None:
        """
        Clears the durable telemetry log (for test harness isolation).
        """
        with _lock:
            if os.path.exists(TELEMETRY_LOG_FILE):
                os.remove(TELEMETRY_LOG_FILE)

    @classmethod
    def get_metrics_summary(cls, since_timestamp: Optional[float] = None) -> Dict[str, Any]:
        """
        Aggregates operational metrics across all persisted telemetry events.
        """
        events = cls.get_events(limit=10000, since_timestamp=since_timestamp)
        total = len(events)
        if total == 0:
            return {
                "total_requests": 0,
                "canonical_hits": 0,
                "fallback_count": 0,
                "divergence_count": 0,
                "latency_p50": 0.0,
                "latency_p95": 0.0,
                "latency_p99": 0.0,
                "alerts": []
            }

        canonical_hits = sum(1 for e in events if e.get("canonical_hit"))
        fallbacks = [e for e in events if e.get("fallback_triggered")]
        unexpected_fallbacks = [
            e for e in fallbacks 
            if e.get("fallback_reason") not in ("NOT_IN_CANONICAL_UNMIGRATED", "REQUIRES_REVIEW_STYLE", "NEGATIVE_TEST")
        ]
        divergences = [e for e in events if e.get("divergence_detected")]
        timeouts = sum(1 for e in events if e.get("fallback_reason") == "CANONICAL_TIMEOUT")
        exceptions = sum(1 for e in events if e.get("fallback_reason") == "CANONICAL_EXCEPTION")

        latencies = sorted([float(e.get("latency_ms", 0.0)) for e in events])
        p50 = statistics.median(latencies) if latencies else 0.0
        p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0.0
        p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0.0
        mean_lat = statistics.mean(latencies) if latencies else 0.0

        source_counts = dict(Counter(e.get("resolution_source", "UNKNOWN") for e in events))
        reason_counts = dict(Counter(e.get("fallback_reason", "NONE") for e in fallbacks))

        return {
            "total_requests": total,
            "canonical_hits": canonical_hits,
            "canonical_hit_rate_pct": (canonical_hits / total) * 100.0 if total > 0 else 0.0,
            "fallback_total": len(fallbacks),
            "unexpected_fallbacks": len(unexpected_fallbacks),
            "divergence_total": len(divergences),
            "timeouts": timeouts,
            "exceptions": exceptions,
            "source_breakdown": source_counts,
            "fallback_reasons": reason_counts,
            "latency": {
                "mean_ms": mean_lat,
                "p50_ms": p50,
                "p95_ms": p95,
                "p99_ms": p99,
                "max_ms": max(latencies) if latencies else 0.0
            }
        }

    @classmethod
    def evaluate_health_alerts(cls, since_timestamp: Optional[float] = None) -> List[Dict[str, str]]:
        """
        Evaluates health alerts against strict Stage 1 / Cohort promotion gates.
        """
        summary = cls.get_metrics_summary(since_timestamp=since_timestamp)
        alerts = []

        if summary["unexpected_fallbacks"] > 0:
            alerts.append({
                "severity": "CRITICAL",
                "code": "UNEXPECTED_FALLBACK_DETECTED",
                "detail": f"{summary['unexpected_fallbacks']} unexplained fallback occurrences detected."
            })

        if summary["timeouts"] > 0:
            alerts.append({
                "severity": "CRITICAL",
                "code": "CANONICAL_TIMEOUT_DETECTED",
                "detail": f"{summary['timeouts']} canonical resolver timeouts observed."
            })

        if summary["exceptions"] > 0:
            alerts.append({
                "severity": "CRITICAL",
                "code": "CANONICAL_EXCEPTION_DETECTED",
                "detail": f"{summary['exceptions']} unhandled exceptions in canonical resolver."
            })

        if summary["latency"]["p95_ms"] > 25.0:
            alerts.append({
                "severity": "WARNING",
                "code": "SLA_DEGRADATION",
                "detail": f"p95 latency is {summary['latency']['p95_ms']:.2f} ms (threshold: 25.0 ms)."
            })

        return alerts
