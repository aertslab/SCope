" TODO: THIS IS A TEMPORARY HACK JOB "

from typing import List
from pathlib import Path
import shutil

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

import loompy as lp

from scopeserver import crud, models, schemas
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
        print(ds.ca.Embeddings_X[0][0])
        x = [_x[0] for _x in ds.ca.Embeddings_X]
        y = [_y[0] for _y in ds.ca.Embeddings_Y]
    print(x[:5])
    print(y[:5])
    print([(X, Y) for X, Y in zip(x, y)][:5])

    return [schemas.Coordinate(x=X, y=Y) for X, Y in zip(x, y)]
