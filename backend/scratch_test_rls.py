import asyncio
from sqlalchemy.future import select
from sqlalchemy.orm import with_loader_criteria
from app.db.session import engine
from app.models.sales import SalesInvoice

def compile_query(stmt):
    # Compile the statement and print it
    from sqlalchemy.dialects import postgresql
    compiled = stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    return str(compiled)

def main():
    print("--- Test 8: Nested def function with closure variable ---")
    user_id = "usr-cashier-a"
    def make_criteria(cls):
        return cls.created_by == user_id

    stmt8 = select(SalesInvoice).options(with_loader_criteria(
        SalesInvoice,
        make_criteria
    ))
    print(compile_query(stmt8))

if __name__ == "__main__":
    main()
