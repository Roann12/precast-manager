// File overview: Authentication state and auth-related helpers for auth/AuthContext.tsx.
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

// Inputs: caller state/arguments related to auth provider.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Source of truth for "am I signed in?" before /auth/me is fetched.
  const [tokenPresent, setTokenPresent] = useState(() => !!localStorage.getItem("access_token"));

  const meQuery = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    // Pulls current user profile from JWT-backed session.
    queryFn: async () => (await api.get<AuthUser>("/auth/me")).data,
    enabled: tokenPresent,
    retry: false,
    staleTime: 60_000,
  });

  // If no token exists, treat user as logged out without querying.
  const user = tokenPresent ? (meQuery.data ?? null) : null;
  const loading = tokenPresent && !meQuery.isFetched;

  useEffect(() => {
    // Global 401 handler keeps auth cleanup consistent across all API calls.
    setUnauthorizedHandler((message) => {
      localStorage.removeItem("access_token");
      qc.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
      setTokenPresent(false);
      const trimmed = message?.trim();
      // /auth/me returns this for expired or invalid JWTs; show a user-facing message instead.
      const sessionMessage =
        !trimmed || trimmed === "Could not validate credentials"
          ? "Your session has expired or you were signed out. Please sign in again."
          : trimmed;
      navigate("/login", {
        replace: true,
        state: { sessionMessage },
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, qc]);

  useEffect(() => {
    // Non-401 /auth/me failures are treated as invalid local auth state.
    if (!meQuery.isError || !meQuery.error) return;
    if (axios.isAxiosError(meQuery.error) && meQuery.error.response?.status === 401) return;
    localStorage.removeItem("access_token");
    qc.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
    setTokenPresent(false);
  }, [meQuery.isError, meQuery.error, qc]);

  const logout = useCallback(() => {
    // Clear both persistent token and cached user data.
    localStorage.removeItem("access_token");
    setTokenPresent(false);
    qc.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
  }, [qc]);

  const login = useCallback(
    async (email: string, password: string) => {
      // Backend expects OAuth-style form fields, not JSON body.
      const form = new URLSearchParams();
      form.append("username", email);
      form.append("password", password);
      form.append("grant_type", "password");

      const res = await api.post<{ access_token: string; token_type: string; user: AuthUser }>(
        "/auth/token",
        form,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      // Save token for future requests and prime cache with the returned user.
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

// Hook that manages auth state and behavior.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
