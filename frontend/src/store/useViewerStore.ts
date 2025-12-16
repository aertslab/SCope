import { create } from 'zustand';
import { ViewerSettings } from '../components/SettingsPanel';
import { Selection } from '../types';

interface ViewerState {
    // Data
    datasetId: string | null;
    dataset: any | null;
    metadata: any | null;
    embeddingData: { X: number[] | Float32Array, Y: number[] | Float32Array, Z: number[] | Float32Array } | null;
    loading: boolean;
    error: string | null;

    // Visual State
    settings: ViewerSettings;
    colours: Record<string, number[]>;
    customColors: Float32Array | null;
    activeColorInfo: { name: string, type: string } | null;
    colorRanges: Record<string, [number, number]>;
    
    // Selection State
    selections: Selection[];
    lassoMode: boolean;
    selectionDetails: { type: 'gene' | 'feature', items: string[] } | undefined;
    selectedLegendItems: string[];

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
    
    reset: () => void;
}

const defaultSettings: ViewerSettings = {
    pointSize: 2,
    embeddingName: '',
    showLabels: true,
    normalization: 'none',
    dimX: 0,
    dimY: 1,
    shape: 0,
    zOrdering: false
};

export const useViewerStore = create<ViewerState>((set) => ({
    datasetId: null,
    dataset: null,
    metadata: null,
    embeddingData: null,
    loading: false,
    error: null,

    settings: defaultSettings,
    colours: { 0: [] },
    customColors: null,
    activeColorInfo: null,
    colorRanges: {},

    selections: [],
    lassoMode: false,
    selectionDetails: undefined,
    selectedLegendItems: [],

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

    reset: () => set({
        dataset: null,
        metadata: null,
        embeddingData: null,
        loading: false,
        error: null,
        settings: defaultSettings,
        colours: { 0: [] },
        customColors: null,
        activeColorInfo: null,
        colorRanges: {},
        selections: [],
        lassoMode: false,
        selectionDetails: undefined,
        selectedLegendItems: []
    })
}));
