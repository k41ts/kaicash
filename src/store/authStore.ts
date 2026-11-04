import { create } from 'zustand';
import { User } from 'firebase/auth';
import { UserProfile } from '../types';

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  selectedChildId: string | null;
  setUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (isLoading: boolean) => void;
  setSelectedChildId: (childId: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userProfile: null,
  isLoading: true, // Initially true while checking auth state
  selectedChildId: null,
  setUser: (user) => set({ user }),
  setUserProfile: (profile) => set({ userProfile: profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setSelectedChildId: (childId) => set({ selectedChildId: childId }),
}));
