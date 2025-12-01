from pydantic import BaseModel
from typing import Optional


# ----------------------------------------------------------------------
# DTOs
# ----------------------------------------------------------------------
class CalendarEventDTO(BaseModel):
    subject: str
    start: str  # ISO datetime
    end: str    # ISO datetime
    body: Optional[str] = None