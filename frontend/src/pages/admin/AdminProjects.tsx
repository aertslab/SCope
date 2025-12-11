import { useEffect, useState } from 'react'
import api from '../../api/client'
import { Project } from '../../types'
import { Search, Folder, Trash2, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AdminProjects() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        fetchProjects()
    }, [])

    const fetchProjects = async () => {
        try {
            const res = await api.get('/projects/')
            setProjects(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const filteredProjects = projects.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
    )

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Manage Projects</h1>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search projects..." 
                        className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visibility</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datasets</th>
                            <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
                        ) : filteredProjects.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No projects found</td></tr>
                        ) : (
                            filteredProjects.map((project) => (
                                <tr key={project.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                                <Folder className="h-5 w-5 text-indigo-500" />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{project.name}</div>
                                                <div className="text-sm text-gray-500 truncate max-w-xs">{project.description}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${project.visibility === 'public' ? 'bg-green-100 text-green-800' : 
                                              project.visibility === 'private' ? 'bg-gray-100 text-gray-800' : 
                                              'bg-yellow-100 text-yellow-800'}`}>
                                            {project.visibility}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {project.datasets?.length || 0} datasets
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                                        <Link to={`/projects/${project.id}`} className="text-indigo-600 hover:text-indigo-900">
                                            <ExternalLink size={18} />
                                        </Link>
                                        <button className="text-red-600 hover:text-red-900">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
