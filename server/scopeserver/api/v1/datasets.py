" API endpoints dealing with datasets. "

from pathlib import Path
import pickle
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from scopeserver import crud, models
from scopeserver.api import deps
from scopeserver.dataserver.utils.loom_file_handler import LoomFileHandler
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("/{dataset_id}/coordinates", summary="Get coordinates from a dataset")
async def coordinates(
    dataset_id: int,
    coordinates_id: int = -1,
    filters: Optional[List[str]] = Query([]),
    combinator: Optional[Literal["AND", "OR"]] = "OR",
    data_format: Optional[Literal["binary_loom", "binary_scipy_sparse_matrix"]] = "binary_loom",
    database: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    lfh: LoomFileHandler = Depends(deps.lfh),
):
    "Retrieve coordinates from a dataset"

    if (found_data := crud.get_binary_data(database, dataset_id)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No dataset with id {dataset_id} exists.")

    if not crud.is_admin(current_user) and not crud.user_has_access_to_dataset(database, current_user, found_data):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You have no access to this data")

    loom = found_data.load_loom_file(lfh)

    if filters is not None and len(filters) > 0:
        # TODO: find a way to properly pass key-value pairs for annotation filters
        # A possible solution: api/v1/dataset/1/coordinates?filter=Gender!$!Male&CellType!$!Tcell
        # !$! is the separator for key and value. Multiple key value pairs can be passed by having mulitple 'filter' parameters in the query string
        #
        # You could also try to pass the cell indices from the client (by e.g doing a seperate API call first to convert annotations -> indices)
        # This approach could easily result in a very long URL, which might exceed the max of some browsers.
        # This could work if we used a POST request instead, but this feels wrong for GETting data...
        annotations = None
    else:
        annotations = None

    coordinates = loom.get_coordinates(coordinatesID=coordinates_id, annotation=annotations, logic=combinator)

    return {"x": coordinates["x"].tolist(), "y": coordinates["y"].tolist(), "cellIndices": coordinates["cellIndices"]}


@router.get("/{dataset_id}/expression", summary="Get gene expression")
async def expression(
    dataset_id: int,
    gene_symbol: str,
    filters: Optional[List[str]] = Query([]),
    log_transform: bool = False,
    cpm_normalise: bool = False,
    combinator: Optional[Literal["AND", "OR"]] = "OR",
    data_format: Optional[
        Literal["loom", "pickled_scipy_sparse_matrix", "coo", "compressed_coo", "h5", "h5_csr", "pq"]
    ] = "loom",
    database: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    lfh: LoomFileHandler = Depends(deps.lfh),
):
    "Retrieve gene expression from a dataset"

    if (found_data := crud.get_binary_data(database, dataset_id, data_format)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No dataset with id {dataset_id} exists.")

    if not crud.is_admin(current_user) and not crud.user_has_access_to_dataset(database, current_user, found_data):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You have no access to this data")

    # All data formats should have a way to find the index of a gene. For now we hardcode a random index
    gene_index = 36

    if data_format == "loom":
        if (loom := found_data.load_loom_file(lfh)) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Failed to load loom file for dataset {dataset_id}"
            )

        return loom.get_gene_expression(
            gene_symbol, log_transform, cpm_normalise, annotation=None, logic=combinator
        ).tolist()
    elif data_format == "pickled_scipy_sparse_matrix":
        if (matrix := found_data.load_scipy_sparse_matrix()) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Failed to load scipy sparse matrix for dataset {dataset_id} and data id {found_data.id}",
            )
        return matrix.getrow(gene_index).toarray()[0].tolist()
    elif data_format == "coo":
        if (matrix := found_data.load_coo()) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Failed to load coo data for dataset {dataset_id} and data id {found_data.id}",
            )

        return matrix.getrow(gene_index).toarray()[0].tolist()
    elif data_format == "compressed_coo":
        if (matrix := found_data.load_compressed_coo()) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Failed to load compressed coo data for dataset {dataset_id} and data id {found_data.id}",
            )
        return matrix.getrow(gene_index).toarray()[0].tolist()
    elif data_format == "h5":
        if (matrix := found_data.load_h5()) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Failed to load h5 data for dataset {dataset_id} and data id {found_data.id}",
            )
        return matrix.getrow(gene_index).toarray()[0].tolist()
    elif data_format == "h5_csr":
        if (matrix := found_data.load_h5_csr()) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Failed to load h5 csr data for dataset {dataset_id} and data id {found_data.id}",
            )
        return matrix.getrow(gene_index).toarray()[0].tolist()
    elif data_format == "pq":
        if (matrix := found_data.load_pq()) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Failed to load pq data for dataset {dataset_id} and data id {found_data.id}",
            )
        return matrix.getrow(gene_index).toarray()[0].tolist()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid data format {data_format} specified"
        )


@router.get("/{dataset_id}/genes", summary="Get available genes")
async def genes(
    dataset_id: int,
    data_format: Optional[Literal["loom", "pickled_scipy_sparse_matrix"]] = "loom",
    database: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    lfh: LoomFileHandler = Depends(deps.lfh),
):
    "Get all available genes in the dataset"

    if (found_data := crud.get_binary_data(database, dataset_id)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No dataset with id {dataset_id} exists.")

    if not crud.is_admin(current_user) and not crud.user_has_access_to_dataset(database, current_user, found_data):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You have no access to this data")

    loom = found_data.load_loom_file(lfh)

    return loom.get_genes().tolist()
