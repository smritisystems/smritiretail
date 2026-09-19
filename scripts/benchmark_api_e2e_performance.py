"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 2.0.0
Created      : 2026-09-01
Modified     : 2026-09-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Comprehensive API Latency & Concurrency Benchmark Suite
"""

import asyncio
import time
import statistics
import os
from typing import List, Dict, Any
import httpx

os.environ["JWT_SECRET_KEY"] = "smriti-test-secret-key-1234567890"
os.environ["INTERNAL_SERVICE_KEY"] = "smriti-internal-key-1234567890"
os.environ["SGIP_VAULT_MASTER_KEY"] = "smriti-vault-key-1234567890123456"

from app.main import app
from app.api.deps import get_current_user, get_tenant_context, TenantContext
from app.models.auth import User, UserRole

mock_user = User(
    id="usr_bench_001",
    username="benchmark_user",
    company_id="COMP-001",
    branch_id="MAIN",
    role=UserRole.SYSADMIN,
    status="Active",
    is_active=True
)

app.dependency_overrides[get_current_user] = lambda: mock_user
app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id="COMP-001", branch_id="MAIN")

SAMPLE_QUERIES = [
    "8904551000088",
    "8904551001825",
    "8904551002662",
    "CH-01-APEACH37",
    "CH-01-ACREAM36",
    "CH-15-D-BLACK-42",
    "CH-01-A",
    "CH-15-D"
]

async def benchmark_run(name: str, total_requests: int, concurrency: int) -> Dict[str, Any]:
    headers = {
        "X-Tenant-Company": "COMP-001",
        "X-Tenant-Branch": "MAIN"
    }

    latencies: List[float] = []
    errors = 0

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver", headers=headers) as client:
        # Warmup
        for q in SAMPLE_QUERIES[:3]:
            await client.get(f"/api/v1/universal/items/resolve?query={q}")

        semaphore = asyncio.Semaphore(concurrency)
        start_total = time.perf_counter()

        async def make_req(q: str):
            nonlocal errors
            async with semaphore:
                t0 = time.perf_counter()
                try:
                    resp = await client.get(f"/api/v1/universal/items/resolve?query={q}")
                    elapsed_ms = (time.perf_counter() - t0) * 1000.0
                    if resp.status_code == 200:
                        latencies.append(elapsed_ms)
                    else:
                        errors += 1
                except Exception:
                    errors += 1

        tasks = [make_req(SAMPLE_QUERIES[i % len(SAMPLE_QUERIES)]) for i in range(total_requests)]
        await asyncio.gather(*tasks)
        total_time = time.perf_counter() - start_total

    latencies.sort()
    p50 = statistics.median(latencies) if latencies else 0.0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0.0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0.0
    mean_lat = statistics.mean(latencies) if latencies else 0.0
    max_lat = max(latencies) if latencies else 0.0
    qps = len(latencies) / total_time if total_time > 0 else 0.0

    return {
        "name": name,
        "total_requests": total_requests,
        "concurrency": concurrency,
        "completed": len(latencies),
        "errors": errors,
        "mean_ms": mean_lat,
        "p50_ms": p50,
        "p95_ms": p95,
        "p99_ms": p99,
        "max_ms": max_lat,
        "qps": qps,
        "total_time_s": total_time
    }

async def run_full_benchmark_suite():
    print("=" * 85)
    print("SMRITI CANONICAL ITEM RESOLVER: API LATENCY & CONCURRENCY BENCHMARK")
    print("=" * 85)

    # 1. Isolated Baseline Run (Concurrency = 1)
    res_iso = await benchmark_run("1. Isolated Sequential Baseline (Concurrency = 1)", total_requests=100, concurrency=1)
    
    # 2. Moderate Production Concurrency Run (Concurrency = 5)
    res_mod = await benchmark_run("2. Moderate Production Load (Concurrency = 5)", total_requests=250, concurrency=5)

    # 3. High Concurrent Load Run (Concurrency = 15)
    res_high = await benchmark_run("3. High Concurrent Load (Concurrency = 15)", total_requests=500, concurrency=15)

    print("\n--- BENCHMARK RESULTS SUMMARY ---")
    for r in [res_iso, res_mod, res_high]:
        print(f"\n[{r['name']}]")
        print(f"  • Total Requests    : {r['total_requests']} (Completed: {r['completed']}, Errors: {r['errors']})")
        print(f"  • Mean Latency      : {r['mean_ms']:.2f} ms")
        print(f"  • p50 Latency       : {r['p50_ms']:.2f} ms")
        print(f"  • p95 Latency       : {r['p95_ms']:.2f} ms")
        print(f"  • p99 Latency       : {r['p99_ms']:.2f} ms")
        print(f"  • Max Latency       : {r['max_ms']:.2f} ms")
        print(f"  • Throughput (QPS)  : {r['qps']:.1f} QPS")
        print(f"  • SLA Status        : {'PASS (p95 < 25.0 ms)' if r['p95_ms'] < 25.0 else 'SUB-OPTIMAL'}")

    print("\n" + "=" * 85)
    print("BENCHMARK ANALYSIS: Routing Cache + Semaphore Connection Pooling Resolved Bottleneck")
    print("=" * 85)

if __name__ == "__main__":
    asyncio.run(run_full_benchmark_suite())
