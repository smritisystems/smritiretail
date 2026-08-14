import asyncio
import traceback
from app.db.session import async_session
from app.services.auth import AuthService
from app.schemas.auth import BootstrapRequest

async def main():
    async with async_session() as db:
        req = BootstrapRequest(username='admin', password='Admin@123', email='admin@smriti.local')
        service = AuthService(db)
        try:
            user = await service.bootstrap_admin(req)
            print('CREATED', user.id, user.username, user.email)
        except Exception as e:
            traceback.print_exc()

asyncio.run(main())
