import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import api from '../api/client'

interface EditDatasetModalProps {
    isOpen: boolean
    onClose: () => void
    dataset: any
    onUpdate: (updatedDataset: any) => void
}

export function EditDatasetModal({ isOpen, onClose, dataset, onUpdate }: EditDatasetModalProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (dataset) {
            setName(dataset.name || '')
            setDescription(dataset.description || '')
        }
    }, [dataset])

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const res = await api.put(`/datasets/${dataset.id}`, {
                name,
                description,
                file_type: dataset.file_type // Required by schema but ignored or we can just pass it
            })
            onUpdate(res.data)
            onClose()
        } catch (err) {
            console.error(err)
            setError("Failed to update dataset")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X size={20} />
                </button>
                
                <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Dataset</h2>
                
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-2 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm h-24 resize-none"
                        />
                    </div>

                    <div className="flex justify-end pt-2">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="mr-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
