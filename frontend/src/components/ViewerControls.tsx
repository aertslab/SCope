import { useState, useEffect } from 'react'
import api from '../api/client'
import { Search, Layers, X } from 'lucide-react'
import { useToast } from '../context/ToastContext'

import { BIG_COLOR_LIST, hexToRgb } from '../utils/colors';

interface ViewerControlsProps {
  datasetId: string
  onColorChange: (
      colors: any, 
      name: string, 
      type: 'gene' | 'feature', 
      customColors?: Float32Array | null,
      legendData?: { label: string, color: string }[],
      rawValues?: any[],
      selectionDetails?: { type: 'gene' | 'feature', items: string[] },
      restoredLegendSelection?: string[]
  ) => void
  normalization: 'none' | 'log' | 'cpm' | 'log_cpm'
  initialSelection?: { type: 'gene' | 'feature', items: string[] }
  onRestoreComplete?: () => void
  initialLegendSelection?: string[]
  projectPassword?: string
}

interface Feature {
    name: string
    type: 'categorical' | 'continuous'
}

interface SelectedGene {
    name: string
    slot: number // 0, 1, 2
    data: number[]
}

export function ViewerControls({ datasetId, onColorChange, normalization, initialSelection, onRestoreComplete, initialLegendSelection, projectPassword }: ViewerControlsProps) {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<'genes' | 'features'>('genes')
  const [geneQuery, setGeneQuery] = useState('')
  const [geneResults, setGeneResults] = useState<string[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(false)
  
  const [selectedGenes, setSelectedGenes] = useState<SelectedGene[]>([])
  const [activeFeature, setActiveFeature] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [librarySize, setLibrarySize] = useState<number[] | null>(null)

  // Fetch library size if needed
  useEffect(() => {
      if ((normalization === 'cpm' || normalization === 'log_cpm') && !librarySize) {
          const fetchLibSize = async () => {
              try {
                  const config = projectPassword ? { headers: { 'x-project-password': projectPassword } } : {}
                  const res = await api.get(`/datasets/${datasetId}/feature/__library_size__`, config)
                  setLibrarySize(res.data)
              } catch (e) {
                  console.error("Failed to fetch library size", e)
                  addToast("Library size not found. CPM normalization might be inaccurate.", "info")
              }
          }
          fetchLibSize()
      }
  }, [normalization, librarySize, datasetId, projectPassword, addToast])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (geneQuery.length > 0) {
        try {
            const config = projectPassword ? { headers: { 'x-project-password': projectPassword } } : {}
            const res = await api.get(`/datasets/${datasetId}/genes?query=${geneQuery}`, config)
            setGeneResults(res.data)
        } catch (e) {
            console.error(e)
        }
      } else {
        setGeneResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [geneQuery, datasetId, projectPassword])

  // Load features on mount
  useEffect(() => {
    const config = projectPassword ? { headers: { 'x-project-password': projectPassword } } : {}
    api.get<Feature[]>(`/datasets/${datasetId}/features`, config).then(res => {
      setFeatures(res.data)
    }).catch(console.error)
  }, [datasetId, projectPassword])

  // Handle Initial Selection
  useEffect(() => {
      if (initialSelection && !initialized) {
          // If feature selection, wait for features to load
          if (initialSelection.type === 'feature' && features.length === 0) return

          const restore = async () => {
              setInitialized(true)
              if (initialSelection.type === 'gene') {
                  setActiveTab('genes')
                  setLoading(true)
                  try {
                      const newSelectedGenes: SelectedGene[] = []
                      const config = projectPassword ? { headers: { 'x-project-password': projectPassword }, responseType: 'arraybuffer' as const } : { responseType: 'arraybuffer' as const }
                      // Load all genes
                      for (let i = 0; i < initialSelection.items.length; i++) {
                          const gene = initialSelection.items[i]
                          if (!gene) continue
                          if (i >= 3) break // Max 3

                          const res = await api.get(`/datasets/${datasetId}/expression/${gene}`, config)
                          const floatArray = new Float32Array(res.data)
                          newSelectedGenes.push({
                              name: gene,
                              slot: i,
                              data: Array.from(floatArray)
                          })
                      }
                      setSelectedGenes(newSelectedGenes)
                      updateColors(newSelectedGenes, null, null, null, [], [], initialLegendSelection)
                  } catch (e) {
                      console.error("Failed to restore genes", e)
                  } finally {
                      setLoading(false)
                      if (onRestoreComplete) onRestoreComplete()
                  }
              } else if (initialSelection.type === 'feature') {
                  setActiveTab('features')
                  const featureName = initialSelection.items[0]
                  const feature = features.find(f => f.name === featureName)
                  if (feature) {
                      await handleFeatureClick(feature, initialLegendSelection)
                  }
                  if (onRestoreComplete) onRestoreComplete()
              } else {
                  if (onRestoreComplete) onRestoreComplete()
              }
          }
          restore()
      } else if (!initialSelection && !initialized) {
          // No initial selection, just mark as initialized
          setInitialized(true)
          if (onRestoreComplete) onRestoreComplete()
      }
  }, [initialSelection, features, initialized, onRestoreComplete, initialLegendSelection, projectPassword])

  // Re-apply normalization when it changes
  useEffect(() => {
      if (selectedGenes.length > 0 && !activeFeature) {
          updateColors(selectedGenes, null, null)
      }
  }, [normalization, librarySize])

  const updateColors = (
      genes: SelectedGene[], 
      featureName: string | null, 
      featureData: number[] | null, 
      customColors: Float32Array | null = null,
      legendData: { label: string, color: string }[] = [],
      rawValues: any[] = [],
      restoredLegendSelection?: string[]
  ) => {
      const colors: any = {}
      
      if (featureName && featureData) {
          // Feature mode
          colors[0] = featureData
          onColorChange(colors, featureName, 'feature', customColors, legendData, rawValues, { type: 'feature', items: [featureName] }, restoredLegendSelection)
      } else {
          // Gene mode
          const legendData: { label: string, color: string }[] = []
          const items = ["", "", ""] // Initialize with empty strings for 3 slots

          genes.forEach(g => {
              let data = g.data
              if (normalization === 'log') {
                  data = data.map(v => Math.log1p(v))
              } else if (normalization === 'log_cpm' || normalization === 'cpm') {
                  if (librarySize && librarySize.length === data.length) {
                      data = data.map((v, i) => {
                          const cpm = (v / (librarySize[i] || 1)) * 1e6
                          return normalization === 'log_cpm' ? Math.log1p(cpm) : cpm
                      })
                  } else {
                      // Fallback if no library size
                      if (normalization === 'log_cpm') data = data.map(v => Math.log1p(v))
                  }
              }
              colors[g.slot] = data
              
              // Add to legend
              const color = g.slot === 0 ? '#ff0000' : g.slot === 1 ? '#00ff00' : '#0000ff'
              legendData.push({ label: g.name, color })
              
              // Fill slot name
              if (g.slot >= 0 && g.slot < 3) {
                  items[g.slot] = g.name
              }
          })
          const names = genes.map(g => g.name).join(' / ')
          onColorChange(colors, names || 'None', 'gene', null, legendData, [], { type: 'gene', items }, restoredLegendSelection)
      }
  }

  const handleGeneClick = async (gene: string, targetSlot?: number) => {
    const existingGeneIndex = selectedGenes.findIndex(g => g.name === gene)

    // If clicking the name (no targetSlot)
    if (targetSlot === undefined) {
        if (existingGeneIndex !== -1) {
            removeGene(gene)
            return
        }
        if (selectedGenes.length >= 3) {
            addToast("Maximum 3 genes can be selected", "error")
            return
        }
    } else {
        // If clicking a color circle
        // If already in that slot, do nothing
        if (existingGeneIndex !== -1 && selectedGenes[existingGeneIndex].slot === targetSlot) {
            return
        }
    }

    setLoading(true)
    try {
      // Clear feature if active
      if (activeFeature) {
          setActiveFeature(null)
      }

      const config = projectPassword ? { headers: { 'x-project-password': projectPassword }, responseType: 'arraybuffer' as const } : { responseType: 'arraybuffer' as const }
      const res = await api.get(`/datasets/${datasetId}/expression/${gene}`, config)
      const floatArray = new Float32Array(res.data)
      
      let slot = targetSlot
      if (slot === undefined) {
          // Find first available slot
          const usedSlots = selectedGenes.map(g => g.slot)
          slot = 0
          while (usedSlots.includes(slot)) slot++
      }
      
      let newSelected = [...selectedGenes]
      
      // Remove if already exists (to handle moving slots)
      if (existingGeneIndex !== -1) {
          newSelected = newSelected.filter(g => g.name !== gene)
      }
      
      // If target slot is occupied, remove the gene in that slot
      if (targetSlot !== undefined) {
          newSelected = newSelected.filter(g => g.slot !== targetSlot)
      }
      
      const newGene = { name: gene, slot, data: Array.from(floatArray) }
      newSelected.push(newGene)
      
      setSelectedGenes(newSelected)
      updateColors(newSelected, null, null)
      
      // Clear search
      setGeneQuery('')
      setGeneResults([])
      
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const removeGene = (gene: string) => {
      const newSelected = selectedGenes.filter(g => g.name !== gene)
      setSelectedGenes(newSelected)
      updateColors(newSelected, null, null)
  }

  const handleFeatureClick = async (feature: Feature, restoredLegendSelection?: string[]) => {
    setLoading(true)
    try {
      // Clear genes
      setSelectedGenes([])
      setActiveFeature(feature.name)

      const config = projectPassword ? { headers: { 'x-project-password': projectPassword } } : {}
      const res = await api.get(`/datasets/${datasetId}/feature/${feature.name}`, config)
      const values = res.data
      
      let numericValues: number[] = []
      let customColors: Float32Array | null = null
      const legendData: { label: string, color: string }[] = []

      if (values.length > 0) {
          if (feature.type === 'categorical') {
              // Categorical: Map to indices
              // Filter out nulls for unique set
              const unique = Array.from(new Set(values.filter((v: any) => v !== null))) as string[]
              unique.sort()
              const map = new Map(unique.map((v, i) => [v, i]))
              
              numericValues = values.map((v: any) => {
                  if (v === null || v === undefined) return 0 
                  return map.get(v) ?? 0
              })

              // Generate custom colors
              customColors = new Float32Array(values.length * 3)
              const colorMap = new Map<string, number[]>()
              
              // Assign colors to unique values
              unique.forEach((val, i) => {
                  const hex = BIG_COLOR_LIST[i % BIG_COLOR_LIST.length]
                  colorMap.set(val, hexToRgb(hex))
                  legendData.push({ label: val, color: '#' + hex })
              })

              values.forEach((v: any, i: number) => {
                  let rgb = [0.8, 0.8, 0.8] // Default grey for null
                  if (v !== null && v !== undefined) {
                      rgb = colorMap.get(v) || [0, 0, 0]
                  }
                  customColors![i * 3] = rgb[0]
                  customColors![i * 3 + 1] = rgb[1]
                  customColors![i * 3 + 2] = rgb[2]
              })

          } else {
              // Continuous
              // Ensure numbers
              numericValues = values.map((v: any) => {
                  if (v === null || v === undefined) return 0
                  return Number(v)
              })
          }
      }
      
      updateColors([], feature.name, numericValues, customColors, legendData, values, restoredLegendSelection)

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const annotations = features.filter(f => f.type === 'categorical')
  const metrics = features.filter(f => f.type === 'continuous')

  return (
    <div className="absolute top-4 right-4 z-10 w-64 bg-black/80 text-white p-4 rounded backdrop-blur-sm max-h-[80vh] overflow-y-auto border border-gray-800">
      <div className="flex gap-2 mb-4">
        <button
          className={`flex-1 p-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${activeTab === 'genes' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          onClick={() => setActiveTab('genes')}
        >
          <Search size={14} /> Genes
        </button>
        <button
          className={`flex-1 p-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${activeTab === 'features' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          onClick={() => setActiveTab('features')}
        >
          <Layers size={14} /> Features
        </button>
      </div>

      {activeTab === 'genes' ? (
        <div className="space-y-2">
          {/* Selected Genes */}
          {selectedGenes.length > 0 && (
              <div className="mb-2 space-y-1">
                  <div className="text-xs text-gray-400 uppercase font-bold">Selected</div>
                  {selectedGenes.map(g => (
                      <div key={g.name} className="flex items-center justify-between bg-gray-800 p-1 rounded px-2">
                          <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${g.slot === 0 ? 'bg-red-500' : g.slot === 1 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                              <span className="text-xs">{g.name}</span>
                          </div>
                          <button onClick={() => removeGene(g.name)} className="text-gray-400 hover:text-white">
                              <X size={12} />
                          </button>
                      </div>
                  ))}
              </div>
          )}

          <input
            type="text"
            placeholder="Search genes..."
            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500"
            value={geneQuery}
            onChange={e => setGeneQuery(e.target.value)}
          />
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {geneResults.map(gene => {
                const isSelected = selectedGenes.some(g => g.name === gene)
                return (
                    <div
                        key={gene}
                        className={`w-full flex justify-between items-center p-2 rounded text-xs transition-colors ${isSelected ? 'bg-blue-900/30 text-blue-200' : 'hover:bg-gray-800'}`}
                    >
                        <button 
                            className="flex-1 text-left"
                            onClick={() => handleGeneClick(gene)}
                            disabled={loading}
                        >
                            {gene}
                        </button>
                        <div className="flex gap-1 ml-2">
                            <button 
                                className="w-3 h-3 rounded-full bg-red-500 hover:scale-125 transition-transform"
                                onClick={(e) => { e.stopPropagation(); handleGeneClick(gene, 0); }}
                                title="Assign to Red"
                            />
                            <button 
                                className="w-3 h-3 rounded-full bg-green-500 hover:scale-125 transition-transform"
                                onClick={(e) => { e.stopPropagation(); handleGeneClick(gene, 1); }}
                                title="Assign to Green"
                            />
                            <button 
                                className="w-3 h-3 rounded-full bg-blue-500 hover:scale-125 transition-transform"
                                onClick={(e) => { e.stopPropagation(); handleGeneClick(gene, 2); }}
                                title="Assign to Blue"
                            />
                        </div>
                    </div>
                )
            })}
            {geneQuery && geneResults.length === 0 && (
                <div className="text-gray-500 text-xs p-2">No genes found</div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {annotations.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 uppercase font-bold mb-1">Annotations</div>
              <div className="space-y-1">
                {annotations.map(feature => (
                  <button
                    key={feature.name}
                    className={`w-full text-left p-2 rounded text-xs transition-colors ${activeFeature === feature.name ? 'bg-blue-600 text-white' : 'hover:bg-gray-800'}`}
                    onClick={() => handleFeatureClick(feature)}
                    disabled={loading}
                  >
                    {feature.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {metrics.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 uppercase font-bold mb-1">Metrics</div>
              <div className="space-y-1">
                {metrics.map(feature => (
                  <button
                    key={feature.name}
                    className={`w-full text-left p-2 rounded text-xs transition-colors ${activeFeature === feature.name ? 'bg-blue-600 text-white' : 'hover:bg-gray-800'}`}
                    onClick={() => handleFeatureClick(feature)}
                    disabled={loading}
                  >
                    {feature.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {loading && <div className="text-xs text-blue-400 mt-2 text-center">Loading data...</div>}
    </div>
  )
}
