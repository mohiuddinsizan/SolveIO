import { create } from "zustand";
import api from "../lib/api";

const safeParse = (v) => { try { return JSON.parse(v ?? "null"); } catch { return null; } };

export const useAuth = create((set) => ({
  user: safeParse(localStorage.getItem("user")),
  token: localStorage.getItem("token") || null,

  setAuth: ({ token, user }) => {
    if (!token || !user) throw new Error("Malformed auth payload (missing token/user)");
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ token, user });
    return user;
  },

  login: async (identifier, password) => {
    const body = { identifier, email: identifier, username: identifier, password };
    const { data } = await api.post("/auth/login", body);
    // Support token key variants
    const token = data.token || data.accessToken || data.jwt;
    const user  = data.user  || data.profile;
    return useAuth.getState().setAuth({ token, user });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ token: null, user: null });
  },

  refreshMe: async () => {
    const token = localStorage.getItem("token");
    if (!token) { set({ user: null, token: null }); return null; }
    try {
      const { data } = await api.get("/me/profile");
      localStorage.setItem("user", JSON.stringify(data.user));
      set({ user: data.user, token });
      return data.user;
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      set({ token: null, user: null });
      return null;
    }
  },
}));
