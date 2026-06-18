import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Group, GroupMember, User } from '../types'
import { Trash2, UserPlus, Search, ArrowRightLeft, Pencil, LogOut, Mail, X } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useToast } from '../context/ToastContext'

export default function GroupDetails() {
  const { addToast } = useToast()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Add member state
  const [showAddMember, setShowAddMember] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState('member')

  // Transfer ownership state
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTarget, setTransferTarget] = useState<string | null>(null)

  // Edit group state
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const currentMember = members.find(m => m.user_id === currentUser?.id)
  const isOwner = currentMember?.role === 'owner'
  const isAdmin = currentMember?.role === 'admin' || isOwner

  useEffect(() => {
    if (id) {
      fetchGroupDetails()
      fetchGroupMembers()
    }
  }, [id])

  // Re-fetch pending invitations whenever membership changes (so we know if
  // the viewer is now an admin who can see them).
  useEffect(() => {
    if (id && isAdmin) {
      fetchInvitations()
    }
  }, [id, isAdmin])


  const fetchGroupDetails = async () => {
    try {
      const res = await api.get(`/groups/${id}`)
      setGroup(res.data)
      setEditName(res.data.name || '')
      setEditDesc(res.data.description || '')
    } catch (err) {
      console.error(err)
      navigate('/groups')
    }
  }

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      await api.put(`/groups/${id}`, { name: editName, description: editDesc })
      addToast('Group updated', 'success')
      setShowEdit(false)
      fetchGroupDetails()
    } catch (err: any) {
      console.error(err)
      addToast(err.response?.data?.detail || 'Failed to update group', 'error')
    }
  }

  const handleLeaveGroup = async () => {
    if (!id) return
    if (!confirm('Are you sure you want to leave this group?')) return
    try {
      await api.post(`/groups/${id}/leave`)
      addToast('You left the group', 'success')
      navigate('/groups')
    } catch (err: any) {
      console.error(err)
      addToast(err.response?.data?.detail || 'Failed to leave group', 'error')
    }
  }

  const fetchGroupMembers = async () => {
    try {
      const res = await api.get(`/groups/${id}/members`)
      setMembers(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    try {
      const res = await api.get(`/users/search?query=${query}`)
      // Filter out existing members
      const existingIds = new Set(members.map(m => m.user_id))
      setSearchResults(res.data.filter((u: User) => !existingIds.has(u.id)))
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await api.put(`/groups/${id}/members/${userId}`, { role: newRole })
      fetchGroupMembers()
    } catch (err) {
      console.error(err)
      addToast('Failed to update role', 'error')
    }
  }

  const handleTransferOwnership = async () => {
    if (!transferTarget || !id) return
    if (!confirm('Are you sure? You will be downgraded to Admin.')) return
    try {
      await api.post(`/groups/${id}/transfer-ownership`, { new_owner_id: transferTarget })
      setShowTransfer(false)
      fetchGroupDetails()
      fetchGroupMembers()
    } catch (err) {
      console.error(err)
      addToast('Failed to transfer ownership', 'error')
    }
  }

  const handleAddMember = async () => {
    if (!selectedUser || !id) return
    try {
      // Send an invitation rather than adding directly: the user must accept.
      await api.post(`/groups/${id}/invitations`, {
        user_id: selectedUser.id,
        role: selectedRole,
      })
      setShowAddMember(false)
      setSelectedUser(null)
      setSearchQuery('')
      addToast('Invitation sent', 'success')
      fetchInvitations()
    } catch (err: any) {
      console.error(err)
      const detail = err?.response?.data?.detail
      addToast(typeof detail === 'string' ? detail : 'Failed to send invitation', 'error')
    }
  }

  const fetchInvitations = async () => {
    if (!id || !isAdmin) return
    try {
      const res = await api.get(`/groups/${id}/invitations`)
      setInvitations(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm('Revoke this invitation?')) return
    try {
      await api.delete(`/invitations/${invitationId}`)
      fetchInvitations()
    } catch (err) {
      console.error(err)
      addToast('Failed to revoke invitation', 'error')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return
    try {
      await api.delete(`/groups/${id}/members/${userId}`)
      fetchGroupMembers()
    } catch (err) {
      console.error(err)
      addToast('Failed to remove member', 'error')
    }
  }

  const handleDeleteGroup = async () => {
      if (!id) return
      if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) return
      try {
          await api.delete(`/groups/${id}`)
          addToast('Group deleted successfully', 'success')
          navigate('/groups')
      } catch (err) {
          console.error(err)
          addToast('Failed to delete group', 'error')
      }
  }

  if (loading) return <div>Loading...</div>
  if (!group) return <div>Group not found</div>

  return (
    <div className="space-y-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
            <p className="mt-2 text-gray-600">{group.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
                onClick={() => setShowEdit(s => !s)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
                <Pencil className="mr-2 h-4 w-4" /> Edit
            </button>
          )}
          {currentMember && !isOwner && (
            <button
                onClick={handleLeaveGroup}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
            >
                <LogOut className="mr-2 h-4 w-4" /> Leave Group
            </button>
          )}
          {isOwner && (
            <button
                onClick={handleDeleteGroup}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
                <Trash2 className="mr-2 h-4 w-4" /> Delete Group
            </button>
          )}
        </div>
      </div>

      {showEdit && isAdmin && (
        <form onSubmit={handleSaveGroup} className="bg-white shadow sm:rounded-lg mb-6 p-6 space-y-4 border border-gray-200">
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
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Save</button>
          </div>
        </form>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Members</h3>
          <div className="flex space-x-2">
            {isOwner && (
              <button
                onClick={() => setShowTransfer(!showTransfer)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer Ownership
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <UserPlus className="mr-2 h-4 w-4" /> Add Member
              </button>
            )}
          </div>
        </div>

        {showTransfer && (
          <div className="px-4 py-5 sm:px-6 bg-yellow-50 border-t border-yellow-200">
            <div className="max-w-lg">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">Transfer Group Ownership</h4>
              <p className="text-xs text-yellow-700 mb-4">
                Select a new owner. You will become an Admin. This action cannot be undone by you.
              </p>
              <div className="flex space-x-2">
                <select
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                  onChange={(e) => setTransferTarget(e.target.value)}
                  value={transferTarget || ''}
                >
                  <option value="">Select member...</option>
                  {members.filter(m => m.user_id !== currentUser?.id).map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user?.full_name || m.user?.email}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleTransferOwnership}
                  disabled={!transferTarget}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
                >
                  Transfer
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddMember && (
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-t border-gray-200">
            <div className="max-w-lg">
              <label className="block text-sm font-medium text-gray-700">Search User</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                  placeholder="Name or email"
                  value={searchQuery}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                />
              </div>
              
              {searchResults.length > 0 && (
                <ul className="mt-2 border border-gray-200 rounded-md max-h-40 overflow-y-auto bg-white">
                  {searchResults.map(user => (
                    <li
                      key={user.id}
                      className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${selectedUser?.id === user.id ? 'bg-indigo-50' : ''}`}
                      onClick={() => {
                        setSelectedUser(user)
                        setSearchResults([])
                        setSearchQuery(user.full_name || user.email)
                      }}
                    >
                      {user.full_name} ({user.email})
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleAddMember}
                  disabled={!selectedUser}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        <ul className="divide-y divide-gray-200">
          {members.map((member) => (
            <li key={member.user_id} className="px-4 py-4 sm:px-6 flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 font-medium">
                    {member.user?.full_name?.[0] || member.user?.email?.[0] || '?'}
                  </span>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">
                    {member.user?.full_name || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {member.user?.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                {member.role === 'owner' ? (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Owner
                  </span>
                ) : (
                  <div className="flex items-center space-x-2">
                    {isAdmin && member.user_id !== currentUser?.id ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.user_id, e.target.value)}
                        className="text-xs border-gray-300 rounded-full px-2 py-1 bg-gray-50"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${member.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {member.role}
                      </span>
                    )}
                    
                    {isAdmin && member.user_id !== currentUser?.id && (
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        className="text-red-600 hover:text-red-900"
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {isAdmin && invitations.length > 0 && (
          <div className="border-t border-gray-200">
            <div className="px-4 py-3 sm:px-6 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Mail className="h-4 w-4" /> Pending invitations ({invitations.length})
              </h4>
            </div>
            <ul className="divide-y divide-gray-200">
              {invitations.map((inv) => (
                <li key={inv.id} className="px-4 py-3 sm:px-6 flex items-center justify-between">
                  <div className="text-sm">
                    <div className="text-gray-900 font-medium">
                      {inv.invitee_id}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Invited as {inv.role} ·{' '}
                      {new Date(inv.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeInvitation(inv.id)}
                    className="text-gray-500 hover:text-red-600"
                    title="Revoke invitation"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
