import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    // Read token from zustand persist storage (gai:auth) — do NOT rely on the
    // legacy "gai:token" key that was removed during the hydration fix.
    try {
      const raw = localStorage.getItem("gai:auth");
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { token?: string } };
        const token = parsed?.state?.token;
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // ignore parse errors
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      // Clear persisted auth and redirect to login
      localStorage.removeItem("gai:auth");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);
