import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import api from "../api/client";
import { setUnauthorizedHandler } from "../api/unauthorized";
import { AUTH_ME_QUERY_KEY } from "./authQueryKeys";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  factory_id: number | null;
  must_change_password?: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tokenPresent, setTokenPresent] = useState(() => !!localStorage.getItem("access_token"));

  const meQuery = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: async () => (await api.get<AuthUser>("/auth/me")).data,
    enabled: tokenPresent,
    retry: false,
    staleTime: 60_000,
  });

  const user = tokenPresent ? (meQuery.data ?? null) : null;
  const loading = tokenPresent && !meQuery.isFetched;

  useEffect(() => {
    setUnauthorizedHandler((message) => {
      localStorage.removeItem("access_token");
      qc.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
      setTokenPresent(false);
      navigate("/login", {
        replace: true,
        state: {
          sessionMessage:
            message?.trim() ||
            "Your session has expired or you were signed out. Please sign in again.",
        },
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, qc]);

  useEffect(() => {
    if (!meQuery.isError || !meQuery.error) return;
    if (axios.isAxiosError(meQuery.error) && meQuery.error.response?.status === 401) return;
    localStorage.removeItem("access_token");
    qc.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
    setTokenPresent(false);
  }, [meQuery.isError, meQuery.error, qc]);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setTokenPresent(false);
    qc.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
  }, [qc]);

  const login = useCallback(
    async (email: string, password: string) => {
      const form = new URLSearchParams();
      form.append("username", email);
      form.append("password", password);
      form.append("grant_type", "password");

      const res = await api.post<{ access_token: string; token_type: string; user: AuthUser }>(
        "/auth/token",
        form,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      localStorage.setItem("access_token", res.data.access_token);
      setTokenPresent(true);
      qc.setQueryData(AUTH_ME_QUERY_KEY, res.data.user);
      return res.data.user;
    },
    [qc]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      logout,
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
