import { createContext, useContext, ReactNode } from 'react';
import { useStore } from 'zustand';
import { ViewerStore, ViewerState } from './createViewerStore';

// React context carrying the panel-scoped viewer store. A ThreeViewerPanel
// creates one store per instance and provides it here; ViewerToolbar /
// ColorScaleControl and the panel body read from it. Canvas (r3f) children are
// driven by props, not this context, so no reconciler bridging is required.
const ViewerStoreContext = createContext<ViewerStore | null>(null);

export function ViewerStoreProvider({ store, children }: { store: ViewerStore; children: ReactNode }) {
    return <ViewerStoreContext.Provider value={store}>{children}</ViewerStoreContext.Provider>;
}

export function useViewerStoreApi(): ViewerStore {
    const store = useContext(ViewerStoreContext);
    if (!store) {
        throw new Error('useViewerStore must be used within a <ViewerStoreProvider>');
    }
    return store;
}

const identity = (s: ViewerState) => s;

/**
 * Read the panel-scoped viewer store. Call with no selector to subscribe to the
 * whole state (parity with the old global `useViewerStore()`), or pass a
 * selector to subscribe to a slice (preferred for hot paths).
 */
export function useViewerStore(): ViewerState;
export function useViewerStore<T>(selector: (s: ViewerState) => T): T;
export function useViewerStore<T>(selector?: (s: ViewerState) => T): T | ViewerState {
    const store = useViewerStoreApi();
    return useStore(store, (selector ?? identity) as (s: ViewerState) => T);
}
