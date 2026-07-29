"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.2.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ValidationMode(str, Enum):
    NONE = "NONE"
    WARNING = "WARNING"
    STRICT = "STRICT"
    AUTO_CREATE = "AUTO_CREATE"


class CasingRule(str, Enum):
    NONE = "NONE"
    UPPER = "UPPER"
    LOWER = "LOWER"
    TITLE = "TITLE"


class FieldValidationConfig(BaseModel):
    mandatory: bool = False
    mode: ValidationMode = ValidationMode.STRICT
    master_type: Optional[str] = None
    casing: CasingRule = CasingRule.TITLE
    auto_create_allowed_roles: List[str] = Field(
        default_factory=lambda: ["SYSADMIN", "MANAGER", "ADMINISTRATOR", "COMPANY_ADMIN", "BRANCH_ADMIN"]
    )
    daily_auto_create_limit: Optional[int] = 100


class ConditionalRuleConfig(BaseModel):
    id: str
    priority: int = 100
    when: Dict[str, Any] = Field(default_factory=dict)
    require: List[str] = Field(default_factory=list)
    disable: List[str] = Field(default_factory=list)
    set_mode: Dict[str, ValidationMode] = Field(default_factory=dict)


class ValidationPolicy(BaseModel):
    entity_type: str
    tenant_id: Optional[str] = None
    fields: Dict[str, FieldValidationConfig] = Field(default_factory=dict)
    conditional_rules: List[ConditionalRuleConfig] = Field(default_factory=list)


class ValidationResult(BaseModel):
    valid: bool
    normalized_data: Dict[str, Any]
    warnings: List[Dict[str, Any]] = Field(default_factory=list)
    auto_created_values: List[Dict[str, Any]] = Field(default_factory=list)
    applied_rules: List[str] = Field(default_factory=list)
