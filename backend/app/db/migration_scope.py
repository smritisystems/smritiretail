import re

from .ownership import TableOwner, get_owner


_MIGRATION_SCOPE = re.compile(r"@migration_target\(\s*['\"](control|tenant|both)['\"]\s*\)")
_REVISION_NUMBER = re.compile(r"^v(\d+)")
_TARGET_SCOPE_CUTOVER = 1578


def is_table_allowed_for_target(table_name: str, target: str) -> bool:
    """Keep control-plane-only and tenant-only tables out of the opposite target."""
    owner = get_owner(table_name)
    if target == "control":
        return owner != TableOwner.TENANT
    if target == "tenant":
        return owner != TableOwner.CONTROL_PLANE
    return True


def revision_applies_to_target(revision_id: str, source: str, requested_target: str) -> bool:
    if requested_target not in {"control", "tenant"}:
        raise RuntimeError(f"Unsupported Alembic target: {requested_target!r}")

    match = _MIGRATION_SCOPE.search(source)
    if match is None:
        number = _REVISION_NUMBER.match(revision_id)
        if number and int(number.group(1)) >= _TARGET_SCOPE_CUTOVER:
            raise RuntimeError(
                f"Migration {revision_id} is missing its required @migration_target declaration."
            )
        return True

    return match.group(1) in {requested_target, "both"}


def validate_revision_scope(revision_id: str, source: str, requested_target: str) -> None:
    if not revision_applies_to_target(revision_id, source, requested_target):
        declared_target = _MIGRATION_SCOPE.search(source).group(1)
        raise RuntimeError(
            f"Migration target violation: {revision_id} targets {declared_target}, "
            f"but Alembic was invoked for {requested_target}."
        )
