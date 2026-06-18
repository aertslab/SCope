import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api/client'
import { User } from '../types'
import { Plus, Folder, Database, ExternalLink, BookmarkMinus } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useProjectStore } from '../store/useProjectStore'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'

export default function Projects() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { projects, isLoading: loading, fetchProjects, createProject, detachProject } = useProjectStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [password, setPassword] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    fetchCurrentUser()
    fetchProjects()
  }, [fetchProjects])

  const fetchCurrentUser = async () => {
      try {
          const res = await api.get('/users/me')
          setCurrentUser(res.data)
      } catch (e) {
          console.error(e)
      }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createProject({ 
          name: newProjectName, 
          description: newProjectDesc,
          visibility: visibility,
          password: visibility === 'password' ? password : undefined
      })
      setNewProjectName('')
      setNewProjectDesc('')
      setVisibility('private')
      setPassword('')
      setShowCreate(false)
      addToast('Project created successfully', 'success')
    } catch (err) {
      console.error(err)
      addToast('Failed to create project', 'error')
    }
  }

  const handleDetach = async (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation()
      if (!confirm("Remove this project from your list?")) return
      try {
          await detachProject(projectId)
          addToast("Project removed from list", 'success')
      } catch (e) {
          console.error(e)
          addToast("Failed to remove project", 'error')
      }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Projects">
          <Button
              onClick={() => setShowCreate(!showCreate)}
              leftIcon={<Plus className="h-4 w-4" />}
          >
              Create Project
          </Button>
      </PageHeader>

      {showCreate && (
        <div className="bg-white shadow sm:rounded-lg mb-6 p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                value={newProjectDesc}
                onChange={e => setNewProjectDesc(e.target.value)}
              />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Visibility</label>
                <select 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    value={visibility}
                    onChange={e => setVisibility(e.target.value)}
                >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                    <option value="password">Password Protected</option>
                </select>
            </div>
            {visibility === 'password' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input
                        type="password"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                </div>
            )}
            <div className="flex justify-end">
              <Button type="submit">
                Save
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {projects.map((project) => (
            <li key={project.id}>
              <div 
                className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Folder className="h-5 w-5 text-gray-400 mr-3" />
                    <p className="text-sm font-medium text-indigo-600 truncate">{project.name}</p>
                  </div>
                  <div className="ml-2 flex-shrink-0 flex items-center gap-2">
                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {project.visibility}
                    </p>
                    {currentUser && project.owner_id !== currentUser.id && (
                        <button 
                            onClick={(e) => handleDetach(e, project.id)}
                            className="text-gray-400 hover:text-red-500 p-1"
                            title="Remove from my list"
                        >
                            <BookmarkMinus size={16} />
                        </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-gray-500">
                      {project.description}
                    </p>
                  </div>
                </div>
                
                {/* Datasets List */}
                {project.datasets && project.datasets.length > 0 && (
                    <div className="mt-4 border-t border-gray-100 pt-2">
                        <p className="text-xs text-gray-500 mb-2 uppercase font-semibold">Datasets</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {project.datasets.map(ds => (
                                <Link 
                                    key={ds.id}
                                    to={`/viewer/${ds.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center p-2 rounded bg-gray-50 hover:bg-indigo-50 border border-gray-200 transition-colors group"
                                >
                                    <Database size={14} className="text-gray-400 group-hover:text-indigo-500 mr-2" />
                                    <span className="text-sm text-gray-700 group-hover:text-indigo-700 truncate flex-1">{ds.name}</span>
                                    <ExternalLink size={12} className="text-gray-300 group-hover:text-indigo-400" />
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
              </div>
            </li>
          ))}
          {projects.length === 0 && !loading && (
            <li className="px-4 py-4 sm:px-6">
                <EmptyState 
                    message="No projects found" 
                    icon={<Folder className="h-8 w-8 text-gray-300" />}
                />
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
