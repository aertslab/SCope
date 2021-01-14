import loompy as lp
import numpy as np
import pandas as pd
import json
import pytest
import os

from pathlib import Path
from numpy.random import Generator, PCG64

from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils.loom_file_handler import LoomFileHandler
from scopeserver.gen_test_loom import generate_test_loom_data
from scopeserver.dataserver.utils.labels import label_all_clusters, label_annotation, FeatureLabel, Coordinate
from scopeserver.dataserver.utils.annotation import Annotation
from scopeserver.dataserver.utils import constant
from scopeserver.dataserver.utils.data import uniq


LOOM_FILE_HANDLER = LoomFileHandler()

rg = Generator(PCG64(55850))

LOOM_PATH = Path("test/data/SCope_Test.loom")


@pytest.fixture
def loom_file():
    if os.path.isfile("test/data/SCope_Test.loom"):
        os.remove("test/data/SCope_Test.loom")
    if os.path.isfile("test/data/SCope_Test.ss_pkl"):
        os.remove("test/data/SCope_Test.ss_pkl")
    return generate_test_loom_data()


def test_label_annotation(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file

    annotation = [f"Annotation {x % 5}" for x in range(100)]
    col_attrs["Test_Anno"] = annotation
    meta = json.loads(attrs["MetaData"])
    anno_vals = sorted(list(set(col_attrs["Test_Anno"])))
    meta["annotations"].append({"name": "Test_Anno", "values": anno_vals})
    attrs["MetaData"] = json.dumps(meta)

    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        coords = test_loom.get_coordinates(-1, annotation=[Annotation(name="Test_Anno", values=[anno_vals[0]])])
        anno_coords = Coordinate(np.mean(coords["x"]), y=np.mean(coords["y"]))
        colour = constant.BIG_COLOR_LIST[0]
        assert label_annotation(test_loom, -1, "Test_Anno")[0] == FeatureLabel(
            label=anno_vals[0], colour=colour, coordinate=anno_coords
        )


def test_label_all_clusters(loom_file):
    matrix, row_attrs, col_attrs, attrs = loom_file
    lp.create(filename=str(LOOM_PATH), layers=matrix, row_attrs=row_attrs, col_attrs=col_attrs, file_attrs=attrs)
    with lp.connect(LOOM_PATH, mode="r", validate=False) as ds:
        test_loom = Loom(LOOM_PATH, LOOM_PATH, ds, LOOM_FILE_HANDLER)
        clustering_meta = test_loom.get_meta_data_clustering_by_id(0)
        cluster_names = test_loom.get_cluster_names(0)
        labels = []
        for cluster_id, cluster in cluster_names.items():
            print(cluster, cluster_id)
            coords = test_loom.get_coordinates(-1, cluster_info=(0, cluster_id))
            cluster_coords = Coordinate(np.mean(coords["x"]), y=np.mean(coords["y"]))
            colour = constant.BIG_COLOR_LIST[cluster_id]
            labels.append(FeatureLabel(label=cluster, colour=colour, coordinate=cluster_coords))

        print(labels)
        assert sorted(label_all_clusters(test_loom, -1, clustering_meta["name"])) == sorted(labels)
