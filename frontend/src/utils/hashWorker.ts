/**
 * Off-main-thread MD5 hashing of a File using SparkMD5.
 *
 * The previous implementation read the file in 2 MiB chunks via FileReader on
 * the main thread, which froze the UI on multi-GB datasets. Vite supports the
 * `?worker` import suffix; this module re-exports the SparkMD5 chunk loop so
 * the main thread only posts the File and awaits the digest.
 */
/// <reference lib="webworker" />
import SparkMD5 from 'spark-md5'

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

const CHUNK_SIZE = 2 * 1024 * 1024 // 2 MiB

self.onmessage = (event: MessageEvent<HashRequest>) => {
  const { file } = event.data
  const chunks = Math.ceil(file.size / CHUNK_SIZE)
  let currentChunk = 0
  const spark = new SparkMD5.ArrayBuffer()
  const reader = new FileReader()

  reader.onload = (e) => {
    if (!e.target?.result) {
      self.postMessage({ type: 'error', message: 'Empty chunk' } satisfies HashWorkerMessage)
      return
    }
    spark.append(e.target.result as ArrayBuffer)
    currentChunk += 1
    self.postMessage({
      type: 'progress',
      progress: Math.round((currentChunk / chunks) * 100),
    } satisfies HashWorkerMessage)

    if (currentChunk < chunks) {
      loadNext()
    } else {
      self.postMessage({ type: 'done', hash: spark.end() } satisfies HashWorkerMessage)
    }
  }

  reader.onerror = () => {
    self.postMessage({ type: 'error', message: 'Hash calculation failed' } satisfies HashWorkerMessage)
  }

  function loadNext() {
    const start = currentChunk * CHUNK_SIZE
    const end = start + CHUNK_SIZE >= file.size ? file.size : start + CHUNK_SIZE
    reader.readAsArrayBuffer(file.slice(start, end))
  }

  loadNext()
}
