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

import hashlib
from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseIdentityProvider(ABC):
    """
    Abstract plugin interface for domain identity resolution providers.
    """
    @property
    @abstractmethod
    def domain(self) -> str:
        pass

    @abstractmethod
    def generate_business_key(self, payload: Dict[str, Any], sequence_num: int) -> str:
        pass

    def calculate_identity_hash(self, payload: Dict[str, Any]) -> str:
        raw = "|".join(str(v).strip().lower() for v in payload.values() if v is not None)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ProductProvider(BaseIdentityProvider):
    domain = "PRODUCT"
    def generate_business_key(self, payload: Dict[str, Any], sequence_num: int) -> str:
        cat = (payload.get("category") or "GEN")[:3].upper()
        br = (payload.get("brand") or "GEN")[:3].upper()
        return f"SKU-{cat}-{br}-{sequence_num:05d}"


class CustomerProvider(BaseIdentityProvider):
    domain = "CUSTOMER"
    def generate_business_key(self, payload: Dict[str, Any], sequence_num: int) -> str:
        phone = (payload.get("phone") or "000")[-4:]
        return f"CUST-PH{phone}-{sequence_num:05d}"


class SupplierProvider(BaseIdentityProvider):
    domain = "SUPPLIER"
    def generate_business_key(self, payload: Dict[str, Any], sequence_num: int) -> str:
        state = (payload.get("state_code") or "IN")[:2].upper()
        return f"SUPP-{state}-{sequence_num:05d}"


class WarehouseProvider(BaseIdentityProvider):
    domain = "WAREHOUSE"
    def generate_business_key(self, payload: Dict[str, Any], sequence_num: int) -> str:
        code = (payload.get("branch_code") or "WH")[:4].upper()
        return f"WH-{code}-{sequence_num:04d}"


class AssetProvider(BaseIdentityProvider):
    domain = "ASSET"
    def generate_business_key(self, payload: Dict[str, Any], sequence_num: int) -> str:
        type_code = (payload.get("asset_type") or "AST")[:3].upper()
        return f"AST-{type_code}-{sequence_num:05d}"


class EmployeeProvider(BaseIdentityProvider):
    domain = "EMPLOYEE"
    def generate_business_key(self, payload: Dict[str, Any], sequence_num: int) -> str:
        dept = (payload.get("department") or "EMP")[:3].upper()
        return f"EMP-{dept}-{sequence_num:04d}"


class VoucherProvider(BaseIdentityProvider):
    domain = "VOUCHER"
    def generate_business_key(self, payload: Dict[str, Any], sequence_num: int) -> str:
        vtype = (payload.get("voucher_type") or "GIFT")[:4].upper()
        return f"VOUCH-{vtype}-{sequence_num:06d}"


class BatchProvider(BaseIdentityProvider):
    domain = "BATCH"
    def generate_business_key(self, payload: Dict[str, Any], sequence_num: int) -> str:
        mfg = (payload.get("mfg_date") or "2026")[:4]
        return f"LOT-{mfg}-{sequence_num:05d}"


class SerialProvider(BaseIdentityProvider):
    domain = "SERIAL_NUMBER"
    def generate_business_key(self, payload: Dict[str, Any], sequence_num: int) -> str:
        prefix = (payload.get("prefix") or "SER")[:3].upper()
        return f"SN-{prefix}-{sequence_num:07d}"


class SIPProviderRegistry:
    """
    Central registry mapping domain strings to concrete Provider plugin instances.
    """
    _providers: Dict[str, BaseIdentityProvider] = {
        "PRODUCT": ProductProvider(),
        "CUSTOMER": CustomerProvider(),
        "SUPPLIER": SupplierProvider(),
        "WAREHOUSE": WarehouseProvider(),
        "ASSET": AssetProvider(),
        "EMPLOYEE": EmployeeProvider(),
        "VOUCHER": VoucherProvider(),
        "BATCH": BatchProvider(),
        "SERIAL_NUMBER": SerialProvider(),
    }

    @classmethod
    def get_provider(cls, domain: str) -> BaseIdentityProvider:
        dom = domain.upper()
        if dom not in cls._providers:
            raise ValueError(f"Unsupported SIP domain '{domain}'. Registered: {list(cls._providers.keys())}")
        return cls._providers[dom]
