import { useState, FormEvent, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useToast } from '../context/ToastContext'

export default function ResetPassword() {
    const [params] = useSearchParams()
    const navigate = useNavigate()
    const { addToast } = useToast()
    const token = params.get('token') || ''

    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!token) setError('Missing or invalid reset link.')
    }, [token])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)
        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }
        if (password !== confirm) {
            setError('Passwords do not match.')
            return
        }
        setIsLoading(true)
        try {
            await api.post('/reset-password', { token, new_password: password })
            addToast('Password reset. You can now sign in.', 'success')
            navigate('/login')
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Reset failed. The link may have expired.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
                    Choose a new password
                </h2>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        label="New password"
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={!token}
                    />
                    <Input
                        id="confirm"
                        name="confirm"
                        type="password"
                        label="Confirm password"
                        autoComplete="new-password"
                        required
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        disabled={!token}
                    />
                    {error && (
                        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                            {error}
                        </div>
                    )}
                    <Button
                        type="submit"
                        className="w-full"
                        isLoading={isLoading}
                        disabled={!token}
                    >
                        Reset password
                    </Button>
                    <div className="text-center text-sm">
                        <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
                            Back to sign in
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}
