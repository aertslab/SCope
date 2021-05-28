import numpy as np
import pandas as pd
from numpy.random import Generator, PCG64

import json


def df_to_named_matrix(df):
    arr_ip = [tuple(i) for i in df.values]
    dtyp = np.dtype(list(zip(df.dtypes.index, df.dtypes)))
    arr = np.array(arr_ip, dtype=dtyp)
    return arr


rg = Generator(PCG64(55850))


NUM_GENES = 100
NUM_REGULONS = 4
# Must be divisible by 4
NUM_CELLS = 100

cell_ids = [f"Cell_{n}" for n in range(1, NUM_CELLS + 1)]
gene_ids = [f"Gene_{n}" for n in range(1, NUM_GENES + 1)]


def generate_matrix():
    genes = rg.poisson(lam=1, size=NUM_GENES)
    genes = [x + 1 for x in genes]
    matrix = rg.poisson(lam=genes, size=(NUM_CELLS, NUM_GENES))
    return matrix


def generate_regulons(legacy=False):
    col_attrs = {}
    row_attrs = {}
    metadata = {}

    if legacy:
        regulons_ids = [f"Regulon_{n}" for n in range(1, NUM_REGULONS + 1)]
        regulons_auc_binary = (rg.integers(10, size=(NUM_CELLS, NUM_REGULONS)) > 2).astype(int)
        regulons_auc_data = regulons_auc_binary * rg.random(size=(NUM_GENES, NUM_REGULONS))
        regulons_auc = pd.DataFrame(data=regulons_auc_data, index=cell_ids, columns=regulons_ids)

        regulons_binary = (rg.integers(5, size=(NUM_GENES, NUM_REGULONS)) > 3).astype(int)
        regulons = pd.DataFrame(data=regulons_binary, index=gene_ids, columns=regulons_ids)

        col_attrs["RegulonsAUC"] = df_to_named_matrix(regulons_auc)
        row_attrs["Regulons"] = df_to_named_matrix(regulons)

        metadata["regulonThresholds"] = [
            {
                "regulon": regulon,
                "defaultThresholdValue": regulons_auc[regulon].mean(),
                "defaultThresholdName": "MeanScore",
                "allThresholds": {
                    "MeanScore": regulons_auc[regulon].mean(),
                    "5thPercentile": np.percentile(regulons_auc[regulon], 0.05),
                },
                "motifData": f"{regulon}.png",
            }
            for regulon in regulons_ids
        ]

    else:
        motif_regulons_ids = [f"MotifRegulon_{n}" for n in range(1, NUM_REGULONS + 1)]
        track_regulons_ids = [f"TrackRegulon_{n}" for n in range(1, NUM_REGULONS + 1)]
        motif_regulons_auc_binary = (rg.integers(10, size=(NUM_CELLS, NUM_REGULONS)) > 2).astype(int)
        motif_regulons_auc_data = motif_regulons_auc_binary * rg.random(size=(NUM_GENES, NUM_REGULONS))
        motif_regulons_auc = pd.DataFrame(data=motif_regulons_auc_data, index=cell_ids, columns=motif_regulons_ids)

        motif_regulons_binary = (rg.integers(5, size=(NUM_GENES, NUM_REGULONS)) > 3).astype(int)
        motif_regulons = pd.DataFrame(data=motif_regulons_binary, index=gene_ids, columns=motif_regulons_ids)

        motif_regulons_gene_occurences_data = motif_regulons_auc_binary * rg.integers(
            100, size=(NUM_GENES, NUM_REGULONS)
        )
        motif_regulons_gene_occurences = pd.DataFrame(
            data=motif_regulons_gene_occurences_data, index=gene_ids, columns=motif_regulons_ids
        )

        track_regulons_auc_binary = (rg.integers(10, size=(NUM_CELLS, NUM_REGULONS)) > 2).astype(int)
        track_regulons_auc_data = track_regulons_auc_binary * rg.random(size=(NUM_GENES, NUM_REGULONS))
        track_regulons_auc = pd.DataFrame(data=track_regulons_auc_data, index=cell_ids, columns=track_regulons_ids)

        track_regulons_binary = (rg.integers(5, size=(NUM_GENES, NUM_REGULONS)) > 3).astype(int)
        track_regulons = pd.DataFrame(data=track_regulons_binary, index=gene_ids, columns=track_regulons_ids)

        track_regulons_gene_occurences_data = track_regulons_auc_binary * rg.integers(
            100, size=(NUM_GENES, NUM_REGULONS)
        )
        track_regulons_gene_occurences = pd.DataFrame(
            data=track_regulons_gene_occurences_data, index=gene_ids, columns=track_regulons_ids
        )

        col_attrs["MotifRegulonsAUC"] = df_to_named_matrix(motif_regulons_auc)
        col_attrs["TrackRegulonsAUC"] = df_to_named_matrix(track_regulons_auc)
        row_attrs["MotifRegulons"] = df_to_named_matrix(motif_regulons)
        row_attrs["TrackRegulons"] = df_to_named_matrix(track_regulons)
        row_attrs["MotifRegulonGeneOccurrences"] = df_to_named_matrix(motif_regulons_gene_occurences)
        row_attrs["TrackRegulonGeneOccurrences"] = df_to_named_matrix(track_regulons_gene_occurences)

        metadata["regulonThresholds"] = [
            {
                "regulon": regulon,
                "defaultThresholdValue": motif_regulons_auc[regulon].mean(),
                "defaultThresholdName": "MeanScore",
                "allThresholds": {
                    "MeanScore": motif_regulons_auc[regulon].mean(),
                    "5thPercentile": np.percentile(motif_regulons_auc[regulon], 0.05),
                },
                "motifData": f"{regulon}.png",
            }
            for regulon in motif_regulons_ids
        ]

        metadata["regulonThresholds"] += [
            {
                "regulon": regulon,
                "defaultThresholdValue": track_regulons_auc[regulon].mean(),
                "defaultThresholdName": "MeanScore",
                "allThresholds": {
                    "MeanScore": track_regulons_auc[regulon].mean(),
                    "5thPercentile": np.percentile(track_regulons_auc[regulon], 0.05),
                },
                "motifData": f"{regulon}.png",
            }
            for regulon in track_regulons_ids
        ]

        metadata["regulonSettings"] = {"min_genes_regulon": 5, "min_regulon_gene_occurrence": 5}

    return metadata, col_attrs, row_attrs


def generate_embeddings():
    _X = np.concatenate([rg.normal(n, 0.1, int(NUM_CELLS / 4)) for n in range(-2, 2)])
    _Y = rg.normal(0, 0.1, NUM_CELLS)
    _X2 = rg.normal(0, 0.1, NUM_CELLS)
    _Y2 = np.array([rg.normal(cn % 4, 0.1) for cn in range(NUM_CELLS)])

    main_embedding = pd.DataFrame(columns=["_X", "_Y"])
    main_embedding["_X"] = _X
    main_embedding["_Y"] = _Y

    embeddings_X = pd.DataFrame()
    embeddings_Y = pd.DataFrame()

    embeddings_X["1"] = _X2
    embeddings_Y["1"] = _Y2

    metadata = {"Embeddings": [{"id": -1, "name": "Vertical Clusters"}, {"id": 1, "name": "Horizontal Clusters"}]}

    col_attrs = {
        "Embedding": df_to_named_matrix(main_embedding),
        "Embeddings_X": df_to_named_matrix(embeddings_X),
        "Embeddings_Y": df_to_named_matrix(embeddings_Y),
    }
    row_attrs = {}

    return metadata, col_attrs, row_attrs


def generate_clusterings():
    # Clusters
    metadata = {"clusterings": []}
    col_attrs = {}
    row_attrs = {}

    clusterings = pd.DataFrame()
    clusterings["0"] = [int(n / (NUM_CELLS / 4)) for n in range(NUM_CELLS)]
    clusterings["1"] = [n % 4 for n in range(NUM_CELLS)]
    col_attrs["ClusterID"] = clusterings["0"].values

    for n, clustering in enumerate(clusterings.columns):
        cluster_meta = {
            "id": n,
            "group": "Test clusterings",
            "name": f"Cluster set {n}",
            "clusters": [],
            "clusterMarkerMetrics": [
                {"accessor": "Test_Metric", "name": "Test Metric", "description": "Some test values to display"}
            ],
        }
        cluster_markers = pd.DataFrame(
            index=gene_ids, columns=[str(x) for x in range(max({int(x) for x in clusterings[clustering]}) + 1)]
        )
        cluster_markers_test_metric = pd.DataFrame(
            index=gene_ids, columns=[str(x) for x in range(max({int(x) for x in clusterings[clustering]}) + 1)]
        )
        cluster_markers.fillna(0, inplace=True)
        cluster_markers_test_metric.fillna(0, inplace=True)
        for cluster in range(4):
            cluster_markers.iloc[cluster * 4 : (cluster + 1) * 4, cluster] = 1
            cluster_markers_test_metric.iloc[cluster * 4 : (cluster + 1) * 4, cluster] = cluster * 1 * n

            clust_dict = {}
            clust_dict["id"] = cluster
            clust_dict["description"] = f"Unannotated Cluster {str(cluster+1)}"
            cluster_meta["clusters"].append(clust_dict)

        row_attrs[f"ClusterMarkers_{n}"] = df_to_named_matrix(cluster_markers)
        row_attrs[f"ClusterMarkers_{n}_Test_Metric"] = df_to_named_matrix(cluster_markers_test_metric)
        metadata["clusterings"].append(cluster_meta)

    col_attrs["Clusterings"] = df_to_named_matrix(clusterings)
    return metadata, col_attrs, row_attrs


def generate_test_loom_data():
    matrix = generate_matrix()
    embeddings_meta, embeddings_cols, embeddings_rows = generate_embeddings()
    clusterings_meta, clusterings_cols, clusterings_rows = generate_clusterings()
    regulons_meta, regulons_cols, regulons_rows = generate_regulons()

    col_attrs = {
        "CellID": np.array(cell_ids),
        "nUMI": np.array(matrix.sum(axis=0)),
        "nGene": np.array((matrix > 0).sum(axis=0)),
        "Half cells": ["First half" if n % 2 == 0 else "Second half" for n in range(NUM_CELLS)],
        **embeddings_cols,
        **clusterings_cols,
        **regulons_cols,
    }

    row_attrs = {
        "Gene": gene_ids,
        **embeddings_rows,
        **clusterings_rows,
        **regulons_rows,
    }

    meta_json = {
        "metrics": [{"name": "nUMI"}, {"name": "nGene"}],
        "annotations": [{"name": "Half cells", "values": list(set(col_attrs["Half cells"]))}],
        **embeddings_meta,
        **clusterings_meta,
        **regulons_meta,
    }

    attrs = {
        "title": "Test Data",
        "MetaData": json.dumps(meta_json),
        "Genome": "Nomen dubium",
        "SCopeTreeL1": "Test Loom",
        "SCopeTreeL2": "",
        "SCopeTreeL3": "",
    }

    return matrix, row_attrs, col_attrs, attrs
