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
    // CHUNKED + RESUMABLE upload. The file is sent as a sequence of short PATCH
    // requests rather than one long stream, so a dropped connection (or an
    // intermediary's idle/duration cap) resumes from the server's last offset
    // instead of restarting. The simple single-shot `POST /datasets/` (curl -T)
    // path still exists for CLI users; the browser uses this for robustness.
    const CHUNK_SIZE = 32 * 1024 * 1024; // 32 MiB per request
    const MAX_RETRIES = 6;

    // 1. Hash off the main thread (also the de-dup key + .part file identity).
    if (onProgress) onProgress(0, 'hashing');
    const hash = await calculateHash(file, (p) => onProgress?.(p, 'hashing'));

    // 2. Init: server de-dups (links instantly if the bytes already exist) or
    //    returns an upload id + the offset to resume from (>0 if a prior attempt
    //    at the same file left a partial .part on disk).
    if (onProgress) onProgress(0, 'starting');
    const initRes = await api.post('/datasets/upload/init', null, {
        params: { name, description, file_type: fileType, file_hash: hash, total_size: file.size },
    });

    let created: Dataset;
    if (initRes.data.deduped) {
        if (onProgress) onProgress(100, 'linking');
        created = initRes.data.dataset as Dataset;
    } else {
        const uploadId: string = initRes.data.upload_id;
        let offset: number = initRes.data.offset || 0;
        if (onProgress) onProgress(file.size ? Math.round((offset * 100) / file.size) : 0, 'uploading');

        // 3. Append chunks until the whole file is on the server. On a transient
        //    failure, re-sync to the server's authoritative offset and retry.
        let attempts = 0;
        while (offset < file.size) {
            const chunkStart = offset;
            const blob = file.slice(chunkStart, Math.min(chunkStart + CHUNK_SIZE, file.size));
            try {
                const patchRes = await api.patch(`/datasets/upload/${uploadId}`, blob, {
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Upload-Offset': String(chunkStart),
                    },
                    onUploadProgress: (e) => {
                        if (onProgress && file.size) {
                            const sent = chunkStart + (e.loaded || 0);
                            onProgress(Math.min(100, Math.round((sent * 100) / file.size)), 'uploading');
                        }
                    },
                });
                offset = patchRes.data.offset;
                attempts = 0;
            } catch (err: any) {
                const status = err?.response?.status;
                // 409 = offset out of sync → re-sync and retry. Other 4xx (auth,
                // validation) are fatal — don't spin. 5xx / network drops are
                // transient → retry with backoff.
                if (status && status !== 409 && status < 500) throw err;
                attempts += 1;
                if (attempts > MAX_RETRIES) throw err;
                const serverOffset = err?.response?.data?.detail?.offset;
                if (typeof serverOffset === 'number') {
                    offset = serverOffset;
                } else {
                    try {
                        const st = await api.get(`/datasets/upload/${uploadId}`);
                        offset = st.data.offset;
                    } catch { /* keep current offset and retry */ }
                }
                await new Promise((r) => setTimeout(r, 1000 * attempts));
            }
        }

        // 4. Finalize: server verifies the size, moves the .part into place, and
        //    creates the DataFile + Dataset (same path as the single-shot upload).
        if (onProgress) onProgress(100, 'finalizing');
        const completeRes = await api.post<Dataset>(`/datasets/upload/${uploadId}/complete`);
        created = completeRes.data;
    }

    // Refresh list. Returned so callers can act on the new dataset (e.g. attach
    // it to a project chosen in the upload modal).
    await get().fetchDatasets();
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
