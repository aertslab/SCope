import loompy as lp
import numpy as np
from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils.loom_file_handler import LoomFileHandler
from pathlib import Path

TEST_LOOM = Path("test") / Path("data") / Path("SCope_Test.loom")
TEST_CONNECTION = lp.connect(TEST_LOOM, 'r', validate=False)
LOOM_FILE_HANDLER = LoomFileHandler()


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
    assert test_loom.get_global_attribute_by_name('Genome') == 'Nomen dubium'

def test_get_cell_ids():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    num_cells = TEST_CONNECTION.shape[1]
    assert (test_loom.get_cell_ids() == np.array([f'Cell_{n}' for n in range(1, num_cells + 1)])).all()

def test_get_gene_names():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert test_loom.get_gene_names() == {}

def test_get_meta_data_cluster_by_clustering_id_and_cluster_id():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert test_loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(0, 0)['description'] == 'Unannotated Cluster 1'

def test_infer_species():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert test_loom.infer_species() == ("Unknown", {})

def test_has_motif_and_track_regulons():
    test_loom = Loom(TEST_LOOM, TEST_LOOM, TEST_CONNECTION, LOOM_FILE_HANDLER)
    assert test_loom.has_motif_and_track_regulons() == True
   
