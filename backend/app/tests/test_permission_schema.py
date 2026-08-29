import psycopg2

from app.core.config import settings


def test_smriti_permissions_schema_is_present_and_queryable():
    url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = psycopg2.connect(url)
    cur = conn.cursor()

    cur.execute("SELECT to_regclass('public.smriti_permissions')")
    assert cur.fetchone()[0] is not None, "smriti_permissions table must exist"

    cur.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'smriti_permissions' ORDER BY ordinal_position"
    )
    columns = {row[0] for row in cur.fetchall()}
    required = {
        "id",
        "uuid",
        "company_id",
        "branch_id",
        "code",
        "resource",
        "action",
        "scope",
        "module",
        "description",
        "tenant_id",
        "created_at",
        "modified_at",
        "created_by",
        "updated_by",
        "is_active",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "version",
    }
    missing = sorted(required - columns)
    assert not missing, f"Missing permission columns: {missing}"

    scope = "User:test_perm_schema"
    cur.execute("DELETE FROM smriti_permissions WHERE scope = %s", (scope,))
    cur.execute(
        """
        INSERT INTO smriti_permissions (
            id, uuid, code, resource, action, scope, module, tenant_id,
            company_id, branch_id, is_active, is_deleted, created_at, modified_at, version
        )
        VALUES (
            'perm-test-schema-001', '11111111-1111-4111-8111-111111111111',
            'User:test_perm_schema:sales_billing:VIEW', 'sales_billing', 'VIEW',
            %s, 'core', NULL, NULL, NULL, true, false, NOW(), NOW(), 1
        )
        """,
        (scope,),
    )
    conn.commit()

    cur.execute(
        "SELECT resource, action, is_active FROM smriti_permissions WHERE scope = %s AND resource = 'sales_billing' AND action = 'VIEW'",
        (scope,),
    )
    row = cur.fetchone()
    assert row is not None, "permission lookup must succeed against the canonical table"
    assert row[0] == "sales_billing"
    assert row[1] == "VIEW"
    assert row[2] is True

    cur.execute("DELETE FROM smriti_permissions WHERE id = 'perm-test-schema-001'")
    conn.commit()
    cur.close()
    conn.close()
