from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ROI(BaseModel):
    name: str
    x: float; y: float; w: float; h: float
    type: str = Field(default="text")
    pattern: Optional[str] = None

class Workspace(BaseModel):
    x: int; y: int; w: int; h: int

class Layout(BaseModel):
    workspace: Workspace
    rois: List[ROI]

class UserCreate(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class MeResponse(BaseModel):
    email: str
    plan: str
    month: str
    docs_processed: int
    limits: Dict[str, Any]
