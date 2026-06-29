import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId?: string;
  permissions?: string[];
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  _hasHydrated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      _hasHydrated: false,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      hasPermission: (permission: string) => {
        const user = get().user;
        if (!user) return false;
        if (user.role === "super_admin") return true;
        const perms = user.permissions ?? [];
        return perms.includes("*") || perms.includes(permission);
      },
    }),
    {
      name: "gai:auth",
      // Don't persist the hydration flag itself
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
