"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TermsClauseCreate(BaseModel):
    title: str
    category: str
    content: str
    code: str | None = None
    isActive: bool | None = Field(True, alias="isActive")
    status: str | None = "Approved"
    language: str | None = "English"

    model_config = ConfigDict(populate_by_name=True)


class TermsClauseUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    content: str | None = None
    code: str | None = None
    isActive: bool | None = Field(None, alias="isActive")
    status: str | None = None
    language: str | None = None
    submitForApproval: bool | None = Field(None, alias="submitForApproval")
    comments: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class TermsClauseResponse(BaseModel):
    id: str
    title: str
    category: str
    content: str
    code: str | None = None
    isActive: bool = Field(..., serialization_alias="isActive")
    version: int
    lastUpdated: str = Field(..., serialization_alias="lastUpdated")
    updatedBy: str | None = Field(None, serialization_alias="updatedBy")
    status: str
    language: str

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class TermsDefaultCreate(BaseModel):
    level: str
    refId: str = Field(..., alias="refId")
    clauseIds: list[str] = Field(..., alias="clauseIds")
    isActive: bool | None = Field(True, alias="isActive")


class TermsDefaultResponse(BaseModel):
    id: str
    level: str
    refId: str = Field(..., serialization_alias="refId")
    clauseIds: list[str] = Field(..., serialization_alias="clauseIds")
    isActive: bool = Field(..., serialization_alias="isActive")
    lastUpdated: str = Field(..., serialization_alias="lastUpdated")
    updatedBy: str | None = Field(None, serialization_alias="updatedBy")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class TermsSnapshotCreate(BaseModel):
    documentType: str = Field(..., alias="documentType")
    documentNo: str = Field(..., alias="documentNo")
    clauses: list[dict[str, Any]]


class TermsSnapshotResponse(BaseModel):
    id: str
    documentType: str = Field(..., serialization_alias="documentType")
    documentNo: str = Field(..., serialization_alias="documentNo")
    snapshotAt: str = Field(..., serialization_alias="snapshotAt")
    clausesSnapshot: list[dict[str, Any]] = Field(..., serialization_alias="clausesSnapshot")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class TermsResolveRequest(BaseModel):
    companyCode: str | None = Field("SMRITI_IND", alias="companyCode")
    branchCode: str | None = Field(None, alias="branchCode")
    documentType: str | None = Field(None, alias="documentType")
    partyId: str | None = Field(None, alias="partyId")
    variables: dict[str, str] | None = None


class ResolvedLevel(BaseModel):
    level: str
    refId: str | None = Field(None, serialization_alias="refId")
    active: bool
    count: int

    model_config = {
        "populate_by_name": True
    }


class resolvedLevelResponse(BaseModel):
    companyApplied: bool
    branchApplied: bool
    documentApplied: bool
    partyApplied: bool
    levels: list[ResolvedLevel]


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
        "populate_by_name": True
    }


class TermsResolveResponse(BaseModel):
    inheritanceTrace: resolvedLevelResponse = Field(..., serialization_alias="inheritanceTrace")
    resolvedList: list[ResolvedClause] = Field(..., serialization_alias="resolvedList")

    model_config = {
        "populate_by_name": True
    }


class ApprovalWorkflowLogResponse(BaseModel):
    id: str
    clauseId: str = Field(..., serialization_alias="clauseId")
    title: str
    version: int
    submittedBy: str | None = Field(None, serialization_alias="submittedBy")
    submittedAt: str = Field(..., serialization_alias="submittedAt")
    status: str
    approvedBy: str | None = Field(None, serialization_alias="approvedBy")
    approvedAt: str = Field(..., serialization_alias="approvedAt")
    proposedChanges: dict[str, Any] | None = Field(None, serialization_alias="proposedChanges")
    comments: str | None = None

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }
