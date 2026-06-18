import { create } from 'zustand';
import api from '../api/client';
import { Dataset } from '../types';
import HashWorker from '../utils/hashWorker?worker';
import type { HashWorkerMessage } from '../utils/hashWorker';

export interface DatasetQuery {
  search?: string;
  status?: string;
  sort_by?: 'name' | 'created_at' | 'file_size' | 'status';
  sort_order?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}

interface DatasetState {
  datasets: Dataset[];
  total: number;
  lastQuery: DatasetQuery;
  isLoading: boolean;
  fetchDatasets: (params?: DatasetQuery) => Promise<void>;
  uploadDataset: (name: string, description: string, fileType: string, file: File, onProgress?: (progress: number, status: string) => void) => Promise<Dataset>;
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
        worker.onerror = (err: ErrorEvent) => {
            worker.terminate();
            reject(err);
        };
        worker.postMessage({ file });
    });

export const useDatasetStore = create<DatasetState>((set, get) => ({
  datasets: [],
  total: 0,
  lastQuery: {},
  isLoading: false,
  fetchDatasets: async (params?: DatasetQuery) => {
    // Merge with the last query so refreshes after mutations preserve the
    // user's current search/filter/sort/page.
    const query = params ? { ...get().lastQuery, ...params } : get().lastQuery;
    set({ isLoading: true, lastQuery: query });
    try {
      const response = await api.get('/datasets/', { params: query });
      const data = response.data;
      // New paginated envelope {items,total}; tolerate a legacy bare array.
      if (Array.isArray(data)) {
        set({ datasets: data, total: data.length });
      } else {
        set({ datasets: data.items ?? [], total: data.total ?? 0 });
      }
    } catch (error) {
      console.error('Failed to fetch datasets', error);
    } finally {
      set({ isLoading: false });
    }
  },
  deleteDataset: async (id: string) => {
      await api.delete(`/datasets/${id}`);
      set((state) => ({
          datasets: state.datasets.filter((d) => d.id.toString() !== id),
          total: Math.max(0, state.total - 1),
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

    // Metadata travels as query params; the body is the raw file. This streams
    // the file straight to disk on the server (constant memory, no multipart
    // temp-spool / double-write), so 100 GB+ uploads are viable. The browser
    // streams the File from disk via XHR — it isn't loaded into JS memory.
    const params = { name, description, file_type: fileType, file_hash: hash };

    let created: Dataset;
    if (exists) {
        // 3a. Link to existing — no body needed.
        if (onProgress) onProgress(100, 'linking');
        const res = await api.post<Dataset>('/datasets/', null, { params });
        created = res.data;
    } else {
        // 3b. Upload new — stream the raw file as the request body.
        if (onProgress) onProgress(0, 'uploading');
        const res = await api.post<Dataset>('/datasets/', file, {
            params,
            headers: { 'Content-Type': 'application/octet-stream' },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total && onProgress) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted, 'uploading');
                }
            },
        });
        created = res.data;
    }

    // Refresh list
    await get().fetchDatasets();
    // Returned so callers can act on the new dataset (e.g. attach it to a
    // project chosen in the upload modal).
    return created;
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
