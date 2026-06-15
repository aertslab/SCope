import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { useToast } from '../context/ToastContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/Modal'
import { ArrowLeft, Key, Trash2, Copy, Check, AlertTriangle } from 'lucide-react'

interface Token {
  id: string
  name: string
  last_used_at?: string | null
  expires_at?: string | null
  created_at: string
}

interface NewTokenResponse extends Token {
  token: string
}

export default function ApiTokens() {
  const [items, setItems] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [expiresInDays, setExpiresInDays] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<NewTokenResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const { addToast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get<Token[]>('/users/me/tokens')
      setItems(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      addToast('Name is required', 'error')
      return
    }
    setCreating(true)
    try {
      const body: Record<string, unknown> = { name: name.trim() }
      if (expiresInDays.trim()) {
        const n = parseInt(expiresInDays, 10)
        if (Number.isFinite(n) && n > 0) body.expires_in_days = n
      }
      const res = await api.post<NewTokenResponse>('/users/me/tokens', body)
      setCreated(res.data)
      setName('')
      setExpiresInDays('')
      setShowCreate(false)
      await load()
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this token? Any clients using it will stop working.')) return
    try {
      await api.delete(`/users/me/tokens/${id}`)
      addToast('Token revoked', 'success')
      await load()
    } catch {
      /* global interceptor */
    }
  }

  const copyToken = async () => {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('Could not copy to clipboard', 'error')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/profile"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>

      <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-indigo-500" />
            <h1 className="text-lg font-semibold text-gray-900">API tokens</h1>
          </div>
          <Button size="sm" variant="primary" onClick={() => setShowCreate(true)}>
            New token
          </Button>
        </div>

        <div className="px-6 py-4 text-sm text-gray-600 bg-indigo-50/40 border-b border-indigo-100">
          Use these long-lived tokens to authenticate API requests from scripts.
          Send them as a Bearer header:{' '}
          <code className="px-1 py-0.5 bg-white border border-gray-200 rounded text-xs">
            Authorization: Bearer scope_pat_…
          </code>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            You haven't created any tokens yet.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((t) => (
              <li key={t.id} className="px-6 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Created {new Date(t.created_at).toLocaleDateString()} ·{' '}
                    {t.expires_at
                      ? `expires ${new Date(t.expires_at).toLocaleDateString()}`
                      : 'never expires'}{' '}
                    · last used{' '}
                    {t.last_used_at ? new Date(t.last_used_at).toLocaleString() : 'never'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(t.id)}
                  className="text-gray-500 hover:text-red-600"
                  title="Revoke token"
                  aria-label="Revoke token"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create API token"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CLI uploader"
            required
          />
          <Input
            label="Expires in (days, optional)"
            type="number"
            min={1}
            max={3650}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            placeholder="Leave blank for no expiry"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create token'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!created}
        onClose={() => setCreated(null)}
        title="Token created"
      >
        {created && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded bg-yellow-50 border border-yellow-200 text-sm text-yellow-900">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                Copy this token now — it will not be shown again. If you lose it,
                revoke it and create a new one.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 px-3 py-2 rounded bg-gray-100 border border-gray-200 text-xs font-mono break-all">
                {created.token}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={copyToken}
                leftIcon={
                  copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />
                }
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setCreated(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
