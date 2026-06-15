interface PanelSkeletonProps {
    /** Number of shimmer rows to show. */
    rows?: number
    /** Inline label shown next to the spinner. */
    label?: string
    className?: string
}

/**
 * Lightweight inline loader for a single card/panel. Unlike `LoadingState`
 * this is meant to live *inside* a card so the rest of the page keeps
 * rendering while one slow endpoint catches up.
 */
export function PanelSkeleton({ rows = 2, label, className = '' }: PanelSkeletonProps) {
    return (
        <div className={`animate-pulse space-y-2 ${className}`} aria-busy="true" aria-live="polite">
            {label && <div className="text-xs text-gray-400">{label}</div>}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="h-3 bg-gray-200 rounded" style={{ width: `${100 - i * 12}%` }} />
            ))}
        </div>
    )
}
