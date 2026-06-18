import { describe, it, expect } from 'vitest'
import { calculateStats } from './SelectionOverview'

describe('calculateStats', () => {
    // Regression: selecting ~all cells used to crash with "Maximum call stack
    // size exceeded" because of Math.max(...hugeArray). Must handle 100k+ cells.
    it('computes gene stats over a huge selection without overflowing', () => {
        const n = 500_000
        const indices = Array.from({ length: n }, (_, i) => i)
        const col = new Float32Array(n)
        for (let i = 0; i < n; i++) col[i] = i % 10
        const stats: any = calculateStats(
            indices,
            { type: 'gene', name: 'G' },
            [],
            { 0: col },
            { type: 'gene', items: ['G'] },
        )
        expect(stats.genes).toHaveLength(1)
        expect(stats.genes[0].max).toBe(9)
        expect(stats.genes[0].mean).toBeCloseTo(4.5, 1)
        expect(typeof stats.genes[0].nonZeroPercent).toBe('string')
    })

    it('computes categorical stats and returns the top categories', () => {
        const indices = [0, 1, 2, 3]
        const rawValues = ['A', 'A', 'B', null]
        const stats: any = calculateStats(indices, { type: 'feature', name: 'cell_type' }, rawValues, {}, undefined)
        expect(stats.categories[0].label).toBe('A')
        expect(stats.categories[0].count).toBe(2)
    })
})
