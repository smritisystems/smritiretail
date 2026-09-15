"""Company-local employee profile linked to a control-plane user identity."""

import uuid as uuid_pkg
from sqlalchemy import Column, String, Text, UniqueConstraint
from ..db.base import BaseEntity


class StaffProfile(BaseEntity):
    """Employment and HR profile owned by one company database.

    ``user_id`` is an application-level reference to ``smritisys.users.id``.
    Physical databases cannot enforce a foreign key across that boundary.
    """

    __tablename__ = "staff_profiles"

    id = Column(String(50), primary_key=True, default=lambda: f"stp-{uuid_pkg.uuid4().hex[:12]}")
    user_id = Column(String(50), nullable=False, index=True)
    employee_id = Column(String(20), nullable=True)
    employee_code = Column(String(20), nullable=True)
    display_name = Column(String(100), nullable=True)
    full_name = Column(String(200), nullable=True)
    gender = Column(String(10), nullable=True)
    date_of_birth = Column(String(20), nullable=True)
    alternate_mobile = Column(String(20), nullable=True)
    emergency_contact = Column(String(100), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(50), nullable=False, default="India")
    pin_code = Column(String(10), nullable=True)
    department = Column(String(100), nullable=True)
    designation = Column(String(100), nullable=True)
    branch = Column(String(200), nullable=True)
    department_id = Column(String(50), nullable=True)
    designation_id = Column(String(50), nullable=True)
    date_of_joining = Column(String(20), nullable=True)
    reporting_manager = Column(String(200), nullable=True)
    employment_type = Column(String(20), nullable=False, default="Permanent")
    allowed_branches = Column(Text, nullable=True)
    photo = Column(Text, nullable=True)
    salary_json = Column(Text, nullable=True)
    payment_json = Column(Text, nullable=True)
    performance_json = Column(Text, nullable=True)
    preferences_json = Column(Text, nullable=True)
    notification_settings_json = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="Active")

    __table_args__ = (
        UniqueConstraint("company_id", "user_id", name="uq_staff_profiles_company_user"),
    )
