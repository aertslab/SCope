""" Test the Loom API. """

from hypothesis import given, settings, HealthCheck

import numpy as np

from .generate import loom_data_strategy, loom_generator


@settings(deadline=1000, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], max_examples=10)
@given(data=loom_data_strategy())
def test_get_global_attribute(data):
    "Check that global attributes are set correctly and accessible."
    with loom_generator(data) as loom:
        assert loom.get_global_attribute_by_name("title") == data.name
        assert loom.get_global_attribute_by_name("Genome") == "Nomen dubium"
        assert loom.get_global_attribute_by_name("SCopeTreeL1") == data.name


@settings(deadline=1000, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], max_examples=10)
@given(data=loom_data_strategy())
def test_get_cell_ids(data):
    "Check that cell ids have been set correctly."
    with loom_generator(data) as loom:
        assert (loom.get_cell_ids() == np.array([f"Cell_{n}" for n in range(1, data.n_cells + 1)])).all()


@settings(deadline=1000, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], max_examples=10)
@given(data=loom_data_strategy())
def test_at_least_one_cluster_foreach_clustering(data):
    """Check that there is at least 1 cluster for each clustering
    and that the descriptions match.
    """
    with loom_generator(data) as loom:
        for clustering in data.clusterings.metadata["clusterings"]:
            assert len(clustering["clusters"]) > 0
            for cluster in clustering["clusters"]:
                assert (
                    loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(clustering["id"], cluster["id"])[
                        "description"
                    ]
                    == cluster["description"]
                )


@settings(deadline=1000, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], max_examples=10)
@given(data=loom_data_strategy())
def test_has_motif_and_track_regulons(data):
    "Check that regulons are set."
    with loom_generator(data) as loom:
        assert loom.has_motif_and_track_regulons() or loom.has_legacy_regulons()


@settings(deadline=1000, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], max_examples=10)
@given(data=loom_data_strategy())
def test_get_coordinates_length(data):
    "Check that the number of coordinates matches the generated coordinates."
    with loom_generator(data) as loom:
        assert len(loom.get_coordinates(-1)["x"]) == data.n_cells
        assert len(loom.get_coordinates(-1)["x"]) == len(loom.get_coordinates(-1)["y"])


@settings(deadline=1000, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], max_examples=10)
@given(data=loom_data_strategy())
def test_correct_cell_indices(data):
    "Check that the cell indexes are as expected."
    with loom_generator(data) as loom:
        assert loom.get_coordinates(-1)["cellIndices"] == list(range(data.n_cells))


@settings(deadline=1000, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], max_examples=10)
@given(data=loom_data_strategy())
def test_get_coordinates_x(data):
    "Check that x coordinates match generated coordinates."
    with loom_generator(data) as loom:
        np.testing.assert_equal(loom.get_coordinates(-1)["x"], data.embeddings.column_attributes["Embedding"]["_X"])


@settings(deadline=1000, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], max_examples=10)
@given(data=loom_data_strategy())
def test_get_coordinates_y(data):
    "Check that y coordinates match generated coordinates."
    with loom_generator(data) as loom:
        np.testing.assert_equal(loom.get_coordinates(-1)["y"], -data.embeddings.column_attributes["Embedding"]["_Y"])


@settings(deadline=1000, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], max_examples=10)
@given(data=loom_data_strategy())
def test_get_gene_expression(data):
    "Check that the gene expression matrix is accessable as expected."
    with loom_generator(data) as loom:
        for idx in range(data.n_genes):
            np.testing.assert_equal(loom.get_gene_expression(f"Gene_{idx+1}", False, False), data.matrix[idx])
