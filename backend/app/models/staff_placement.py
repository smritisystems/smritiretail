"""Staff placement at internal branches or customer partner stores."""

import uuid as uuid_pkg
from sqlalchemy import Column, Date, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class StaffPlacementAssignment(BaseEntity):
    __tablename__ = "staff_placement_assignments"

    id = Column(String(50), primary_key=True, default=lambda: f"spa-{uuid_pkg.uuid4().hex[:12]}")
    staff_user_id = Column(String(50), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    placement_type = Column(String(30), nullable=False)  # INTERNAL_BRANCH | CUSTOMER_STORE | THIRD_PARTY_STORE
    internal_branch_id = Column(String(50), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True, index=True)
    internal_store_id = Column(String(50), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=True, index=True)
    host_customer_id = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=True, index=True)
    host_delivery_location_id = Column(String(50), ForeignKey("customer_delivery_locations.id", ondelete="RESTRICT"), nullable=True, index=True)
    host_store_code_snapshot = Column(String(50), nullable=True)
    host_store_name_snapshot = Column(String(255), nullable=True)
    host_address_line1_snapshot = Column(Text, nullable=True)
    host_address_line2_snapshot = Column(Text, nullable=True)
    host_city_snapshot = Column(String(100), nullable=True)
    host_state_snapshot = Column(String(100), nullable=True)
    host_pincode_snapshot = Column(String(10), nullable=True)
    role_at_location = Column(String(100), nullable=True)
    stock_model = Column(String(30), nullable=False, default="OUTRIGHT_SALE")  # OUTRIGHT_SALE | CONSIGNMENT | STOCK_ON_APPROVAL
    commission_program_id = Column(String(50), ForeignKey("commission_programs.id", ondelete="SET NULL"), nullable=True, index=True)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    status = Column(String(30), nullable=False, default="PENDING")  # PENDING | ACTIVE | REJECTED | EXPIRED | CANCELLED
    approval_reason = Column(Text, nullable=True)
    approved_by = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(Date, nullable=True)

    __table_args__ = (
        UniqueConstraint("company_id", "staff_user_id", "host_delivery_location_id", "effective_from", name="uq_staff_placement_location_start"),
        Index(
            "uq_staff_placement_active_user",
            "company_id", "staff_user_id",
            unique=True,
            postgresql_where=text("is_deleted = false AND status = 'ACTIVE'"),
        ),
    )

    staff_user = relationship("User", foreign_keys=[staff_user_id])
    approved_by_user = relationship("User", foreign_keys=[approved_by])
    internal_branch = relationship("Branch", foreign_keys=[internal_branch_id])
    internal_store = relationship("Store", foreign_keys=[internal_store_id])
    host_customer = relationship("Customer", foreign_keys=[host_customer_id])
    host_delivery_location = relationship("CustomerDeliveryLocation", foreign_keys=[host_delivery_location_id])