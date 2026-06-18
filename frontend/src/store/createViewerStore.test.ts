import { describe, it, expect } from 'vitest'
import { createViewerStore } from './createViewerStore'

// Regression coverage for Bug 3: the viewer store used to be a single global
// singleton, so two panels stomped each other's dataset/colours. With a
// per-instance factory each panel must be fully independent.
describe('per-instance viewer store', () => {
    it('isolates dataset + colour state between two panels', () => {
        const a = createViewerStore('panel-a')
        const b = createViewerStore('panel-b')

        a.getState().setDatasetId('dataset-A')
        b.getState().setDatasetId('dataset-B')
        expect(a.getState().datasetId).toBe('dataset-A')
        expect(b.getState().datasetId).toBe('dataset-B')

        a.getState().setColours({ 0: [1, 2, 3] })
        a.getState().setActiveColorInfo({ name: 'GENE_A', type: 'gene' })
        // Panel B is untouched by Panel A's colour changes.
        expect(b.getState().colours).toEqual({})
        expect(b.getState().activeColorInfo).toBeNull()
    })

    it('reset() only clears its own store', () => {
        const a = createViewerStore('panel-a')
        const b = createViewerStore('panel-b')

        a.getState().setDataset({ id: 'A' })
        b.getState().setDataset({ id: 'B' })
        b.getState().setDatasetId('dataset-B')

        a.getState().reset()
        expect(a.getState().dataset).toBeNull()
        // Sibling panel keeps its data.
        expect(b.getState().dataset).toEqual({ id: 'B' })
        expect(b.getState().datasetId).toBe('dataset-B')
    })

    it('supports functional updates for colorRanges/selections', () => {
        const s = createViewerStore('panel')
        s.getState().setColorRanges({ 0: [0, 1] })
        s.getState().setColorRanges((prev) => ({ ...prev, 1: [2, 3] }))
        expect(s.getState().colorRanges).toEqual({ 0: [0, 1], 1: [2, 3] })
    })
})
