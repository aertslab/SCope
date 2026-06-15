import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { useAuthStore } from '../store/useAuthStore'

type Status = 'pending' | 'success' | 'error'

export default function VerifyEmail() {
    const [params] = useSearchParams()
    const token = params.get('token') || ''
    const fetchUser = useAuthStore((s) => s.fetchUser)
    const [status, setStatus] = useState<Status>('pending')
    const [message, setMessage] = useState<string>('')

    useEffect(() => {
        let cancelled = false
        const verify = async () => {
            if (!token) {
                setStatus('error')
                setMessage('Missing or invalid verification link.')
                return
            }
            try {
                await api.post('/verify-email', { token })
                if (cancelled) return
                setStatus('success')
                setMessage('Your email is verified. Thanks!')
                // Refresh /users/me so the banner disappears for logged-in users.
                fetchUser().catch(() => {})
            } catch (err: any) {
                if (cancelled) return
                setStatus('error')
                setMessage(err?.response?.data?.detail || 'Verification failed.')
            }
        }
        verify()
        return () => { cancelled = true }
    }, [token, fetchUser])

    return (
        <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
                <h2 className="mt-10 text-2xl font-bold tracking-tight text-gray-900">
                    Email verification
                </h2>
                <div className="mt-6">
                    {status === 'pending' && (
                        <p className="text-gray-600">Verifying…</p>
                    )}
                    {status === 'success' && (
                        <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                            {message}
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                            {message}
                        </div>
                    )}
                </div>
                <div className="mt-6">
                    <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                        Continue to SCope
                    </Link>
                </div>
            </div>
        </div>
    )
}
