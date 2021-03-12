from pydantic import BaseModel
from typing import List, Any


class LoomXHierarchy(BaseModel):
    l1: str
    l2: str
    l3: str


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
    datasets: List[Dataset]
    update: bool
