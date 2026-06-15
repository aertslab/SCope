import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncResource<T> {
    data: T | null
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
}

interface Options {
    /** Re-fetch every N ms. Pass 0/undefined to disable polling. */
    pollMs?: number
    /** Skip the initial fetch when false. Defaults to true. */
    enabled?: boolean
}

/**
 * Tiny per-panel loader: each consumer owns its own loading/error state so the
 * containing page can render the rest of the UI immediately while a slow
 * endpoint is still in flight.
 */
export function useAsyncResource<T>(
    fetcher: () => Promise<T>,
    deps: ReadonlyArray<unknown> = [],
    options: Options = {},
): AsyncResource<T> {
    const { pollMs, enabled = true } = options
    const [data, setData] = useState<T | null>(null)
    const [loading, setLoading] = useState<boolean>(enabled)
    const [error, setError] = useState<string | null>(null)
    const fetcherRef = useRef(fetcher)
    fetcherRef.current = fetcher

    const refetch = useCallback(async () => {
        setLoading(true)
        try {
            const value = await fetcherRef.current()
            setData(value)
            setError(null)
        } catch (e: any) {
            setError(e?.response?.data?.detail || e?.message || 'Request failed')
        } finally {
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)

    useEffect(() => {
        if (!enabled) return
        refetch()
        if (!pollMs) return
        const id = setInterval(refetch, pollMs)
        return () => clearInterval(id)
    }, [enabled, pollMs, refetch])

    return { data, loading, error, refetch }
}
