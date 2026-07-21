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
Classification: Enterprise Operations REST API Router
"""

import tempfile
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Response, Body

from app.core.operations.cluster_manager import ClusterManager
from app.core.operations.telemetry_service import TelemetryService
from app.core.operations.disaster_recovery_service import DisasterRecoveryService
from app.core.operations.performance_budget_evaluator import PerformanceBudgetEvaluator

router = APIRouter(prefix="/operations", tags=["Layer 5 Enterprise Operations"])

cluster_manager = ClusterManager()
dr_service = DisasterRecoveryService()


@router.get("/cluster")
async def get_cluster_status():
    """Returns multi-node cluster status and leader election state."""
    return cluster_manager.get_cluster_status()


@router.get("/telemetry")
async def get_prometheus_metrics():
    """Exports Prometheus format metric counters and gauges."""
    metrics_text = TelemetryService.get_prometheus_metrics()
    return Response(content=metrics_text, media_type="text/plain")


@router.get("/live")
async def liveness_probe():
    """Liveness probe diagnostic check."""
    return TelemetryService.get_liveness_probe()


@router.get("/ready")
async def readiness_probe():
    """Readiness probe diagnostic check."""
    return TelemetryService.get_readiness_probe()


@router.post("/backup")
async def create_dr_backup():
    """Creates a disaster recovery snapshot archive."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        ok, path_or_msg = dr_service.create_snapshot(tmp_dir)
        if not ok:
            raise HTTPException(status_code=500, detail=path_or_msg)
        return {"success": True, "message": "Snapshot created", "backup_path": path_or_msg}


@router.post("/restore")
async def restore_dr_backup(backup_path: str = Body(..., embed=True)):
    """Restores a disaster recovery snapshot under maintenance lock."""
    ok, msg = dr_service.restore_snapshot(backup_path)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True, "message": msg}


@router.get("/performance")
async def evaluate_performance_sla():
    """Evaluates performance budgets against target SLAs."""
    return {
        "catalog": PerformanceBudgetEvaluator.evaluate_metric("catalog_lookup_ms", 4.2),
        "module_enable": PerformanceBudgetEvaluator.evaluate_metric("module_enable_ms", 12.0),
        "health_probe": PerformanceBudgetEvaluator.evaluate_metric("health_probe_ms", 1.5)
    }
