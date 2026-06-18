import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Dataset } from '../types'
import {
    Trash2, ExternalLink, Upload, FileText, Edit, Download, RefreshCw,
    Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Users, Globe, Lock, FileDown,
} from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { EditDatasetModal } from '../components/EditDatasetModal'
import { DeleteDatasetModal } from '../components/DeleteDatasetModal'
import { ReplaceDatasetModal } from '../components/ReplaceDatasetModal'
import { downloadDatasetFile, downloadDatasetExport } from '../utils/download'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useDatasetStore, DatasetQuery } from '../store/useDatasetStore'
import { UploadDatasetForm } from '../components/UploadDatasetForm'
import { DatasetStatusBadge } from '../components/DatasetStatusBadge'
import { PageHeader } from '../components/ui/PageHeader'
import { LoadingState } from '../components/ui/LoadingState'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/Modal'
import { formatBytes } from '../utils/format'
import { useDatasetEvents } from '../hooks/useDatasetEvents'

const PAGE_SIZE = 25

type SortKey = NonNullable<DatasetQuery['sort_by']>

const STATUS_OPTIONS = ['', 'ready', 'processing', 'pending', 'failed'] as const

export default function MyDatasets() {
    const { addToast } = useToast()
    const { datasets, total, isLoading, fetchDatasets } = useDatasetStore()

    // Server-driven list controls
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [sortBy, setSortBy] = useState<SortKey>('created_at')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [page, setPage] = useState(0)

    // Modals
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [editingDataset, setEditingDataset] = useState<Dataset | null>(null)
    const [deletingDataset, setDeletingDataset] = useState<Dataset | null>(null)
    const [replacingDataset, setReplacingDataset] = useState<Dataset | null>(null)

    // Debounce the free-text search so we don't fire a request per keystroke.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300)
        return () => clearTimeout(t)
    }, [search])

    // Reset to the first page whenever a filter/sort changes.
    useEffect(() => {
        setPage(0)
    }, [debouncedSearch, statusFilter, sortBy, sortOrder])

    const query: DatasetQuery = useMemo(() => ({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
    }), [debouncedSearch, statusFilter, sortBy, sortOrder, page])

    const hasPendingWork = datasets.some(
        (d) => d.status === 'pending' || d.status === 'processing'
    )

    useEffect(() => {
        fetchDatasets(query)
        // Poll only while something is converting, preserving the active query.
        // This is the fallback; live updates arrive instantly via SSE below.
        if (!hasPendingWork) return
        const interval = setInterval(() => fetchDatasets(query), 5000)
        return () => clearInterval(interval)
    }, [fetchDatasets, query, hasPendingWork])

    // Instant refresh when the worker reports a status change for our datasets.
    useDatasetEvents(() => { fetchDatasets(query) })

    const handleDownload = async (ds: Dataset) => {
        try {
            await downloadDatasetFile(ds.id, `${ds.name}.${ds.file_type}`)
        } catch (err: unknown) {
            const e = err as { response?: { status?: number; data?: { detail?: string } } }
            addToast(e.response?.data?.detail || 'Download failed', 'error')
        }
    }

    const [exportingId, setExportingId] = useState<string | null>(null)
    const handleExport = async (ds: Dataset) => {
        setExportingId(ds.id)
        addToast('Preparing h5ad export — this may take a moment for large datasets…', 'info')
        try {
            await downloadDatasetExport(ds.id, `${ds.name}.h5ad`)
        } catch (err: unknown) {
            const e = err as { response?: { data?: { detail?: string } } }
            addToast(e.response?.data?.detail || 'Export failed', 'error')
        } finally {
            setExportingId(null)
        }
    }

    const toggleSort = (key: SortKey) => {
        if (sortBy === key) {
            setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortBy(key)
            setSortOrder(key === 'name' ? 'asc' : 'desc')
        }
    }

    const SortHeader = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
        <th className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${className || ''}`}>
            <button className="inline-flex items-center gap-1 hover:text-gray-700" onClick={() => toggleSort(k)}>
                {label}
                {sortBy === k && (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
            </button>
        </th>
    )

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return (
        <div className="space-y-6">
            <PageHeader title="My Datasets">
                <div className="flex items-center gap-2">
                    <Link to="/trash">
                        <Button variant="ghost" leftIcon={<Trash2 className="w-4 h-4" />}>Trash</Button>
                    </Link>
                    <Button onClick={() => setIsUploadModalOpen(true)} leftIcon={<Upload className="w-4 h-4" />}>
                        Upload Dataset
                    </Button>
                </div>
            </PageHeader>

            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search datasets by name or description…"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s ? s[0].toUpperCase() + s.slice(1) : 'All statuses'}</option>
                    ))}
                </select>
            </div>

            <Card className="overflow-hidden">
                {isLoading && datasets.length === 0 ? (
                    <LoadingState />
                ) : datasets.length === 0 ? (
                    <EmptyState
                        message={debouncedSearch || statusFilter ? 'No datasets match your filters.' : "You haven't uploaded any datasets yet."}
                        icon={<FileText className="h-8 w-8 text-gray-300" />}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <SortHeader label="Name" k="name" />
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Project(s)</th>
                                    <SortHeader label="Uploaded" k="created_at" />
                                    <SortHeader label="Size" k="file_size" />
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shared with</th>
                                    <SortHeader label="Status" k="status" />
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {datasets.map((ds) => (
                                    <tr key={ds.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 max-w-xs">
                                            <div className="flex items-center gap-2">
                                                {ds.visibility === 'public' ? <Globe className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                                    : ds.visibility === 'password' ? <Lock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                                                        : null}
                                                <span className="text-sm font-medium text-gray-900 truncate">{ds.name}</span>
                                            </div>
                                            {ds.description && <div className="text-xs text-gray-500 truncate">{ds.description}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 max-w-[12rem]">
                                            {ds.projects && ds.projects.length > 0
                                                ? <span className="truncate block" title={ds.projects.map((p) => p.name).join(', ')}>
                                                    {ds.projects.map((p) => p.name).join(', ')}
                                                  </span>
                                                : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                            {new Date(ds.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                            {formatBytes(ds.file_size)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {ds.shared_with && ds.shared_with.length > 0 ? (
                                                <span className="inline-flex items-center gap-1" title={ds.shared_with.join(', ')}>
                                                    <Users className="h-3.5 w-3.5" /> {ds.shared_with.length}
                                                </span>
                                            ) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <DatasetStatusBadge status={ds.status} failureReason={ds.failure_reason} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {ds.status === 'ready' && (
                                                    <Link to={`/viewer/${ds.id}`}>
                                                        <Button size="sm" variant="ghost" title="View"><ExternalLink className="h-4 w-4" /></Button>
                                                    </Link>
                                                )}
                                                <Button size="sm" variant="ghost" onClick={() => handleDownload(ds)} title="Download original file" aria-label="Download original file"><Download className="h-4 w-4" /></Button>
                                                {ds.status === 'ready' && (
                                                    <Button size="sm" variant="ghost" disabled={exportingId === ds.id} onClick={() => handleExport(ds)} title="Export converted data as .h5ad" aria-label="Export as h5ad"><FileDown className="h-4 w-4" /></Button>
                                                )}
                                                <Button size="sm" variant="ghost" onClick={() => setReplacingDataset(ds)} title="Replace file" aria-label="Replace file"><RefreshCw className="h-4 w-4" /></Button>
                                                <Button size="sm" variant="ghost" onClick={() => setEditingDataset(ds)} title="Edit"><Edit className="h-4 w-4" /></Button>
                                                <Button size="sm" variant="ghost" onClick={() => setDeletingDataset(ds)} title="Delete" className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination footer */}
                {total > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
                        <span>
                            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} aria-label="Previous page">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span>Page {page + 1} / {totalPages}</span>
                            <Button size="sm" variant="ghost" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Upload Dataset">
                <UploadDatasetForm
                    onSuccess={() => {
                        setIsUploadModalOpen(false)
                        addToast('Dataset uploaded successfully! Processing started.', 'success')
                        fetchDatasets(query)
                    }}
                    onCancel={() => setIsUploadModalOpen(false)}
                    hideTitle={true}
                    className="border-0 shadow-none p-0"
                />
            </Modal>

            <EditDatasetModal
                isOpen={!!editingDataset}
                onClose={() => setEditingDataset(null)}
                dataset={editingDataset}
                onUpdate={() => fetchDatasets(query)}
            />

            <DeleteDatasetModal
                isOpen={!!deletingDataset}
                onClose={() => setDeletingDataset(null)}
                dataset={deletingDataset}
            />

            <ReplaceDatasetModal
                isOpen={!!replacingDataset}
                onClose={() => setReplacingDataset(null)}
                dataset={replacingDataset}
            />
        </div>
    )
}
