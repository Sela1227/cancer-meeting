from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class PriorityEnum(str, enum.Enum):
    high   = "高"
    medium = "中"
    low    = "低"

class StatusEnum(str, enum.Enum):
    not_started = "未開始"
    in_progress = "進行中"
    blocked     = "卡關"
    done        = "完成"

class Meeting(Base):
    __tablename__ = "meetings"
    id         = Column(Integer, primary_key=True)
    title      = Column(String(200), nullable=False)
    date       = Column(Date, nullable=False)
    session_no = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    tasks      = relationship("Task", back_populates="meeting", cascade="all, delete")
    agendas    = relationship("Agenda", back_populates="meeting", cascade="all, delete")

class Unit(Base):
    __tablename__ = "units"
    id        = Column(Integer, primary_key=True)
    name      = Column(String(100), nullable=False, unique=True)
    headcount = Column(Integer, default=0)
    available = Column(Integer, default=0)
    note      = Column(Text, default="")
    campus    = Column(String(20), default="")  # 彰秀 / 彰濱 / 兩院
    members   = relationship("Member", back_populates="unit")
    tasks     = relationship("Task", back_populates="unit")

class Member(Base):
    __tablename__ = "members"
    id        = Column(Integer, primary_key=True)
    name      = Column(String(100), nullable=False)
    email     = Column(String(200), unique=True, nullable=True)
    unit_id   = Column(Integer, ForeignKey("units.id"), nullable=True)
    seniority = Column(Integer, default=0)
    role_type = Column(String(100), default="")
    unit      = relationship("Unit", back_populates="members")
    owned     = relationship("Task", foreign_keys="Task.owner_id", back_populates="owner")
    assisted  = relationship("Task", foreign_keys="Task.assistant_id", back_populates="assistant")
    comments  = relationship("Comment", back_populates="author")

class Task(Base):
    __tablename__ = "tasks"
    id               = Column(Integer, primary_key=True)
    title            = Column(String(300), nullable=False)
    description      = Column(Text, default="")
    meeting_id       = Column(Integer, ForeignKey("meetings.id"), nullable=True)
    unit_id          = Column(Integer, ForeignKey("units.id"), nullable=True)
    owner_id         = Column(Integer, ForeignKey("members.id"), nullable=True)
    assistant_id     = Column(Integer, ForeignKey("members.id"), nullable=True)
    due_date         = Column(Date, nullable=True)
    priority         = Column(Enum(PriorityEnum), default=PriorityEnum.medium)
    status           = Column(Enum(StatusEnum), default=StatusEnum.not_started)
    blocked_reason   = Column(Text, default="")
    manpower_needed  = Column(Integer, default=0)
    manpower_current = Column(Integer, default=0)
    progress_pct     = Column(Integer, default=0)   # 0-100 進度百分比
    progress_note    = Column(Text, default="")     # 責任人回報說明
    agenda_id        = Column(Integer, ForeignKey("agendas.id"), nullable=True)
    depends_on_id    = Column(Integer, ForeignKey("tasks.id"), nullable=True)  # 前置任務
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    meeting   = relationship("Meeting", back_populates="tasks")
    unit      = relationship("Unit", back_populates="tasks")
    owner     = relationship("Member", foreign_keys=[owner_id], back_populates="owned")
    assistant = relationship("Member", foreign_keys=[assistant_id], back_populates="assisted")
    comments   = relationship("Comment", back_populates="task", cascade="all, delete")
    agenda     = relationship("Agenda", foreign_keys=[agenda_id], back_populates="tasks")
    depends_on = relationship("Task", foreign_keys=[depends_on_id], remote_side="Task.id")

class Comment(Base):
    __tablename__ = "comments"
    id         = Column(Integer, primary_key=True)
    task_id    = Column(Integer, ForeignKey("tasks.id"))
    author_id  = Column(Integer, ForeignKey("members.id"), nullable=True)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    task       = relationship("Task", back_populates="comments")
    author     = relationship("Member", back_populates="comments")

class Agenda(Base):
    __tablename__ = "agendas"
    id          = Column(Integer, primary_key=True)
    meeting_id  = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    title       = Column(String(200), nullable=False)
    order_no    = Column(Integer, default=1)
    note        = Column(Text, default="")
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    meeting = relationship("Meeting", back_populates="agendas")
    tasks   = relationship("Task", back_populates="agenda", foreign_keys="Task.agenda_id")
