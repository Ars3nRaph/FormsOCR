import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Ensure data dir exists and keep DB in data/ for volume persistence
os.makedirs("./data", exist_ok=True)
SQLALCHEMY_DATABASE_URL = "sqlite:///./data/app.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
