import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
    children: ReactNode
    /**
     * Optional render override. Receives the captured error and a reset
     * callback that clears the boundary's error state.
     */
    fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
    error: Error | null
}

/**
 * Top-level error boundary. Prevents a render-time exception in any single
 * page from blanking the whole app. We deliberately keep the fallback simple
 * — fancy reporting belongs in a follow-up wave.
 */
export default class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        // We only have console for now; structured error reporting is a
        // dedicated follow-up. Logging here at least makes the failure visible
        // in browser devtools rather than disappearing into a blank screen.
        console.error('ErrorBoundary caught an error:', error, info.componentStack)
    }

    private reset = () => this.setState({ error: null })

    render(): ReactNode {
        const { error } = this.state
        if (!error) return this.props.children

        if (this.props.fallback) {
            return this.props.fallback(error, this.reset)
        }

        return (
            <div className="min-h-[60vh] flex items-center justify-center px-6">
                <div className="max-w-lg w-full bg-white border border-red-200 rounded-lg p-6 shadow-sm">
                    <h1 className="text-lg font-semibold text-red-700 mb-2">
                        Something went wrong
                    </h1>
                    <p className="text-sm text-gray-600 mb-4">
                        An unexpected error prevented this page from rendering.
                        You can try again, or reload the app.
                    </p>
                    <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-auto max-h-40 mb-4">
                        {error.message}
                    </pre>
                    <div className="flex gap-2">
                        <button
                            onClick={this.reset}
                            className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                            Try again
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
                        >
                            Reload
                        </button>
                    </div>
                </div>
            </div>
        )
    }
}
