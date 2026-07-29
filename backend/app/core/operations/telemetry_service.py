"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 15.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Enterprise Observability & Telemetry Gateway
"""

import time
from typing import Dict, Any
from app.core.spk_kernel import kernel


class TelemetryService:
    """Enterprise Observability & Telemetry Gateway (SMP-011 Compliant)."""

    @staticmethod
    def get_prometheus_metrics() -> str:
        """Exports Prometheus metric counters and gauges."""
        stats = kernel.get_kernel_diagnostics()
        lines = [
            "# HELP smriti_spk_modules_total Total registered modules",
            "# TYPE smriti_spk_modules_total gauge",
            f"smriti_spk_modules_total {stats['total_registered_modules']}",
            "# HELP smriti_spk_active_modules Active enabled modules",
            "# TYPE smriti_spk_active_modules gauge",
            f"smriti_spk_active_modules {stats['active_enabled_modules']}",
            "# HELP smriti_spk_memory_bytes Memory footprint in bytes",
            "# TYPE smriti_spk_memory_bytes gauge",
            f"smriti_spk_memory_bytes {int(stats['memory_footprint_mb'] * 1024 * 1024)}"
        ]
        return "\n".join(lines)

    @staticmethod
    def get_liveness_probe() -> Dict[str, Any]:
        """Returns liveness diagnostic status."""
        return {"status": "ALIVE", "timestamp": time.time()}

    @staticmethod
    def get_readiness_probe() -> Dict[str, Any]:
        """Returns readiness status asserting SPK Kernel readiness."""
        is_ready = kernel.lifecycle_state.name == "READY" or kernel.lifecycle_state.name == "START"
        return {"status": "READY" if is_ready else "NOT_READY", "is_ready": is_ready}
