import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authApi, setStoredToken, clearStoredAuth, getStoredToken } from "@/lib/api";
import type { User } from "@/types";
import { ROLES } from "@/lib/constants";

const USER_KEY = "mavericks_user";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isExecutive: boolean;
  isL2: boolean;
  isManagerOrAbove: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  });
  const [accessToken, setAccessToken] = useState<string | null>(getStoredToken);
  const [isLoading, setIsLoading] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (accessToken && !user) {
      authApi
        .me()
        .then((res) => {
          setUser(res.data);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        })
        .catch(() => {
          clearStoredAuth();
          setUser(null);
          setAccessToken(null);
        });
    }
  }, [accessToken, user]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(email, password);
      const { access_token, user: userData } = res.data;
      setStoredToken(access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setAccessToken(access_token);
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      clearStoredAuth();
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  const isAdmin = user?.role === ROLES.ADMIN;
  const isManager = user?.role === ROLES.MANAGER;
  const isExecutive = user?.role === ROLES.EXECUTIVE;
  const isL2 = user?.role === ROLES.L2;
  const isManagerOrAbove = isAdmin || isManager || isL2;

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        login,
        logout,
        isAdmin,
        isManager,
        isExecutive,
        isL2,
        isManagerOrAbove,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
