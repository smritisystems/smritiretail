"""
Project      : SMRITI Retail OS v7.0
Module       : Unit Tests — PrinterRegistry (print_framework/printer_registry.py)
Description  : Pure unit tests for PrinterRegistry class methods.
               No DB, no network, no file I/O required. Registry state is
               reset between tests using setup_method.
Author       : Jawahar Ramkripal Mallah
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from app.services.print_framework.printer_registry import PrinterRegistry


class TestPrinterRegistry:

    def setup_method(self):
        """Reset the PrinterRegistry class-level state before each test."""
        PrinterRegistry._registry = {}
        PrinterRegistry._default_printer_id = None

    # -----------------------------------------------------------------------
    # Registration
    # -----------------------------------------------------------------------

    def test_register_printer_returns_complete_profile(self):
        """register_printer() must return a profile dict with all required keys."""
        profile = PrinterRegistry.register_printer(
            printer_id="prn-test-001",
            name="Test Zebra ZD421",
            connection_type="TCP/IP",
            address="192.168.1.45",
            port=9100,
            protocol="ZPL",
            capabilities=["ZPL", "RAW_SOCKET"],
            is_default=True,
        )
        assert profile["printer_id"] == "prn-test-001"
        assert profile["name"] == "Test Zebra ZD421"
        assert profile["connection_type"] == "TCP/IP"
        assert profile["address"] == "192.168.1.45"
        assert profile["port"] == 9100
        assert profile["protocol"] == "ZPL"
        assert "ZPL" in profile["capabilities"]
        assert profile["is_default"] is True
        assert profile["status"] == "ONLINE"

    def test_register_printer_persists_in_registry(self):
        """Registered printer must be retrievable via get_printer()."""
        PrinterRegistry.register_printer("prn-001", "Printer A")
        retrieved = PrinterRegistry.get_printer("prn-001")
        assert retrieved is not None
        assert retrieved["printer_id"] == "prn-001"

    def test_register_multiple_printers_all_present(self):
        """All registered printers must appear in list_printers()."""
        PrinterRegistry.register_printer("prn-001", "Printer A")
        PrinterRegistry.register_printer("prn-002", "Printer B")
        PrinterRegistry.register_printer("prn-003", "Printer C")

        ids = PrinterRegistry.get_registered_ids()
        assert "prn-001" in ids
        assert "prn-002" in ids
        assert "prn-003" in ids
        assert len(PrinterRegistry.list_printers()) == 3

    def test_register_same_id_updates_existing_entry(self):
        """Registering the same printer_id again must update, not duplicate, the entry."""
        PrinterRegistry.register_printer("prn-001", "Old Name", protocol="ZPL")
        PrinterRegistry.register_printer("prn-001", "Updated Name", protocol="DPL")

        assert len(PrinterRegistry._registry) == 1
        assert PrinterRegistry._registry["prn-001"]["name"] == "Updated Name"
        assert PrinterRegistry._registry["prn-001"]["protocol"] == "DPL"

    # -----------------------------------------------------------------------
    # Default Printer Resolution
    # -----------------------------------------------------------------------

    def test_first_registered_printer_becomes_default(self):
        """When no is_default is set, the first registered printer becomes default."""
        PrinterRegistry.register_printer("prn-001", "First Printer", is_default=False)
        default = PrinterRegistry.get_default_printer()
        assert default is not None
        assert default["printer_id"] == "prn-001"

    def test_is_default_true_sets_default_printer(self):
        """Registering with is_default=True must override the current default."""
        PrinterRegistry.register_printer("prn-001", "Printer A", is_default=False)
        PrinterRegistry.register_printer("prn-002", "Printer B", is_default=True)

        default = PrinterRegistry.get_default_printer()
        assert default["printer_id"] == "prn-002"

    def test_get_default_printer_returns_none_when_registry_empty(self):
        """get_default_printer() must return None when no printer is registered."""
        result = PrinterRegistry.get_default_printer()
        assert result is None

    # -----------------------------------------------------------------------
    # Lookup
    # -----------------------------------------------------------------------

    def test_get_printer_returns_none_for_unregistered_id(self):
        """get_printer() must return None for an unknown printer_id."""
        result = PrinterRegistry.get_printer("nonexistent-prn")
        assert result is None

    def test_get_registered_ids_returns_empty_list_when_no_printers(self):
        """get_registered_ids() must return an empty list on fresh registry."""
        assert PrinterRegistry.get_registered_ids() == []

    def test_list_printers_returns_empty_list_when_no_printers(self):
        """list_printers() must return an empty list on fresh registry."""
        assert PrinterRegistry.list_printers() == []

    # -----------------------------------------------------------------------
    # Default Capabilities
    # -----------------------------------------------------------------------

    def test_default_capabilities_applied_when_none_passed(self):
        """When capabilities=None, registry must assign the default ZPL/RAW_SOCKET/TSPL set."""
        PrinterRegistry.register_printer("prn-001", "Default Caps Printer")
        profile = PrinterRegistry.get_printer("prn-001")
        assert "ZPL" in profile["capabilities"]
        assert "RAW_SOCKET" in profile["capabilities"]
        assert "TSPL" in profile["capabilities"]

    def test_custom_capabilities_are_stored_as_provided(self):
        """Explicitly passed capabilities list must be stored as-is."""
        caps = ["DPL", "RAW_SOCKET"]
        PrinterRegistry.register_printer("prn-001", "DPL Printer", capabilities=caps)
        profile = PrinterRegistry.get_printer("prn-001")
        assert profile["capabilities"] == caps

    # -----------------------------------------------------------------------
    # Status
    # -----------------------------------------------------------------------

    def test_newly_registered_printer_status_is_online(self):
        """Every newly registered printer must have status='ONLINE'."""
        PrinterRegistry.register_printer("prn-001", "New Printer")
        profile = PrinterRegistry.get_printer("prn-001")
        assert profile["status"] == "ONLINE"
