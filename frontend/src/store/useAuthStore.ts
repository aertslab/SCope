import { create } from 'zustand';
import api from '../api/client';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** True once `fetchUser` has run at least once after app load. */
  bootstrapped: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<boolean>;
  /** Backwards-compat shim: OAuth callbacks still call this; we just refresh the user. */
  setToken: (token?: string | null) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set: any) => ({
  user: null,
  isAuthenticated: false,
  bootstrapped: false,
  setToken: async (_token?: string | null): Promise<boolean> => {
    // Auth is now driven exclusively by the HttpOnly cookie. The OAuth
    // callback flow already had the cookie set by the backend redirect;
    // we just refresh the user-state from /users/me.
    return await useAuthStore.getState().fetchUser();
  },
  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    // Backend sets the HttpOnly auth cookie on this response.
    await api.post('/login/access-token', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    set({ isAuthenticated: true });
    await useAuthStore.getState().fetchUser();
  },
  logout: async () => {
    try {
      await api.post('/logout');
    } catch { /* best-effort; clear client state anyway */ }
    set({ user: null, isAuthenticated: false });
  },
  fetchUser: async () => {
    try {
      const response = await api.get('/users/me');
      set({ user: response.data, isAuthenticated: true, bootstrapped: true });
      return true;
    } catch {
      set({ user: null, isAuthenticated: false, bootstrapped: true });
      return false;
    }
  },
}));
