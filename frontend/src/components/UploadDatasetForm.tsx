import { useState, ChangeEvent, FormEvent, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDatasetStore } from '../store/useDatasetStore'
import api from '../api/client'
import { apiUrl } from '../api/config'
import { Project } from '../types'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card'
import { Upload, Terminal, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

interface UploadDatasetFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    hideTitle?: boolean;
    className?: string;
    /** Pre-select (and lock) a project — e.g. when uploading from a project page. */
    projectId?: string;
}

export function UploadDatasetForm({ onSuccess, onCancel, hideTitle = false, className, projectId }: UploadDatasetFormProps) {
    const { uploadDataset } = useDatasetStore()
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadStatus, setUploadStatus] = useState<string>('')
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState<string>(projectId ?? '')
    const [showApiHelp, setShowApiHelp] = useState(false)
    const [copied, setCopied] = useState(false)
    const [uploadForm, setUploadForm] = useState({
        name: '',
        description: '',
        fileType: 'loom',
        file: null as File | null,
    })
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load the projects the user can add datasets to. A locked projectId means
    // we're already scoped to one project, so the picker is unnecessary.
    useEffect(() => {
        if (projectId) return
        let cancelled = false
        api.get<Project[]>('/projects/')
            .then((res) => { if (!cancelled) setProjects(res.data) })
            .catch(() => { /* picker is optional; ignore fetch failures */ })
        return () => { cancelled = true }
    }, [projectId])

    // Fully-qualified endpoint for the curl snippet. apiUrl() returns a path
    // when same-origin (the default), so fall back to the live origin so the
    // example is copy-paste runnable.
    const endpoint = (() => {
        const u = apiUrl('/datasets/')
        if (u.startsWith('http')) return u
        return (typeof window !== 'undefined' ? window.location.origin : '') + u
    })()

    const curlSnippet = `# 1. Create a Personal Access Token (see link above), then:
TOKEN="scope_pat_xxxxxxxxxxxxxxxxxxxxxxxx"
FILE="my_dataset.h5ad"

# 2. Datasets are de-duplicated by content hash — compute the file's MD5:
HASH=$(md5sum "$FILE" | cut -d' ' -f1)

# 3. Upload. Metadata goes in the query string; the file is the raw request
#    body. Use -T (--upload-file) so curl STREAMS from disk — works for very
#    large files (100 GB+) without buffering them in memory. The dataset is
#    owned by the token's user.
curl -X POST -T "$FILE" \\
  "${endpoint}?name=My%20Dataset&description=Uploaded%20via%20API&file_type=h5ad&file_hash=$HASH" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/octet-stream"`

    const copySnippet = async () => {
        try {
            await navigator.clipboard.writeText(curlSnippet)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            /* clipboard unavailable (e.g. non-secure context) — no-op */
        }
    }

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
            const created = await uploadDataset(
                uploadForm.name,
                uploadForm.description,
                uploadForm.fileType,
                uploadForm.file,
                (progress, status) => {
                    setUploadProgress(progress)
                    setUploadStatus(status)
                }
            )
            // Attach to the chosen project after the dataset exists. The upload
            // itself already succeeded, so a failed attach shouldn't be fatal —
            // the API client surfaces the error toast; we just keep going.
            if (selectedProject) {
                setUploadStatus('linking to project')
                try {
                    await api.post(`/projects/${selectedProject}/datasets/${created.id}`)
                } catch (err) {
                    console.error('Failed to attach dataset to project', err)
                }
            }
            setUploadForm({ name: '', description: '', fileType: 'loom', file: null })
            setSelectedProject(projectId ?? '')
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

                    {!projectId && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Add to project <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <select
                                value={selectedProject}
                                onChange={(e) => setSelectedProject(e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                            >
                                <option value="">— No project —</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

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

                {/* API upload instructions — collapsed by default to keep the
                    common click-to-upload flow uncluttered. */}
                <div className="mt-6 border-t border-gray-200 pt-4">
                    <button
                        type="button"
                        onClick={() => setShowApiHelp((v) => !v)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600"
                    >
                        {showApiHelp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <Terminal className="h-4 w-4" />
                        Upload via the API (curl)
                    </button>

                    {showApiHelp && (
                        <div className="mt-3 space-y-3 text-sm text-gray-600">
                            <p>
                                Prefer scripting your uploads? Authenticate with a Personal Access Token
                                instead of a browser session. Manage your tokens on the{' '}
                                <Link to="/tokens" className="font-medium text-indigo-600 hover:text-indigo-500">
                                    API Tokens
                                </Link>{' '}
                                page — a token is shown once on creation, so copy it somewhere safe.
                            </p>
                            <div className="relative">
                                <pre className="overflow-x-auto rounded-md bg-gray-900 p-4 pr-12 text-xs leading-relaxed text-gray-100">
{curlSnippet}
                                </pre>
                                <button
                                    type="button"
                                    onClick={copySnippet}
                                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-gray-700/80 px-2 py-1 text-xs text-gray-100 hover:bg-gray-600"
                                    title="Copy to clipboard"
                                >
                                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">
                                The token authenticates as you, so the uploaded dataset is owned by your
                                account. To attach it to a project, call{' '}
                                <code className="rounded bg-gray-100 px-1 py-0.5">POST /api/v1/projects/&#123;project_id&#125;/datasets/&#123;dataset_id&#125;</code>{' '}
                                with the same token.
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
