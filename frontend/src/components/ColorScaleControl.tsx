import { useState, useEffect, useMemo, useRef } from 'react'
import { Settings2, X } from 'lucide-react'
import { DualRangeSlider } from './DualRangeSlider'

interface ColorScaleControlProps {
    colours: Record<string, number[]>
    activeColorInfo: { name: string, type: string } | null
    onRangeChange: (ranges: Record<string, [number, number]>) => void
    isOpen: boolean
    onToggle: () => void
    // Per-channel column name (slot '0'/'1'/'2' -> gene/metric name). Used to
    // detect when a channel's *gene* changed (vs. just an unrelated channel
    // being added) so a swap always resets even if the new gene's auto-bounds
    // coincide with the old one's.
    colourNames?: Record<string, string>
}

export function ColorScaleControl({ colours, activeColorInfo, onRangeChange, isOpen, onToggle, colourNames = {} }: ColorScaleControlProps) {
    const [ranges, setRanges] = useState<Record<string, [number, number]>>({})
    // Mirror of `ranges` (and the auto-bounds + per-channel identity last
    // applied) kept in refs so the reset effect can merge without listing
    // `ranges`/`colourNames` as dependencies (which would re-run it on every
    // user drag / render).
    const rangesRef = useRef<Record<string, [number, number]>>({})
    const prevDataRangesRef = useRef<Record<string, [number, number]>>({})
    const prevNamesRef = useRef<Record<string, string>>({})
    const namesRef = useRef<Record<string, string>>(colourNames)
    namesRef.current = colourNames

    // Calculate auto min/max per channel from the data
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

    // Initialise/reset ranges when the data changes — but ONLY for channels
    // whose underlying data actually changed. Previously this reset ALL channels
    // whenever `colours` changed (a new object reference on every gene add), so
    // adding a second gene wiped the manual scale the user had set on the first.
    // We now reset a channel only when its auto-bounds differ from last time
    // (i.e. a different gene in that slot, or a normalization/scaling change that
    // shifts the bounds) and otherwise preserve the user's adjusted range.
    useEffect(() => {
        const prevRanges = rangesRef.current
        const prevBounds = prevDataRangesRef.current
        const prevNames = prevNamesRef.current
        const names = namesRef.current
        const merged: Record<string, [number, number]> = {}
        Object.entries(dataRanges).forEach(([key, [min, max]]) => {
            const pb = prevBounds[key]
            const boundsChanged = !pb || pb[0] !== min || pb[1] !== max
            // The gene/metric occupying this channel changed (a swap) even if its
            // bounds coincide with the previous occupant's.
            const idChanged = (prevNames[key] ?? '') !== (names[key] ?? '')
            const existing = prevRanges[key]
            merged[key] = (boundsChanged || idChanged || !existing) ? [min, max] : existing
        })
        prevDataRangesRef.current = dataRanges
        prevNamesRef.current = names
        rangesRef.current = merged
        setRanges(merged)
        onRangeChange(merged)
    }, [dataRanges, onRangeChange])

    const handleSliderChange = (key: string, newValue: [number, number]) => {
        const updated = { ...rangesRef.current, [key]: newValue }
        rangesRef.current = updated
        setRanges(updated)
        onRangeChange(updated)
    }

    if (!activeColorInfo || activeColorInfo.type !== 'gene') return null
    if (Object.keys(colours).length === 0) return null

    return (
        <div className="relative">
            <button
                onClick={onToggle}
                className={`p-2 rounded transition-colors ${isOpen ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                title="Adjust Color Scales"
            >
                <Settings2 size={20} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 bg-black/90 text-white p-4 rounded border border-gray-800 w-72 backdrop-blur-sm z-50">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold">Color Scale</h3>
                        <button onClick={onToggle} className="text-gray-400 hover:text-white">
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
