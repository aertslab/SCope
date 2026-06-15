import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dataset } from '../types'
import { ChevronLeft, ChevronRight, Database, Folder, Bookmark } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { Button } from './ui/Button'
import { useProjectStore } from '../store/useProjectStore'
import { useDatasetStore } from '../store/useDatasetStore'
import api from '../api/client'

interface SidebarProps {
    currentDatasetId?: string
    currentDataset?: Dataset
    isOpen: boolean
    onToggle: (isOpen: boolean) => void
    onDragStart?: () => void
    onDragEnd?: () => void
}

export function ViewerSidebar({ currentDatasetId, currentDataset, isOpen, onToggle, onDragStart, onDragEnd }: SidebarProps) {
    const { projects, isLoading: loading, fetchProjects, attachProject } = useProjectStore()
    const { datasets, isLoading: datasetsLoading, fetchDatasets } = useDatasetStore()
    const { addToast } = useToast()
    const navigate = useNavigate()
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    useEffect(() => {
        // Auth is HttpOnly-cookie based; we cannot probe localStorage
        // anymore. Probe the user endpoint and treat any success as
        // authenticated. The 401 path falls through silently.
        let cancelled = false
        api.get('/users/me')
            .then(() => {
                if (cancelled) return
                setIsAuthenticated(true)
                fetchProjects()
                fetchDatasets()
            })
            .catch(() => { if (!cancelled) setIsAuthenticated(false) })
        return () => { cancelled = true }
    }, [fetchProjects, fetchDatasets])

    const handleAttach = async (projectId: string) => {
        try {
            await attachProject(projectId)
            addToast('Project bookmarked', 'success')
        } catch (err) {
            console.error(err)
            addToast('Failed to bookmark project', 'error')
        }
    }

    // Identify projects that contain the current dataset but are NOT in the user's list
    const unattachedProjects = currentDataset?.projects?.filter(p => 
        !projects.some(existing => existing.id === p.id)
    ) || []

    if (!isOpen) {
        return (
            <Button 
                onClick={() => onToggle(true)}
                className="absolute top-1/2 left-0 z-30 rounded-l-none rounded-r bg-gray-800 hover:bg-gray-700 text-white border-none h-10 w-8 p-0"
                size="sm"
            >
                <ChevronRight size={20} />
            </Button>
        )
    }

    return (
        <div className="absolute top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-30 flex flex-col transition-all duration-300">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <h2 className="text-white font-bold">Projects</h2>
                <Button 
                    onClick={() => onToggle(false)}
                    variant="ghost-dark"
                    size="icon"
                    className="h-8 w-8"
                >
                    <ChevronLeft size={20} />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-4">
                {!isAuthenticated && (
                    <div className="text-gray-400 text-sm p-2 text-center">
                        <a href="/login" className="text-blue-400 hover:underline">Log in</a> to see your projects.
                    </div>
                )}

                {loading && (
                    <div className="text-gray-400 text-sm p-2 text-center">Loading projects...</div>
                )}

                {!loading && projects.map(project => (
                    <div key={project.id} className="space-y-1">
                        <div className="flex items-center justify-between text-gray-300 px-2 py-1 hover:bg-gray-800 rounded group">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Folder size={16} className="text-blue-400 flex-shrink-0" />
                                <span className="truncate text-sm font-medium" title={project.name}>{project.name}</span>
                            </div>
                        </div>
                        
                        <div className="pl-4 space-y-1">
                            {project.datasets?.map(ds => (
                                <div
                                    key={ds.id}
                                    draggable={true}
                                    onDragStart={(e) => {
                                        e.stopPropagation();
                                        console.log('Drag started', ds.name);
                                        e.dataTransfer.setData('application/json', JSON.stringify({ datasetId: ds.id, name: ds.name }));
                                        e.dataTransfer.effectAllowed = 'copy';
                                        
                                        onDragStart?.();
                                    }}
                                    onDragEnd={() => {
                                        console.log('Drag ended');
                                        onDragEnd?.();
                                    }}
                                    onClick={() => navigate(`/viewer/${ds.id}`)}
                                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors cursor-grab active:cursor-grabbing select-none ${
                                        ds.id === currentDatasetId 
                                            ? 'bg-blue-900/50 text-blue-200' 
                                            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                    }`}
                                >
                                    <Database size={14} className="flex-shrink-0" />
                                    <span className="truncate text-left" title={ds.name}>{ds.name}</span>
                                </div>
                            ))}
                            {(!project.datasets || project.datasets.length === 0) && (
                                <div className="text-gray-600 text-xs pl-2 italic">No datasets</div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Unattached Projects (Current Context) */}
                {unattachedProjects.length > 0 && (
                    <>
                        <div className="border-t border-gray-800 my-2"></div>
                        <div className="px-2 text-xs font-semibold text-gray-500 uppercase mb-1">Current Project</div>
                        {unattachedProjects.map(project => (
                            <div key={project.id} className="space-y-1">
                                <div className="flex items-center justify-between text-gray-300 px-2 py-1 hover:bg-gray-800 rounded group">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Folder size={16} className="text-yellow-500 flex-shrink-0" />
                                        <span className="truncate text-sm font-medium" title={project.name}>{project.name}</span>
                                    </div>
                                    {isAuthenticated && (
                                        <button
                                            onClick={() => handleAttach(project.id)}
                                            className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Bookmark Project"
                                        >
                                            <Bookmark size={14} />
                                        </button>
                                    )}
                                </div>
                                <div className="pl-4 space-y-1">
                                    <div 
                                    className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-blue-900/50 text-blue-200 cursor-pointer select-none"
                                    draggable={true}
                                    onDragStart={(e) => {
                                        if (currentDataset) {
                                            console.log('Drag started', currentDataset.name);
                                            e.dataTransfer.setData('application/json', JSON.stringify({ datasetId: currentDataset.id, name: currentDataset.name }));
                                            e.dataTransfer.effectAllowed = 'copy';
                                            
                                            // Use Canvas for drag image
                                            const canvas = document.createElement('canvas');
                                            const ctx = canvas.getContext('2d');
                                            if (ctx) {
                                                ctx.font = 'bold 12px sans-serif';
                                                const text = currentDataset.name;
                                                const padding = 8;
                                                const textMetrics = ctx.measureText(text);
                                                canvas.width = textMetrics.width + (padding * 2);
                                                canvas.height = 30;
                                                
                                                // Background
                                                ctx.fillStyle = '#1e3a8a';
                                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                                                
                                                // Text
                                                ctx.fillStyle = 'white';
                                                ctx.font = 'bold 12px sans-serif';
                                                ctx.textBaseline = 'middle';
                                                ctx.fillText(text, padding, canvas.height / 2);
                                                
                                                e.dataTransfer.setDragImage(canvas, 0, 0);
                                            }

                                            onDragStart?.();
                                        }
                                    }}
                                    onDragEnd={() => {
                                        console.log('Drag ended');
                                        onDragEnd?.();
                                    }}
                                >
                                    <Database size={12} />
                                    <span className="truncate">{currentDataset?.name}</span>
                                </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {/* All Datasets Section */}
                <div className="border-t border-gray-800 my-2 pt-2">
                    <div className="px-2 text-xs font-semibold text-gray-500 uppercase mb-2">All Datasets</div>
                    {datasetsLoading && <div className="text-gray-500 text-xs px-2">Loading...</div>}
                    {!datasetsLoading && datasets.map(ds => (
                        <div
                            key={ds.id}
                            draggable={true}
                            onDragStart={(e) => {
                                e.stopPropagation();
                                e.dataTransfer.setData('application/json', JSON.stringify({ datasetId: ds.id, name: ds.name }));
                                e.dataTransfer.effectAllowed = 'copy';
                                onDragStart?.();
                            }}
                            onDragEnd={() => {
                                onDragEnd?.();
                            }}
                            onClick={() => navigate(`/viewer/${ds.id}`)}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors cursor-grab active:cursor-grabbing select-none ${
                                ds.id === currentDatasetId 
                                    ? 'bg-blue-900/50 text-blue-200' 
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                            }`}
                        >
                            <Database size={14} className="flex-shrink-0" />
                            <span className="truncate text-left" title={ds.name}>{ds.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
