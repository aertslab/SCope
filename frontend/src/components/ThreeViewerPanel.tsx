import { Canvas } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, Html } from '@react-three/drei'
import { useEffect, useState, useRef, useMemo, forwardRef, useImperativeHandle } from 'react'
import api from '../api/client'
import { ViewerControls } from './ViewerControls'
import { Legend } from './Legend'
import { Edit2 } from 'lucide-react'
import { EditDatasetModal } from './EditDatasetModal'
import { createSession } from '../api/sessions'
import { useToast } from '../context/ToastContext'
import { LassoSelection } from './LassoSelection'
import { SelectionOverview } from './SelectionOverview'
import { Selection } from '../types'
import { compressIndices, decompressIndices } from '../utils/compression'
import { CameraController } from './CameraController'
import { ZOrderedViewer } from './ZOrderedViewer'
import { useViewerStore } from '../store/useViewerStore'
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

const ThreeViewerPanel = forwardRef<ThreeViewerPanelHandle, ThreeViewerPanelProps>(({ datasetId, instanceId = 'default', initialState: propInitialState, onStateChange }, ref) => {
  const { addToast } = useToast()
  
  const {
      dataset, setDataset,
      metadata, setMetadata,
      embeddingData, setEmbeddingData,
      loading, setLoading,
      error, setError,
      settings, setSettings,
      colours, setColours,
      customColors, setCustomColors,
      activeColorInfo, setActiveColorInfo,
      colorRanges, setColorRanges,
      selections, setSelections,
      lassoMode, setLassoMode,
      selectionDetails, setSelectionDetails,
      selectedLegendItems, setSelectedLegendItems
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
                      colorRanges: parsed.colorRanges
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
  
  // const [customColors, setCustomColors] = useState<Float32Array | null>(null)
  const [baseCustomColors, setBaseCustomColors] = useState<Float32Array | null>(null)
  const [defaultColors, setDefaultColors] = useState<Float32Array | null>(null)
  // const [activeColorInfo, setActiveColorInfo] = useState<{name: string, type: string} | null>(null)
  // const [selectionDetails, setSelectionDetails] = useState<{ type: 'gene' | 'feature', items: string[] } | undefined>(undefined)
  // const [colorRanges, setColorRanges] = useState<Record<string, [number, number]>>({})

  // New State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [legendData, setLegendData] = useState<{label: string, color: string}[]>([])
  
  const [rawValues, setRawValues] = useState<any[]>([])
  const [centroids, setCentroids] = useState<{label: string, x: number, y: number, color: string}[]>([])
  
  const [opacities, setOpacities] = useState<number | number[]>(1.0)
  const [sizes, setSizes] = useState<number | number[]>(2)
  
  // Restoration State
  const [isRestoring, setIsRestoring] = useState(!!initialState)

  // Password Protection
  const [isLocked, setIsLocked] = useState(false)
  const [projectPassword, setProjectPassword] = useState('')
  const [passwordInput, setPasswordInput] = useState('')

  const controlsRef = useRef<any>(null)

  const latestStateRef = useRef({
      settings,
      selectionDetails,
      selectedLegendItems,
      selections,
      colorRanges
  })

  const isFirstRun = useRef(true);

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

  useEffect(() => {
      latestStateRef.current = {
          settings,
          selectionDetails,
          selectedLegendItems,
          selections,
          colorRanges
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
              selection: selectionDetails,
              legendSelection: selectedLegendItems,
              selections: selections.map(s => ({
                  id: s.id,
                  name: s.name,
                  color: s.color,
                  visible: s.visible,
                  compressedIndices: compressIndices(s.indices)
              })),
              colorRanges
          })
      }
  }, [settings, selectionDetails, selectedLegendItems, selections, colorRanges, onStateChange])

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
              selection: latestStateRef.current.selectionDetails,
              legendSelection: latestStateRef.current.selectedLegendItems,
              selections: latestStateRef.current.selections.map(s => ({
                  id: s.id,
                  name: s.name,
                  color: s.color,
                  visible: s.visible,
                  compressedIndices: compressIndices(s.indices)
              }))
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
            embeddingName: '',
            showLabels: true,
            normalization: 'none',
            dimX: 0,
            dimY: 1,
            shape: 0,
            zOrdering: false
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
                 const isValid = metaRes.data.embeddings.some((e: any) => e.name === storedName);
                 
                 setSettings(s => {
                     // If current setting is valid, keep it
                     if (s.embeddingName && metaRes.data.embeddings.some((e: any) => e.name === s.embeddingName)) {
                         return s;
                     }
                     // If stored name is valid (and we haven't set one yet or current is invalid), use it
                     if (isValid) {
                         return { ...s, embeddingName: storedName };
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
                  selection: latestStateRef.current.selectionDetails,
                  legendSelection: latestStateRef.current.selectedLegendItems,
                  selections: latestStateRef.current.selections.map(s => ({
                      id: s.id,
                      name: s.name,
                      color: s.color,
                      visible: s.visible,
                      compressedIndices: compressIndices(s.indices)
                  })),
                  colorRanges: latestStateRef.current.colorRanges
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
      }
  }, [initialState, setColorRanges, setSelectedLegendItems, setSelectionDetails, setSelections, setSettings])

  // Fetch Embedding Data when name changes
  useEffect(() => {
      const fetchEmbedding = async () => {
        if (!datasetId || !settings.embeddingName) return

        // Ensure we have the correct dataset loaded to prevent race conditions
        if (!dataset || dataset.id !== datasetId) return

        // Verify embedding exists in metadata to prevent fetching invalid embeddings for new dataset
        if (!metadata?.embeddings?.some((e: any) => e.name === settings.embeddingName)) return

        try {
            setLoading(true)
            const config = projectPassword ? { headers: { 'x-project-password': projectPassword }, responseType: 'arraybuffer' as const } : { responseType: 'arraybuffer' as const }
            const embRes = await api.get(`/datasets/${datasetId}/embedding/${settings.embeddingName}`, config)
            
            const buffer = embRes.data
            const floatArray = new Float32Array(buffer)
            const pointCount = floatArray.length / 2
            
            const X = new Float32Array(pointCount)
            const Y = new Float32Array(pointCount)
            const Z = new Float32Array(pointCount) // Initialize with 0s
            
            for (let i = 0; i < pointCount; i++) {
                X[i] = floatArray[i * 2]
                Y[i] = floatArray[i * 2 + 1]
            }
            
            setEmbeddingData({ X, Y, Z })
            
            // Only reset colors if point count changes
            setPointCount(prev => {
                if (prev !== pointCount) {
                    // Initialize with light grey
                    const greyColors = new Float32Array(pointCount * 3)
                    for(let i=0; i<pointCount; i++) {
                        greyColors[i*3] = 0.8
                        greyColors[i*3+1] = 0.8
                        greyColors[i*3+2] = 0.8
                    }
                    setCustomColors(greyColors)
                    setBaseCustomColors(greyColors)
                    setDefaultColors(greyColors)
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
  }, [datasetId, settings.embeddingName, projectPassword, metadata, dataset, setColours, setCustomColors, setEmbeddingData, setError, setLoading])

  // Calculate Centroids with Collision Resolution
  useEffect(() => {
      if (!embeddingData || !rawValues.length || !legendData.length) {
          setCentroids([])
          return
      }

      const sums: Record<string, {x: number, y: number, count: number}> = {}
      
      rawValues.forEach((val, i) => {
          if (val === null || val === undefined) return
          if (!sums[val]) sums[val] = { x: 0, y: 0, count: 0 }
          sums[val].x += embeddingData.X[i]
          sums[val].y += embeddingData.Y[i]
          sums[val].count++
      })

      const newCentroids = Object.entries(sums).map(([label, data]) => {
          const legendItem = legendData.find(l => l.label === label)
          return {
            label,
            x: data.x / data.count,
            y: data.y / data.count,
            color: legendItem ? legendItem.color : '#ffffff'
          }
      })

      // Simple collision resolution
      const ITERATIONS = 20
      const RADIUS = 3 // Adjust based on scale
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

  // Handle Selection Effect
  useEffect(() => {
      if (!baseCustomColors) {
          setSizes(settings.pointSize)
          setOpacities(1.0)
          return
      }

      if (selectedLegendItems.length === 0) {
          setCustomColors(baseCustomColors)
          setOpacities(1.0)
          setSizes(settings.pointSize)
          return
      }

      const newColors = new Float32Array(baseCustomColors)
      const newOpacities = new Array(pointCount).fill(0.1) // Dim non-selected
      const newSizes = new Array(pointCount).fill(settings.pointSize)

      for (let i = 0; i < rawValues.length; i++) {
          if (selectedLegendItems.includes(rawValues[i])) {
              newOpacities[i] = 1.0
              newSizes[i] = settings.pointSize * 1.5
          } else {
              newColors[i*3] = 0.9
              newColors[i*3+1] = 0.9
              newColors[i*3+2] = 0.9
          }
      }
      setCustomColors(newColors)
      setOpacities(newOpacities)
      setSizes(newSizes)

  }, [selectedLegendItems, baseCustomColors, rawValues, settings.pointSize, pointCount, setCustomColors])

  // Update sizes when settings change (if not selecting)
  useEffect(() => {
      if (selectedLegendItems.length === 0) {
          setSizes(settings.pointSize)
      }
  }, [settings.pointSize, selectedLegendItems])

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
          embeddingName: metadata?.embeddings?.[0]?.name || '',
          showLabels: true,
          normalization: 'none',
          dimX: 0,
          dimY: 1,
          shape: 0,
          zOrdering: false
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
          selection: selectionDetails,
          legendSelection: selectedLegendItems,
          selections: selections.map(s => ({
              id: s.id,
              name: s.name,
              color: s.color,
              visible: s.visible,
              compressedIndices: compressIndices(s.indices)
          }))
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
      if (indices.length === 0) return
      
      const newSelection: Selection = {
          id: Math.random().toString(36).substr(2, 9),
          name: `Selection ${selections.length + 1}`,
          indices,
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
    <div className="h-full w-full bg-black relative flex-1 overflow-hidden">
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
            className={'left-4'}
          />
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

      <Canvas>
        <LassoSelection 
            active={lassoMode} 
            onSelectionComplete={handleLassoComplete}
            data={embeddingData}
        />
        <CameraController 
            key={datasetId}
            data={embeddingData} 
            controlsRef={controlsRef} 
            initialCamera={initialState?.camera}
        />
        <OrthographicCamera
          makeDefault
          position={initialPosition}
          zoom={initialZoom} 
          near={0.1}
          far={1000}
        />
        <ambientLight intensity={0.5} />
        
        {embeddingData && (
            <ZOrderedViewer
                embeddingData={embeddingData}
                displayColours={displayColours}
                customColors={customColors}
                sizes={sizes}
                opacities={opacities}
                settings={settings}
                selections={selections}
                selectedLegendItems={selectedLegendItems}
                rawValues={rawValues}
                activeColorInfo={activeColorInfo}
                colorRanges={colorRanges}
            />
        )}
        
        {/* Centroid Labels */}
        {settings.showLabels && centroids.map((c, i) => (
            <Html key={i} position={[c.x, c.y, 0]} center zIndexRange={[0, 10]}>
                        <div 
                            className={`px-1 py-0.5 rounded text-xs font-bold whitespace-nowrap pointer-events-none transition-opacity duration-200
                                ${selectedLegendItems.length > 0 && !selectedLegendItems.includes(c.label) ? 'opacity-0' : 'opacity-100'}
                            `}
                            style={{ 
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
        
        <OrbitControls ref={controlsRef} enableRotate={false} target={initialTarget} enabled={!lassoMode} />
      </Canvas>
    </div>
  )
})

export default ThreeViewerPanel