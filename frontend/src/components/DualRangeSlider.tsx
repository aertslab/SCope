import { useState, useEffect, useRef, useCallback } from 'react'

interface DualRangeSliderProps {
    min: number
    max: number
    value: [number, number]
    onChange: (value: [number, number]) => void
    step?: number
}

export function DualRangeSlider({ min, max, value, onChange, step = 0.01 }: DualRangeSliderProps) {
    const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null)
    const trackRef = useRef<HTMLDivElement>(null)

    const getPercentage = useCallback((val: number) => {
        return ((val - min) / (max - min)) * 100
    }, [min, max])

    const getValueFromClientX = useCallback((clientX: number) => {
        if (!trackRef.current) return 0
        const rect = trackRef.current.getBoundingClientRect()
        const percentage = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
        const rawValue = percentage * (max - min) + min
        // Round to step
        return Math.round(rawValue / step) * step
    }, [min, max, step])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return

            const newValue = getValueFromClientX(e.clientX)
            
            if (isDragging === 'min') {
                const newMin = Math.min(newValue, value[1] - step)
                if (newMin >= min) {
                    onChange([newMin, value[1]])
                }
            } else {
                const newMax = Math.max(newValue, value[0] + step)
                if (newMax <= max) {
                    onChange([value[0], newMax])
                }
            }
        }

        const handleMouseUp = () => {
            setIsDragging(null)
        }

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, value, onChange, getValueFromClientX, min, max, step])

    const minPercent = getPercentage(value[0])
    const maxPercent = getPercentage(value[1])

    return (
        <div className="relative w-full h-6 flex items-center select-none" ref={trackRef}>
            {/* Track Background */}
            <div className="absolute w-full h-1 bg-gray-700 rounded"></div>
            
            {/* Active Range */}
            <div 
                className="absolute h-1 bg-blue-500 rounded"
                style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }}
            ></div>

            {/* Min Thumb */}
            <div
                className="absolute w-3 h-3 bg-white rounded-full shadow cursor-pointer hover:scale-125 transition-transform"
                style={{ left: `${minPercent}%`, transform: 'translateX(-50%)' }}
                onMouseDown={() => setIsDragging('min')}
            ></div>

            {/* Max Thumb */}
            <div
                className="absolute w-3 h-3 bg-white rounded-full shadow cursor-pointer hover:scale-125 transition-transform"
                style={{ left: `${maxPercent}%`, transform: 'translateX(-50%)' }}
                onMouseDown={() => setIsDragging('max')}
            ></div>
        </div>
    )
}
