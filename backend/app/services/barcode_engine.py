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

Barcode Engine Enterprise Service Orchestrator
==============================================
High-level backend service managing barcode label generation, PRN compilation,
network socket dispatching, token resolution reference, and printer diagnostics.
"""

from typing import List, Dict, Any, Optional
from ..core.barcode.token_registry import build_token_dict, get_registry_for_api, resolve_style_code
from ..core.barcode.prn_generator import generate_prn_script, safe_template_substitute
from .print_framework.printer_registry import PrinterRegistry
from .print_framework.print_dispatcher import PrintDispatcher
from .print_framework.print_queue import PrintQueueManager


class BarcodeEngineService:
    @staticmethod
    def generate_prn(
        items: List[Dict[str, Any]],
        raw_template: Optional[str] = None,
        protocol: str = "ZPL",
        label_size: str = "50x25",
        company_name: str = "SMRITI RETAIL"
    ) -> Dict[str, Any]:
        """
        Generates PRN script (ZPL/TSPL) for item records.
        """
        return generate_prn_script(
            items=items,
            raw_template=raw_template,
            protocol=protocol,
            label_size=label_size,
            company_name=company_name
        )

    @staticmethod
    def dispatch_to_network_printer(
        items: List[Dict[str, Any]],
        printer_ip: str,
        printer_port: int = 9100,
        raw_template: Optional[str] = None,
        protocol: str = "ZPL",
        label_size: str = "50x25",
        company_name: str = "SMRITI RETAIL"
    ) -> Dict[str, Any]:
        """
        Generates PRN and streams it directly to a network printer over a TCP socket.
        """
        prn_res = generate_prn_script(
            items=items,
            raw_template=raw_template,
            protocol=protocol,
            label_size=label_size,
            company_name=company_name
        )

        payload = prn_res.get("prn", "")
        if not payload:
            return {
                "success": False,
                "message": "No PRN data generated. Verify items payload.",
                "labels_sent": 0
            }

        dispatch_res = PrintDispatcher.send_raw_socket(
            ip_address=printer_ip,
            port=printer_port,
            payload_str=payload
        )

        dispatch_res["total_labels"] = prn_res.get("total_labels", 0)
        return dispatch_res

    @staticmethod
    def test_printer_connection(printer_ip: str, printer_port: int = 9100) -> Dict[str, Any]:
        """
        Tests connectivity to a target printer IP/port.
        """
        return PrintDispatcher.ping_printer(ip_address=printer_ip, port=printer_port)

    @staticmethod
    def get_token_reference() -> List[Dict[str, Any]]:
        """
        Returns the token registry metadata reference for field mapping and API documentation.
        """
        return get_registry_for_api()

    @staticmethod
    def list_printers() -> List[Dict[str, Any]]:
        """
        Returns all registered printer profiles.
        """
        return PrinterRegistry.list_printers()
