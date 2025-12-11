import { ReactNode } from 'react'

interface PageHeaderProps {
    title: string
    children?: ReactNode
    className?: string
}

export function PageHeader({ title, children, className = "" }: PageHeaderProps) {
    return (
        <div className={`flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 ${className}`}>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <div className="flex items-center gap-4 w-full sm:w-auto">
                {children}
            </div>
        </div>
    )
}
