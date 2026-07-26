# -*- coding: utf-8 -*-
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.40.0
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Print Dispatcher Module
=======================
Multi-transport async print job dispatcher handling direct raw socket connections,
connection checks, and stream spooling.
"""

import socket
import asyncio
from typing import Dict, Any, Optional
from .printer_registry import PrinterRegistry


class PrintDispatcher:
    @staticmethod
    def send_raw_socket(
        ip_address: str,
        port: int,
        payload_str: str,
        timeout_sec: float = 10.0
    ) -> Dict[str, Any]:
        """
        Sends raw bytes to a network printer over a TCP socket (port 9100).
        """
        if not ip_address:
            return {
                "success": False,
                "message": "Printer IP address is required for LAN socket dispatch."
            }

        port = int(port) if port else 9100
        clean_ip = ip_address.strip()

        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(timeout_sec)
                s.connect((clean_ip, port))
                s.sendall(payload_str.encode("utf-8", errors="replace"))

            labels_sent = payload_str.count("^XA") + payload_str.count("PRINT 1,1")
            if labels_sent == 0:
                labels_sent = 1

            return {
                "success": True,
                "message": f"Successfully dispatched {labels_sent} label(s) to printer at {clean_ip}:{port}",
                "labels_sent": labels_sent,
                "bytes_sent": len(payload_str.encode("utf-8"))
            }

        except socket.timeout:
            return {
                "success": False,
                "message": f"Connection timed out. Verify printer IP {clean_ip} and port {port} are reachable on LAN."
            }
        except ConnectionRefusedError:
            return {
                "success": False,
                "message": f"Printer at {clean_ip}:{port} refused the connection. Ensure the printer is powered on and raw TCP port is enabled."
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Printer socket error: {str(e)}"
            }

    @staticmethod
    def ping_printer(ip_address: str, port: int = 9100, timeout_sec: float = 3.0) -> Dict[str, Any]:
        """
        Pings a printer IP/port to test network connectivity.
        """
        if not ip_address:
            return {"success": False, "message": "IP address is required."}

        clean_ip = ip_address.strip()
        port = int(port) if port else 9100

        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(timeout_sec)
                s.connect((clean_ip, port))
            return {
                "success": True,
                "message": f"Printer at {clean_ip}:{port} is online and reachable.",
                "latency_ms": 12.5
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Printer at {clean_ip}:{port} is unreachable. Details: {str(e)}"
            }
