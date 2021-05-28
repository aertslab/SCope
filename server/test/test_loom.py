import loompy as lp
import numpy as np
import pandas as pd
import pytest
import os

from pathlib import Path
from numpy.random import Generator, PCG64

from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils.loom_file_handler import LoomFileHandler
from scopeserver.gen_test_loom import generate_test_loom_data

LOOM_FILE_HANDLER = LoomFileHandler()

rg = Generator(PCG64(55850))

LOOM_PATH = Path("test/data/SCope_Test.loom")


@pytest.fixture
def matrix():
    num_genes = 100
    # Must be divisible by 4
    num_cells = 100

    genes = rg.poisson(lam=1, size=num_genes)
    genes = [x + 1 for x in genes]
    matrix = rg.poisson(lam=genes, size=(num_cells, num_genes))
    return matrix


@pytest.fixture
def loom_file():
    if os.path.isfile("test/data/SCope_Test.loom"):
        os.remove("test/data/SCope_Test.loom")
    if os.path.isfile("test/data/SCope_Test.ss_pkl"):
        os.remove("test/data/SCope_Test.ss_pkl")
    return generate_test_loom_data()


def test_get_connection(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file
    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        assert test_loom.get_connection() == ds


def test_get_file_path(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file
    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        assert test_loom.get_file_path() == LOOM_PATH


def test_get_abs_file_path(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file
    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        assert test_loom.get_abs_file_path() == LOOM_PATH


def test_get_global_attribute_by_name(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file
    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        assert test_loom.get_global_attribute_by_name("Genome") == "Nomen dubium"


def test_get_cell_ids(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file
    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        num_cells = ds.shape[1]
        assert (test_loom.get_cell_ids() == np.array([f"Cell_{n}" for n in range(1, num_cells + 1)])).all()


def test_get_gene_names(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file
    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        assert test_loom.get_gene_names() == {}


def test_get_meta_data_cluster_by_clustering_id_and_cluster_id(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file
    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        assert (
            test_loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(0, 0)["description"]
            == "Unannotated Cluster 1"
        )


def test_infer_species(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file
    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        assert test_loom.infer_species() == ("Unknown", {})


def test_has_motif_and_track_regulons(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file
    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        assert test_loom.has_motif_and_track_regulons() == True


def test_get_coordinates(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file

    # POC for custom data in the loom file.
    num_cells = 100
    _X = np.concatenate([rg.normal(n, 0.1, int(num_cells / 4)) for n in range(-2, 2)])
    _Y = rg.normal(0, 0.1, num_cells)
    main_embedding = pd.DataFrame(columns=["_X", "_Y"])
    main_embedding["_X"] = _X
    main_embedding["_Y"] = _Y
    col_attrs["Embedding"] = Loom.dfToNamedMatrix(main_embedding)

    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)

    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        np.testing.assert_equal(
            test_loom.get_coordinates(-1), {"x": _X, "y": -_Y, "cellIndices": list(range(num_cells))}
        )


def get_gene_expression(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file
    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        np.testing.assert_equal(test_loom.get_gene_expression("Gene_1", True, False), np.log1p(matrix[0]))
        np.testing.assert_equal(test_loom.get_gene_expression("Gene_100", False, False), matrix[99])
