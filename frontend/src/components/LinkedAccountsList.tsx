import { Button } from './ui/Button'
import { Trash2 } from 'lucide-react'
import { OAuthAccount } from '../types'

interface LinkedAccountsListProps {
    accounts: OAuthAccount[]
    onUnlink: (accountId: string) => void
    isLoading?: boolean
    emptyMessage?: string
}

export default function LinkedAccountsList({ 
    accounts, 
    onUnlink, 
    isLoading = false,
    emptyMessage = "No linked accounts found."
}: LinkedAccountsListProps) {
    
    if (isLoading) {
        return <div className="text-sm text-gray-500">Loading linked accounts...</div>
    }

    if (accounts.length === 0) {
        return <div className="text-sm text-gray-500 italic">{emptyMessage}</div>
    }

    return (
        <ul className="divide-y divide-gray-200 border rounded-md">
            {accounts.map(account => (
                <li key={account.id} className="px-4 py-3 flex justify-between items-center">
                    <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 capitalize">{account.provider}</div>
                        <div className="text-xs text-gray-500 font-mono mt-1" title="Provider Account ID">
                            {account.provider_account_id}
                        </div>
                    </div>
                    <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => onUnlink(account.id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 border-red-200 ml-4"
                        title="Unlink Account"
                    >
                        <Trash2 size={16} className="mr-1" /> Unlink
                    </Button>
                </li>
            ))}
        </ul>
    )
}
