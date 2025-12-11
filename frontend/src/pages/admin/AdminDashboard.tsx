import { useEffect, useState } from 'react'
import api from '../../api/client'
import { Trash2, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'

interface AdminStats {
  total_users: number
  total_datasets: number
  system_status: string
}

interface ProcessingDataset {
  id: string
  name: string
  status: string
  created_at: string
  owner_email: string
  projects: string[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    total_users: 0,
    total_datasets: 0,
    system_status: 'Unknown',
  })
  const [processingDatasets, setProcessingDatasets] = useState<ProcessingDataset[]>([])
  const [, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [statsRes, procRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/processing-datasets')
      ])
      setStats(statsRes.data)
      setProcessingDatasets(procRes.data)
    } catch (error) {
      console.error('Failed to fetch admin data', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Poll every 10 seconds
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleDelete = async (id: string) => {
    if(!confirm("Are you sure you want to delete this dataset? This action cannot be undone.")) return
    try {
        await api.delete(`/datasets/${id}`)
        setProcessingDatasets(prev => prev.filter(d => d.id !== id))
        // Refresh stats too
        const statsRes = await api.get('/admin/stats')
        setStats(statsRes.data)
    } catch (e) {
        console.error(e)
        alert("Failed to delete dataset")
    }
  }

  const getStatusIcon = (status: string) => {
      switch(status) {
          case 'processing': return <Loader2 className="animate-spin text-blue-500" size={18} />
          case 'pending': return <Clock className="text-yellow-500" size={18} />
          case 'failed': return <AlertCircle className="text-red-500" size={18} />
          case 'ready': return <CheckCircle className="text-green-500" size={18} />
          default: return <Clock size={18} />
      }
  }

  const getTimeElapsed = (dateString: string) => {
      const date = new Date(dateString)
      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
      
      if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
      return `${Math.floor(diffInSeconds / 86400)} days ago`
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.total_users}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Datasets</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.total_datasets}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">System Status</dt>
            <dd className="mt-1 text-3xl font-semibold text-green-600">{stats.system_status}</dd>
          </div>
        </div>
      </div>

      {/* Processing Queue */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Processing Queue</h3>
              <p className="mt-1 text-sm text-gray-500">Datasets currently being processed or in failed state.</p>
          </div>
          <ul className="divide-y divide-gray-200">
              {processingDatasets.length === 0 && (
                  <li className="px-4 py-4 sm:px-6 text-center text-gray-500">No active processing tasks</li>
              )}
              {processingDatasets.map((ds) => (
                  <li key={ds.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center min-w-0 gap-4">
                              {getStatusIcon(ds.status)}
                              <div>
                                  <p className="text-sm font-medium text-indigo-600 truncate">{ds.name}</p>
                                  <div className="flex text-xs text-gray-500 gap-2">
                                      <span>{ds.owner_email}</span>
                                      <span>•</span>
                                      <span>{getTimeElapsed(ds.created_at)}</span>
                                  </div>
                              </div>
                          </div>
                          <div className="flex items-center gap-4">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                  ${ds.status === 'processing' ? 'bg-blue-100 text-blue-800' : 
                                    ds.status === 'failed' ? 'bg-red-100 text-red-800' : 
                                    'bg-yellow-100 text-yellow-800'}`}>
                                  {ds.status}
                              </span>
                              <button 
                                  onClick={() => handleDelete(ds.id)}
                                  className="text-gray-400 hover:text-red-500"
                                  title="Delete Dataset"
                              >
                                  <Trash2 size={18} />
                              </button>
                          </div>
                      </div>
                  </li>
              ))}
          </ul>
      </div>
    </div>
  )
}
