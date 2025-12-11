import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { Button } from './ui/Button'
import { Dataset } from '../types'
import api from '../api/client'
import { useToast } from '../context/ToastContext'
import { useDatasetStore } from '../store/useDatasetStore'
import { AlertTriangle } from 'lucide-react'

interface ProjectUsage {
    id: string;
    name: string;
    visibility: string;
}

interface DeleteDatasetModalProps {
    isOpen: boolean
    onClose: () => void
    dataset: Dataset | null
}

export function DeleteDatasetModal({ isOpen, onClose, dataset }: DeleteDatasetModalProps) {
    const { deleteDataset } = useDatasetStore()
    const { addToast } = useToast()
    const [usage, setUsage] = useState<ProjectUsage[]>([])
    const [isLoadingUsage, setIsLoadingUsage] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        if (isOpen && dataset) {
            fetchUsage(dataset.id)
        } else {
            setUsage([])
        }
    }, [isOpen, dataset])

    const fetchUsage = async (id: string) => {
        setIsLoadingUsage(true)
        try {
            const response = await api.get(`/datasets/${id}/usage`)
            setUsage(response.data)
        } catch (error) {
            console.error('Failed to fetch dataset usage', error)
            // Fallback to empty usage if check fails, but maybe warn user?
        } finally {
            setIsLoadingUsage(false)
        }
    }

    const handleDelete = async () => {
        if (!dataset) return
        setIsDeleting(true)
        try {
            await deleteDataset(dataset.id)
            addToast('Dataset deleted successfully', 'success')
            onClose()
        } catch (error) {
            console.error('Failed to delete dataset', error)
            addToast('Failed to delete dataset', 'error')
        } finally {
            setIsDeleting(false)
        }
    }

    if (!dataset) return null

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Delete Dataset">
            <div className="space-y-4">
                <div className="flex items-start space-x-3 text-amber-600 bg-amber-50 p-4 rounded-md">
                    <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                    <div>
                        <h4 className="font-medium">Warning</h4>
                        <p className="text-sm mt-1">
                            Are you sure you want to delete <strong>{dataset.name}</strong>?
                            This action cannot be undone.
                        </p>
                    </div>
                </div>

                {isLoadingUsage ? (
                    <div className="text-center py-4 text-gray-500">Checking usage...</div>
                ) : usage.length > 0 ? (
                    <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                        <h4 className="font-medium text-blue-800 mb-2">Shared Resource Notice</h4>
                        <p className="text-sm text-blue-700 mb-2">
                            This dataset is currently linked to the following projects. 
                            Deleting it here will <strong>NOT</strong> remove the physical file from storage 
                            until it is removed from all projects.
                        </p>
                        <ul className="list-disc list-inside text-sm text-blue-700 pl-2">
                            {usage.map((project) => (
                                <li key={project.id}>{project.name}</li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p className="text-sm text-gray-600">
                        This dataset is not used by any other projects. 
                        Deleting it will permanently remove the file from storage.
                    </p>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                    <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button 
                        variant="danger" 
                        onClick={handleDelete} 
                        isLoading={isDeleting}
                    >
                        Delete Dataset
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
