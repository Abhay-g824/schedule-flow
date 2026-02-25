import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Priority } from "@/types/task";

type UserProfile = {
  email: string;
  id?: number;
  role?: string;
  age?: number;
  priority_tasks?: Array<{ task: string; priority: Priority }>;
  onboarding_completed?: number;
};

type UpdateProfileData = {
  email: string;
  role?: string;
  age?: number;
  priority_tasks?: Array<{ task: string; priority: Priority }>;
};

type AuthContextType = {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  resetPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string, newPassword: string) => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("authToken"));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem("authUser");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const persist = (nextToken: string | null, nextUser: UserProfile | null) => {
    setToken(nextToken);
    setUser(nextUser);
    if (nextToken) localStorage.setItem("authToken", nextToken);
    else localStorage.removeItem("authToken");
    if (nextUser) localStorage.setItem("authUser", JSON.stringify(nextUser));
    else localStorage.removeItem("authUser");
  };

  const fetchUserProfile = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const profile = await res.json();
        setUser((prev) => {
          const updated = { ...prev, ...profile };
          localStorage.setItem("authUser", JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err) {
      console.error("Failed to fetch user profile", err);
    }
  }, [token]);

  const updateProfile = useCallback(async (data: UpdateProfileData) => {
    if (!token) throw new Error("Not authenticated");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update profile");
      }
      const updatedProfile = await res.json();
      setUser((prev) => {
        const updated = { ...prev, ...updatedProfile };
        localStorage.setItem("authUser", JSON.stringify(updated));
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Login failed");
      }
      const data = await res.json();
      persist(data.token, { 
        email: data.user.email,
        id: data.user.id,
        onboarding_completed: data.user.onboarding_completed || 0
      });
      // Fetch full profile after login
      if (data.token) {
        const profileRes = await fetch(`${API_URL}/user/profile`, {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          persist(data.token, profile);
        }
      }
    } catch (err: any) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Signup failed");
      }
      const data = await res.json();
      persist(data.token, { 
        email: data.user.email,
        id: data.user.id,
        onboarding_completed: data.user.onboarding_completed || 0
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    persist(null, null);
  }, []);

  const resetPassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!token) throw new Error("Not authenticated");
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/auth/reset-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Reset failed");
        }
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const forgotPassword = useCallback(async (email: string, newPassword: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Reset failed");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // no-op: state restored from localStorage on init
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, signup, logout, resetPassword, forgotPassword, fetchUserProfile, updateProfile }),
    [user, token, loading, login, signup, logout, resetPassword, forgotPassword, fetchUserProfile, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

