#!/usr/bin/env python3
"""Upload a local dataset file to the SCope API (no curl needed).

Two modes:
  * CHUNKED + RESUMABLE (default) — sends the file as a series of short PATCH
    requests, so a dropped connection (or an intermediary's idle/duration cap,
    e.g. Docker Desktop's host port-forwarding proxy that resets long uploads
    after ~5 min) resumes from the server's last offset instead of restarting.
  * SINGLE-SHOT (--single-shot) — one streaming POST (the same path as
    `curl -T`); simplest, but at the mercy of one long-lived connection.

Run it INSIDE the backend container to bypass the dev host proxy entirely:

    # the dev compose bind-mounts ./backend -> /app, so ./backend/_tmp/big.h5ad
    # is visible at /app/_tmp/big.h5ad inside the container
    docker compose exec backend python scripts/upload_local.py \
        --file /app/_tmp/big.h5ad --token scope_pat_xxx --name "My Dataset" --type h5ad

Constant memory (one chunk in flight); handles 100 GB+ files. Resume just re-runs
the same command — init returns the offset of the existing .part file.
"""
from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import os
import sys
import time
from urllib.parse import quote, urlparse

_EXT_TO_TYPE = {".h5ad": "h5ad", ".loom": "loom", ".csv": "csv"}


def md5_of(path: str, block: int = 1 << 20) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(block), b""):
            h.update(chunk)
    return h.hexdigest()


def _request(url: str, method: str, urlpath: str, headers: dict, body=None):
    """One short HTTP request on a fresh connection. Returns (status, text)."""
    u = urlparse(url)
    is_https = u.scheme == "https"
    conn_cls = http.client.HTTPSConnection if is_https else http.client.HTTPConnection
    conn = conn_cls(u.hostname, u.port or (443 if is_https else 80), timeout=3600)
    try:
        conn.request(method, urlpath, body=body, headers=headers)
        resp = conn.getresponse()
        text = resp.read().decode("utf-8", "replace")
        return resp.status, text
    finally:
        conn.close()


def upload_single_shot(args, path, name, ftype, size, digest) -> int:
    query = (
        f"/api/v1/datasets/?name={quote(name)}"
        f"&description={quote(args.description)}"
        f"&file_type={ftype}&file_hash={digest}"
    )
    headers = {
        "Authorization": f"Bearer {args.token}",
        "Content-Type": "application/octet-stream",
        "Content-Length": str(size),  # so http.client streams the file object
    }
    u = urlparse(args.url)
    is_https = u.scheme == "https"
    conn_cls = http.client.HTTPSConnection if is_https else http.client.HTTPConnection
    conn = conn_cls(u.hostname, u.port or (443 if is_https else 80), timeout=24 * 3600)
    print(f"Single-shot upload to {args.url} …", flush=True)
    started = time.time()
    with open(path, "rb") as f:
        conn.request("POST", query, body=f, headers=headers)
        resp = conn.getresponse()
        text = resp.read().decode("utf-8", "replace")
    print(f"HTTP {resp.status} in {time.time() - started:.0f}s")
    print(text[:1000])
    return 0 if resp.status < 400 else 1


def upload_chunked(args, path, name, ftype, size, digest) -> int:
    auth = {"Authorization": f"Bearer {args.token}"}

    # 1. init (also handles server-side de-dup)
    init_q = (
        f"/api/v1/datasets/upload/init?name={quote(name)}"
        f"&description={quote(args.description)}"
        f"&file_type={ftype}&file_hash={digest}&total_size={size}"
    )
    status, text = _request(args.url, "POST", init_q, auth)
    if status >= 400:
        print(f"init failed: HTTP {status}\n{text[:800]}", file=sys.stderr)
        return 1
    data = json.loads(text or "{}")
    if data.get("deduped"):
        print("Already stored on the server (de-duplicated) — linked without uploading.")
        print(json.dumps(data.get("dataset", {}))[:600])
        return 0

    upload_id = data["upload_id"]
    offset = int(data.get("offset") or 0)
    chunk_size = args.chunk_size
    print(f"Chunked upload id={upload_id} resume_offset={offset} chunk={chunk_size // (1 << 20)}MiB", flush=True)

    started = time.time()
    attempts = 0
    with open(path, "rb") as f:
        while offset < size:
            f.seek(offset)
            chunk = f.read(chunk_size)
            try:
                status, text = _request(
                    args.url, "PATCH", f"/api/v1/datasets/upload/{upload_id}",
                    {**auth, "Content-Type": "application/octet-stream", "Upload-Offset": str(offset)},
                    body=chunk,
                )
                if status == 409:  # offset out of sync — adopt the server's and retry
                    detail = (json.loads(text or "{}").get("detail") or {})
                    srv = detail.get("offset")
                    if isinstance(srv, int):
                        offset = srv
                    attempts += 1
                    if attempts > args.retries:
                        print(f"\nrepeated offset conflicts; giving up: {text[:300]}", file=sys.stderr)
                        return 1
                    continue
                if status >= 400:
                    raise RuntimeError(f"HTTP {status}: {text[:300]}")
                offset = int(json.loads(text)["offset"])
                attempts = 0
                pct = offset * 100 // size if size else 100
                print(f"\r  {pct:3d}%  ({offset / 1e9:.1f}/{size / 1e9:.1f} GB)", end="", flush=True)
            except Exception as e:  # noqa: BLE001 — transient drop: re-sync + retry
                attempts += 1
                if attempts > args.retries:
                    print(f"\nchunk failed after {attempts} attempts: {e}", file=sys.stderr)
                    return 1
                try:
                    s2, t2 = _request(args.url, "GET", f"/api/v1/datasets/upload/{upload_id}", auth)
                    if s2 < 400:
                        offset = int(json.loads(t2)["offset"])
                except Exception:  # noqa: BLE001
                    pass
                time.sleep(min(attempts, 10))
    print()

    # finalize
    status, text = _request(args.url, "POST", f"/api/v1/datasets/upload/{upload_id}/complete", auth)
    print(f"complete: HTTP {status} in {time.time() - started:.0f}s")
    print(text[:800])
    return 0 if status < 400 else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Upload a local file to the SCope API (chunked/resumable by default).")
    ap.add_argument("--file", required=True, help="Path to the dataset file (as seen by THIS process).")
    ap.add_argument("--token", required=True, help="Personal Access Token (scope_pat_...).")
    ap.add_argument("--name", help="Dataset name (defaults to the file's base name).")
    ap.add_argument("--type", dest="ftype", help="loom|h5ad|csv (inferred from the extension if omitted).")
    ap.add_argument("--description", default="")
    ap.add_argument("--url", default="http://localhost:8000", help="API origin. Default: intra-container backend.")
    ap.add_argument("--single-shot", action="store_true", help="Use one streaming POST instead of chunked/resumable.")
    ap.add_argument("--chunk-size", type=int, default=32 * 1024 * 1024, help="Chunk size in bytes (default 32 MiB).")
    ap.add_argument("--retries", type=int, default=6, help="Max consecutive retries per chunk before giving up.")
    args = ap.parse_args()

    path = args.file
    if not os.path.isfile(path):
        print(f"No such file: {path}", file=sys.stderr)
        return 2

    name = args.name or os.path.splitext(os.path.basename(path))[0]
    ftype = args.ftype or _EXT_TO_TYPE.get(os.path.splitext(path)[1].lower(), "h5ad")
    size = os.path.getsize(path)

    print(f"Hashing {path} ({size / 1e9:.1f} GB)…", flush=True)
    digest = md5_of(path)
    print(f"  md5 = {digest}", flush=True)

    if args.single_shot:
        return upload_single_shot(args, path, name, ftype, size, digest)
    return upload_chunked(args, path, name, ftype, size, digest)


if __name__ == "__main__":
    raise SystemExit(main())
