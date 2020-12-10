import loompy as lp
import numpy as np

from pathlib import Path
from numpy.random import Generator, PCG64

from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils.loom_file_handler import LoomFileHandler

TEST_LOOM = Path("test") / Path("data") / Path("SCope_Test.loom")
TEST_CONNECTION = lp.connect(TEST_LOOM, "r", validate=False)
LOOM_FILE_HANDLER = LoomFileHandler()

rg = Generator(PCG64(55850))

num_genes = 100
num_regulons = 4
# Must be divisible by 4
num_cells = 100

genes = rg.poisson(lam=1, size=num_genes)
genes = [x + 1 for x in genes]
matrix = rg.poisson(lam=genes, size=(num_cells, num_genes))


def test_get_connection():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert test_loom.get_connection() == TEST_CONNECTION


def test_get_file_path():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert test_loom.get_file_path() == TEST_LOOM


def test_get_abs_file_path():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert test_loom.get_abs_file_path() == TEST_LOOM


def test_get_global_attribute_by_name():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert test_loom.get_global_attribute_by_name("Genome") == "Nomen dubium"


def test_get_cell_ids():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    num_cells = TEST_CONNECTION.shape[1]
    assert (test_loom.get_cell_ids() == np.array([f"Cell_{n}" for n in range(1, num_cells + 1)])).all()


def test_get_gene_names():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert test_loom.get_gene_names() == {}


def test_get_meta_data_cluster_by_clustering_id_and_cluster_id():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert (
        test_loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(0, 0)["description"] == "Unannotated Cluster 1"
    )


def test_infer_species():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert test_loom.infer_species() == ("Unknown", {})


def test_has_motif_and_track_regulons():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert test_loom.has_motif_and_track_regulons() == True


def test_get_coordinates():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    _X = np.concatenate([rg.normal(n, 0.1, int(num_cells / 4)) for n in range(-2, 2)])
    _Y = rg.normal(0, 0.1, num_cells)
    np.testing.assert_equal(test_loom.get_coordinates(-1), {"x": _X, "y": -_Y, "cellIndices": list(range(num_cells))})


def get_gene_expression():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    np.testing.assert_equal(test_loom.get_gene_expression("Gene_1", True, False), np.log1p(matrix[0]))
    np.testing.assert_equal(test_loom.get_gene_expression("Gene_100", False, False), matrix[99])
