import { useState } from 'react'
import { X, ChevronsDownUp, ChevronsUpDown, Minus } from 'lucide-react'

interface LegendItem {
  label: string
  color: string // hex or rgb string
}

interface LegendProps {
  items: LegendItem[]
  selectedItems: string[]
  onSelect: (label: string) => void
  onClear: () => void
  /** Preview a category on hover (null when the cursor leaves the entries). */
  onHover?: (label: string | null) => void
  className?: string
}

// The legend can take up a lot of space with many categories, so it cycles
// through three sizes: the full list, a compact ~3-row scrollable list, and a
// title-only bar.
type LegendMode = 'full' | 'compact' | 'min'
const NEXT_MODE: Record<LegendMode, LegendMode> = { full: 'compact', compact: 'min', min: 'full' }
const MODE_TITLE: Record<LegendMode, string> = {
  full: 'Collapse legend (show 3 rows)',
  compact: 'Minimize legend (title only)',
  min: 'Expand legend',
}

export function Legend({ items, selectedItems, onSelect, onClear, onHover, className = '' }: LegendProps) {
  const [mode, setMode] = useState<LegendMode>('full')

  if (!items || items.length === 0) return null

  const ModeIcon = mode === 'min' ? ChevronsUpDown : mode === 'full' ? ChevronsDownUp : Minus

  return (
    <div className={`absolute bottom-4 z-10 w-80 bg-black/80 text-white p-4 rounded backdrop-blur-sm border border-gray-800 flex flex-col transition-all duration-300 ${className || 'left-4'}`}>
      <div className="flex justify-between items-center sticky top-0 bg-black/80 border-gray-700">
          <div className="text-sm text-gray-400 uppercase font-bold">
              Legend <span className="text-gray-600 font-normal normal-case">({items.length})</span>
          </div>
          <div className="flex items-center gap-3">
              {selectedItems.length > 0 && (
                  <button onClick={onClear} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <X size={12} /> Clear
                  </button>
              )}
              <button
                  onClick={() => setMode((m) => NEXT_MODE[m])}
                  title={MODE_TITLE[mode]}
                  className="text-gray-400 hover:text-white"
              >
                  <ModeIcon size={14} />
              </button>
          </div>
      </div>
      {mode !== 'min' && (
        <div
          className={`space-y-1 overflow-y-auto flex-1 mt-2 pt-2 border-t border-gray-700 ${mode === 'compact' ? 'max-h-[7.5rem]' : 'max-h-[60vh]'}`}
          onMouseLeave={() => onHover?.(null)}
        >
          {items.map((item) => {
            const isSelected = selectedItems.includes(item.label)
            const isDimmed = selectedItems.length > 0 && !isSelected

            return (
            <div
              key={item.label}
              className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-all ${isDimmed ? 'opacity-40 hover:opacity-70' : 'hover:bg-gray-800'}`}
              onClick={() => onSelect(item.label)}
              onMouseEnter={() => onHover?.(item.label)}
            >
              <div
                className="w-4 h-4 rounded-full border border-white/20 shadow-sm shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className={`text-sm truncate ${isSelected ? 'font-bold text-white' : 'text-gray-200'}`}>{item.label}</span>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}
