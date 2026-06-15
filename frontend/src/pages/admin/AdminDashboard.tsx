import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import {
    Trash2,
    AlertCircle,
    CheckCircle,
    Clock,
    Loader2,
    Users,
    Database,
    Folder,
    Users as GroupsIcon,
    Link as LinkIcon,
    Server,
    HardDrive,
    Shield,
    RotateCcw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { PanelSkeleton } from '../../components/ui/PanelSkeleton'
import { useAsyncResource } from '../../hooks/useAsyncResource'

interface AdminStats {
    total_users: number
    active_users: number
    admin_users: number
    total_datasets: number
    total_projects: number
    total_groups: number
    total_sessions: number
    total_data_files: number
    dataset_status_counts: Record<string, number>
    total_uploaded_bytes: number
    total_converted_bytes: number
    system_status: string
}

interface ProcessingDataset {
    id: string
    name: string
    status: string
    created_at: string
    owner_email: string
    projects: string[]
}

interface HealthSummary {
    status: 'ok' | 'degraded'
    components: Record<string, { status: 'ok' | 'error'; detail: string }>
    storage: { disk_used?: number; disk_total?: number; uploads_bytes?: number }
    system: { available: boolean; cpu_percent?: number; memory_percent?: number }
}

function formatBytes(bytes: number) {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function StatCard({
    label, value, icon, to, hint,
}: { label: string; value: string | number; icon: React.ReactNode; to?: string; hint?: string }) {
    const inner = (
        <Card className={to ? 'hover:shadow-md transition-shadow' : ''}>
            <CardContent>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
                        <div className="mt-1 text-3xl font-semibold text-gray-900">{value}</div>
                        {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
                    </div>
                    <div className="text-gray-400">{icon}</div>
                </div>
            </CardContent>
        </Card>
    )
    return to ? <Link to={to}>{inner}</Link> : inner
}

function StatCardSkeleton() {
    return (
        <Card>
            <CardContent>
                <PanelSkeleton rows={2} />
            </CardContent>
        </Card>
    )
}

export default function AdminDashboard() {
    // Each resource fetches independently so a slow endpoint doesn't block
    // the rest of the dashboard from rendering.
    const stats = useAsyncResource<AdminStats>(
        () => api.get('/admin/stats').then(r => r.data),
        [],
        { pollMs: 30000 },
    )
    const procResource = useAsyncResource<ProcessingDataset[]>(
        () => api.get('/admin/processing-datasets').then(r => r.data),
        [],
        { pollMs: 8000 },
    )
    const health = useAsyncResource<HealthSummary>(
        () => api.get('/admin/health').then(r => r.data),
        [],
        { pollMs: 30000 },
    )

    const processingDatasets = procResource.data ?? []

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm('Delete this dataset? This action cannot be undone.')) return
        try {
            await api.delete(`/datasets/${id}`)
            procResource.refetch()
            stats.refetch()
        } catch (e) {
            console.error(e)
            alert('Failed to delete dataset')
        }
    }, [procResource, stats])

    const handleReconvert = useCallback(async (id: string) => {
        try {
            await api.post(`/admin/datasets/${id}/reconvert`)
            procResource.refetch()
        } catch (e: any) {
            alert(e?.response?.data?.detail || 'Failed to reconvert')
        }
    }, [procResource])

    const getStatusIcon = (status: string) => {
        if (status.startsWith('processing')) return <Loader2 className="animate-spin text-blue-500" size={18} />
        switch (status) {
            case 'pending': return <Clock className="text-yellow-500" size={18} />
            case 'failed': return <AlertCircle className="text-red-500" size={18} />
            case 'ready': return <CheckCircle className="text-green-500" size={18} />
            default: return <Clock size={18} />
        }
    }

    const getTimeElapsed = (dateString: string) => {
        const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
        if (diff < 60) return `${diff}s ago`
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
        return `${Math.floor(diff / 86400)}d ago`
    }

    const statusEntries = useMemo(
        () => Object.entries(stats.data?.dataset_status_counts ?? {}),
        [stats.data],
    )

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Dashboard Overview</h1>

            {/* Health badges */}
            <Card>
                <CardContent>
                    {health.loading && !health.data ? (
                        <PanelSkeleton rows={1} label="Loading system health…" />
                    ) : health.error ? (
                        <div className="text-sm text-red-600">Health unavailable: {health.error}</div>
                    ) : health.data && (
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Server size={18} className="text-gray-400" />
                                <span className="text-sm font-medium">System</span>
                                <Badge variant={health.data.status === 'ok' ? 'success' : 'warning'}>
                                    {health.data.status === 'ok' ? 'Healthy' : 'Degraded'}
                                </Badge>
                            </div>
                            {Object.entries(health.data.components).map(([name, c]) => (
                                <div key={name} className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500 capitalize">{name}</span>
                                    <Badge variant={c.status === 'ok' ? 'success' : 'error'}>
                                        {c.status === 'ok' ? 'OK' : 'Down'}
                                    </Badge>
                                </div>
                            ))}
                            {health.data.system.available && (
                                <>
                                    <span className="text-sm text-gray-500">CPU {health.data.system.cpu_percent?.toFixed(0)}%</span>
                                    <span className="text-sm text-gray-500">RAM {health.data.system.memory_percent?.toFixed(0)}%</span>
                                </>
                            )}
                            {health.data.storage.disk_total != null && (
                                <span className="text-sm text-gray-500">
                                    Disk {formatBytes(health.data.storage.disk_used || 0)} / {formatBytes(health.data.storage.disk_total)}
                                </span>
                            )}
                            <Link to="/admin/system" className="text-sm text-indigo-600 hover:underline ml-auto">
                                View details →
                            </Link>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.loading && !stats.data ? (
                    Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
                ) : stats.error ? (
                    <div className="col-span-full text-sm text-red-600">Stats unavailable: {stats.error}</div>
                ) : stats.data && (
                    <>
                        <StatCard
                            label="Users" value={stats.data.total_users}
                            icon={<Users size={28} />}
                            hint={`${stats.data.active_users} active · ${stats.data.admin_users} admin`}
                            to="/admin/users"
                        />
                        <StatCard
                            label="Datasets" value={stats.data.total_datasets}
                            icon={<Database size={28} />}
                            hint={`${stats.data.total_data_files} unique files`}
                            to="/admin/datasets"
                        />
                        <StatCard
                            label="Projects" value={stats.data.total_projects}
                            icon={<Folder size={28} />} to="/admin/projects"
                        />
                        <StatCard
                            label="Groups" value={stats.data.total_groups}
                            icon={<GroupsIcon size={28} />} to="/admin/groups"
                        />
                        <StatCard
                            label="Storage Used"
                            value={formatBytes(stats.data.total_uploaded_bytes + stats.data.total_converted_bytes)}
                            icon={<HardDrive size={28} />}
                            hint={`${formatBytes(stats.data.total_uploaded_bytes)} raw · ${formatBytes(stats.data.total_converted_bytes)} converted`}
                            to="/admin/files"
                        />
                        <StatCard
                            label="Sessions"
                            value={stats.data.total_sessions}
                            icon={<LinkIcon size={28} />}
                            hint="Shared viewer links"
                            to="/admin/sessions"
                        />
                        <StatCard
                            label="Admins"
                            value={stats.data.admin_users}
                            icon={<Shield size={28} />}
                        />
                        <StatCard
                            label="Status"
                            value={stats.data.system_status}
                            icon={<Server size={28} />}
                        />
                    </>
                )}
            </div>

            {/* Dataset status breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Dataset Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                    {stats.loading && !stats.data ? (
                        <PanelSkeleton rows={1} />
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {statusEntries.length === 0 && (
                                <span className="text-sm text-gray-500">No datasets yet.</span>
                            )}
                            {statusEntries.map(([status, count]) => (
                                <div key={status} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded">
                                    <span className="text-sm capitalize">{status}</span>
                                    <Badge variant={
                                        status === 'ready' ? 'success' :
                                        status === 'failed' ? 'error' :
                                        status === 'pending' ? 'warning' : 'info'
                                    }>{count}</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Processing queue */}
            <Card>
                <CardHeader>
                    <CardTitle>Processing Queue</CardTitle>
                    <p className="mt-1 text-sm text-gray-500">
                        Datasets currently being processed, queued, or failed.
                    </p>
                </CardHeader>
                {procResource.loading && !procResource.data ? (
                    <div className="px-4 py-4 sm:px-6">
                        <PanelSkeleton rows={3} />
                    </div>
                ) : procResource.error ? (
                    <div className="px-4 py-4 sm:px-6 text-sm text-red-600">
                        Failed to load processing queue: {procResource.error}
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-200">
                        {processingDatasets.length === 0 && (
                            <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                                No active processing tasks
                            </li>
                        )}
                        {processingDatasets.map((ds) => (
                            <li key={ds.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center min-w-0 gap-4">
                                        {getStatusIcon(ds.status)}
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-indigo-600 truncate">{ds.name}</p>
                                            <div className="flex text-xs text-gray-500 gap-2">
                                                <span className="truncate">{ds.owner_email}</span>
                                                <span>•</span>
                                                <span>{getTimeElapsed(ds.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant={
                                            ds.status === 'failed' ? 'error' :
                                            ds.status === 'pending' ? 'warning' : 'info'
                                        }>{ds.status}</Badge>
                                        {ds.status === 'failed' && (
                                            <button
                                                onClick={() => handleReconvert(ds.id)}
                                                className="text-gray-400 hover:text-indigo-600"
                                                title="Reconvert"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(ds.id)}
                                            className="text-gray-400 hover:text-red-500"
                                            title="Delete dataset"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    )
}
