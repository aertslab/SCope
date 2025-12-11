import { useState, useEffect } from 'react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuthStore } from '../store/useAuthStore'
import LinkedAccountsList from '../components/LinkedAccountsList'
import { OAuthAccount } from '../types'

export default function Profile() {
  const { user, fetchUser } = useAuthStore()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState<OAuthAccount[]>([])
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    current_password: '',
    password: '',
    confirm_password: ''
  })

  useEffect(() => {
    fetchLinkedAccounts()
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

  const handleLinkOrcid = () => {
    const token = localStorage.getItem('token')
    if (token) {
      window.location.href = `http://127.0.0.1:8000/api/v1/link/orcid?token=${token}`
    } else {
      addToast('You must be logged in to link accounts', 'error')
    }
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Profile
          </h2>
        </div>
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
    </div>
  )
}
