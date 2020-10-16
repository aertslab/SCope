from sqlalchemy import Column, Integer, String
from sqlalchemy.types import Date
from scopeserver.database import Base


class Test(Base):
    __tablename__ = "test"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date)
