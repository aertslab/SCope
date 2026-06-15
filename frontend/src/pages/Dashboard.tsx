import { useEffect, useState } from 'react'
import { useDatasetStore } from '../store/useDatasetStore'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Upload, FileText, ExternalLink, Trash2, Edit } from 'lucide-react'
import { UploadDatasetForm } from '../components/UploadDatasetForm'
import { DatasetStatusBadge } from '../components/DatasetStatusBadge'
import { DeleteDatasetModal } from '../components/DeleteDatasetModal'
import { EditDatasetModal } from '../components/EditDatasetModal'
import { Dataset } from '../types'

export default function Dashboard() {
  const { datasets, isLoading, fetchDatasets } = useDatasetStore()
  const [isUploading, setIsUploading] = useState(false)
  const [deletingDataset, setDeletingDataset] = useState<Dataset | null>(null)
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null)

  const hasPendingWork = datasets.some(
    (d) => d.status === 'pending' || d.status === 'processing'
  )

  useEffect(() => {
    fetchDatasets()
    if (!hasPendingWork) return
    const interval = setInterval(() => {
        fetchDatasets()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchDatasets, hasPendingWork])

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Dashboard
          </h2>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <Button
            onClick={() => setIsUploading(!isUploading)}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            {isUploading ? 'Cancel Upload' : 'Upload New Dataset'}
          </Button>
        </div>
      </div>

      {isUploading && (
        <UploadDatasetForm 
            onSuccess={() => setIsUploading(false)}
            onCancel={() => setIsUploading(false)}
        />
      )}
      
      <Card>
        <CardHeader>
            <CardTitle>Your Datasets</CardTitle>
        </CardHeader>
        <div className="divide-y divide-gray-200">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : datasets.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No datasets uploaded yet.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {datasets.map((dataset) => (
                <li key={dataset.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center min-w-0 gap-4">
                            <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <FileText className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-sm font-medium text-gray-900 truncate">{dataset.name}</h4>
                                <p className="text-sm text-gray-500 truncate">{dataset.description || 'No description'}</p>
                                <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                                    <span>{dataset.file_type.toUpperCase()}</span>
                                    <span>•</span>
                                    <time dateTime={dataset.created_at}>{new Date(dataset.created_at).toLocaleDateString()}</time>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <DatasetStatusBadge status={dataset.status} failureReason={dataset.failure_reason} />
                            <div className="flex items-center gap-2">
                                {dataset.status === 'ready' && (
                                    <Link to={`/viewer/${dataset.id}`}>
                                        <Button size="sm" variant="outline" title="View">
                                            <ExternalLink className="w-4 h-4" />
                                        </Button>
                                    </Link>
                                )}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingDataset(dataset)}
                                    title="Edit"
                                >
                                    <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setDeletingDataset(dataset)}
                                    title="Delete"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Edit Modal */}
      <EditDatasetModal
        isOpen={!!editingDataset}
        onClose={() => setEditingDataset(null)}
        dataset={editingDataset}
        onUpdate={() => fetchDatasets()}
      />

      {/* Delete Modal */}
      <DeleteDatasetModal
        isOpen={!!deletingDataset}
        onClose={() => setDeletingDataset(null)}
        dataset={deletingDataset}
      />
    </div>
  )
}
