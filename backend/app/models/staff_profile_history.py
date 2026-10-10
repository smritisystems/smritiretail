"""Append-only history for company-local staff profile changes."""

import uuid as uuid_pkg
from sqlalchemy import Column, DateTime, String, Text
from ..db.base import BaseEntity


class StaffProfileHistory(BaseEntity):
    __tablename__ = "staff_profile_history"

    id = Column(String(50), primary_key=True, default=lambda: f"sph-{uuid_pkg.uuid4().hex[:12]}")
    staff_profile_id = Column(String(50), nullable=False, index=True)
    user_id = Column(String(50), nullable=False, index=True)
    change_type = Column(String(30), nullable=False)
    before_state_json = Column(Text, nullable=True)
    after_state_json = Column(Text, nullable=False)
    changed_by = Column(String(50), nullable=False)
    changed_at = Column(DateTime(timezone=True), nullable=False)
