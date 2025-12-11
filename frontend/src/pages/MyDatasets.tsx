import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Dataset } from '../types'
import { Trash2, ExternalLink, Upload, FileText, Edit } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { EditDatasetModal } from '../components/EditDatasetModal'
import { DeleteDatasetModal } from '../components/DeleteDatasetModal'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useDatasetStore } from '../store/useDatasetStore'
import { UploadDatasetForm } from '../components/UploadDatasetForm'
import { DatasetStatusBadge } from '../components/DatasetStatusBadge'
import { PageHeader } from '../components/ui/PageHeader'
import { LoadingState } from '../components/ui/LoadingState'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/Modal'

export default function MyDatasets() {
    const { addToast } = useToast()
    const { datasets, isLoading, fetchDatasets, deleteDataset } = useDatasetStore()
    
    // Upload State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

    // Edit State
    const [editingDataset, setEditingDataset] = useState<Dataset | null>(null)
    
    // Delete State
    const [deletingDataset, setDeletingDataset] = useState<Dataset | null>(null)

    useEffect(() => {
        fetchDatasets()
        const interval = setInterval(fetchDatasets, 5000)
        return () => clearInterval(interval)
    }, [fetchDatasets])

    return (
        <div className="space-y-6">
            <PageHeader title="My Datasets">
                <Button
                    onClick={() => setIsUploadModalOpen(true)}
                    leftIcon={<Upload className="w-4 h-4" />}
                >
                    Upload Dataset
                </Button>
            </PageHeader>

            <Card>
                <div className="divide-y divide-gray-200">
                    {isLoading ? (
                        <LoadingState />
                    ) : datasets.length === 0 ? (
                        <EmptyState 
                            message="You haven't uploaded any datasets yet." 
                            icon={<FileText className="h-8 w-8 text-gray-300" />}
                        />
                    ) : (
                        <ul className="divide-y divide-gray-200">
                            {datasets.map((ds) => (
                                <li key={ds.id} className="p-6 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center min-w-0 gap-4">
                                            <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                <FileText className="h-6 w-6 text-indigo-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-medium text-gray-900 truncate">{ds.name}</h4>
                                                    <DatasetStatusBadge status={ds.status} />
                                                </div>
                                                <p className="text-sm text-gray-500 truncate">{ds.description || 'No description'}</p>
                                                <div className="mt-1 text-xs text-gray-400">
                                                    Uploaded on {new Date(ds.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {ds.status === 'ready' && (
                                                <Link to={`/viewer/${ds.id}`}>
                                                    <Button size="sm" variant="ghost" title="View">
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setEditingDataset(ds)}
                                                title="Edit"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setDeletingDataset(ds)}
                                                title="Delete"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Card>

            {/* Upload Modal */}
            <Modal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                title="Upload Dataset"
            >
                <UploadDatasetForm 
                    onSuccess={() => {
                        setIsUploadModalOpen(false)
                        addToast('Dataset uploaded successfully! Processing started.', 'success')
                        fetchDatasets()
                    }}
                    onCancel={() => setIsUploadModalOpen(false)}
                    hideTitle={true}
                    className="border-0 shadow-none p-0"
                />
            </Modal>

            {/* Edit Modal */}
            <EditDatasetModal
                isOpen={!!editingDataset}
                onClose={() => setEditingDataset(null)}
                dataset={editingDataset}
                onUpdate={() => {
                    // We don't need to manually update state as fetchDatasets will pick it up, 
                    // but for immediate feedback we could update the store if we had an update action.
                    // For now, just re-fetch.
                    fetchDatasets()
                }}
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
