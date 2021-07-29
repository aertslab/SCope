"Test the mechanism for labeling features for display on the client."

import pytest

from hypothesis import given, settings, HealthCheck

import numpy as np


from scopeserver.dataserver.utils.labels import label_all_clusters, label_annotation, FeatureLabel, Coordinate
from scopeserver.dataserver.utils import constant

from .generate import loom_data_strategy, loom_generator


@settings(deadline=1000, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], max_examples=10)
@given(data=loom_data_strategy())
def test_label_annotation(data):
    "Test that labels are generated for each annotation value."
    with loom_generator(data) as loom:
        full_observed = [
            label_annotation(loom, -1, anno["name"]) for anno in loom.get_meta_data_by_key(key="annotations")
        ]

        full_expected = [
            [
                FeatureLabel(
                    label=value,
                    colour=constant.BIG_COLOR_LIST[i + j],
                    coordinate=Coordinate(
                        x=np.mean(data.annotations[annotation]["coordinates"][value]["_X"]),
                        y=-np.mean(data.annotations[annotation]["coordinates"][value]["_Y"]),
                    ),
                )
                for j, value in enumerate(data.annotations[annotation]["values"])
            ]
            for i, annotation in enumerate(data.annotations)
        ]

        for _observed, _expexted in zip(full_observed, full_expected):
            for observed, expected in zip(_observed, _expexted):
                assert observed.label == expected.label
                assert observed.colour == expected.colour
                assert observed.coordinate.x == pytest.approx(expected.coordinate.x, nan_ok=True)
                assert observed.coordinate.y == pytest.approx(expected.coordinate.y, nan_ok=True)


@settings(deadline=1000, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], max_examples=10)
@given(data=loom_data_strategy())
def test_label_all_clusters(data):
    "Test that labels are generated for each cluster in a clustering."
    with loom_generator(data) as loom:
        for clustering_meta in data.clusterings.metadata["clusterings"]:
            cluster_names = {meta["id"]: meta["description"] for meta in clustering_meta["clusters"]}
            labels = []
            for cluster_id, cluster in cluster_names.items():
                coords = loom.get_coordinates(-1, cluster_info=(clustering_meta["id"], cluster_id))
                cluster_coords = Coordinate(np.mean(coords["x"]), y=np.mean(coords["y"]))
                colour = constant.BIG_COLOR_LIST[cluster_id % len(constant.BIG_COLOR_LIST)]
                labels.append(FeatureLabel(label=cluster, colour=colour, coordinate=cluster_coords))

            _observed = sorted(label_all_clusters(loom, -1, clustering_meta["name"]))
            for observed, expected in zip(_observed, sorted(labels)):
                assert observed.label == expected.label
                assert observed.colour == expected.colour
                assert observed.coordinate.x == pytest.approx(expected.coordinate.x, nan_ok=True)
                assert observed.coordinate.y == pytest.approx(expected.coordinate.y, nan_ok=True)
