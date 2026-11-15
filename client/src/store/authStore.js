import { create } from "zustand";
import { getApiErrorMessage, http } from "../api/http.js";

export const useAuthStore = create((set, get) => ({
  user: null,
  isLoading: true,
  initialized: false,
  error: null,

  initialize: async (force = false) => {
    if (get().initialized && !force) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await http.get("/api/auth/me");
      set({
        user: response.data.data.user,
        error: null,
        initialized: true,
      });
    } catch (error) {
      if (error.response?.status === 401) {
        set({ user: null, error: null, initialized: true });
      } else {
        set({
          user: null,
          error: getApiErrorMessage(error),
          initialized: true,
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (credentials) => {
    const response = await http.post("/api/auth/login", credentials);
    const user = response.data.data.user;
    set({ user, error: null, initialized: true });
    return user;
  },

  register: async (details) => {
    const response = await http.post("/api/auth/register", details);
    const user = response.data.data.user;
    set({ user, error: null, initialized: true });
    return user;
  },

  updateProfile: async (profile) => {
    const response = await http.patch("/api/users/me", profile);
    const user = response.data.data.user;
    set({ user });
    return user;
  },

  logout: async () => {
    await http.post("/api/auth/logout");
    set({ user: null, error: null, initialized: true });
  },
}));
