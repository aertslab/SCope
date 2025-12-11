import { create } from 'zustand';
import api from '../api/client';
import { Project } from '../types';

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  fetchProjects: () => Promise<void>;
  createProject: (data: { name: string; description: string; visibility: string; password?: string }) => Promise<void>;
  attachProject: (projectId: string) => Promise<void>;
  detachProject: (projectId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  isLoading: false,
  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/projects/');
      set({ projects: response.data });
    } catch (error) {
      console.error('Failed to fetch projects', error);
    } finally {
      set({ isLoading: false });
    }
  },
  createProject: async (data) => {
      await api.post('/projects/', data);
      await get().fetchProjects();
  },
  attachProject: async (projectId) => {
      await api.post(`/projects/${projectId}/attach`);
      await get().fetchProjects();
  },
  detachProject: async (projectId) => {
      await api.delete(`/projects/${projectId}/attach`);
      await get().fetchProjects();
  }
}));
