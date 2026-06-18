import { useEffect, useState, useCallback } from 'react'
import api from '../../api/client'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Trash2, Eraser, ExternalLink } from 'lucide-react'

interface SessionItem {
    id: string
    created_at: string
    data_keys: string[]
    size_estimate: number
}

interface SessionsResponse {
    total: number
    items: SessionItem[]
    limit: number
    offset: number
}

const PAGE_SIZE = 50

export default function AdminSessions() {
    const [data, setData] = useState<SessionsResponse | null>(null)
    const [page, setPage] = useState(0)
    const [loading, setLoading] = useState(true)
    const [cleanupDays, setCleanupDays] = useState(30)

    const fetchPage = useCallback(async (pageIdx: number) => {
        setLoading(true)
        try {
            const res = await api.get<SessionsResponse>(
                `/admin/sessions?limit=${PAGE_SIZE}&offset=${pageIdx * PAGE_SIZE}`
            )
            setData(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchPage(page)
    }, [page, fetchPage])

    const handleDelete = async (id: string) => {
        if (!confirm(`Delete session ${id}?`)) return
        try {
            await api.delete(`/admin/sessions/${id}`)
            fetchPage(page)
        } catch (e) {
            console.error(e)
            alert('Failed to delete session')
        }
    }

    const handleCleanup = async () => {
        if (!confirm(`Delete all sessions older than ${cleanupDays} days?`)) return
        try {
            const res = await api.post(`/admin/sessions/cleanup?older_than_days=${cleanupDays}`)
            alert(`Deleted ${res.data.deleted} session(s)`)
            setPage(0)
            fetchPage(0)
        } catch (e) {
            console.error(e)
            alert('Cleanup failed')
        }
    }

    const total = data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return (
        <div className="space-y-4">
            <PageHeader title="Sessions">
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={1}
                        value={cleanupDays}
                        onChange={(e) => setCleanupDays(Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                    />
                    <span className="text-sm text-gray-500">days</span>
                    <Button variant="danger" leftIcon={<Eraser size={16} />} onClick={handleCleanup}>
                        Purge old
                    </Button>
                </div>
            </PageHeader>

            <div className="text-sm text-gray-500">
                {total.toLocaleString()} shared session URL{total === 1 ? '' : 's'} stored.
            </div>

            <div className="bg-white shadow overflow-x-auto rounded-lg">
                {loading ? (
                    <LoadingState />
                ) : !data || data.items.length === 0 ? (
                    <EmptyState message="No sessions" />
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Keys</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.items.map(s => (
                                <tr key={s.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-mono text-xs">{s.id}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600">
                                        {new Date(s.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-500">
                                        {s.data_keys.slice(0, 4).join(', ')}
                                        {s.data_keys.length > 4 && ` (+${s.data_keys.length - 4})`}
                                    </td>
                                    <td className="px-4 py-2 text-sm">{(s.size_estimate / 1024).toFixed(1)} KB</td>
                                    <td className="px-4 py-2 text-right">
                                        <a
                                            href={`/s/${s.id}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 text-sm mr-3"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                        <button
                                            onClick={() => handleDelete(s.id)}
                                            className="text-gray-400 hover:text-red-500"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">
                    Page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0 || loading}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page + 1 >= totalPages || loading}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
