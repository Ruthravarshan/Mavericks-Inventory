import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authApi, setStoredToken, clearStoredAuth, getStoredToken } from "@/lib/api";
import type { User } from "@/types";
import { ROLES } from "@/lib/constants";

const USER_KEY = "mavericks_user";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isExecutive: boolean;
  isL2: boolean;
  isUser: boolean;
  isAuditor: boolean;
  /** L2 or Manager or Admin — can approve / manage. */
  isManagerOrAbove: boolean;
  /** Executive or regular User — can create requests / view own assets. */
  isRegularUser: boolean;
  /** Any role that can create or approve transactions (not auditor). */
  canTransact: boolean;
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
  // Start loading=true if we have a token to verify; this lets ProtectedRoute
  // wait for hydration instead of redirecting then bouncing back.
  const [isLoading, setIsLoading] = useState(() => !!getStoredToken());

  // Verify token on mount, and re-verify if we have a token but no user
  useEffect(() => {
    if (accessToken && !user) {
      setIsLoading(true);
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
        })
        .finally(() => setIsLoading(false));
    } else {
      // If no token, or if we already have both token and user, stop loading.
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user]);

  // Cross-tab sync: when another tab logs in/out, mirror that state here.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === USER_KEY) {
        try {
          setUser(e.newValue ? (JSON.parse(e.newValue) as User) : null);
        } catch {
          setUser(null);
        }
      } else if (e.key === null) {
        // Storage cleared entirely (e.g. logout)
        setUser(null);
        setAccessToken(null);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await authApi.login(email, password);
      const { accessToken: access_token, user: userData } = res.data;
      setStoredToken(access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setAccessToken(access_token);
      setUser(userData);
      return userData;
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
  const isUser = user?.role === ROLES.USER;
  const isAuditor = user?.role === ROLES.AUDITOR;
  const isManagerOrAbove = isAdmin || isManager || isL2;
  const isRegularUser = isUser || isExecutive;
  const canTransact = isAdmin || isManager || isL2 || isExecutive || isUser;

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
        isUser,
        isAuditor,
        isManagerOrAbove,
        isRegularUser,
        canTransact,
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
