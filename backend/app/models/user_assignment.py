"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.22.0
 * Created      : 2026-07-17
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 """

import uuid as uuid_pkg
from sqlalchemy import Column, String, ForeignKey, UniqueConstraint, Index, Boolean, text
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class UserCompanyAssignment(BaseEntity):
    __tablename__ = "user_company_assignments"

    id = Column(String(50), primary_key=True, default=lambda: f"uca-{uuid_pkg.uuid4().hex[:12]}")
    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_default = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        Index(
            "ix_user_company_assignments_user_id_company_id_active",
            "user_id",
            "company_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
        Index(
            "ix_user_company_assignments_user_id_default",
            "user_id",
            unique=True,
            postgresql_where=text("is_default = true"),
        ),
    )

    user = relationship("User", foreign_keys=[user_id])
    company = relationship("Company", foreign_keys=[company_id])


class UserBranchAssignment(BaseEntity):
    __tablename__ = "user_branch_assignments"

    id = Column(String(50), primary_key=True, default=lambda: f"uba-{uuid_pkg.uuid4().hex[:12]}")
    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id = Column(String(50), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_default = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        Index(
            "ix_user_branch_assignments_user_id_branch_id_active",
            "user_id",
            "branch_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
        Index(
            "ix_user_branch_assignments_user_id_company_id_default",
            "user_id",
            "company_id",
            unique=True,
            postgresql_where=text("is_default = true"),
        ),
    )

    user = relationship("User", foreign_keys=[user_id])
    branch = relationship("Branch", foreign_keys=[branch_id])


# RETIRED — Phase C (2026-09-16, v6.26.0)
# Table 'user_store_assignments' dropped via migration v1454_retire_stores_table.py.
# All 5 safety gates passed. Canonical replacement is UserBranchAssignment.
# class UserStoreAssignment(BaseEntity):
#     __tablename__ = "user_store_assignments"

