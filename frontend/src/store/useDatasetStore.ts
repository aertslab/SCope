import { create } from 'zustand';
import api from '../api/client';
import { Dataset } from '../types';
import HashWorker from '../utils/hashWorker?worker';
import type { HashWorkerMessage } from '../utils/hashWorker';

interface DatasetState {
  datasets: Dataset[];
  isLoading: boolean;
  fetchDatasets: () => Promise<void>;
  uploadDataset: (name: string, description: string, fileType: string, file: File, onProgress?: (progress: number, status: string) => void) => Promise<void>;
  replaceDatasetFile: (id: string, file: File, fileType?: string, onProgress?: (progress: number, status: string) => void) => Promise<void>;
  deleteDataset: (id: string) => Promise<void>;
}

const calculateHash = (file: File, onProgress?: (progress: number) => void): Promise<string> =>
    new Promise((resolve, reject) => {
        const worker = new HashWorker();
        worker.onmessage = (event: MessageEvent<HashWorkerMessage>) => {
            const msg = event.data;
            if (msg.type === 'progress') {
                onProgress?.(msg.progress);
            } else if (msg.type === 'done') {
                worker.terminate();
                resolve(msg.hash);
            } else if (msg.type === 'error') {
                worker.terminate();
                reject(new Error(msg.message));
            }
        };
        worker.onerror = (err) => {
            worker.terminate();
            reject(err);
        };
        worker.postMessage({ file });
    });

export const useDatasetStore = create<DatasetState>((set, get) => ({
  datasets: [],
  isLoading: false,
  fetchDatasets: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/datasets/');
      set({ datasets: response.data });
    } catch (error) {
      console.error('Failed to fetch datasets', error);
    } finally {
      set({ isLoading: false });
    }
  },
  deleteDataset: async (id: string) => {
      await api.delete(`/datasets/${id}`);
      set((state) => ({
          datasets: state.datasets.filter((d) => d.id.toString() !== id)
      }));
  },
  uploadDataset: async (name, description, fileType, file, onProgress) => {
    // 1. Calculate Hash
    if (onProgress) onProgress(0, 'hashing');
    const hash = await calculateHash(file, (p) => {
        if (onProgress) onProgress(p, 'hashing');
    });

    // 2. Check Hash
    if (onProgress) onProgress(100, 'checking');
    const hashFormData = new FormData();
    hashFormData.append('hash', hash);
    const checkRes = await api.post('/datasets/check_hash', hashFormData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        }
    });
    const exists = checkRes.data.exists;

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('file_type', fileType);
    formData.append('file_hash', hash);

    if (exists) {
        // 3a. Link to existing
        if (onProgress) onProgress(100, 'linking');
        await api.post('/datasets/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        });
    } else {
        // 3b. Upload new
        if (onProgress) onProgress(0, 'uploading');
        formData.append('file', file);
        await api.post('/datasets/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total && onProgress) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted, 'uploading');
                }
            },
        });
    }
    
    // Refresh list
    await get().fetchDatasets();
  },
  replaceDatasetFile: async (id, file, fileType, onProgress) => {
    // Mirrors uploadDataset but targets POST /datasets/{id}/replace, which
    // rebinds the dataset row to a new (or already-known-by-hash) DataFile
    // and re-triggers conversion. Shares, projects, and the dataset id are
    // preserved. We still hash client-side so the server can short-circuit
    // when the bytes are already on disk.
    if (onProgress) onProgress(0, 'hashing');
    const hash = await calculateHash(file, (p) => {
      if (onProgress) onProgress(p, 'hashing');
    });

    const formData = new FormData();
    formData.append('file_hash', hash);
    if (fileType) formData.append('file_type', fileType);
    formData.append('file', file);

    if (onProgress) onProgress(0, 'uploading');
    await api.post(`/datasets/${id}/replace`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(pct, 'uploading');
        }
      },
    });

    await get().fetchDatasets();
  },
}));
