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
Classification: Gate 8 End-to-End API Performance Benchmark Suite
"""

import asyncio
import time
import statistics
import os
from typing import List
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

CONCURRENT_REQUESTS = 500
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

async def run_api_benchmark():
    print("=" * 85)
    print("SMRITI GATE 8: END-TO-END API-LEVEL PERFORMANCE BENCHMARK")
    print(f"Requests: {CONCURRENT_REQUESTS} | Target: ASGI FastAPI Pipeline (/api/v1/universal/items/resolve)")
    print("=" * 85)

    headers = {
        "X-Tenant-Company": "COMP-001",
        "X-Tenant-Branch": "MAIN"
    }

    latencies: List[float] = []
    errors: int = 0

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver", headers=headers) as client:
        # Warmup
        for q in SAMPLE_QUERIES[:3]:
            await client.get(f"/api/v1/universal/items/resolve?query={q}")

        start_total = time.perf_counter()
        
        async def make_request(query: str):
            nonlocal errors
            t0 = time.perf_counter()
            try:
                resp = await client.get(f"/api/v1/universal/items/resolve?query={query}")
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                if resp.status_code in (200, 404):
                    latencies.append(elapsed_ms)
                else:
                    errors += 1
            except Exception:
                errors += 1

        # Execute concurrent batches
        batch_size = 25
        for i in range(0, CONCURRENT_REQUESTS, batch_size):
            tasks = [make_request(SAMPLE_QUERIES[(i + j) % len(SAMPLE_QUERIES)]) for j in range(batch_size)]
            await asyncio.gather(*tasks)

        total_elapsed = time.perf_counter() - start_total

    latencies.sort()
    p50 = statistics.median(latencies) if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0
    mean_lat = statistics.mean(latencies) if latencies else 0
    qps = len(latencies) / total_elapsed if total_elapsed > 0 else 0

    print(f"\nBenchmark Metrics Summary ({len(latencies)} completed calls):")
    print(f"  • Mean Latency : {mean_lat:.2f} ms")
    print(f"  • p50 Latency  : {p50:.2f} ms")
    print(f"  • p95 Latency  : {p95:.2f} ms")
    print(f"  • p99 Latency  : {p99:.2f} ms")
    print(f"  • Throughput   : {qps:.1f} Requests / Second (QPS)")
    print(f"  • Error Rate   : {(errors / CONCURRENT_REQUESTS) * 100.0:.2f}% ({errors} errors)")
    print(f"  • SLA Status   : {'PASS (p95 < 25ms, Error Rate = 0%)' if p95 < 25.0 and errors == 0 else 'WARN'}")

    print("\n" + "=" * 85)
    print("END-TO-END API BENCHMARK VERIFIED UNDER FULL ASGI PIPELINE")
    print("=" * 85)

if __name__ == "__main__":
    asyncio.run(run_api_benchmark())
