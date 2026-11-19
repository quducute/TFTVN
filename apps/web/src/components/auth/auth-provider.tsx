"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api-client";
import type { PublicUser } from "@/server/auth/types";

type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthContextValue {
  user: PublicUser | null;
  status: AuthStatus;
  setUser: (user: PublicUser | null) => void;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUserState] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const setUser = useCallback((next: PublicUser | null) => {
    setUserState(next);
    setStatus(next ? "authenticated" : "guest");
  }, []);

  const reload = useCallback(async () => {
    try {
      const response = await api.get<{ user: PublicUser | null }>("/auth/session");
      setUser(response.data.user);
    } catch {
      setUser(null);
    }
  }, [setUser]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    let active = true;
    api.get<{ user: PublicUser | null }>("/auth/session").then(
      (response) => active && setUser(response.data.user),
      () => active && setUser(null),
    );
    return () => {
      active = false;
    };
  }, [setUser]);

  const value = useMemo(
    () => ({ user, status, setUser, reload, logout }),
    [user, status, setUser, reload, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
