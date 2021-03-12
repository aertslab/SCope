from pydantic import BaseModel
from typing import List, Any, Optional


#############
# Data      #
#############


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
    loomFilePath: str
    loomDisplayName: str
    loomSize: int
    cellMetaData: LoomXMetadata
    fileMetaData: Any
    loomHierarchy: LoomXHierarchy


#############
# Endpoints #
#############


class GetDatasets(BaseModel):
    error: Optional[Error]
    datasets: List[Dataset]
    update: bool


class GetRemainingUUIDTime(BaseModel):
    error: Optional[Error]
    UUID: str
    timeRemaining: int
    sessionsLimitReached: bool
    sessionMode: str
