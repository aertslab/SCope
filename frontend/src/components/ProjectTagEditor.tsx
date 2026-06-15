import { useState, KeyboardEvent } from 'react'
import { Tag as TagIcon, X, Plus, Check } from 'lucide-react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

export interface ProjectTag {
  id: string
  name: string
  slug: string
  created_at: string
}

interface ProjectTagEditorProps {
  projectId: string
  tags: ProjectTag[]
  canEdit: boolean
  onChange: (tags: ProjectTag[]) => void
}

/**
 * Inline tag chip list with an admin-only edit affordance.
 *
 * The component holds a draft list while editing so the user can add/remove
 * multiple tags and commit them atomically — the backend's PUT
 * /projects/{id}/tags replaces the full set, so a single round-trip is
 * enough. Empty input commits a successful no-op so users can clear all
 * tags by removing every chip and saving.
 */
export function ProjectTagEditor({
  projectId,
  tags,
  canEdit,
  onChange,
}: ProjectTagEditorProps) {
  const { addToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const beginEdit = () => {
    setDraft(tags.map((t) => t.name))
    setInput('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setInput('')
  }

  const addDraftTag = (raw: string) => {
    const cleaned = raw.trim().replace(/,$/, '').trim()
    if (!cleaned) return
    if (cleaned.length > 50) {
      addToast('Tags must be 50 characters or fewer', 'error')
      return
    }
    if (draft.length >= 20) {
      addToast('A project can have at most 20 tags', 'error')
      return
    }
    if (draft.some((t) => t.toLowerCase() === cleaned.toLowerCase())) {
      setInput('')
      return
    }
    setDraft([...draft, cleaned])
    setInput('')
  }

  const removeDraftTag = (idx: number) => {
    setDraft(draft.filter((_, i) => i !== idx))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addDraftTag(input)
    } else if (e.key === 'Backspace' && !input && draft.length > 0) {
      // Convenience: backspace with empty input pops the last chip.
      e.preventDefault()
      setDraft(draft.slice(0, -1))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Commit any pending input the user typed but didn't press Enter on.
      const finalDraft =
        input.trim() && !draft.some((t) => t.toLowerCase() === input.trim().toLowerCase())
          ? [...draft, input.trim()]
          : draft
      const res = await api.put(`/projects/${projectId}/tags`, {
        tags: finalDraft,
      })
      onChange(res.data.tags || [])
      addToast('Tags updated', 'success')
      setEditing(false)
      setInput('')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      addToast(e.response?.data?.detail || 'Failed to update tags', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    if (tags.length === 0 && !canEdit) return null
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs"
          >
            <TagIcon className="h-3 w-3" />
            {t.name}
          </span>
        ))}
        {canEdit && (
          <button
            type="button"
            onClick={beginEdit}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 px-2 py-0.5 text-xs"
          >
            <Plus className="h-3 w-3" />
            {tags.length === 0 ? 'Add tags' : 'Edit'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-3 max-w-xl">
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {draft.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs"
          >
            <TagIcon className="h-3 w-3" />
            {t}
            <button
              type="button"
              onClick={() => removeDraftTag(i)}
              className="text-indigo-500 hover:text-indigo-700"
              aria-label={`Remove tag ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input.trim() && addDraftTag(input)}
          placeholder={draft.length === 0 ? 'e.g. brain, scRNA-seq' : 'Add tag…'}
          className="flex-1 min-w-[8rem] text-sm border-0 focus:ring-0 outline-none"
          autoFocus
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={cancelEdit}
          disabled={saving}
          className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded px-2.5 py-1 disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          {saving ? 'Saving…' : 'Save tags'}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Press Enter or comma to add. Tags are public on the discovery gallery.
      </p>
    </div>
  )
}
