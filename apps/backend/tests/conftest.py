import os

test_database_url = os.getenv("TEST_DATABASE_URL", "sqlite:///./test.db")
if test_database_url.startswith("postgresql") and "_test" not in test_database_url:
    raise RuntimeError("TEST_DATABASE_URL must point to a disposable database containing '_test'")
os.environ["DATABASE_URL"] = test_database_url
os.environ["JWT_SECRET_KEY"] = "test-secret"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import get_db
from app.main import app
from app.db.metadata import Base

engine_kwargs = {"connect_args": {"check_same_thread": False}} if test_database_url.startswith("sqlite") else {}
engine = create_engine(test_database_url, **engine_kwargs)
TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db():
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()
    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
