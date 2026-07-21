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
Classification: Pytest Suite for Phase 21 Enterprise Operations Engine

test_enterprise_operations.py — Integration test suite for Layer 5 Operations Engine.
"""

import tempfile
from pathlib import Path
import pytest

from app.core.operations.cluster_manager import ClusterManager, NodeRole
from app.core.operations.telemetry_service import TelemetryService
from app.core.operations.disaster_recovery_service import DisasterRecoveryService, DisasterRecoveryState
from app.core.operations.performance_budget_evaluator import PerformanceBudgetEvaluator


@pytest.mark.asyncio
async def test_cluster_manager_leader_and_heartbeat():
    """Verify ClusterManager node registration and heartbeats."""
    mgr = ClusterManager("node-01")
    status = mgr.get_cluster_status()
    assert status["cluster_size"] == 1
    assert status["leader_node_id"] == "node-01"

    node2 = mgr.register_node("node-02", "192.168.1.50:8000")
    assert node2.role == NodeRole.FOLLOWER
    assert mgr.get_cluster_status()["cluster_size"] == 2

    hb_ok = mgr.record_heartbeat("node-02")
    assert hb_ok is True


@pytest.mark.asyncio
async def test_telemetry_service_prometheus_and_probes():
    """Verify TelemetryService Prometheus metric exports and diagnostic probes."""
    metrics = TelemetryService.get_prometheus_metrics()
    assert "smriti_spk_modules_total" in metrics
    assert "smriti_spk_active_modules" in metrics

    live = TelemetryService.get_liveness_probe()
    assert live["status"] == "ALIVE"

    ready = TelemetryService.get_readiness_probe()
    assert ready["status"] in ["READY", "NOT_READY"]


@pytest.mark.asyncio
async def test_disaster_recovery_snapshot_and_restore():
    """Verify DisasterRecoveryService snapshot creation, verification, and restoration."""
    dr = DisasterRecoveryService()

    with tempfile.TemporaryDirectory() as tmp_dir:
        ok_snap, zip_path = dr.create_snapshot(tmp_dir)
        assert ok_snap is True
        assert Path(zip_path).exists()
        assert dr.state == DisasterRecoveryState.ARCHIVED

        ok_rest, msg = dr.restore_snapshot(zip_path)
        assert ok_rest is True
        assert msg == "Snapshot restored successfully"
        assert dr.state == DisasterRecoveryState.ONLINE
        assert dr.maintenance_mode is False


@pytest.mark.asyncio
async def test_performance_budget_evaluator():
    """Verify PerformanceBudgetEvaluator policy evaluation."""
    pass_eval = PerformanceBudgetEvaluator.evaluate_metric("catalog_lookup_ms", 12.5)
    assert pass_eval["within_budget"] is True
    assert pass_eval["status"] == "PASS"

    fail_eval = PerformanceBudgetEvaluator.evaluate_metric("catalog_lookup_ms", 120.0)
    assert fail_eval["within_budget"] is False
    assert fail_eval["status"] == "SLA_VIOLATION"
