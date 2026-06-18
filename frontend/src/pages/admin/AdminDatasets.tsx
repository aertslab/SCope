import { useEffect, useState, useCallback } from 'react'
import api from '../../api/client'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react'

interface AdminDataset {
    id: string
    name: string
    status: string
    file_size: number | null
    converted_size: number | null
    created_at: string
    deleted_at: string | null
    owner_email: string | null
    project_count: number
}

interface ListResponse {
    total: number
    items: AdminDataset[]
    limit: number
    offset: number
}

const PAGE = 50

function formatBytes(b: number | null) {
    if (!b) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(b) / Math.log(k))
    return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function statusVariant(s: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
    if (s === 'ready') return 'success'
    if (s === 'failed') return 'error'
    if (s === 'pending') return 'warning'
    if (s.startsWith('processing')) return 'info'
    return 'default'
}

export default function AdminDatasets() {
    const [data, setData] = useState<ListResponse | null>(null)
    const [page, setPage] = useState(0)
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [deletedFilter, setDeletedFilter] = useState<string>('') // '', 'true', 'false'
    const [loading, setLoading] = useState(true)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const fetchPage = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                limit: String(PAGE),
                offset: String(page * PAGE),
            })
            if (statusFilter) params.set('status', statusFilter)
            if (deletedFilter) params.set('deleted', deletedFilter)
            const res = await api.get<ListResponse>(`/admin/datasets?${params}`)
            setData(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [page, statusFilter, deletedFilter])

    useEffect(() => {
        fetchPage()
    }, [fetchPage])

    const handleReconvert = async (id: string) => {
        if (!confirm('Re-queue this dataset for conversion?')) return
        try {
            await api.post(`/admin/datasets/${id}/reconvert`)
            fetchPage()
        } catch (e: any) {
            alert(e?.response?.data?.detail || 'Failed to reconvert')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Completely purge this dataset — files on disk, database records, project links, and any share links / sessions / notifications referencing it? This cannot be undone.')) return
        setDeletingId(id)
        try {
            // Admin force-delete: hard-deletes regardless of trash state (the
            // user-facing DELETE /datasets/{id} only soft-deletes).
            await api.delete(`/admin/datasets/${id}`)
            await fetchPage()
        } catch (e: any) {
            console.error(e)
            alert(e?.response?.data?.detail || 'Failed to delete')
        } finally {
            setDeletingId(null)
        }
    }

    const total = data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / PAGE))

    return (
        <div className="space-y-4">
            <PageHeader title="All Datasets">
                <div className="flex items-center gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => { setPage(0); setStatusFilter(e.target.value) }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                        <option value="">All statuses</option>
                        <option value="ready">Ready</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="failed">Failed</option>
                    </select>
                    <select
                        value={deletedFilter}
                        onChange={(e) => { setPage(0); setDeletedFilter(e.target.value) }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                        <option value="">Active + trashed</option>
                        <option value="false">Active only</option>
                        <option value="true">Trashed only</option>
                    </select>
                    <Button variant="outline" leftIcon={<RefreshCw size={16} />} onClick={fetchPage}>Refresh</Button>
                </div>
            </PageHeader>

            <div className="text-sm text-gray-500">{total.toLocaleString()} dataset(s)</div>

            <div className="bg-white shadow rounded-lg overflow-x-auto">
                {loading ? (
                    <LoadingState />
                ) : !data || data.items.length === 0 ? (
                    <EmptyState message="No datasets" />
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Projects</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.items.map(ds => (
                                <tr key={ds.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm font-medium">
                                        {ds.name}
                                        {ds.deleted_at && (
                                            <span className="ml-2 text-[10px] uppercase tracking-wide text-red-500">trashed</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-500">{ds.owner_email || '—'}</td>
                                    <td className="px-4 py-2"><Badge variant={statusVariant(ds.status)}>{ds.status}</Badge></td>
                                    <td className="px-4 py-2 text-sm">
                                        <div>{formatBytes(ds.file_size)}</div>
                                        <div className="text-xs text-gray-500">{formatBytes(ds.converted_size)} converted</div>
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                        {ds.project_count > 0 ? (
                                            ds.project_count
                                        ) : (
                                            <span className="text-amber-600 text-xs font-medium">Unattached</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-500">
                                        {new Date(ds.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleReconvert(ds.id)}
                                                title="Re-queue conversion"
                                                leftIcon={<RotateCcw className="h-4 w-4" />}
                                            >
                                                Reconvert
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={deletingId === ds.id}
                                                onClick={() => handleDelete(ds.id)}
                                                title="Permanently delete (purge everywhere)"
                                                leftIcon={<Trash2 className="h-4 w-4" />}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Page {page + 1} of {totalPages}</span>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0 || loading}
                        onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading}
                        onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
            </div>
        </div>
    )
}
