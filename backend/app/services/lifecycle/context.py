"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.47.4
* Created    : 2026-10-01
* Modified   : 2026-10-01
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class LifecycleTransitionContext(BaseModel):
    """Execution context passed into UniversalLifecycleEngine for state transitions."""
    doc_type: str = Field(..., description="Canonical document type (e.g. PurchaseOrder, SalesInvoice)")
    doc_id: str = Field(..., description="Document primary key ID")
    action: str = Field(..., description="Requested state machine transition action (e.g. SUBMIT, CONFIRM, CANCEL)")
    expected_version: Optional[int] = Field(None, description="Optional optimistic concurrency control version counter")
    notes: Optional[str] = Field(None, description="Optional transition notes or audit remarks")
    payload: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Arbitrary domain-specific action payload")


class LifecycleTransitionResult(BaseModel):
    """Result returned by UniversalLifecycleEngine upon transition execution."""
    success: bool
    doc_type: str
    doc_id: str
    from_status: Optional[str] = None
    to_status: str
    action: str
    event_id: str
    version: int
    available_actions: List[str] = Field(default_factory=list)
    pending_approval: bool = False
    message: str
    details: Optional[Dict[str, Any]] = Field(default_factory=dict)


class LifecycleStateResponse(BaseModel):
    """Active lifecycle state and permitted next actions for a document."""
    doc_type: str
    doc_id: str
    status: str
    version: int
    available_actions: List[str] = Field(default_factory=list)
    pending_approval: bool = False
    audit_info: Dict[str, Any] = Field(default_factory=dict)
