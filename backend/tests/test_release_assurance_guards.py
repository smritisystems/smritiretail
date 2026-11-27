import sys
import unittest
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(WORKSPACE_ROOT / "scripts"))
sys.path.insert(0, str(WORKSPACE_ROOT / "backend"))

from app.test_environment import parse_isolated_test_url, validate_test_tenant_name  # noqa: E402
from check_immutable_migrations import existing_migration_changes  # noqa: E402


class TestDatabaseSafetyTests(unittest.TestCase):
    def test_accepts_explicit_loopback_control_database(self):
        parsed = parse_isolated_test_url(
            "postgresql+asyncpg://postgres:test-only@127.0.0.1:5432/smritisys"
        )
        self.assertEqual(parsed.hostname, "127.0.0.1")

    def test_rejects_remote_or_tenant_database_urls(self):
        for url in (
            "postgresql://postgres:test-only@example.com:5432/smritisys",
            "postgresql://postgres:test-only@localhost:5432/smriti001",
        ):
            with self.subTest(url=url), self.assertRaises(ValueError):
                parse_isolated_test_url(url)

    def test_accepts_only_disposable_tenant_names(self):
        self.assertEqual(validate_test_tenant_name("smriti_test_001"), "smriti_test_001")
        with self.assertRaises(ValueError):
            validate_test_tenant_name("smriti001")


class ImmutableMigrationTests(unittest.TestCase):
    def test_allows_new_revisions_and_rejects_existing_revision_edits(self):
        output = "A\tbackend/alembic/versions/v1593_new.py\nM\tbackend/alembic/versions/v1591_old.py\n"
        self.assertEqual(
            existing_migration_changes(output),
            ["backend/alembic/versions/v1591_old.py"],
        )

    def test_rejects_deleted_or_renamed_revision_files(self):
        output = (
            "D\tbackend/alembic/versions/v1500_deleted.py\n"
            "R100\tbackend/alembic/versions/v1501_old.py\tbackend/alembic/versions/v1501_new.py\n"
        )
        self.assertEqual(
            existing_migration_changes(output),
            [
                "backend/alembic/versions/v1500_deleted.py",
                "backend/alembic/versions/v1501_old.py",
                "backend/alembic/versions/v1501_new.py",
            ],
        )


if __name__ == "__main__":
    unittest.main()
