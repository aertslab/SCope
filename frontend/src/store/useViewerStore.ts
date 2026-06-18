// The viewer store is now per-panel (see createViewerStore + ViewerStoreContext).
// This module re-exports the context-scoped hook so existing imports
// (`import { useViewerStore } from '../store/useViewerStore'`) keep working —
// they now resolve to the panel-scoped store provided by the nearest
// <ViewerStoreProvider> instead of a single global singleton.
export { useViewerStore, useViewerStoreApi, ViewerStoreProvider } from './ViewerStoreContext';
export { createViewerStore } from './createViewerStore';
export type { ViewerState, ViewerStore } from './createViewerStore';
