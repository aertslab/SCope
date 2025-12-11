import { useState, ChangeEvent, FormEvent, useRef } from 'react'
import { useDatasetStore } from '../store/useDatasetStore'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card'
import { Upload } from 'lucide-react'

interface UploadDatasetFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    hideTitle?: boolean;
    className?: string;
}

export function UploadDatasetForm({ onSuccess, onCancel, hideTitle = false, className }: UploadDatasetFormProps) {
    const { uploadDataset } = useDatasetStore()
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadStatus, setUploadStatus] = useState<string>('')
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploadForm, setUploadForm] = useState({
        name: '',
        description: '',
        fileType: 'loom',
        file: null as File | null,
    })
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setUploadForm(prev => {
                const newState = { ...prev, file };
                // Auto-fill name if empty
                if (!prev.name) {
                    const name = file.name.replace(/\.[^/.]+$/, "") // Remove extension
                    newState.name = name;
                }
                // Auto-detect type
                if (file.name.endsWith('.h5ad')) {
                    newState.fileType = 'h5ad';
                } else if (file.name.endsWith('.csv')) {
                    newState.fileType = 'csv';
                } else {
                    newState.fileType = 'loom';
                }
                return newState;
            })
        }
    }

    const handleUpload = async (e: FormEvent) => {
        e.preventDefault()
        if (!uploadForm.file) return

        setUploadError(null)
        setUploadProgress(0)
        setUploadStatus('starting')

        try {
            await uploadDataset(
                uploadForm.name,
                uploadForm.description,
                uploadForm.fileType,
                uploadForm.file,
                (progress, status) => {
                    setUploadProgress(progress)
                    setUploadStatus(status)
                }
            )
            setUploadForm({ name: '', description: '', fileType: 'loom', file: null })
            setUploadProgress(0)
            setUploadStatus('')
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error('Upload failed', error)
            let errorMessage = 'Upload failed. Please try again.';
            if (error.response?.data?.detail) {
                if (typeof error.response.data.detail === 'string') {
                    errorMessage = error.response.data.detail;
                } else if (Array.isArray(error.response.data.detail)) {
                    // Handle FastAPI validation errors
                    errorMessage = error.response.data.detail
                        .map((err: any) => `${err.loc.join('.')}: ${err.msg}`)
                        .join(', ');
                }
            }
            setUploadError(errorMessage)
        }
    }

    return (
        <Card className={className}>
            {!hideTitle && (
                <CardHeader>
                    <CardTitle>Upload Dataset</CardTitle>
                </CardHeader>
            )}
            <CardContent>
                {uploadError && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                        <div className="flex">
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{uploadError}</p>
                            </div>
                        </div>
                    </div>
                )}
                {uploadStatus && (
                    <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span className="capitalize">{uploadStatus}...</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    </div>
                )}
                <form onSubmit={handleUpload} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                        <div 
                            className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors cursor-pointer ${
                                uploadForm.file ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-500'
                            }`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="space-y-1 text-center">
                                <Upload className={`mx-auto h-12 w-12 ${uploadForm.file ? 'text-indigo-500' : 'text-gray-400'}`} />
                                <div className="flex text-sm text-gray-600 justify-center">
                                    <span className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                                        {uploadForm.file ? uploadForm.file.name : 'Upload a file'}
                                    </span>
                                    <input 
                                        ref={fileInputRef}
                                        type="file" 
                                        className="sr-only" 
                                        accept=".loom,.h5ad,.csv"
                                        onChange={handleFileChange}
                                    />
                                </div>
                                <p className="text-xs text-gray-500">LOOM, H5AD or CSV</p>
                            </div>
                        </div>
                    </div>

                    <Input
                        label="Name"
                        required
                        value={uploadForm.name}
                        onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                    />
                    <Input
                        label="Description"
                        value={uploadForm.description}
                        onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
                        <select
                            value={uploadForm.fileType}
                            onChange={(e) => setUploadForm({ ...uploadForm, fileType: e.target.value })}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        >
                            <option value="loom">Loom</option>
                            <option value="h5ad">AnnData (h5ad)</option>
                            <option value="csv">CSV</option>
                        </select>
                    </div>

                    {uploadProgress > 0 && (
                        <div className="w-full mb-4">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{uploadProgress}% Uploaded</p>
                        </div>
                    )}

                    <div className="flex justify-end space-x-2">
                        {onCancel && (
                            <Button type="button" variant="secondary" onClick={onCancel}>
                                Cancel
                            </Button>
                        )}
                        <Button
                            type="submit"
                            disabled={uploadProgress > 0 && uploadProgress < 100}
                            isLoading={uploadProgress > 0 && uploadProgress < 100}
                        >
                            {uploadProgress > 0 && uploadProgress < 100 ? 'Uploading...' : 'Upload'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
