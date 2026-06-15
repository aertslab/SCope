import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { useToast } from '../context/ToastContext'
import { Button } from '../components/ui/Button'
import { Mail, Check, X, Users, ArrowLeft } from 'lucide-react'

interface InvitationGroup {
  id: string
  name: string
  description?: string | null
}

interface InvitationInviter {
  id: string
  email: string
  full_name?: string
}

interface Invitation {
  id: string
  group_id: string
  invitee_id: string
  inviter_id?: string | null
  role: string
  status: string
  created_at: string
  responded_at?: string | null
  group?: InvitationGroup | null
  inviter?: InvitationInviter | null
}

export default function Invitations() {
  const [items, setItems] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const { addToast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get<Invitation[]>('/invitations/me')
      setItems(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const accept = async (id: string) => {
    setActingId(id)
    try {
      await api.post(`/invitations/${id}/accept`)
      addToast('Invitation accepted', 'success')
      await load()
    } finally {
      setActingId(null)
    }
  }

  const decline = async (id: string) => {
    if (!confirm('Decline this invitation?')) return
    setActingId(id)
    try {
      await api.post(`/invitations/${id}/decline`)
      addToast('Invitation declined', 'success')
      await load()
    } finally {
      setActingId(null)
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
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Mail className="h-5 w-5 text-indigo-500" />
          <h1 className="text-lg font-semibold text-gray-900">Pending invitations</h1>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="mt-2 text-sm text-gray-500">No pending invitations.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((inv) => (
              <li key={inv.id} className="px-6 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {inv.group?.name || 'A group'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Invited as <span className="font-medium">{inv.role}</span>
                    {inv.inviter && (
                      <>
                        {' '}by{' '}
                        <span className="font-medium">
                          {inv.inviter.full_name || inv.inviter.email}
                        </span>
                      </>
                    )}{' '}
                    · {new Date(inv.created_at).toLocaleString()}
                  </div>
                  {inv.group?.description && (
                    <div className="text-xs text-gray-600 mt-1">{inv.group.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={actingId === inv.id}
                    onClick={() => accept(inv.id)}
                    leftIcon={<Check className="h-4 w-4" />}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actingId === inv.id}
                    onClick={() => decline(inv.id)}
                    leftIcon={<X className="h-4 w-4" />}
                  >
                    Decline
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
