"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.47.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseIdentifierStrategy(ABC):
    """
    Abstract Strategy interface for identifier standards.
    """
    @abstractmethod
    def generate_barcode(self, sequence_num: int) -> str:
        pass

    @abstractmethod
    def generate_digital_link_uri(self, barcode_value: str, serial: str) -> str:
        pass

    @abstractmethod
    def generate_sgtin96_hex(self, barcode_value: str, serial: str) -> str:
        pass


class GS1Strategy(BaseIdentifierStrategy):
    """
    GS1 Standard EAN-13 Mod-10 strategy with Digital Link URI & SGTIN-96 RFID bitstring.
    """
    @staticmethod
    def calculate_mod10_check_digit(payload_12: str) -> str:
        sum_odd = sum(int(payload_12[i]) for i in range(0, 12, 2))
        sum_even = sum(int(payload_12[i]) for i in range(1, 12, 2))
        total = sum_odd + (sum_even * 3)
        remainder = total % 10
        return str((10 - remainder) % 10)

    def generate_barcode(self, sequence_num: int) -> str:
        seq_5 = f"{(sequence_num % 100000):05d}"
        payload_12 = f"8901000{seq_5}"
        check = self.calculate_mod10_check_digit(payload_12)
        return f"{payload_12}{check}"

    def generate_digital_link_uri(self, barcode_value: str, serial: str) -> str:
        return f"https://id.smritibooks.com/01/{barcode_value}/21/{serial}"

    def generate_sgtin96_hex(self, barcode_value: str, serial: str) -> str:
        # Header 0x30 (8 bit) + Filter 0x1 (3 bit) + Partition 0x5 (3 bit) + Company (24 bit) + Item (20 bit) + Serial (38 bit)
        h_part = f"3015{barcode_value[-8:]}"
        s_part = hashlib_hex(serial)[:8].upper()
        return f"{h_part}{s_part}".ljust(24, "0")[:24]


class GTINStrategy(GS1Strategy):
    pass


class EANStrategy(GS1Strategy):
    pass


class UPCStrategy(BaseIdentifierStrategy):
    def generate_barcode(self, sequence_num: int) -> str:
        return f"012345{(sequence_num % 100000):05d}6"

    def generate_digital_link_uri(self, barcode_value: str, serial: str) -> str:
        return f"https://id.smritibooks.com/01/00{barcode_value}/21/{serial}"

    def generate_sgtin96_hex(self, barcode_value: str, serial: str) -> str:
        return f"3025{barcode_value}".ljust(24, "0")[:24]


class ISBNStrategy(BaseIdentifierStrategy):
    def generate_barcode(self, sequence_num: int) -> str:
        return f"9788190{(sequence_num % 100000):05d}4"

    def generate_digital_link_uri(self, barcode_value: str, serial: str) -> str:
        return f"https://id.smritibooks.com/01/{barcode_value}/21/{serial}"

    def generate_sgtin96_hex(self, barcode_value: str, serial: str) -> str:
        return f"3035{barcode_value}".ljust(24, "0")[:24]


class UDIStrategy(BaseIdentifierStrategy):
    def generate_barcode(self, sequence_num: int) -> str:
        return f"+M123{(sequence_num % 100000):05d}1"

    def generate_digital_link_uri(self, barcode_value: str, serial: str) -> str:
        return f"https://id.smritibooks.com/udi/{barcode_value}/{serial}"

    def generate_sgtin96_hex(self, barcode_value: str, serial: str) -> str:
        return f"3045{barcode_value[:10]}".ljust(24, "0")[:24]


class InternalStrategy(BaseIdentifierStrategy):
    def generate_barcode(self, sequence_num: int) -> str:
        return f"INT-{(sequence_num % 1000000):06d}"

    def generate_digital_link_uri(self, barcode_value: str, serial: str) -> str:
        return f"https://id.smritibooks.com/internal/{barcode_value}/{serial}"

    def generate_sgtin96_hex(self, barcode_value: str, serial: str) -> str:
        return f"3055{sequence_num:08d}".ljust(24, "0")[:24]


class CustomStrategy(InternalStrategy):
    pass


def hashlib_hex(val: str) -> str:
    import hashlib
    return hashlib.sha256(val.encode("utf-8")).hexdigest()


class IdentifierStrategyFactory:
    """
    Factory returning concrete Identifier Strategy instance.
    """
    _strategies: Dict[str, BaseIdentifierStrategy] = {
        "GS1": GS1Strategy(),
        "GTIN": GTINStrategy(),
        "EAN": EANStrategy(),
        "UPC": UPCStrategy(),
        "ISBN": ISBNStrategy(),
        "UDI": UDIStrategy(),
        "INTERNAL": InternalStrategy(),
        "CUSTOM": CustomStrategy(),
    }

    @classmethod
    def get_strategy(cls, standard: str) -> BaseIdentifierStrategy:
        std = standard.upper()
        if std not in cls._strategies:
            return cls._strategies["GS1"]
        return cls._strategies[std]
