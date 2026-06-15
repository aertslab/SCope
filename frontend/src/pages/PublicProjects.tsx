import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { Search, ExternalLink, Database, Tag as TagIcon, X } from 'lucide-react'

interface Tag {
  id: string
  name: string
  slug: string
  created_at: string
}

interface TagWithCount extends Tag {
  project_count: number
}

interface PublicProject {
  id: string
  name: string
  description?: string | null
  owner_id: string
  created_at: string
  dataset_count: number
  tags: Tag[]
}

export default function PublicProjects() {
  const [projects, setProjects] = useState<PublicProject[]>([])
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const fetchProjects = async (q: string, tag: string | null) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (q.trim()) params.search = q.trim()
      if (tag) params.tag = tag
      const res = await api.get<PublicProject[]>('/projects/public', { params })
      setProjects(res.data)
    } catch (err) {
      // Public endpoint — fail quietly; empty state covers the user side.
      console.warn('Public projects fetch failed', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTags = async () => {
    try {
      const res = await api.get<TagWithCount[]>('/tags/', {
        params: { public_only: true },
      })
      setTags(res.data)
    } catch (err) {
      console.warn('Tags fetch failed', err)
    }
  }

  useEffect(() => {
    fetchTags()
  }, [])

  // Debounce search; tag toggles also flow through this effect so a single
  // place owns the request lifecycle.
  useEffect(() => {
    const t = setTimeout(() => fetchProjects(query, activeTag), 300)
    return () => clearTimeout(t)
  }, [query, activeTag])

  const heading = useMemo(() => {
    if (activeTag) return `Public projects tagged "${activeTag}"`
    return 'Public Gallery'
  }, [activeTag])

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-semibold text-gray-900 mb-1">{heading}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Browse projects that have been made publicly available. No account required.
      </p>

      <div className="relative mb-4">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or description..."
          className="block w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-medium hover:bg-indigo-100"
            >
              <X className="h-3 w-3" /> Clear filter
            </button>
          )}
          {tags.map((t) => {
            const isActive = activeTag === t.slug
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTag(isActive ? null : t.slug)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'
                }`}
                aria-pressed={isActive}
              >
                <TagIcon className="h-3 w-3" />
                {t.name}
                <span className={`ml-1 ${isActive ? 'text-indigo-100' : 'text-gray-400'}`}>
                  {t.project_count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No public projects {query || activeTag ? 'match your filters.' : 'yet.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="block bg-white shadow rounded-lg p-5 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold text-gray-900 truncate">{p.name}</h2>
                <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
              </div>
              {p.description && (
                <p className="text-sm text-gray-600 mt-2 line-clamp-3">{p.description}</p>
              )}
              {p.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {p.tags.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs"
                    >
                      <TagIcon className="h-3 w-3" />
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400 mt-3">
                <span className="inline-flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {p.dataset_count} dataset{p.dataset_count === 1 ? '' : 's'}
                </span>
                <span>{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
