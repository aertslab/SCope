import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Search, ExternalLink, Trash2, Users, Globe, Lock, Folder } from 'lucide-react'
import { useToast } from '../../context/ToastContext'

interface AdminProject {
    id: string
    name: string
    description: string | null
    visibility: 'private' | 'public' | 'password'
    owner_email: string | null
    dataset_count: number
    share_count: number
    created_at: string
}

interface ListResponse {
    total: number
    items: AdminProject[]
    limit: number
    offset: number
}

const PAGE = 50

function visBadge(v: string): 'default' | 'success' | 'warning' | 'info' {
    if (v === 'public') return 'success'
    if (v === 'password') return 'warning'
    return 'default'
}

export default function AdminProjects() {
    const { addToast } = useToast()
    const [data, setData] = useState<ListResponse | null>(null)
    const [page, setPage] = useState(0)
    const [search, setSearch] = useState('')
    const [debounced, setDebounced] = useState('')
    const [loading, setLoading] = useState(true)
    const [actingId, setActingId] = useState<string | null>(null)

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search), 300)
        return () => clearTimeout(t)
    }, [search])

    useEffect(() => { setPage(0) }, [debounced])

    const fetchPage = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) })
            if (debounced) params.set('search', debounced)
            const res = await api.get<ListResponse>(`/admin/projects?${params}`)
            setData(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [page, debounced])

    useEffect(() => { fetchPage() }, [fetchPage])

    const handleDelete = async (p: AdminProject) => {
        if (!confirm(
            `Delete project "${p.name}"? This removes the project, its shares, and its dataset links. ` +
            `The ${p.dataset_count} dataset(s) themselves are kept (just unlinked). This cannot be undone.`,
        )) return
        setActingId(p.id)
        try {
            await api.delete(`/admin/projects/${p.id}`)
            addToast('Project deleted', 'success')
            fetchPage()
        } catch (e: any) {
            addToast(e?.response?.data?.detail || 'Failed to delete project', 'error')
        } finally {
            setActingId(null)
        }
    }

    const total = data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / PAGE))

    return (
        <div className="space-y-4">
            <PageHeader title="Manage Projects">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search projects…"
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </PageHeader>

            <div className="text-sm text-gray-500">{total.toLocaleString()} project(s)</div>

            <div className="bg-white shadow rounded-lg overflow-x-auto">
                {loading && !data ? (
                    <LoadingState />
                ) : !data || data.items.length === 0 ? (
                    <EmptyState message="No projects found" icon={<Folder className="h-8 w-8 text-gray-300" />} />
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Visibility</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datasets</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shared</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.items.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 max-w-xs">
                                        <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                                        {p.description && <div className="text-xs text-gray-500 truncate">{p.description}</div>}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-500">{p.owner_email || '—'}</td>
                                    <td className="px-4 py-2">
                                        <Badge variant={visBadge(p.visibility)}>
                                            <span className="inline-flex items-center gap-1">
                                                {p.visibility === 'public' ? <Globe className="h-3 w-3" />
                                                    : p.visibility === 'password' ? <Lock className="h-3 w-3" /> : null}
                                                {p.visibility}
                                            </span>
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2 text-sm">{p.dataset_count}</td>
                                    <td className="px-4 py-2 text-sm">
                                        {p.share_count > 0 ? (
                                            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.share_count}</span>
                                        ) : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Link to={`/projects/${p.id}`} title="Manage (settings, shares, ownership)">
                                                <Button size="sm" variant="ghost" leftIcon={<ExternalLink className="h-4 w-4" />}>Manage</Button>
                                            </Link>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={actingId === p.id}
                                                onClick={() => handleDelete(p)}
                                                title="Delete project"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
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
