interface LoadingStateProps {
    message?: string
    className?: string
}

export function LoadingState({ message = "Loading...", className = "" }: LoadingStateProps) {
    return (
        <div className={`flex justify-center items-center p-8 text-gray-500 ${className}`}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
            <span>{message}</span>
        </div>
    )
}
