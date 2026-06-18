import { useEffect, useState } from 'react'
import api from '../../api/client'
import { User, OAuthAccount } from '../../types'
import { Mail, Shield, User as UserIcon, X, HardDrive } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import LinkedAccountsList from '../../components/LinkedAccountsList'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'

interface UserDiskUsage {
    user_id: string
    total_usage: number
    dataset_count: number
}

export default function AdminUsers() {
    const { user: currentUser } = useAuthStore()
    const [users, setUsers] = useState<User[]>([])
    const [diskUsage, setDiskUsage] = useState<Record<string, UserDiskUsage>>({})
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    // Modal state
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [oauthAccounts, setOauthAccounts] = useState<OAuthAccount[]>([])
    const [loadingOAuth, setLoadingOAuth] = useState(false)

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const [usersRes, usageRes] = await Promise.all([
                api.get('/users/'),
                api.get('/admin/disk-usage')
            ])
            setUsers(usersRes.data)
            
            const usageMap: Record<string, UserDiskUsage> = {}
            usageRes.data.forEach((u: any) => {
                usageMap[u.user_id] = u
            })
            setDiskUsage(usageMap)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const formatBytes = (bytes: number) => {
        if (!bytes) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
    }

    const handleEditClick = async (user: User) => {
        setSelectedUser(user)
        setIsModalOpen(true)
        setLoadingOAuth(true)
        try {
            const res = await api.get(`/users/${user.id}/oauth-accounts`)
            setOauthAccounts(res.data)
        } catch (err) {
            console.error(err)
            setOauthAccounts([])
        } finally {
            setLoadingOAuth(false)
        }
    }

    const handleUpdateUser = async (updates: Partial<User>) => {
        if (!selectedUser) return
        
        // Prevent self-deactivation
        if (selectedUser.id === currentUser?.id && updates.is_active === false) {
            alert("You cannot deactivate your own account.")
            return
        }

        try {
            const res = await api.put(`/users/${selectedUser.id}`, updates)
            setUsers(users.map(u => u.id === selectedUser.id ? res.data : u))
            setSelectedUser(res.data)
        } catch (err) {
            console.error(err)
            alert('Failed to update user')
        }
    }

    const handleUnlinkOAuth = async (accountId: string) => {
        if (!selectedUser || !confirm('Are you sure you want to unlink this account?')) return
        try {
            await api.delete(`/users/${selectedUser.id}/oauth-accounts/${accountId}`)
            setOauthAccounts(oauthAccounts.filter(a => a.id !== accountId))
        } catch (err) {
            console.error(err)
            alert('Failed to unlink account')
        }
    }

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(search.toLowerCase()) || 
        (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase()))
    )

    return (
        <div>
            <PageHeader title="Manage Users">
                <SearchInput 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users..."
                />
            </PageHeader>

            <div className="bg-white shadow overflow-x-auto sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disk Usage</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Edit</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={5}><LoadingState /></td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan={5}><EmptyState message="No users found" /></td></tr>
                        ) : (
                            filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                                                <UserIcon className="h-5 w-5 text-gray-500" />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{user.full_name || 'No Name'}</div>
                                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Mail size={12} /> {user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {user.is_superuser ? (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 flex items-center gap-1 w-fit">
                                                <Shield size={12} /> Admin
                                            </span>
                                        ) : (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                User
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center text-sm text-gray-900">
                                            <HardDrive size={16} className="mr-2 text-gray-400" />
                                            {formatBytes(diskUsage[user.id]?.total_usage || 0)}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {diskUsage[user.id]?.dataset_count || 0} datasets
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            onClick={() => handleEditClick(user)}
                                            className="text-indigo-600 hover:text-indigo-900"
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit User Modal */}
            {isModalOpen && selectedUser && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsModalOpen(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        Edit User: {selectedUser.full_name || selectedUser.email}
                                    </h3>
                                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                        <X size={20} />
                                    </button>
                                </div>
                                
                                <div className="mt-4 space-y-4">
                                    {/* Permissions */}
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Permissions</h4>
                                        <div className="flex flex-col gap-2">
                                            <label className="flex items-center space-x-3">
                                                <input 
                                                    type="checkbox" 
                                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                                                    checked={selectedUser.is_active}
                                                    onChange={(e) => handleUpdateUser({ is_active: e.target.checked })}
                                                    disabled={selectedUser.id === currentUser?.id}
                                                />
                                                <span className={`text-gray-700 ${selectedUser.id === currentUser?.id ? 'opacity-50' : ''}`}>
                                                    Active Account {selectedUser.id === currentUser?.id && '(Cannot deactivate self)'}
                                                </span>
                                            </label>
                                            <label className="flex items-center space-x-3">
                                                <input 
                                                    type="checkbox" 
                                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                    checked={selectedUser.is_superuser}
                                                    onChange={(e) => handleUpdateUser({ is_superuser: e.target.checked })}
                                                />
                                                <span className="text-gray-700">Superuser (Admin)</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* OAuth Accounts */}
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Linked Accounts</h4>
                                        <LinkedAccountsList 
                                            accounts={oauthAccounts} 
                                            onUnlink={handleUnlinkOAuth} 
                                            isLoading={loadingOAuth}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button 
                                    type="button" 
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
