import { useState, useEffect, useMemo } from 'react'
import { Settings2, X } from 'lucide-react'
import { DualRangeSlider } from './DualRangeSlider'

interface ColorScaleControlProps {
    colours: Record<string, number[]>
    activeColorInfo: { name: string, type: string } | null
    onRangeChange: (ranges: Record<string, [number, number]>) => void
}

export function ColorScaleControl({ colours, activeColorInfo, onRangeChange }: ColorScaleControlProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [ranges, setRanges] = useState<Record<string, [number, number]>>({})
    
    // Calculate initial ranges from data
    const dataRanges = useMemo(() => {
        const newRanges: Record<string, [number, number]> = {}
        Object.entries(colours).forEach(([key, data]) => {
            if (!data || data.length === 0) return
            let min = Infinity
            let max = -Infinity
            for (let i = 0; i < data.length; i++) {
                if (data[i] < min) min = data[i]
                if (data[i] > max) max = data[i]
            }
            newRanges[key] = [min, max]
        })
        return newRanges
    }, [colours])

    // Initialize/Reset ranges when data changes
    useEffect(() => {
        setRanges(dataRanges)
        onRangeChange(dataRanges)
    }, [dataRanges, onRangeChange])

    const handleSliderChange = (key: string, newValue: [number, number]) => {
        setRanges(prev => {
            const updated = { ...prev, [key]: newValue }
            onRangeChange(updated)
            return updated
        })
    }

    if (!activeColorInfo || activeColorInfo.type !== 'gene') return null
    if (Object.keys(colours).length === 0) return null

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded transition-colors ${isOpen ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                title="Adjust Color Scales"
            >
                <Settings2 size={20} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 bg-black/90 text-white p-4 rounded border border-gray-800 w-72 backdrop-blur-sm z-50">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold">Color Scale</h3>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {Object.entries(colours).map(([key, data]) => {
                            if (!data || data.length === 0) return null
                            const range = ranges[key] || dataRanges[key] || [0, 1]
                            const dataRange = dataRanges[key] || [0, 1]
                            const color = key === '0' ? 'text-red-500' : key === '1' ? 'text-green-500' : 'text-blue-500'
                            const label = key === '0' ? 'Red' : key === '1' ? 'Green' : 'Blue'

                            return (
                                <div key={key} className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div className={`text-xs font-bold ${color}`}>{label} Channel</div>
                                        <div className="text-[10px] text-gray-400">
                                            {range[0].toFixed(2)} - {range[1].toFixed(2)}
                                        </div>
                                    </div>
                                    
                                    <DualRangeSlider 
                                        min={dataRange[0]}
                                        max={dataRange[1]}
                                        value={range}
                                        onChange={(val) => handleSliderChange(key, val)}
                                        step={(dataRange[1] - dataRange[0]) / 100}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
