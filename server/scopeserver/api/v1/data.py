" TODO: THIS IS A TEMPORARY HACK JOB "

from typing import List
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import loompy as lp

from scopeserver import crud, schemas
from scopeserver.api import deps
from scopeserver.config import settings

router = APIRouter()


@router.get("/dataset", response_model=List[schemas.Coordinate])
def get_dataset(
    *,
    database: Session = Depends(deps.get_db),
    project: str,
    dataset: int,
):
    entry = crud.get_dataset(database, dataset)

    if entry is not None:
        with lp.connect(settings.DATA_PATH / Path(project) / Path(entry.filename), validate=False) as ds:
            xs = [_x[0] for _x in ds.ca.Embeddings_X]
            ys = [_y[0] for _y in ds.ca.Embeddings_Y]

            return [schemas.Coordinate(x=X, y=Y) for X, Y in zip(xs, ys)]

    return []
