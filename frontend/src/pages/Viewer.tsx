import { useState, useRef, useEffect } from 'react';
import { Mosaic, MosaicWindow, MosaicNode, MosaicBranch, getLeaves, createBalancedTreeFromLeaves } from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import { useParams, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import ThreeViewerPanel, { ThreeViewerPanelHandle } from '../components/ThreeViewerPanel';
import IGVPanel from '../components/IGVPanel';
import { Plus, Save, X, Share2, Copy, Check, FolderOpen, FilePlus } from 'lucide-react';
import { ViewerSidebar } from '../components/ViewerSidebar';
import { DropZone } from '../components/DropZone';
import { createSession } from '../api/sessions';
import { WorkspacesModal, SavedWorkspace } from '../components/WorkspacesModal';

export type ViewType = '3D Viewer' | 'IGV';

interface ViewState {
    type: ViewType;
    id: string;
    title: string;
    datasetId?: string;
    initialState?: any;
}

interface ViewerProps {
    initialState?: any;
    datasetIdProp?: string;
}

// Helper to update the tree at a specific path
function replaceNodeAtPath(root: MosaicNode<string>, path: MosaicBranch[], newNode: MosaicNode<string>): MosaicNode<string> {
    if (path.length === 0) {
        return newNode;
    }
    if (typeof root === 'string') {
        throw new Error('Path exists but root is a leaf');
    }
    
    const [branch, ...rest] = path;
    if (branch === 'first') {
        return { ...root, first: replaceNodeAtPath(root.first, rest, newNode) };
    } else {
        return { ...root, second: replaceNodeAtPath(root.second, rest, newNode) };
    }
}

export default function Viewer({ initialState: propInitialState, datasetIdProp }: ViewerProps) {
    const params = useParams();
    const location = useLocation();
    const { addToast } = useToast();
    const datasetId = datasetIdProp || params.datasetId;
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [dragType, setDragType] = useState<'view' | 'dataset' | null>(null);
    
    // Share State
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isWorkspacesModalOpen, setIsWorkspacesModalOpen] = useState(false);
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Map of view IDs to their configuration
    const [views, setViews] = useState<Record<string, ViewState>>({
        'main': { type: '3D Viewer', id: 'main', title: '3D Viewer', datasetId: datasetId }
    });

    // The layout tree
    const [layout, setLayout] = useState<MosaicNode<string> | null>('main');

    // Refs to child components for state extraction
    const viewRefs = useRef<Record<string, ThreeViewerPanelHandle | any>>({});

    // Load initial state
    useEffect(() => {
        const sessionData = location.state?.sessionData;
        
        if (sessionData) {
            if (sessionData.type === 'workspace') {
                // Restore full workspace
                if (sessionData.views && sessionData.layout) {
                    // Map viewStates back to views' initialState
                    const restoredViews = { ...sessionData.views };
                    if (sessionData.viewStates) {
                        Object.keys(restoredViews).forEach(id => {
                            if (sessionData.viewStates[id]) {
                                restoredViews[id].initialState = sessionData.viewStates[id];
                            }
                        });
                    }
                    setViews(restoredViews);
                    setLayout(sessionData.layout);
                }
            } else {
                // Legacy/Single view restore
                setViews({
                    'main': { 
                        type: '3D Viewer', 
                        id: 'main', 
                        title: '3D Viewer', 
                        datasetId: sessionData.datasetId,
                        initialState: sessionData
                    }
                });
                setLayout('main');
            }
        } else if (propInitialState) {
            // TODO: Restore complex layout from propInitialState
        } else if (datasetId) {
            try {
                const savedLayout = sessionStorage.getItem(`scope_layout_${datasetId}`);
                if (savedLayout) {
                    const parsed = JSON.parse(savedLayout);
                    if (parsed.layout && parsed.views) {
                        setViews(parsed.views);
                        setLayout(parsed.layout);
                    }
                }
            } catch (e) {
                console.error("Failed to restore layout", e);
            }
        }
    }, [datasetId, propInitialState, location.state]);

    // Track unsaved changes
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setHasUnsavedChanges(true);
    }, [layout, views]);

    const getWorkspaceData = () => {
        // Gather state from all active views
        const viewStates: Record<string, any> = {};
        Object.entries(viewRefs.current).forEach(([id, ref]) => {
            if (ref && ref.getState) {
                viewStates[id] = ref.getState();
            }
        });

        return {
            type: 'workspace' as const,
            datasetId, 
            layout,
            views,
            viewStates
        };
    };

    const handleLoadWorkspace = (workspace: SavedWorkspace) => {
        const data = workspace.data;
        if (data.layout && data.views) {
            // Restore view states
            const restoredViews = { ...data.views };
            if (data.viewStates) {
                Object.keys(restoredViews).forEach(id => {
                    if (data.viewStates[id]) {
                        restoredViews[id].initialState = data.viewStates[id];
                    }
                });
            }
            setViews(restoredViews);
            setLayout(data.layout);
            setCurrentWorkspaceId(workspace.id);
            setHasUnsavedChanges(false);
            addToast(`Workspace "${workspace.name}" loaded`, 'success');
        }
        setIsWorkspacesModalOpen(false);
    };

    const handleQuickSave = () => {
        if (currentWorkspaceId) {
            try {
                const saved = localStorage.getItem('scope_saved_workspaces');
                if (saved) {
                    const workspaces: SavedWorkspace[] = JSON.parse(saved);
                    const index = workspaces.findIndex(w => w.id === currentWorkspaceId);
                    if (index !== -1) {
                        const updatedWorkspace = {
                            ...workspaces[index],
                            timestamp: Date.now(),
                            data: getWorkspaceData()
                        };
                        workspaces[index] = updatedWorkspace;
                        localStorage.setItem('scope_saved_workspaces', JSON.stringify(workspaces));
                        setHasUnsavedChanges(false);
                        addToast(`Workspace "${updatedWorkspace.name}" updated`, 'success');
                        return;
                    }
                }
            } catch (e) {
                console.error("Failed to quick save", e);
            }
        }
        // Fallback to opening modal if no current workspace or save failed
        setIsWorkspacesModalOpen(true);
    };

    const resetWorkspace = () => {
        setViews({});
        setLayout(null);
        setCurrentWorkspaceId(null);
        setHasUnsavedChanges(false);
        addToast('New workspace created', 'success');
    };

    const handleNewWorkspace = () => {
        if (hasUnsavedChanges) {
            if (currentWorkspaceId) {
                // Existing workspace
                if (window.confirm("Do you want to save changes to the current workspace before creating a new one?")) {
                    handleQuickSave(); // Sync save
                    resetWorkspace();
                } else if (window.confirm("Are you sure you want to discard changes?")) {
                    resetWorkspace();
                }
            } else {
                // New/Untitled workspace
                if (window.confirm("Do you want to save this workspace before creating a new one?")) {
                    setIsWorkspacesModalOpen(true);
                    // We can't easily chain resetWorkspace here because modal is async/detached.
                    return; 
                } else if (window.confirm("Are you sure you want to discard changes?")) {
                    resetWorkspace();
                }
            }
        } else {
            resetWorkspace();
        }
    };

    const handleShareWorkspace = async () => {
        // If already open, just close
        if (isShareOpen) {
            setIsShareOpen(false);
            setShareUrl(null);
            setIsCopied(false);
            return;
        }

        const sessionData = getWorkspaceData();

        try {
            const session = await createSession(sessionData);
            const url = `${window.location.origin}/s/${session.id}`;
            setShareUrl(url);
            setIsShareOpen(true);
            
            await navigator.clipboard.writeText(url);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
            addToast('Workspace link copied to clipboard', 'success');
        } catch (e) {
            console.error(e);
            addToast('Failed to create share link', 'error');
        }
    };

    const copyToClipboard = async () => {
        if (shareUrl) {
            await navigator.clipboard.writeText(shareUrl);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
            addToast('Link copied to clipboard', 'success');
        }
    };

    const addView = (type: ViewType) => {
        const id = `${type.toLowerCase().replace(' ', '-')}-${Date.now()}`;
        const newView: ViewState = { type, id, title: type, datasetId: datasetId };

        setViews(prev => ({ ...prev, [id]: newView }));

        setLayout(current => {
            if (!current) return id;
            
            // Add to the top-right by default
            return {
                direction: 'row',
                first: current,
                second: id,
                splitPercentage: 70
            };
        });
    };

    const removeView = (id: string) => {
        setLayout(current => {
            if (!current) return null;
            const leaves = getLeaves(current);
            if (leaves.length === 1 && leaves[0] === id) {
                return null;
            }
            const newLeaves = leaves.filter(leaf => leaf !== id);
            return createBalancedTreeFromLeaves(newLeaves);
        });
        setViews(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const handleDrop = (e: React.DragEvent, viewId?: string, path?: MosaicBranch[]) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Viewer handleDrop', { viewId, path });
        const json = e.dataTransfer.getData('application/json');
        console.log('Drop JSON:', json);

        if (!json) return;

        try {
            const data = JSON.parse(json);
            console.log('Parsed Drop Data:', data);

            // Handle New View Drop (Split)
            if (data.type === 'new-view') {
                const newViewType = data.viewType as ViewType;
                const newId = `${newViewType.toLowerCase().replace(' ', '-')}-${Date.now()}`;
                const newView: ViewState = { type: newViewType, id: newId, title: newViewType, datasetId: datasetId };

                setViews(prev => ({ ...prev, [newId]: newView }));

                // If dropped on empty state
                if (!viewId || !path) {
                    setLayout(newId);
                    return;
                }

                // Determine split direction based on drop position
                const rect = e.currentTarget.getBoundingClientRect();
                console.log('Drop Rect:', rect);
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                console.log('Drop Coords:', { x, y, width: rect.width, height: rect.height });
                
                const width = rect.width;
                const height = rect.height;

                // Default to splitting to the right
                let direction: 'row' | 'column' = 'row';
                let first: string = viewId;
                let second: string = newId;

                // Simple edge detection (25% threshold)
                if (x > width * 0.75) {
                    direction = 'row';
                    first = viewId;
                    second = newId;
                } else if (x < width * 0.25) {
                    direction = 'row';
                    first = newId;
                    second = viewId;
                } else if (y > height * 0.75) {
                    direction = 'column';
                    first = viewId;
                    second = newId;
                } else if (y < height * 0.25) {
                    direction = 'column';
                    first = newId;
                    second = viewId;
                }

                setLayout(current => {
                    if (!current) return newId;
                    const newNode: MosaicNode<string> = {
                        direction,
                        first,
                        second,
                    };
                    console.log('Updating Layout:', { current, path, newNode });
                    const result = replaceNodeAtPath(current, path, newNode);
                    console.log('New Layout:', result);
                    return result;
                });
                return;
            }

            // Handle Dataset Drop (Existing Logic)
            const { datasetId: droppedDatasetId, name } = data;
            if (droppedDatasetId) {
                if (viewId) {
                    setViews(prev => ({
                        ...prev,
                        [viewId]: {
                            ...prev[viewId],
                            datasetId: droppedDatasetId,
                            title: name || prev[viewId].title,
                            initialState: undefined
                        }
                    }));
                    addToast(`Loaded dataset: ${name}`, 'success');
                } else {
                    // Dropped on empty state - create new 3D viewer
                    const newId = `3d-viewer-${Date.now()}`;
                    const newView: ViewState = { type: '3D Viewer', id: newId, title: name || '3D Viewer', datasetId: droppedDatasetId };
                    setViews(prev => ({ ...prev, [newId]: newView }));
                    setLayout(newId);
                    addToast(`Loaded dataset: ${name}`, 'success');
                }
            }
        } catch (err) {
            console.error('Failed to parse drop data', err);
        }
    };

    const renderTile = (id: string, path: MosaicBranch[]) => {
        const view = views[id];
        if (!view) return <div className="h-full w-full bg-red-900 flex items-center justify-center">Error: View not found</div>;

        return (
            <MosaicWindow<string>
                path={path}
                title={view.title}
                toolbarControls={[
                    <button 
                        key="close" 
                        onClick={() => removeView(id)}
                        className="p-1 hover:bg-red-600 hover:text-white rounded transition-colors text-gray-500"
                        title="Close View"
                    >
                        <X size={18} />
                    </button>
                ]}
            >
                <DropZone 
                    onDrop={(e) => handleDrop(e, id, path)}
                    dragType={dragType}
                >
                    {view.type === '3D Viewer' && (
                        <ThreeViewerPanel
                            ref={(el) => {
                                if (el) viewRefs.current[id] = el;
                                else delete viewRefs.current[id];
                            }}
                            datasetId={view.datasetId || datasetId || ''}
                            instanceId={id}
                            initialState={view.initialState}
                            onStateChange={() => setHasUnsavedChanges(true)}
                        />
                    )}
                    {view.type === 'IGV' && (
                        <IGVPanel datasetId={view.datasetId || datasetId || ''} />
                    )}
                </DropZone>
            </MosaicWindow>
        );
    };

    return (
        <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden">
            <ViewerSidebar 
                currentDatasetId={datasetId} 
                isOpen={isSidebarOpen} 
                onToggle={setIsSidebarOpen}
                onDragStart={() => setDragType('dataset')}
                onDragEnd={() => setDragType(null)}
            />
            
            {/* Toolbar */}
            <div className={`h-12 border-b border-gray-800 flex items-center px-4 gap-4 bg-gray-900 z-50 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
                <span className="font-bold text-lg mr-4">SCope</span>
                
                <div className="flex items-center gap-2">
                    <div 
                        draggable={true}
                        onDragStart={(e) => {
                            e.stopPropagation();
                            setDragType('view');
                            console.log('Drag Start: 3D Viewer');
                            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'new-view', viewType: '3D Viewer' }));
                            e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onDragEnd={() => setDragType(null)}
                        onClick={() => addView('3D Viewer')}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors cursor-grab active:cursor-grabbing select-none"
                    >
                        <Plus size={16} /> 3D Viewer
                    </div>
                    <div 
                        draggable={true}
                        onDragStart={(e) => {
                            e.stopPropagation();
                            setDragType('view');
                            console.log('Drag Start: IGV');
                            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'new-view', viewType: 'IGV' }));
                            e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onDragEnd={() => setDragType(null)}
                        onClick={() => addView('IGV')}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors cursor-grab active:cursor-grabbing select-none"
                    >
                        <Plus size={16} /> IGV
                    </div>
                </div>

                <div className="flex-1" />

                <button 
                    onClick={handleNewWorkspace}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
                    title="Create New Workspace"
                >
                    <FilePlus size={16} /> New
                </button>

                <button 
                    onClick={() => setIsWorkspacesModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
                >
                    <FolderOpen size={16} /> Workspaces
                </button>

                <div 
                    className={`flex items-center bg-gray-800 rounded transition-all duration-300 overflow-hidden ${isShareOpen ? 'w-80' : 'w-auto'}`}
                    onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                            setIsShareOpen(false);
                        }
                    }}
                >
                    <button 
                        onClick={handleShareWorkspace}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors flex-shrink-0 ${isShareOpen ? 'bg-gray-700 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                    >
                        <Share2 size={16} /> {isShareOpen ? '' : 'Share Workspace'}
                    </button>
                    {isShareOpen && shareUrl && (
                        <div className="flex items-center flex-1 pr-1 min-w-0 ml-2">
                            <input 
                                type="text" 
                                readOnly 
                                value={shareUrl} 
                                className="bg-gray-900 text-gray-300 text-xs px-2 py-1 rounded border border-gray-700 flex-1 min-w-0 mr-1 focus:outline-none"
                                onClick={(e) => e.currentTarget.select()}
                                autoFocus
                            />
                            <button 
                                onClick={copyToClipboard}
                                className="text-gray-400 hover:text-white p-1"
                                title="Copy to clipboard"
                            >
                                {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                        </div>
                    )}
                </div>

                <button 
                    onClick={handleQuickSave}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors"
                    title={currentWorkspaceId ? "Update current workspace" : "Save as new workspace"}
                >
                    <Save size={16} /> {currentWorkspaceId ? 'Save' : 'Save Workspace'}
                </button>
            </div>

            {/* Mosaic Layout */}
            <div className={`flex-1 relative transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
                <Mosaic<string>
                    renderTile={renderTile}
                    value={layout}
                    onChange={setLayout}
                    className="mosaic-blueprint-theme"
                    zeroStateView={
                        <DropZone onDrop={(e) => handleDrop(e)} className="h-full flex items-center justify-center text-gray-500">
                            No active views. Add one from the toolbar or drop here.
                        </DropZone>
                    }
                />
            </div>
            {/* Workspaces Modal */}
            <WorkspacesModal 
                isOpen={isWorkspacesModalOpen}
                onClose={() => setIsWorkspacesModalOpen(false)}
                onLoad={handleLoadWorkspace}
                onSave={(ws) => setCurrentWorkspaceId(ws.id)}
                getWorkspaceData={getWorkspaceData}
            />
        </div>
    );
}