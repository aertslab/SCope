import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api/client'
import { Project, ProjectShare, Dataset, User, Group } from '../types'
import { Trash2, Plus, Share2, Search, Database, Copy, ExternalLink, Info, X, ArrowRightLeft } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useAuthStore } from '../store/useAuthStore'
import { Modal } from '../components/Modal'
import { ProjectTagEditor, ProjectTag } from '../components/ProjectTagEditor'

interface DatasetWithVisibility extends Dataset {
    highest_visibility?: 'public' | 'password' | 'private'
}

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const currentUser = useAuthStore((s) => s.user)
  const [project, setProject] = useState<Project | null>(null)
  const [datasets, setDatasets] = useState<DatasetWithVisibility[]>([])
  const [shares, setShares] = useState<ProjectShare[]>([])
  const [loading, setLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [projectPassword, setProjectPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Settings state
  const [showSettings, setShowSettings] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editVisibility, setEditVisibility] = useState('private')
  const [editPassword, setEditPassword] = useState('')

  // Add dataset state
  const [showAddDataset, setShowAddDataset] = useState(false)
  const [myDatasets, setMyDatasets] = useState<Dataset[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null)

  // Share project state
  const [showShare, setShowShare] = useState(false)
  const [shareType, setShareType] = useState<'user' | 'group'>('user')
  const [searchQuery, setSearchQuery] = useState('')
  const [userResults, setUserResults] = useState<User[]>([])
  const [groupResults, setGroupResults] = useState<Group[]>([])
  const [selectedShareTarget, setSelectedShareTarget] = useState<User | Group | null>(null)
  const [selectedPermission, setSelectedPermission] = useState('view')

  // Orphan warning state
  const [showOrphanWarning, setShowOrphanWarning] = useState(false)
  const [orphanedDatasets, setOrphanedDatasets] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Transfer-ownership state
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferQuery, setTransferQuery] = useState('')
  const [transferResults, setTransferResults] = useState<User[]>([])
  const [transferTarget, setTransferTarget] = useState<User | null>(null)

  useEffect(() => {
    setIsAuthenticated(!!currentUser)
    if (id) {
      fetchProjectDetails()
    }
  }, [id, currentUser])

  const fetchProjectDetails = async (password?: string) => {
    try {
      const config = password ? { headers: { 'x-project-password': password } } : {}
      const res = await api.get(`/projects/${id}`, config)
      setProject(res.data)
      setEditName(res.data.name)
      setEditDesc(res.data.description || '')
      setEditVisibility(res.data.visibility)
      setIsLocked(false)
      // Only fetch these if we have access
      fetchProjectDatasets(password)
      
      // Only fetch shares if logged in
      if (currentUser) {
          fetchProjectShares()
      }
    } catch (err: any) {
      if (err.response && err.response.status === 403) {
          if (err.response.data.detail === "Password required" || err.response.data.detail === "Invalid password") {
              setIsLocked(true)
              if (password) addToast("Invalid password", 'error')
          } else {
              addToast("Access denied", 'error')
              navigate('/projects')
          }
      } else if (err.response && err.response.status === 401) {
          // If 401, it means private project and not logged in
          // Redirect to login
          navigate('/login', { state: { from: `/projects/${id}` } })
      } else {
          console.error(err)
          navigate('/projects')
      }
    } finally {
        setLoading(false)
    }
  }

  const fetchProjectDatasets = async (password?: string) => {
    try {
      const config = password ? { headers: { 'x-project-password': password } } : {}
      const res = await api.get(`/projects/${id}/datasets`, config)
      setDatasets(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchProjectShares = async () => {
    try {
      const res = await api.get(`/projects/${id}/shares`)
      setShares(res.data)
    } catch (err: any) {
      // If 403, it means we are not admin, so we can't see shares. That's fine.
      if (err.response && err.response.status !== 403) {
          console.error(err)
      }
    }
  }

  const handleRevokeShare = async (shareId: string) => {
    if (!id) return
    if (!confirm('Revoke this share? The user/group will lose access.')) return
    try {
      await api.delete(`/projects/${id}/shares/${shareId}`)
      addToast('Share revoked', 'success')
      fetchProjectShares()
    } catch (err: any) {
      console.error(err)
      addToast(err.response?.data?.detail || 'Failed to revoke share', 'error')
    }
  }

  const handleUnlock = (e: React.FormEvent) => {
      e.preventDefault()
      fetchProjectDetails(projectPassword)
  }

  const handleUpdateProject = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!id) return
      try {
          await api.put(`/projects/${id}`, {
              name: editName,
              description: editDesc,
              visibility: editVisibility,
              password: editVisibility === 'password' ? editPassword : undefined
          })
          setShowSettings(false)
          fetchProjectDetails(projectPassword) // Refresh
          addToast('Project updated successfully', 'success')
      } catch (err) {
          console.error(err)
          addToast('Failed to update project', 'error')
      }
  }

  const handleDeleteProject = async (deleteOrphans = false) => {
      if (!id) return

      try {
          await api.delete(`/projects/${id}`, { params: { delete_orphans: deleteOrphans } })
          addToast('Project deleted successfully', 'success')
          navigate('/projects')
      } catch (err: any) {
          if (err.response && err.response.status === 409) {
              // Orphaned datasets found
              setOrphanedDatasets(err.response.data.orphaned_datasets)
              setShowOrphanWarning(true)
          } else {
              console.error(err)
              addToast('Failed to delete project', 'error')
          }
      }
  }

  const handleConfirmDelete = () => {
      setShowDeleteConfirm(false)
      handleDeleteProject(false)
  }

  const handleConfirmDeleteOrphans = () => {
      setShowOrphanWarning(false)
      handleDeleteProject(true)
  }

  const searchTransferUsers = async (query: string) => {
      setTransferQuery(query)
      setTransferTarget(null)
      if (!query.trim()) { setTransferResults([]); return }
      try {
          const res = await api.get(`/users/search?query=${encodeURIComponent(query)}`)
          // Don't list the current owner as a target.
          setTransferResults((res.data as User[]).filter(u => u.id !== project?.owner_id))
      } catch (err) {
          console.error(err)
      }
  }

  const handleTransferOwnership = async () => {
      if (!id || !transferTarget) return
      if (!confirm(`Transfer this project to ${transferTarget.full_name || transferTarget.email}? You will no longer own it.`)) return
      try {
          await api.post(`/projects/${id}/transfer-ownership`, { new_owner_id: transferTarget.id })
          addToast('Ownership transferred', 'success')
          setShowTransfer(false)
          setTransferQuery('')
          setTransferResults([])
          setTransferTarget(null)
          fetchProjectDetails(projectPassword)
      } catch (err: any) {
          console.error(err)
          // Toast surfaced by global interceptor; keep a fallback for older flows.
          if (!err?.response) addToast('Failed to transfer ownership', 'error')
      }
  }

  const handleAttach = async () => {
      if (!id) return
      try {
          const config = projectPassword ? { headers: { 'x-project-password': projectPassword } } : {}
          await api.post(`/projects/${id}/attach`, {}, config)
          addToast('Project attached to your account!', 'success')
      } catch (err) {
          console.error(err)
          addToast('Failed to attach project', 'error')
      }
  }

  const fetchMyDatasets = async () => {
    try {
      const res = await api.get('/datasets/')
      setMyDatasets(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddDataset = async () => {
    if (!selectedDatasetId || !id) return
    try {
      await api.post(`/projects/${id}/datasets/${selectedDatasetId}`)
      setShowAddDataset(false)
      setSelectedDatasetId(null)
      fetchProjectDatasets()
    } catch (err) {
      console.error(err)
      addToast('Failed to add dataset', 'error')
    }
  }

  const handleRemoveDataset = async (datasetId: string) => {
    if (!confirm('Remove dataset from project?')) return
    try {
      await api.delete(`/projects/${id}/datasets/${datasetId}`)
      fetchProjectDatasets()
    } catch (err) {
      console.error(err)
      addToast('Failed to remove dataset', 'error')
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setUserResults([])
      setGroupResults([])
      return
    }
    try {
      if (shareType === 'user') {
        const res = await api.get(`/users/search?query=${query}`)
        setUserResults(res.data)
      } else {
        // We need a group search endpoint or just list all groups user is in?
        // For now, let's assume we can search groups. But we haven't implemented group search.
        // Maybe just list user's groups? Or all groups?
        // Let's stick to user share for now or implement group search later.
        // Actually, we can just list groups the user is a member of, but that's for sharing WITH a group.
        // Usually you share with a group you know.
        // Let's implement group search in backend if needed, or just list all groups.
        // For now, let's just support user search fully.
        const res = await api.get('/groups/') // This lists my groups.
        // Filter locally
        setGroupResults(res.data.filter((g: Group) => g.name.toLowerCase().includes(query.toLowerCase())))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleShare = async () => {
    if (!selectedShareTarget || !id) return
    try {
      const payload: any = { permission: selectedPermission }
      if (shareType === 'user') {
        payload.user_id = selectedShareTarget.id
      } else {
        payload.group_id = selectedShareTarget.id
      }
      
      await api.post(`/projects/${id}/share`, payload)
      setShowShare(false)
      setSelectedShareTarget(null)
      setSearchQuery('')
      fetchProjectShares()
    } catch (err) {
      console.error(err)
      addToast('Failed to share project', 'error')
    }
  }

  if (loading) return <div>Loading...</div>
  
  if (isLocked) {
      return (
          <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4">Password Protected Project</h2>
              <form onSubmit={handleUnlock}>
                  <input
                      type="password"
                      placeholder="Enter project password"
                      className="w-full p-2 border rounded mb-4"
                      value={projectPassword}
                      onChange={e => setProjectPassword(e.target.value)}
                  />
                  <button
                      type="submit"
                      className="w-full bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700"
                  >
                      Unlock
                  </button>
              </form>
          </div>
      )
  }

  if (!project) return <div>Project not found</div>

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
          <p className="mt-2 text-gray-600">{project.description}</p>
          <div className="mt-2 flex gap-2">
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
              ${project.visibility === 'public' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {project.visibility}
            </span>
            {isAuthenticated && (
                <button 
                    onClick={handleAttach}
                    className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                >
                    Bookmark Project
                </button>
            )}
          </div>
          <div className="mt-3">
            <ProjectTagEditor
              projectId={project.id}
              tags={(project.tags as ProjectTag[]) || []}
              canEdit={!!(currentUser && (currentUser.id === project.owner_id || currentUser.is_superuser))}
              onChange={(newTags) => setProject({ ...project, tags: newTags })}
            />
          </div>
        </div>
        <div className="flex space-x-2">
            {isAuthenticated && (
                <button
                onClick={() => setShowSettings(!showSettings)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                Settings
                </button>
            )}
            <button
            onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                addToast('Project link copied to clipboard!', 'success')
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
            <Copy className="h-4 w-4 mr-2" />
            Copy Link
            </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Project"
      >
        <div className="space-y-4">
            <p className="text-sm text-gray-600">
                Are you sure you want to delete this project? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
                <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                    Delete Project
                </button>
            </div>
        </div>
      </Modal>

      {/* Orphan Warning Modal */}
      <Modal
        isOpen={showOrphanWarning}
        onClose={() => setShowOrphanWarning(false)}
        title="Warning: Orphaned Datasets"
      >
        <div className="space-y-4">
            <p className="text-sm text-gray-600">
                Deleting this project will also permanently delete the following datasets because they are not part of any other project:
            </p>
            <ul className="list-disc list-inside text-sm text-red-600 bg-red-50 p-3 rounded">
                {orphanedDatasets.map((name, i) => (
                    <li key={i}>{name}</li>
                ))}
            </ul>
            <p className="text-sm text-gray-600 font-medium">
                Are you sure you want to proceed? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
                <button
                    onClick={() => setShowOrphanWarning(false)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    onClick={handleConfirmDeleteOrphans}
                    className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                    Delete Everything
                </button>
            </div>
        </div>
      </Modal>

      {showSettings && (
        <div className="bg-white shadow sm:rounded-lg mb-6 p-6 border border-gray-200">
            <h3 className="text-lg font-medium mb-4">Project Settings</h3>
            <form onSubmit={handleUpdateProject} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                        type="text"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 h-24 resize-none"
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Visibility</label>
                    <select 
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        value={editVisibility}
                        onChange={e => setEditVisibility(e.target.value)}
                    >
                        <option value="private">Private</option>
                        <option value="public">Public</option>
                        <option value="password">Password Protected</option>
                    </select>
                </div>
                {editVisibility === 'password' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">New Password</label>
                        <input
                            type="password"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                            value={editPassword}
                            onChange={e => setEditPassword(e.target.value)}
                            placeholder="Leave empty to keep current password"
                        />
                    </div>
                )}
                <div className="flex justify-between">
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                    >
                        Delete Project
                    </button>
                    <button
                        type="submit"
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                        Update Settings
                    </button>
                </div>
            </form>
            {(currentUser?.id === project?.owner_id || currentUser?.is_superuser) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={() => setShowTransfer(!showTransfer)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer Ownership
                    </button>
                    {showTransfer && (
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                            <h4 className="text-sm font-medium text-yellow-800 mb-1">Transfer Project Ownership</h4>
                            <p className="text-xs text-yellow-700 mb-3">
                                Search for a user to receive ownership. You will lose owner privileges. This cannot be undone.
                            </p>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={transferQuery}
                                    onChange={(e) => searchTransferUsers(e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm border p-2"
                                />
                                {transferResults.length > 0 && !transferTarget && (
                                    <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-48 rounded-md text-base ring-1 ring-black ring-opacity-5 overflow-auto sm:text-sm">
                                        {transferResults.map(u => (
                                            <li
                                                key={u.id}
                                                onClick={() => { setTransferTarget(u); setTransferQuery(u.full_name || u.email); setTransferResults([]) }}
                                                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-yellow-50"
                                            >
                                                <div className="font-medium">{u.full_name || u.email}</div>
                                                {u.full_name && <div className="text-xs text-gray-500">{u.email}</div>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="mt-3 flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowTransfer(false); setTransferQuery(''); setTransferResults([]); setTransferTarget(null) }}
                                    className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleTransferOwnership}
                                    disabled={!transferTarget}
                                    className="px-3 py-2 text-sm text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50"
                                >
                                    Transfer
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}

      {/* Datasets Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Datasets</h3>
          {isAuthenticated && (
              <button
                onClick={() => {
                setShowAddDataset(!showAddDataset)
                if (!showAddDataset) fetchMyDatasets()
                }}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Dataset
              </button>
          )}
        </div>

        {showAddDataset && (
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-t border-gray-200">
            <div className="max-w-lg">
              <label className="block text-sm font-medium text-gray-700">Select Dataset</label>
              {myDatasets.length > 0 ? (
                  <>
                    <select
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                        onChange={(e) => setSelectedDatasetId(e.target.value)}
                        value={selectedDatasetId || ''}
                    >
                        <option value="">Select a dataset...</option>
                        {myDatasets.map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.name}</option>
                        ))}
                    </select>
                    <div className="mt-4 flex justify-end">
                        <button
                        onClick={handleAddDataset}
                        disabled={!selectedDatasetId}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                        >
                        Add
                        </button>
                    </div>
                  </>
              ) : (
                  <div className="mt-2 text-sm text-gray-500">
                      You haven't uploaded any datasets yet. <Link to="/my-datasets" className="text-indigo-600 hover:underline">Upload one here</Link>.
                  </div>
              )}
            </div>
          </div>
        )}

        <ul className="divide-y divide-gray-200">
          {datasets.map((ds) => (
            <li key={ds.id} className="px-4 py-4 sm:px-6 flex items-center justify-between">
              <div className="flex items-center">
                <Database className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-indigo-600 truncate">{ds.name}</div>
                    {ds.highest_visibility && project && ds.highest_visibility !== project.visibility && (
                        <div className="group relative">
                            <Info size={14} className="text-yellow-500 cursor-help" />
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                                This dataset is also available via a {ds.highest_visibility} project.
                            </div>
                        </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{ds.description}</div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  to={`/viewer/${ds.id}`}
                  className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-900"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View
                </Link>
                {isAuthenticated && (
                    <button
                    onClick={() => handleRemoveDataset(ds.id)}
                    className="text-red-600 hover:text-red-900"
                    >
                    <Trash2 className="h-5 w-5" />
                    </button>
                )}
              </div>
            </li>
          ))}
          {datasets.length === 0 && (
            <li className="px-4 py-4 sm:px-6 text-center text-gray-500">No datasets in this project</li>
          )}
        </ul>
      </div>

      {/* Sharing Section */}
      {isAuthenticated && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Sharing</h3>
            <button
                onClick={() => setShowShare(!showShare)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
                <Share2 className="mr-2 h-4 w-4" /> Share Project
            </button>
            </div>

            {showShare && (
            <div className="px-4 py-5 sm:px-6 bg-gray-50 border-t border-gray-200">
                <div className="max-w-lg">
                <div className="flex space-x-4 mb-4">
                    <button
                    className={`px-3 py-1 rounded-md ${shareType === 'user' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500'}`}
                    onClick={() => { setShareType('user'); setSearchQuery(''); setSelectedShareTarget(null); }}
                    >
                    User
                    </button>
                    <button
                    className={`px-3 py-1 rounded-md ${shareType === 'group' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500'}`}
                    onClick={() => { setShareType('group'); setSearchQuery(''); setSelectedShareTarget(null); }}
                    >
                    Group
                    </button>
                </div>

                <label className="block text-sm font-medium text-gray-700">Search {shareType === 'user' ? 'User' : 'Group'}</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                    type="text"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                    placeholder={`Search ${shareType}...`}
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>

                {(userResults.length > 0 || groupResults.length > 0) && (
                    <ul className="mt-2 border border-gray-200 rounded-md max-h-40 overflow-y-auto bg-white">
                    {shareType === 'user' ? userResults.map(user => (
                        <li
                        key={user.id}
                        className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${selectedShareTarget?.id === user.id ? 'bg-indigo-50' : ''}`}
                        onClick={() => {
                            setSelectedShareTarget(user)
                            setSearchQuery(user.full_name || user.email)
                            setUserResults([])
                        }}
                        >
                        {user.full_name} ({user.email})
                        </li>
                    )) : groupResults.map(group => (
                        <li
                        key={group.id}
                        className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${selectedShareTarget?.id === group.id ? 'bg-indigo-50' : ''}`}
                        onClick={() => {
                            setSelectedShareTarget(group)
                            setSearchQuery(group.name)
                            setGroupResults([])
                        }}
                        >
                        {group.name}
                        </li>
                    ))}
                    </ul>
                )}

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Permission</label>
                    <select
                    value={selectedPermission}
                    onChange={(e) => setSelectedPermission(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                    >
                    <option value="view">View</option>
                    <option value="edit">Edit</option>
                    <option value="admin">Admin</option>
                    </select>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                    onClick={handleShare}
                    disabled={!selectedShareTarget}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                    Share
                    </button>
                </div>
                </div>
            </div>
            )}

            <ul className="divide-y divide-gray-200">
            {shares.map((share) => (
                <li key={share.id} className="px-4 py-4 sm:px-6 flex items-center justify-between">
                <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500 font-medium">
                        {share.user ? 'U' : 'G'}
                    </span>
                    </div>
                    <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                        {share.user ? (share.user.full_name || share.user.email) : share.group?.name}
                    </div>
                    <div className="text-sm text-gray-500">
                        {share.user ? 'User' : 'Group'}
                    </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {share.permission}
                    </span>
                    <button
                        onClick={() => handleRevokeShare(share.id)}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Revoke share"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                </li>
            ))}
            {shares.length === 0 && (
                <li className="px-4 py-4 sm:px-6 text-center text-gray-500">Not shared with anyone</li>
            )}
            </ul>
          </div>
      )}
    </div>
  )
}
