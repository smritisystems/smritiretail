"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.8.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.auth import User
from app.services.telemetry_service import SystemTelemetryService

router = APIRouter(prefix="/diagnostics", tags=["SMRITI Operational Observability & Telemetry Engine"])


@router.get(
    "/health",
    summary="Active System Health Check Probe",
    description="Returns real-time database connection latency, system health status, and environment state."
)
async def system_health_probe(db: AsyncSession = Depends(get_db)):
    svc = SystemTelemetryService(db)
    return await svc.get_system_health()


@router.get(
    "/benchmark",
    summary="Environment Hardware & Benchmark Metrics Report",
    description="Reports system hardware environment specifications, CPU/RAM context, and performance target benchmarks."
)
async def environment_benchmark_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = SystemTelemetryService(db)
    return await svc.get_environment_benchmark_report()


@router.get(
    "/backup-verify",
    summary="Database Backup & Restoration Verification Probe",
    description="Verifies database backup WAL integrity, restoration test status, and backup SHA-256 hash."
)
async def backup_verification_probe(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = SystemTelemetryService(db)
    return await svc.verify_backup_integrity()


@router.get(
    "/metrics",
    summary="Prometheus Text Format Metrics Export Probe",
    description="Returns Prometheus-compatible metrics for Grafana / OpenTelemetry collectors."
)
async def prometheus_metrics_export(db: AsyncSession = Depends(get_db)):
    svc = SystemTelemetryService(db)
    content = await svc.get_prometheus_metrics()
    return Response(content=content, media_type="text/plain; version=0.0.4; charset=utf-8")
