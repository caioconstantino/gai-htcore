import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem("gai:token", token);
        set({ token, user });
      },
      logout: () => {
        localStorage.removeItem("gai:token");
        set({ token: null, user: null });
      },
    }),
    { name: "gai:auth" }
  )
);
