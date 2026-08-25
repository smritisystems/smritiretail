"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.43.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class FormulaDefinitionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    version: int
    name: str
    category: str
    description: Optional[str] = None
    expression_ast: Dict[str, Any]
    parameters_schema: Dict[str, Any]
    is_active: bool
    status: str


class FormulaEvalRequest(BaseModel):
    ast: Dict[str, Any]
    params: Dict[str, Any] = Field(default_factory=dict)


class FormulaEvalResponse(BaseModel):
    result: float
    result_decimal: str


class BusinessRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    version: int
    name: str
    rule_type: str
    priority: int
    conditions: Dict[str, Any]
    actions: List[Dict[str, Any]]
    scopes: Dict[str, Any]
    is_active: bool
    status: str


class BusinessRuleEvalRequest(BaseModel):
    conditions: Dict[str, Any]
    actions: List[Dict[str, Any]]
    context: Dict[str, Any]


class BusinessRuleEvalResponse(BaseModel):
    matched: bool
    actions: List[Dict[str, Any]]
    context: Dict[str, Any]


class PolicyDefinitionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    version: int
    name: str
    policy_type: str
    parameters: Dict[str, Any]
    is_active: bool
    status: str


class GstTaxPolicyEvalRequest(BaseModel):
    line_items: List[Dict[str, Any]]
    supplier_state: str = "27"
    recipient_state: str = "27"
    parameters: Optional[Dict[str, Any]] = None


class WorkflowDefinitionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    version: int
    doc_type: str
    name: str
    initial_state: str
    states: List[str]
    transitions: List[Dict[str, Any]]
    is_active: bool
    status: str


class WorkflowTransitionRequest(BaseModel):
    workflow_code: str
    current_state: str
    action: str
    user_roles: List[str]


class WorkflowTransitionResponse(BaseModel):
    allowed: bool
    new_state: Optional[str] = None
    action: str
    required_roles: Optional[List[str]] = None
    reason: Optional[str] = None


class DefinitionValidationRequest(BaseModel):
    definition_type: str  # FORMULA, RULE, POLICY, WORKFLOW
    definition: Dict[str, Any]


class DefinitionValidationResponse(BaseModel):
    valid: bool
    errors: List[str] = Field(default_factory=list)


class PolicyUpdateRequest(BaseModel):
    name: Optional[str] = None
    parameters: Dict[str, Any]
    status: Optional[str] = "ACTIVE"


class CostMaskPreviewRequest(BaseModel):
    cost_price: float
    encoding_map: Dict[str, str] = Field(
        default_factory=lambda: {"0": "A", "1": "B", "2": "C", "3": "D", "4": "E", "5": "F", "6": "G", "7": "H", "8": "I", "9": "J"}
    )


class CostMaskPreviewResponse(BaseModel):
    original_cost: float
    encoded_string: str
