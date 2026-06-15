import api from './client'

// Per-dataset/gene float32 cache so reselecting a gene doesn't refetch.
// Keyed by datasetId+gene+password so a password rotation invalidates.
// Capped both by entry count and total bytes to bound memory usage.
const EXPRESSION_MAX_ENTRIES = 64
const EXPRESSION_MAX_BYTES = 64 * 1024 * 1024 // 64 MiB

const cache = new Map<string, Float32Array>()
let cachedBytes = 0

function evictIfNeeded() {
    while (
        (cache.size > EXPRESSION_MAX_ENTRIES || cachedBytes > EXPRESSION_MAX_BYTES) &&
        cache.size > 0
    ) {
        const oldestKey = cache.keys().next().value
        if (oldestKey === undefined) break
        const arr = cache.get(oldestKey)
        cache.delete(oldestKey)
        if (arr) cachedBytes -= arr.byteLength
    }
}

function touch(key: string, value: Float32Array) {
    cache.delete(key)
    cache.set(key, value)
}

export function clearExpressionCache(datasetId?: string) {
    if (!datasetId) {
        cache.clear()
        cachedBytes = 0
        return
    }
    for (const key of [...cache.keys()]) {
        if (key.startsWith(`${datasetId}\u0000`)) {
            const arr = cache.get(key)
            cache.delete(key)
            if (arr) cachedBytes -= arr.byteLength
        }
    }
}

/**
 * Fetch a gene-expression column as a Float32Array, memoized in-process.
 *
 * The backend serves `Cache-Control: immutable` so the browser HTTP cache
 * also helps, but axios doesn't surface arraybuffer responses through that
 * cache reliably — this layer ensures repeat selections are instant.
 */
export async function fetchGeneExpression(
    datasetId: string,
    gene: string,
    projectPassword?: string,
): Promise<Float32Array> {
    const key = `${datasetId}\u0000${gene}\u0000${projectPassword ?? ''}`
    const hit = cache.get(key)
    if (hit) {
        // Move to most-recently-used position.
        touch(key, hit)
        return hit
    }
    const config = {
        responseType: 'arraybuffer' as const,
        headers: projectPassword ? { 'x-project-password': projectPassword } : undefined,
    }
    const res = await api.get<ArrayBuffer>(
        `/datasets/${datasetId}/expression/${encodeURIComponent(gene)}`,
        config,
    )
    const arr = new Float32Array(res.data)
    cache.set(key, arr)
    cachedBytes += arr.byteLength
    evictIfNeeded()
    return arr
}
