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

health_check.py — Full-Stack Operational Health & Service Availability Diagnostic Utility
Conforms to AOP-006 (Distributed Observability & Tracing Principle).
"""

import sys
import logging
import urllib.request
import urllib.error
import subprocess

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smriti.health_check")

SERVICES = [
    {"name": "Frontend Workspace UI", "url": "http://localhost:3000", "expected_status": 200, "headers": {}},
    {"name": "Backend REST API Docs", "url": "http://localhost:8000/docs", "expected_status": 200, "headers": {}},
    {"name": "Public API Gateway Catalog (Auth Check)", "url": "http://localhost:8000/api/public/v1/catalog", "expected_status": 401, "headers": {}},
    {"name": "Public API Gateway Catalog (Valid Key)", "url": "http://localhost:8000/api/public/v1/catalog", "expected_status": 200, "headers": {"X-API-Key": "smriti_pub_demo_key_123"}},
]

def check_http_endpoint(name, url, expected_status=200, headers=None):
    """Ping HTTP service endpoint and assert status code."""
    req_headers = {"User-Agent": "SmritiHealthChecker/1.0"}
    if headers:
        req_headers.update(headers)
    try:
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req, timeout=5) as response:
            status = response.getcode()
            if status == expected_status:
                logger.info("[PASS] %s is UP & HEALTHY (%s -> HTTP %d)", name, url, status)
                return True
            else:
                logger.error("[FAIL] %s returned unexpected HTTP %d (Expected %d)", name, status, expected_status)
                return False
    except urllib.error.HTTPError as e:
        if e.code == expected_status:
            logger.info("[PASS] %s is UP & HEALTHY (%s -> HTTP %d)", name, url, e.code)
            return True
        logger.error("[FAIL] %s HTTP Error: %d %s", name, e.code, e.reason)
        return False
    except Exception as e:
        logger.error("[FAIL] %s unreachable (%s): %s", name, url, str(e))
        return False

def check_docker_containers():
    """Verify Docker container health statuses for smriti-workspace, smriti-api, and smriti-db."""
    containers = ["smriti-workspace", "smriti-api", "smriti-db"]
    all_healthy = True
    for container in containers:
        try:
            res = subprocess.run(
                f"docker inspect --format='{{{{.State.Health.Status}}}}' {container}",
                shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True
            )
            status = res.stdout.strip().strip("'\" \n\r")
            if status == "healthy":
                logger.info("[PASS] Docker container '%s' status: HEALTHY", container)
            else:
                logger.warning("[WARN] Docker container '%s' status: %s", container, status)
                all_healthy = False
        except Exception:
            logger.error("[FAIL] Docker container '%s' inspect failed.", container)
            all_healthy = False
    return all_healthy


def main():
    logger.info("Starting SMRITI Retail OS Full-Stack Health Audit...")
    results = []

    # 1. Docker Container Health
    docker_pass = check_docker_containers()
    results.append(("Docker Containers", docker_pass))

    # 2. HTTP Endpoints
    for svc in SERVICES:
        passed = check_http_endpoint(svc["name"], svc["url"], svc["expected_status"], svc.get("headers"))
        results.append((svc["name"], passed))


    # Summary
    logger.info("=== HEALTH AUDIT SUMMARY ===")
    failed_count = 0
    for name, ok in results:
        status_str = "HEALTHY ✅" if ok else "UNHEALTHY ❌"
        logger.info(" - %-32s : %s", name, status_str)
        if not ok:
            failed_count += 1

    if failed_count > 0:
        logger.error("Health check failed with %d unhealthy component(s).", failed_count)
        sys.exit(1)

    logger.info("=== FULL STACK IS 100% OPERATIONAL & HEALTHY ===")
    sys.exit(0)

if __name__ == "__main__":
    main()
