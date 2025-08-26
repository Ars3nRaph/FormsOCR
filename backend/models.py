from pydantic import BaseModel, Field
from typing import List, Optional

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

class ProjectConfig(BaseModel):
    name: str
    template_path: Optional[str] = None
    template_pdf: Optional[str] = None
    template_pdf_page: Optional[int] = None
    template_width: Optional[int] = None
    template_height: Optional[int] = None
    layout: Optional[Layout] = None
