
from pydantic import BaseModel, Field
from typing import Optional

class MovementCommand(BaseModel):
    direction: str = Field(..., description="이동 방향 (forward, backward, left, right, stop)")
    speed: int = Field(50, ge=0, le=100, description="속도 (0-100)")

class RobotStatus(BaseModel):
    robot_id: str
    status: str
    battery_level: Optional[int] = None
    connected: bool = True
