import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, Html, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { useEffect, useState, useRef, useMemo, forwardRef, useImperativeHandle } from 'react'
import api from '../api/client'
import { ViewerControls } from './ViewerControls'
import { Legend } from './Legend'
import { Edit2 } from 'lucide-react'
import { EditDatasetModal } from './EditDatasetModal'
import { createSession } from '../api/sessions'
import { useToast } from '../context/ToastContext'
import { LassoSelection } from './LassoSelection'
import { FilterBar } from './FilterBar'
import { useFilterMask } from '../hooks/useFilterMask'
import { SelectionOverview } from './SelectionOverview'
import { Selection } from '../types'
import { compressIndices, decompressIndices } from '../utils/compression'
import { CameraController } from './CameraController'
import { ZOrderedViewer } from './ZOrderedViewer'
import { useViewerStore, createViewerStore, ViewerStoreProvider } from '../store/useViewerStore'
import type { ViewerStore } from '../store/useViewerStore'
import { ViewerToolbar } from './ViewerToolbar'

interface ThreeViewerPanelProps {
    datasetId: string
    instanceId?: string // Unique ID for this panel instance
    initialState?: any
    onStateChange?: (state: any) => void
}

export interface ThreeViewerPanelHandle {
    getState: () => any
}

// Bridges the r3f camera/renderer out to a ref the parent owns, so the lasso
// overlay (rendered outside the <Canvas>, locked to the viewport) can do
// screen→world projection against the live camera. Must be a Canvas child to
// access useThree(); renders nothing.
function ThreeRefBridge({ target }: { target: { current: { camera: any; gl: any } | null } }) {
    const camera = useThree((s) => s.camera)
    const gl = useThree((s) => s.gl)
    useEffect(() => {
        target.current = { camera, gl }
    }, [camera, gl, target])
    return null
}

const ThreeViewerPanelInner = forwardRef<ThreeViewerPanelHandle, ThreeViewerPanelProps>(({ datasetId, instanceId = 'default', initialState: propInitialState, onStateChange }, ref) => {
  const { addToast } = useToast()
  
  const {
      dataset, setDataset,
      metadata, setMetadata,
      embeddingData, setEmbeddingData,
      loading, setLoading,
      error, setError,
      settings, setSettings,
      colours, setColours,
      setCustomColors,
      activeColorInfo, setActiveColorInfo,
      colorRanges, setColorRanges,
      selections, setSelections,
      lassoMode, setLassoMode,
      selectionDetails, setSelectionDetails,
      selectedLegendItems, setSelectedLegendItems,
      filterMask, filterTokens, setFilterTokens,
      filterEnabled, setFilterEnabled
  } = useViewerStore()

  // Merge prop state
  const initialState = useMemo(() => {
      if (propInitialState) return propInitialState
      
      if (datasetId) {
          try {
              // Use instance-specific storage key
              const saved = sessionStorage.getItem(`scope_settings_${datasetId}_${instanceId}`)
              if (saved) {
                  const parsed = JSON.parse(saved)
                  return {
                      settings: parsed.settings || parsed,
                      camera: parsed.camera,
                      selection: parsed.selection,
                      legendSelection: parsed.legendSelection,
                      selections: parsed.selections,
                      colorRanges: parsed.colorRanges,
                      filterTokens: parsed.filterTokens,
                      filterEnabled: parsed.filterEnabled
                  }
              }
          } catch (e) {
              console.error("Failed to restore from session storage", e)
          }
      }
      return null
  }, [propInitialState, datasetId, instanceId])

  // Initialize store from initialState
  useEffect(() => {
      if (initialState) {
          if (initialState.settings) setSettings(initialState.settings)
          if (initialState.selection) setSelectionDetails(initialState.selection)
          if (initialState.legendSelection) setSelectedLegendItems(initialState.legendSelection)
          if (initialState.selections) {
              setSelections(initialState.selections.map((s: any) => ({
                  ...s,
                  indices: s.compressedIndices ? decompressIndices(s.compressedIndices) : s.indices || []
              })))
          }
          if (initialState.colorRanges) setColorRanges(initialState.colorRanges)
      }
  }, [initialState, setSettings, setSelectionDetails, setSelectedLegendItems, setSelections, setColorRanges])

  const [pointCount, setPointCount] = useState(0)

  // UI State (Local to this viewer instance)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isColorScaleOpen, setIsColorScaleOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // The filter bar is hidden behind a toolbar toggle, but stays open whenever a
  // filter is actually applied so the active state is always visible.
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const filterOpen = filterPanelOpen || filterTokens.length > 0

  // 3D is only "active" when the user enabled it AND the current embedding
  // actually has >= 3 dimensions — otherwise a stale is3D flag (carried over
  // from a higher-dimensional embedding) must not let the user rotate a flat
  // plane. Drives both camera rotation and the embedding fetch's dim count.
  const currentEmbMeta = metadata?.embeddings?.find((e: any) => e.name === settings.embeddingName)
  const currentNDims = typeof currentEmbMeta?.n_dims === 'number' ? currentEmbMeta.n_dims : 2
  const is3DActive = !!settings.is3D && currentNDims >= 3

  // const [customColors, setCustomColors] = useState<Float32Array | null>(null)
  const [baseCustomColors, setBaseCustomColors] = useState<Float32Array | null>(null)
  const [defaultColors, setDefaultColors] = useState<Float32Array | null>(null)
  // const [activeColorInfo, setActiveColorInfo] = useState<{name: string, type: string} | null>(null)
  // const [selectionDetails, setSelectionDetails] = useState<{ type: 'gene' | 'feature', items: string[] } | undefined>(undefined)
  // const [colorRanges, setColorRanges] = useState<Record<string, [number, number]>>({})

  // New State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [legendData, setLegendData] = useState<{label: string, color: string}[]>([])
  // Transient hover-to-preview: which legend category the cursor is over. Not a
  // committed selection and not persisted — purely a visual spotlight.
  const [hoveredLegendItem, setHoveredLegendItem] = useState<string | null>(null)

  const [rawValues, setRawValues] = useState<any[]>([])
  const [centroids, setCentroids] = useState<{label: string, x: number, y: number, z: number, color: string}[]>([])

  // Restoration State
  const [isRestoring, setIsRestoring] = useState(!!initialState)

  // Password Protection
  const [isLocked, setIsLocked] = useState(false)
  const [projectPassword, setProjectPassword] = useState('')
  const [passwordInput, setPasswordInput] = useState('')

  // Evaluate the active filter (store `filterTokens`) into a per-cell visibility
  // mask + match count, written back to the store. No-op when no filter is set.
  useFilterMask(datasetId, pointCount, projectPassword)

  const controlsRef = useRef<any>(null)
  // The panel's root element — target for the Fullscreen API so the canvas and
  // all its overlays (toolbar, legend, filter bar, info) go fullscreen together.
  const panelRootRef = useRef<HTMLDivElement>(null)
  // Live camera/renderer captured from inside the <Canvas> so the lasso overlay
  // (which lives outside the Canvas, locked to the viewport) can project the
  // drawn screen polygon back into world space.
  const lassoThreeRef = useRef<{ camera: any; gl: any } | null>(null)

  const latestStateRef = useRef({
      settings,
      selectionDetails,
      activeColorInfo,
      selectedLegendItems,
      selections,
      colorRanges,
      filterTokens,
      filterEnabled
  })

  const isFirstRun = useRef(true);

  // The colour selection to persist in a shared/saved session. `selectionDetails`
  // is the source of truth, but it has been observed to occasionally be cleared
  // for categorical features while the cells stay coloured (so `activeColorInfo`
  // — set in the very same handleColorChange — survives). Fall back to it so an
  // annotation/feature view is never saved without its selection.
  const buildSavedSelection = (
      sel: { type: 'gene' | 'feature'; items: string[] } | undefined,
      aci: { name: string; type: string } | null,
  ): { type: 'gene' | 'feature'; items: string[] } | undefined => {
      if (sel) return sel
      if (!aci || !aci.name || aci.name === 'None') return undefined
      if (aci.type === 'feature') return { type: 'feature', items: [aci.name] }
      if (aci.type === 'gene') return { type: 'gene', items: aci.name.split(' / ') }
      return undefined
  }

  // Handle Escape key to close menus
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              setIsSettingsOpen(false)
              setIsColorScaleOpen(false)
              setIsShareOpen(false)
              setLassoMode(false)
          }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setLassoMode])

  // Keep the fullscreen toggle in sync with the actual document state so the
  // button icon is correct even when the user exits fullscreen via Escape or
  // the OS, and when another panel takes over fullscreen.
  useEffect(() => {
      const onChange = () => setIsFullscreen(document.fullscreenElement === panelRootRef.current)
      document.addEventListener('fullscreenchange', onChange)
      return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
      // Branch on whether THIS panel owns fullscreen, not on global state — with
      // multiple mosaic panels, requesting fullscreen on a new element while
      // another is fullscreen transitions directly between them, so clicking a
      // second panel's button moves fullscreen there instead of just exiting.
      // (requestFullscreen/exitFullscreen return promises, so .catch() — not a
      // synchronous try/catch — is what captures a rejection.)
      if (document.fullscreenElement === panelRootRef.current) {
          document.exitFullscreen().catch((err) => console.error('Exit fullscreen failed', err))
      } else if (panelRootRef.current) {
          panelRootRef.current.requestFullscreen().catch((err) => console.error('Fullscreen request failed', err))
      }
  }

  useEffect(() => {
      latestStateRef.current = {
          settings,
          selectionDetails,
          activeColorInfo,
          selectedLegendItems,
          selections,
          colorRanges,
          filterTokens,
          filterEnabled
      }

      if (isFirstRun.current) {
          isFirstRun.current = false;
          return;
      }

      // Notify parent of state change for persistence
      if (onStateChange) {
          const cameraState = controlsRef.current ? {
              position: controlsRef.current.object.position,
              target: controlsRef.current.target,
              zoom: controlsRef.current.object.zoom
          } : null

          onStateChange({
              settings,
              camera: cameraState,
              selection: buildSavedSelection(selectionDetails, activeColorInfo),
              legendSelection: selectedLegendItems,
              selections: selections.map(s => ({
                  id: s.id,
                  name: s.name,
                  color: s.color,
                  visible: s.visible,
                  compressedIndices: compressIndices(s.indices)
              })),
              colorRanges,
              filterTokens,
              filterEnabled
          })
      }
  }, [settings, selectionDetails, activeColorInfo, selectedLegendItems, selections, colorRanges, filterTokens, filterEnabled, onStateChange])

  // Expose getState to parent
  useImperativeHandle(ref, () => ({
      getState: () => {
          const cameraState = controlsRef.current ? {
              position: controlsRef.current.object.position,
              target: controlsRef.current.target,
              zoom: controlsRef.current.object.zoom
          } : null

          return {
              datasetId,
              settings: latestStateRef.current.settings,
              camera: cameraState,
              selection: buildSavedSelection(latestStateRef.current.selectionDetails, latestStateRef.current.activeColorInfo),
              legendSelection: latestStateRef.current.selectedLegendItems,
              // BUG 4 FIX: colorRanges was tracked in latestStateRef and saved
              // to sessionStorage but omitted from the share/getState payload,
              // so custom color scales were lost when restoring a shared session.
              colorRanges: latestStateRef.current.colorRanges,
              selections: latestStateRef.current.selections.map(s => ({
                  id: s.id,
                  name: s.name,
                  color: s.color,
                  visible: s.visible,
                  compressedIndices: compressIndices(s.indices)
              })),
              filterTokens: latestStateRef.current.filterTokens,
              filterEnabled: latestStateRef.current.filterEnabled
          }
      }
  }));

  // Compute initial camera settings once
  const { initialZoom, initialPosition, initialTarget } = useMemo(() => {
      if (initialState?.camera) {
          return {
              initialZoom: initialState.camera.zoom,
              initialPosition: [initialState.camera.position.x, initialState.camera.position.y, initialState.camera.position.z] as [number, number, number],
              initialTarget: [initialState.camera.target.x, initialState.camera.target.y, initialState.camera.target.z] as [number, number, number]
          }
      }
      return {
          initialZoom: 20,
          initialPosition: [0, 0, 100] as [number, number, number],
          initialTarget: [0, 0, 0] as [number, number, number]
      }
  }, [initialState])

  // Initial Load
  useEffect(() => {
    const init = async () => {
      if (!datasetId) return
      
      // Reset state for new dataset
      setLoading(true)
      setError(null)
      setEmbeddingData(null)
      setMetadata(null)
      setDataset(null)
      setIsLocked(false)
      setIsRestoring(!!initialState)

      // Only reset embedding name if NOT restoring from session
      if (!initialState) {
          setSettings({
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
          })
          setSelections([])
          setSelectionDetails(undefined)
          setSelectedLegendItems([])
      }
      
      try {
        const config = projectPassword ? { headers: { 'x-project-password': projectPassword } } : {}
        
        // Fetch Dataset Details
        const dsRes = await api.get(`/datasets/${datasetId}`, config)
        setDataset(dsRes.data)

        // Fetch Metadata
        const metaRes = await api.get(`/datasets/${datasetId}/metadata`, config)
        setMetadata(metaRes.data)
        
        if (metaRes.data.embeddings && metaRes.data.embeddings.length > 0) {
            // If restoring, use stored embedding name IF it exists in the new dataset
            // otherwise default to first available
            const firstEmbedding = metaRes.data.embeddings[0].name;
            
            if (initialState && initialState.settings && initialState.settings.embeddingName) {
                 const storedName = initialState.settings.embeddingName;
                 // Resolve the stored embedding name against the dataset's current
                 // embeddings. Prefer an exact match, but fall back to a sanitized
                 // ("/" -> "_") and then case-insensitive match so a share made
                 // before an embedding was renamed (e.g. "Scanpy PC1/PC2" ->
                 // "Scanpy PC1_PC2") still restores instead of silently reverting
                 // to the first embedding.
                 const sanitize = (n: string) => n.replace(/\//g, '_');
                 const resolveName = (name: string): string | null => {
                     if (!name) return null;
                     const embs = metaRes.data.embeddings as any[];
                     const exact = embs.find((e) => e.name === name);
                     if (exact) return exact.name;
                     const bySan = embs.find((e) => sanitize(e.name) === sanitize(name));
                     if (bySan) return bySan.name;
                     const lower = name.toLowerCase();
                     const byLower = embs.find((e) => e.name.toLowerCase() === lower);
                     return byLower ? byLower.name : null;
                 };
                 const resolvedStored = resolveName(storedName);

                 setSettings(s => {
                     // If current setting is already valid, keep it
                     if (s.embeddingName && metaRes.data.embeddings.some((e: any) => e.name === s.embeddingName)) {
                         return s;
                     }
                     // Otherwise restore the (resolved) stored embedding if we found a match
                     if (resolvedStored) {
                         return { ...s, embeddingName: resolvedStored };
                     }
                     // Fallback
                     return { ...s, embeddingName: firstEmbedding };
                 })
            } else {
                setSettings(s => ({ ...s, embeddingName: firstEmbedding }))
            }
        } else {
            setError("No embeddings found in dataset")
            setLoading(false)
        }
      } catch (err: any) {
        console.error(err)
        if (err.response && err.response.status === 403) {
             const detail = err.response.data?.detail
             if (detail === "Password required" || detail === "Invalid password") {
                 setIsLocked(true)
             } else {
                 setError("Access Denied: You do not have permission to view this dataset.")
             }
             setLoading(false)
        } else {
            setError("Failed to load dataset.")
            setLoading(false)
        }
      } finally {
          setIsRestoring(false)
      }
    }
    init()
  }, [datasetId, projectPassword, initialState, setDataset, setEmbeddingData, setError, setLoading, setMetadata, setSelectedLegendItems, setSelectionDetails, setSelections, setSettings]) // Re-run when password changes

  // Save settings to session storage
  const settingsDatasetIdRef = useRef(datasetId)
  useEffect(() => {
      const saveState = () => {
          if (settingsDatasetIdRef.current && latestStateRef.current.settings.embeddingName) {
              const cameraState = controlsRef.current ? {
                  position: controlsRef.current.object.position,
                  target: controlsRef.current.target,
                  zoom: controlsRef.current.object.zoom
              } : null

              const sessionData = {
                  datasetId: settingsDatasetIdRef.current,
                  settings: latestStateRef.current.settings,
                  camera: cameraState,
                  selection: buildSavedSelection(latestStateRef.current.selectionDetails, latestStateRef.current.activeColorInfo),
                  legendSelection: latestStateRef.current.selectedLegendItems,
                  selections: latestStateRef.current.selections.map(s => ({
                      id: s.id,
                      name: s.name,
                      color: s.color,
                      visible: s.visible,
                      compressedIndices: compressIndices(s.indices)
                  })),
                  colorRanges: latestStateRef.current.colorRanges,
                  filterTokens: latestStateRef.current.filterTokens,
                  filterEnabled: latestStateRef.current.filterEnabled
              }
              sessionStorage.setItem(`scope_settings_${settingsDatasetIdRef.current}_${instanceId}`, JSON.stringify(sessionData))
          }
      }

      if (settingsDatasetIdRef.current !== datasetId) {
          saveState()
          settingsDatasetIdRef.current = datasetId
      }

      return () => {
          saveState()
      }
  }, [datasetId, instanceId])

  // Apply Initial State
  useEffect(() => {
      if (initialState) {
          if (initialState.settings) {
              setSettings(initialState.settings)
          }
          if (initialState.legendSelection) {
              setSelectedLegendItems(initialState.legendSelection)
          }
          if (initialState.selections) {
              setSelections(initialState.selections.map((s: any) => ({
                  ...s,
                  indices: s.compressedIndices ? decompressIndices(s.compressedIndices) : s.indices || []
              })))
          }
          if (initialState.selection) {
              setSelectionDetails(initialState.selection)
          }
          if (initialState.colorRanges) {
              setColorRanges(initialState.colorRanges)
          }
          if (initialState.filterTokens) {
              setFilterTokens(initialState.filterTokens)
          }
          if (typeof initialState.filterEnabled === 'boolean') {
              setFilterEnabled(initialState.filterEnabled)
          }
      }
  }, [initialState, setColorRanges, setSelectedLegendItems, setSelectionDetails, setSelections, setSettings, setFilterTokens, setFilterEnabled])

  // Fetch Embedding Data when name changes
  useEffect(() => {
      const fetchEmbedding = async () => {
        if (!datasetId || !settings.embeddingName) return

        // Ensure we have the correct dataset loaded to prevent race conditions
        if (!dataset || dataset.id !== datasetId) return

        // Verify embedding exists in metadata to prevent fetching invalid embeddings for new dataset
        const embMeta = metadata?.embeddings?.find((e: any) => e.name === settings.embeddingName)
        if (!embMeta) return

        try {
            setLoading(true)

            // Work out which stored dimensions to plot. A 3D plot needs an
            // embedding with >= 3 dims; otherwise fall back to 2D. Dimension
            // indices are clamped to what the embedding actually has (they may be
            // stale after switching to a lower-dimensional embedding).
            const nDims = typeof embMeta.n_dims === 'number' ? embMeta.n_dims : 2
            const clamp = (d: number) => Math.min(Math.max(d | 0, 0), Math.max(nDims - 1, 0))
            const use3D = !!settings.is3D && nDims >= 3
            const dims = use3D
                ? [clamp(settings.dimX), clamp(settings.dimY), clamp(settings.dimZ)]
                : [clamp(settings.dimX), clamp(settings.dimY)]

            const config = projectPassword ? { headers: { 'x-project-password': projectPassword }, responseType: 'arraybuffer' as const } : { responseType: 'arraybuffer' as const }
            const embRes = await api.get(`/datasets/${datasetId}/embedding/${encodeURIComponent(settings.embeddingName)}?dims=${dims.join(',')}`, config)

            const buffer = embRes.data
            const floatArray = new Float32Array(buffer)
            const stride = dims.length
            const pointCount = Math.floor(floatArray.length / stride)

            const X = new Float32Array(pointCount)
            const Y = new Float32Array(pointCount)
            const Z = new Float32Array(pointCount) // stays 0 in 2D

            for (let i = 0; i < pointCount; i++) {
                X[i] = floatArray[i * stride]
                Y[i] = floatArray[i * stride + 1]
                if (stride > 2) Z[i] = floatArray[i * stride + 2]
            }

            setEmbeddingData({ X, Y, Z })
            
            // Only reset colors if point count changes (i.e. a new embedding).
            // BUG 1 FIX: do NOT seed a grey `customColors` array here. Previously
            // this grey buffer lingered in the store and, because ThreeViewer
            // prioritises `customColors` over the per-gene `colours` channels,
            // it shadowed the FIRST gene selection (the viewer stayed grey until
            // a second selection). Leaving these null lets ThreeViewer fall back
            // to its own neutral-grey default when nothing is selected, and the
            // very first gene selection paints immediately.
            setPointCount(prev => {
                if (prev !== pointCount) {
                    setCustomColors(null)
                    setBaseCustomColors(null)
                    setDefaultColors(null)
                    setColours({})
                }
                return pointCount
            })

        } catch (err) {
            console.error(err)
            setError("Failed to load embedding data.")
        } finally {
            setLoading(false)
        }
      }
      fetchEmbedding()
  }, [datasetId, settings.embeddingName, settings.dimX, settings.dimY, settings.dimZ, settings.is3D, projectPassword, metadata, dataset, setColours, setCustomColors, setEmbeddingData, setError, setLoading])

  // Calculate Centroids with Collision Resolution
  useEffect(() => {
      if (!embeddingData || !rawValues.length || !legendData.length) {
          setCentroids([])
          return
      }

      const sums: Record<string, {x: number, y: number, z: number, count: number}> = {}

      rawValues.forEach((val, i) => {
          if (val === null || val === undefined) return
          const x = embeddingData.X[i]
          const y = embeddingData.Y[i]
          // Skip cells whose coordinates are NaN/Inf in this embedding. Some
          // embeddings (e.g. a t-SNE run on only a subset of cells) leave the
          // rest as NaN; including them poisons the centroid average, producing
          // a NaN position that drei's <Html> can't project — the label then
          // sticks to a fixed screen spot instead of tracking the data.
          if (!Number.isFinite(x) || !Number.isFinite(y)) return
          // Average Z too so labels sit at the true 3D centroid in 3D mode. Z is
          // all-zero in 2D, so this is a no-op there (labels stay at z=0).
          const z = embeddingData.Z && Number.isFinite(embeddingData.Z[i]) ? embeddingData.Z[i] : 0
          if (!sums[val]) sums[val] = { x: 0, y: 0, z: 0, count: 0 }
          sums[val].x += x
          sums[val].y += y
          sums[val].z += z
          sums[val].count++
      })

      const newCentroids = Object.entries(sums)
          .filter(([, data]) => data.count > 0)
          .map(([label, data]) => {
              const legendItem = legendData.find(l => l.label === label)
              return {
                label,
                x: data.x / data.count,
                y: data.y / data.count,
                z: data.z / data.count,
                color: legendItem ? legendItem.color : '#ffffff'
              }
          })

      // Scale the collision radius to the embedding's extent so labels separate
      // consistently whether coordinates span ~20 (UMAP) or ~200 (t-SNE).
      let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity, cMaxY = -Infinity
      for (const c of newCentroids) {
          if (c.x < cMinX) cMinX = c.x
          if (c.x > cMaxX) cMaxX = c.x
          if (c.y < cMinY) cMinY = c.y
          if (c.y > cMaxY) cMaxY = c.y
      }
      const extent = Math.hypot(cMaxX - cMinX, cMaxY - cMinY)
      const ITERATIONS = 20
      const RADIUS = Number.isFinite(extent) && extent > 0 ? Math.max(extent * 0.04, 0.5) : 3
      for (let k = 0; k < ITERATIONS; k++) {
        for (let i = 0; i < newCentroids.length; i++) {
            for (let j = i + 1; j < newCentroids.length; j++) {
                const dx = newCentroids[i].x - newCentroids[j].x
                const dy = newCentroids[i].y - newCentroids[j].y
                const dist = Math.sqrt(dx*dx + dy*dy)
                if (dist < RADIUS && dist > 0) {
                    const overlap = RADIUS - dist
                    const nx = dx / dist
                    const ny = dy / dist
                    const factor = 0.1
                    newCentroids[i].x += nx * overlap * factor
                    newCentroids[i].y += ny * overlap * factor
                    newCentroids[j].x -= nx * overlap * factor
                    newCentroids[j].y -= ny * overlap * factor
                }
            }
        }
      }

      setCentroids(newCentroids)

  }, [embeddingData, rawValues, legendData])

  // Clear any lingering hover preview when the coloured feature changes — the
  // cursor may still be over the legend region as a new legend renders, leaving
  // a stale label that no longer maps to any cell.
  useEffect(() => {
      setHoveredLegendItem(null)
  }, [legendData])

  // The set of categories to spotlight in the plot. A committed legend
  // selection takes precedence; otherwise hovering a legend entry previews that
  // category (dimming the rest) without committing a selection. Both flow
  // through the same dimming pipeline below.
  const activeHighlight = useMemo(
      () => (selectedLegendItems.length > 0
          ? selectedLegendItems
          : hoveredLegendItem !== null ? [hoveredLegendItem] : []),
      [selectedLegendItems, hoveredLegendItem]
  )

  // Display buffers (colour / opacity / size) for the categorical view, derived
  // in ONE memo so the three always update together in a single frame. They used
  // to be split across the Zustand store (colour) and React state (opacity/size)
  // and written by an effect; because those two state systems don't batch into
  // the same render, a highlight change produced a transient frame where a
  // cell already had the dim-grey colour (0.9) but still the old full opacity
  // (1.0) — i.e. a bright ~white flash when switching/clearing a legend entry.
  // Deriving them together makes that intermediate state impossible.
  const { displayColors, displayOpacities, displaySizes } = useMemo<{
      displayColors: Float32Array | null
      displayOpacities: number | number[]
      displaySizes: number | number[]
  }>(() => {
      // 1) Base colour/opacity/size from the colour + legend-highlight logic.
      let colors: Float32Array | null
      let opacities: number | number[]
      let sizes: number | number[]

      if (!baseCustomColors) {
          // No categorical base ⇒ let ThreeViewer fall back to the gene `colours`
          // channels / neutral default; opacity & size stay uniform.
          colors = null
          opacities = 1.0
          sizes = settings.pointSize
      } else if (activeHighlight.length === 0) {
          // Nothing highlighted ⇒ base categorical colours at full opacity/size.
          colors = baseCustomColors
          opacities = 1.0
          sizes = settings.pointSize
      } else {
          // Spotlight matching cells; grey-out + dim the rest.
          const c = new Float32Array(baseCustomColors)
          const o = new Array(pointCount).fill(0.1) // Dim non-highlighted
          const s = new Array(pointCount).fill(settings.pointSize)
          for (let i = 0; i < rawValues.length; i++) {
              if (activeHighlight.includes(rawValues[i])) {
                  o[i] = 1.0
                  s[i] = settings.pointSize * 1.5
              } else {
                  c[i*3] = 0.9
                  c[i*3+1] = 0.9
                  c[i*3+2] = 0.9
              }
          }
          colors = c
          opacities = o
          sizes = s
      }

      // 2) Filter gate: a cell hidden by the active filter gets opacity 0,
      //    regardless of colour mode (the shader discards ~0-opacity points).
      if (filterMask) {
          const o = typeof opacities === 'number'
              ? new Array(pointCount).fill(opacities)
              : (opacities as number[]).slice()
          const n = Math.min(pointCount, filterMask.length)
          for (let i = 0; i < n; i++) if (!filterMask[i]) o[i] = 0
          opacities = o
      }

      return { displayColors: colors, displayOpacities: opacities, displaySizes: sizes }
  }, [activeHighlight, baseCustomColors, rawValues, settings.pointSize, pointCount, filterMask])

  const displayColours = useMemo(() => {
      if (activeColorInfo?.type === 'gene' && selectedLegendItems.length > 0) {
          const newColours = { ...colours }
          
          // Map colors to slots
          const slot0Label = legendData.find(l => l.color === '#ff0000')?.label
          const slot1Label = legendData.find(l => l.color === '#00ff00')?.label
          const slot2Label = legendData.find(l => l.color === '#0000ff')?.label
          
          if (slot0Label && !selectedLegendItems.includes(slot0Label)) newColours[0] = []
          if (slot1Label && !selectedLegendItems.includes(slot1Label)) newColours[1] = []
          if (slot2Label && !selectedLegendItems.includes(slot2Label)) newColours[2] = []
          
          return newColours
      }
      return colours
  }, [colours, activeColorInfo, selectedLegendItems, legendData])


  const handleColorChange = (
      newColors: any, 
      name: string, 
      type: 'gene' | 'feature', 
      newCustomColors?: Float32Array | null,
      newLegendData?: { label: string, color: string }[],
      newRawValues?: any[],
      newSelectionDetails?: { type: 'gene' | 'feature', items: string[] },
      restoredLegendSelection?: string[]
  ) => {
      setColours(newColors)
      
      // If we are clearing everything (no genes, no feature), restore default colors
      const isClearing = Object.keys(newColors).length === 0 && !newCustomColors
      
      if (isClearing && defaultColors) {
          setBaseCustomColors(defaultColors)
          setCustomColors(defaultColors)
      } else {
          setBaseCustomColors(newCustomColors || null)
          setCustomColors(newCustomColors || null)
      }

      setActiveColorInfo({ name, type })
      setLegendData(newLegendData || [])
      setRawValues(newRawValues || [])
      
      if (restoredLegendSelection) {
          setSelectedLegendItems(restoredLegendSelection)
      } else {
          setSelectedLegendItems([]) // Clear selection on color change
      }
      
      if (newSelectionDetails) setSelectionDetails(newSelectionDetails)
  }

  const handleLegendSelect = (label: string) => {
      setSelectedLegendItems(prev => {
          if (prev.includes(label)) {
              return prev.filter(l => l !== label)
          } else {
              return [...prev, label]
          }
      })
  }

  const handleReset = () => {
      if (!datasetId) return

      // Clear session storage
      sessionStorage.removeItem(`scope_settings_${datasetId}_${instanceId}`)

      // Reset Settings
      setSettings({
          pointSize: 2,
          labelSize: 12,
          embeddingName: metadata?.embeddings?.[0]?.name || '',
          showLabels: true,
          normalization: 'none',
          dimX: 0,
          dimY: 1,
          dimZ: 2,
          is3D: false,
          shape: 0,
          zOrdering: true
      })

      // Reset Selections
      setSelectedLegendItems([])
      setSelectionDetails(undefined)
      setSelections([])
      setLassoMode(false)
      
      setIsSettingsOpen(false)
  }

  const handleShare = async () => {
      if (!controlsRef.current) return
      
      // If already open, just close
      if (isShareOpen) {
          setIsShareOpen(false)
          setShareUrl(null)
          return
      }

      const cameraState = {
          position: controlsRef.current.object.position,
          target: controlsRef.current.target,
          zoom: controlsRef.current.object.zoom
      }
      
      const sessionData = {
          datasetId,
          settings,
          camera: cameraState,
          selection: buildSavedSelection(selectionDetails, activeColorInfo),
          legendSelection: selectedLegendItems,
          // colorRanges was previously omitted here (only getState/workspace
          // share carried it), so per-panel shares lost custom colour scales.
          colorRanges,
          selections: selections.map(s => ({
              id: s.id,
              name: s.name,
              color: s.color,
              visible: s.visible,
              compressedIndices: compressIndices(s.indices)
          })),
          filterTokens,
          filterEnabled
      }

      try {
          const session = await createSession(sessionData)
          const url = `${window.location.origin}/s/${session.id}`
          setShareUrl(url)
          setIsShareOpen(true)
          
          // Auto-copy
          await navigator.clipboard.writeText(url)
          addToast('Link copied to clipboard', 'success')
      } catch (e) {
          console.error(e)
          addToast('Failed to create session link', 'error')
      }
  }

  const copyToClipboard = async () => {
      if (shareUrl) {
          await navigator.clipboard.writeText(shareUrl)
          addToast('Link copied to clipboard', 'success')
      }
  }

  // Lasso Handlers
  const handleLassoComplete = (indices: number[]) => {
      // Restrict the lasso to currently-visible cells so selections (and any
      // gene plotting / stats over them) stay within the active filter.
      const picked = filterMask ? indices.filter(i => filterMask[i]) : indices
      if (picked.length === 0) return

      const newSelection: Selection = {
          id: Math.random().toString(36).substr(2, 9),
          name: `Selection ${selections.length + 1}`,
          indices: picked,
          color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'][selections.length % 6],
          visible: true
      }
      setSelections([...selections, newSelection])
      setLassoMode(false)
  }

  const handleUpdateSelection = (id: string, updates: Partial<Selection>) => {
      setSelections(selections.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const handleDeleteSelection = (id: string) => {
      setSelections(selections.filter(s => s.id !== id))
  }

  if (isLocked) {
      return (
          <div className="h-full w-full bg-black flex items-center justify-center text-white">
              <div className="bg-gray-900 p-8 rounded-lg shadow-xl max-w-md w-full border border-gray-800">
                  <h2 className="text-2xl font-bold mb-4 text-center">Protected Dataset</h2>
                  <p className="text-gray-400 mb-6 text-center">
                      This dataset belongs to a password-protected project. Please enter the password to view it.
                  </p>
                  <form onSubmit={(e) => {
                      e.preventDefault()
                      setProjectPassword(passwordInput)
                      setIsLocked(false) // Optimistic unlock, will re-lock if fetch fails again
                  }}>
                      <input
                          type="password"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Project Password"
                          className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 mb-4 text-white focus:outline-none focus:border-blue-500"
                          autoFocus
                      />
                      <button
                          type="submit"
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
                      >
                          Unlock
                      </button>
                  </form>
              </div>
          </div>
      )
  }

  if (!datasetId) {
      return (
          <div className="h-full w-full bg-gray-900 flex items-center justify-center text-gray-400">
              <div className="text-center">
                  <p className="text-lg mb-2">No Dataset Selected</p>
                  <p className="text-sm">Drag a dataset here from the sidebar</p>
              </div>
          </div>
      )
  }

  if (loading && !embeddingData) {
      return (
          <div className="h-full w-full bg-black flex items-center justify-center text-white">
              <div className="text-xl">Loading dataset...</div>
          </div>
      )
  }

  if (error) {
      return (
          <div className="h-full w-full bg-black flex items-center justify-center text-white">
              <div className="text-xl text-red-500">{error}</div>
          </div>
      )
  }

  return (
    <div ref={panelRootRef} className="h-full w-full bg-black relative flex-1 overflow-hidden">
      {/* Info Overlay */}
      <div className={`absolute top-4 z-20 text-white bg-black/50 backdrop-blur-md p-2 rounded pointer-events-none max-w-xs transition-all duration-300 left-4`}>
        <div className="flex items-center gap-2 pointer-events-auto">
            <h1 className="text-xl font-bold truncate">{dataset ? dataset.name : datasetId}</h1>
            <button 
                onClick={() => setIsEditModalOpen(true)}
                className="text-gray-400 hover:text-white transition-colors"
            >
                <Edit2 size={16} />
            </button>
        </div>
        {dataset && dataset.description && (
            <p className="text-xs text-gray-300 mt-1 line-clamp-3">{dataset.description}</p>
        )}
        <p className="text-sm mt-1">Showing {pointCount.toLocaleString()} cells</p>
        {settings.embeddingName && (
            <p className="text-xs mt-1">Embedding: {settings.embeddingName}</p>
        )}
        {activeColorInfo && (
            <div className="mt-2 border-t border-gray-600 pt-2">
                <p className="text-xs text-gray-400 uppercase">{activeColorInfo.type}</p>
                <p className="text-lg font-bold text-blue-400 break-words">{activeColorInfo.name}</p>
            </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditDatasetModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        dataset={dataset}
        onUpdate={setDataset}
      />

      {/* Toolbar */}
      <ViewerToolbar 
          isShareOpen={isShareOpen}
          onShareToggle={handleShare}
          shareUrl={shareUrl}
          onCopyShareUrl={copyToClipboard}
          isSettingsOpen={isSettingsOpen}
          onSettingsToggle={() => {
              setIsSettingsOpen(!isSettingsOpen)
              setIsColorScaleOpen(false)
          }}
          isColorScaleOpen={isColorScaleOpen}
          onColorScaleToggle={() => {
              setIsColorScaleOpen(!isColorScaleOpen)
              setIsSettingsOpen(false)
          }}
          isFilterOpen={filterOpen}
          onFilterToggle={() => setFilterPanelOpen((o) => !o)}
          isFullscreen={isFullscreen}
          onFullscreenToggle={toggleFullscreen}
          onReset={handleReset}
      />

      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2 items-end pointer-events-none">
          <div className="pointer-events-auto">
            <SelectionOverview 
                selections={selections}
                onUpdateSelection={handleUpdateSelection}
                onDeleteSelection={handleDeleteSelection}
                activeColorInfo={activeColorInfo}
                rawValues={rawValues}
                colours={colours}
                selectionDetails={selectionDetails}
            />
          </div>
      </div>

      {/* Legend */}
      {legendData.length > 0 && (
          <Legend
            items={legendData}
            selectedItems={selectedLegendItems}
            onSelect={handleLegendSelect}
            onClear={() => setSelectedLegendItems([])}
            onHover={setHoveredLegendItem}
            className={'left-4'}
          />
      )}

      {datasetId && !isRestoring && filterOpen && (
          <FilterBar datasetId={datasetId} projectPassword={projectPassword} />
      )}

      {datasetId && !isRestoring && (
          <ViewerControls
            key={datasetId}
            datasetId={datasetId}
            onColorChange={handleColorChange}
            normalization={settings.normalization}
            initialSelection={initialState?.selection}
            onRestoreComplete={() => setIsRestoring(false)}
            initialLegendSelection={initialState?.legendSelection}
            projectPassword={projectPassword}
          />
      )}
      
      {/* Restoration Overlay */}
      {isRestoring && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center text-white backdrop-blur-sm">
              <div className="text-xl font-bold animate-pulse">Restoring session settings...</div>
          </div>
      )}

      {/* Lasso overlay — a sibling of the <Canvas>, NOT a child. As a plain DOM
          element in this position:relative container it stays locked to the
          viewport instead of drifting/scaling with the plot when panned/zoomed.
          It reads the live camera/renderer via lassoThreeRef for screen→world. */}
      <LassoSelection
          active={lassoMode}
          onSelectionComplete={handleLassoComplete}
          data={embeddingData}
          getThree={() => lassoThreeRef.current}
      />

      <Canvas>
        <ThreeRefBridge target={lassoThreeRef} />
        <CameraController
            key={datasetId}
            data={embeddingData}
            controlsRef={controlsRef}
            initialCamera={initialState?.camera}
            tilt={is3DActive}
            fitKey={`${settings.embeddingName}|${settings.dimX},${settings.dimY},${settings.dimZ}|${is3DActive ? '3d' : '2d'}`}
        />
        {/* Generous symmetric depth slab so that when the camera orbits the data
            in 3D mode, points never clip at the near/far planes regardless of the
            embedding's coordinate scale. */}
        <OrthographicCamera
          makeDefault
          position={initialPosition}
          zoom={initialZoom}
          near={-2000}
          far={2000}
        />
        <ambientLight intensity={0.5} />
        
        {embeddingData && (
            <ZOrderedViewer
                embeddingData={embeddingData}
                displayColours={displayColours}
                customColors={displayColors}
                sizes={displaySizes}
                opacities={displayOpacities}
                settings={settings}
                selections={selections}
                selectedLegendItems={activeHighlight}
                rawValues={rawValues}
                activeColorInfo={activeColorInfo}
                colorRanges={colorRanges}
                visibilityMask={filterMask}
            />
        )}
        
        {/* Centroid Labels */}
        {settings.showLabels && centroids.map((c, i) => (
            <Html key={i} position={[c.x, c.y, c.z ?? 0]} center zIndexRange={[0, 10]}>
                        <div
                            className={`px-1 py-0.5 rounded font-bold whitespace-nowrap pointer-events-none transition-opacity duration-200
                                ${activeHighlight.length > 0 && !activeHighlight.includes(c.label) ? 'opacity-0' : 'opacity-100'}
                            `}
                            style={{
                                fontSize: `${settings.labelSize ?? 12}px`,
                                lineHeight: 1.1,
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                color: 'white',
                                textShadow: '0 1px 2px black',
                                border: `1px solid ${c.color}`
                            }}
                        >
                            {c.label}
                        </div>
                    </Html>
                ))}
        
        {/* Rotation is enabled only in 3D mode; 2D keeps the pan/zoom-only feel.
            (The orthographic camera orbits the data so depth from the 3rd
            dimension becomes visible as you rotate.) makeDefault registers the
            controls so the orientation gizmo can drive them. */}
        <OrbitControls makeDefault ref={controlsRef} enableRotate={is3DActive} target={initialTarget} enabled={!lassoMode} />

        {/* Orientation gizmo — only in 3D. Click an axis to snap the view; it
            also reflects the current rotation. It lives INSIDE the WebGL canvas
            (so it can drive the camera), which means it renders beneath any DOM
            overlay on top of it — and z-index can't lift WebGL above a sibling
            <div>. The top is crowded (toolbar, info, the wide search panel, the
            settings panel), so we anchor it bottom-center: the one region that
            stays clear in every state (legend is bottom-left, selections
            bottom-right). */}
        {is3DActive && (
            <GizmoHelper alignment="bottom-center" margin={[80, 90]}>
                <GizmoViewport axisColors={['#ff3653', '#8adb00', '#2c8fff']} labelColor="white" />
            </GizmoHelper>
        )}
      </Canvas>
    </div>
  )
})

// Outer wrapper: each panel owns an isolated viewer store keyed by its
// instanceId and provides it to the body + toolbar. This is what makes
// multiple panels independent (Bug 3) and lets multi-panel workspaces restore
// without overwriting each other's state (Bug 4). The body reads the store via
// the context-scoped useViewerStore hook.
const ThreeViewerPanel = forwardRef<ThreeViewerPanelHandle, ThreeViewerPanelProps>((props, ref) => {
  const storeRef = useRef<ViewerStore | null>(null)
  if (!storeRef.current) {
    storeRef.current = createViewerStore(props.instanceId ?? 'default')
  }
  return (
    <ViewerStoreProvider store={storeRef.current}>
      <ThreeViewerPanelInner {...props} ref={ref} />
    </ViewerStoreProvider>
  )
})

export default ThreeViewerPanel