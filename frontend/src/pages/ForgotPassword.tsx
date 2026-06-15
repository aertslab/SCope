import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            await api.post('/forgot-password', { email })
        } catch {
            // Endpoint always returns 204 to prevent enumeration. Any error
            // (e.g. rate limit) is surfaced via the global toast interceptor.
        } finally {
            setIsLoading(false)
            setSubmitted(true)
        }
    }

    return (
        <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
                    Forgot your password?
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Enter your email and we'll send you a reset link if an account exists.
                </p>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
                {submitted ? (
                    <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                        If <strong>{email}</strong> matches an account, a password reset link has
                        been emailed. Check your inbox (and spam folder).
                        <div className="mt-3">
                            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
                                Back to sign in
                            </Link>
                        </div>
                    </div>
                ) : (
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            label="Email address"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <Button type="submit" className="w-full" isLoading={isLoading}>
                            Send reset link
                        </Button>
                        <div className="text-center text-sm">
                            <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
                                Back to sign in
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
