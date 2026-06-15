import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { useToast } from '../context/ToastContext'
import { Button } from '../components/ui/Button'
import { Dataset } from '../types'
import { ArrowLeft, Trash2, RotateCcw, Trash } from 'lucide-react'
import { formatBytes } from '../utils/format'

export default function Trash() {
  const [items, setItems] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const { addToast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get<Dataset[]>('/datasets/trash')
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
        'Permanently delete this dataset and its files? This cannot be undone.',
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
          <Trash className="h-5 w-5 text-gray-500" />
          <h1 className="text-lg font-semibold text-gray-900">Trash</h1>
          <span className="text-xs text-gray-500 ml-2">
            Soft-deleted datasets — restore or permanently delete.
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
                    {formatBytes((d as Dataset & { file_size?: number }).file_size || 0)}
                    {' · deleted '}
                    {(d as Dataset & { deleted_at?: string }).deleted_at
                      ? new Date(
                          (d as Dataset & { deleted_at?: string }).deleted_at!,
                        ).toLocaleString()
                      : 'recently'}
                  </div>
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
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={actingId === d.id}
                    onClick={() => purge(d.id)}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Delete forever
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
