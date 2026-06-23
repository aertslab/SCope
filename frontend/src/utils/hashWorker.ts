/**
 * Off-main-thread MD5 hashing of a File.
 *
 * Uses hash-wasm's WASM MD5 (incremental) — markedly faster than the previous
 * pure-JS SparkMD5 loop on multi-GB datasets, which made the upfront hashing a
 * long blocking step. Same MD5 values (lowercase hex), so they still match the
 * server's hashlib.md5 and `md5sum`/`Get-FileHash MD5`. Vite's `?worker` suffix
 * runs this off the main thread; the caller just posts the File and awaits the
 * digest. Note: the server independently re-hashes the received bytes, so this
 * client hash is only a de-dup pre-check, not the authoritative identity.
 */
/// <reference lib="webworker" />
import { createMD5 } from 'hash-wasm'

declare const self: DedicatedWorkerGlobalScope

interface HashRequest {
  file: File
}

interface HashProgress {
  type: 'progress'
  progress: number
}

interface HashDone {
  type: 'done'
  hash: string
}

interface HashError {
  type: 'error'
  message: string
}

export type HashWorkerMessage = HashProgress | HashDone | HashError

// Bigger than the old 2 MiB FileReader chunks: WASM hashing is fast, so the
// per-slice read (Blob.arrayBuffer) dominates — larger slices cut overhead.
const CHUNK_SIZE = 8 * 1024 * 1024 // 8 MiB

self.onmessage = async (event: MessageEvent<HashRequest>) => {
  const { file } = event.data
  try {
    const hasher = await createMD5()
    hasher.init()
    let offset = 0
    while (offset < file.size) {
      const end = Math.min(offset + CHUNK_SIZE, file.size)
      const buf = new Uint8Array(await file.slice(offset, end).arrayBuffer())
      hasher.update(buf)
      offset = end
      self.postMessage({
        type: 'progress',
        progress: file.size ? Math.round((offset / file.size) * 100) : 100,
      } satisfies HashWorkerMessage)
    }
    self.postMessage({ type: 'done', hash: hasher.digest('hex') } satisfies HashWorkerMessage)
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies HashWorkerMessage)
  }
}
