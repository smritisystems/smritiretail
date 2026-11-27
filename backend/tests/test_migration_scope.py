import pytest

from app.db.migration_scope import (
    is_table_allowed_for_target,
    revision_applies_to_target,
    validate_revision_scope,
)


def test_pre_cutover_revision_does_not_require_scope_marker():
    validate_revision_scope("v1577", "revision = 'v1577'\n", "control")


@pytest.mark.parametrize("target", ["control", "tenant"])
def test_post_cutover_revision_requires_scope_marker(target):
    with pytest.raises(RuntimeError, match="missing its required"):
        validate_revision_scope("v1596_alignment", "revision = 'v1596_alignment'\n", target)


def test_revision_rejects_mismatched_target():
    source = "# @migration_target('tenant')\nrevision = 'v1597'\n"

    assert revision_applies_to_target("v1597", source, "control") is False
    with pytest.raises(RuntimeError, match="targets tenant"):
        validate_revision_scope("v1597", source, "control")


def test_both_target_revision_is_allowed_for_each_target():
    source = "# @migration_target('both')\nrevision = 'v1582'\n"

    validate_revision_scope("v1582", source, "control")
    validate_revision_scope("v1582", source, "tenant")


def test_control_plane_tables_are_excluded_from_tenant_migrations():
    assert is_table_allowed_for_target("companies", "tenant") is False
    assert is_table_allowed_for_target("customers", "tenant") is True


def test_tenant_tables_are_excluded_from_control_migrations():
    assert is_table_allowed_for_target("customers", "control") is False
    assert is_table_allowed_for_target("companies", "control") is True


def test_shared_reference_tables_remain_available_to_both_targets():
    assert is_table_allowed_for_target("master_types", "control") is True
    assert is_table_allowed_for_target("master_types", "tenant") is True
