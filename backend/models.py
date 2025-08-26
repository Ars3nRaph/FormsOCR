from pydantic import BaseModel, Field
from typing import List, Optional
class ROI(BaseModel):
    name: str
    x: float; y: float; w: float; h: float
    type: str = Field(default='text')
    pattern: Optional[str] = None
class Workspace(BaseModel):
    x: int; y: int; w: int; h: int
class Layout(BaseModel):
    workspace: Workspace
    rois: List[ROI]
