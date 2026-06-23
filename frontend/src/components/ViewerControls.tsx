import { useState, useEffect } from 'react'
import api from '../api/client'
import { fetchGeneExpression } from '../api/expression'
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

type ColumnKind = 'gene' | 'metric'

// A column assigned to one of the R/G/B channels. It can be a gene OR a
// continuous metric — both are just a per-cell number[] and blend additively.
// (Categorical annotations are handled separately via the colormap path.)
interface SelectedGene {
    name: string
    slot: number // 0 = Red, 1 = Green, 2 = Blue
    kind: ColumnKind
    data: number[]
}

// A generalised search result. The search box spans every plottable element,
// not just genes, ordered by relevance (exact matches first). A `category`
// result is a value *within* a feature (e.g. "male" within "Sex"); `feature`
// is the parent feature to colour by when it's selected.
type SearchType = 'gene' | 'metric' | 'annotation' | 'clustering' | 'regulon' | 'category'
interface SearchResult {
    name: string
    type: SearchType
    feature?: string
}

// `channel: true` types are numeric and blend into an R/G/B channel; the others
// are categorical and colour by category (feature mode).
const TYPE_META: Record<SearchType, { label: string; badge: string; channel: boolean }> = {
    gene:       { label: 'Gene',       badge: 'bg-blue-900 text-blue-200',     channel: true },
    metric:     { label: 'Metric',     badge: 'bg-teal-900 text-teal-200',     channel: true },
    regulon:    { label: 'Regulon',    badge: 'bg-purple-900 text-purple-200', channel: true },
    annotation: { label: 'Annotation', badge: 'bg-amber-900 text-amber-200',   channel: false },
    clustering: { label: 'Clustering', badge: 'bg-pink-900 text-pink-200',     channel: false },
    category:   { label: 'Category',   badge: 'bg-rose-900 text-rose-200',     channel: false },
}

// Regulons are fetched as a metric via the "Regulon: "-prefixed feature route.
const resolveColumnName = (r: SearchResult) => (r.type === 'regulon' ? `Regulon: ${r.name}` : r.name)

// Strip the display-only "Clustering: " prefix for showing a feature name.
const bareFeatureName = (name: string) => name.replace(/^Clustering: /, '')

export function ViewerControls({ datasetId, onColorChange, normalization, initialSelection, onRestoreComplete, initialLegendSelection, projectPassword }: ViewerControlsProps) {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<'genes' | 'features'>('genes')
  const [geneQuery, setGeneQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
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
                  const headers = projectPassword ? { 'x-project-password': projectPassword } : undefined
                  const res = await api.get(`/datasets/${datasetId}/feature/__library_size__`, {
                      headers,
                      responseType: 'arraybuffer' as const,
                  })
                  setLibrarySize(Array.from(new Float32Array(res.data as ArrayBuffer)))
              } catch (e) {
                  console.error("Failed to fetch library size", e)
                  addToast("Library size not found. CPM normalization might be inaccurate.", "info")
              }
          }
          fetchLibSize()
      }
  }, [normalization, librarySize, datasetId, projectPassword, addToast])

  // Debounced generalised search — genes, metrics, annotations, clusterings,
  // regulons, ranked by relevance (exact matches first) by the backend.
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (geneQuery.length > 0) {
        setSearching(true)
        try {
            const config = projectPassword ? { headers: { 'x-project-password': projectPassword } } : {}
            const res = await api.get<SearchResult[]>(`/datasets/${datasetId}/search?query=${encodeURIComponent(geneQuery)}`, config)
            setSearchResults(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setSearching(false)
        }
      } else {
        setSearchResults([])
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
                      // Restore each channel column. Items may be genes OR
                      // continuous metrics; try the gene path first and fall
                      // back to the feature endpoint. A column that no longer
                      // exists is skipped gracefully (no throw, no empty render).
                      for (let i = 0; i < initialSelection.items.length; i++) {
                          const colName = initialSelection.items[i]
                          if (!colName) continue
                          if (i >= 3) break // Max 3 channels

                          try {
                              let kind: ColumnKind = 'gene'
                              let data: number[]
                              try {
                                  data = await fetchColumn(colName, 'gene')
                              } catch {
                                  kind = 'metric'
                                  data = await fetchColumn(colName, 'metric')
                              }
                              newSelectedGenes.push({ name: colName, slot: i, kind, data })
                          } catch (err) {
                              console.warn('Could not restore channel column', colName, err)
                          }
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
              // Normalization only applies to gene expression. Continuous
              // metrics (n_genes, pseudotime, QC scores, …) carry their own
              // units and must not be CPM/log-transformed.
              if (g.kind === 'gene') {
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

  // Fetch a per-cell numeric column for a gene OR a continuous metric. Genes go
  // through the cached /expression endpoint; metrics through /feature (which
  // also returns float32 for numeric obs columns). Used by both live clicks and
  // session restore so genes and metrics are interchangeable in the channels.
  const fetchColumn = async (name: string, kind: ColumnKind): Promise<number[]> => {
      if (kind === 'gene') {
          const arr = await fetchGeneExpression(datasetId, name, projectPassword)
          return Array.from(arr)
      }
      const res = await api.get(`/datasets/${datasetId}/feature/${encodeURIComponent(name)}`, {
          headers: projectPassword ? { 'x-project-password': projectPassword } : undefined,
          responseType: 'arraybuffer' as const,
      })
      return Array.from(new Float32Array(res.data as ArrayBuffer))
  }

  // Assign a gene or continuous metric to an R/G/B channel. `targetSlot`
  // undefined = toggle into the first free slot (or remove if already present);
  // a number = pin to that specific channel. This unifies genes and metrics so
  // metrics can be blended across channels too (Bug 2).
  const handleColumnClick = async (name: string, kind: ColumnKind, targetSlot?: number) => {
    const existingIndex = selectedGenes.findIndex(g => g.name === name)

    if (targetSlot === undefined) {
        if (existingIndex !== -1) {
            removeGene(name)
            return
        }
        if (selectedGenes.length >= 3) {
            addToast("Maximum 3 channels can be selected", "error")
            return
        }
    } else {
        // Clicking a colour circle the column already occupies — no-op.
        if (existingIndex !== -1 && selectedGenes[existingIndex].slot === targetSlot) {
            return
        }
    }

    setLoading(true)
    try {
      // A categorical annotation and the channel columns are mutually exclusive.
      if (activeFeature) {
          setActiveFeature(null)
      }

      const data = await fetchColumn(name, kind)

      let slot = targetSlot
      if (slot === undefined) {
          const usedSlots = selectedGenes.map(g => g.slot)
          slot = 0
          while (usedSlots.includes(slot)) slot++
      }

      let newSelected = [...selectedGenes]
      // Remove if already present (moving slots).
      if (existingIndex !== -1) {
          newSelected = newSelected.filter(g => g.name !== name)
      }
      // If the target slot is occupied, evict its current occupant.
      if (targetSlot !== undefined) {
          newSelected = newSelected.filter(g => g.slot !== targetSlot)
      }

      newSelected.push({ name, slot, kind, data })

      setSelectedGenes(newSelected)
      updateColors(newSelected, null, null)

      // Clear gene search box (no-op for metrics).
      setGeneQuery('')
      setSearchResults([])

    } catch (e) {
      console.error(e)
      addToast(`Failed to load "${name}"`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Route a generalised search result to the right handler: numeric elements
  // (genes/metrics/regulons) blend into a colour channel; annotations/clusterings
  // colour by that feature; a category value colours by its PARENT feature and
  // highlights the matched value in the legend.
  const handleResultClick = (r: SearchResult, targetSlot?: number) => {
      if (r.type === 'category' && r.feature) {
          handleFeatureClick({ name: r.feature, type: 'categorical' }, [r.name])
      } else if (TYPE_META[r.type].channel) {
          handleColumnClick(resolveColumnName(r), r.type === 'gene' ? 'gene' : 'metric', targetSlot)
      } else {
          handleFeatureClick({ name: r.name, type: 'categorical' })
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

      const isContinuous = feature.type !== 'categorical'
      const baseHeaders = projectPassword ? { 'x-project-password': projectPassword } : undefined
      const config = isContinuous
          ? { headers: baseHeaders, responseType: 'arraybuffer' as const }
          : { headers: baseHeaders }

      const res = await api.get(`/datasets/${datasetId}/feature/${feature.name}`, config)

      let numericValues: number[] = []
      let customColors: Float32Array | null = null
      let rawValues: any[] = []
      const legendData: { label: string, color: string }[] = []

      if (isContinuous) {
          // Server returned a Float32 binary buffer — decode in one shot.
          const floats = new Float32Array(res.data as ArrayBuffer)
          numericValues = Array.from(floats)
          rawValues = numericValues
      } else {
          const values = res.data as any[]
          rawValues = values
          if (values && values.length > 0) {
              const unique = Array.from(new Set(values.filter((v: any) => v !== null))) as string[]
              unique.sort()
              const map = new Map(unique.map((v, i) => [v, i]))

              numericValues = values.map((v: any) => {
                  if (v === null || v === undefined) return 0
                  return map.get(v) ?? 0
              })

              customColors = new Float32Array(values.length * 3)
              const colorMap = new Map<string, number[]>()

              unique.forEach((val, i) => {
                  const hex = BIG_COLOR_LIST[i % BIG_COLOR_LIST.length]
                  colorMap.set(val, hexToRgb(hex))
                  legendData.push({ label: val, color: '#' + hex })
              })

              values.forEach((v: any, i: number) => {
                  let rgb = [0.8, 0.8, 0.8]
                  if (v !== null && v !== undefined) {
                      rgb = colorMap.get(v) || [0, 0, 0]
                  }
                  customColors![i * 3] = rgb[0]
                  customColors![i * 3 + 1] = rgb[1]
                  customColors![i * 3 + 2] = rgb[2]
              })
          }
      }

      updateColors([], feature.name, numericValues, customColors, legendData, rawValues, restoredLegendSelection)

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const annotations = features.filter(f => f.type === 'categorical')
  const metrics = features.filter(f => f.type === 'continuous')

  return (
    <div className="absolute top-4 right-4 z-10 w-[28rem] max-w-[calc(100%-2rem)] bg-black/80 text-white p-4 rounded backdrop-blur-sm max-h-[80vh] overflow-y-auto border border-gray-800">
      <div className="flex gap-2 mb-4">
        <button
          className={`flex-1 p-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${activeTab === 'genes' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          onClick={() => setActiveTab('genes')}
        >
          <Search size={14} /> Search
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
            placeholder="Search genes, annotations, metrics..."
            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500"
            value={geneQuery}
            onChange={e => setGeneQuery(e.target.value)}
          />
          {/* Explains the category-search behaviour: a value match resolves to
              its parent feature (e.g. "male" -> the "Sex" feature). */}
          <p className="text-[10px] text-gray-500 leading-snug">
            Tip: searching a category value (e.g. <span className="text-gray-400">male</span>) finds the
            feature it belongs to (<span className="text-gray-400">Sex</span>) and highlights that value.
          </p>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {searching && (
                <div className="flex items-center gap-2 text-gray-400 text-xs p-2">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
                    Searching…{searchResults.length === 0 && <span className="text-gray-600"> (first search builds an index)</span>}
                </div>
            )}
            {searchResults.map((r, idx) => {
                const meta = TYPE_META[r.type]
                const colName = resolveColumnName(r)
                const isCategory = r.type === 'category'
                const isSelected = meta.channel
                    ? selectedGenes.some(g => g.name === colName)
                    : isCategory
                        ? activeFeature === r.feature
                        : activeFeature === r.name
                const displayName = r.type === 'clustering' ? bareFeatureName(r.name) : r.name
                return (
                    <div
                        key={`${r.type}:${r.feature || ''}:${r.name}:${idx}`}
                        className={`w-full flex justify-between items-center p-2 rounded text-xs transition-colors ${isSelected ? 'bg-blue-900/30 text-blue-200' : 'hover:bg-gray-800'}`}
                    >
                        <button
                            className="flex-1 text-left flex items-center gap-2 min-w-0"
                            onClick={() => handleResultClick(r)}
                            disabled={loading}
                            title={isCategory ? `${r.name} — in ${bareFeatureName(r.feature || '')}` : r.name}
                        >
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${meta.badge}`}>{meta.label}</span>
                            <span className="truncate">
                                {displayName}
                                {isCategory && r.feature && (
                                    <span className="text-gray-500"> · in {bareFeatureName(r.feature)}</span>
                                )}
                            </span>
                        </button>
                        {meta.channel && (
                            <div className="flex gap-1 ml-2 shrink-0">
                                <button
                                    className="w-3 h-3 rounded-full bg-red-500 hover:scale-125 transition-transform"
                                    onClick={(e) => { e.stopPropagation(); handleResultClick(r, 0); }}
                                    title="Assign to Red"
                                />
                                <button
                                    className="w-3 h-3 rounded-full bg-green-500 hover:scale-125 transition-transform"
                                    onClick={(e) => { e.stopPropagation(); handleResultClick(r, 1); }}
                                    title="Assign to Green"
                                />
                                <button
                                    className="w-3 h-3 rounded-full bg-blue-500 hover:scale-125 transition-transform"
                                    onClick={(e) => { e.stopPropagation(); handleResultClick(r, 2); }}
                                    title="Assign to Blue"
                                />
                            </div>
                        )}
                    </div>
                )
            })}
            {geneQuery && !searching && searchResults.length === 0 && (
                <div className="text-gray-500 text-xs p-2">No matches found</div>
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
              <div className="text-[10px] text-gray-500 mb-1">Click to colour, or pick a channel to blend (R/G/B).</div>
              <div className="space-y-1">
                {metrics.map(feature => {
                  const sel = selectedGenes.find(g => g.name === feature.name)
                  return (
                    <div
                      key={feature.name}
                      className={`w-full flex justify-between items-center p-2 rounded text-xs transition-colors ${sel ? 'bg-blue-900/30 text-blue-200' : 'hover:bg-gray-800'}`}
                    >
                      <button
                        className="flex-1 text-left flex items-center gap-2"
                        onClick={() => handleColumnClick(feature.name, 'metric')}
                        disabled={loading}
                      >
                        {sel && (
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sel.slot === 0 ? 'bg-red-500' : sel.slot === 1 ? 'bg-green-500' : 'bg-blue-500'}`} />
                        )}
                        <span className="truncate">{feature.name}</span>
                      </button>
                      <div className="flex gap-1 ml-2">
                        <button
                          className="w-3 h-3 rounded-full bg-red-500 hover:scale-125 transition-transform"
                          onClick={(e) => { e.stopPropagation(); handleColumnClick(feature.name, 'metric', 0); }}
                          title="Assign to Red"
                        />
                        <button
                          className="w-3 h-3 rounded-full bg-green-500 hover:scale-125 transition-transform"
                          onClick={(e) => { e.stopPropagation(); handleColumnClick(feature.name, 'metric', 1); }}
                          title="Assign to Green"
                        />
                        <button
                          className="w-3 h-3 rounded-full bg-blue-500 hover:scale-125 transition-transform"
                          onClick={(e) => { e.stopPropagation(); handleColumnClick(feature.name, 'metric', 2); }}
                          title="Assign to Blue"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {loading && <div className="text-xs text-blue-400 mt-2 text-center">Loading data...</div>}
    </div>
  )
}
