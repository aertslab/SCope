import { Badge } from './ui/Badge'
import { Loader2 } from 'lucide-react'

interface DatasetStatusBadgeProps {
    status?: string;
}

export function DatasetStatusBadge({ status }: DatasetStatusBadgeProps) {
    const normalizedStatus = status || 'pending';
    
    let variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'error' = 'warning';
    
    if (normalizedStatus === 'ready') variant = 'success';
    else if (normalizedStatus === 'error' || normalizedStatus === 'failed') variant = 'error';
    
    return (
        <div className="flex items-center gap-2">
            <Badge variant={variant}>
                {normalizedStatus}
            </Badge>
            {(normalizedStatus === 'pending' || normalizedStatus === 'processing') && (
                <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
            )}
        </div>
    )
}
