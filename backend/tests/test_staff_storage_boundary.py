from sqlalchemy import inspect

from app.models.auth import User
from app.models.staff_placement import StaffPlacementAssignment
from app.models.staff_profile import StaffProfile
from app.models.staff_profile_history import StaffProfileHistory


def test_staff_profile_keeps_identity_reference_application_level_only():
    assert not inspect(StaffProfile).columns.user_id.foreign_keys
    assert "hashed_password" not in StaffProfile.__table__.columns
    assert "hashed_password" in User.__table__.columns


def test_staff_operational_records_remain_company_scoped():
    assert "company_id" in StaffProfile.__table__.columns
    assert "company_id" in StaffPlacementAssignment.__table__.columns
    assert StaffPlacementAssignment.__table__.c.staff_user_id.foreign_keys


def test_staff_history_and_placement_snapshots_are_present():
    assert "before_state_json" in StaffProfileHistory.__table__.columns
    assert "after_state_json" in StaffProfileHistory.__table__.columns
    assert "changed_at" in StaffProfileHistory.__table__.columns
    assert "host_address_line1_snapshot" in StaffPlacementAssignment.__table__.columns
    assert "host_city_snapshot" in StaffPlacementAssignment.__table__.columns
    assert "host_state_snapshot" in StaffPlacementAssignment.__table__.columns
    assert "host_pincode_snapshot" in StaffPlacementAssignment.__table__.columns
