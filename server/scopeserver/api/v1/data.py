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
    dataset: int,
):
    entry = crud.get_dataset(database, dataset)

    with lp.connect(
        settings.DATA_PATH / "c9ef0a31-a7cd-4d04-a73f-2575babf7e30" / Path(entry.filename), validate=False
    ) as ds:
        xs = [_x[0] for _x in ds.ca.Embeddings_X]
        ys = [_y[0] for _y in ds.ca.Embeddings_Y]

    return [schemas.Coordinate(x=X, y=Y) for X, Y in zip(xs, ys)]
