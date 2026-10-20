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


def test_csr_h5ad_roundtrip_stays_sparse(tmp_path, monkeypatch):
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

    # Export back to h5ad preserves the data. A tiny block size makes the
    # streaming export write X and obsm over many row blocks.
    from app.utils import soma_converter

    monkeypatch.setattr(soma_converter, "_EXPORT_BLOCK_VALUES", 20)
    out_h5ad = str(tmp_path / "rt.h5ad")
    export_soma_to_h5ad(soma_path, out_h5ad)
    rt = anndata.read_h5ad(out_h5ad)
    assert rt.shape == (n_obs, n_var)
    assert sparse.issparse(rt.X) and rt.X.nnz == X.nnz
    np.testing.assert_allclose(rt.X.toarray(), X.toarray())
    assert list(rt.obs_names) == list(adata.obs_names)
    assert list(rt.var_names) == var_names
    np.testing.assert_array_equal(rt.obs["n_genes"].to_numpy(), np.arange(n_obs))
    np.testing.assert_allclose(rt.obsm["X_umap"], adata.obsm["X_umap"])


def test_wide_embedding_reads_only_requested_dims(tmp_path, monkeypatch):
    n_obs = 50
    rng = np.random.default_rng(1)
    wide = rng.random((n_obs, 20)).astype(np.float32)
    wide[:, 7] = 0.0  # an all-zero column must still come back as zeros
    adata = anndata.AnnData(
        X=sparse.random(n_obs, 5, density=0.3, format="csr", dtype=np.float32, random_state=1),
        var=pd.DataFrame(index=[f"G{i}" for i in range(5)]),
        obs=pd.DataFrame(index=[f"c{i}" for i in range(n_obs)]),
    )
    # The wide latent space is listed first in obsm, as in a real dataset.
    adata.obsm["X_latent"] = wide
    adata.obsm["X_umap"] = rng.random((n_obs, 2)).astype(np.float32)
    h5ad_path = str(tmp_path / "in.h5ad")
    adata.write_h5ad(h5ad_path)
    soma_path = str(tmp_path / "out.soma")
    # A small block size makes the converter write obsm over several column blocks.
    from app.utils import soma_converter

    monkeypatch.setattr(soma_converter, "_OBSM_BLOCK_VALUES", 100)
    asyncio.run(convert_h5ad_to_soma(h5ad_path, soma_path))
    soma_cache.invalidate(soma_path)

    # obsm is stored dense and column-tiled, not as from_anndata's sparse default.
    obsm = soma_cache.open_soma(soma_path).ms["RNA"].obsm
    assert "dense" in str(obsm["X_latent"].soma_type).lower()

    # 2-D/3-D embeddings are listed first, so the viewer defaults to umap.
    embs = soma_reader.load_metadata(soma_path)["embeddings"]
    assert [e["name"] for e in embs] == ["umap", "latent"]
    assert embs[1]["n_dims"] == 20

    def read(dims):
        raw = soma_reader.read_embedding(soma_path, "latent", dims)
        return np.frombuffer(raw, dtype=np.float32).reshape(n_obs, -1)

    np.testing.assert_allclose(read(None), wide[:, [0, 1]])
    np.testing.assert_allclose(read([12, 7, 3]), wide[:, [12, 7, 3]])
    np.testing.assert_allclose(read([5, 5]), wide[:, [5, 5]])
    # Out-of-range dims are dropped; more than 3 are truncated.
    np.testing.assert_allclose(read([19, 99]), wide[:, [19]])
    np.testing.assert_allclose(read([0, 1, 2, 3]), wide[:, [0, 1, 2]])
