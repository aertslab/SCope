import { X, Settings as SettingsIcon } from 'lucide-react'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  settings: ViewerSettings
  onSettingsChange: (newSettings: ViewerSettings) => void
  availableEmbeddings: string[]
  onReset: () => void
}

export interface ViewerSettings {
  pointSize: number
  embeddingName: string
  showLabels: boolean
  normalization: 'none' | 'log' | 'cpm' | 'log_cpm'
  dimX: number
  dimY: number
  shape: number
  zOrdering: boolean
}

export function SettingsPanel({ isOpen, onClose, settings, onSettingsChange, availableEmbeddings, onReset }: SettingsPanelProps) {
  if (!isOpen) return null

  const handleChange = (key: keyof ViewerSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="absolute top-full right-0 mt-2 z-20 w-64 bg-black/90 text-white p-4 rounded backdrop-blur-sm border border-gray-800 shadow-xl">
      <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
        <h2 className="font-bold flex items-center gap-2">
          <SettingsIcon size={16} /> Settings
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Point Size */}
        <div>
          <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Point Size</label>
          <input 
            type="range" 
            min="0.1" 
            max="10" 
            step="0.1"
            value={settings.pointSize}
            onChange={(e) => handleChange('pointSize', parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="text-right text-xs text-gray-500">{settings.pointSize}</div>
        </div>

        {/* Shape */}
        <div>
          <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Shape</label>
          <select
            value={settings.shape || 0}
            onChange={(e) => handleChange('shape', parseInt(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value={0}>Circle</option>
            <option value={1}>Square</option>
            <option value={2}>Hexagon (Flat)</option>
            <option value={3}>Hexagon (Pointy)</option>
          </select>
        </div>

        {/* Embedding */}
        <div>
          <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Embedding</label>
          <select 
            value={settings.embeddingName}
            onChange={(e) => handleChange('embeddingName', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded p-1 text-sm focus:outline-none focus:border-blue-500"
          >
            {availableEmbeddings.map(emb => (
              <option key={emb} value={emb}>{emb}</option>
            ))}
          </select>
        </div>

        {/* Dimensions (Placeholder for now, assuming 2D) */}
        {/* 
        <div className="flex gap-2">
            <div className="flex-1">
                <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Dim X</label>
                <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded p-1 text-sm" />
            </div>
            <div className="flex-1">
                <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Dim Y</label>
                <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded p-1 text-sm" />
            </div>
        </div> 
        */}

        {/* Normalization */}
        <div>
          <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Normalization</label>
          <select 
            value={settings.normalization}
            onChange={(e) => handleChange('normalization', e.target.value as any)}
            className="w-full bg-gray-800 border border-gray-700 rounded p-1 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="none">None (Raw)</option>
            <option value="log">Log1p</option>
            <option value="cpm">CPM</option>
            <option value="log_cpm">LogCPM</option>
          </select>
        </div>

        {/* Toggles */}
        <div className="flex items-center justify-between">
          <label className="text-sm">Show Labels</label>
          <input 
            type="checkbox" 
            checked={settings.showLabels}
            onChange={(e) => handleChange('showLabels', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm">Z-Ordering (Expression/Selection)</label>
          <input 
            type="checkbox" 
            checked={settings.zOrdering}
            onChange={(e) => handleChange('zOrdering', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
        </div>

        <div className="pt-4 border-t border-gray-700">
            <button 
                onClick={onReset}
                className="w-full bg-red-900/50 hover:bg-red-800 text-red-200 text-xs py-2 rounded transition-colors"
            >
                Reset Saved Settings
            </button>
        </div>
      </div>
    </div>
  )
}
