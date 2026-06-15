import { Badge } from './ui/Badge'
import { Loader2, AlertCircle } from 'lucide-react'

interface DatasetStatusBadgeProps {
    status?: string;
    failureReason?: string | null;
}

export function DatasetStatusBadge({ status, failureReason }: DatasetStatusBadgeProps) {
    const normalizedStatus = status || 'pending';

    let variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'error' = 'warning';

    if (normalizedStatus === 'ready') variant = 'success';
    else if (normalizedStatus === 'error' || normalizedStatus === 'failed') variant = 'error';

    const isFailed = normalizedStatus === 'failed' || normalizedStatus === 'error';

    return (
        <div className="flex items-center gap-2">
            <Badge variant={variant}>
                {normalizedStatus}
            </Badge>
            {(normalizedStatus === 'pending' || normalizedStatus === 'processing') && (
                <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
            )}
            {isFailed && failureReason && (
                <span
                    className="group relative inline-flex"
                    aria-label="Failure reason"
                >
                    <AlertCircle className="h-4 w-4 text-red-600 cursor-help" />
                    <span
                        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 z-20 hidden group-hover:block w-64 rounded-md bg-gray-900 text-white text-xs p-2 shadow-lg whitespace-pre-wrap break-words"
                        role="tooltip"
                    >
                        {failureReason}
                    </span>
                </span>
            )}
        </div>
    )
}
