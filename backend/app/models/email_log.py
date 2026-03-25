"""
Email log model — tracks all email communications with candidates.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base


class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)

    direction = Column(SQLEnum("OUTBOUND", "INBOUND", name="email_direction"), nullable=False)
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=False)
    from_email = Column(String(255), nullable=False)
    to_email = Column(String(255), nullable=False)
    ai_generated = Column(Boolean, nullable=False, default=False)
    message_id = Column(String(255), nullable=True)  # Email Message-ID header for threading
    conversation_id = Column(String(255), nullable=True) # Outlook Conversation ID

    sent_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    application = relationship("Application", back_populates="email_logs")
