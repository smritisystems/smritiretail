#  Project      : SMRITI Retail OS
#  Author       : Jawahar Ramkripal Mallah
#  Designation  : Chief Systems Architect & Creator
#  Email        : support@smritibooks.com
#  Websites     : smritibooks.com | erpnbook.com | aitdl.com
#  Version      : 6.99.0
#  Created      : 2026-10-17
#  Modified     : 2026-10-17
#  Copyright    : © SMRITIBooks.com. All Rights Reserved.
#  License      : Proprietary Commercial Software
#  Classification: Unified SMRITI CLI Health Probe Command

import argparse
import json
import socket
import sys
import time
import urllib.error
import urllib.request
from typing import Dict, Any

from app.cli.utils import output_result


def register_subparser(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "health",
        help="Execute unified, cross-platform socket and HTTP service health probes.",
        description="Performs non-mutating connectivity checks across PostgreSQL, FastAPI, and Vite web client."
    )
    parser.add_argument(
        "--db-host",
        default="127.0.0.1",
        help="PostgreSQL host (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--db-port",
        type=int,
        default=2781,
        help="PostgreSQL port (default: 2781)"
    )
    parser.add_argument(
        "--api-host",
        default="127.0.0.1",
        help="API host (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--api-port",
        type=int,
        default=8000,
        help="API port (default: 8000)"
    )
    parser.add_argument(
        "--web-host",
        default="127.0.0.1",
        help="Frontend web host (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--web-port",
        type=int,
        default=3000,
        help="Frontend web port (default: 3000)"
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=4.0,
        help="Probe timeout in seconds (default: 4.0)"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Output structured JSON results."
    )
    parser.set_defaults(func=run_health_cmd)


def probe_tcp_socket(host: str, port: int, timeout: float) -> Dict[str, Any]:
    t0 = time.perf_counter()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((host, port))
        sock.close()
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "status": "PASS",
            "host": host,
            "port": port,
            "latency_ms": elapsed_ms,
            "message": f"Listening and accepting connections ({elapsed_ms}ms)"
        }
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "status": "FAIL",
            "host": host,
            "port": port,
            "latency_ms": elapsed_ms,
            "error": str(exc),
            "message": f"Connection failed after {elapsed_ms}ms: {exc}"
        }


def probe_http_endpoint(url: str, timeout: float) -> Dict[str, Any]:
    t0 = time.perf_counter()
    req = urllib.request.Request(url, headers={"User-Agent": "SMRITI-CLI-Probe/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
            code = resp.getcode()
            body = resp.read().decode("utf-8", errors="ignore")
            data = None
            try:
                data = json.loads(body)
            except Exception:
                pass
            return {
                "status": "PASS",
                "url": url,
                "http_status": code,
                "latency_ms": elapsed_ms,
                "payload": data,
                "message": f"HTTP {code} ({elapsed_ms}ms)"
            }
    except urllib.error.HTTPError as err:
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        # Even if HTTP error (like 404 or 401), the server is alive and responding
        return {
            "status": "PASS" if err.code < 500 else "FAIL",
            "url": url,
            "http_status": err.code,
            "latency_ms": elapsed_ms,
            "message": f"HTTP {err.code} ({elapsed_ms}ms)"
        }
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "status": "FAIL",
            "url": url,
            "latency_ms": elapsed_ms,
            "error": str(exc),
            "message": f"Probe failed after {elapsed_ms}ms: {exc}"
        }


def format_health_text(res: Dict[str, Any]) -> None:
    print("=====================================================================")
    print(" SMRITI Retail OS — Service Health Audit")
    print("=====================================================================")
    print(f" Overall Status : {res['overall_status']}")
    print("---------------------------------------------------------------------")
    db = res["checks"]["database"]
    print(f" [1/3] PostgreSQL ({db['host']}:{db['port']}):")
    print(f"       [{db['status']}] {db['message']}")

    api = res["checks"]["api"]
    print(f" [2/3] API Server ({api['url']}):")
    print(f"       [{api['status']}] {api['message']}")

    web = res["checks"]["web"]
    print(f" [3/3] Web Frontend ({web['url']}):")
    print(f"       [{web['status']}] {web['message']}")
    print("=====================================================================")


def run_health_cmd(args: argparse.Namespace) -> int:
    db_res = probe_tcp_socket(args.db_host, args.db_port, args.timeout)
    api_res = probe_http_endpoint(f"http://{args.api_host}:{args.api_port}/health", args.timeout)
    if api_res["status"] == "FAIL":
        # Try root docs endpoint as fallback
        docs_res = probe_http_endpoint(f"http://{args.api_host}:{args.api_port}/docs", args.timeout)
        if docs_res["status"] == "PASS":
            api_res = docs_res

    web_res = probe_http_endpoint(f"http://{args.web_host}:{args.web_port}/", args.timeout)

    # Database is critical; API is critical; Web is optional
    overall_pass = (db_res["status"] == "PASS")
    
    result = {
        "overall_status": "HEALTHY" if (overall_pass and api_res["status"] == "PASS") else "DEGRADED" if overall_pass else "DOWN",
        "checks": {
            "database": db_res,
            "api": api_res,
            "web": web_res,
        }
    }

    output_result(result, as_json=args.as_json, text_formatter=format_health_text)
    return 0 if overall_pass else 1
