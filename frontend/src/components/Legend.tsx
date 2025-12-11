import { X } from 'lucide-react'

interface LegendItem {
  label: string
  color: string // hex or rgb string
}

interface LegendProps {
  items: LegendItem[]
  selectedItems: string[]
  onSelect: (label: string) => void
  onClear: () => void
  className?: string
}

export function Legend({ items, selectedItems, onSelect, onClear, className = '' }: LegendProps) {
  if (!items || items.length === 0) return null

  return (
    <div className={`absolute bottom-4 z-10 w-80 max-h-[60vh] overflow-y-auto bg-black/80 text-white p-4 rounded backdrop-blur-sm border border-gray-800 flex flex-col transition-all duration-300 ${className || 'left-4'}`}>
      <div className="flex justify-between items-center mb-2 sticky top-0 bg-black/80 pb-2 border-b border-gray-700">
          <div className="text-sm text-gray-400 uppercase font-bold">Legend</div>
          {selectedItems.length > 0 && (
              <button onClick={onClear} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  <X size={12} /> Clear
              </button>
          )}
      </div>
      <div className="space-y-1 overflow-y-auto flex-1">
        {items.map((item) => {
          const isSelected = selectedItems.includes(item.label)
          const isDimmed = selectedItems.length > 0 && !isSelected
          
          return (
          <div 
            key={item.label}
            className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-all ${isDimmed ? 'opacity-40 hover:opacity-70' : 'hover:bg-gray-800'}`}
            onClick={() => onSelect(item.label)}
          >
            <div 
              className="w-4 h-4 rounded-full border border-white/20 shadow-sm shrink-0" 
              style={{ backgroundColor: item.color }}
            />
            <span className={`text-sm truncate ${isSelected ? 'font-bold text-white' : 'text-gray-200'}`}>{item.label}</span>
          </div>
        )})}
      </div>
    </div>
  )
}
