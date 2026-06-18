import { useMemo } from 'react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { Selection } from '../types'

interface SelectionOverviewProps {
    selections: Selection[]
    onUpdateSelection: (id: string, updates: Partial<Selection>) => void
    onDeleteSelection: (id: string) => void
    activeColorInfo: { name: string, type: string } | null
    rawValues: any[] // For categories
    colours: any // For genes
    selectionDetails?: { type: 'gene' | 'feature', items: string[] }
}

export function SelectionOverview({ 
    selections, 
    onUpdateSelection, 
    onDeleteSelection,
    activeColorInfo,
    rawValues,
    colours,
    selectionDetails
}: SelectionOverviewProps) {
    if (selections.length === 0) return null

    return (
        <div className="w-80 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[50vh]">
            <div className="p-3 border-b border-gray-700 font-semibold text-gray-200 flex justify-between items-center">
                <span>Selections</span>
                <span className="text-xs text-gray-400">{selections.length} active</span>
            </div>
            <div className="overflow-y-auto p-2 space-y-2">
                {selections.map(selection => (
                    <SelectionCard 
                        key={selection.id} 
                        selection={selection}
                        onUpdate={(updates: Partial<Selection>) => onUpdateSelection(selection.id, updates)}
                        onDelete={() => onDeleteSelection(selection.id)}
                        activeColorInfo={activeColorInfo}
                        rawValues={rawValues}
                        colours={colours}
                        selectionDetails={selectionDetails}
                    />
                ))}
            </div>
        </div>
    )
}

function SelectionCard({ selection, onUpdate, onDelete, activeColorInfo, rawValues, colours, selectionDetails }: any) {
    // Stats are O(n) over the selected cells — memoize so renaming/recoloring a
    // selection (or any unrelated re-render) doesn't recompute over hundreds of
    // thousands of cells on every keystroke.
    const stats = useMemo(
        () => calculateStats(selection.indices, activeColorInfo, rawValues, colours, selectionDetails),
        [selection.indices, activeColorInfo, rawValues, colours, selectionDetails],
    )

    return (
        <div className="bg-gray-800 rounded p-3 border border-gray-700 text-sm">
            <div className="flex items-center gap-2 mb-2">
                <input 
                    type="color" 
                    value={selection.color}
                    onChange={(e) => onUpdate({ color: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <input 
                    type="text" 
                    value={selection.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="bg-transparent text-gray-200 font-medium flex-1 min-w-0 focus:outline-none focus:border-b border-transparent focus:border-blue-500 transition-colors"
                />
                <button onClick={() => onUpdate({ visible: !selection.visible })} className="text-gray-400 hover:text-white">
                    {selection.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button onClick={onDelete} className="text-gray-400 hover:text-red-400">
                    <Trash2 size={16} />
                </button>
            </div>
            
            <div className="text-gray-400 text-xs space-y-1">
                <div>Count: <span className="text-gray-200">{selection.indices.length} cells</span></div>
                
                {activeColorInfo?.type === 'feature' && stats.categories && (
                    <div className="mt-2">
                        <div className="font-semibold mb-1">Top Categories:</div>
                        {stats.categories.map((c: any) => (
                            <div key={c.label} className="flex justify-between">
                                <span className="truncate pr-2">{c.label}</span>
                                <span>{c.count} ({c.percent}%)</span>
                            </div>
                        ))}
                    </div>
                )}

                {activeColorInfo?.type === 'gene' && stats.genes && stats.genes.map((g: any) => (
                    <div key={g.name} className="mt-2 border-t border-gray-700 pt-1">
                        <div className="font-semibold mb-1 flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${g.color === 'red' ? 'bg-red-500' : g.color === 'green' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                            Expression ({g.name}):
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            <div>Mean: <span className="text-gray-200">{g.mean.toFixed(3)}</span></div>
                            <div>Max: <span className="text-gray-200">{g.max.toFixed(3)}</span></div>
                            <div>Non-zero: <span className="text-gray-200">{g.nonZeroPercent}%</span></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function calculateStats(indices: number[], activeColorInfo: any, rawValues: any[], colours: any, selectionDetails: any) {
    if (!indices.length) return {}

    if (activeColorInfo?.type === 'feature' && rawValues.length) {
        const counts: Record<string, number> = {}
        indices.forEach(idx => {
            const val = rawValues[idx] || 'Unknown'
            counts[val] = (counts[val] || 0) + 1
        })
        
        const sorted = Object.entries(counts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5) // Top 5
            .map(([label, count]) => ({
                label,
                count,
                percent: ((count / indices.length) * 100).toFixed(1)
            }))
            
        return { categories: sorted }
    }

    if (activeColorInfo?.type === 'gene' && colours) {
        let geneNames: string[] = []
        if (selectionDetails?.type === 'gene' && selectionDetails.items) {
            geneNames = selectionDetails.items
        } else {
            geneNames = activeColorInfo.name.split(' / ')
        }

        const stats = []

        // Check slots 0, 1, 2. Single pass per channel — never spread the value
        // array into Math.max (it overflows the arg limit / call stack at scale).
        const n = indices.length
        for (let i = 0; i < 3; i++) {
            const name = geneNames[i]
            const col = colours[i]
            if (col && name) {
                let sum = 0
                let max = -Infinity
                let nonZero = 0
                for (let k = 0; k < n; k++) {
                    const v = col[indices[k]]
                    if (v === undefined || v === null) continue
                    sum += v
                    if (v > max) max = v
                    if (v > 0) nonZero++
                }
                stats.push({
                    name: name,
                    color: i === 0 ? 'red' : i === 1 ? 'green' : 'blue',
                    mean: n ? sum / n : 0,
                    max: max === -Infinity ? 0 : max,
                    nonZeroPercent: (n ? (nonZero / n) * 100 : 0).toFixed(1)
                })
            }
        }
        
        return { genes: stats }
    }

    return {}
}
