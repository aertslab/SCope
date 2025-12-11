import { Search } from 'lucide-react'

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    className?: string
}

export function SearchInput({ 
    value, 
    onChange, 
    placeholder = "Search...", 
    className = "",
    ...props 
}: SearchInputProps) {
    return (
        <div className={`relative ${className}`}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                {...props}
            />
        </div>
    )
}
