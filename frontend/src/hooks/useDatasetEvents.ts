import { useEffect, useRef } from 'react'
import { apiUrl } from '../api/config'

export interface DatasetEvent {
    dataset_id: string
    status: string
}

/**
 * Subscribe to the server-sent dataset-status stream and invoke `onEvent` for
 * each status change. Auth rides the HttpOnly cookie (EventSource sends it via
 * withCredentials). Returns whether the stream is currently connected via the
 * `connectedRef` so callers can keep polling as a fallback only while SSE is
 * down.
 *
 * `enabled` lets callers turn the stream off (e.g. when logged out).
 */
export function useDatasetEvents(
    onEvent: (e: DatasetEvent) => void,
    enabled = true,
) {
    const connectedRef = useRef(false)
    const onEventRef = useRef(onEvent)
    onEventRef.current = onEvent

    useEffect(() => {
        if (!enabled || typeof EventSource === 'undefined') return

        let es: EventSource | null = null
        let closed = false
        let retry: ReturnType<typeof setTimeout> | null = null

        const connect = () => {
            if (closed) return
            es = new EventSource(apiUrl('/datasets/events'), { withCredentials: true })
            es.onopen = () => { connectedRef.current = true }
            es.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data) as DatasetEvent
                    if (data && data.dataset_id) onEventRef.current(data)
                } catch {
                    /* ignore keepalives / malformed frames */
                }
            }
            es.onerror = () => {
                // Connection dropped — mark disconnected so callers fall back to
                // polling, close, and retry with a small backoff.
                connectedRef.current = false
                es?.close()
                if (!closed && !retry) {
                    retry = setTimeout(() => { retry = null; connect() }, 5000)
                }
            }
        }

        connect()
        return () => {
            closed = true
            connectedRef.current = false
            if (retry) clearTimeout(retry)
            es?.close()
        }
    }, [enabled])

    return connectedRef
}
