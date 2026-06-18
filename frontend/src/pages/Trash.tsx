import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { useToast } from '../context/ToastContext'
import { useAuthStore } from '../store/useAuthStore'
import { Button } from '../components/ui/Button'
import { ArrowLeft, Trash2, RotateCcw, Trash as TrashIcon, FolderClosed, Clock } from 'lucide-react'
import { formatBytes } from '../utils/format'

interface TrashProjectRef {
  id: string
  name: string
  visibility: string
}

interface TrashedDataset {
  id: string
  name: string
  file_type: string
  status: string
  file_size?: number
  created_at: string
  deleted_at?: string | null
  projects: TrashProjectRef[]
  project_count: number
  // Null while the dataset is still linked to a project (then it is retained).
  auto_purge_at?: string | null
}

export default function Trash() {
  const [items, setItems] = useState<TrashedDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const { addToast } = useToast()
  // Permanent purge is admin-only — it can destroy data other users rely on via
  // their projects. Regular users restore here, or ask an admin to remove it.
  const isAdmin = useAuthStore((s) => s.user?.is_superuser ?? false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get<TrashedDataset[]>('/datasets/trash')
      setItems(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const restore = async (id: string) => {
    setActingId(id)
    try {
      await api.post(`/datasets/${id}/restore`)
      addToast('Dataset restored', 'success')
      await load()
    } finally {
      setActingId(null)
    }
  }

  const purge = async (id: string) => {
    if (
      !confirm(
        'Permanently delete this dataset — files, database records, and any share links / sessions referencing it? This cannot be undone.',
      )
    ) {
      return
    }
    setActingId(id)
    try {
      await api.delete(`/datasets/${id}/purge`)
      addToast('Dataset permanently deleted', 'success')
      await load()
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        to="/my-datasets"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to datasets
      </Link>

      <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <TrashIcon className="h-5 w-5 text-gray-500" />
          <h1 className="text-lg font-semibold text-gray-900">Trash</h1>
          <span className="text-xs text-gray-500 ml-2">
            Soft-deleted datasets. Datasets not in any project are removed
            automatically after the retention window.
            {!isAdmin && ' Need one gone for good? Ask an admin — permanent deletion is admin-only.'}
          </span>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Trash is empty.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((d) => (
              <li
                key={d.id}
                className="px-6 py-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {d.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {d.file_type.toUpperCase()}
                    {' · '}
                    {formatBytes(d.file_size || 0)}
                    {' · deleted '}
                    {d.deleted_at ? new Date(d.deleted_at).toLocaleDateString() : 'recently'}
                  </div>
                  {/* Retention / linkage state */}
                  {d.project_count > 0 ? (
                    <div
                      className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600"
                      title={d.projects.map((p) => p.name).join(', ')}
                    >
                      <FolderClosed className="h-3.5 w-3.5" />
                      Retained — still in {d.project_count} project{d.project_count > 1 ? 's' : ''}
                      {' ('}
                      {d.projects.slice(0, 3).map((p) => p.name).join(', ')}
                      {d.projects.length > 3 ? '…' : ''})
                    </div>
                  ) : (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-red-500">
                      <Clock className="h-3.5 w-3.5" />
                      Not in any project — auto-deletes
                      {d.auto_purge_at
                        ? ` on ${new Date(d.auto_purge_at).toLocaleDateString()}`
                        : ' soon'}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actingId === d.id}
                    onClick={() => restore(d.id)}
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                  >
                    Restore
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={actingId === d.id}
                      onClick={() => purge(d.id)}
                      leftIcon={<Trash2 className="h-4 w-4" />}
                    >
                      Delete forever
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
