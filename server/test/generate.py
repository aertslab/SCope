""" Fixtures for generating data in Loom formatted files. """
from typing import Any, Dict, List, Text, Tuple, Union
from enum import Enum
from functools import partial
import json
import pickle
import os
from pathlib import Path
from tempfile import mkdtemp, mkstemp
from contextlib import contextmanager
import traceback

from typing_extensions import Literal

import hypothesis.strategies as st
import hypothesis.extra.numpy

import numpy as np
import loompy


from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils.loom_file_handler import LoomFileHandler

LARGEST: int = 64


class LoomFeatureLabel(Enum):
    "Label for LoomFeature objects."
    REGULON = 0
    CLUSTERING = 1
    EMBEDDING = 2


class LoomFeature:
    "Collects generated data for features such as regulons and embeddings."
    label: LoomFeatureLabel
    metadata: Dict[Text, Union[List[Dict[Text, Any]], Dict[Text, int]]] = {}
    column_attributes: Dict[Text, np.ndarray] = {}
    row_attributes: Dict[Text, np.ndarray] = {}

    def __init__(self, label, metadata, column_attributes, row_attributes) -> None:
        self.label = label
        self.metadata = metadata
        self.column_attributes = column_attributes
        self.row_attributes = row_attributes

    def __repr__(self) -> str:
        return f"LoomFeature({self.label}):\n{self.column_attributes}\n{self.row_attributes}\n{self.metadata}"


def regulons_attr_strategy(
    which: Union[Literal["Motif"], Literal["Track"], Literal[""]], num_genes: int, num_regulons: int
):
    "Generate regulon attributes."
    dtypes = [(f"{which}Regulon_{n}", np.int32) for n in range(1, num_regulons + 1)]
    element_strategies = [st.integers(min_value=0, max_value=1) for _ in range(num_regulons)]
    return hypothesis.extra.numpy.arrays(dtype=dtypes, shape=num_genes, elements=st.tuples(*element_strategies))


def regulons_auc_attr_strategy(
    which: Union[Literal["Motif"], Literal["Track"], Literal[""]], num_cells: int, num_regulons: int
):
    "Generate regulon AUC attributes."
    dtypes = [(f"{which}Regulon_{n}", np.float64) for n in range(1, num_regulons + 1)]
    element_strategies = [st.floats(min_value=0, max_value=1, exclude_max=True) for _ in range(num_regulons)]
    return hypothesis.extra.numpy.arrays(dtype=dtypes, shape=num_cells, elements=st.tuples(*element_strategies))


def regulons_occurences_strategy(which: Union[Literal["Motif"], Literal["Track"]], num_genes: int, num_regulons: int):
    "Generate regulon occurences."
    dtypes = [(f"{which}Regulon_{n}", np.int32) for n in range(1, num_regulons + 1)]
    element_strategies = [st.integers(min_value=0, max_value=LARGEST) for _ in range(num_regulons)]
    return hypothesis.extra.numpy.arrays(dtype=dtypes, shape=num_genes, elements=st.tuples(*element_strategies))


def regulons_column_attributes_strategy(num_cells: int, num_regulons: int):
    "Generate regulon column attributes."
    return st.fixed_dictionaries(
        {
            "MotifRegulonsAUC": regulons_auc_attr_strategy("Motif", num_cells, num_regulons),
            "TrackRegulonsAUC": regulons_auc_attr_strategy("Track", num_cells, num_regulons),
        }
    )


def regulons_row_attributes_strategy(num_genes: int, num_regulons: int):
    "Generate regulon row attributes."
    return st.fixed_dictionaries(
        {
            "MotifRegulons": regulons_attr_strategy("Motif", num_genes, num_regulons),
            "TrackRegulons": regulons_attr_strategy("Track", num_genes, num_regulons),
            "MotifRegulonGeneOccurrences": regulons_occurences_strategy("Motif", num_genes, num_regulons),
            "TrackRegulonGeneOccurrences": regulons_occurences_strategy("Track", num_genes, num_regulons),
        }
    )


def regulons_threshold_strategy(regulon: str):
    "Generate a regulon thresholda dictionary."
    return st.fixed_dictionaries(
        {
            "regulon": st.just(regulon),
            "defaultThresholdValue": st.floats(min_value=0, max_value=1, exclude_max=True),
            "defaultThresholdName": st.just("MeanScore"),
            "allThresholds": st.fixed_dictionaries(
                {
                    "MeanScore": st.floats(min_value=0, max_value=1, exclude_max=True),
                    "5thPercentile": st.floats(min_value=0, max_value=1, exclude_max=True),
                }
            ),
            "motifData": st.just(f"{regulon}.png"),
        }
    )


@st.composite
def regulons_thresholds_strategy(draw, num_regulons: int):
    "Generate a regulon threshold dictionary for each regulon."
    names = [f"MotifRegulon_{i}" for i in range(1, num_regulons + 1)] + [
        f"TrackRegulon_{i}" for i in range(1, num_regulons + 1)
    ]
    return [draw(regulons_threshold_strategy(regulon)) for regulon in names]


@st.composite
def regulons_legacy_thresholds_strategy(draw, num_regulons: int):
    "Generate a regulon threshold dictionary with old-style labels."
    names = [f"Regulon_{i}" for i in range(1, num_regulons + 1)]
    return [draw(regulons_threshold_strategy(regulon)) for regulon in names]


def regulons_new_strategy(num_genes: int, num_cells: int, num_regulons: int):
    "Generate regulon features in the new-style."
    return st.builds(
        LoomFeature,
        label=st.just(LoomFeatureLabel.REGULON),
        metadata=st.fixed_dictionaries(
            {
                "regulonThresholds": regulons_thresholds_strategy(num_regulons),
                "regulonSettings": st.fixed_dictionaries(
                    {
                        "min_genes_regulon": st.integers(min_value=0, max_value=LARGEST),
                        "min_regulon_gene_occurrence": st.integers(min_value=0, max_value=LARGEST),
                    }
                ),
            }
        ),
        column_attributes=regulons_column_attributes_strategy(num_cells, num_regulons),
        row_attributes=regulons_row_attributes_strategy(num_genes, num_regulons),
    )


def regulons_legacy_strategy(num_genes: int, num_cells: int, num_regulons: int):
    "Generate regulon features in the old-style."
    return st.builds(
        LoomFeature,
        label=st.just(LoomFeatureLabel.REGULON),
        metadata=st.fixed_dictionaries({"regulonThresholds": regulons_legacy_thresholds_strategy(num_regulons)}),
        column_attributes=st.fixed_dictionaries(
            {"RegulonsAUC": regulons_auc_attr_strategy("", num_cells, num_regulons)}
        ),
        row_attributes=st.fixed_dictionaries({"Regulons": regulons_attr_strategy("", num_genes, num_regulons)}),
    )


def regulons_strategy(num_genes: int, num_cells: int, num_regulons: int):
    "Generate regulon features."
    return st.one_of(
        regulons_legacy_strategy(num_genes, num_cells, num_regulons),
        regulons_new_strategy(num_genes, num_cells, num_regulons),
    )


def embeddings_column_attributes_strategy(num_cells: int):
    "Generate embedding column attributes."
    return st.fixed_dictionaries(
        {
            "Embedding": hypothesis.extra.numpy.arrays(
                dtype=[("_X", float), ("_Y", float)], shape=num_cells, elements=st.tuples(st.floats(), st.floats())
            ),
            "Embeddings_X": hypothesis.extra.numpy.arrays(
                dtype=[("1", float)], shape=num_cells, elements=st.tuples(st.floats())
            ),
            "Embeddings_Y": hypothesis.extra.numpy.arrays(
                dtype=[("1", float)], shape=num_cells, elements=st.tuples(st.floats())
            ),
        }
    )


@st.composite
def embeddings_strategy(draw, num_cells: int):
    "Generate Embedding features."
    names = (
        st.text(st.characters(max_codepoint=1000, blacklist_categories=("Cc", "Cs")), min_size=1)
        .map(lambda s: s.strip())
        .filter(lambda s: len(s) > 0)
    )

    return draw(
        st.builds(
            LoomFeature,
            label=st.just(LoomFeatureLabel.EMBEDDING),
            metadata=st.just({"Embeddings": [{"id": -1, "name": draw(names)}, {"id": 1, "name": draw(names)}]}),
            column_attributes=embeddings_column_attributes_strategy(num_cells),
            row_attributes=st.just({}),
        )
    )


class Clustering:
    "Organise data for a single clustering containing multiple clusters."
    identifier: int
    clusters: List[int]
    assignment: List[int]
    metadata: Dict[Text, Union[List[Dict[Text, Any]], Dict[Text, int]]]
    markers: np.ndarray
    metrics: np.ndarray

    def __init__(self, identifier, clusters, assignment, metadata, markers: Tuple[np.ndarray, np.ndarray]) -> None:
        self.identifier = identifier
        self.clusters = clusters
        self.assignment = assignment
        self.metadata = metadata
        self.markers = markers[0]
        self.metrics = self.init_metric(markers[1])

    def init_metric(self, metric: np.ndarray):
        "Apply the marker mask to metric."
        return np.array(
            [tuple(x * y for x, y in zip(mask, _metric)) for mask, _metric in zip(self.markers, metric)],
            dtype=metric.dtype,
        )

    def __repr__(self):
        return f(
            "Clustering(self.identifier={self.identifier}, "
            "self.clusters={self.clusters}, "
            "self.assignment={self.assignment})"
        )


def assign_cells_to_clusters(clusters: List[int], num_cells: int) -> List[int]:
    "Distribute cell ids into a list of len(clusters)."
    num_clusters = len(clusters)
    return [clusters[num_clusters * n // num_cells] for n in range(num_cells)]


def cluster_markers_strategy(clusters: List[int], num_genes: int):
    "Generate valid cluster markers."
    dtypes = [(str(c), np.int32) for c in clusters]
    metric_strategy = [st.integers(min_value=1, max_value=LARGEST) for _ in clusters]
    score = hypothesis.extra.numpy.arrays(dtype=dtypes, shape=num_genes, elements=st.tuples(*metric_strategy))
    mask = np.array(
        [tuple((clusters[gene % len(clusters)] == c) for c in clusters) for gene in range(num_genes)], dtype=dtypes
    )

    return st.tuples(st.just(mask), score)


@st.composite
def clustering_internal_strategy(draw, cluster_id: int, num_cells: int, num_genes: int):
    "Generate valid Clustering objects."
    clusters = draw(
        st.lists(
            st.integers(min_value=0, max_value=LARGEST), min_size=min(1, num_cells), max_size=num_cells, unique=True
        )
    )
    assignment = assign_cells_to_clusters(clusters, num_cells=num_cells)

    return draw(
        st.builds(
            Clustering,
            identifier=st.just(cluster_id),
            clusters=st.just(clusters),
            assignment=st.just(assignment),
            metadata=clustering_metadata_internal_strategy(cluster_id, clusters),
            markers=cluster_markers_strategy(clusters, num_genes),
        )
    )


@st.composite
def clusterings_internal_strategy(draw, clustering_ids: List[int], num_cells: int, num_genes: int):
    "Generate a list of valid Clustering objects."
    return [draw(clustering_internal_strategy(cid, num_cells, num_genes)) for cid in clustering_ids]


def cluster_metadata_strategy(cluster_id: int):
    "Generate metadata for a single cluster."
    return st.fixed_dictionaries(
        {
            "id": st.just(cluster_id),
            "description": st.text(st.characters(max_codepoint=1000, blacklist_categories=("Cc", "Cs")), min_size=1),
        }
    )


@st.composite
def clusters_metadata_strategy(draw, cluster_ids: List[int]):
    "Generate metadata for each cluster in a clustering."
    return [draw(cluster_metadata_strategy(cid)) for cid in cluster_ids]


def clustering_metadata_internal_strategy(identifier: int, clusters: List[int]):
    "Generate metadata for a single Clustering."
    names = (
        st.text(st.characters(max_codepoint=1000, blacklist_categories=("Cc", "Cs")), min_size=1)
        .map(lambda s: s.strip())
        .filter(lambda s: len(s) > 0)
    )

    return st.fixed_dictionaries(
        {
            "id": st.just(identifier),
            "group": names,
            "name": st.just(f"Cluster set {identifier}"),
            "clusters": st.just(clusters).flatmap(clusters_metadata_strategy),
            "clusterMarkerMetrics": st.fixed_dictionaries(
                {
                    "accessor": names,
                    "name": names,
                    "description": st.text(
                        st.characters(max_codepoint=1000, blacklist_categories=("Cc", "Cs")), min_size=1
                    ),
                }
            ).map(lambda metric: [metric]),
        }
    )


@st.composite
def clusterings_strategy(draw, num_cells: int, num_genes: int):
    "Generate valid clustering features."
    clustering_ids = st.lists(st.integers(min_value=0, max_value=LARGEST), min_size=1, max_size=LARGEST, unique=True)
    clusterings: List[Clustering] = draw(
        clustering_ids.flatmap(partial(clusterings_internal_strategy, num_cells=num_cells, num_genes=num_genes))
    )

    markers = {f"ClusterMarkers_{clustering.identifier}": st.just(clustering.markers) for clustering in clusterings}
    metrics = {
        f"ClusterMarkers_{clustering.identifier}_Test_Metric": st.just(clustering.metrics) for clustering in clusterings
    }

    return draw(
        st.builds(
            LoomFeature,
            label=st.just(LoomFeatureLabel.CLUSTERING),
            metadata=st.fixed_dictionaries(
                {"clusterings": st.just([clustering.metadata for clustering in clusterings])}
            ),
            column_attributes=st.fixed_dictionaries(
                {
                    "ClusterID": st.just(clusterings[0].assignment),
                    "Clusterings": st.just(
                        np.array(
                            list(zip(*[c.assignment for c in clusterings])),
                            dtype=np.dtype([(str(c.identifier), np.int32) for c in clusterings]),
                        )
                    ),
                }
            ),
            row_attributes=st.fixed_dictionaries({**markers, **metrics}),
        )
    )


def matrix_strategy(num_cells: int, num_genes: int):
    "Generate an expression matrix."
    return hypothesis.extra.numpy.arrays(
        dtype=np.int32, shape=(num_genes, num_cells), elements=st.integers(min_value=1, max_value=LARGEST)
    )


class LoomData:
    "Data required to build a valid Loom file."
    name: str
    matrix: np.ndarray
    n_genes: int
    n_cells: int
    n_regulons: int
    regulons: LoomFeature
    embeddings: LoomFeature
    clusterings: LoomFeature
    annotations: Dict[str, Dict[str, Any]]

    def __init__(
        self, name, matrix, n_genes, n_cells, n_regulons, regulons, embeddings, clusterings, annotations: List[str]
    ):
        self.name = name
        self.matrix = matrix
        self.n_genes = n_genes
        self.n_cells = n_cells
        self.n_regulons = n_regulons
        self.regulons = regulons
        self.embeddings = embeddings
        self.clusterings = clusterings
        self.annotations = self.generate_annotations(n_cells, annotations, embeddings.column_attributes["Embedding"])

    def generate_annotations(self, n_cells: int, values: List[str], coords: np.ndarray) -> Dict[str, Dict[str, Any]]:
        "Organise information for an annotation entry."
        assignment = [values[n % len(values)] for n in range(n_cells)]
        return {
            "My Annotation": {
                "values": values,
                "assignment": assignment,
                "coordinates": {
                    value: np.array([coords[i] for i in range(n_cells) if assignment[i] == value], dtype=coords.dtype)
                    for value in values
                },
            },
        }

    def __repr__(self):
        return f(
            "LoomData(name={self.name}, "
            "{self.n_genes}, {self.n_cells}, "
            "matrix={self.matrix}, "
            "annotations={self.annotations})"
        )


@st.composite
def loom_data_strategy(draw):
    "Generate LoomData objects."
    sizes = st.integers(min_value=1, max_value=LARGEST)
    names = st.text(st.characters(max_codepoint=1000, whitelist_categories=("Nd", "Ll", "Lu")), min_size=1)
    n_regulons = draw(sizes)
    n_cells = draw(sizes)
    n_genes = draw(sizes)
    annotations = st.lists(names, min_size=1, max_size=n_cells, unique=True)

    return draw(
        st.builds(
            LoomData,
            name=names,
            matrix=matrix_strategy(n_cells, n_genes),
            n_genes=st.just(n_genes),
            n_cells=st.just(n_cells),
            n_regulons=st.just(n_regulons),
            regulons=regulons_strategy(n_genes, n_cells, n_regulons),
            embeddings=embeddings_strategy(n_cells),
            clusterings=clusterings_strategy(n_cells, n_genes),
            annotations=annotations,
        )
    )


class SearchSpaceMock:
    "Mock of a SearchSpace for pickling."
    loom = ""
    dfh = ""


@contextmanager
def loom_generator(loom_data: LoomData):
    "Generate a loom file on the filesystem."
    path = Path(mkdtemp())
    handle, _filep = mkstemp(dir=path)
    filepath = path / Path(_filep)
    os.close(handle)
    pkl_path = path / Path(f"{filepath.name}.ss_pkl")

    with pkl_path.open(mode="wb") as pkl:
        pickle.dump(SearchSpaceMock(), pkl)

    col_attrs = {
        "CellID": np.array([f"Cell_{n}" for n in range(1, loom_data.n_cells + 1)]),
        "nUMI": loom_data.matrix.sum(axis=0),
        "nGene": (loom_data.matrix > 0).sum(axis=0),
        **{annotation: loom_data.annotations[annotation]["assignment"] for annotation in loom_data.annotations},
        **loom_data.embeddings.column_attributes,
        **loom_data.clusterings.column_attributes,
        **loom_data.regulons.column_attributes,
    }

    row_attrs = {
        "Gene": np.array([f"Gene_{n}" for n in range(1, loom_data.n_genes + 1)]),
        **loom_data.embeddings.row_attributes,
        **loom_data.clusterings.row_attributes,
        **loom_data.regulons.row_attributes,
    }

    file_attrs = {
        "title": loom_data.name,
        "MetaData": json.dumps(
            {
                "metrics": [{"name": "nUMI"}, {"name": "nGene"}],
                "annotations": [
                    {"name": annotation, "values": loom_data.annotations[annotation]["values"]}
                    for annotation in loom_data.annotations
                ],
                **loom_data.embeddings.metadata,
                **loom_data.clusterings.metadata,
                **loom_data.regulons.metadata,
            }
        ),
        "Genome": "Nomen dubium",
        "SCopeTreeL1": loom_data.name,
        "SCopeTreeL2": "",
        "SCopeTreeL3": "",
    }

    try:
        loompy.create(
            filename=str(filepath),
            layers=loom_data.matrix,
            row_attrs=row_attrs,
            col_attrs=col_attrs,
            file_attrs=file_attrs,
        )
    except OSError as err:
        print(f"loompy.create {err}")
        traceback.print_exc()

    print(f"Created {filepath}")

    connection: loompy.LoomConnection = loompy.connect(str(filepath), mode="r", validate=False)

    loom = Loom(Path(connection.filename), Path(connection.filename), connection, LoomFileHandler())
    yield loom

    connection.close()
    for obj in path.iterdir():
        obj.unlink()
    path.rmdir()
