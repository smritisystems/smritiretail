import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.core.config import settings
from app.services.auth import AuthService
from app.schemas.auth import BootstrapRequest

async def main():
    print('DATABASE_URL=', settings.DATABASE_URL)
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSession = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSession() as session:
        service = AuthService(session)
        req = BootstrapRequest(username='admin_test', password='Admin@secure1', email='admin_test@smriti.test')
        try:
            user = await service.bootstrap_admin(req)
            print('created', user.id, user.username)
        except IntegrityError as err:
            print('IntegrityError:', err)
            print('orig:', err.orig)
            print('params:', err.params)
            await session.rollback()
        except SQLAlchemyError as err:
            print('SQLAlchemyError:', type(err), err)
            await session.rollback()
        except Exception as err:
            print('Exception:', type(err), err)
    await engine.dispose()

asyncio.run(main())
