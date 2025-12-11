export const compressIndices = (indices: number[]): string => {
    if (indices.length === 0) return ""
    // Sort unique indices
    const sorted = Array.from(new Set(indices)).sort((a, b) => a - b)
    const ranges: string[] = []
    let start = sorted[0]
    let end = sorted[0]

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === end + 1) {
            end = sorted[i]
        } else {
            ranges.push(start === end ? `${start}` : `${start}-${end}`)
            start = sorted[i]
            end = sorted[i]
        }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`)
    return ranges.join(',')
}

export const decompressIndices = (compressed: string): number[] => {
    if (!compressed) return []
    const indices: number[] = []
    const parts = compressed.split(',')
    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number)
            for (let i = start; i <= end; i++) indices.push(i)
        } else {
            indices.push(Number(part))
        }
    }
    return indices
}
