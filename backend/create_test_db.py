"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

﻿import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.db.base import Base
engine=create_async_engine(os.environ["DATABASE_URL"], echo=False)
async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
asyncio.run(main())
print("created")
