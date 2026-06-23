import { useCallback } from 'react'
import api from '../../api/client'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PanelSkeleton } from '../../components/ui/PanelSkeleton'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Cpu,
    HardDrive,
    MemoryStick,
    Database,
    Server,
    Workflow,
    RefreshCw,
    XOctagon,
    UploadCloud,
} from 'lucide-react'

interface ComponentStatus { status: 'ok' | 'error'; detail: string }
interface Storage {
    path: string
    exists: boolean
    disk_total?: number
    disk_used?: number
    disk_free?: number
    uploads_bytes?: number
    uploads_files?: number
    error?: string
}
interface SystemMetrics {
    available: boolean
    reason?: string
    cpu_percent?: number
    cpu_count?: number
    memory_total?: number
    memory_used?: number
    memory_percent?: number
    load_average?: number[] | null
    boot_time?: number
}
interface Health {
    status: 'ok' | 'degraded'
    timestamp: string
    components: { database: ComponentStatus; redis: ComponentStatus; celery: ComponentStatus & { workers?: unknown } }
    storage: Storage
    system: SystemMetrics
}

interface CeleryTaskInfo {
    id: string
    name: string
    args?: unknown
    kwargs?: unknown
    time_start?: number
}
interface Tasks {
    active: Record<string, CeleryTaskInfo[]>
    scheduled: Record<string, CeleryTaskInfo[]>
    reserved: Record<string, CeleryTaskInfo[]>
    stats: Record<string, unknown>
    error?: string
}

interface SystemConfig {
    project_name: string
    api_v1_str: string
    frontend_url: string
    database_url: string
    redis_url: string
    auth: Record<string, unknown>
    uploads: { max_upload_bytes: number }
    oauth: { google_configured: boolean; orcid_configured: boolean }
    cors_origins: string[]
    insecure_secrets_allowed: boolean
}

interface UploadInfo {
    id: string
    user_email: string
    name: string
    file_type: string
    total_bytes: number
    received_bytes: number
    started_at: number
    updated_at: number
}

function formatElapsed(startedAt?: number) {
    if (!startedAt) return '—'
    const secs = Math.max(0, Math.floor(Date.now() / 1000 - startedAt))
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatBytes(bytes?: number) {
    if (!bytes && bytes !== 0) return '—'
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

// Map action verbs returned by /admin/activity to short, readable phrases.
// Older creation events use snake_case ("project_created"); audit log entries
// use dotted verbs ("project.delete", "group.member.role_change").
const ACTIVITY_LABELS: Record<string, string> = {
    dataset_uploaded: 'uploaded dataset',
    project_created: 'created project',
    group_created: 'created group',
    'project.delete': 'deleted project',
    'project.ownership.transfer': 'transferred project',
    'group.delete': 'deleted group',
    'group.ownership.transfer': 'transferred group',
    'group.member.role_change': 'changed role in group',
    'dataset.trash': 'moved dataset to trash',
    'dataset.restore': 'restored dataset',
    'dataset.purge': 'permanently deleted dataset',
}

function describeActivity(type: string): string {
    if (ACTIVITY_LABELS[type]) return ACTIVITY_LABELS[type]
    // Best-effort humanization for any future verb the backend introduces.
    return type.replace(/[._]/g, ' ')
}

function StatusIcon({ status }: { status: 'ok' | 'error' }) {
    if (status === 'ok') return <CheckCircle2 className="text-green-500" size={20} />
    return <XCircle className="text-red-500" size={20} />
}

function ProgressBar({ value, max, tone = 'indigo' }: { value: number; max: number; tone?: string }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
    const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : `bg-${tone}-500`
    return (
        <div className="h-2 w-full bg-gray-200 rounded">
            <div className={`h-2 rounded ${color}`} style={{ width: `${pct}%` }} />
        </div>
    )
}

export default function AdminSystem() {
    // Each panel owns its own loader so a slow probe (typically Celery's
    // inspect RPCs) doesn't keep the rest of the System page blank.
    const health = useAsyncResource<Health>(
        () => api.get('/admin/health').then(r => r.data),
        [],
        { pollMs: 15000 },
    )
    const tasksRes = useAsyncResource<Tasks>(
        () => api.get('/admin/tasks').then(r => r.data),
        [],
        { pollMs: 15000 },
    )
    const configRes = useAsyncResource<SystemConfig>(
        () => api.get('/admin/config').then(r => r.data),
        [],
    )
    const activityRes = useAsyncResource<any[]>(
        () => api.get('/admin/activity?limit=25').then(r => r.data),
        [],
        { pollMs: 30000 },
    )
    // Polled often so the byte counts move visibly while an upload is in flight.
    const uploadsRes = useAsyncResource<UploadInfo[]>(
        () => api.get('/admin/uploads').then(r => r.data),
        [],
        { pollMs: 3000 },
    )

    const refreshAll = useCallback(() => {
        health.refetch()
        tasksRes.refetch()
        configRes.refetch()
        activityRes.refetch()
        uploadsRes.refetch()
    }, [health, tasksRes, configRes, activityRes, uploadsRes])

    const handleRevoke = async (taskId: string, terminate = false) => {
        if (!confirm(`Revoke task ${taskId}${terminate ? ' (terminate running task)' : ''}?`)) return
        try {
            await api.post(`/admin/tasks/${taskId}/revoke?terminate=${terminate}`)
            tasksRes.refetch()
        } catch (e) {
            console.error(e)
            alert('Failed to revoke task')
        }
    }

    const tasks = tasksRes.data
    const config = configRes.data
    const activity = activityRes.data ?? []
    const uploads = uploadsRes.data ?? []

    const flatTasks = (kind: 'active' | 'scheduled' | 'reserved') => {
        if (!tasks) return []
        const out: { worker: string; task: CeleryTaskInfo }[] = []
        Object.entries(tasks[kind] || {}).forEach(([worker, list]) => {
            (list || []).forEach(task => out.push({ worker, task }))
        })
        return out
    }

    const memUsed = health.data?.system?.memory_used ?? 0
    const memTotal = health.data?.system?.memory_total ?? 0
    const diskUsed = health.data?.storage?.disk_used ?? 0
    const diskTotal = health.data?.storage?.disk_total ?? 0

    return (
        <div className="space-y-6">
            <PageHeader title="System Health">
                <Button variant="outline" leftIcon={<RefreshCw size={16} />} onClick={refreshAll}>
                    Refresh
                </Button>
            </PageHeader>

            {/* Overall + components */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent>
                        <div className="text-xs uppercase text-gray-500">Overall</div>
                        <div className="mt-1 flex items-center gap-2">
                            {health.loading && !health.data ? (
                                <Badge>Checking…</Badge>
                            ) : health.error ? (
                                <Badge variant="error">Unavailable</Badge>
                            ) : health.data?.status === 'ok' ? (
                                <Badge variant="success">Healthy</Badge>
                            ) : (
                                <Badge variant="warning">Degraded</Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>
                {health.data && (['database', 'redis', 'celery'] as const).map(name => (
                    <Card key={name}>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                {name === 'database' && <Database size={16} className="text-gray-400" />}
                                {name === 'redis' && <Server size={16} className="text-gray-400" />}
                                {name === 'celery' && <Workflow size={16} className="text-gray-400" />}
                                <div className="text-xs uppercase text-gray-500">{name}</div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <StatusIcon status={health.data!.components[name].status} />
                                <span className="text-sm font-medium">
                                    {health.data!.components[name].status === 'ok' ? 'Online' : 'Offline'}
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 truncate" title={health.data!.components[name].detail}>
                                {health.data!.components[name].detail}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {!health.data && health.loading && (['database', 'redis', 'celery'] as const).map(name => (
                    <Card key={name}>
                        <CardContent>
                            <div className="text-xs uppercase text-gray-500 mb-2">{name}</div>
                            <PanelSkeleton rows={2} />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Resource usage */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <span className="inline-flex items-center gap-2"><Cpu size={18} /> CPU</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {health.loading && !health.data ? (
                            <PanelSkeleton rows={3} />
                        ) : health.data?.system.available ? (
                            <>
                                <div className="text-3xl font-semibold">{health.data.system.cpu_percent?.toFixed(1)}%</div>
                                <div className="text-xs text-gray-500">{health.data.system.cpu_count} cores</div>
                                <div className="mt-3"><ProgressBar value={health.data.system.cpu_percent || 0} max={100} /></div>
                                {health.data.system.load_average && (
                                    <div className="text-xs text-gray-500 mt-2">
                                        Load avg: {health.data.system.load_average.map(v => v.toFixed(2)).join(' / ')}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-sm text-gray-500">{health.data?.system.reason || 'Unavailable'}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            <span className="inline-flex items-center gap-2"><MemoryStick size={18} /> Memory</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {health.loading && !health.data ? (
                            <PanelSkeleton rows={3} />
                        ) : health.data?.system.available ? (
                            <>
                                <div className="text-3xl font-semibold">{health.data.system.memory_percent?.toFixed(1)}%</div>
                                <div className="text-xs text-gray-500">
                                    {formatBytes(memUsed)} / {formatBytes(memTotal)}
                                </div>
                                <div className="mt-3"><ProgressBar value={memUsed} max={memTotal || 1} /></div>
                            </>
                        ) : (
                            <div className="text-sm text-gray-500">{health.data?.system.reason || 'Unavailable'}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            <span className="inline-flex items-center gap-2"><HardDrive size={18} /> Storage</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {health.loading && !health.data ? (
                            <PanelSkeleton rows={3} />
                        ) : health.data?.storage.exists ? (
                            <>
                                <div className="text-3xl font-semibold">
                                    {formatBytes(diskUsed)}
                                </div>
                                <div className="text-xs text-gray-500">
                                    of {formatBytes(diskTotal)} • {formatBytes(health.data.storage.disk_free)} free
                                </div>
                                <div className="mt-3"><ProgressBar value={diskUsed} max={diskTotal || 1} /></div>
                                <div className="text-xs text-gray-500 mt-2">
                                    Uploads: {formatBytes(health.data.storage.uploads_bytes)} ({health.data.storage.uploads_files} files)
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-gray-500">Uploads directory not found</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Active uploads (in-flight, browser or API) */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        <span className="inline-flex items-center gap-2"><UploadCloud size={18} /> Active Uploads ({uploads.length})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {uploadsRes.loading && !uploadsRes.data ? (
                        <PanelSkeleton rows={2} />
                    ) : uploadsRes.error ? (
                        <div className="text-sm text-red-600">Failed to load uploads: {uploadsRes.error}</div>
                    ) : uploads.length === 0 ? (
                        <div className="text-sm text-gray-500 italic">No uploads in progress</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left">User</th>
                                        <th className="px-3 py-2 text-left">Dataset</th>
                                        <th className="px-3 py-2 text-left">Progress</th>
                                        <th className="px-3 py-2 text-left">Elapsed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {uploads.map(u => {
                                        const pct = u.total_bytes > 0
                                            ? Math.min(100, Math.round((u.received_bytes / u.total_bytes) * 100))
                                            : null
                                        return (
                                            <tr key={u.id} className="border-t">
                                                <td className="px-3 py-2 truncate">{u.user_email || '—'}</td>
                                                <td className="px-3 py-2 truncate">
                                                    {u.name || '—'}{' '}
                                                    <span className="text-gray-400 text-xs uppercase">{u.file_type}</span>
                                                </td>
                                                <td className="px-3 py-2 min-w-[14rem]">
                                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                        <span>
                                                            {formatBytes(u.received_bytes)}
                                                            {u.total_bytes > 0 && <> / {formatBytes(u.total_bytes)}</>}
                                                        </span>
                                                        <span>{pct !== null ? `${pct}%` : 'streaming…'}</span>
                                                    </div>
                                                    {pct !== null ? (
                                                        <ProgressBar value={u.received_bytes} max={u.total_bytes} />
                                                    ) : (
                                                        // No Content-Length: show an indeterminate bar.
                                                        <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                                                            <div className="h-2 w-1/3 bg-indigo-400 animate-pulse rounded" />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatElapsed(u.started_at)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tasks */}
            <Card>
                <CardHeader>
                    <CardTitle>Celery Tasks</CardTitle>
                    {tasks?.error && (
                        <div className="text-sm text-yellow-700 flex items-center gap-1 mt-1">
                            <AlertTriangle size={14} /> {tasks.error}
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {tasksRes.loading && !tasks ? (
                        <PanelSkeleton rows={4} />
                    ) : tasksRes.error ? (
                        <div className="text-sm text-red-600">Failed to load tasks: {tasksRes.error}</div>
                    ) : (
                        (['active', 'reserved', 'scheduled'] as const).map(kind => {
                        const items = flatTasks(kind)
                        return (
                            <div key={kind} className="mb-4 last:mb-0">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-medium capitalize">{kind} ({items.length})</div>
                                </div>
                                {items.length === 0 ? (
                                    <div className="text-xs text-gray-500 italic">None</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Worker</th>
                                                    <th className="px-3 py-2 text-left">Task</th>
                                                    <th className="px-3 py-2 text-left">ID</th>
                                                    <th className="px-3 py-2"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map(({ worker, task }) => (
                                                    <tr key={task.id} className="border-t">
                                                        <td className="px-3 py-2 font-mono text-xs">{worker}</td>
                                                        <td className="px-3 py-2">{task.name}</td>
                                                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{task.id}</td>
                                                        <td className="px-3 py-2 text-right">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleRevoke(task.id, kind === 'active')}
                                                                leftIcon={<XOctagon size={14} />}
                                                            >
                                                                {kind === 'active' ? 'Terminate' : 'Revoke'}
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )
                    })
                    )}
                </CardContent>
            </Card>

            {/* Activity feed */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    {activityRes.loading && !activityRes.data ? (
                        <PanelSkeleton rows={4} />
                    ) : activityRes.error ? (
                        <div className="text-sm text-red-600">Failed to load activity: {activityRes.error}</div>
                    ) : activity.length === 0 ? (
                        <div className="text-sm text-gray-500 italic">No recent activity</div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {activity.map((e, i) => (
                                <li key={i} className="py-2 text-sm flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <span className="font-medium">{e.actor || 'system'}</span>{' '}
                                        <span className="text-gray-500">{describeActivity(e.type)}</span>{' '}
                                        <span className="font-medium truncate">{e.subject}</span>
                                        {e.status && <Badge variant="info" className="ml-2">{e.status}</Badge>}
                                    </div>
                                    <span className="text-xs text-gray-400 whitespace-nowrap">
                                        {new Date(e.timestamp).toLocaleString()}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {/* Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                    {configRes.loading && !config ? (
                        <PanelSkeleton rows={6} />
                    ) : configRes.error ? (
                        <div className="text-sm text-red-600">Failed to load config: {configRes.error}</div>
                    ) : config && (
                        <>
                            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <div className="flex justify-between"><dt className="text-gray-500">Project</dt><dd>{config.project_name}</dd></div>
                                <div className="flex justify-between"><dt className="text-gray-500">API base</dt><dd className="font-mono text-xs">{config.api_v1_str}</dd></div>
                                <div className="flex justify-between"><dt className="text-gray-500">Frontend URL</dt><dd className="font-mono text-xs truncate">{config.frontend_url}</dd></div>
                                <div className="flex justify-between"><dt className="text-gray-500">Database</dt><dd className="font-mono text-xs truncate">{config.database_url}</dd></div>
                                <div className="flex justify-between"><dt className="text-gray-500">Redis</dt><dd className="font-mono text-xs truncate">{config.redis_url}</dd></div>
                                <div className="flex justify-between"><dt className="text-gray-500">Max upload</dt><dd>{formatBytes(config.uploads.max_upload_bytes)}</dd></div>
                                <div className="flex justify-between">
                                    <dt className="text-gray-500">Google OAuth</dt>
                                    <dd>{config.oauth.google_configured ? <Badge variant="success">Configured</Badge> : <Badge>Not set</Badge>}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-gray-500">ORCID OAuth</dt>
                                    <dd>{config.oauth.orcid_configured ? <Badge variant="success">Configured</Badge> : <Badge>Not set</Badge>}</dd>
                                </div>
                                <div className="flex justify-between"><dt className="text-gray-500">Cookie SameSite</dt><dd>{String(config.auth.cookie_samesite)}</dd></div>
                                <div className="flex justify-between"><dt className="text-gray-500">Cookie Secure</dt><dd>{String(config.auth.cookie_secure)}</dd></div>
                                <div className="flex justify-between"><dt className="text-gray-500">Token expiry</dt><dd>{String(config.auth.access_token_expire_minutes)} min</dd></div>
                                <div className="flex justify-between">
                                    <dt className="text-gray-500">Insecure secrets allowed</dt>
                                    <dd>{config.insecure_secrets_allowed
                                        ? <Badge variant="error">Yes</Badge>
                                        : <Badge variant="success">No</Badge>}
                                    </dd>
                                </div>
                            </dl>
                            <div className="mt-4">
                                <div className="text-xs text-gray-500 uppercase mb-1">CORS Origins</div>
                                <div className="flex flex-wrap gap-1">
                                    {config.cors_origins.map(o => (
                                        <span key={o} className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{o}</span>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
