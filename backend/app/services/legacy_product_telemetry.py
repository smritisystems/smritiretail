"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Durable Telemetry & Observability Sink (Phase 5 Legacy Deprecation Gateway)
"""

# smriti_capability(entity="INVENTORY", capability="LEGACY_PRODUCT_TELEMETRY", role="SERVICE", canonicalOwner="backend/app/services/legacy_product_telemetry.py")

import os
import json
import time
import threading
from typing import List, Dict, Any, Optional
from collections import Counter
from datetime import datetime, timezone

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
TELEMETRY_LOG_FILE = os.path.join(LOG_DIR, "legacy_deprecation_telemetry.jsonl")

_lock = threading.Lock()
_dedup_window: Dict[str, float] = {}
_in_memory_events: List[Dict[str, Any]] = []
_RATE_LIMIT_WINDOW_SECONDS = 60.0


class LegacyProductTelemetrySink:
    """
    Production-grade durable telemetry sink for legacy product endpoints and runtime fallbacks.
    Provides:
      1. Atomically persisted JSONL logging for audit trails.
      2. In-memory windowed deduplication / rate-limiting (60-second window per key)
         to protect I/O throughput during high-frequency retail scanning.
      3. Aggregated operational metrics across companies, callers, and endpoint paths.
    """

    @classmethod
    def _ensure_log_dir(cls) -> None:
        if not os.path.exists(LOG_DIR):
            os.makedirs(LOG_DIR, exist_ok=True)

    @classmethod
    def record_endpoint_access(
        cls,
        path: str,
        method: str = "GET",
        client_ip: Optional[str] = None,
        company_id: Optional[str] = None,
        user_id: Optional[str] = None,
        successor_endpoint: str = "/api/v1/universal/items",
        warning_code: str = "SMRITI-DEPR-002",
        force_write: bool = False,
    ) -> Dict[str, Any]:
        """
        Records an external access to a legacy product endpoint (e.g. /api/v1/products).
        """
        now = time.time()
        dedup_key = f"ENDPOINT:{company_id or 'anon'}:{method}:{path}"

        event: Dict[str, Any] = {
            "event_type": "LEGACY_ENDPOINT_ACCESSED",
            "timestamp": now,
            "iso_timestamp": datetime.now(timezone.utc).isoformat(),
            "path": path,
            "method": method,
            "client_ip": client_ip,
            "company_id": company_id,
            "user_id": user_id,
            "successor_endpoint": successor_endpoint,
            "warning_code": warning_code,
        }

        should_write_to_disk = False
        with _lock:
            _in_memory_events.append(event)
            last_recorded = _dedup_window.get(dedup_key, 0.0)
            if force_write or (now - last_recorded >= _RATE_LIMIT_WINDOW_SECONDS):
                _dedup_window[dedup_key] = now
                should_write_to_disk = True

        if should_write_to_disk:
            cls._append_to_disk(event)

        return event

    @classmethod
    def record_fallback_invoked(
        cls,
        company_id: str,
        caller: str,
        product_id: Optional[str] = None,
        reason: str = "VARIANT_ID_NULL",
        warning_code: str = "SMRITI-DEPR-003",
        force_write: bool = False,
    ) -> Dict[str, Any]:
        """
        Records an internal runtime fallback where a reader or exporter defaulted to legacy product_id
        because variant_id was absent or unlinked.
        """
        now = time.time()
        dedup_key = f"FALLBACK:{company_id}:{caller}:{product_id or 'none'}:{reason}"

        event: Dict[str, Any] = {
            "event_type": "LEGACY_FALLBACK_INVOKED",
            "timestamp": now,
            "iso_timestamp": datetime.now(timezone.utc).isoformat(),
            "company_id": company_id,
            "caller": caller,
            "product_id": product_id,
            "reason": reason,
            "warning_code": warning_code,
        }

        should_write_to_disk = False
        with _lock:
            _in_memory_events.append(event)
            last_recorded = _dedup_window.get(dedup_key, 0.0)
            if force_write or (now - last_recorded >= _RATE_LIMIT_WINDOW_SECONDS):
                _dedup_window[dedup_key] = now
                should_write_to_disk = True

        if should_write_to_disk:
            cls._append_to_disk(event)

        return event

    @classmethod
    def _append_to_disk(cls, event: Dict[str, Any]) -> None:
        cls._ensure_log_dir()
        try:
            line = json.dumps(event, default=str) + "\n"
        except Exception:
            line = json.dumps({k: str(v) for k, v in event.items()}) + "\n"

        with _lock:
            try:
                with open(TELEMETRY_LOG_FILE, "a", encoding="utf-8") as f:
                    f.write(line)
            except OSError:
                pass

    @classmethod
    def get_events(
        cls,
        limit: int = 1000,
        company_id: Optional[str] = None,
        event_type: Optional[str] = None,
        from_disk: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves recent events from memory (default) or directly from disk.
        """
        if from_disk:
            cls._ensure_log_dir()
            if not os.path.exists(TELEMETRY_LOG_FILE):
                return []
            events: List[Dict[str, Any]] = []
            with _lock:
                try:
                    with open(TELEMETRY_LOG_FILE, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            try:
                                ev = json.loads(line)
                                if company_id and ev.get("company_id") != company_id:
                                    continue
                                if event_type and ev.get("event_type") != event_type:
                                    continue
                                events.append(ev)
                            except json.JSONDecodeError:
                                continue
                except OSError:
                    return []
            return events[-limit:]

        with _lock:
            filtered = _in_memory_events[:]

        if company_id:
            filtered = [e for e in filtered if e.get("company_id") == company_id]
        if event_type:
            filtered = [e for e in filtered if e.get("event_type") == event_type]

        return filtered[-limit:]

    @classmethod
    def clear_durable_log(cls) -> None:
        """Clears both disk file and in-memory caches (for testing isolation)."""
        with _lock:
            _in_memory_events.clear()
            _dedup_window.clear()
            if os.path.exists(TELEMETRY_LOG_FILE):
                try:
                    os.remove(TELEMETRY_LOG_FILE)
                except OSError:
                    pass

    @classmethod
    def get_metrics_summary(cls, company_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Returns high-level aggregation of legacy accesses and fallbacks.
        """
        events = cls.get_events(limit=10000, company_id=company_id)
        endpoint_events = [e for e in events if e.get("event_type") == "LEGACY_ENDPOINT_ACCESSED"]
        fallback_events = [e for e in events if e.get("event_type") == "LEGACY_FALLBACK_INVOKED"]

        paths_counter = Counter(e.get("path") for e in endpoint_events if e.get("path"))
        callers_counter = Counter(e.get("caller") for e in fallback_events if e.get("caller"))
        reasons_counter = Counter(e.get("reason") for e in fallback_events if e.get("reason"))
        companies_set = {e.get("company_id") for e in events if e.get("company_id")}

        return {
            "total_events": len(events),
            "endpoint_access_total": len(endpoint_events),
            "fallback_invoked_total": len(fallback_events),
            "unique_companies_count": len(companies_set),
            "by_path": dict(paths_counter),
            "by_caller": dict(callers_counter),
            "by_reason": dict(reasons_counter),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
