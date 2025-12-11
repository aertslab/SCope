import { create } from 'zustand';
import api from '../api/client';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<boolean>;
  setToken: (token: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set: any) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  setToken: async (token: string): Promise<boolean> => {
    localStorage.setItem('token', token);
    set({ token, isAuthenticated: true });
    return await useAuthStore.getState().fetchUser();
  },
  login: async (email, password) => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await api.post('/login/access-token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const { access_token } = response.data;
    localStorage.setItem('token', access_token);
    set({ token: access_token, isAuthenticated: true });
    await useAuthStore.getState().fetchUser();
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },
  fetchUser: async () => {
    try {
      const response = await api.get('/users/me');
      set({ user: response.data });
      return true;
    } catch (error) {
      set({ user: null, token: null, isAuthenticated: false });
      localStorage.removeItem('token');
      return false;
    }
  },
}));
