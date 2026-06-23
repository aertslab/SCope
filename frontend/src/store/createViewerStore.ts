import { createStore } from 'zustand/vanilla';
import { ViewerSettings } from '../components/SettingsPanel';
import { Selection } from '../types';
import { Token } from '../filters/types';

// Per-panel viewer state. Previously this was a single module-level store
// shared by every ThreeViewerPanel, which caused panels to overwrite each
// other's dataset/embedding/colours (Bug 3) and made multi-panel session
// restore stomp itself (Bug 4). Each panel now owns an isolated store created
// by `createViewerStore` and provided via ViewerStoreContext.
export interface ViewerState {
    // Data
    datasetId: string | null;
    dataset: any | null;
    metadata: any | null;
    embeddingData: { X: number[] | Float32Array, Y: number[] | Float32Array, Z: number[] | Float32Array } | null;
    loading: boolean;
    error: string | null;

    // Visual State
    settings: ViewerSettings;
    // Slot-keyed colour channels: '0' = Red, '1' = Green, '2' = Blue. Each value
    // is the per-cell numeric column for a gene OR continuous metric assigned to
    // that channel. Categorical features instead use `customColors` (precomputed
    // per-cell RGB).
    colours: Record<string, number[]>;
    customColors: Float32Array | null;
    activeColorInfo: { name: string, type: string } | null;
    colorRanges: Record<string, [number, number]>;

    // Selection State
    selections: Selection[];
    lassoMode: boolean;
    selectionDetails: { type: 'gene' | 'feature', items: string[] } | undefined;
    selectedLegendItems: string[];

    // Filter State
    // `filterTokens` is the user-built boolean filter (the source of truth, and
    // serializable into shared sessions). `filterMask` is its derived per-cell
    // result (1 = visible) — null means no active filter (all cells visible).
    // `filterEnabled` lets the user keep a filter but temporarily show all cells.
    filterTokens: Token[];
    filterEnabled: boolean;
    filterMask: Uint8Array | null;
    filterCount: { matched: number; total: number } | null;

    // Actions
    setDatasetId: (id: string | null) => void;
    setDataset: (data: any) => void;
    setMetadata: (data: any) => void;
    setEmbeddingData: (data: any) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    setSettings: (settings: ViewerSettings | ((prev: ViewerSettings) => ViewerSettings)) => void;
    setColours: (colours: any) => void;
    setCustomColors: (colors: Float32Array | null) => void;
    setActiveColorInfo: (info: { name: string, type: string } | null) => void;
    setColorRanges: (ranges: Record<string, [number, number]> | ((prev: Record<string, [number, number]>) => Record<string, [number, number]>)) => void;

    setSelections: (selections: Selection[] | ((prev: Selection[]) => Selection[])) => void;
    setLassoMode: (mode: boolean) => void;
    setSelectionDetails: (details: { type: 'gene' | 'feature', items: string[] } | undefined) => void;
    setSelectedLegendItems: (items: string[] | ((prev: string[]) => string[])) => void;

    setFilterTokens: (tokens: Token[] | ((prev: Token[]) => Token[])) => void;
    setFilterEnabled: (enabled: boolean) => void;
    setFilterResult: (mask: Uint8Array | null, count: { matched: number; total: number } | null) => void;

    reset: () => void;
}

const defaultSettings: ViewerSettings = {
    pointSize: 2,
    labelSize: 12,
    embeddingName: '',
    showLabels: true,
    normalization: 'none',
    dimX: 0,
    dimY: 1,
    dimZ: 2,
    is3D: false,
    shape: 0,
    zOrdering: true
};

export const createViewerStore = (_instanceId?: string) =>
    createStore<ViewerState>((set) => ({
        datasetId: null,
        dataset: null,
        metadata: null,
        embeddingData: null,
        loading: false,
        error: null,

        settings: defaultSettings,
        colours: {},
        customColors: null,
        activeColorInfo: null,
        colorRanges: {},

        selections: [],
        lassoMode: false,
        selectionDetails: undefined,
        selectedLegendItems: [],

        filterTokens: [],
        filterEnabled: true,
        filterMask: null,
        filterCount: null,

        setDatasetId: (id) => set({ datasetId: id }),
        setDataset: (data) => set({ dataset: data }),
        setMetadata: (data) => set({ metadata: data }),
        setEmbeddingData: (data) => set({ embeddingData: data }),
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),

        setSettings: (settings) => set((state) => ({
            settings: typeof settings === 'function' ? settings(state.settings) : settings
        })),
        setColours: (colours) => set({ colours }),
        setCustomColors: (colors) => set({ customColors: colors }),
        setActiveColorInfo: (info) => set({ activeColorInfo: info }),
        setColorRanges: (ranges) => set((state) => ({
            colorRanges: typeof ranges === 'function' ? ranges(state.colorRanges) : ranges
        })),

        setSelections: (selections) => set((state) => ({
            selections: typeof selections === 'function' ? selections(state.selections) : selections
        })),
        setLassoMode: (mode) => set({ lassoMode: mode }),
        setSelectionDetails: (details) => set({ selectionDetails: details }),
        setSelectedLegendItems: (items) => set((state) => ({
            selectedLegendItems: typeof items === 'function' ? items(state.selectedLegendItems) : items
        })),

        setFilterTokens: (tokens) => set((state) => ({
            filterTokens: typeof tokens === 'function' ? tokens(state.filterTokens) : tokens
        })),
        setFilterEnabled: (enabled) => set({ filterEnabled: enabled }),
        setFilterResult: (mask, count) => set({ filterMask: mask, filterCount: count }),

        reset: () => set({
            dataset: null,
            metadata: null,
            embeddingData: null,
            loading: false,
            error: null,
            settings: defaultSettings,
            colours: {},
            customColors: null,
            activeColorInfo: null,
            colorRanges: {},
            selections: [],
            lassoMode: false,
            selectionDetails: undefined,
            selectedLegendItems: [],
            filterTokens: [],
            filterEnabled: true,
            filterMask: null,
            filterCount: null
        })
    }));

export type ViewerStore = ReturnType<typeof createViewerStore>;
