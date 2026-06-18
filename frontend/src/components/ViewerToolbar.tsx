import { useState } from 'react'
import { Settings as SettingsIcon, Share2, Copy, Check, Lasso, Filter } from 'lucide-react'
import { useViewerStore } from '../store/useViewerStore'
import { ColorScaleControl } from './ColorScaleControl'
import { SettingsPanel } from './SettingsPanel'

interface ViewerToolbarProps {
    isShareOpen: boolean
    onShareToggle: () => void
    shareUrl: string | null
    onCopyShareUrl: () => void
    isSettingsOpen: boolean
    onSettingsToggle: () => void
    isColorScaleOpen: boolean
    onColorScaleToggle: () => void
    isFilterOpen: boolean
    onFilterToggle: () => void
    onReset: () => void
}

export function ViewerToolbar({
    isShareOpen,
    onShareToggle,
    shareUrl,
    onCopyShareUrl,
    isSettingsOpen,
    onSettingsToggle,
    isColorScaleOpen,
    onColorScaleToggle,
    isFilterOpen,
    onFilterToggle,
    onReset
}: ViewerToolbarProps) {
    const {
        metadata,
        settings,
        colours,
        activeColorInfo,
        lassoMode,
        setSettings,
        setColorRanges,
        setLassoMode,
        filterTokens
    } = useViewerStore()

    const hasFilter = filterTokens.length > 0

    const [isCopied, setIsCopied] = useState(false)

    const handleCopy = () => {
        onCopyShareUrl()
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <div className="absolute top-4 right-72 z-[200] flex gap-2 items-center">
            {/* Share Button */}
            <div 
                className={`flex items-center bg-gray-800 rounded transition-all duration-300 overflow-hidden ${isShareOpen ? 'w-80' : 'w-10'}`}
                onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                        // Optional: close on blur if desired, but might conflict with click handling
                        // onShareToggle() 
                    }
                }}
            >
                <button 
                    onClick={onShareToggle}
                    className="text-white p-2 hover:bg-gray-700 transition-colors flex-shrink-0"
                    title="Share Session"
                >
                    <Share2 size={20} />
                </button>
                {isShareOpen && shareUrl && (
                    <div className="flex items-center flex-1 pr-1 min-w-0">
                        <input 
                            type="text" 
                            readOnly 
                            value={shareUrl} 
                            className="bg-gray-900 text-gray-300 text-xs px-2 py-1 rounded border border-gray-700 flex-1 min-w-0 mr-1 focus:outline-none"
                            onClick={(e) => e.currentTarget.select()}
                            autoFocus
                        />
                        <button 
                            onClick={handleCopy}
                            className="text-gray-400 hover:text-white p-1"
                            title="Copy to clipboard"
                        >
                            {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                    </div>
                )}
            </div>

            {/* Lasso Button */}
            <button
                onClick={() => setLassoMode(!lassoMode)}
                className={`text-white p-2 rounded transition-colors ${lassoMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-800 hover:bg-gray-700'}`}
                title={lassoMode ? "Deactivate Lasso Selection" : "Activate Lasso Selection"}
            >
                <Lasso size={20} />
            </button>

            {/* Filter Button — expands the filter bar. A dot marks an active filter. */}
            <button
                onClick={onFilterToggle}
                className={`relative text-white p-2 rounded transition-colors mr-2 ${isFilterOpen || hasFilter ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-800 hover:bg-gray-700'}`}
                title={hasFilter ? 'Filter active' : isFilterOpen ? 'Hide filter bar' : 'Filter cells'}
            >
                <Filter size={20} />
                {hasFilter && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 border border-gray-900" />
                )}
            </button>

            {/* Color Scale Control */}
            <ColorScaleControl 
                colours={colours}
                activeColorInfo={activeColorInfo}
                onRangeChange={setColorRanges}
                isOpen={isColorScaleOpen}
                onToggle={onColorScaleToggle}
            />

            {/* Settings Button & Panel */}
            <div className="relative">
                <button 
                    onClick={onSettingsToggle}
                    className={`text-white p-2 rounded transition-colors ${isSettingsOpen ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                    <SettingsIcon size={20} />
                </button>

                <SettingsPanel 
                    isOpen={isSettingsOpen}
                    onClose={onSettingsToggle}
                    settings={settings}
                    onSettingsChange={setSettings}
                    availableEmbeddings={metadata?.embeddings?.map((e: any) => e.name) || []}
                    onReset={onReset}
                />
            </div>
        </div>
    )
}
