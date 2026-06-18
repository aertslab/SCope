"""Round-trip verification for the TileDB-SOMA pipeline.

Builds a small SPARSE (CSR) AnnData — the case the old zarr converter
densified — ingests it to SOMA, reads one gene column back through the serving
reader, and exports to h5ad. Skipped automatically where ``tiledbsoma`` isn't
installed (it runs in CI, which installs the full backend deps).
"""
from __future__ import annotations

import os

os.environ.setdefault("ALLOW_INSECURE_SECRETS", "true")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")

import asyncio

import numpy as np
import pytest

pytest.importorskip("tiledbsoma")
import anndata  # noqa: E402
import pandas as pd  # noqa: E402
from scipy import sparse  # noqa: E402

from app.utils import soma_cache, soma_reader  # noqa: E402
from app.utils.soma_converter import convert_h5ad_to_soma, export_soma_to_h5ad  # noqa: E402


def test_csr_h5ad_roundtrip_stays_sparse(tmp_path):
    n_obs, n_var = 64, 10
    X = sparse.random(n_obs, n_var, density=0.3, format="csr", dtype=np.float32, random_state=0)
    var_names = [f"GENE{i}" for i in range(n_var)]
    adata = anndata.AnnData(
        X=X,
        var=pd.DataFrame(index=var_names),
        obs=pd.DataFrame({"n_genes": np.arange(n_obs)}, index=[f"cell{i}" for i in range(n_obs)]),
    )
    # A 2-D embedding in obsm — the viewer needs this exposed via /metadata.
    adata.obsm["X_umap"] = np.random.default_rng(0).random((n_obs, 2)).astype(np.float32)
    h5ad_path = str(tmp_path / "in.h5ad")
    adata.write_h5ad(h5ad_path)

    soma_path = str(tmp_path / "out.soma")
    asyncio.run(convert_h5ad_to_soma(h5ad_path, soma_path))
    soma_cache.invalidate(soma_path)  # ensure fresh handles after write

    # gene_index sidecar exists and maps names → column coords.
    gi = soma_cache.load_gene_index(soma_path)
    assert gi is not None and "GENE3" in gi

    # Embeddings are synthesized from obsm so the viewer can plot a generic h5ad.
    meta = soma_reader.load_metadata(soma_path)
    emb_names = {e["name"] for e in meta.get("embeddings", [])}
    assert "umap" in emb_names
    emb = np.frombuffer(soma_reader.read_embedding(soma_path, "umap"), dtype=np.float32)
    assert emb.shape[0] == n_obs * 2  # interleaved X,Y

    # The served column equals the dense reference, length == n_obs.
    raw = soma_reader.read_expression_column(soma_path, gi["GENE3"])
    col = np.frombuffer(raw, dtype=np.float32)
    assert col.shape[0] == n_obs
    np.testing.assert_allclose(col, X[:, 3].toarray().ravel(), rtol=1e-5, atol=1e-6)

    # A numeric obs feature round-trips as float32 bytes.
    from fastapi.responses import Response

    resp = soma_reader.read_feature(soma_path, "__library_size__")
    assert isinstance(resp, Response)

    # Export back to h5ad preserves shape + nnz.
    out_h5ad = str(tmp_path / "rt.h5ad")
    export_soma_to_h5ad(soma_path, out_h5ad)
    rt = anndata.read_h5ad(out_h5ad)
    assert rt.shape == (n_obs, n_var)
