import { useState, useEffect } from 'react';
import { X, Save, Trash2, FolderOpen, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface WorkspaceData {
    type: 'workspace';
    datasetId?: string;
    layout: any;
    views: any;
    viewStates: any;
}

export interface SavedWorkspace {
    id: string;
    name: string;
    timestamp: number;
    data: WorkspaceData;
}

interface WorkspacesModalProps {
    isOpen: boolean;
    onClose: () => void;
    getWorkspaceData: () => WorkspaceData;
    onLoad: (workspace: SavedWorkspace) => void;
    onSave: (workspace: SavedWorkspace) => void;
}

export function WorkspacesModal({ isOpen, onClose, getWorkspaceData, onLoad, onSave }: WorkspacesModalProps) {
    const [workspaces, setWorkspaces] = useState<SavedWorkspace[]>([]);
    const [newName, setNewName] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadWorkspaces();
            setNewName('');
            setError(null);
        }
    }, [isOpen]);

    const loadWorkspaces = () => {
        try {
            const saved = localStorage.getItem('scope_saved_workspaces');
            if (saved) {
                setWorkspaces(JSON.parse(saved).sort((a: SavedWorkspace, b: SavedWorkspace) => b.timestamp - a.timestamp));
            }
        } catch (e) {
            console.error("Failed to load workspaces", e);
        }
    };

    const saveWorkspace = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        try {
            const newWorkspace: SavedWorkspace = {
                id: Date.now().toString(),
                name: newName.trim(),
                timestamp: Date.now(),
                data: getWorkspaceData()
            };

            const updated = [newWorkspace, ...workspaces];
            localStorage.setItem('scope_saved_workspaces', JSON.stringify(updated));
            setWorkspaces(updated);
            setNewName('');
            onSave(newWorkspace);
            onClose();
        } catch (e) {
            console.error("Failed to save workspace", e);
            setError("Failed to save workspace (Storage full?)");
        }
    };

    const deleteWorkspace = (id: string) => {
        const updated = workspaces.filter(w => w.id !== id);
        localStorage.setItem('scope_saved_workspaces', JSON.stringify(updated));
        setWorkspaces(updated);
    };

    const handleLoad = (workspace: SavedWorkspace) => {
        onLoad(workspace);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <FolderOpen size={24} className="text-blue-500" />
                        Workspaces
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-800 bg-gray-800/50">
                    <form onSubmit={saveWorkspace} className="flex gap-2">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Save current workspace as..."
                            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                        />
                        <button 
                            type="submit"
                            disabled={!newName.trim()}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <Save size={16} /> Save
                        </button>
                    </form>
                    {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {workspaces.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            No saved workspaces found.
                        </div>
                    ) : (
                        workspaces.map(ws => (
                            <div key={ws.id} className="bg-gray-800 hover:bg-gray-750 rounded p-3 flex items-center justify-between group transition-colors border border-transparent hover:border-gray-700">
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoad(ws)}>
                                    <h3 className="text-white font-medium truncate">{ws.name}</h3>
                                    <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {formatDistanceToNow(ws.timestamp, { addSuffix: true })}
                                        </span>
                                        <span>
                                            {Object.keys(ws.data.views || {}).length} views
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <button 
                                        onClick={() => handleLoad(ws)}
                                        className="text-blue-400 hover:text-blue-300 p-2 rounded hover:bg-blue-900/30 transition-colors"
                                        title="Load Workspace"
                                    >
                                        <FolderOpen size={18} />
                                    </button>
                                    <button 
                                        onClick={() => deleteWorkspace(ws.id)}
                                        className="text-gray-500 hover:text-red-400 p-2 rounded hover:bg-red-900/30 transition-colors"
                                        title="Delete Workspace"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
