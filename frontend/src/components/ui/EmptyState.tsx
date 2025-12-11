import { ReactNode } from 'react'

interface EmptyStateProps {
    message: string
    icon?: ReactNode
    action?: ReactNode
    className?: string
}

export function EmptyState({ message, icon, action, className = "" }: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center text-gray-500 ${className}`}>
            {icon && <div className="mb-4 text-gray-400">{icon}</div>}
            <p className="text-lg font-medium text-gray-900 mb-1">{message}</p>
            {action && <div className="mt-4">{action}</div>}
        </div>
    )
}
