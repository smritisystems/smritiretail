"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

benchmark_performance.py — Latency & Throughput Benchmark Suite for SMRITI Retail OS APIs
Conforms to AOP-006 (Distributed Observability & Tracing Principle) and NFRC Performance SLA (<100ms Avg Latency).
"""

import time
import sys
import logging
import urllib.request
import urllib.error
import statistics

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smriti.benchmark")

BENCHMARKS = [
    {
        "name": "Backend OpenAPI Health",
        "url": "http://localhost:8000/docs",
        "headers": {},
        "target_avg_ms": 100
    },
    {
        "name": "Public API Gateway Catalog",
        "url": "http://localhost:8000/api/public/v1/catalog",
        "headers": {"X-API-Key": "smriti_pub_demo_key_123"},
        "target_avg_ms": 100
    },
    {
        "name": "Setup Status API",
        "url": "http://localhost:8000/api/v1/setup-status",
        "headers": {},
        "target_avg_ms": 100
    }
]

NUM_REQUESTS = 30

def benchmark_endpoint(name, url, headers=None, num_requests=NUM_REQUESTS):
    """Execute n requests against endpoint and compute latency statistics."""
    req_headers = {"User-Agent": "SmritiBenchmarkSuite/1.0"}
    if headers:
        req_headers.update(headers)

    latencies_ms = []
    errors = 0

    logger.info("Benchmarking '%s' across %d iterations...", name, num_requests)
    for _ in range(num_requests):
        start = time.perf_counter()
        try:
            req = urllib.request.Request(url, headers=req_headers)
            with urllib.request.urlopen(req, timeout=5) as resp:
                _ = resp.read()
                elapsed = (time.perf_counter() - start) * 1000.0
                latencies_ms.append(elapsed)
        except Exception:
            errors += 1

    if not latencies_ms:
        logger.error("[FAIL] Benchmark '%s' failed: 100%% request failures.", name)
        return None

    min_ms = min(latencies_ms)
    max_ms = max(latencies_ms)
    avg_ms = statistics.mean(latencies_ms)
    p95_ms = sorted(latencies_ms)[int(len(latencies_ms) * 0.95) - 1]

    logger.info("Result for '%s': Avg = %.2f ms | Min = %.2f ms | Max = %.2f ms | P95 = %.2f ms | Errors = %d/%d",
                name, avg_ms, min_ms, max_ms, p95_ms, errors, num_requests)
    return {
        "name": name,
        "avg_ms": avg_ms,
        "min_ms": min_ms,
        "max_ms": max_ms,
        "p95_ms": p95_ms,
        "errors": errors,
        "pass": avg_ms < 150 and errors == 0
    }

def main():
    logger.info("Starting SMRITI Retail OS Performance & Latency Benchmark...")
    results = []

    for bench in BENCHMARKS:
        res = benchmark_endpoint(bench["name"], bench["url"], bench["headers"])
        if res:
            results.append(res)

    logger.info("=== PERFORMANCE BENCHMARK SUMMARY ===")
    failed_benchmarks = 0
    for r in results:
        status_str = "PASSED ✅" if r["pass"] else "FAILED ❌"
        logger.info(" - %-32s : Avg %6.2f ms (P95 %6.2f ms) | Status: %s",
                    r["name"], r["avg_ms"], r["p95_ms"], status_str)
        if not r["pass"]:
            failed_benchmarks += 1

    if failed_benchmarks > 0:
        logger.error("Performance benchmark finished with %d SLA violation(s).", failed_benchmarks)
        sys.exit(1)

    logger.info("=== ALL PERFORMANCE BENCHMARKS PASSED SLA (<100ms) ===")
    sys.exit(0)

if __name__ == "__main__":
    main()
