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

Print Queue Manager
===================
In-memory and persistent job queue manager supporting job state tracking,
retries, and telemetry audit trails.
"""

import time
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from .print_dispatcher import PrintDispatcher
from .printer_registry import PrinterRegistry


class PrintQueueManager:
    _jobs: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def enqueue_job(
        cls,
        module_name: str,
        printer_id: str,
        payload_str: str,
        copies: int = 1,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Enqueues a new print job and attempts immediate background dispatch.
        """
        job_id = f"pjob-{int(time.time())}-{str(uuid.uuid4())[:6]}"
        printer = PrinterRegistry.get_printer(printer_id) or PrinterRegistry.get_default_printer()

        job = {
            "job_id": job_id,
            "module_name": module_name,
            "printer_id": printer_id,
            "printer_name": printer.get("name") if printer else "Default Printer",
            "printer_ip": printer.get("address") if printer else "192.168.1.45",
            "printer_port": printer.get("port", 9100) if printer else 9100,
            "status": "QUEUED",
            "copies": copies,
            "payload_length": len(payload_str),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id or "system",
            "error_message": None
        }

        cls._jobs[job_id] = job

        # Execute dispatch
        if printer and printer.get("connection_type") == "TCP/IP":
            dispatch_res = PrintDispatcher.send_raw_socket(
                ip_address=job["printer_ip"],
                port=job["printer_port"],
                payload_str=payload_str
            )

            if dispatch_res.get("success"):
                job["status"] = "COMPLETED"
                job["completed_at"] = datetime.now(timezone.utc).isoformat()
            else:
                job["status"] = "FAILED"
                job["error_message"] = dispatch_res.get("message")
        else:
            # Browser / QZ Tray local dispatch path
            job["status"] = "DISPATCHED_TO_CLIENT"

        return job

    @classmethod
    def get_job(cls, job_id: str) -> Optional[Dict[str, Any]]:
        return cls._jobs.get(job_id)

    @classmethod
    def list_jobs(cls, limit: int = 50) -> List[Dict[str, Any]]:
        all_jobs = list(cls._jobs.values())
        all_jobs.sort(key=lambda j: j["created_at"], reverse=True)
        return all_jobs[:limit]
