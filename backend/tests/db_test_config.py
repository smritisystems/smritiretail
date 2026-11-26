"""Connection URLs for the isolated company database used by backend tests."""

from sqlalchemy.engine import make_url

from app.core.config import settings

_test_database_url = make_url(str(settings.DATABASE_URL)).set(
    database="smriti_test_001"
)

COMPANY_001_SYNC_URL = _test_database_url.set(
    drivername="postgresql"
).render_as_string(hide_password=False)
COMPANY_001_ASYNC_URL = _test_database_url.set(
    drivername="postgresql+asyncpg"
).render_as_string(hide_password=False)

COMPANY_002_ASYNC_URL = _test_database_url.set(
    database="smriti_test_002",
    drivername="postgresql+asyncpg",
).render_as_string(hide_password=False)
