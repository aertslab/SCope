import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../api/client'
import { useViewerStore } from '../store/useViewerStore'
import { builderState, validateTokens } from '../filters/engine'
import { CompareOp, Predicate, SetOp, Token } from '../filters/types'
import { Filter, X, Eye, EyeOff, AlertTriangle, CornerDownLeft } from 'lucide-react'

interface FilterBarProps {
  datasetId: string
  projectPassword?: string
}

interface FeatureMeta {
  name: string
  type: 'categorical' | 'continuous'
}

type FieldKind = 'gene' | 'metric' | 'categorical' | 'selection'
interface FieldChoice {
  name: string
  kind: FieldKind
  selectionId?: string
}

type Draft =
  | { stage: 'field' }
  | { stage: 'op'; field: FieldChoice }
  | { stage: 'value'; field: FieldChoice; op: CompareOp }
  | { stage: 'categories'; field: FieldChoice; op: SetOp; available: string[]; selected: string[]; loading: boolean }

const COMPARE_OPS: CompareOp[] = ['>', '>=', '<', '<=', '==', '!=']

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tok_${Math.random().toString(36).slice(2)}`

function predicateLabel(p: Predicate): string {
  if (p.kind === 'quant') return `${p.name} ${p.op} ${p.value}`
  if (p.kind === 'categorical') {
    return `${p.feature} ${p.op === 'in' ? '∈' : '∉'} {${p.categories.join(', ')}}`
  }
  return `∈ ${p.label || 'selection'}`
}

export function FilterBar({ datasetId, projectPassword }: FilterBarProps) {
  const tokens = useViewerStore((s) => s.filterTokens)
  const setFilterTokens = useViewerStore((s) => s.setFilterTokens)
  const filterEnabled = useViewerStore((s) => s.filterEnabled)
  const setFilterEnabled = useViewerStore((s) => s.setFilterEnabled)
  const filterCount = useViewerStore((s) => s.filterCount)
  const selections = useViewerStore((s) => s.selections)

  const [features, setFeatures] = useState<FeatureMeta[]>([])
  const [draft, setDraft] = useState<Draft>({ stage: 'field' })
  const [query, setQuery] = useState('')
  const [geneResults, setGeneResults] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  // Insertion point within the token list. null = at the end (the default, and
  // what restored filters use). A number pins the caret before that token, so
  // new chips/operators/parens are inserted there — letting the user place
  // elements freely between/around existing chips.
  const [caret, setCaret] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const blurTimer = useRef<number | null>(null)

  const headers = useMemo(
    () => (projectPassword ? { 'x-project-password': projectPassword } : undefined),
    [projectPassword],
  )

  // Feature list (annotations + metrics) once per dataset.
  useEffect(() => {
    api
      .get<FeatureMeta[]>(`/datasets/${datasetId}/features`, { headers })
      .then((res) => setFeatures(res.data))
      .catch(() => setFeatures([]))
  }, [datasetId, headers])

  // Avoid a setState after unmount from the blur-delay timer.
  useEffect(() => () => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current)
  }, [])

  // Debounced gene search while typing a field.
  useEffect(() => {
    if (draft.stage !== 'field' || query.length === 0) {
      setGeneResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get<string[]>(
          `/datasets/${datasetId}/genes?query=${encodeURIComponent(query)}`,
          { headers },
        )
        setGeneResults(res.data)
      } catch {
        setGeneResults([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, draft.stage, datasetId, headers])

  // Effective caret index (null ⇒ end). What the grammar expects *next* is
  // computed from the prefix BEFORE the caret, so the quick-insert buttons adapt
  // to wherever the caret currently sits.
  const caretPos = caret === null ? tokens.length : Math.min(caret, tokens.length)
  const { expectOperand, depth } = useMemo(
    () => builderState(tokens.slice(0, caretPos)),
    [tokens, caretPos],
  )
  const filterInvalid = tokens.length > 0 && !validateTokens(tokens).valid

  const resetDraft = () => {
    setDraft({ stage: 'field' })
    setQuery('')
    setGeneResults([])
  }

  // Insert at the caret (keeping the caret after the inserted token).
  const insertToken = (t: Token) => {
    setFilterTokens((prev) => {
      const pos = caret === null ? prev.length : Math.min(caret, prev.length)
      const next = [...prev]
      next.splice(pos, 0, t)
      return next
    })
    setCaret((prev) => (prev === null ? null : prev + 1))
  }
  const removeTokenAt = (i: number) => {
    setFilterTokens((prev) => prev.filter((_, idx) => idx !== i))
    setCaret((prev) => (prev !== null && i < prev ? prev - 1 : prev))
  }
  const clearAll = () => {
    setFilterTokens([])
    setCaret(null)
    resetDraft()
  }

  const commitPredicate = (predicate: Predicate) => {
    insertToken({ id: newId(), type: 'predicate', predicate })
    resetDraft()
    inputRef.current?.focus()
  }

  const moveCaret = (delta: number) => {
    setCaret((prev) => {
      const cur = prev === null ? tokens.length : Math.min(prev, tokens.length)
      const nextPos = Math.max(0, Math.min(tokens.length, cur + delta))
      return nextPos >= tokens.length ? null : nextPos
    })
  }

  // --- field-stage suggestions -------------------------------------------------
  const q = query.trim().toLowerCase()
  const matchingFeatures = features.filter((f) => f.name.toLowerCase().includes(q))
  const annotationSugg = matchingFeatures.filter((f) => f.type === 'categorical')
  const metricSugg = matchingFeatures.filter((f) => f.type === 'continuous')
  const selectionSugg = selections.filter((s) => !q || s.name.toLowerCase().includes(q))
  const geneSugg = geneResults

  const chooseField = (field: FieldChoice) => {
    if (field.kind === 'selection') {
      commitPredicate({ kind: 'selection', selectionId: field.selectionId!, label: field.name })
      return
    }
    setDraft({ stage: 'op', field })
    setQuery('')
    setGeneResults([])
  }

  const chooseCategoricalOp = async (field: FieldChoice, op: SetOp) => {
    setDraft({ stage: 'categories', field, op, available: [], selected: [], loading: true })
    try {
      const res = await api.get<string[]>(
        `/datasets/${datasetId}/feature/${encodeURIComponent(field.name)}/categories`,
        { headers },
      )
      setDraft((d) =>
        d.stage === 'categories' && d.field.name === field.name
          ? { ...d, available: res.data, loading: false }
          : d,
      )
    } catch {
      setDraft((d) => (d.stage === 'categories' ? { ...d, loading: false } : d))
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      resetDraft()
      return
    }
    // Caret navigation only makes sense with an empty input in the field stage.
    if (query !== '' || draft.stage !== 'field') return
    if (e.key === 'Backspace' && caretPos > 0) {
      // Delete the chip immediately left of the caret.
      removeTokenAt(caretPos - 1)
    } else if (e.key === 'ArrowLeft' && caretPos > 0) {
      e.preventDefault()
      moveCaret(-1)
    } else if (e.key === 'ArrowRight' && caretPos < tokens.length) {
      e.preventDefault()
      moveCaret(1)
    }
  }

  const active = !!filterCount && filterEnabled
  const containerBorder = filterInvalid
    ? 'border-amber-500/70'
    : active
      ? 'border-blue-500/70'
      : 'border-gray-700'

  return (
    <div
      className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[min(680px,calc(100%-1.5rem))] bg-gray-900/90 backdrop-blur border ${containerBorder} rounded-lg shadow-xl text-white`}
    >
      <div className="flex items-start gap-2 p-2">
        <Filter size={16} className={`mt-1.5 flex-shrink-0 ${active ? 'text-blue-400' : 'text-gray-400'}`} />

        {/* Chips + builder. Chips render before and after the caret; clicking a
            chip (or empty space) moves the caret so new tokens insert there. */}
        <div
          className="relative flex flex-1 flex-wrap items-center gap-1 min-h-[2rem] cursor-text"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCaret(null)
              inputRef.current?.focus()
            }
          }}
        >
          {tokens.slice(0, caretPos).map((t, i) => (
            <TokenChip
              key={t.id}
              token={t}
              onSelect={() => { setCaret(i); inputRef.current?.focus() }}
              onRemove={() => removeTokenAt(i)}
            />
          ))}

          {/* Builder slot lives AT the caret. */}
          {draft.stage !== 'field' ? (
            <PendingBuilder
              draft={draft}
              onPickCompareOp={(op) => setDraft({ stage: 'value', field: draft.field, op })}
              onPickSetOp={(op) => chooseCategoricalOp(draft.field, op)}
              onCommitQuant={(op, value) =>
                commitPredicate({
                  kind: 'quant',
                  source: draft.field.kind === 'gene' ? 'gene' : 'metric',
                  name: draft.field.name,
                  op,
                  value,
                })
              }
              onToggleCategory={(c) =>
                setDraft((d) =>
                  d.stage === 'categories'
                    ? {
                        ...d,
                        selected: d.selected.includes(c)
                          ? d.selected.filter((x) => x !== c)
                          : [...d.selected, c],
                      }
                    : d,
                )
              }
              onCommitCategories={() => {
                if (draft.stage === 'categories' && draft.selected.length)
                  commitPredicate({
                    kind: 'categorical',
                    feature: draft.field.name,
                    op: draft.op,
                    categories: draft.selected,
                  })
              }}
              onCancel={resetDraft}
            />
          ) : (
            <div className="relative flex items-center gap-1">
              {/* Visible caret marker */}
              {tokens.length > 0 && <span className="w-0.5 h-5 bg-blue-400/70 rounded-sm animate-pulse" />}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Delay so a suggestion click registers first.
                  blurTimer.current = window.setTimeout(() => setShowSuggestions(false), 150)
                }}
                onKeyDown={onKeyDown}
                placeholder={
                  tokens.length === 0
                    ? 'Filter cells… (gene, feature, metric, or selection)'
                    : expectOperand
                      ? 'condition…'
                      : 'AND / OR…'
                }
                className={`bg-transparent text-sm placeholder-gray-500 focus:outline-none px-1 py-1 transition-all ${
                  tokens.length === 0 ? 'flex-1 min-w-[12rem]' : 'w-24 focus:w-40'
                }`}
              />
              {showSuggestions &&
                expectOperand &&
                (geneSugg.length > 0 ||
                  annotationSugg.length > 0 ||
                  metricSugg.length > 0 ||
                  selectionSugg.length > 0) && (
                  <div
                    className="absolute left-0 top-full mt-1 w-72 max-h-72 overflow-y-auto bg-gray-800 border border-gray-700 rounded-md shadow-2xl z-40"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <SuggestionGroup
                      label="Genes"
                      items={geneSugg.slice(0, 8).map((g) => ({ key: g, label: g, badge: 'gene' }))}
                      onPick={(g) => chooseField({ name: g, kind: 'gene' })}
                    />
                    <SuggestionGroup
                      label="Annotations"
                      items={annotationSugg.slice(0, 8).map((f) => ({ key: f.name, label: f.name, badge: 'cat' }))}
                      onPick={(name) => chooseField({ name, kind: 'categorical' })}
                    />
                    <SuggestionGroup
                      label="Metrics"
                      items={metricSugg.slice(0, 8).map((f) => ({ key: f.name, label: f.name, badge: 'num' }))}
                      onPick={(name) => chooseField({ name, kind: 'metric' })}
                    />
                    <SuggestionGroup
                      label="Selections"
                      items={selectionSugg.map((s) => ({ key: s.id, label: s.name, badge: 'sel' }))}
                      onPick={(id) => {
                        const sel = selections.find((s) => s.id === id)
                        if (sel) chooseField({ name: sel.name, kind: 'selection', selectionId: sel.id })
                      }}
                    />
                  </div>
                )}
              {/* Operator / grouping quick-insert buttons — gated by the grammar
                  state at the caret, and inserted AT the caret. */}
              {expectOperand ? (
                <>
                  <OpBtn label="NOT" onClick={() => insertToken({ id: newId(), type: 'not' })} />
                  <OpBtn label="(" onClick={() => insertToken({ id: newId(), type: 'lparen' })} />
                </>
              ) : (
                <>
                  <OpBtn label="AND" onClick={() => insertToken({ id: newId(), type: 'op', op: 'AND' })} />
                  <OpBtn label="OR" onClick={() => insertToken({ id: newId(), type: 'op', op: 'OR' })} />
                  {depth > 0 && <OpBtn label=")" onClick={() => insertToken({ id: newId(), type: 'rparen' })} />}
                </>
              )}
            </div>
          )}

          {tokens.slice(caretPos).map((t, j) => {
            const i = caretPos + j
            return (
              <TokenChip
                key={t.id}
                token={t}
                onSelect={() => { setCaret(i); inputRef.current?.focus() }}
                onRemove={() => removeTokenAt(i)}
              />
            )
          })}
        </div>

        {/* Right side: status + controls */}
        <div className="flex flex-shrink-0 items-center gap-2 pl-1">
          {filterInvalid && (
            <span className="flex items-center gap-1 text-amber-400 text-xs" title="Filter is incomplete">
              <AlertTriangle size={12} /> incomplete
            </span>
          )}
          {active && filterCount && (
            <span className="text-xs text-blue-300 whitespace-nowrap">
              {filterCount.matched.toLocaleString()} / {filterCount.total.toLocaleString()}
            </span>
          )}
          {tokens.length > 0 && (
            <button
              onClick={() => setFilterEnabled(!filterEnabled)}
              title={filterEnabled ? 'Disable filter (show all cells)' : 'Enable filter'}
              className="text-gray-400 hover:text-white"
            >
              {filterEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          )}
          {tokens.length > 0 && (
            <button onClick={clearAll} title="Clear filter" className="text-gray-400 hover:text-red-400">
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function OpBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-[11px] font-semibold text-gray-300"
    >
      {label}
    </button>
  )
}

function TokenChip({
  token,
  onSelect,
  onRemove,
}: {
  token: Token
  onSelect: () => void
  onRemove: () => void
}) {
  const remove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove()
  }
  // Body click positions the caret here; the ✕ removes the chip.
  if (token.type === 'predicate') {
    return (
      <span
        onClick={onSelect}
        title="Click to place the cursor here"
        className="inline-flex items-center gap-1 rounded bg-blue-900/50 border border-blue-700/50 px-2 py-0.5 text-xs cursor-pointer hover:border-blue-400"
      >
        {predicateLabel(token.predicate)}
        <button onClick={remove} className="text-blue-300 hover:text-white" title="Remove">
          <X size={11} />
        </button>
      </span>
    )
  }
  const text = token.type === 'op' ? token.op : token.type === 'not' ? 'NOT' : token.type === 'lparen' ? '(' : ')'
  return (
    <span
      onClick={onSelect}
      title="Click to place the cursor here"
      className="inline-flex items-center gap-0.5 rounded bg-gray-800 px-1.5 py-0.5 text-[11px] font-semibold text-gray-300 cursor-pointer hover:bg-gray-700"
    >
      {text}
      <button onClick={remove} className="text-gray-500 hover:text-red-400" title="Remove">
        <X size={10} />
      </button>
    </span>
  )
}

function SuggestionGroup({
  label,
  items,
  onPick,
}: {
  label: string
  items: { key: string; label: string; badge: string }[]
  onPick: (key: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="py-1">
      <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onPick(it.key)}
          className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-700"
        >
          <span className="truncate">{it.label}</span>
          <span className="text-[9px] uppercase text-gray-500">{it.badge}</span>
        </button>
      ))}
    </div>
  )
}

function PendingBuilder({
  draft,
  onPickCompareOp,
  onPickSetOp,
  onCommitQuant,
  onToggleCategory,
  onCommitCategories,
  onCancel,
}: {
  draft: Exclude<Draft, { stage: 'field' }>
  onPickCompareOp: (op: CompareOp) => void
  onPickSetOp: (op: SetOp) => void
  onCommitQuant: (op: CompareOp, value: number) => void
  onToggleCategory: (c: string) => void
  onCommitCategories: () => void
  onCancel: () => void
}) {
  const [valueText, setValueText] = useState('')
  const [catQuery, setCatQuery] = useState('')

  const field = draft.field
  const isGene = field.kind === 'gene'

  return (
    <span className="inline-flex flex-wrap items-center gap-1 rounded bg-gray-800/80 border border-gray-600 px-2 py-0.5 text-xs">
      <span className="font-medium text-blue-200">{field.name}</span>

      {draft.stage === 'op' && (
        <span className="flex items-center gap-1">
          {field.kind === 'categorical' ? (
            <>
              <MiniBtn label="in" onClick={() => onPickSetOp('in')} />
              <MiniBtn label="not in" onClick={() => onPickSetOp('not in')} />
            </>
          ) : (
            <>
              {COMPARE_OPS.map((op) => (
                <MiniBtn key={op} label={op} onClick={() => onPickCompareOp(op)} />
              ))}
              {isGene && (
                <>
                  <span className="mx-0.5 text-gray-600">|</span>
                  <MiniBtn label="detected" onClick={() => onCommitQuant('>', 0)} />
                  <MiniBtn label="not detected" onClick={() => onCommitQuant('==', 0)} />
                </>
              )}
            </>
          )}
        </span>
      )}

      {draft.stage === 'value' && (
        <span className="flex items-center gap-1">
          <span className="text-gray-300">{draft.op}</span>
          <input
            autoFocus
            type="number"
            step="any"
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = parseFloat(valueText)
                if (!Number.isNaN(v)) onCommitQuant(draft.op, v)
              } else if (e.key === 'Escape') onCancel()
            }}
            placeholder="value"
            className="w-20 bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => {
              const v = parseFloat(valueText)
              if (!Number.isNaN(v)) onCommitQuant(draft.op, v)
            }}
            className="text-blue-300 hover:text-white"
            title="Add condition"
          >
            <CornerDownLeft size={13} />
          </button>
        </span>
      )}

      {draft.stage === 'categories' && (
        <span className="flex flex-wrap items-center gap-1">
          <span className="text-gray-300">{draft.op}</span>
          {draft.loading ? (
            <span className="text-gray-500">loading…</span>
          ) : (
            <>
              <input
                autoFocus
                value={catQuery}
                onChange={(e) => setCatQuery(e.target.value)}
                placeholder="filter categories"
                className="w-28 bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-blue-500"
              />
              <span className="flex flex-wrap items-center gap-1 max-w-[20rem] max-h-24 overflow-y-auto">
                {draft.available
                  .filter((c) => !catQuery || c.toLowerCase().includes(catQuery.toLowerCase()))
                  .slice(0, 60)
                  .map((c) => {
                    const sel = draft.selected.includes(c)
                    return (
                      <button
                        key={c}
                        onClick={() => onToggleCategory(c)}
                        className={`px-1.5 py-0.5 rounded text-[11px] ${sel ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      >
                        {c}
                      </button>
                    )
                  })}
              </span>
              <button
                onClick={onCommitCategories}
                disabled={draft.selected.length === 0}
                className="text-blue-300 hover:text-white disabled:text-gray-600"
                title="Add condition"
              >
                <CornerDownLeft size={13} />
              </button>
            </>
          )}
        </span>
      )}

      <button onClick={onCancel} className="text-gray-400 hover:text-red-400" title="Cancel">
        <X size={11} />
      </button>
    </span>
  )
}

function MiniBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-1 py-0.5 rounded bg-gray-700 hover:bg-blue-600 text-[11px] text-gray-200"
    >
      {label}
    </button>
  )
}
