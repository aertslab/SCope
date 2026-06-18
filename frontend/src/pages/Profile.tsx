import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useToast } from '../context/ToastContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuthStore } from '../store/useAuthStore'
import LinkedAccountsList from '../components/LinkedAccountsList'
import { OAuthAccount } from '../types'
import { apiUrl } from '../api/config'
import { Database, Folder, Users, HardDrive, AlertTriangle, Layers, Key, Trash2 } from 'lucide-react'
import { formatBytes } from '../utils/format'
import { Modal } from '../components/Modal'

interface UserStats {
  dataset_count: number
  project_count: number
  group_count: number
  owned_groups_count: number
  shared_projects_count: number
  total_uploaded_bytes: number
  total_converted_bytes: number
  total_disk_usage: number
}

export default function Profile() {
  const { user, fetchUser, logout } = useAuthStore()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState<OAuthAccount[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteBlockers, setDeleteBlockers] = useState<string[]>([])
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    current_password: '',
    password: '',
    confirm_password: ''
  })

  useEffect(() => {
    fetchLinkedAccounts()
    fetchStats()
  }, [])

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        full_name: user.full_name || '',
        email: user.email || ''
      }))
    }
  }, [user])

  const fetchLinkedAccounts = async () => {
    try {
      const response = await api.get('/users/me/oauth-accounts')
      setLinkedAccounts(response.data)
    } catch (error) {
      console.error('Failed to fetch linked accounts', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get('/users/me/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats', error)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      addToast('Type DELETE to confirm', 'error')
      return
    }
    setDeleting(true)
    setDeleteBlockers([])
    try {
      await api.delete('/users/me')
      addToast('Account deleted', 'success')
      await logout()
      navigate('/login')
    } catch (error: any) {
      const detail = error.response?.data?.detail
      if (detail && typeof detail === 'object' && Array.isArray(detail.blockers)) {
        setDeleteBlockers(detail.blockers)
      } else {
        addToast(typeof detail === 'string' ? detail : 'Failed to delete account', 'error')
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleLinkOrcid = () => {
    // Auth travels via the HttpOnly cookie set on login; never via the URL.
    window.location.href = apiUrl('/link/orcid')
  }

  const handleUnlink = async (accountId: string) => {
    if (!confirm('Are you sure you want to unlink this account?')) return

    try {
      await api.delete(`/users/me/oauth-accounts/${accountId}`)
      addToast('Account unlinked successfully', 'success')
      fetchLinkedAccounts()
    } catch (error) {
      console.error('Failed to unlink account', error)
      addToast('Failed to unlink account', 'error')
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password && formData.password !== formData.confirm_password) {
        addToast("Passwords don't match", 'error')
        return
    }
    
    setLoading(true)
    try {
        const updateData: any = {
            full_name: formData.full_name,
            email: formData.email
        }
        if (formData.password) {
            updateData.password = formData.password
            updateData.current_password = formData.current_password
        }
        
        await api.put('/users/me', updateData)
        addToast('Profile updated successfully', 'success')
        await fetchUser()
        // Clear password fields
        setFormData(prev => ({ ...prev, password: '', current_password: '', confirm_password: '' }))
    } catch (error: any) {
        console.error(error)
        addToast(error.response?.data?.detail || 'Failed to update profile', 'error')
    } finally {
        setLoading(false)
    }
  }

  const isGoogleLinked = linkedAccounts.some(acc => acc.provider === 'google')
  const canChangePassword = user?.has_password

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Profile
          </h2>
          {user && (
            <p className="mt-1 text-sm text-gray-500">
              {user.full_name || user.email}{user.is_superuser && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  Superuser
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Link to="/my-datasets" className="block bg-white rounded-lg shadow ring-1 ring-black ring-opacity-5 p-4 hover:ring-indigo-500 transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase">Datasets</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{stats?.dataset_count ?? '—'}</div>
            </div>
            <Database className="h-8 w-8 text-indigo-500" />
          </div>
        </Link>
        <Link to="/projects" className="block bg-white rounded-lg shadow ring-1 ring-black ring-opacity-5 p-4 hover:ring-indigo-500 transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase">Projects</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{stats?.project_count ?? '—'}</div>
              {stats && stats.shared_projects_count > 0 && (
                <div className="text-xs text-gray-500 mt-1">{stats.shared_projects_count} shared with you</div>
              )}
            </div>
            <Folder className="h-8 w-8 text-indigo-500" />
          </div>
        </Link>
        <Link to="/groups" className="block bg-white rounded-lg shadow ring-1 ring-black ring-opacity-5 p-4 hover:ring-indigo-500 transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase">Groups</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{stats?.group_count ?? '—'}</div>
              {stats && stats.owned_groups_count > 0 && (
                <div className="text-xs text-gray-500 mt-1">{stats.owned_groups_count} owned</div>
              )}
            </div>
            <Users className="h-8 w-8 text-indigo-500" />
          </div>
        </Link>
        <div className="bg-white rounded-lg shadow ring-1 ring-black ring-opacity-5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase">Storage</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{stats ? formatBytes(stats.total_disk_usage) : '—'}</div>
              {stats && (
                <div className="text-xs text-gray-500 mt-1">
                  {formatBytes(stats.total_uploaded_bytes)} src + {formatBytes(stats.total_converted_bytes)} conv
                </div>
              )}
            </div>
            <HardDrive className="h-8 w-8 text-indigo-500" />
          </div>
        </div>
        <Link to="/my-sessions" className="block bg-white rounded-lg shadow ring-1 ring-black ring-opacity-5 p-4 hover:ring-indigo-500 transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase">Sessions</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">View saved</div>
            </div>
            <Layers className="h-8 w-8 text-indigo-500" />
          </div>
        </Link>
        <Link
          to="/invitations"
          className="block bg-white rounded-lg shadow ring-1 ring-black ring-opacity-5 p-4 hover:ring-indigo-500 transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase">Invitations</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">Group invites</div>
            </div>
            <Users className="h-8 w-8 text-indigo-500" />
          </div>
        </Link>
        <Link
          to="/tokens"
          className="block bg-white rounded-lg shadow ring-1 ring-black ring-opacity-5 p-4 hover:ring-indigo-500 transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase">API tokens</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">Programmatic access</div>
            </div>
            <Key className="h-8 w-8 text-indigo-500" />
          </div>
        </Link>
        <Link
          to="/trash"
          className="block bg-white rounded-lg shadow ring-1 ring-black ring-opacity-5 p-4 hover:ring-indigo-500 transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase">Trash</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">Restore datasets</div>
            </div>
            <Trash2 className="h-8 w-8 text-indigo-500" />
          </div>
        </Link>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg bg-white p-6">
              <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-base font-semibold leading-7 text-gray-900">User Information</h3>
                  <form onSubmit={handleUpdateProfile} className="mt-4 space-y-6 border-t border-gray-100 pt-6">
                    <Input
                        label="Full Name"
                        value={formData.full_name}
                        onChange={e => setFormData({...formData, full_name: e.target.value})}
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        disabled={isGoogleLinked}
                        helperText={isGoogleLinked ? "Email cannot be changed because it is linked to a Google account." : undefined}
                    />
                    
                    {canChangePassword && (
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <h4 className="text-sm font-medium text-gray-900">Change Password</h4>
                            <Input
                                label="Current Password"
                                type="password"
                                value={formData.current_password}
                                onChange={e => setFormData({...formData, current_password: e.target.value})}
                            />
                            <Input
                                label="New Password"
                                type="password"
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                            <Input
                                label="Confirm New Password"
                                type="password"
                                value={formData.confirm_password}
                                onChange={e => setFormData({...formData, confirm_password: e.target.value})}
                            />
                        </div>
                    )}

                    <div className="pt-4">
                        <Button type="submit" isLoading={loading}>
                            Save Changes
                        </Button>
                    </div>
                  </form>
                </div>

                <div>
                  <h3 className="text-base font-semibold leading-7 text-gray-900">Linked Accounts</h3>
                  <div className="mt-4 border-t border-gray-100 pt-6">
                    <LinkedAccountsList 
                        accounts={linkedAccounts} 
                        onUnlink={handleUnlink} 
                        emptyMessage="No external accounts linked."
                    />
                    
                    <div className="mt-6">
                      <Button
                        onClick={handleLinkOrcid}
                        className="flex w-full items-center justify-center gap-3 bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      >
                        <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24" fill="#A6CE39">
                          <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 0 1-.947-.947c0-.525.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.124 0 5.254 2.306 5.254 5.02 0 2.701-2.178 5.02-5.253 5.02h-3.9V7.416zm1.444 1.303v7.444h2.297c3.326 0 4.034-4.376 3.262-6.062-.588-1.286-2.089-1.382-3.262-1.382h-2.297z" />
                        </svg>
                        Link ORCiD Account
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-8 bg-white shadow ring-1 ring-red-200 sm:rounded-lg overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="text-base font-semibold text-red-700">Danger Zone</h3>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Permanently delete your account and all of its associated data (datasets, owned projects,
            and sole-membership groups). Linked OAuth accounts will be unlinked.
            You must transfer or remove shared/owned content first.
          </p>
          <div className="mt-4">
            <Button
              variant="danger"
              onClick={() => { setShowDeleteAccount(true); setDeleteConfirm(''); setDeleteBlockers([]) }}
            >
              Delete Account
            </Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        title="Delete Account"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            This action is <strong>permanent</strong>. All your owned datasets, projects, and groups
            (with no other members) will be deleted. Type <code className="px-1 rounded bg-gray-100">DELETE</code> below to confirm.
          </p>
          {deleteBlockers.length > 0 && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
              <div className="font-medium mb-1">Cannot delete account yet:</div>
              <ul className="list-disc pl-5 space-y-1">
                {deleteBlockers.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          )}
          <Input
            label="Type DELETE to confirm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDeleteAccount(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              isLoading={deleting}
              disabled={deleteConfirm !== 'DELETE'}
            >
              Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
