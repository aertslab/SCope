import { useState, ChangeEvent, FormEvent } from 'react'
import { Modal } from './Modal'
import { Button } from './ui/Button'
import { useDatasetStore } from '../store/useDatasetStore'
import { useToast } from '../context/ToastContext'
import { Dataset } from '../types'
import { AlertTriangle } from 'lucide-react'

interface ReplaceDatasetModalProps {
  isOpen: boolean
  onClose: () => void
  dataset: Dataset | null
}

const ALLOWED = ['loom', 'h5ad', 'csv'] as const

const detectType = (filename: string): string => {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.h5ad')) return 'h5ad'
  if (lower.endsWith('.csv')) return 'csv'
  return 'loom'
}

export function ReplaceDatasetModal({ isOpen, onClose, dataset }: ReplaceDatasetModalProps) {
  const { replaceDatasetFile } = useDatasetStore()
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<string>('loom')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setFile(null)
    setProgress(0)
    setStatus('')
    setBusy(false)
    setError(null)
  }

  const handleClose = () => {
    if (busy) return
    reset()
    onClose()
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setFileType(detectType(f.name))
    setError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!dataset || !file) return
    setBusy(true)
    setError(null)
    try {
      await replaceDatasetFile(dataset.id, file, fileType, (p, s) => {
        setProgress(p)
        setStatus(s)
      })
      addToast('File replaced — reconversion started', 'success')
      reset()
      onClose()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail || 'Replace failed. Please try again.')
      setBusy(false)
    }
  }

  if (!dataset) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Replace file: ${dataset.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded bg-yellow-50 border border-yellow-200 text-sm text-yellow-900">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            The dataset's name, description, project links, and shares will be
            preserved. The new file will be re-converted from scratch.
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New file
          </label>
          <input
            type="file"
            accept=".loom,.h5ad,.csv"
            onChange={handleFileChange}
            disabled={busy}
            className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            File type
          </label>
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            disabled={busy}
            className="block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            {ALLOWED.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {status && (
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span className="capitalize">{status}…</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !file}>
            {busy ? 'Replacing…' : 'Replace file'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
