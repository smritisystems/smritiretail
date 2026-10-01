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

from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.auth import User
from app.models.workflow import WorkflowEvent


class BaseDocumentLifecycleHandler(ABC):
    """
    Abstract Strategy Contract for Document Lifecycle Handlers.
    Each business document domain (PurchaseOrder, SalesInvoice, GRN, StockTransfer,
    PaymentTransaction, DistributionOrder, etc.) implements this contract to handle
    domain-specific entity loading, validation, state stamping, revision chains,
    and side effects.

    The UniversalLifecycleEngine interacts EXCLUSIVELY through this interface,
    ensuring zero document-type hardcoding in the kernel.
    """

    document_type: str = ""

    @abstractmethod
    async def get_document(
        self,
        db: AsyncSession,
        doc_id: str,
        tenant_ctx: TenantContext
    ) -> Any:
        """
        Safely loads the document entity by primary key, enforcing tenant company/branch isolation.
        Must raise DocumentNotFoundException if not found or cross-tenant.
        """
        pass

    def get_current_status(self, doc: Any) -> str:
        """Extracts and normalizes the current document state string."""
        return str(getattr(doc, "status", "DRAFT")).strip().upper()

    def get_version(self, doc: Any) -> int:
        """Extracts the optimistic concurrency version counter (BaseEntity.version)."""
        return int(getattr(doc, "version", 1))

    def get_resource_name(self) -> str:
        """
        Returns the RBAC resource key for evaluate_action_permission.
        Defaults to lowercase document_type (e.g. 'purchase_order', 'sales_order').
        """
        return self.document_type.lower()

    def get_document_amount(self, doc: Any) -> Decimal:
        """
        Extracts the transaction total amount for ApprovalPolicy threshold evaluation.
        Defaults to Decimal(0.00) if document has no financial value.
        """
        amount = (
            getattr(doc, "grand_total", None)
            or getattr(doc, "total_amount", None)
            or getattr(doc, "amount", None)
            or getattr(doc, "subtotal", None)
        )
        if amount is not None:
            return Decimal(str(amount))
        return Decimal("0.00")

    def is_approval_action(self, action: str) -> bool:
        """Determines if the requested action triggers financial threshold approval checks."""
        return action.strip().upper() in ("SUBMIT", "CONFIRM", "APPROVE", "AUTHORIZE")

    def get_default_workflow_definition(self) -> Optional[Dict[str, Any]]:
        """
        Provides fallback WorkflowDefinition state machine graph for this document family
        if not yet seeded in database workflow_definitions table.
        """
        return None

    def get_document_summary(self, doc: Any) -> Dict[str, Any]:
        """Returns non-sensitive metadata summary for the transition response."""
        return {
            "document_no": getattr(doc, "order_no", None) or getattr(doc, "doc_no", None) or getattr(doc, "number", None),
        }

    async def validate_transition(
        self,
        db: AsyncSession,
        doc: Any,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Domain-specific validation before transition execution.
        Subclasses should raise HandlerValidationException if preconditions fail.
        """
        pass

    async def before_transition(
        self,
        db: AsyncSession,
        doc: Any,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Hook called immediately before state mutation."""
        pass

    @abstractmethod
    async def apply_transition(
        self,
        db: AsyncSession,
        doc: Any,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Applies domain-specific state mutation on the document entity.
        Must update doc.status, actor stamps (e.g. submitted_by, confirmed_by, cancelled_by),
        timestamps, and maintain is_deleted = False.
        """
        pass

    async def after_transition(
        self,
        db: AsyncSession,
        doc: Any,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        event: WorkflowEvent,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Post-transition hook executed after WorkflowEvent has been staged.
        Use for async notification dispatch, audit indexing, or downstream queueing.
        """
        pass

    async def get_available_actions(
        self,
        db: AsyncSession,
        doc: Any,
        user: User,
        tenant_ctx: TenantContext,
        transitions: List[Dict[str, Any]],
    ) -> List[str]:
        """
        Filters candidate transitions from the workflow definition to determine which
        actions are currently available to this user for this document.
        """
        current_state = self.get_current_status(doc)
        available = []
        user_roles_upper = [r.upper() for r in ([user.role.value] if hasattr(user.role, "value") else [str(user.role)])]
        
        for t in transitions:
            if t.get("from") == current_state:
                req_roles = t.get("required_roles", [])
                if not req_roles or any(r in user_roles_upper for r in [req.upper() for req in req_roles]):
                    action = t.get("action")
                    if action and action not in available:
                        available.append(action)
        return available
