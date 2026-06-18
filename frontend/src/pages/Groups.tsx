import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Group } from '../types'
import { Plus, Users } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { PageHeader } from '../components/ui/PageHeader'
import { SearchInput } from '../components/ui/SearchInput'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'

export default function Groups() {
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups/')
      setGroups(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/groups/', { name: newGroupName, description: newGroupDesc })
      setNewGroupName('')
      setNewGroupDesc('')
      setShowCreate(false)
      fetchGroups()
    } catch (err) {
      console.error(err)
      addToast('Failed to create group', 'error')
    }
  }

  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (group.description && group.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <PageHeader title="My Groups">
          <div className="flex-1 sm:w-64">
              <SearchInput 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search groups..."
              />
          </div>
          <Button
              onClick={() => setShowCreate(!showCreate)}
              leftIcon={<Plus className="h-4 w-4" />}
          >
              Create Group
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
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                value={newGroupDesc}
                onChange={e => setNewGroupDesc(e.target.value)}
              />
            </div>
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
          {filteredGroups.map((group) => (
            <li key={group.id}>
              <div 
                className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/groups/${group.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-gray-400 mr-3" />
                    <p className="text-sm font-medium text-indigo-600 truncate">{group.name}</p>
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-gray-500">
                      {group.description}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          ))}
          {filteredGroups.length === 0 && !loading && (
            <li className="px-4 py-4 sm:px-6">
                <EmptyState 
                    message={searchQuery ? 'No groups match your search' : 'No groups found'} 
                    icon={<Users className="h-8 w-8 text-gray-300" />}
                />
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
