"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Reporting & BI Engine — Query Performance-Tier Router.
Enforces Invariant 5: Workload isolation preventing heavy analytical/export jobs
from degrading interactive POS/reporting queries.
"""

from enum import Enum
from datetime import date, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class PerformanceTier(str, Enum):
    TIER_1_INTERACTIVE = "TIER_1_INTERACTIVE"       # < 50ms SLA (POS Shift, Daily Sales, Bill lookup)
    TIER_2_ANALYTICAL = "TIER_2_ANALYTICAL"         # < 300ms SLA (Size Matrix, Category Summary)
    TIER_3_HISTORICAL = "TIER_3_HISTORICAL"         # Async / Chunked (Yearly comparisons, Ledger audit)
    TIER_4_STREAMING_EXPORT = "TIER_4_STREAMING_EXPORT" # Memory-bounded streaming for XLSX/CSV


class QueryExecutionRoute(BaseModel):
    tier: PerformanceTier
    target_latency_ms: int
    timeout_seconds: float
    max_memory_mb: int
    is_async_required: bool = False
    is_streaming: bool = False
    execution_strategy: str


# ---------------------------------------------------------------------------
# Tier Allocation Policy Rules
# ---------------------------------------------------------------------------

TIER_POLICY: Dict[PerformanceTier, Dict[str, Any]] = {
    PerformanceTier.TIER_1_INTERACTIVE: {
        "target_latency_ms": 50,
        "timeout_seconds": 3.0,
        "max_memory_mb": 64,
        "is_async_required": False,
        "is_streaming": False,
        "execution_strategy": "DIRECT_INDEXED_SQL",
    },
    PerformanceTier.TIER_2_ANALYTICAL: {
        "target_latency_ms": 300,
        "timeout_seconds": 15.0,
        "max_memory_mb": 256,
        "is_async_required": False,
        "is_streaming": False,
        "execution_strategy": "AGGREGATION_CTE_WINDOW",
    },
    PerformanceTier.TIER_3_HISTORICAL: {
        "target_latency_ms": 5000,
        "timeout_seconds": 90.0,
        "max_memory_mb": 512,
        "is_async_required": True,
        "is_streaming": False,
        "execution_strategy": "BACKGROUND_CHUNKED_ASYNC",
    },
    PerformanceTier.TIER_4_STREAMING_EXPORT: {
        "target_latency_ms": 2000,
        "timeout_seconds": 120.0,
        "max_memory_mb": 128,
        "is_async_required": False,
        "is_streaming": True,
        "execution_strategy": "ITERATIVE_STREAMING_WRITER",
    },
}


class PerformanceRouter:
    """Classifies and routes report queries into optimal performance execution tiers."""

    @classmethod
    def classify_query(
        cls,
        report_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        is_multi_branch: bool = False,
        is_export: bool = False,
        export_format: Optional[str] = None
    ) -> QueryExecutionRoute:
        """
        Determines the execution tier based on workload characteristics:
        - Exports -> TIER_4_STREAMING_EXPORT
        - Date span > 90 days or multi-year -> TIER_3_HISTORICAL
        - Matrix / multi-category -> TIER_2_ANALYTICAL
        - Single-day or <= 7 days single branch -> TIER_1_INTERACTIVE
        """
        # 1. Export Routing
        if is_export or export_format in ["xlsx", "csv", "txt", "pdf"]:
            policy = TIER_POLICY[PerformanceTier.TIER_4_STREAMING_EXPORT]
            return QueryExecutionRoute(
                tier=PerformanceTier.TIER_4_STREAMING_EXPORT,
                target_latency_ms=policy["target_latency_ms"],
                timeout_seconds=policy["timeout_seconds"],
                max_memory_mb=policy["max_memory_mb"],
                is_async_required=policy["is_async_required"],
                is_streaming=policy["is_streaming"],
                execution_strategy=policy["execution_strategy"],
            )

        # 2. Date Range Calculation
        days = 1
        if from_date and to_date:
            days = max((to_date - from_date).days + 1, 1)

        # 3. Heavy Historical Routing (> 90 days or multi-branch multi-month)
        if days > 90 or (is_multi_branch and days > 31):
            policy = TIER_POLICY[PerformanceTier.TIER_3_HISTORICAL]
            return QueryExecutionRoute(
                tier=PerformanceTier.TIER_3_HISTORICAL,
                target_latency_ms=policy["target_latency_ms"],
                timeout_seconds=policy["timeout_seconds"],
                max_memory_mb=policy["max_memory_mb"],
                is_async_required=policy["is_async_required"],
                is_streaming=policy["is_streaming"],
                execution_strategy=policy["execution_strategy"],
            )

        # 4. Analytical Matrix Routing (Apparel Matrix, Top Sellers, Multi-Month)
        analytical_reports = {
            "RPT-MRC-001",  # Size Matrix Pivot
            "RPT-MRC-002",  # Superclass / Dept
            "RPT-SAL-003",  # Top Selling Products
            "RPT-INV-002",  # Stock Aging
            "RPT-MIS-001",  # Store-vs-Store
            "RPT-MIS-002",  # Period Growth
            "RPT-PRF-001",  # Gross Margin
        }

        if report_id in analytical_reports or days > 7 or is_multi_branch:
            policy = TIER_POLICY[PerformanceTier.TIER_2_ANALYTICAL]
            return QueryExecutionRoute(
                tier=PerformanceTier.TIER_2_ANALYTICAL,
                target_latency_ms=policy["target_latency_ms"],
                timeout_seconds=policy["timeout_seconds"],
                max_memory_mb=policy["max_memory_mb"],
                is_async_required=policy["is_async_required"],
                is_streaming=policy["is_streaming"],
                execution_strategy=policy["execution_strategy"],
            )

        # 5. Fast Interactive POS Shift Routing (<= 7 days, single branch)
        policy = TIER_POLICY[PerformanceTier.TIER_1_INTERACTIVE]
        return QueryExecutionRoute(
            tier=PerformanceTier.TIER_1_INTERACTIVE,
            target_latency_ms=policy["target_latency_ms"],
            timeout_seconds=policy["timeout_seconds"],
            max_memory_mb=policy["max_memory_mb"],
            is_async_required=policy["is_async_required"],
            is_streaming=policy["is_streaming"],
            execution_strategy=policy["execution_strategy"],
        )
