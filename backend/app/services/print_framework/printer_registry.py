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

Printer Registry Module
========================
Central in-memory and database registry of available hardware printers, capabilities,
and connection protocols (TCP/IP Socket, QZ Tray, WebSerial, USB).
"""

from typing import Dict, Any, List, Optional


class PrinterRegistry:
    _registry: Dict[str, Dict[str, Any]] = {}
    _default_printer_id: Optional[str] = None

    @classmethod
    def register_printer(
        cls,
        printer_id: str,
        name: str,
        connection_type: str = "TCP/IP",
        address: str = "192.168.1.45",
        port: int = 9100,
        protocol: str = "ZPL",
        capabilities: Optional[List[str]] = None,
        is_default: bool = False
    ) -> Dict[str, Any]:
        """
        Registers or updates a printer entry in the registry.
        """
        profile = {
            "printer_id": printer_id,
            "name": name,
            "connection_type": connection_type,
            "address": address,
            "port": port,
            "protocol": protocol,
            "capabilities": capabilities or ["ZPL", "RAW_SOCKET", "TSPL"],
            "is_default": is_default,
            "status": "ONLINE"
        }
        cls._registry[printer_id] = profile

        if is_default or not cls._default_printer_id:
            cls._default_printer_id = printer_id

        return profile

    @classmethod
    def get_printer(cls, printer_id: str) -> Optional[Dict[str, Any]]:
        return cls._registry.get(printer_id)

    @classmethod
    def get_default_printer(cls) -> Optional[Dict[str, Any]]:
        if cls._default_printer_id and cls._default_printer_id in cls._registry:
            return cls._registry[cls._default_printer_id]
        if cls._registry:
            return next(iter(cls._registry.values()))
        return None

    @classmethod
    def list_printers(cls) -> List[Dict[str, Any]]:
        return list(cls._registry.values())

    @classmethod
    def get_registered_ids(cls) -> List[str]:
        return list(cls._registry.keys())


# Pre-seed default LAN barcode printers
PrinterRegistry.register_printer(
    printer_id="prn-zebra-zd421-tcp",
    name="Zebra ZD421 Warehouse (TCP/IP)",
    connection_type="TCP/IP",
    address="192.168.1.45",
    port=9100,
    protocol="ZPL",
    capabilities=["ZPL", "RAW_SOCKET", "EPL"],
    is_default=True
)

PrinterRegistry.register_printer(
    printer_id="prn-tsc-te244-tcp",
    name="TSC TE244 Store Front (TCP/IP)",
    connection_type="TCP/IP",
    address="192.168.1.46",
    port=9100,
    protocol="TSPL",
    capabilities=["TSPL", "RAW_SOCKET"],
    is_default=False
)
