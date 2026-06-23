import { useEffect, useState, useMemo, useCallback, ReactNode } from 'react'
import { useDatasetStore, DatasetQuery } from '../store/useDatasetStore'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/Modal'
import {
  Upload, FileText, ExternalLink, Trash2, Edit, Search, ArrowRight,
  Database, CheckCircle2, Loader2, AlertTriangle,
} from 'lucide-react'
import { UploadDatasetForm } from '../components/UploadDatasetForm'
import { DatasetStatusBadge } from '../components/DatasetStatusBadge'
import { DeleteDatasetModal } from '../components/DeleteDatasetModal'
import { EditDatasetModal } from '../components/EditDatasetModal'
import { Dataset } from '../types'
import { formatBytes } from '../utils/format'
import { useDatasetEvents } from '../hooks/useDatasetEvents'

// The dashboard is a compact landing/overview — recent activity plus at-a-glance
// status counts. Full search/sort/paginate management lives in My Datasets, so
// here we keep rows dense and cap the list, with a clear path to the full table.
const RECENT_LIMIT = 8

interface Counts {
  total: number
  ready: number
  failed: number
}

export default function Dashboard() {
  const { datasets, total, isLoading, fetchDatasets } = useDatasetStore()
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [deletingDataset, setDeletingDataset] = useState<Dataset | null>(null)
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [counts, setCounts] = useState<Counts>({ total: 0, ready: 0, failed: 0 })

  // Debounce the quick-search so each keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const query: DatasetQuery = useMemo(() => ({
    search: debouncedSearch || undefined,
    sort_by: 'created_at',
    sort_order: 'desc',
    skip: 0,
    limit: RECENT_LIMIT,
  }), [debouncedSearch])

  // Status counts are cheap total-only reads (limit 1); "in progress" is derived
  // as total − ready − failed so we don't need a query per non-terminal state.
  const loadCounts = useCallback(async () => {
    try {
      const [all, ready, failed] = await Promise.all([
        api.get('/datasets/', { params: { limit: 1 } }),
        api.get('/datasets/', { params: { limit: 1, status: 'ready' } }),
        api.get('/datasets/', { params: { limit: 1, status: 'failed' } }),
      ])
      setCounts({
        total: all.data.total ?? 0,
        ready: ready.data.total ?? 0,
        failed: failed.data.total ?? 0,
      })
    } catch {
      /* non-critical summary — leave prior counts on failure */
    }
  }, [])

  const inProgress = Math.max(0, counts.total - counts.ready - counts.failed)
  const hasPendingWork = datasets.some(
    (d) => d.status === 'pending' || d.status === 'processing'
  )

  useEffect(() => {
    fetchDatasets(query)
    loadCounts()
    // Polling fallback only while work is in flight; SSE delivers instant updates.
    if (!hasPendingWork) return
    const interval = setInterval(() => {
      fetchDatasets(query)
      loadCounts()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchDatasets, query, loadCounts, hasPendingWork])

  useDatasetEvents(() => { fetchDatasets(query); loadCounts() })

  const refresh = () => { fetchDatasets(query); loadCounts() }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard">
        <Button onClick={() => setIsUploadOpen(true)} leftIcon={<Upload className="w-4 h-4" />}>
          Upload New Dataset
        </Button>
      </PageHeader>

      {/* At-a-glance status counts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total datasets" value={counts.total} icon={<Database className="h-5 w-5" />} tone="indigo" />
        <StatCard label="Ready" value={counts.ready} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <StatCard label="In progress" value={inProgress} icon={<Loader2 className="h-5 w-5" />} tone="amber" />
        <StatCard label="Failed" value={counts.failed} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Recent datasets</h3>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your datasets…"
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {isLoading && datasets.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">Loading…</div>
        ) : datasets.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              {debouncedSearch ? 'No datasets match your search.' : 'No datasets uploaded yet.'}
            </p>
            {!debouncedSearch && (
              <Button className="mt-4" size="sm" onClick={() => setIsUploadOpen(true)} leftIcon={<Upload className="w-4 h-4" />}>
                Upload your first dataset
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {datasets.map((dataset) => (
              <li key={dataset.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-indigo-50">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">{dataset.name}</span>
                    <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {dataset.file_type}
                    </span>
                  </div>
                  <div className="truncate text-xs text-gray-400">
                    {new Date(dataset.created_at).toLocaleDateString()}
                    {dataset.file_size ? ` · ${formatBytes(dataset.file_size)}` : ''}
                    {dataset.description ? ` · ${dataset.description}` : ''}
                  </div>
                </div>
                <DatasetStatusBadge status={dataset.status} failureReason={dataset.failure_reason} />
                <div className="flex flex-shrink-0 items-center gap-0.5">
                  {dataset.status === 'ready' && (
                    <Link to={`/viewer/${dataset.id}`}>
                      <Button size="sm" variant="ghost" title="View"><ExternalLink className="h-4 w-4" /></Button>
                    </Link>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditingDataset(dataset)} title="Edit"><Edit className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeletingDataset(dataset)} title="Delete" className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {total > RECENT_LIMIT && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-center">
            <Link
              to="/my-datasets"
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all {total} datasets <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </Card>

      <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title="Upload Dataset" size="4xl">
        <UploadDatasetForm
          onSuccess={() => { setIsUploadOpen(false); refresh() }}
          onCancel={() => setIsUploadOpen(false)}
          hideTitle
          className="border-0 shadow-none p-0"
        />
      </Modal>

      <EditDatasetModal
        isOpen={!!editingDataset}
        onClose={() => setEditingDataset(null)}
        dataset={editingDataset}
        onUpdate={refresh}
      />

      <DeleteDatasetModal
        isOpen={!!deletingDataset}
        onClose={() => setDeletingDataset(null)}
        dataset={deletingDataset}
      />
    </div>
  )
}

const TONES: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${TONES[tone] || TONES.indigo}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none text-gray-900">{value}</div>
        <div className="mt-1 truncate text-xs text-gray-500">{label}</div>
      </div>
    </Card>
  )
}
