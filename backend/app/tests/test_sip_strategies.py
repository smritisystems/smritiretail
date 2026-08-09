"""
Project      : SMRITI Retail OS v7.0
Module       : Unit Tests — SIP Identifier Strategy Factory (sip/strategies.py)
Description  : Pure unit tests for GS1Strategy, UPCStrategy, ISBNStrategy,
               UDIStrategy, InternalStrategy, and IdentifierStrategyFactory.
               No DB, no network, no file I/O required.
Author       : Jawahar Ramkripal Mallah
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from app.services.sip.strategies import (
    GS1Strategy,
    UPCStrategy,
    ISBNStrategy,
    UDIStrategy,
    InternalStrategy,
    GTINStrategy,
    EANStrategy,
    CustomStrategy,
    IdentifierStrategyFactory,
    hashlib_hex,
)


class TestGS1StrategyCheckDigit:

    def test_mod10_check_digit_known_value(self):
        """EAN-13 Mod-10 check digit for GS1 payload '690123456789' must be correct."""
        strategy = GS1Strategy()
        # Known EAN-13: 6901234567892 → check digit is 2
        result = strategy.calculate_mod10_check_digit("690123456789")
        assert result == "2"

    def test_mod10_returns_zero_for_balanced_payload(self):
        """Mod-10 result of 0 is returned as '0', not '10'."""
        strategy = GS1Strategy()
        # Payload where sum mod 10 == 0 → check digit must be '0'
        result = strategy.calculate_mod10_check_digit("000000000000")
        assert result == "0"

    def test_check_digit_is_single_character_string(self):
        """Result must always be a single character string '0'–'9'."""
        strategy = GS1Strategy()
        for seq in range(0, 100):
            result = strategy.calculate_mod10_check_digit(f"200{seq:09d}")
            assert isinstance(result, str)
            assert len(result) == 1
            assert result.isdigit()


class TestGS1StrategyBarcodeGeneration:

    def test_barcode_is_13_digits(self):
        """Generated GS1 barcode must always be 13 digits."""
        strategy = GS1Strategy()
        for seq in [1, 100, 999999]:
            barcode = strategy.generate_barcode(seq)
            assert len(barcode) == 13
            assert barcode.isdigit()

    def test_barcode_with_custom_gs1_prefix(self):
        """With a 7-digit GS1 company prefix, barcode must start with that prefix."""
        strategy = GS1Strategy()
        barcode = strategy.generate_barcode(1, gs1_company_prefix="8901234")
        assert barcode.startswith("8901234")
        assert len(barcode) == 13

    def test_barcode_without_prefix_starts_with_200(self):
        """Without a GS1 prefix, barcode uses internal prefix '200...'."""
        strategy = GS1Strategy()
        barcode = strategy.generate_barcode(1)
        assert barcode.startswith("200")

    def test_barcode_sequence_produces_unique_codes(self):
        """Different sequence numbers must produce different barcodes."""
        strategy = GS1Strategy()
        barcodes = {strategy.generate_barcode(i) for i in range(1, 50)}
        assert len(barcodes) == 49


class TestGS1StrategyDigitalLink:

    def test_digital_link_uri_format(self):
        """Digital Link URI must follow SMRITI GS1 Digital Link pattern."""
        strategy = GS1Strategy()
        uri = strategy.generate_digital_link_uri("8901234567892", "SRL-001")
        assert uri.startswith("https://id.smritibooks.com/01/")
        assert "8901234567892" in uri
        assert "SRL-001" in uri


class TestUPCStrategy:

    def test_upc_barcode_is_12_characters(self):
        """UPC barcode must be a 12-character string."""
        strategy = UPCStrategy()
        barcode = strategy.generate_barcode(1)
        assert len(barcode) == 12

    def test_upc_digital_link_contains_double_zero_prefix(self):
        """UPC Digital Link uses '00' prefix before the barcode value."""
        strategy = UPCStrategy()
        uri = strategy.generate_digital_link_uri("012345000016", "SRL-UPC")
        assert "/01/00" in uri

    def test_upc_sgtin_is_24_chars(self):
        """SGTIN-96 hex string must be exactly 24 characters."""
        strategy = UPCStrategy()
        sgtin = strategy.generate_sgtin96_hex("012345000016", "SRL-UPC")
        assert len(sgtin) == 24


class TestISBNStrategy:

    def test_isbn_barcode_starts_with_978(self):
        """ISBN barcode must start with '978' (Bookland prefix)."""
        strategy = ISBNStrategy()
        barcode = strategy.generate_barcode(1)
        assert barcode.startswith("978")

    def test_isbn_barcode_length(self):
        """ISBN barcode must be 13 characters."""
        strategy = ISBNStrategy()
        barcode = strategy.generate_barcode(42)
        assert len(barcode) == 13


class TestUDIStrategy:

    def test_udi_barcode_starts_with_plus_m(self):
        """UDI barcode must start with '+M' (FDA UDI AI prefix)."""
        strategy = UDIStrategy()
        barcode = strategy.generate_barcode(1)
        assert barcode.startswith("+M")


class TestInternalStrategy:

    def test_internal_barcode_starts_with_INT(self):
        """Internal barcode must start with 'INT-'."""
        strategy = InternalStrategy()
        barcode = strategy.generate_barcode(1)
        assert barcode.startswith("INT-")

    def test_internal_barcode_is_10_chars(self):
        """Internal barcode must be 'INT-XXXXXX' = 10 characters."""
        strategy = InternalStrategy()
        barcode = strategy.generate_barcode(123)
        assert len(barcode) == 10


class TestIdentifierStrategyFactory:

    def test_factory_returns_gs1_strategy_by_default(self):
        """Unknown standard must fall back to GS1Strategy."""
        strategy = IdentifierStrategyFactory.get_strategy("UNKNOWN_XYZ")
        assert isinstance(strategy, GS1Strategy)

    def test_factory_returns_correct_strategy_for_each_standard(self):
        """Factory must return the correct concrete class for each registered standard."""
        cases = [
            ("GS1", GS1Strategy),
            ("GTIN", GTINStrategy),
            ("EAN", EANStrategy),
            ("UPC", UPCStrategy),
            ("ISBN", ISBNStrategy),
            ("UDI", UDIStrategy),
            ("INTERNAL", InternalStrategy),
            ("CUSTOM", CustomStrategy),
        ]
        for standard, expected_type in cases:
            strategy = IdentifierStrategyFactory.get_strategy(standard)
            assert isinstance(strategy, expected_type), f"Expected {expected_type.__name__} for '{standard}'"

    def test_factory_is_case_insensitive(self):
        """Factory must accept lowercase and mixed-case standard names."""
        assert isinstance(IdentifierStrategyFactory.get_strategy("gs1"), GS1Strategy)
        assert isinstance(IdentifierStrategyFactory.get_strategy("Upc"), UPCStrategy)
        assert isinstance(IdentifierStrategyFactory.get_strategy("isbn"), ISBNStrategy)


class TestHashlibHex:

    def test_hashlib_hex_produces_64_char_hex_string(self):
        """hashlib_hex must produce a 64-character lowercase SHA-256 hex string."""
        result = hashlib_hex("SRL-001")
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_hashlib_hex_is_deterministic(self):
        """Same input must always produce the same SHA-256 digest."""
        assert hashlib_hex("test") == hashlib_hex("test")

    def test_hashlib_hex_different_inputs_produce_different_digests(self):
        """Different inputs must produce different SHA-256 digests."""
        assert hashlib_hex("SRL-001") != hashlib_hex("SRL-002")
