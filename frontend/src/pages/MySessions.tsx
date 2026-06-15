import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { Trash2, ExternalLink, Copy } from 'lucide-react'
import { useToast } from '../context/ToastContext'

interface SessionRow {
    id: string
    name?: string | null
    created_at: string
    expires_at?: string | null
    created_by?: string | null
}

export default function MySessions() {
    const { addToast } = useToast()
    const [sessions, setSessions] = useState<SessionRow[]>([])
    const [loading, setLoading] = useState(true)

    const fetchSessions = async () => {
        try {
            const res = await api.get('/sessions/me')
            setSessions(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchSessions() }, [])

    const handleDelete = async (sid: string) => {
        if (!confirm('Delete this session? Anyone with the link will lose access.')) return
        try {
            await api.delete(`/sessions/me/${sid}`)
            setSessions((prev) => prev.filter((s) => s.id !== sid))
            addToast('Session deleted', 'success')
        } catch {
            // global interceptor surfaces error
        }
    }

    const handleCopy = (sid: string) => {
        const url = `${window.location.origin}/s/${sid}`
        navigator.clipboard.writeText(url)
        addToast('Session link copied', 'success')
    }

    if (loading) {
        return <div className="p-8 text-gray-500">Loading sessions…</div>
    }

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">My Sessions</h1>
            <p className="text-sm text-gray-500 mb-6">
                Saved viewer sessions tied to your account. Share the link to let others
                load the same view.
            </p>

            {sessions.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                    No sessions yet. Open a dataset and save a session from the viewer.
                </div>
            ) : (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <ul className="divide-y divide-gray-200">
                        {sessions.map((s) => (
                            <li key={s.id} className="px-4 py-4 flex items-center justify-between">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900 truncate">
                                            {s.name || 'Untitled session'}
                                        </span>
                                        <code className="text-xs text-gray-500 truncate">{s.id}</code>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Created {new Date(s.created_at).toLocaleString()}
                                        {s.expires_at && (
                                            <> • Expires {new Date(s.expires_at).toLocaleString()}</>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <button
                                        onClick={() => handleCopy(s.id)}
                                        className="p-2 text-gray-500 hover:text-gray-700"
                                        title="Copy link"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                    <Link
                                        to={`/s/${s.id}`}
                                        className="p-2 text-indigo-600 hover:text-indigo-800"
                                        title="Open"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(s.id)}
                                        className="p-2 text-red-600 hover:text-red-800"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
