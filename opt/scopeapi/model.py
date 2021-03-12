from pydantic import BaseModel
from typing import List, Any, Optional


class Error(BaseModel):
    code: int
    message: str


class LoomXHierarchy(BaseModel):
    L1: str
    L2: str
    L3: str


class LoomXMetadata(BaseModel):
    annotations: Any
    embeddings: Any
    clusterings: Any


class Dataset(BaseModel):
    loom_file_path: str
    loom_display_name: str
    loom_size: int
    cell_metadata: LoomXMetadata
    file_metadata: Any
    loom_hierarchy: LoomXHierarchy


#############
# Endpoints #
#############


class GetDatasets(BaseModel):
    error: Optional[Error] = None
    datasets: List[Dataset]
    update: bool
