import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  timezone?: string;
  avatar_path?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      isAuthenticated: false,
      user: null,
      token: null,

      login: (token: string, user: User) => {
        set({ isAuthenticated: true, user, token });
      },

      logout: () => {
        set({ isAuthenticated: false, user: null, token: null });
      },

      updateUser: (partial: Partial<User>) => {
        set(state => ({
          user: state.user ? { ...state.user, ...partial } : null,
        }));
      },
    }),
    { name: 'auth-storage' }
  )
);
