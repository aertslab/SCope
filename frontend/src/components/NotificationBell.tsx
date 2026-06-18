import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Bell, Check, X, Mail, Folder, Database, AlertTriangle, ArrowRightLeft } from 'lucide-react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

interface Notification {
  id: string
  type: string
  title: string
  message?: string
  link?: string
  payload?: Record<string, unknown>
  read_at?: string | null
  created_at: string
}

interface NotificationListResponse {
  items: Notification[]
  unread_count: number
}

const POLL_INTERVAL_MS = 30_000

function iconForType(type: string) {
  switch (type) {
    case 'group_invitation':
    case 'group_invitation_accepted':
      return <Mail className="h-4 w-4 text-indigo-500" />
    case 'project_share':
    case 'project_ownership_transferred':
    case 'group_ownership_transferred':
      return <ArrowRightLeft className="h-4 w-4 text-blue-500" />
    case 'dataset_processed':
      return <Database className="h-4 w-4 text-green-600" />
    case 'dataset_failed':
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    default:
      return <Folder className="h-4 w-4 text-gray-500" />
  }
}

function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime()
  const diff = Math.max(0, Date.now() - ts)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  // The dropdown is portaled to <body> so it can't be trapped behind stacking
  // contexts created by other parts of the page (e.g. the viewer's toolbar /
  // WebGL canvas / react-mosaic). `coords` anchors the fixed-position panel to
  // the bell button.
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const { addToast } = useToast()

  const updateCoords = () => {
    const r = buttonRef.current?.getBoundingClientRect()
    if (r) {
      setCoords({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
    }
  }

  // Poll the cheap unread-count endpoint so the badge stays roughly fresh
  // without paying for a full list fetch.
  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const res = await api.get<{ unread_count: number }>('/notifications/me/unread-count')
        if (!cancelled) setUnread(res.data.unread_count)
      } catch {
        /* ignore — covered by global interceptor for bigger failures */
      }
    }
    tick()
    const handle = window.setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(handle)
    }
  }, [])

  // Close on outside click. The dropdown lives in a body portal, so a click
  // inside it is "outside" containerRef — check the dropdown ref too.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Keep the portaled panel anchored to the bell if the viewport changes.
  useEffect(() => {
    if (!open) return
    const onReposition = () => updateCoords()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  const loadList = async () => {
    setLoading(true)
    try {
      const res = await api.get<NotificationListResponse>('/notifications/me', {
        params: { limit: 20 },
      })
      setItems(res.data.items)
      setUnread(res.data.unread_count)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async () => {
    const next = !open
    if (next) updateCoords()
    setOpen(next)
    if (next) await loadList()
  }

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      )
      setUnread((u) => Math.max(0, u - 1))
    } catch {
      /* global interceptor */
    }
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/me/read-all')
      const now = new Date().toISOString()
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
      setUnread(0)
    } catch {
      /* global interceptor */
    }
  }

  const acceptInvite = async (n: Notification) => {
    const invId = (n.payload?.group_invitation_id as string) || ''
    if (!invId) return
    try {
      await api.post(`/invitations/${invId}/accept`)
      addToast('Invitation accepted', 'success')
      await markRead(n.id)
      await loadList()
    } catch {
      /* global interceptor */
    }
  }

  const declineInvite = async (n: Notification) => {
    const invId = (n.payload?.group_invitation_id as string) || ''
    if (!invId) return
    try {
      await api.post(`/invitations/${invId}/decline`)
      addToast('Invitation declined', 'success')
      await markRead(n.id)
      await loadList()
    } catch {
      /* global interceptor */
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative inline-flex items-center justify-center p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && coords && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: coords.top, right: coords.right }}
          className="w-96 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-lg z-[1000] overflow-hidden"
        >
          <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">Notifications</span>
            {items.some((n) => !n.read_at) && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                You're all caught up.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((n) => {
                  const isInvite = n.type === 'group_invitation' && !!n.payload?.group_invitation_id
                  return (
                    <li
                      key={n.id}
                      className={`px-4 py-3 ${n.read_at ? 'bg-white' : 'bg-indigo-50/50'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{iconForType(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {n.title}
                          </div>
                          {n.message && (
                            <div className="text-xs text-gray-600 mt-0.5">{n.message}</div>
                          )}
                          <div className="text-[11px] text-gray-400 mt-1">
                            {timeAgo(n.created_at)}
                          </div>
                          {isInvite && (
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => acceptInvite(n)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                              >
                                <Check className="h-3 w-3" /> Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => declineInvite(n)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50"
                              >
                                <X className="h-3 w-3" /> Decline
                              </button>
                            </div>
                          )}
                          {!isInvite && n.link && (
                            <Link
                              to={n.link}
                              onClick={() => {
                                if (!n.read_at) markRead(n.id)
                                setOpen(false)
                              }}
                              className="inline-block mt-1 text-xs text-indigo-600 hover:text-indigo-700"
                            >
                              View →
                            </Link>
                          )}
                        </div>
                        {!n.read_at && (
                          <button
                            type="button"
                            onClick={() => markRead(n.id)}
                            title="Mark as read"
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
