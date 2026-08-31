"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.42.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime


class WorkspaceTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    vertical: str
    included_capabilities: List[str] = Field(default_factory=list)
    layout_config: Dict[str, Any] = Field(default_factory=dict)
    is_system_template: bool = True
    status: str = "ACTIVE"
    description: Optional[str] = None


class WorkspaceResolutionResponse(BaseModel):
    template_code: str
    persona: str
    theme_code: str
    active_capabilities: List[str]
    widgets: List[str]
    shortcuts: List[Dict[str, Any]]
    layout_config: Dict[str, Any]


class ResolvedNavNode(BaseModel):
    id: str
    title: str
    path: Optional[str] = None
    icon: Optional[str] = None
    required_capability: Optional[str] = None
    badge: Optional[str] = None
    sequence: int = 0
    children: List["ResolvedNavNode"] = Field(default_factory=list)


class DesignTokensResponse(BaseModel):
    theme_id: str
    theme_name: str
    variant: str
    font_heading: str
    font_body: str
    border_radius_px: int
    colors: Dict[str, str]
    spacing: Dict[str, str]
    shadows: Dict[str, str]


class FieldMetadataItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    label_key: Optional[str] = None
    field_type: str
    data_type: str
    is_required: bool
    is_readonly: bool
    is_searchable: bool
    validation_rules: Optional[Dict[str, Any]] = None


class ActionMetadataItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    action_type: str
    placement: str
    icon_key: Optional[str] = None
    variant: Optional[str] = None
    required_capability: Optional[str] = None
    target_route: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_method: Optional[str] = None


class CompleteScreenPackageResponse(BaseModel):
    screen_code: str
    name: str
    module_code: str
    workspace_code: Optional[str] = None
    screen_type: str
    persona_mode: str
    capability_code: Optional[str] = None
    route_path: Optional[str] = None
    icon_key: Optional[str] = None
    searchable: bool = False
    exportable: bool = False
    printable: bool = False
    layout_config: Optional[Dict[str, Any]] = None
    fields: List[FieldMetadataItem] = Field(default_factory=list)
    actions: List[ActionMetadataItem] = Field(default_factory=list)
