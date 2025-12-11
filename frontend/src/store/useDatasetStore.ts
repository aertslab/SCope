import { create } from 'zustand';
import api from '../api/client';
import { Dataset } from '../types';
import SparkMD5 from 'spark-md5';

interface DatasetState {
  datasets: Dataset[];
  isLoading: boolean;
  fetchDatasets: () => Promise<void>;
  uploadDataset: (name: string, description: string, fileType: string, file: File, onProgress?: (progress: number, status: string) => void) => Promise<void>;
  deleteDataset: (id: string) => Promise<void>;
}

const calculateHash = (file: File, onProgress?: (progress: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
        const chunkSize = 2097152; // 2MB
        const chunks = Math.ceil(file.size / chunkSize);
        let currentChunk = 0;
        const spark = new SparkMD5.ArrayBuffer();
        const fileReader = new FileReader();

        fileReader.onload = function (e) {
            if (e.target?.result) {
                spark.append(e.target.result as ArrayBuffer);
                currentChunk++;

                if (onProgress) {
                    onProgress(Math.round((currentChunk / chunks) * 100));
                }

                if (currentChunk < chunks) {
                    loadNext();
                } else {
                    resolve(spark.end());
                }
            }
        };

        fileReader.onerror = function () {
            reject('Hash calculation failed');
        };

        function loadNext() {
            const start = currentChunk * chunkSize;
            const end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;
            fileReader.readAsArrayBuffer(file.slice(start, end));
        }

        loadNext();
    });
};

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
}));
