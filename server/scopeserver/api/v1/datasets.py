" API endpoints dealing with datasets. "

from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from scopeserver import crud, schemas
from scopeserver.api import deps
from scopeserver.dataserver.utils.loom_file_handler import LoomFileHandler
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/{dataset_id}/coordinates", summary="Get coordinates from a dataset", response_model=schemas.Coordinates)
async def coordinates(
    dataset_id: int,
    coordinates_id: int = -1,
    filters: Optional[List[str]] = Query([]),
    combinator: Optional[Literal['AND', 'OR']] = 'OR',
    database: Session = Depends(deps.get_db),
    lfh: LoomFileHandler = Depends(deps.lfh),
):
    "Retrieve coordinates from a dataset"

    if (found_dataset := crud.get_dataset(database, dataset_id)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"No dataset with id {dataset_id} exists.")

    try:
        loom = lfh.get_loom(loom_file_path=Path(found_dataset.filename))
    except:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Failed to get loom file for dataset with id {dataset_id}")

    if filters is not None and len(filters) > 0:
        #TODO: find a way to properly pass key-value pairs for annotation filters
        # A possible solution: api/v1/dataset/1/coordinates?filter=Gender!$!Male&CellType!$!Tcell
        # !$! is the separator for key and value. Multiple key value pairs can be passed by having mulitple 'filter' parameters in the query string
        # 
        # You could also try to pass the cell indices from the client (by e.g doing a seperate API call first to convert annotations -> indices)
        # This approach could easily result in a very long URL, which might exceed the max of some browsers.
        # This could work if we used a POST request instead, but this feels wrong for GETting data...
        annotations = None
    else:
        annotations = None

    return loom.get_coordinates(coordinatesID=coordinates_id, annotation=annotations, logic=combinator, to_list=True)
