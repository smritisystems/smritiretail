"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.41.0
Created      : 2026-09-14
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import date, datetime
from typing import Any, Optional
from sqlalchemy import Boolean, Column, Date, Integer, Numeric, String, Text, Index
from ..db.base import BaseEntity


class SystemParameter(BaseEntity):
    """
    SMRITI System Parameter Model.
    
    Provides 100% architectural parity with legacy Tally Shoper 9 POS and
    Distributor system parameters, governed by a 5-tier mutability engine
    (Fixed, Installation, One Time, Variable, Hidden) and multi-level scoping
    (GLOBAL, COMPANY, BRANCH, TERMINAL).
    """
    __tablename__ = "system_parameters"

    param_code = Column(String(100), nullable=False, index=True)
    canonical_code = Column(String(150), nullable=True, index=True)  # SMRITI.DOMAIN.FEATURE dot-notation; None for pre-backfilled rows
    category = Column(String(50), nullable=False, index=True)
    category_name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=False)
    data_type = Column(String(10), nullable=False)  # 'Boolean', 'Integer', 'Text', 'Decimal', 'Date'
    mutability = Column(String(20), nullable=False, default="Variable")  # 'Fixed', 'Installation', 'One Time', 'Variable', 'Hidden'
    profile_type = Column(String(20), nullable=False, default="COMMON")  # 'RETAIL', 'DISTRIBUTOR', 'COMMON'
    
    # Typed values
    val_boolean = Column(Boolean, nullable=True)
    val_integer = Column(Integer, nullable=True)
    val_text = Column(Text, nullable=True)
    val_decimal = Column(Numeric(14, 4), nullable=True)
    val_date = Column(Date, nullable=True)
    
    # Scoping & Locking
    scope_level = Column(String(20), nullable=False, default="COMPANY")  # 'GLOBAL', 'COMPANY', 'BRANCH', 'TERMINAL'
    terminal_id = Column(String(50), nullable=False, default="COMMON")
    is_locked = Column(Boolean, nullable=False, default=False)

    __table_args__ = (
        Index("idx_sys_param_comp_code_term", "company_id", "param_code", "terminal_id"),
        Index("idx_sys_param_cat", "category"),
        Index("idx_sys_param_code", "param_code"),
        Index("idx_sys_param_canonical_code", "canonical_code"),
    )

    @property
    def effective_value(self) -> Any:
        dt = (self.data_type or "").capitalize()
        if dt == "Boolean":
            return bool(self.val_boolean) if self.val_boolean is not None else False
        elif dt == "Integer":
            return int(self.val_integer) if self.val_integer is not None else 0
        elif dt == "Decimal":
            return float(self.val_decimal) if self.val_decimal is not None else 0.0
        elif dt == "Date":
            return self.val_date.isoformat() if self.val_date else None
        else:
            return self.val_text or ""

    def get_value(self) -> Any:
        """Alias for effective_value — used by POProductPolicyEngine._load_policy_snapshot."""
        return self.effective_value

    def set_value(self, val: Any) -> None:
        dt = (self.data_type or "").capitalize()
        if dt == "Boolean":
            if isinstance(val, bool):
                self.val_boolean = val
            elif isinstance(val, (int, float)):
                self.val_boolean = bool(val)
            elif isinstance(val, str):
                self.val_boolean = val.strip().lower() in ("true", "1", "yes", "t")
            else:
                self.val_boolean = False
            self.val_text = "1" if self.val_boolean else "0"
        elif dt == "Integer":
            try:
                self.val_integer = int(val) if val is not None else 0
            except (ValueError, TypeError):
                self.val_integer = 0
            self.val_text = str(self.val_integer)
        elif dt == "Decimal":
            try:
                self.val_decimal = float(val) if val is not None else 0.0
            except (ValueError, TypeError):
                self.val_decimal = 0.0
            self.val_text = str(self.val_decimal)
        elif dt == "Date":
            if isinstance(val, date):
                self.val_date = val
                self.val_text = val.isoformat()
            elif isinstance(val, str) and val:
                try:
                    self.val_date = datetime.strptime(val[:10], "%Y-%m-%d").date()
                    self.val_text = self.val_date.isoformat()
                except ValueError:
                    self.val_date = None
                    self.val_text = val
            else:
                self.val_date = None
                self.val_text = None
        else:
            self.val_text = str(val) if val is not None else ""
