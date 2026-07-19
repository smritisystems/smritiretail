"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class TermsClauseCreate(BaseModel):
    title: str
    category: str
    content: str
    code: Optional[str] = None
    isActive: Optional[bool] = Field(True, alias="isActive")
    status: Optional[str] = "Approved"
    language: Optional[str] = "English"

    model_config = ConfigDict(populate_by_name=True)


class TermsClauseUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    code: Optional[str] = None
    isActive: Optional[bool] = Field(None, alias="isActive")
    status: Optional[str] = None
    language: Optional[str] = None
    submitForApproval: Optional[bool] = Field(None, alias="submitForApproval")
    comments: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class TermsClauseResponse(BaseModel):
    id: str
    title: str
    category: str
    content: str
    code: Optional[str] = None
    isActive: bool = Field(..., serialization_alias="isActive")
    version: int
    lastUpdated: str = Field(..., serialization_alias="lastUpdated")
    updatedBy: Optional[str] = Field(None, serialization_alias="updatedBy")
    status: str
    language: str

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class TermsDefaultCreate(BaseModel):
    level: str
    refId: str = Field(..., alias="refId")
    clauseIds: List[str] = Field(..., alias="clauseIds")
    isActive: Optional[bool] = Field(True, alias="isActive")


class TermsDefaultResponse(BaseModel):
    id: str
    level: str
    refId: str = Field(..., serialization_alias="refId")
    clauseIds: List[str] = Field(..., serialization_alias="clauseIds")
    isActive: bool = Field(..., serialization_alias="isActive")
    lastUpdated: str = Field(..., serialization_alias="lastUpdated")
    updatedBy: Optional[str] = Field(None, serialization_alias="updatedBy")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class TermsSnapshotCreate(BaseModel):
    documentType: str = Field(..., alias="documentType")
    documentNo: str = Field(..., alias="documentNo")
    clauses: List[Dict[str, Any]]


class TermsSnapshotResponse(BaseModel):
    id: str
    documentType: str = Field(..., serialization_alias="documentType")
    documentNo: str = Field(..., serialization_alias="documentNo")
    snapshotAt: str = Field(..., serialization_alias="snapshotAt")
    clausesSnapshot: List[Dict[str, Any]] = Field(..., serialization_alias="clausesSnapshot")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class TermsResolveRequest(BaseModel):
    companyCode: Optional[str] = Field("SMRITI_IND", alias="companyCode")
    branchCode: Optional[str] = Field(None, alias="branchCode")
    documentType: Optional[str] = Field(None, alias="documentType")
    partyId: Optional[str] = Field(None, alias="partyId")
    variables: Optional[Dict[str, str]] = None


class ResolvedLevel(BaseModel):
    level: str
    refId: Optional[str] = Field(None, serialization_alias="refId")
    active: bool
    count: int

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class resolvedLevelResponse(BaseModel):
    companyApplied: bool
    branchApplied: bool
    documentApplied: bool
    partyApplied: bool
    levels: List[ResolvedLevel]


class ResolvedClause(BaseModel):
    id: str
    title: str
    category: str
    rawContent: str = Field(..., serialization_alias="rawContent")
    resolvedContent: str = Field(..., serialization_alias="resolvedContent")
    order: int
    isActive: bool = Field(..., serialization_alias="isActive")
    version: int
    status: str

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class TermsResolveResponse(BaseModel):
    inheritanceTrace: resolvedLevelResponse = Field(..., serialization_alias="inheritanceTrace")
    resolvedList: List[ResolvedClause] = Field(..., serialization_alias="resolvedList")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class ApprovalWorkflowLogResponse(BaseModel):
    id: str
    clauseId: str = Field(..., serialization_alias="clauseId")
    title: str
    version: int
    submittedBy: Optional[str] = Field(None, serialization_alias="submittedBy")
    submittedAt: str = Field(..., serialization_alias="submittedAt")
    status: str
    approvedBy: Optional[str] = Field(None, serialization_alias="approvedBy")
    approvedAt: str = Field(..., serialization_alias="approvedAt")
    proposedChanges: Optional[Dict[str, Any]] = Field(None, serialization_alias="proposedChanges")
    comments: Optional[str] = None

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }
