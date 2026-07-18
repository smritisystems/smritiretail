import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings
from app.models.auth import User
from app.core.security import verify_password
from app.schemas.auth import LoginRequest
from app.services.auth import AuthService

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with async_session() as session:
        res = await session.execute(
            __import__('sqlalchemy').future.select(User).where(User.username == 'admin')
        )
        user = res.scalars().first()
        print('user', user.username if user else None, 'email', user.email if user else None, 'status', user.status if user else None)
        if user:
            print('hash', user.hashed_password)
            print('verify Admin@123', verify_password('Admin@123', user.hashed_password))
            print('verify admin@123', verify_password('admin@123', user.hashed_password))
            auth_service = AuthService(session)
            try:
                token_data = await auth_service.login(LoginRequest(username='admin', password='Admin@123'))
                print('login success', token_data)
            except Exception as e:
                print('login exception', type(e), e)

    await engine.dispose()

asyncio.run(main())
