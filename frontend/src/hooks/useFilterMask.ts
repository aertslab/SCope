import { useEffect, useRef, useState } from 'react'
import api from '../api/client'
import { fetchGeneExpression } from '../api/expression'
import { useViewerStore } from '../store/useViewerStore'
import {
  buildPredicateMask,
  collectColumnRequests,
  evaluateTokens,
  requestForPredicate,
  validateTokens,
} from '../filters/engine'
import { ColumnRequest, ResolvedData } from '../filters/types'

type CachedColumn =
  | { kind: 'numeric'; data: Float32Array }
  | { kind: 'categorical'; data: (string | null)[] }

async function fetchColumn(
  datasetId: string,
  req: ColumnRequest,
  projectPassword?: string,
): Promise<CachedColumn> {
  const headers = projectPassword ? { 'x-project-password': projectPassword } : undefined
  if (req.kind === 'gene') {
    const arr = await fetchGeneExpression(datasetId, req.name, projectPassword)
    return { kind: 'numeric', data: arr }
  }
  if (req.kind === 'metric') {
    const res = await api.get(`/datasets/${datasetId}/feature/${encodeURIComponent(req.name)}`, {
      headers,
      responseType: 'arraybuffer' as const,
    })
    return { kind: 'numeric', data: new Float32Array(res.data as ArrayBuffer) }
  }
  // categorical → JSON array of labels (with nulls)
  const res = await api.get(`/datasets/${datasetId}/feature/${encodeURIComponent(req.name)}`, {
    headers,
  })
  return { kind: 'categorical', data: res.data as (string | null)[] }
}

/**
 * Evaluate the store's `filterTokens` into a per-cell visibility mask and write
 * it (with a matched/total count) back to the store. Columns are fetched once
 * and cached per dataset; selection predicates resolve from live `selections`.
 * Runs debounced and guards against out-of-order completions.
 *
 * Returns `{ loading, error }` for the FilterBar to surface.
 */
export function useFilterMask(datasetId: string, pointCount: number, projectPassword?: string) {
  const tokens = useViewerStore((s) => s.filterTokens)
  const enabled = useViewerStore((s) => s.filterEnabled)
  const selections = useViewerStore((s) => s.selections)
  const setFilterResult = useViewerStore((s) => s.setFilterResult)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cacheRef = useRef<Map<string, CachedColumn>>(new Map())
  const cacheDatasetRef = useRef<string | null>(null)
  const seqRef = useRef(0)

  // Drop the column cache when the dataset changes (cells/columns differ).
  if (cacheDatasetRef.current !== datasetId) {
    cacheDatasetRef.current = datasetId
    cacheRef.current = new Map()
  }

  useEffect(() => {
    const run = async () => {
      const seq = ++seqRef.current

      // No active/usable filter ⇒ clear the mask (all cells visible).
      if (!enabled || tokens.length === 0 || !pointCount || !validateTokens(tokens).valid) {
        setFilterResult(null, null)
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const reqs = collectColumnRequests(tokens).filter((r) => r.kind !== 'selection')
        const missing = reqs.filter((r) => !cacheRef.current.has(r.key))
        if (missing.length) {
          const results = await Promise.allSettled(
            missing.map((r) => fetchColumn(datasetId, r, projectPassword)),
          )
          results.forEach((res, i) => {
            if (res.status === 'fulfilled') cacheRef.current.set(missing[i].key, res.value)
          })
        }
        if (seq !== seqRef.current) return // a newer run superseded this one

        const masksById = new Map<string, Uint8Array>()
        let anyMissing = false
        for (const t of tokens) {
          if (t.type !== 'predicate') continue
          const p = t.predicate
          let data: ResolvedData
          if (p.kind === 'quant') {
            const col = cacheRef.current.get(requestForPredicate(p).key)
            data = { kind: 'quant', column: col?.kind === 'numeric' ? col.data : undefined }
            if (!col) anyMissing = true
          } else if (p.kind === 'categorical') {
            const col = cacheRef.current.get(`cat:${p.feature}`)
            data = { kind: 'categorical', values: col?.kind === 'categorical' ? col.data : undefined }
            if (!col) anyMissing = true
          } else {
            const sel = selections.find((s) => s.id === p.selectionId)
            data = { kind: 'selection', indices: sel?.indices }
            if (!sel) anyMissing = true
          }
          masksById.set(t.id, buildPredicateMask(p, data, pointCount))
        }

        const mask = evaluateTokens(tokens, masksById, pointCount)
        let matched = 0
        if (mask) for (let i = 0; i < mask.length; i++) matched += mask[i]
        setFilterResult(mask, mask ? { matched, total: pointCount } : null)
        setError(anyMissing ? 'Some conditions reference data that is no longer available.' : null)
      } catch (e) {
        console.error('Filter evaluation failed', e)
        setError('Failed to evaluate filter.')
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    }

    const handle = setTimeout(run, 150)
    return () => clearTimeout(handle)
  }, [datasetId, tokens, enabled, selections, pointCount, projectPassword, setFilterResult])

  return { loading, error }
}
