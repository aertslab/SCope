import { useEffect, useState, useCallback } from 'react'
import api from '../../api/client'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Trash2, Folder, FileIcon, AlertTriangle } from 'lucide-react'

interface OrphanFile {
    name: string
    path: string
    is_dir: boolean
    size: number
    modified: number
}

interface OrphansResponse {
    uploads_dir: string
    total_files_scanned: number
    orphan_count: number
    orphans: OrphanFile[]
}

function formatBytes(bytes: number) {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export default function AdminFiles() {
    const [data, setData] = useState<OrphansResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [purging, setPurging] = useState(false)

    const fetchOrphans = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get<OrphansResponse>('/admin/files/orphans')
            setData(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchOrphans()
    }, [fetchOrphans])

    const handlePurgeAll = async () => {
        if (!data || data.orphan_count === 0) return
        if (!confirm(`Permanently delete ${data.orphan_count} orphan file(s) totalling ${formatBytes(totalSize)}?`)) return
        setPurging(true)
        try {
            const res = await api.delete('/admin/files/orphans')
            const failed: any[] = res.data.failed || []
            alert(`Deleted ${res.data.deleted.length} item(s).${failed.length ? ` Failed: ${failed.length}` : ''}`)
            fetchOrphans()
        } catch (e) {
            console.error(e)
            alert('Purge failed')
        } finally {
            setPurging(false)
        }
    }

    const totalSize = data?.orphans.reduce((s, o) => s + o.size, 0) ?? 0

    return (
        <div className="space-y-4">
            <PageHeader title="Files & Orphans">
                <Button
                    variant="danger"
                    leftIcon={<Trash2 size={16} />}
                    onClick={handlePurgeAll}
                    isLoading={purging}
                    disabled={!data || data.orphan_count === 0}
                >
                    Purge all orphans
                </Button>
            </PageHeader>

            {data && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white shadow rounded p-4">
                        <div className="text-xs uppercase text-gray-500">Uploads directory</div>
                        <div className="font-mono text-xs mt-1 truncate" title={data.uploads_dir}>{data.uploads_dir}</div>
                    </div>
                    <div className="bg-white shadow rounded p-4">
                        <div className="text-xs uppercase text-gray-500">Items scanned</div>
                        <div className="text-2xl font-semibold mt-1">{data.total_files_scanned}</div>
                    </div>
                    <div className="bg-white shadow rounded p-4">
                        <div className="text-xs uppercase text-gray-500">Orphans</div>
                        <div className="text-2xl font-semibold mt-1 flex items-center gap-2">
                            {data.orphan_count}
                            {data.orphan_count > 0 && <AlertTriangle size={18} className="text-yellow-500" />}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{formatBytes(totalSize)} reclaimable</div>
                    </div>
                </div>
            )}

            <div className="bg-white shadow rounded-lg overflow-x-auto">
                {loading ? (
                    <LoadingState />
                ) : !data || data.orphans.length === 0 ? (
                    <EmptyState message="No orphan files. Uploads directory is clean." />
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Modified</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.orphans.map(o => (
                                <tr key={o.path}>
                                    <td className="px-4 py-2 text-sm font-mono">
                                        <span className="inline-flex items-center gap-2">
                                            {o.is_dir ? <Folder size={14} /> : <FileIcon size={14} />}
                                            {o.name}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-500">{o.is_dir ? 'directory' : 'file'}</td>
                                    <td className="px-4 py-2 text-sm">{formatBytes(o.size)}</td>
                                    <td className="px-4 py-2 text-xs text-gray-500">
                                        {new Date(o.modified * 1000).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
